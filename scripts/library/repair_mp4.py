#!/usr/bin/env python3
"""Repair Matroska files mislabeled .mp4 without re-encoding video/audio.

Dry-run by default. Each replacement is atomic and happens only after every
compressed packet and codec configuration matches the source. No runtime work.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EBML = b'\x1aE\xdf\xa3'


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def signature(path):
    data = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_packets',
        '-show_data_hash', 'sha256', '-show_entries',
        'stream=index,codec_type,codec_name,profile,extradata_hash:packet=stream_index,data_hash',
        '-of', 'json', str(path),
    ]))
    # Container tags/dispositions may legitimately change between MKV and MP4;
    # the encoded payload and decoder configuration must remain byte-identical.
    fields = ['index', 'codec_type', 'codec_name', 'profile', 'extradata_hash']
    streams = [{key: stream[key] for key in fields if key in stream}
               for stream in data['streams']]
    if [s['codec_type'] for s in streams] != ['video', 'audio']:
        raise ValueError(f'Expected exactly one video and one audio stream: {path.name}')
    if [s['codec_name'] for s in streams] != ['h264', 'aac']:
        raise ValueError(f'Expected H.264/AAC for a lossless MP4 remux: {path.name}')
    return {
        'streams': streams,
        'packets': [[p['data_hash'] for p in data['packets'] if p['stream_index'] == s['index']]
                    for s in streams],
    }


def repair(path):
    original_stat = path.stat()
    original_hash = digest(path)
    pending = path.with_suffix('.remux-pending.mp4')
    # Never replace an interrupted or unrelated output without inspection.
    if pending.exists():
        raise FileExistsError(pending)
    try:
        original = signature(path)
        subprocess.run([
            'ffmpeg', '-nostdin', '-v', 'error', '-n', '-i', str(path),
            '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy',
            '-movflags', '+faststart', '-f', 'mp4', str(pending),
        ], check=True)
        if signature(pending) != original:
            raise ValueError(f'Codec configuration or compressed packets changed: {path.name}')
        # Refuse to replace a source modified concurrently during verification.
        if path.stat().st_mtime_ns != original_stat.st_mtime_ns or digest(path) != original_hash:
            raise ValueError(f'Source changed during repair: {path.name}')
        report = {
            'path': str(path.relative_to(ROOT)),
            'before_sha256': original_hash,
            'after_sha256': digest(pending),
            'before_bytes': original_stat.st_size,
            'after_bytes': pending.stat().st_size,
            'packet_counts': [len(p) for p in original['packets']],
            'compressed_packets_and_codec_configuration_identical': True,
        }
        shutil.copymode(path, pending)
        with pending.open('rb') as checked:
            os.fsync(checked.fileno())
        os.replace(pending, path)
        return report
    finally:
        if pending.exists():
            pending.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    affected = []
    for path in sorted((ROOT/'files').rglob('*.mp4')):
        if path.is_symlink():
            continue
        with path.open('rb') as source:
            if source.read(4) == EBML:
                affected.append(path)
    print(f'Matroska files mislabeled MP4: {len(affected)}', flush=True)
    if not args.apply:
        print('Dry run. Use --apply to remux and verify before atomic replacement.')
        return
    if not affected:
        return
    reports = ROOT/'docs/reports'
    reports.mkdir(parents=True, exist_ok=True)
    # Append so a resumed run retains evidence from earlier repaired files.
    with (reports/'mp4-repair.jsonl').open('a') as log:
        for index, path in enumerate(affected, 1):
            record = repair(path)
            log.write(json.dumps(record)+'\n')
            log.flush()
            os.fsync(log.fileno())
            if index % 10 == 0 or index == len(affected):
                print(f'Verified and repaired {index}/{len(affected)}', flush=True)


if __name__ == '__main__':
    main()

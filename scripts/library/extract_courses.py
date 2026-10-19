#!/usr/bin/env python3
"""Extract safely, verify every output CRC, then delete each verified archive."""
import json
import shutil
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = ROOT / 'files'
log = []
while archives := sorted(FILES.rglob('*.zip')):
    for archive in archives:
        with zipfile.ZipFile(archive) as z:
            for member in z.infolist():
                target = (archive.parent / member.filename).resolve()
                if not target.is_relative_to(FILES.resolve()):
                    raise ValueError(f'Unsafe ZIP path: {member.filename}')
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists() and target.stat().st_size != member.file_size:
                    raise ValueError(f'Conflicting existing file: {target}')
                if not target.exists():
                    with z.open(member) as source, target.open('wb') as dest:
                        shutil.copyfileobj(source, dest, 1024 * 1024)
                crc = 0
                with target.open('rb') as stream:
                    while block := stream.read(1024 * 1024):
                        crc = zlib.crc32(block, crc)
                if target.stat().st_size != member.file_size or crc != member.CRC:
                    raise ValueError(f'CRC mismatch: {target}')
            log.append({'archive': archive.name, 'entries': len(z.infolist()), 'verified': True})
        archive.unlink()
        print(f'Extracted, CRC verified and removed: {archive.name}', flush=True)
(ROOT / 'docs').mkdir(exist_ok=True)
(ROOT / 'docs/extraction-report.json').write_text(json.dumps(log, indent=2))

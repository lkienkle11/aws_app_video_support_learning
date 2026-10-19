#!/usr/bin/env python3
"""Delete only an explicit allowlist of Cloud Study generated paths.

Dry-run by default. Never follows symlinks, touches files/, deletes a database,
prunes Docker, or removes another application's cache. Close the app first.
"""
import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
parser.add_argument('--toolchains', action='store_true')
parser.add_argument('--external-app-cache', action='store_true')
options = parser.parse_args()
paths = [ROOT/name for name in ['target', 'gen', 'node_modules', 'binaries',
    'tools/npm-cache', 'tools/cargo-linux', 'tools/linux-target', 'tools/xwin',
    'tools/zig', 'tools/zig-cache', 'tools/zig.tar.xz', 'tools/cross',
    'tools/test-library', 'tools/test-results', 'tools/swift-cache',
    'tools/valid-commit.txt', 'tools/invalid-commit.txt', 'tools/linux-packages.log', 'tools/linux-measure-packages.log', 'tests/support/__pycache__']]
if options.toolchains:
    paths += [ROOT/name for name in ['tools/cargo', 'tools/rustup', 'tools/codegraph',
        'tools/bin', 'tools/rustup-init.sh']]
if options.external_app_cache:
    home = Path.home()
    paths += [home/name for name in ['Library/Caches/cloud-study',
        'Library/Caches/local.cloudstudy.desktop', 'Library/WebKit/local.cloudstudy.desktop',
        'Library/WebKit/cloud-study',
        # Exact compiler object proven created by the previous Cloud Study build.
        '.cache/zig/o/dd44ee6dc2c8488dfd2074af35ce013d']]

def size(path):
    if path.is_symlink(): return path.lstat().st_size
    if path.is_file(): return path.stat().st_size
    return sum(size(p) for p in path.iterdir())

report = {'dry_run':not options.apply, 'free_before':shutil.disk_usage(ROOT).free,'paths':[]}
for path in paths:
    if not path.exists() and not path.is_symlink(): continue
    report['paths'].append({'path':str(path),'logical_bytes':size(path)})
    if options.apply:
        if path.is_symlink() or path.is_file(): path.unlink()
        else: shutil.rmtree(path)
report['free_after'] = shutil.disk_usage(ROOT).free
print(json.dumps(report,indent=2))
if options.apply:
    reports = ROOT/'docs/reports'
    reports.mkdir(exist_ok=True)
    (reports/'cleanup-final.json').write_text(json.dumps(report,indent=2))

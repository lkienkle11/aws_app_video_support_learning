#!/usr/bin/env python3
"""Keep one current native desktop build, without duplicate archives or SDKs."""
import json
import platform
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT/'dist'
DIST.mkdir(exist_ok=True)
if platform.system() == 'Darwin':
    output = DIST/'Cloud Study.app'
    if output.exists(): shutil.rmtree(output)
    shutil.copytree(ROOT/'target/release/bundle/macos/Cloud Study.app',output,symlinks=True)
else:
    output = DIST/('windows' if platform.system() == 'Windows' else 'linux')
    output.mkdir(exist_ok=True)
    suffix = '.exe' if platform.system() == 'Windows' else ''
    for name in ['cloud-study','cloud-study-core']:
        shutil.copy2(ROOT/'target/release'/f'{name}{suffix}',output/f'{name}{suffix}')
size = sum(p.stat().st_size for p in output.rglob('*') if p.is_file())
if size >= 20_000_000: raise SystemExit('Desktop package exceeds 20 MB')
print(json.dumps({'platform':platform.system(),'artifact':str(output),'bytes':size,'passed':True}))

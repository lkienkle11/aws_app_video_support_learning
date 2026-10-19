#!/usr/bin/env python3
"""Package existing macOS ARM64, Linux ARM64 and Windows x64 release builds.

Close the running local app before replacing its .app directory.
No course material, SQLite, SDK, Node or WebView runtime is included.
"""
import hashlib
import json
import shutil
import subprocess
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
app = DIST / 'Cloud Study.app'
if app.exists():
    shutil.rmtree(app)
shutil.copytree(ROOT / 'target/release/bundle/macos/Cloud Study.app', app, symlinks=True)
subprocess.run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(app),
                str(DIST / 'cloud-study-macos-arm64.zip')], check=True)

linux = DIST / 'linux-arm64'
linux.mkdir(exist_ok=True)
for name in ['cloud-study', 'cloud-study-core']:
    shutil.copy2(ROOT / 'target/aarch64-unknown-linux-gnu/release' / name, linux / name)
(linux / 'README.txt').write_text(
    'Cloud Study - Linux ARM64\nRun ./cloud-study from this folder. '
    'Keep cloud-study-core next to it. Select your files folder in the app.\n'
    'Requires GTK 3, WebKitGTK 4.1, libsoup 3, libayatana-appindicator3 and '
    'GStreamer H.264/AAC codecs from your distribution.\n'
    'On Debian 12: sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 '
    'libayatana-appindicator3-1 gstreamer1.0-libav gstreamer1.0-plugins-good\n'
    'Native GUI playback has not been verified on Linux in this macOS session.\n')
with tarfile.open(DIST / 'cloud-study-linux-arm64.tar.gz', 'w:gz') as archive:
    archive.add(linux, arcname='cloud-study-linux-arm64')

windows = DIST / 'windows-x64'
windows.mkdir(exist_ok=True)
shutil.copy2(ROOT / 'target/x86_64-pc-windows-msvc/release/cloud-study.exe',
             windows / 'cloud-study.exe')
shutil.copy2(ROOT / 'binaries/cloud-study-core-x86_64-pc-windows-msvc.exe',
             windows / 'cloud-study-core.exe')
(windows / 'README.txt').write_text(
    'Cloud Study - Windows x64\nRun cloud-study.exe. Keep cloud-study-core.exe '
    'next to it. Select your files folder in the app.\n'
    'Requires the Microsoft Edge WebView2 Evergreen Runtime.\n'
    'Cross-built from macOS. Native Windows playback and RAM have not been '
    'verified in this session.\n')
with zipfile.ZipFile(DIST / 'cloud-study-windows-x64.zip', 'w',
                     compression=zipfile.ZIP_DEFLATED) as archive:
    for file in windows.iterdir():
        archive.write(file, arcname='cloud-study-windows-x64/' + file.name)

report = []
for folder, archive_name, platform in [
    (app, 'cloud-study-macos-arm64.zip', 'macOS arm64'),
    (linux, 'cloud-study-linux-arm64.tar.gz', 'Linux arm64'),
    (windows, 'cloud-study-windows-x64.zip', 'Windows x64'),
]:
    archive = DIST / archive_name
    size = sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())
    item = {'platform': platform, 'uncompressed_bytes': size,
            'archive': archive_name, 'archive_bytes': archive.stat().st_size,
            'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
            'includes': 'GUI host and Rust core; system WebView and course data excluded',
            'passed': size < 20_000_000 and archive.stat().st_size < 20_000_000}
    report.append(item)
    print(json.dumps(item))
(ROOT / 'docs/build-size-report.json').write_text(json.dumps(report, indent=2))
if not all(item['passed'] for item in report):
    raise SystemExit('A package exceeds the 20 MB budget')

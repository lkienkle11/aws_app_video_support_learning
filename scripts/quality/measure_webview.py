#!/usr/bin/env python3
"""Conservative macOS RSS sampling: WebView host plus all WebKit XPCs.

Open Cloud Study and play a video before running. Shared pages may be counted
twice. Other apps' WebKit services, if present, are deliberately included.
"""
import json
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[2]
samples = []
for _ in range(40):
    rows = []
    raw = subprocess.check_output(['ps','-axo','pid=,ppid=,rss=,comm='],text=True)
    for line in raw.splitlines():
        pid, ppid, rss, command = line.strip().split(None,3)
        if (str(root) in command and command.endswith('/cloud-study')) or '/com.apple.WebKit.' in command:
            rows.append({'pid':int(pid),'ppid':int(ppid),'rss_bytes':int(rss)*1024,'command':command})
    samples.append({'bytes':sum(r['rss_bytes'] for r in rows),'processes':rows})
    time.sleep(.25)
peak = max(samples,key=lambda r:r['bytes'])
report = {'platform':'macOS arm64','webview_group_peak_sampled_rss_bytes':peak['bytes'],'limit_bytes':750_000_000,'passed':peak['bytes']<=750_000_000,'samples':len(samples),'processes_at_peak':peak['processes'],'measurement':'10-second RSS sample. Includes Rust/Tauri GUI host and all running WebKit XPCs; excludes cloud-study-core. Shared pages may be double counted. Local run only, not a universal upper bound.'}
(root/'docs/reports/webview-memory-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not report['passed']: raise SystemExit(1)

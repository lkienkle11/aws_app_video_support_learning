#!/usr/bin/env python3
"""Exercise the actual library and sample backend RSS. macOS/Linux only."""
import json
import os
import platform
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
worker = subprocess.Popen([str(ROOT/os.environ.get('CLOUD_STUDY_CORE','target/release/cloud-study-core'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
samples = []
done = threading.Event()
def sample():
    while not done.is_set():
        try: samples.append(int(subprocess.check_output(['ps','-o','rss=','-p',str(worker.pid)],text=True).strip())*1024)
        except (ValueError, subprocess.CalledProcessError): pass
        done.wait(.02)
thread = threading.Thread(target=sample); thread.start()
def call(command, **args):
    worker.stdin.write(json.dumps({'command':command,'args':args})+'\n'); worker.stdin.flush()
    response = json.loads(worker.stdout.readline())
    if 'error' in response: raise RuntimeError(response['error'])
    return response['ok']
try:
    info = call('open_library',path=str(ROOT/'files'))
    lessons = call('search_lessons',query='',language='')
    assert len(lessons) == 277
    assert len(call('search_lessons',query='bao mat',language='vi')) > 0
    assert len(call('search_lessons',query='storage',language='en')) > 0
    for lesson in lessons:
        for track in lesson['tracks']: assert call('read_subtitle',relative=track['path']).startswith('WEBVTT')
    # Repeated searches expose growth caused by retained buffers or query results.
    for i in range(30): call('search_lessons',query='' if i % 2 else 'AWS',language='')
    time.sleep(.2)
finally:
    done.set(); thread.join(); worker.stdin.close(); worker.wait(timeout=5)
report = {'platform':f'{platform.system()} {platform.machine()}','backend_peak_sampled_rss_bytes':max(samples),'backend_limit_bytes':20_000_000,'samples':len(samples),'lessons':len(lessons),'passed':max(samples)<=20_000_000,'measurement':'RSS sampled every 20 ms during import, bilingual searches and reading every subtitle; excludes WebView host'}
(ROOT/os.environ.get('CLOUD_STUDY_MEMORY_REPORT','docs/reports/backend-memory-report.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not report['passed']: raise SystemExit(1)

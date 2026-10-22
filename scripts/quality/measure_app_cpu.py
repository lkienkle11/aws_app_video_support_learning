#!/usr/bin/env python3
"""Sample a running macOS Cloud Study app. Usage: script.py LABEL [SECONDS].

CPU-time differences over one-second intervals, 100% equals one core.
Conservatively includes all running WebKit XPCs. Close other WebKit apps and
inspect the reported PID list before attributing the result to Cloud Study.
Keep the player visible and playing for the entire sample window.
"""
import subprocess,time,json,statistics,sys,platform,os
from pathlib import Path
label=sys.argv[1]
duration=int(sys.argv[2]) if len(sys.argv)>2 else 30
raw=subprocess.check_output(['ps','-axo','pid=,comm='],text=True)
procs={int(s.split(None,1)[0]):s.split(None,1)[1] for l in raw.splitlines() if (s:=l.strip()) and ('/cloud-study' in s or '/com.apple.WebKit.' in s)}
def tick():
    raw=subprocess.check_output(['ps','-p',','.join(map(str,procs)),'-o','pid=,time=,rss='],text=True)
    values={}
    for row in raw.splitlines():
        pid,t,rss=row.split()
        seconds=0
        for part in map(float,t.split(':')): seconds=seconds*60+part
        values[int(pid)]=(seconds,int(rss)*1024)
    return time.monotonic(),values
prev_t,prev=tick()
samples=[]
for i in range(duration):
    time.sleep(1)
    now,values=tick()
    elapsed=now-prev_t
    cpu={str(pid):100*(value[0]-prev[pid][0])/elapsed for pid,value in values.items() if pid in prev}
    samples.append({'cpu_percent':sum(cpu.values()),'process_cpu':cpu,'rss_bytes':sum(v[1] for v in values.values())})
    prev_t,prev=now,values
out={'label':label,'platform':platform.platform(),'logical_cpus':os.cpu_count(),'scope':'Sum of host, core and listed WebKit XPCs; 100 percent = one core; 1 second CPU-time deltas','processes':procs,'seconds':duration,'mean_cpu_percent':statistics.mean(s['cpu_percent'] for s in samples),'p95_cpu_percent':sorted(s['cpu_percent'] for s in samples)[int((len(samples)-1)*.95)],'peak_cpu_percent':max(s['cpu_percent'] for s in samples),'peak_rss_bytes':max(s['rss_bytes'] for s in samples),'samples':samples}
Path(f'docs/reports/cpu-{label}.json').write_text(json.dumps(out,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='samples'},indent=2))

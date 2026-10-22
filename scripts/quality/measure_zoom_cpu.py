#!/usr/bin/env python3
"""macOS native rendering CPU benchmark. Compile the shared WebKit harness first.

swiftc -O -module-cache-path tools/swift-cache tests/native/captions-webkit.swift \
  -o tools/diagnostics/zoom-performance
python3 scripts/quality/measure_zoom_cpu.py foreground

Includes the harness host and newly created WebKit XPCs, excludes other apps.
Not a measurement of Tauri/core IPC; measure the packaged app separately.
100% CPU equals one logical core; sampling windows are one second.
"""
import subprocess,time,json,statistics,threading,queue,os,platform,sys,ctypes,struct
from pathlib import Path
root=Path.cwd()
label=sys.argv[1] if len(sys.argv)>1 else 'foreground'
libproc=ctypes.CDLL('/usr/lib/libproc.dylib')
libproc.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p]
libproc.proc_pid_rusage.restype=ctypes.c_int
timebase=ctypes.create_string_buffer(8)
ctypes.CDLL('/usr/lib/libSystem.B.dylib').mach_timebase_info(ctypes.byref(timebase))
numer,denom=struct.unpack('II',timebase.raw)
tick_to_nanoseconds=numer/denom
def processes():
    raw=subprocess.check_output(['ps','-axo','pid=,time=,rss=,comm='],text=True)
    out={}
    for row in raw.splitlines():
        pid,cpu,rss,command=row.strip().split(None,3)
        seconds=0
        for part in map(float,cpu.split(':')): seconds=seconds*60+part
        pid=int(pid)
        if '/com.apple.WebKit.' in command or 'zoom-performance' in command:
            info=ctypes.create_string_buffer(128)
            if libproc.proc_pid_rusage(pid,0,ctypes.byref(info))==0:
                user,system=struct.unpack_from('QQ',info.raw,16)
                seconds=(user+system)*tick_to_nanoseconds/1e9
        out[pid]={'cpu':seconds,'rss':int(rss)*1024,'command':command}
    return out
baseline=set(processes())
video=next(root.glob('files/**/*115-Glue*.mp4'))
proc=subprocess.Popen([str(root/'tools/diagnostics/zoom-performance'),str(root),str(video),os.environ.get('CLOUD_STUDY_CPU_DRIVER','tests/native/zoom-performance.mjs')],stdout=subprocess.PIPE,stderr=open('tools/diagnostics/cpu-harness-stderr.log','w'),text=True,bufsize=1)
events=queue.Queue()
def reader():
    for line in proc.stdout:
        try: events.put(json.loads(line))
        except ValueError: pass
threading.Thread(target=reader,daemon=True).start()
phases={}; phase=None; previous={}; prev_t=time.monotonic(); seen={}
while proc.poll() is None or not events.empty():
    while not events.empty():
        event=events.get()
        if event.get('event')=='start':
            phase=event['phase']; phases[phase]={'start':event,'samples':[]}; previous={}
            print('start',phase,flush=True)
        elif event.get('event')=='end':
            phases[event['phase']]['end']=event
            vals=[s['cpu_percent'] for s in phases[event['phase']]['samples']]
            print('end',event['phase'],'mean=',round(statistics.mean(vals),2),'peak=',round(max(vals),2),'events=',event['events'],'focused=',event.get('focused'),flush=True)
            phase=None
        elif 'passed' in event:
            if not event['passed']: raise RuntimeError(event)
    now=time.monotonic(); all_procs=processes()
    current={pid:info for pid,info in all_procs.items() if pid==proc.pid or (pid not in baseline and '/com.apple.WebKit.' in info['command'])}
    seen.update({pid:info['command'] for pid,info in current.items()})
    if phase and previous:
        per_process={str(pid):(info['cpu']-previous[pid]['cpu'])*100/(now-prev_t) for pid,info in current.items() if pid in previous}
        phases[phase]['samples'].append({'cpu_percent':sum(per_process.values()),'by_pid':per_process,'rss_bytes':sum(info['rss'] for info in current.values())})
    previous=current;prev_t=now
    time.sleep(1)
proc.wait()
for name,p in phases.items():
    samples=p['samples']; values=[s['cpu_percent'] for s in samples]
    p['mean_cpu_percent']=statistics.mean(values)
    p['p95_cpu_percent']=sorted(values)[int((len(values)-1)*.95)]
    p['peak_cpu_percent']=max(values)
    p['peak_rss_bytes']=max(s['rss_bytes'] for s in samples)
    p['under_8_mean']=p['mean_cpu_percent']<8
    p['valid']=p['end']['elapsedVideo']>13 and not p['start']['hidden'] and not p['end']['hidden'] and not p['end'].get('hiddenDuring',False) and (not name.endswith('zoom-pan') or p['end']['events']>=1000)
report={'platform':platform.platform(),'logical_cpus':os.cpu_count(),'processes':seen,'scope':'Native WKWebView benchmark with production Player/VideoZoom/Captions and real 1080p30 H264; host plus newly spawned WebKit XPCs; no Tauri/core IPC; 100%=one core; 1-second nanosecond CPU-time deltas from proc_pid_rusage','mach_timebase_numer':numer,'mach_timebase_denom':denom,'exit_code':proc.returncode,'phases':phases}
Path(f'docs/reports/zoom-cpu-{label}.json').write_text(json.dumps(report,indent=2))
print(json.dumps({name:{k:v for k,v in p.items() if k not in ['samples']} for name,p in phases.items()},indent=2))

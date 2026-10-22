# Native macOS audio regression

Runs the production `AudioOutput` module inside WKWebView with AAC media served
through separate `tauri:` and `asset:` schemes and CORS headers matching Tauri.
Measures actual PCM RMS at 100%, 200%, after changing media and after restoring
100%. This catches a silent CORS-tainted media source that mocks cannot detect.
It is a macOS engine integration test, not a Windows/Linux runtime check.

From the repository root on macOS with Xcode Command Line Tools and ffmpeg:

```sh
mkdir -p tools/test-results tools/swift-cache
ffmpeg -v error -f lavfi -i color=black:s=160x90:r=10 \
  -f lavfi -i sine=frequency=440:sample_rate=48000 -t 20 \
  -af volume=0.1 -c:v libx264 -c:a aac -movflags +faststart \
  -y tools/test-results/tone.mp4
swift -module-cache-path tools/swift-cache tests/native/audio-webkit.swift \
  "$PWD" "$PWD/tools/test-results/tone.mp4"
```

A small test window opens and exits automatically. The low-level test tone is
briefly audible. JSON output must report `passed: true`; failures/timeouts exit
nonzero. Generated media and compiler cache remain in ignored `tools/` paths.

## Native subtitle size regression

`captions-webkit.swift` loads the production HTML, CSS and `Captions` module in
WKWebView, replacing only the application startup script with the test driver.
Pass an existing MP4; the test reads it without changing the course library or
SQLite. It checks real text-track rendering, unchanged font and glyph dimensions,
control clearance and horizontal bounds at 12/24/48/96 px across
inline, theater-sized, fullscreen-shaped, wide and mobile frames, then back to
inline. A metadata-change check covers portrait video. Fullscreen-shaped geometry
does not exercise the OS fullscreen transition; verify that separately in the app.

```sh
mkdir -p tools/test-results tools/swift-cache
swift -module-cache-path tools/swift-cache tests/native/captions-webkit.swift \
  "$PWD" "/absolute/path/to/course.mp4" > tools/test-results/captions-webkit.json
```

The result must report `passed: true`. This test opens a temporary native window
and exits automatically. It creates no web server or browser build.


## Video zoom and seek feedback

Reuse the native harness with the zoom driver:

```sh
swift -module-cache-path tools/swift-cache tests/native/captions-webkit.swift \
  "$PWD" "/absolute/path/to/course.mp4" tests/native/zoom-webkit.mjs
```

Uses the production Player, zoom module, dialogs and CSS with real MP4 metadata.
Checks synthetic WebKit gesture and wheel event paths, all four combinations of
input preferences, subtitle glyph/font stability across inline/fullscreen-shaped/
floating-shaped/small viewports, persistence payloads, and seek arrows/placement/
auto-hide. The backend is replaced with an in-memory transport; Rust integration
tests separately verify SQLite persistence. Physical trackpad gestures and actual
OS fullscreen/floating-window transitions require app QA.


## CPU during video zoom and pan (macOS)

Close Cloud Study before the isolated rendering benchmark. Compile the same
WebKit harness with optimization, then run the sampler from the repository root:

```sh
mkdir -p tools/diagnostics tools/swift-cache
swiftc -O -module-cache-path tools/swift-cache tests/native/captions-webkit.swift \
  -o tools/diagnostics/zoom-performance
python3 scripts/quality/measure_zoom_cpu.py visible-final
```

`zoom-performance.mjs` loads the production Player, VideoZoom, Captions, DOM and
CSS and plays the existing Glue lesson (H.264 1920x1080, 30 fps) with subtitles.
It tests 100%, static 400%, and repeated synthetic zoom/pan events at 8 ms timer
intervals in inline, floating-sized and native fullscreen windows. Each phase
warms up for 3 seconds and samples for 15 seconds. The window stays above other
windows to avoid WebKit occlusion throttling. The report includes visibility,
focus, actual event count, video time advancement and dropped-frame counters;
a hidden phase or a stress phase with fewer than 1000 events is invalid.

The sampler sums the benchmark host and its newly spawned WebKit GPU, network
and content services. It excludes other applications, the sampler itself, and
Tauri/core IPC. Results are written to ignored `docs/reports/zoom-cpu-<label>.json`.
Measure the packaged app separately before calling a result whole-app CPU.

CPU is reported in Activity Monitor units: 100% equals one logical core. The
macOS `proc_pid_rusage` CPU counters are converted from Mach ticks using the
local `mach_timebase_info` ratio, then differenced over approximately one-second
intervals. Report mean, p95 and peak separately; do not divide by core count to
claim that a single-core CPU budget passed. A local measurement is not a
universal guarantee or a GPU utilization measurement.


The optimized zoom path batches input updates and caches viewport dimensions.
While playing, transforms follow video-frame callbacks; paused videos use animation
frames. Reset cancels pending work, and pausing flushes the latest transform.

For a same-process A/B comparison, set `CLOUD_STUDY_CPU_DRIVER` to
`tests/native/crossover-zoom-performance.mjs` and `CLOUD_STUDY_ZOOM_REFERENCE` to
an older `video-zoom.js` inside this repository. The benchmark alternates the old
and current handlers against the same video interval. Reject phases whose
visibility changed during sampling. The local final report is
`docs/reports/zoom-cpu-crossover-final.json`; its valid pair measured 23.70% before
and 19.65% after. This rendering benchmark does not establish whole-app CPU below
8%; that target remains unmet.

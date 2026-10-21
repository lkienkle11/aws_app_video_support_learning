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

import { VideoZoom as ReferenceZoom } from '/features/player/video-zoom-reference.js';
import { Player } from '/features/player/player.js';
import { playbackDefaults } from '/shared/preferences.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = (value) => window.webkit.messageHandlers.result.postMessage(JSON.stringify(value));
const $ = (id) => document.getElementById(id);
try {
  window.__TAURI__ = { core: { invoke: async () => ({ ...playbackDefaults }) } };
  const frame = $('player');
  document.body.append(frame);
  Object.assign(frame.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    borderRadius: '0',
  });
  const player = new Player({
    notify: (error) => {
      throw new Error(error);
    },
    onProgress() {},
    onNavigate() {},
  });
  await player.loadSettings();
  const video = player.video;
  video.src = 'asset://localhost/video.mp4';
  video.loop = true;
  await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  const track = video.addTextTrack('subtitles', 'English', 'en');
  track.mode = 'hidden';
  for (let i = 0; i < 200; i++)
    track.addCue(
      new VTTCue(i * 3, i * 3 + 2.9, `AWS learning subtitle ${i}: transform and load data.`),
    );
  track.addEventListener('cuechange', () => player.captions.render(track));
  player.captions.apply();
  player.selectedTrack = 0;
  await video.play();
  report({ resize: [1000, 562] });
  await wait(2500);
  const reference = Object.create(ReferenceZoom.prototype);
  Object.assign(reference, { frame, video, scale: 1, x: 0, y: 0, touchpad: true, mouse: true });
  const results = [];
  let hiddenDuring = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenDuring = true;
  });
  for (const [phase, zoom] of [
    ['baseline-400', reference],
    ['before-zoom-pan', reference],
    ['after-zoom-pan', player.zoom],
    ['before-repeat-zoom-pan', reference],
    ['after-repeat-zoom-pan', player.zoom],
  ]) {
    player.zoom.reset();
    reference.reset();
    zoom.zoom(4);
    player.visibility.hide();
    video.currentTime = 10;
    let count = 0;
    const timer = phase.endsWith('zoom-pan')
      ? setInterval(() => {
          const delta = Math.sin(count / 15) * 8;
          zoom.wheel({
            target: video,
            ctrlKey: count % 4 === 0,
            deltaMode: 0,
            deltaX: delta,
            deltaY: count % 4 === 0 ? Math.cos(count / 10) * 8 : -delta,
            clientX: 500,
            clientY: 281,
            preventDefault() {},
          });
          count++;
        }, 8)
      : null;
    await wait(3000);
    hiddenDuring = false;
    const quality = video.getVideoPlaybackQuality(),
      start = video.currentTime;
    report({
      phase,
      event: 'start',
      hidden: document.hidden,
      focused: document.hasFocus(),
      videoFrameScheduler: typeof video.requestVideoFrameCallback === 'function',
    });
    await wait(15000);
    clearInterval(timer);
    const after = video.getVideoPlaybackQuality();
    const result = {
      phase,
      event: 'end',
      hidden: document.hidden,
      focused: document.hasFocus(),
      hiddenDuring,
      elapsedVideo: video.currentTime - start,
      events: count,
      dropped: after.droppedVideoFrames - quality.droppedVideoFrames,
    };
    results.push(result);
    report(result);
  }
  video.pause();
  report({ passed: true, results });
} catch (error) {
  report({ passed: false, error: `${error.message}\n${error.stack}` });
}

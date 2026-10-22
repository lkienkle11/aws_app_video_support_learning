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
  const results = [];
  for (const [mode, width, height] of [
    ['inline', 1000, 562],
    ['floating', 560, 315],
    ['fullscreen', 1728, 1117],
  ]) {
    report({ resize: [width, height] });
    if (mode === 'fullscreen') report({ fullscreen: true });
    await wait(2500);
    for (const state of ['100', '400', 'zoom-pan']) {
      player.zoom.reset();
      if (state !== '100') player.zoom.zoom(4);
      player.visibility.hide();
      let count = 0;
      const animate =
        state === 'zoom-pan'
          ? setInterval(() => {
              const delta = Math.sin(count / 15) * 8;
              video.dispatchEvent(
                new WheelEvent('wheel', {
                  bubbles: true,
                  cancelable: true,
                  ctrlKey: count % 4 === 0,
                  deltaMode: 0,
                  deltaX: delta,
                  deltaY: count % 4 === 0 ? Math.cos(count / 10) * 8 : -delta,
                  clientX: frame.clientWidth / 2,
                  clientY: frame.clientHeight / 2,
                }),
              );
              count++;
            }, 8)
          : null;
      await wait(3000);
      const before = video.getVideoPlaybackQuality();
      const start = video.currentTime;
      report({
        phase: `${mode}-${state}`,
        event: 'start',
        video: { width: video.videoWidth, height: video.videoHeight },
        viewport: [frame.clientWidth, frame.clientHeight],
        audioBoost: player.audio.boost,
        focused: document.hasFocus(),
        hidden: document.hidden,
      });
      await wait(15000);
      const after = video.getVideoPlaybackQuality();
      clearInterval(animate);
      const result = {
        phase: `${mode}-${state}`,
        event: 'end',
        elapsedVideo: (video.currentTime - start + video.duration) % video.duration,
        frames: after.totalVideoFrames - before.totalVideoFrames,
        dropped: after.droppedVideoFrames - before.droppedVideoFrames,
        scale: player.zoom.scale,
        events: count,
        focused: document.hasFocus(),
        hidden: document.hidden,
      };
      results.push(result);
      report(result);
    }
  }
  video.pause();
  report({ passed: true, results });
} catch (error) {
  report({ passed: false, error: `${error.message}\n${error.stack}` });
}

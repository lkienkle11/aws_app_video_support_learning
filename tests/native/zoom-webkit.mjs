import { Player } from '/features/player/player.js';
import { playbackDefaults } from '/shared/preferences.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const $ = (id) => document.getElementById(id);
try {
  const writes = [];
  window.__TAURI__ = {
    core: {
      invoke: async (_backend, { command, args }) => {
        if (command === 'load_playback_settings') return { ...playbackDefaults };
        if (command === 'save_playback_settings') writes.push(args.settings);
      },
    },
  };
  const frame = $('player'),
    video = $('video'),
    box = $('caption-overlay');
  document.body.append(frame);
  Object.assign(frame.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '640px',
    height: '360px',
  });
  const player = new Player({
    notify: (error) => {
      throw new Error(error);
    },
    onProgress() {},
    onNavigate() {},
  });
  await player.loadSettings();
  video.src = 'asset://localhost/video.mp4';
  await new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('metadata failed')), { once: true });
  });
  player.captions.apply();
  player.captions.render({ activeCues: [{ text: 'Subtitle stays the same size' }] });
  const glyph = document.createRange();
  glyph.setStart(box.firstChild, 0);
  glyph.setEnd(box.firstChild, 4);
  const baseline = glyph.getBoundingClientRect();
  const wheel = (deltaY, ctrlKey = true, deltaX = 0) =>
    video.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey,
        deltaY,
        deltaX,
        clientX: 320,
        clientY: 180,
      }),
    );
  const samples = [];
  for (const [mode, width, height] of [
    ['inline', 640, 360],
    ['fullscreen-shape', 1440, 900],
    ['floating-shape', 560, 315],
    ['small', 320, 180],
  ]) {
    Object.assign(frame.style, { width: `${width}px`, height: `${height}px` });
    await wait(60);
    player.zoom.reset();
    wheel(-100);
    check(player.zoom.scale > 1, `${mode}: pinch wheel not zooming`);
    wheel(25, false, 30);
    await wait(40);
    const bounds = glyph.getBoundingClientRect();
    check(
      Math.abs(bounds.width - baseline.width) < 2 && Math.abs(bounds.height - baseline.height) < 2,
      `${mode}: subtitles scaled`,
    );
    check(getComputedStyle(box).fontSize === '24px', `${mode}: subtitle font changed`);
    check(getComputedStyle($('player-controls')).transform === 'none', 'controls transformed');
    check(video.style.transform.includes('scale('), 'picture not transformed');
    samples.push({
      mode,
      scale: player.zoom.scale,
      x: player.zoom.x,
      y: player.zoom.y,
      font: getComputedStyle(box).fontSize,
    });
    wheel(10000);
    wheel(10000);
    check(
      player.zoom.scale === 1 && player.zoom.x === 0 && player.zoom.y === 0,
      'minimum must reset coordinates',
    );
  }
  Object.assign(frame.style, { width: '640px', height: '360px' });
  // WebKit's native pinch event path uses cumulative scale, not repeated multipliers.
  for (const [type, scale] of [
    ['gesturestart', 1],
    ['gesturechange', 2],
    ['gesturechange', 2.5],
    ['gestureend', 2.5],
  ]) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { scale, clientX: 320, clientY: 180 });
    video.dispatchEvent(event);
  }
  check(player.zoom.scale === 2.5, 'WebKit cumulative pinch is incorrect');
  for (const touchpad of [false, true])
    for (const mouse of [false, true]) {
      $('zoom-touchpad').checked = touchpad;
      $('zoom-mouse').checked = mouse;
      $('zoom-touchpad').dispatchEvent(new Event('change'));
      player.zoom.reset();
      wheel(-100);
      check(player.zoom.scale > 1 === touchpad, 'touchpad toggle ignored');
      player.zoom.reset();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
      wheel(-100);
      check(player.zoom.scale > 1 === mouse, 'mouse toggle ignored');
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
      await player.playback.flush();
      const stored = writes.at(-1) || player.playback.value;
      check(
        stored.zoom_touchpad === touchpad && stored.zoom_mouse === mouse,
        'toggles not sent to persistence',
      );
      check(
        !('scale' in stored) && !('x' in stored) && !('y' in stored),
        'transient state sent to database',
      );
    }
  // Playing uses video-frame callbacks; pausing must not strand a pending pan.
  await video.play();
  player.zoom.reset();
  wheel(-100);
  await wait(140);
  check(video.style.transform.includes('scale('), 'playing video did not paint zoom');
  player.zoom.pan(20, 10);
  video.pause();
  await wait(40);
  check(player.zoom.pendingFrame == null, 'pause stranded a scheduled video frame');
  check(video.style.transform.includes('scale('), 'pause lost zoom geometry');
  player.zoom.reset();
  $('zoom-settings-open').click();
  check($('zoom-settings-dialog').open, 'zoom modal not open');
  $('zoom-settings-close').click();
  for (const seconds of [-5, 5, -10, 10]) {
    player.seekBy(seconds);
    const feedback = $('seek-feedback'),
      rect = feedback.getBoundingClientRect();
    check(rect.width < 100 && rect.height < 100, 'seek feedback is oversized');
    check($('seek-feedback-icon').textContent === (seconds < 0 ? '❮❮' : '❯❯'), 'wrong arrow');
    check(seconds < 0 ? rect.right < 320 : rect.left > 320, 'wrong side');
  }
  await wait(650);
  check($('seek-feedback').hidden, 'seek feedback did not disappear');
  player.zoom.resize.disconnect();
  player.captions.resize.disconnect();
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({
      passed: true,
      samples,
      toggleCombinations: 4,
      seekDirections: 4,
      nativePinchPath: true,
    }),
  );
} catch (error) {
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({ passed: false, error: `${error.message}\n${error.stack || ''}` }),
  );
}

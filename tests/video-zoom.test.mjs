import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoZoom } from '../ui/features/player/video-zoom.js';
import { PreferenceStore, playbackDefaults } from '../ui/shared/preferences.js';

function setup() {
  const zoom = Object.create(VideoZoom.prototype);
  zoom.frame = {
    clientWidth: 640,
    clientHeight: 360,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    classList: { toggle() {}, remove() {} },
  };
  zoom.video = { videoWidth: 1920, videoHeight: 1080, style: {} };
  zoom.scale = 1;
  zoom.x = zoom.y = 0;
  zoom.configure(playbackDefaults);
  return zoom;
}

test('zoom anchors the picture, clamps pan at every edge, and never shrinks below 100%', () => {
  const z = setup();
  z.zoom(2, 480, 180);
  assert.equal(z.x, -160);
  assert.equal(z.y, 0);
  z.pan(10000, -10000);
  assert.equal(z.x, 320);
  assert.equal(z.y, -180);
  z.zoom(100);
  assert.equal(z.scale, 4);
  z.zoom(0.25);
  assert.equal(z.scale, 1);
  assert.equal(z.x, 0);
  assert.equal(z.y, 0);
  assert.equal(z.video.style.transform, '');
  z.frame.clientHeight = 900;
  z.viewport = null; // Production ResizeObserver invalidates the cached viewport.
  z.zoom(2);
  assert.equal(z.limits().y, 0, 'letterboxed picture cannot be dragged off-screen');
});

test('pinch and physical Ctrl-wheel honor all four toggle combinations; plain wheel pans only when zoomed', () => {
  for (const touchpad of [false, true])
    for (const mouse of [false, true]) {
      const z = setup();
      z.configure({ zoom_touchpad: touchpad, zoom_mouse: mouse });
      const wheel = {
        target: z.video,
        ctrlKey: true,
        deltaMode: 0,
        deltaY: -100,
        deltaX: 0,
        clientX: 320,
        clientY: 180,
        preventDefault() {},
      };
      z.wheel(wheel);
      assert.equal(z.scale > 1, touchpad);
      z.reset();
      z.control = true;
      z.wheel(wheel);
      assert.equal(z.scale > 1, mouse);
      z.reset();
      z.zoom(2);
      z.control = false;
      z.wheel({ ...wheel, ctrlKey: false, deltaY: 20 });
      assert.equal(z.y, touchpad ? -20 : 0);
    }
});

test('zoom coordinates never enter stored preferences; toggles survive reopening', async () => {
  let stored = {};
  const request = async (cmd, args) =>
    cmd.startsWith('load_') ? stored : (stored = args.settings);
  for (const touchpad of [false, true])
    for (const mouse of [false, true]) {
      const prefs = new PreferenceStore('playback', playbackDefaults, { request });
      await prefs.load();
      prefs.update({ zoom_touchpad: touchpad, zoom_mouse: mouse });
      const zoom = setup();
      zoom.zoom(3);
      zoom.pan(200, 50);
      await prefs.flush();
      const reopened = await new PreferenceStore('playback', playbackDefaults, { request }).load();
      assert.equal(reopened.zoom_touchpad, touchpad);
      assert.equal(reopened.zoom_mouse, mouse);
      for (const key of ['scale', 'x', 'y']) assert.equal(key in reopened, false);
    }
});

test('dragging pans without a playback click; mouse-only mode requires Ctrl and cancel releases capture', () => {
  const z = setup();
  let captured = null;
  z.frame.setPointerCapture = (id) => (captured = id);
  z.frame.hasPointerCapture = (id) => captured === id;
  z.frame.releasePointerCapture = () => (captured = null);
  z.frame.classList.add = () => {};
  z.configure({ zoom_touchpad: false, zoom_mouse: true });
  z.zoom(2);
  const down = {
    target: z.video,
    button: 0,
    pointerId: 1,
    clientX: 200,
    clientY: 100,
    preventDefault() {},
  };
  z.start(down);
  assert.equal(z.drag, null);
  z.start({ ...down, ctrlKey: true });
  z.move({ pointerId: 1, clientX: 240, clientY: 120 });
  assert.equal(z.x, 40);
  assert.equal(z.y, 20);
  z.finish();
  assert.equal(captured, null);
  assert.equal(z.suppressClick, true);
  z.start(down);
  assert.equal(z.suppressClick, false, 'a later click must not be swallowed after cancellation');
});

test('high-rate pan coalesces into a single paint; reset cancels pending work', () => {
  const z = setup();
  const pending = new Map();
  let sequence = 0;
  z.requestFrame = (fn) => {
    const id = ++sequence;
    pending.set(id, fn);
    return id;
  };
  z.cancelFrame = (id) => pending.delete(id);
  z.zoom(2);
  for (let i = 0; i < 100; i++) z.pan(1, 0);
  assert.equal(pending.size, 1);
  assert.equal(z.video.style.transform, undefined);
  const [id, paint] = [...pending][0];
  pending.delete(id);
  paint(20);
  assert.equal(z.video.style.transform, 'translate(100px, 0px) scale(2)');
  z.pan(10, 0);
  assert.equal(pending.size, 1);
  z.reset();
  assert.equal(pending.size, 0);
  assert.equal(z.video.style.transform, '');
});

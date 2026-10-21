import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captionColors,
  captionDimensions,
  defaultCaptionSettings,
} from '../ui/features/player/caption-style.js';
import { Captions } from '../ui/features/player/captions.js';

test('fresh subtitles default to white text and black background at 100%', () => {
  assert.deepEqual(captionColors(defaultCaptionSettings), {
    color: 'rgba(255,255,255,1)',
    background: 'rgba(0,0,0,1)',
  });
});
test('text and background support arbitrary RGB colors with separate alpha, including zero', () => {
  const settings = {
    ...defaultCaptionSettings,
    color: '#12abef',
    background: '#743ac9',
    opacity: 0.62,
    background_opacity: 0.35,
  };
  assert.deepEqual(captionColors(settings), {
    color: 'rgba(18,171,239,0.62)',
    background: 'rgba(116,58,201,0.35)',
  });
  assert.equal(captionColors({ ...settings, opacity: 0 }).background, 'rgba(116,58,201,0.35)');
  assert.equal(
    captionColors({ ...settings, background_opacity: 0 }).color,
    'rgba(18,171,239,0.62)',
  );
});
test('preview updates immediately; SQLite writes keep the latest color and alpha order', async () => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
  };
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        style: {},
        value: '',
        textContent: '',
        clientWidth: 640,
        clientHeight: 360,
        offsetWidth: 200,
        offsetHeight: id === 'player-controls' ? 64 : 40,
        querySelector: () => ({ offsetTop: 25 }),
      });
    return nodes.get(id);
  };
  const writes = [];
  let stored = { ...defaultCaptionSettings },
    release;
  globalThis.document = { getElementById: node };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.window = {
    __TAURI__: {
      core: {
        invoke: async (_command, request) => {
          if (request.command === 'load_caption_settings') return { ...stored };
          writes.push(request.args.settings);
          if (writes.length === 1)
            await new Promise((resolve) => {
              release = resolve;
            });
          stored = { ...request.args.settings };
        },
      },
    },
  };
  try {
    const captions = new Captions(assert.fail);
    await captions.load();
    captions.controlsVisible = true;
    captions.layout();
    assert.equal(
      node('caption-overlay').style.bottom,
      '49px',
      '10px above seek row, excluding fade padding',
    );
    captions.controlsVisible = false;
    captions.layout();
    assert.equal(node('caption-overlay').style.bottom, '10px');
    const color = node('caption-color');
    color.value = '#12abef';
    color.oninput({ target: color });
    assert.equal(node('caption-overlay').style.color, 'rgba(18,171,239,1)');
    assert.equal(writes.length, 0, 'dragging previews without flooding SQLite');
    color.onchange({ target: color });
    await Promise.resolve();
    await Promise.resolve();
    const alpha = node('caption-opacity');
    alpha.value = '62';
    alpha.oninput({ target: alpha });
    alpha.onchange({ target: alpha });
    const background = node('caption-background');
    background.value = '#743ac9';
    background.onchange({ target: background });
    const backgroundAlpha = node('caption-background-opacity');
    backgroundAlpha.value = '35';
    backgroundAlpha.oninput({ target: backgroundAlpha });
    backgroundAlpha.onchange({ target: backgroundAlpha });
    assert.equal(node('caption-overlay').style.background, 'rgba(116,58,201,0.35)');
    assert.equal(node('caption-opacity-value').textContent, '62%');
    assert.equal(node('caption-background-opacity-value').textContent, '35%');
    for (const [id, value] of [
      ['caption-size', '36'],
      ['caption-background-width', '420'],
      ['caption-background-height', '96'],
    ]) {
      const input = node(id);
      input.value = value;
      input.onchange({ target: input });
    }
    assert.equal(node('caption-overlay').style.fontSize, '36px');
    assert.equal(node('caption-overlay').style.width, '420px');
    assert.equal(node('caption-overlay').style.height, '96px');
    const writeCount = writes.length;
    for (const [width, height] of [
      [1280, 720], // Theater.
      [1440, 900], // Fullscreen with letterboxing.
      [1920, 600], // Wide frame.
      [320, 400], // Narrow window.
      [640, 360], // Return to inline.
    ]) {
      Object.assign(node('player'), { clientWidth: width, clientHeight: height });
      captions.layout();
      assert.equal(node('caption-overlay').style.fontSize, '36px');
      assert.equal(node('caption-size').value, 36);
      assert.equal(captions.settings.size, 36);
      assert.equal(node('caption-overlay').style.width, '420px');
      assert.equal(node('caption-overlay').style.height, '96px');
    }
    assert.equal(writes.length, writeCount, 'resizing never persists a derived font size');
    const width = node('caption-background-width');
    width.value = '-1';
    width.validity = { valid: false };
    width.onchange({ target: width });
    assert.equal(captions.settings.background_width, 420);
    release();
    await captions.pendingSave;
    assert.equal(writes.length, 7);
    const next = new Captions(assert.fail);
    await next.load();
    assert.equal(next.settings.size, 36);
    assert.equal(next.settings.background_width, 420);
    assert.equal(next.settings.background_height, 96);
    assert.equal(next.settings.color, '#12abef');
    assert.equal(next.settings.background, '#743ac9');
    assert.equal(next.settings.opacity, 0.62);
    assert.equal(next.settings.background_opacity, 0.35);
    assert.equal(node('caption-overlay').style.color, 'rgba(18,171,239,0.62)');
    assert.equal(node('caption-overlay').style.opacity, undefined, 'do not fade the whole box');
    const size = node('caption-size');
    size.value = '42';
    size.oninput({ target: size });
    await next.flush();
    assert.equal(
      stored.size,
      42,
      'closing must save the current preview even without a change/blur event',
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('subtitle background supports independent fixed dimensions and automatic sizing', () => {
  assert.deepEqual(captionDimensions(defaultCaptionSettings), {
    width: 'max-content',
    height: 'auto',
  });
  assert.deepEqual(captionDimensions({ background_width: 420, background_height: 96 }), {
    width: '420px',
    height: '96px',
  });
  assert.deepEqual(captionDimensions({ background_width: 0, background_height: 80 }), {
    width: 'max-content',
    height: '80px',
  });
});

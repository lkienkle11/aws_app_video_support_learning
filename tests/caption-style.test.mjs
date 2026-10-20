import test from 'node:test';
import assert from 'node:assert/strict';
import { captionColors, defaultCaptionSettings } from '../ui/features/player/caption-style.js';
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
    release();
    await captions.pendingSave;
    assert.equal(writes.length, 4);
    const next = new Captions(assert.fail);
    await next.load();
    assert.equal(next.settings.color, '#12abef');
    assert.equal(next.settings.background, '#743ac9');
    assert.equal(next.settings.opacity, 0.62);
    assert.equal(next.settings.background_opacity, 0.35);
    assert.equal(node('caption-overlay').style.color, 'rgba(18,171,239,0.62)');
    assert.equal(node('caption-overlay').style.opacity, undefined, 'do not fade the whole box');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Captions } from '../ui/features/player/captions.js';
import { Player } from '../ui/features/player/player.js';
import { AudioOutput } from '../ui/features/player/audio-output.js';

test('duplicate cues do not repeatedly lay out captions', () => {
  const captions = Object.create(Captions.prototype);
  let writes = 0,
    layouts = 0,
    text = '';
  captions.box = {
    hidden: true,
    get textContent() {
      return text;
    },
    set textContent(value) {
      writes++;
      text = value;
    },
  };
  captions.layout = () => layouts++;
  const track = { activeCues: [{ text: '<b>Hello</b>' }] };
  for (let i = 0; i < 100; i++) captions.render(track);
  assert.equal(writes, 1);
  assert.equal(layouts, 1);
  captions.render({ activeCues: [{ text: 'Next line' }] });
  assert.equal(layouts, 2);
  captions.render(null);
  captions.render(null);
  assert.equal(captions.box.hidden, true);
  assert.equal(writes, 3);
  assert.equal(layouts, 2, 'hidden captions need no geometry measurement');
});

test('hidden controls and transcript skip DOM work; revealing controls refreshes the latest time', () => {
  const oldDocument = globalThis.document;
  const nodes = {
    time: { textContent: '' },
    seek: { value: 0 },
    'transcript-tab': { hidden: true },
  };
  let reads = 0;
  globalThis.document = {
    hidden: false,
    getElementById(id) {
      reads++;
      return nodes[id];
    },
  };
  try {
    const player = Object.create(Player.prototype);
    player.video = { currentTime: 12, duration: 120 };
    player.captions = { controlsVisible: false };
    for (let i = 0; i < 100; i++) player.update(false);
    assert.equal(reads, 0);
    player.transcript(); // No textTracks access while the tab is hidden.
    assert.equal(reads, 1);
    player.update();
    assert.equal(nodes.time.textContent, '0:12 / 2:00');
    assert.equal(nodes.seek.value, 100);
    globalThis.document.hidden = true;
    player.captions.controlsVisible = true;
    reads = 0;
    player.update(false);
    assert.equal(reads, 0);
  } finally {
    globalThis.document = oldDocument;
  }
});

test('leaving waits for progress/settings before releasing video buffers, subtitle blobs and audio', async () => {
  const oldDocument = globalThis.document;
  const oldRevoke = URL.revokeObjectURL;
  const events = [];
  const preview = { style: { backgroundImage: 'url(old)' } };
  globalThis.document = {
    getElementById(id) {
      return id === 'preview-frame'
        ? preview
        : {
            replaceChildren() {
              events.push('transcript cleared');
            },
          };
    },
  };
  URL.revokeObjectURL = (url) => events.push(url);
  try {
    const player = Object.create(Player.prototype);
    Object.assign(player, {
      generation: 1,
      source: 'asset://video',
      urls: ['blob:old'],
      sprite: 'sprite',
      video: {
        pause() {
          events.push('pause');
        },
        removeAttribute(name) {
          assert.equal(name, 'src');
          events.push('release source');
        },
        querySelectorAll() {
          return [
            {
              remove() {
                events.push('remove track');
              },
            },
          ];
        },
        load() {
          events.push('release decoder');
        },
      },
      endScreen: { hide() {} },
      save: async () => {
        assert.equal(player.source, 'asset://video');
        events.push('save');
      },
      flushPreferences: async () => events.push('settings'),
      captions: {
        render(track) {
          assert.equal(track, null);
          events.push('captions cleared');
        },
      },
      audio: { suspend: async () => events.push('audio suspended') },
    });
    await player.leave();
    assert.deepEqual(events, [
      'pause',
      'save',
      'settings',
      'release source',
      'remove track',
      'release decoder',
      'blob:old',
      'captions cleared',
      'transcript cleared',
      'audio suspended',
    ]);
    assert.equal(player.source, null);
    assert.deepEqual(player.urls, []);
    assert.equal(preview.style.backgroundImage, '');
    assert.equal(player.sprite, null);
  } finally {
    globalThis.document = oldDocument;
    URL.revokeObjectURL = oldRevoke;
  }
});

test('leaving suspends existing audio processing without creating another context', async () => {
  const audio = new AudioOutput({ volume: 1 }, assert.fail);
  await audio.suspend();
  audio.context = {
    state: 'running',
    async suspend() {
      this.state = 'suspended';
    },
    async resume() {
      this.state = 'running';
    },
  };
  await audio.suspend();
  assert.equal(audio.context.state, 'suspended');
  await audio.activate();
  assert.equal(audio.context.state, 'running');
});

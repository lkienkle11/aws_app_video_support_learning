import test from 'node:test';
import assert from 'node:assert/strict';
import { PreferenceStore, playbackDefaults, workspaceDefaults } from '../ui/shared/preferences.js';
import { installCloseGuard } from '../ui/shared/window-lifecycle.js';
import { AudioOutput } from '../ui/features/player/audio-output.js';
const clock = { setTimeout: () => 1, clearTimeout: () => {} };

test('coalesced writes serialize full settings; reopening restores every field', async () => {
  let stored = { autoplay: false },
    release;
  const writes = [];
  const request = async (command, args) => {
    if (command.startsWith('load_')) return { ...stored };
    writes.push(args.settings);
    if (writes.length === 1) await new Promise((resolve) => (release = resolve));
    stored = { ...args.settings };
  };
  const prefs = new PreferenceStore('playback', playbackDefaults, { request, clock });
  await prefs.load();
  assert.equal(prefs.value.autoplay, false);
  assert.equal(prefs.value.audio_boost, 1);
  prefs.update({ volume: 0.4, audio_boost: 2, subtitle_language: 'vi' });
  const saving = prefs.flush();
  prefs.update({ speed: 1.5, repeat: true, muted: true, last_volume: 0.4 });
  prefs.update({ autoplay: true });
  release();
  await saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].audio_boost, 2);
  const reopened = new PreferenceStore('playback', playbackDefaults, { request, clock });
  assert.deepEqual(await reopened.load(), {
    autoplay: true,
    volume: 0.4,
    muted: true,
    last_volume: 0.4,
    audio_boost: 2,
    speed: 1.5,
    repeat: true,
    subtitle_language: 'vi',
    zoom_touchpad: true,
    zoom_mouse: true,
  });
});
test('lesson writes finish with original ID before loading another lesson; failed writes can retry', async () => {
  const calls = [];
  let fail = true;
  const request = async (command, args) => {
    calls.push([command, { ...args }]);
    if (command.startsWith('load_')) return { caption_offset: 0 };
    if (fail) throw new Error('disk full');
  };
  const prefs = new PreferenceStore('lesson', { caption_offset: 0 }, { request, clock });
  await prefs.load({ id: '001.mp4' });
  prefs.update({ caption_offset: 2.5 });
  await assert.rejects(prefs.load({ id: '002.mp4' }), /disk full/);
  assert.equal(calls.at(-1)[1].id, '001.mp4');
  fail = false;
  await prefs.load({ id: '002.mp4' });
  assert.equal(calls.at(-2)[1].id, '001.mp4');
  assert.equal(calls.at(-2)[1].settings.caption_offset, 2.5);
  assert.equal(calls.at(-1)[1].id, '002.mp4');
  prefs.update({ caption_offset: -1 });
  await prefs.flush();
  assert.equal(calls.at(-1)[1].id, '002.mp4');
});
test('workspace values survive reopening without a browser storage dependency', async () => {
  let stored = {};
  const request = async (command, args) =>
    command.startsWith('load_') ? stored : (stored = { ...args.settings });
  const prefs = new PreferenceStore('workspace', workspaceDefaults, { request, clock });
  await prefs.load();
  const chosen = {
    locale: 'en',
    display_language: 'en',
    search_language: 'vi',
    search_field: 'description',
    query: 'bao mat',
    chapter: 'IAM',
    mode: 'progress',
    theater: true,
    active_tab: 'notes',
    import_language: 'ja',
    transcript_query: 'policy',
  };
  prefs.update(chosen);
  await prefs.flush();
  const next = new PreferenceStore('workspace', workspaceDefaults, { request, clock });
  assert.deepEqual(await next.load(), chosen);
});
test('close is prevented immediately, waits for writes, deduplicates Quit and keeps window on failure', async () => {
  const events = [];
  let closeHandler, quitHandler, release;
  const appWindow = {
    onCloseRequested: async (fn) => {
      closeHandler = fn;
    },
    listen: async (_name, fn) => {
      quitHandler = fn;
    },
    destroy: async () => events.push('destroy'),
  };
  await installCloseGuard(
    appWindow,
    () => new Promise((resolve) => (release = resolve)),
    assert.fail,
  );
  const pending = closeHandler({ preventDefault: () => events.push('prevent') });
  assert.deepEqual(events, ['prevent']);
  await quitHandler();
  assert.deepEqual(events, ['prevent']);
  release();
  await pending;
  assert.deepEqual(events, ['prevent', 'destroy']);
  let fail = true;
  const errors = [];
  await installCloseGuard(
    appWindow,
    async () => {
      if (fail) throw new Error('disk full');
    },
    (error) => errors.push(error.message),
  );
  await closeHandler({ preventDefault: () => events.push('prevent') });
  assert.equal(errors[0], 'disk full');
  assert.equal(events.at(-1), 'prevent');
  fail = false;
  await quitHandler();
  assert.equal(events.at(-1), 'destroy');
});
test('stored boost is restored without creating AudioContext until playback activation', async () => {
  const video = { volume: 1, muted: false };
  let contexts = 0;
  const audio = new AudioOutput(video, () => {
    contexts++;
    throw new Error('unsupported');
  });
  audio.restore({
    ...playbackDefaults,
    volume: 0.4,
    muted: true,
    last_volume: 0.6,
    audio_boost: 2,
  });
  assert.equal(contexts, 0);
  assert.equal(audio.volume, 0.4);
  assert.equal(audio.muted, true);
  assert.equal(audio.requestedBoost, 2);
  assert.equal(audio.lastAudibleVolume, 0.6);
  await assert.rejects(audio.activate(), /unsupported/);
  assert.equal(audio.requestedBoost, 2, 'failure must not erase the saved preference');
  assert.equal(video.volume, 0.4);
  assert.equal(video.muted, true);
});

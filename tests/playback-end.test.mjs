import test from 'node:test';
import assert from 'node:assert/strict';
import { NextLessonCountdown, resumePosition } from '../ui/features/player/playback-policy.js';
import { Player } from '../ui/features/player/player.js';

function clock() {
  let now = 0,
    next = 0;
  const timers = new Map();
  return {
    now: () => now,
    schedule: (fn, ms) => {
      timers.set(++next, { fn, at: now + ms });
      return next;
    },
    unschedule: (id) => timers.delete(id),
    advance(ms) {
      const end = now + ms;
      while (true) {
        const item = [...timers]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!item) break;
        now = item[1].at;
        timers.delete(item[0]);
        item[1].fn();
      }
      now = end;
    },
    pending: () => [...timers.values()].map((t) => t.fn),
  };
}
function setup() {
  const timer = clock(),
    changes = [];
  let navigations = 0;
  const flow = new NextLessonCountdown({
    ...timer,
    onChange: (value) => changes.push(value),
    onNext: () => navigations++,
  });
  return { timer, flow, changes, navigations: () => navigations };
}
test('unfinished resumes; completed legacy end resets; replay can resume halfway', () => {
  assert.equal(resumePosition({ position: 32, completed: false }, 100), 32);
  assert.equal(resumePosition({ position: 100, completed: true }, 100), 0);
  assert.equal(resumePosition({ position: 0, completed: true }, 100), 0);
  assert.equal(resumePosition({ position: 12, completed: true }, 100), 12);
});
test('automatic next waits three full seconds and navigates once', () => {
  const { flow, timer, changes, navigations } = setup();
  flow.show({ autoplay: true, nextTitle: 'Second' });
  assert.equal(changes.at(-1).seconds, 3);
  timer.advance(1000);
  assert.equal(changes.at(-1).seconds, 2);
  timer.advance(1999);
  assert.equal(navigations(), 0);
  timer.advance(1);
  assert.equal(navigations(), 1);
  timer.advance(5000);
  assert.equal(navigations(), 1);
});
test('Next now is immediate; Cancel exposes finished state and rejects stale callbacks', () => {
  const { flow, timer, navigations } = setup();
  flow.show({ autoplay: true, nextTitle: 'Second' });
  const stale = timer.pending();
  flow.cancel();
  assert.equal(flow.state, 'finished');
  timer.advance(4000);
  stale.forEach((fn) => fn());
  assert.equal(navigations(), 0);
  flow.next();
  flow.next();
  assert.equal(navigations(), 1);
});
test('disabled autoplay, last lesson and leaving never schedule navigation', () => {
  const { flow, timer, navigations } = setup();
  flow.show({ autoplay: false, nextTitle: 'Second' });
  timer.advance(4000);
  assert.equal(flow.state, 'finished');
  assert.equal(navigations(), 0);
  flow.show({ autoplay: true, nextTitle: null });
  timer.advance(4000);
  flow.next();
  assert.equal(navigations(), 0);
  flow.show({ autoplay: true, nextTitle: 'Second' });
  flow.hide();
  timer.advance(4000);
  assert.equal(flow.state, 'hidden');
  assert.equal(navigations(), 0);
});
test('native timer functions keep the global Window receiver', () => {
  const original = globalThis.clearTimeout;
  try {
    globalThis.clearTimeout = function () {
      assert.equal(this, globalThis);
    };
    const flow = new NextLessonCountdown({ onChange: () => {}, onNext: () => {} });
    flow.hide();
  } finally {
    globalThis.clearTimeout = original;
  }
});
test('serialized snapshots preserve timestamp, notes and completion through late autosaves', async () => {
  const previousWindow = globalThis.window,
    writes = [];
  let release;
  globalThis.window = {
    __TAURI__: {
      core: {
        invoke: async (_command, request) => {
          writes.push(request.args);
          if (writes.length === 1)
            await new Promise((resolve) => {
              release = resolve;
            });
        },
      },
    },
  };
  try {
    const player = Object.create(Player.prototype);
    Object.assign(player, {
      source: 'asset://one',
      video: { currentSrc: 'asset://one', currentTime: 32.25, duration: 100, ended: false },
      lesson: { id: 'one.mp4', position: 0, duration: 100, completed: false, notes: 'My notes' },
      onProgress: () => {},
      notify: assert.fail,
    });
    const first = player.save();
    await Promise.resolve();
    await Promise.resolve();
    player.video.currentTime = 100;
    player.video.ended = true;
    const ended = player.save(true),
      repeated = player.save();
    assert.equal(writes.length, 1);
    release();
    await Promise.all([first, ended, repeated]);
    assert.deepEqual(
      writes.map((w) => [w.position, w.completed]),
      [
        [32.25, false],
        [0, true],
        [0, true],
      ],
    );
    assert.ok(writes.every((w) => w.notes === 'My notes'));
    player.video.ended = false;
    player.video.currentTime = 12;
    await player.saveNotes(player.lesson, 'Updated');
    assert.equal(writes.at(-1).position, 12);
    assert.equal(writes.at(-1).completed, true);
    assert.equal(writes.at(-1).notes, 'Updated');
    player.endScreen = { hide: () => {} };
    player.video.pause = () => {};
    player.generation = 0;
    player.video.currentTime = 17;
    await player.leave();
    assert.equal(writes.at(-1).position, 17);
    assert.equal(player.source, null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

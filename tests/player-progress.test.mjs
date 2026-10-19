import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../ui/features/player/player.js';

test('queued pause from an old video cannot overwrite the next lesson progress', async () => {
  const writes = [];
  const previousWindow = globalThis.window;
  globalThis.window = {
    __TAURI__: { core: { invoke: async (_command, request) => writes.push(request) } },
  };
  try {
    const player = Object.create(Player.prototype);
    player.video = { currentSrc: 'asset://old.mp4', duration: 138, currentTime: 35 };
    player.lesson = { id: 'next.mp4', position: 7, duration: 240, completed: false, notes: 'Keep' };
    player.onProgress = () => {};
    player.notify = assert.fail;
    player.source = null; // Between pause() and resolving the next source.
    await player.save();
    player.source = 'asset://next.mp4';
    await player.save(); // Old media still reports its duration/currentSrc.
    assert.equal(writes.length, 0);
    assert.equal(player.lesson.position, 7);
    assert.equal(player.lesson.duration, 240);

    player.video = { currentSrc: player.source, duration: 240, currentTime: 12 };
    await player.save();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].args.id, 'next.mp4');
    assert.equal(writes[0].args.position, 12);
    assert.equal(writes[0].args.notes, 'Keep');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

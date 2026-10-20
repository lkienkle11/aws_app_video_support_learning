import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioOutput } from '../ui/features/player/audio-output.js';

test('native volume defaults to unity; zero then unmute restores the last audible volume', async () => {
  const video = { volume: 1, muted: false };
  const audio = new AudioOutput(video, assert.fail);
  await audio.setBoost(1);
  assert.equal(video.volume, 1);
  audio.setVolume(0.65);
  audio.setVolume(0);
  assert.equal(video.muted, true);
  audio.toggleMute();
  assert.equal(video.volume, 0.65);
  assert.equal(video.muted, false);
  audio.toggleMute();
  assert.equal(video.muted, true);
  audio.setVolume(0.7);
  assert.equal(video.muted, false, 'raising volume also unmutes keyboard/slider changes');
  audio.setVolume(5);
  assert.equal(video.volume, 1);
  audio.setVolume(-1);
  assert.equal(video.volume, 0);
});
test('boost creates one streaming graph, limits peaks and preserves native mute/volume', async () => {
  const connections = [],
    gains = [];
  let sources = 0,
    contexts = 0;
  const gain = {
    gain: { setTargetAtTime: (value) => gains.push(value) },
    connect: (node) => connections.push(node),
  };
  const levels = [];
  const output = {
    gain: { value: 1, setTargetAtTime: (value) => levels.push(value) },
    connect: (node) => connections.push(node),
  };
  let createdGains = 0;
  const limiter = { connect: (node) => connections.push(node) };
  for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release'])
    limiter[key] = { value: 0 };
  const video = { volume: 0.65, muted: false };
  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    async resume() {
      this.state = 'running';
    },
    createGain: () => (createdGains++ === 0 ? gain : output),
    createDynamicsCompressor: () => limiter,
    createMediaElementSource: (media) => {
      assert.equal(media, video);
      sources++;
      return { connect: (node) => connections.push(node) };
    },
  };
  const audio = new AudioOutput(video, () => {
    contexts++;
    return context;
  });
  await audio.setBoost(1.5);
  await audio.setBoost(2);
  await audio.setBoost(1);
  assert.deepEqual(gains, [1.5, 2, 1]);
  assert.equal(sources, 1, 'reuse for every lesson on the same video element');
  assert.equal(contexts, 1);
  assert.deepEqual(connections, [limiter, output, context.destination, gain]);
  assert.equal(limiter.threshold.value, -1);
  assert.equal(limiter.ratio.value, 20);
  audio.toggleMute();
  assert.equal(video.muted, true);
  assert.equal(video.volume, 1);
  assert.equal(audio.volume, 0.65);
  assert.equal(levels.at(-1), 0);
  audio.toggleMute();
  assert.equal(levels.at(-1), 0.65);
  audio.setVolume(0.3);
  assert.equal(levels.at(-1), 0.3);
  assert.equal(video.volume, 1, 'native media volume stays unity to prevent double attenuation');
  video.volume = 0.8;
  audio.syncNativeVolume();
  assert.equal(audio.volume, 0.8);
  assert.equal(video.volume, 1);
  context.state = 'suspended';
  await audio.resume();
  assert.equal(context.state, 'running');
  await assert.rejects(audio.setBoost(4), /Invalid/);
});
test('blocked activation leaves native playback untouched', async () => {
  let sources = 0;
  const video = { volume: 1, muted: false };
  const audio = new AudioOutput(video, () => ({
    state: 'suspended',
    resume: async () => {},
    createMediaElementSource: () => sources++,
  }));
  await assert.rejects(audio.setBoost(2), /user gesture/);
  assert.equal(sources, 0);
  assert.equal(audio.boost, 1);
  assert.equal(video.volume, 1);
  assert.equal(video.muted, false);
});

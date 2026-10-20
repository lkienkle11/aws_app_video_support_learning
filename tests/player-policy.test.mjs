import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlsVisibility } from '../ui/features/player/controls-visibility.js';
import { captionGeometry } from '../ui/features/player/caption-layout.js';

function fixture(onChange = () => {}) {
  const frame = new EventTarget();
  const classes = new Set();
  frame.classList = { add: (v) => classes.add(v), remove: (v) => classes.delete(v) };
  let now = 0,
    index = 0;
  const jobs = new Map();
  const clock = {
    setTimeout: (fn, ms) => {
      jobs.set(++index, { fn, at: now + ms });
      return index;
    },
    clearTimeout: (id) => jobs.delete(id),
  };
  const tick = (ms) => {
    now += ms;
    for (const [id, job] of [...jobs])
      if (job.at <= now) {
        jobs.delete(id);
        job.fn();
      }
  };
  const panel = { hidden: false };
  const policy = new ControlsVisibility(frame, panel, onChange, clock);
  return { frame, panel, policy, tick };
}
test('hover reveals controls, movement restarts the full 3 seconds, then hides settings', () => {
  const { frame, panel, policy, tick } = fixture();
  assert.equal(policy.visible, false);
  frame.dispatchEvent(new Event('pointerenter'));
  tick(2999);
  assert.equal(policy.visible, true);
  frame.dispatchEvent(new Event('pointermove'));
  panel.hidden = false;
  tick(2999);
  assert.equal(policy.visible, true);
  tick(1);
  assert.equal(policy.visible, false);
  assert.equal(panel.hidden, true);
});
test('leaving immediately hides even paused controls; re-enter reveals again', () => {
  const { frame, panel, policy } = fixture();
  frame.dispatchEvent(new Event('pointerenter'));
  panel.hidden = false;
  frame.dispatchEvent(new Event('pointerleave'));
  assert.equal(policy.visible, false);
  assert.equal(panel.hidden, true);
  frame.dispatchEvent(new Event('pointerenter'));
  assert.equal(policy.visible, true);
});
test('subtitle default leaves 10px above the control bar and 10px above frame when hidden', () => {
  const args = {
    width: 320,
    height: 180,
    boxWidth: 250,
    boxHeight: 40,
    controlsHeight: 58,
    x: 0.5,
    y: 0,
  };
  assert.equal(captionGeometry({ ...args, visible: true }).bottom, 68);
  assert.equal(captionGeometry({ ...args, visible: false }).bottom, 10);
  const dragged = captionGeometry({ ...args, visible: true, x: 2, y: 1 });
  assert.equal(dragged.left, 187);
  assert.equal(dragged.bottom, 132);
});

test('native color chooser stays usable past idle timeout and leaving the video frame', () => {
  const { frame, panel, policy, tick } = fixture();
  frame.dispatchEvent(new Event('pointerenter'));
  const event = (type, target) => {
    const e = new Event(type);
    Object.defineProperty(e, 'target', { value: target });
    frame.dispatchEvent(e);
  };
  event('focusin', { type: 'color' });
  panel.hidden = false;
  frame.dispatchEvent(new Event('pointerleave'));
  tick(6000);
  assert.equal(policy.visible, true);
  assert.equal(panel.hidden, false);
  event('change', { type: 'color' });
  assert.equal(policy.visible, false);
  assert.equal(panel.hidden, true);
  event('focusin', { type: 'color' });
  event('focusout', { type: 'color' });
  assert.equal(policy.visible, false);
});

test('pointer movement renews idle timer without repeating caption layout callbacks', () => {
  const changes = [];
  const { frame, policy, tick } = fixture((visible) => changes.push(visible));
  frame.dispatchEvent(new Event('pointerenter'));
  for (let i = 0; i < 100; i++) {
    tick(10);
    frame.dispatchEvent(new Event('pointermove'));
  }
  assert.deepEqual(changes, [true]);
  tick(2999);
  assert.equal(policy.visible, true);
  tick(1);
  assert.deepEqual(changes, [true, false]);
  policy.hide();
  assert.deepEqual(changes, [true, false]);
});

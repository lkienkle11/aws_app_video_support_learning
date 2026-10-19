import test from 'node:test';
import assert from 'node:assert/strict';
import { time, localized, escapeHTML, spritePosition } from '../ui/shared/utils.js';
test('time handles unknown duration, negatives and hour boundaries', () => {
  assert.equal(time(NaN), '0:00');
  assert.equal(time(-1), '0:00');
  assert.equal(time(3661), '1:01:01');
});
test('HTML encoding protects metadata and subtitle rendering', () => {
  assert.equal(escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
test('missing translations fall back to English', () => {
  assert.equal(localized({ texts: { en: { title: 'EC2' } } }, 'ja').title, 'EC2');
});
test('scrub sprite clamps both ends and uses twelve cells', () => {
  assert.equal(spritePosition(-1), '0% 0%');
  assert.equal(spritePosition(1), '100% 100%');
  assert.equal(spritePosition(0.5), '66.66666666666667% 50%');
});

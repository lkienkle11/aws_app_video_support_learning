import test from 'node:test';
import assert from 'node:assert/strict';
import { revealActiveLesson } from '../ui/features/library/playlist-scroll.js';

function fixture(
  index,
  { height = 750, header = 90, rowHeight = 70, count = 277, scroll = 0 } = {},
) {
  const panel = {
    style: { setProperty: () => {} },
    clientTop: 1,
    clientHeight: height,
    scrollHeight: header + count * rowHeight,
    scrollTop: scroll,
    querySelector: () => ({ offsetHeight: header }),
    getBoundingClientRect: () => ({ top: 180 }),
  };
  const row = {
    getBoundingClientRect: () => ({
      top: 181 + header + index * rowHeight - panel.scrollTop,
      height: rowHeight,
    }),
  };
  const list = {
    closest: (selector) => {
      assert.equal(selector, '.playlist');
      return panel;
    },
    querySelector: () => row,
  };
  return { panel, row, list, header };
}
for (const [name, index, options] of [
  ['far lesson with a sticky heading', 116, {}],
  ['first lesson after previously scrolling far down', 0, { scroll: 17000 }],
  ['last lesson', 276, {}],
  ['tablet viewport and wrapped heading', 180, { height: 360, header: 115 }],
  ['mobile viewport', 80, { height: 360, header: 90, rowHeight: 110 }],
])
  test(`selected ${name} is visible inside the real scroll container`, () => {
    const { panel, row, list, header } = fixture(index, options);
    revealActiveLesson(list);
    const bounds = row.getBoundingClientRect();
    assert.ok(bounds.top >= 181 + header - 0.001);
    assert.ok(bounds.top + bounds.height <= 181 + panel.clientHeight + 0.001);
    assert.equal(list.scrollTop, undefined, 'the inner list must not be scrolled');
    assert.ok(panel.scrollTop >= 0 && panel.scrollTop <= panel.scrollHeight - panel.clientHeight);
  });
test('hidden theater playlist and absent selection are harmless', () => {
  const { panel, list } = fixture(116);
  panel.clientHeight = 0;
  revealActiveLesson(list);
  assert.equal(panel.scrollTop, 0);
  list.querySelector = () => null;
  panel.clientHeight = 750;
  revealActiveLesson(list);
  assert.equal(panel.scrollTop, 0);
});

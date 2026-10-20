import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesLessonMode, syncLibraryNavigation } from '../ui/features/library/navigation.js';

test('sidebar follows all/progress/completed including a restored mode and live completion changes', () => {
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) {
        const attrs = new Map();
        nodes.set(id, {
          active: false,
          textContent: '',
          attrs,
          classList: {
            toggle: (_name, active) => {
              nodes.get(id).active = active;
            },
          },
          setAttribute: (key, value) => attrs.set(key, value),
          removeAttribute: (key) => attrs.delete(key),
        });
      }
      return nodes.get(id);
    },
  };
  const lessons = [
    { position: 0, completed: false },
    { position: 12, completed: false },
    { position: 0, completed: true },
    { position: 15, completed: true }, // Replay is completed, not in progress.
  ];
  const buttons = ['home', 'continue-nav', 'completed-nav'];
  // First render may restore a saved filter instead of starting with All.
  for (const [mode, selected] of [
    ['completed', 'completed-nav'],
    ['progress', 'continue-nav'],
    ['all', 'home'],
  ]) {
    syncLibraryNavigation(mode, lessons, document);
    assert.deepEqual(
      buttons.filter((id) => nodes.get(id).active),
      [selected],
    );
    assert.deepEqual(
      buttons.filter((id) => nodes.get(id).attrs.has('aria-current')),
      [selected],
    );
    assert.equal(nodes.get('nav-count').textContent, '4');
    assert.equal(
      nodes.get('nav-progress-count').textContent,
      String(lessons.filter((l) => matchesLessonMode(l, 'progress')).length),
    );
    assert.equal(
      nodes.get('nav-completed-count').textContent,
      String(lessons.filter((l) => matchesLessonMode(l, 'completed')).length),
    );
  }
  lessons[1].completed = true;
  lessons[1].position = 0;
  syncLibraryNavigation('progress', lessons, document);
  assert.equal(nodes.get('nav-progress-count').textContent, '0');
  assert.equal(nodes.get('nav-completed-count').textContent, '3');
  assert.equal(nodes.get('continue-nav').active, true);
  syncLibraryNavigation('all', [], document);
  for (const id of ['nav-count', 'nav-progress-count', 'nav-completed-count'])
    assert.equal(nodes.get(id).textContent, '0');
});

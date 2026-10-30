/** Keep sidebar selection, counters and lesson filtering on the same rules. */
export function matchesLessonMode(lesson, mode) {
  if (mode === 'completed') return lesson.completed;
  if (mode === 'progress') return lesson.position > 0 && !lesson.completed;
  return true;
}

export function syncLibraryNavigation(mode, lessons, document = globalThis.document) {
  const counts = { all: lessons.length, progress: 0, completed: 0 };
  for (const lesson of lessons) {
    if (lesson.completed) counts.completed++;
    else if (lesson.position > 0) counts.progress++;
  }
  for (const [key, buttonId, counterId] of [
    ['all', 'home', 'nav-count'],
    ['progress', 'continue-nav', 'nav-progress-count'],
    ['completed', 'completed-nav', 'nav-completed-count'],
  ]) {
    const button = document.getElementById(buttonId);
    const selected = key === mode;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
    const counter = document.getElementById(counterId);
    const label = String(counts[key]);
    if (counter.textContent !== label) counter.textContent = label;
  }
}

export function syncChapterNavigation(chapter, document = globalThis.document) {
  for (const button of document.querySelectorAll('[data-chapter]')) {
    const active = Boolean(chapter) && button.dataset.chapter === chapter;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

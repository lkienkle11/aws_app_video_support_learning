/** Reveal the selection inside its own scroll viewport, below the sticky heading. */
export function revealActiveLesson(list) {
  const panel = list.closest('.playlist');
  const active = list.querySelector('.active');
  if (!panel || !active || !panel.clientHeight) return;
  const header = panel.querySelector('.playlist-heading');
  const viewport = panel.getBoundingClientRect();
  panel.style.setProperty('--playlist-top', `${Math.max(0, viewport.top)}px`);
  const row = active.getBoundingClientRect();
  const top = viewport.top + panel.clientTop + (header?.offsetHeight || 0);
  const height = Math.max(0, panel.clientHeight - (header?.offsetHeight || 0));
  const desired = panel.scrollTop + row.top - top - Math.max(0, (height - row.height) / 2);
  panel.scrollTop = Math.max(0, Math.min(panel.scrollHeight - panel.clientHeight, desired));
}

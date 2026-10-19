export function time(seconds = 0) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
export function localized(lesson, language) {
  return (
    lesson.texts[language] ||
    lesson.texts.en ||
    Object.values(lesson.texts)[0] || { title: lesson.id, description: '' }
  );
}
export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
export function spritePosition(fraction) {
  const i = Math.min(11, Math.max(0, Math.floor(fraction * 12)));
  return `${((i % 4) * 100) / 3}% ${Math.floor(i / 4) * 50}%`;
}
export const $ = (id) => document.getElementById(id);

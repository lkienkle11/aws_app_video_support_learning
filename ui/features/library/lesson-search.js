import { t, onLocaleChange } from '../../shared/i18n.js';
import { $, escapeHTML as h, localized } from '../../shared/utils.js';

const fold = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase();
export function searchLessonTitles(lessons, query) {
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  return lessons.filter((lesson) =>
    Object.values(lesson.texts).some(({ title }) => {
      const text = fold(title);
      return terms.every((term) => text.includes(term));
    }),
  );
}

export class LessonSearch {
  constructor({ getLessons, getLanguage, onSelect }) {
    const dialog = $('lesson-search-dialog');
    const input = $('lesson-search-input');
    this.render = () => {
      const lessons = searchLessonTitles(getLessons(), input.value);
      $('lesson-search-results').innerHTML = lessons.length
        ? lessons
            .map(
              (lesson) =>
                `<button class="playlist-item" data-id="${h(lesson.id)}"><span>${String(lesson.number).padStart(3, '0')}</span><div>${h(localized(lesson, getLanguage()).title)}<small>${h(lesson.chapter)}</small></div></button>`,
            )
            .join('')
        : `<p role="status">${h(t('Không tìm thấy bài học.'))}</p>`;
      for (const button of $('lesson-search-results').querySelectorAll('button'))
        button.onclick = () => {
          const lesson = lessons.find((item) => item.id === button.dataset.id);
          dialog.close();
          onSelect(lesson);
        };
    };
    $('lesson-search-open').onclick = () => {
      input.value = '';
      this.render();
      dialog.showModal();
      input.focus();
    };
    $('lesson-search-close').onclick = () => dialog.close();
    input.oninput = this.render;
    onLocaleChange(() => {
      if (dialog.open) this.render();
    });
  }
}

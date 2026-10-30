import {
  t,
  localizeError,
  getLocale,
  setLocale,
  translateDOM,
  onLocaleChange,
} from '../../shared/i18n.js';
import { $, time, escapeHTML as h, localized } from '../../shared/utils.js';
import { invoke, asset, chooseDirectory, chooseSubtitle } from '../../shared/api.js';
import { PreferenceStore, workspaceDefaults } from '../../shared/preferences.js';
import { installCloseGuard } from '../../shared/window-lifecycle.js';
import { Player } from '../player/player.js';
import { LessonSearch } from './lesson-search.js';
import { syncChapterNavigation } from './navigation.js';
import { revealActiveLesson } from './playlist-scroll.js';
import { matchesLessonMode, syncLibraryNavigation } from './navigation.js';

const state = {
  all: [],
  results: [],
  selected: null,
  language: 'vi',
  root: '',
  mode: 'all',
  limit: 24,
  queryGeneration: 0,
};
let toastTimer;
function notify(message) {
  $('toast').textContent = localizeError(message);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 6500);
}
const workspace = new PreferenceStore('workspace', workspaceDefaults, {
  onError: (error) => notify(t('Không lưu được cài đặt: {error}', { error: localizeError(error) })),
});
let restoringPreferences = false;
function persistWorkspace() {
  if (restoringPreferences) return;
  workspace.update({
    locale: getLocale(),
    display_language: state.language,
    search_language: $('search-language').value,
    search_field: $('search-field').value,
    query: $('search').value,
    chapter: $('chapter-filter').value,
    mode: state.mode,
    theater: $('watch-view').classList.contains('theater-mode'),
    active_tab: document.querySelector('[data-tab].active')?.dataset.tab || 'description',
    import_language: /^[A-Za-z-]{1,20}$/.test($('import-language').value)
      ? $('import-language').value
      : workspace.value.import_language,
    transcript_query: $('transcript-search').value,
  });
}
function setTab(tab, persist = true) {
  document
    .querySelectorAll('[data-tab]')
    .forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  for (const name of ['description', 'transcript', 'notes']) $(`${name}-tab`).hidden = name !== tab;
  if (tab === 'transcript') player.transcript();
  if (persist) persistWorkspace();
}
function restoreWorkspace() {
  const prefs = workspace.value;
  restoringPreferences = true;
  state.language = prefs.display_language;
  state.mode = prefs.mode;
  for (const [id, key] of [
    ['search', 'query'],
    ['search-field', 'search_field'],
    ['search-language', 'search_language'],
    ['chapter-filter', 'chapter'],
    ['display-language', 'display_language'],
    ['import-language', 'import_language'],
    ['transcript-search', 'transcript_query'],
  ]) {
    if (
      $(id).tagName === 'SELECT' &&
      prefs[key] &&
      ![...$(id).options].some((option) => option.value === prefs[key]) &&
      id !== 'chapter-filter'
    ) {
      const option = document.createElement('option');
      option.value = option.textContent = prefs[key];
      $(id).append(option);
    }
    $(id).value = prefs[key];
  }
  $('watch-view').classList.toggle('theater-mode', prefs.theater);
  setTab(prefs.active_tab, false);
  restoringPreferences = false;
}
async function loadPreferences() {
  const prefs = await workspace.load();
  restoringPreferences = true;
  setLocale(prefs.locale || getLocale(), { persist: false });
  restoringPreferences = false;
  $('library-path').textContent = state.root;
  $('app-language').value = getLocale();
  if (!prefs.locale) workspace.update({ locale: getLocale() });
  await player.loadSettings();
}

const playlistButtons = new Map();
new LessonSearch({
  getLessons: () => state.all,
  getLanguage: () => state.language,
  onSelect: (lesson) => watch(lesson, false),
});
const player = new Player({
  notify,
  getNextTitle: () => {
    const index = state.all.findIndex((l) => l.id === state.selected?.id);
    const next = state.all[index + 1];
    return next ? localized(next, state.language).title : null;
  },
  onProgress: (lesson) => {
    const index = state.all.findIndex((l) => l.id === lesson.id);
    if (index >= 0) state.all[index] = lesson;
    const result = state.results.findIndex((l) => l.id === lesson.id);
    if (result >= 0) state.results[result] = lesson;
    if (!$('library-view').hidden) updateStats();
    else syncLibraryNavigation(state.mode, state.all);
    syncChapterNavigation($('chapter-filter').value);
    $('playlist-count').textContent = t('{count} bài · {completed} hoàn thành', {
      count: state.all.length,
      completed: state.all.filter((l) => l.completed).length,
    });
    const marker = playlistButtons.get(lesson.id)?.querySelector('span');
    const label = lesson.completed ? '✓' : String(lesson.number).padStart(3, '0');
    if (marker && marker.textContent !== label) marker.textContent = label;
    if (state.selected?.id === lesson.id)
      $('mark-complete').textContent = lesson.completed ? t('✓ Đã hoàn thành') : t('✓ Hoàn thành');
  },
  onNavigate: (delta) => {
    const index = state.all.findIndex((l) => l.id === state.selected?.id);
    const next = state.all[index + delta];
    if (next) watch(next);
    else notify(t('Bạn đã đến cuối danh sách bài học.'));
  },
});
player.onTheaterChange = () => persistWorkspace();
player.onTranscriptSearch = () => persistWorkspace();
$('import-language').onchange = () => persistWorkspace();
function updateStats() {
  const count = state.all.length;
  const completed = state.all.filter((l) => l.completed).length;
  const percent = count ? Math.round((completed / count) * 100) : 0;
  syncLibraryNavigation(state.mode, state.all);
  syncChapterNavigation($('chapter-filter').value);
  $('stat-lessons').textContent = count;
  $('stat-completed').textContent = completed;
  $('stat-progress').textContent = percent + '%';
  const duration = state.all.reduce((sum, l) => sum + l.duration, 0);
  $('stat-hours').textContent = duration
    ? t('{hours} giờ', { hours: (duration / 3600).toFixed(1) })
    : '—';
  $('progress-ring').style.background = `conic-gradient(#8daf7d ${percent}%,#edf2e6 0)`;
  $('hero-meta').textContent = t('{count} bài học · {completed} đã hoàn thành', {
    count,
    completed,
  });
  $('resume').querySelector('span').textContent = state.all.some((l) => l.position > 0)
    ? t('Tiếp tục học')
    : t('Bắt đầu học');
}
function chapters() {
  const currentChapter = $('chapter-filter').value;
  const chapters = [...new Set(state.all.map((l) => l.chapter).filter(Boolean))];
  $('chapters').innerHTML = chapters
    .map(
      (c, i) =>
        `<button class="chapter-nav" data-chapter="${h(c)}"><span>${String(i + 1).padStart(2, '0')}</span>${h(c)}</button>`,
    )
    .join('');
  $('chapter-filter').innerHTML =
    `<option value="">${t('Tất cả chương')}</option>` +
    chapters.map((c) => `<option>${h(c)}</option>`).join('');
  $('chapter-filter').value = currentChapter;
  $('chapters')
    .querySelectorAll('button')
    .forEach(
      (b) =>
        (b.onclick = () => {
          $('chapter-filter').value = b.dataset.chapter;
          state.mode = 'all';
          home();
          render();
        }),
    );
  const languages = [...new Set(state.all.flatMap((l) => Object.keys(l.texts)))];
  for (const lang of languages)
    if (!['en', 'vi'].includes(lang)) {
      for (const id of ['display-language', 'search-language']) {
        if ([...$(id).options].some((option) => option.value === lang)) continue;
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang;
        $(id).append(option);
      }
    }
}
async function refresh(restore = false) {
  state.all = await invoke('search_lessons', { query: '', language: '' });
  chapters();
  if (restore) restoreWorkspace();
  updateStats();
  await search();
}
async function search() {
  const generation = ++state.queryGeneration;
  try {
    const lessons = await invoke('search_lessons', {
      query: $('search').value,
      language: $('search-language').value,
      field: $('search-field').value,
    });
    if (generation !== state.queryGeneration) return;
    state.results = lessons;
    state.limit = 24;
    render();
  } catch (e) {
    notify(e);
  }
}
function render() {
  syncLibraryNavigation(state.mode, state.all);
  syncChapterNavigation($('chapter-filter').value);
  const chapter = $('chapter-filter').value;
  const lessons = state.results.filter(
    (l) => (!chapter || l.chapter === chapter) && matchesLessonMode(l, state.mode),
  );
  $('result-count').textContent = lessons.length;
  $('empty').hidden = lessons.length > 0;
  $('load-more').hidden = lessons.length <= state.limit;
  $('lesson-grid').innerHTML = lessons
    .slice(0, state.limit)
    .map((lesson, i) => {
      const text = localized(lesson, state.language);
      const percent = lesson.completed
        ? 100
        : lesson.duration
          ? Math.min(100, (lesson.position / lesson.duration) * 100)
          : 0;
      return `<article class="lesson-card" tabindex="0" role="button" data-id="${h(lesson.id)}" aria-label="${h(t('Xem trước {title}', { title: text.title }))}"><div class="card-art ${['', 'blue', 'sand'][i % 3]}"><span class="card-symbol">${['☁', '⌘', '▤', '⌁', '⛨'][i % 5]}</span><span class="card-badge">${t('BÀI')} ${String(lesson.number).padStart(3, '0')}</span><span class="card-play">▶</span><span class="duration">${lesson.duration ? time(lesson.duration) : 'VIDEO'}</span></div><div class="card-body"><span class="card-chapter">${h(lesson.chapter || 'AWS Cloud Practitioner')}</span><h3>${h(text.title)}</h3><p>${h(text.description)}</p><div class="card-footer"><span>▤ ${lesson.tracks.length ? lesson.tracks.map((t) => h(t.language.toUpperCase())).join(' · ') : t('Chưa có phụ đề')}</span><span>${lesson.completed ? t('✓ Đã học') : lesson.position ? t('◷ Đang học') : t('Bắt đầu khám phá ↗')}</span></div></div><div class="card-progress"><span style="width:${percent}%"></span></div></article>`;
    })
    .join('');
  $('lesson-grid')
    .querySelectorAll('.lesson-card')
    .forEach((card) => {
      const lesson = lessons.find((l) => l.id === card.dataset.id);
      const open = () => watch(lesson, false);
      card.onclick = open;
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      };
      asset(lesson.video.replace(/\.[^.]+$/, '.preview.jpg'))
        .then((url) => {
          if (!card.isConnected) return;
          const image = document.createElement('img');
          image.src = url;
          image.loading = 'lazy';
          image.alt = '';
          image.onerror = () => image.remove();
          card.querySelector('.card-symbol').replaceWith(image);
        })
        .catch(() => {});
    });
}
function playlist() {
  $('playlist-count').textContent = t('{count} bài · {completed} hoàn thành', {
    count: state.all.length,
    completed: state.all.filter((l) => l.completed).length,
  });
  $('playlist').innerHTML = state.all
    .map(
      (l) =>
        `<button class="playlist-item ${l.id === state.selected?.id ? 'active' : ''}" data-id="${h(l.id)}"><span>${l.completed ? '✓' : String(l.number).padStart(3, '0')}</span><div>${h(localized(l, state.language).title)}<small>${h(l.chapter)} ${l.duration ? '· ' + time(l.duration) : ''}</small></div></button>`,
    )
    .join('');
  playlistButtons.clear();
  $('playlist')
    .querySelectorAll('button')
    .forEach((b) => {
      playlistButtons.set(b.dataset.id, b);
      b.onclick = () => watch(state.all.find((l) => l.id === b.dataset.id));
    });
  schedulePlaylistReveal();
}
let playlistFrame;
function schedulePlaylistReveal() {
  cancelAnimationFrame(playlistFrame);
  playlistFrame = requestAnimationFrame(() => revealActiveLesson($('playlist')));
}
window.addEventListener('resize', schedulePlaylistReveal);
const playlistResize = new ResizeObserver(schedulePlaylistReveal);
playlistResize.observe($('playlist').closest('.playlist'));
playlistResize.observe(document.querySelector('.playlist-heading'));

function updateWatchText() {
  const lesson = state.selected;
  if (!lesson) return;
  const text = localized(lesson, state.language);
  const other = localized(lesson, state.language === 'vi' ? 'en' : 'vi');
  $('watch-title').textContent = text.title;
  $('watch-description').textContent = text.description;
  $('watch-subtitle').textContent = other.title;
  $('watch-chapter').textContent = t('Bài {number} · {chapter}', {
    number: lesson.number,
    chapter: lesson.chapter,
  });
  $('track-info').textContent = t('Phụ đề có sẵn: {tracks}. Có thể nhập bản dịch SRT/VTT từ máy.', {
    tracks: lesson.tracks.map((track) => track.label).join(', ') || t('Chưa có'),
  });
  $('mark-complete').textContent = lesson.completed ? t('✓ Đã hoàn thành') : t('✓ Hoàn thành');
}

async function watch(lesson, play = true) {
  if (!lesson) return;
  if (state.selected) state.selected.notes = $('notes').value;
  state.selected = lesson;
  $('library-view').hidden = true;
  $('watch-view').hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateWatchText();
  $('notes').value = lesson.notes;
  $('notes-status').textContent = '';
  state.notesDirty = false;
  playlist();
  try {
    await player.open(lesson, play);
  } catch (e) {
    notify(e);
  }
}
async function home() {
  persistWorkspace();
  await player.leave();
  $('watch-view').hidden = true;
  $('library-view').hidden = false;
  updateStats();
  render();
}
async function chooseLibrary() {
  player.endScreen.hide();
  try {
    const path = await chooseDirectory();
    if (!path) return;
    await player.leave();
    persistWorkspace();
    await workspace.flush();
    const info = await invoke('open_library', { path });
    state.root = info.root;
    $('library-path').textContent = info.root;
    state.selected = null;
    player.lesson = null;
    $('watch-view').hidden = true;
    $('library-view').hidden = false;
    await loadPreferences();
    await refresh(true);
    notify(t('Đã tải {count} bài học.', { count: info.lessons }));
  } catch (e) {
    notify(e);
  }
}
$('choose-library').onclick = $('library-location').onclick = chooseLibrary;
$('rescan').onclick = async () => {
  player.endScreen.hide();
  try {
    await player.save();
    if (!state.root) return chooseLibrary();
    await invoke('open_library', { path: state.root });
    await refresh();
    notify(t('Đã cập nhật thư viện.'));
  } catch (e) {
    notify(e);
  }
};
$('back').onclick = home;
$('home').onclick = () => {
  $('chapter-filter').value = '';
  state.mode = 'all';
  home();
};
$('continue-nav').onclick = () => {
  state.mode = 'progress';
  home();
};
$('completed-nav').onclick = () => {
  state.mode = 'completed';
  home();
};
$('all-lessons').onclick = () => {
  state.mode = 'all';
  $('chapter-filter').value = '';
  $('search').value = '';
  persistWorkspace();
  search();
};
$('resume').onclick = () =>
  watch(
    state.all.find((l) => l.position > 0 && !l.completed) ||
      state.all.find((l) => !l.completed) ||
      state.all[0],
  );
$('load-more').onclick = () => {
  state.limit += 24;
  render();
};
let searchTimer;
$('search').oninput = () => {
  persistWorkspace();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 180);
};
$('search-language').onchange = $('search-field').onchange = () => {
  persistWorkspace();
  search();
};
$('chapter-filter').onchange = () => {
  persistWorkspace();
  state.limit = 24;
  render();
};
$('display-language').onchange = () => {
  state.language = $('display-language').value;
  persistWorkspace();
  render();
  updateWatchText();
  playlist();
};
document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    home();
    $('search').focus();
  }
});
document
  .querySelectorAll('[data-tab]')
  .forEach((button) => (button.onclick = () => setTab(button.dataset.tab)));
$('mark-complete').onclick = async () => {
  if (!state.selected) return;
  state.selected.completed = !state.selected.completed;
  await persistNotes();
  $('mark-complete').textContent = state.selected.completed
    ? t('✓ Đã hoàn thành')
    : t('✓ Hoàn thành');
  playlist();
};
async function persistNotes() {
  const lesson = state.selected;
  if (!lesson) return;
  lesson.notes = $('notes').value;
  try {
    await player.saveNotes(lesson, lesson.notes);
    state.notesDirty = false;
    $('notes-status').textContent = t('Đã lưu trên máy.');
    updateStats();
  } catch (e) {
    notify(t('Không lưu được: {error}', { error: localizeError(e) }));
  }
}
$('save-notes').onclick = persistNotes;
$('notes').oninput = () => {
  if (state.selected) state.selected.notes = $('notes').value;
  state.notesDirty = true;
  $('notes-status').textContent = t('Chưa lưu');
};
$('edit-metadata').onclick = () => {
  const text = localized(state.selected, state.language);
  $('edit-language').value = state.language;
  $('edit-title').value = text.title;
  $('edit-description').value = text.description;
  $('metadata-dialog').showModal();
};
$('edit-language').onchange = () => {
  const text = state.selected.texts[$('edit-language').value];
  $('edit-title').value = text?.title || '';
  $('edit-description').value = text?.description || '';
};
$('cancel-edit').onclick = () => $('metadata-dialog').close();
$('metadata-form').onsubmit = async (e) => {
  e.preventDefault();
  const lesson = state.selected;
  const language = $('edit-language').value.trim();
  if (!/^[A-Za-z-]{1,20}$/.test(language)) return notify(t('Mã ngôn ngữ không hợp lệ.'));
  const metadata = {
    duration: lesson.duration,
    chapter: lesson.chapter,
    texts: {
      ...lesson.texts,
      [language]: {
        title: $('edit-title').value.trim(),
        description: $('edit-description').value.trim(),
      },
    },
  };
  try {
    await invoke('save_metadata', { id: lesson.id, metadata });
    lesson.texts = metadata.texts;
    $('watch-title').textContent = localized(lesson, state.language).title;
    $('watch-description').textContent = localized(lesson, state.language).description;
    $('metadata-dialog').close();
    await refresh();
    playlist();
    notify(t('Đã lưu tiêu đề và mô tả.'));
  } catch (error) {
    notify(error);
  }
};
$('import-subtitle').onclick = async () => {
  try {
    const source = await chooseSubtitle();
    if (!source) return;
    const lesson = state.selected;
    await player.save();
    await invoke('import_subtitle', {
      id: lesson.id,
      source,
      language: $('import-language').value.trim(),
    });
    await refresh();
    await watch(
      state.all.find((l) => l.id === lesson.id),
      false,
    );
    notify(t('Đã thêm phụ đề. Chọn ngôn ngữ trong cài đặt trình phát.'));
  } catch (e) {
    notify(e);
  }
};
const appWindow = window.__TAURI__?.window?.getCurrentWindow();
if (appWindow) {
  await installCloseGuard(
    appWindow,
    async () => {
      persistWorkspace();
      await player.leave();
      await workspace.flush();
    },
    (error) => notify(t('Không lưu được cài đặt: {error}', { error: localizeError(error) })),
  );
  await invoke('ui_ready');
}

translateDOM();
$('app-language').value = getLocale();
$('app-language').onchange = (event) => setLocale(event.target.value);
onLocaleChange(() => {
  if (restoringPreferences) return;
  $('app-language').value = getLocale();
  persistWorkspace();
  $('toast').hidden = true;
  if (state.root) $('library-path').textContent = state.root;
  const selectedChapter = $('chapter-filter').value;
  chapters();
  $('chapter-filter').value = selectedChapter;
  updateStats();
  render();
  playlist();
  updateWatchText();
  if (!state.root) $('hero-meta').textContent = t('Chọn thư mục files qua nút ⚙ ở góc phải.');
  if ($('notes-status').textContent)
    $('notes-status').textContent = t(state.notesDirty ? 'Chưa lưu' : 'Đã lưu trên máy.');
});

try {
  const info = await invoke('default_library');
  state.root = info.root;
  $('library-path').textContent = info.root;
  await loadPreferences();
  await refresh(true);
} catch (e) {
  $('hero-meta').textContent = t('Chọn thư mục files qua nút ⚙ ở góc phải.');
  $('empty').hidden = false;
  notify(e);
}

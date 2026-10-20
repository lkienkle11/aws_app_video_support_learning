import { $, time, escapeHTML as h, localized } from '../../shared/utils.js';
import { invoke, asset, chooseDirectory, chooseSubtitle } from '../../shared/api.js';
import { Player } from '../player/player.js';
import { revealActiveLesson } from './playlist-scroll.js';

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
  $('toast').textContent = String(message);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 6500);
}
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
    updateStats();
    $('playlist-count').textContent =
      `${state.all.length} bài · ${state.all.filter((l) => l.completed).length} hoàn thành`;
    for (const button of $('playlist').querySelectorAll('button')) {
      if (button.dataset.id === lesson.id)
        button.querySelector('span').textContent = lesson.completed
          ? '✓'
          : String(lesson.number).padStart(3, '0');
    }
    if (state.selected?.id === lesson.id)
      $('mark-complete').textContent = lesson.completed ? '✓ Đã hoàn thành' : '✓ Hoàn thành';
  },
  onNavigate: (delta) => {
    const index = state.all.findIndex((l) => l.id === state.selected?.id);
    const next = state.all[index + delta];
    if (next) watch(next);
    else notify('Bạn đã đến cuối danh sách bài học.');
  },
});
function updateStats() {
  const count = state.all.length;
  const completed = state.all.filter((l) => l.completed).length;
  const percent = count ? Math.round((completed / count) * 100) : 0;
  $('nav-count').textContent = count;
  $('stat-lessons').textContent = count;
  $('stat-completed').textContent = completed;
  $('stat-progress').textContent = percent + '%';
  const duration = state.all.reduce((sum, l) => sum + l.duration, 0);
  $('stat-hours').textContent = duration ? `${(duration / 3600).toFixed(1)} giờ` : '—';
  $('progress-ring').style.background = `conic-gradient(#8daf7d ${percent}%,#edf2e6 0)`;
  $('hero-meta').textContent = `${count} bài học · ${completed} đã hoàn thành`;
  $('resume').querySelector('span').textContent = state.all.some((l) => l.position > 0)
    ? 'Tiếp tục học'
    : 'Bắt đầu học';
}
function chapters() {
  const chapters = [...new Set(state.all.map((l) => l.chapter).filter(Boolean))];
  $('chapters').innerHTML = chapters
    .map(
      (c, i) =>
        `<button class="chapter-nav" data-chapter="${h(c)}"><span>${String(i + 1).padStart(2, '0')}</span>${h(c)}</button>`,
    )
    .join('');
  $('chapter-filter').innerHTML =
    '<option value="">Tất cả chương</option>' +
    chapters.map((c) => `<option>${h(c)}</option>`).join('');
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
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang;
        $(id).append(option);
      }
    }
}
async function refresh() {
  state.all = await invoke('search_lessons', { query: '', language: '' });
  chapters();
  updateStats();
  await search();
}
async function search() {
  const generation = ++state.queryGeneration;
  try {
    const lessons = await invoke('search_lessons', {
      query: $('search').value,
      language: $('search-language').value,
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
  const chapter = $('chapter-filter').value;
  const lessons = state.results.filter(
    (l) =>
      (!chapter || l.chapter === chapter) &&
      (state.mode === 'all' ||
        (state.mode === 'completed' ? l.completed : l.position > 0 && !l.completed)),
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
      return `<article class="lesson-card" tabindex="0" role="button" data-id="${h(lesson.id)}" aria-label="Xem trước ${h(text.title)}"><div class="card-art ${['', 'blue', 'sand'][i % 3]}"><span class="card-symbol">${['☁', '⌘', '▤', '⌁', '⛨'][i % 5]}</span><span class="card-badge">BÀI ${String(lesson.number).padStart(3, '0')}</span><span class="card-play">▶</span><span class="duration">${lesson.duration ? time(lesson.duration) : 'VIDEO'}</span></div><div class="card-body"><span class="card-chapter">${h(lesson.chapter || 'AWS Cloud Practitioner')}</span><h3>${h(text.title)}</h3><p>${h(text.description)}</p><div class="card-footer"><span>▤ ${lesson.tracks.length ? lesson.tracks.map((t) => h(t.language.toUpperCase())).join(' · ') : 'Chưa có phụ đề'}</span><span>${lesson.completed ? '✓ Đã học' : lesson.position ? '◷ Đang học' : 'Bắt đầu khám phá ↗'}</span></div></div><div class="card-progress"><span style="width:${percent}%"></span></div></article>`;
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
  $('playlist-count').textContent =
    `${state.all.length} bài · ${state.all.filter((l) => l.completed).length} hoàn thành`;
  $('playlist').innerHTML = state.all
    .map(
      (l) =>
        `<button class="playlist-item ${l.id === state.selected?.id ? 'active' : ''}" data-id="${h(l.id)}"><span>${l.completed ? '✓' : String(l.number).padStart(3, '0')}</span><div>${h(localized(l, state.language).title)}<small>${h(l.chapter)} ${l.duration ? '· ' + time(l.duration) : ''}</small></div></button>`,
    )
    .join('');
  $('playlist')
    .querySelectorAll('button')
    .forEach((b) => (b.onclick = () => watch(state.all.find((l) => l.id === b.dataset.id))));
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

async function watch(lesson, play = true) {
  if (!lesson) return;
  if (state.selected) state.selected.notes = $('notes').value;
  state.selected = lesson;
  $('library-view').hidden = true;
  $('watch-view').hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
  const text = localized(lesson, state.language);
  const other = localized(lesson, state.language === 'vi' ? 'en' : 'vi');
  $('watch-title').textContent = text.title;
  $('watch-description').textContent = text.description;
  $('watch-subtitle').textContent = other.title;
  $('watch-chapter').textContent = `Bài ${lesson.number} · ${lesson.chapter}`;
  $('notes').value = lesson.notes;
  $('notes-status').textContent = '';
  $('track-info').textContent =
    `Phụ đề có sẵn: ${lesson.tracks.map((t) => t.label).join(', ') || 'Chưa có'}. Có thể nhập bản dịch SRT/VTT từ máy.`;
  $('mark-complete').textContent = lesson.completed ? '✓ Đã hoàn thành' : '✓ Hoàn thành';
  playlist();
  try {
    await player.open(lesson, play);
  } catch (e) {
    notify(e);
  }
}
async function home() {
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
    const info = await invoke('open_library', { path });
    state.root = info.root;
    $('library-path').textContent = info.root;
    state.selected = null;
    player.lesson = null;
    $('watch-view').hidden = true;
    $('library-view').hidden = false;
    await refresh();
    notify(`Đã tải ${info.lessons} bài học.`);
  } catch (e) {
    notify(e);
  }
}
$('choose-library').onclick = chooseLibrary;
$('rescan').onclick = async () => {
  player.endScreen.hide();
  try {
    await player.save();
    if (!state.root) return chooseLibrary();
    await invoke('open_library', { path: state.root });
    await refresh();
    notify('Đã cập nhật thư viện.');
  } catch (e) {
    notify(e);
  }
};
$('back').onclick = home;
$('home').onclick = () => {
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
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 180);
};
$('search-language').onchange = search;
$('chapter-filter').onchange = () => {
  state.limit = 24;
  render();
};
$('display-language').onchange = () => {
  state.language = $('display-language').value;
  render();
};
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    home();
    $('search').focus();
  }
});
document.querySelectorAll('[data-tab]').forEach(
  (button) =>
    (button.onclick = () => {
      document
        .querySelectorAll('[data-tab]')
        .forEach((b) => b.classList.toggle('active', b === button));
      for (const tab of ['description', 'transcript', 'notes'])
        $(`${tab}-tab`).hidden = tab !== button.dataset.tab;
      if (button.dataset.tab === 'transcript') player.transcript();
    }),
);
$('mark-complete').onclick = async () => {
  if (!state.selected) return;
  state.selected.completed = !state.selected.completed;
  await persistNotes();
  $('mark-complete').textContent = state.selected.completed ? '✓ Đã hoàn thành' : '✓ Hoàn thành';
  playlist();
};
async function persistNotes() {
  const lesson = state.selected;
  if (!lesson) return;
  lesson.notes = $('notes').value;
  try {
    await player.saveNotes(lesson, lesson.notes);
    $('notes-status').textContent = 'Đã lưu trên máy.';
    updateStats();
  } catch (e) {
    notify('Không lưu được: ' + e);
  }
}
$('save-notes').onclick = persistNotes;
$('notes').oninput = () => {
  if (state.selected) state.selected.notes = $('notes').value;
  $('notes-status').textContent = 'Chưa lưu';
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
  if (!/^[A-Za-z-]{1,20}$/.test(language)) return notify('Mã ngôn ngữ không hợp lệ.');
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
    notify('Đã lưu tiêu đề và mô tả.');
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
    notify('Đã thêm phụ đề. Chọn ngôn ngữ trong cài đặt trình phát.');
  } catch (e) {
    notify(e);
  }
};
const appWindow = window.__TAURI__?.window?.getCurrentWindow();
if (appWindow) {
  appWindow
    .onCloseRequested(async (event) => {
      try {
        await player.leave();
      } catch {
        event.preventDefault();
      }
    })
    .catch(notify);
}

try {
  const info = await invoke('default_library');
  state.root = info.root;
  $('library-path').textContent = info.root;
  await refresh();
} catch (e) {
  $('hero-meta').textContent = 'Chọn thư mục files qua nút ⚙ ở góc trái.';
  $('empty').hidden = false;
  notify(e);
}

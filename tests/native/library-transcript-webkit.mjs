import { playbackDefaults, workspaceDefaults } from '/shared/preferences.js';
import { defaultCaptionSettings } from '/features/player/caption-style.js';
import { searchLessonTitles } from '/features/library/lesson-search.js';
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const until = async (predicate, message) => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await wait(30);
  }
  throw new Error(message);
};
try {
  let chooses = 0;
  const lessons = [
    {
      id: '037',
      number: 37,
      chapter: 'EC2 · Máy chủ đám mây',
      texts: {
        en: { title: 'EC2 Basics', description: 'Virtual machines' },
        vi: { title: 'Cơ bản EC2', description: 'Máy chủ' },
      },
    },
    {
      id: '038',
      number: 38,
      chapter: 'EC2 · Máy chủ đám mây',
      texts: {
        en: { title: 'Launch an instance', description: 'EC2 Basics' },
        vi: { title: 'Khởi tạo máy chủ', description: '' },
      },
    },
    {
      id: '020',
      number: 20,
      chapter: 'IAM',
      texts: { en: { title: 'IAM roles', description: '' } },
    },
  ].map((l) => ({
    ...l,
    video: 'video.mp4',
    tracks: [{ path: 'test.vtt', label: 'English', language: 'en' }],
    duration: 213,
    position: 0,
    completed: false,
    notes: '',
  }));
  const stamp = (s) =>
    `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000`;
  const subtitle =
    'WEBVTT\n\n' +
    Array.from(
      { length: 100 },
      (_, i) => `${stamp(i * 2)} --> ${stamp(i * 2 + 2)}\nTranscript line ${i}\n`,
    ).join('\n');
  window.__TAURI__ = {
    core: {
      convertFileSrc: () => 'asset://localhost/video.mp4',
      invoke: async (backend, payload) => {
        if (backend === 'plugin:dialog|open') {
          chooses++;
          return null;
        }
        const { command, args } = payload;
        if (command === 'default_library') return { root: '/QA/files', lessons: lessons.length };
        if (command === 'search_lessons') return searchLessonTitles(lessons, args.query || '');
        if (command === 'load_workspace_settings')
          return {
            ...workspaceDefaults,
            locale: 'en',
            display_language: 'en',
            chapter: lessons[0].chapter,
          };
        if (command === 'load_playback_settings') return { ...playbackDefaults };
        if (command === 'load_lesson_settings') return { caption_offset: 0 };
        if (command === 'load_caption_settings') return { ...defaultCaptionSettings };
        if (command === 'media_path') {
          if (!args.relative.endsWith('.mp4')) throw new Error('No preview');
          return 'video.mp4';
        }
        if (command === 'read_subtitle') return subtitle;
        if (command.startsWith('save_')) return null;
        throw new Error(`Unexpected command: ${command}`);
      },
    },
  };
  await import('/features/library/controller.js');
  check(
    document.querySelector('.chapter-nav.active')?.dataset.chapter === lessons[0].chapter,
    'restored chapter is not highlighted',
  );
  document.querySelector('[data-chapter="IAM"]').click();
  await wait(100);
  check(
    document.querySelector('.chapter-nav.active')?.dataset.chapter === 'IAM',
    'clicked chapter is not highlighted',
  );
  $('chapter-filter').value = lessons[0].chapter;
  $('chapter-filter').dispatchEvent(new Event('change'));
  check(
    document.querySelector('.chapter-nav.active')?.dataset.chapter === lessons[0].chapter,
    'dropdown did not update chapter highlight',
  );
  check(
    $('choose-library').parentElement.classList.contains('top-actions'),
    'folder settings is not beside avatar',
  );
  $('choose-library').click();
  $('library-location').click();
  await wait(20);
  check(chooses === 2, 'both folder chooser entry points must work');
  document.querySelector('.lesson-card[data-id="037"]').click();
  await until(() => $('video').textTracks[0]?.cues?.length === 100, 'subtitle failed to load');
  document.querySelector('[data-tab="transcript"]').click();
  const video = $('video'),
    list = $('transcript'),
    sync = $('transcript-sync');
  const seek = async (seconds) => {
    await until(() => video.readyState >= 2, `video not ready: ${video.error?.message}`);
    video.currentTime = seconds;
    await wait(150);
    video.dispatchEvent(new Event('timeupdate'));
    await wait(50);
  };
  await seek(80);
  check(
    list.scrollTop > 100,
    `transcript does not auto-scroll on seek ${JSON.stringify({ time: video.currentTime, height: list.clientHeight, scrollHeight: list.scrollHeight, rows: list.children.length, active: list.querySelector('.active')?.dataset.start, top: list.scrollTop, hidden: sync.hidden })}`,
  );
  check(list.querySelector('.cue.active')?.dataset.start === '80', 'wrong current cue');
  check(sync.hidden, 'sync button should be hidden while following');
  const pageTop = window.scrollY;
  list.scrollTop = 0;
  await wait(80);
  check(!sync.hidden, 'manual scroll away did not show Sync now');
  await seek(100);
  check(list.scrollTop === 0, 'auto-scroll interrupted manual reading');
  sync.click();
  await wait(80);
  check(sync.hidden && list.scrollTop > 100, 'Sync now did not resume following');
  check(window.scrollY === pageTop, 'sync scrolled the whole page');
  await seek(140);
  check(
    list.querySelector('.cue.active')?.dataset.start === '140' && sync.hidden,
    'following did not stay enabled',
  );
  await video.play();
  await until(() => video.currentTime >= 142.1, 'video did not advance during playback');
  video.pause();
  await wait(50);
  check(
    Number(list.querySelector('.cue.active')?.dataset.start) >= 142,
    `real playback did not advance transcript: time=${video.currentTime}, cue=${list.querySelector('.cue.active')?.dataset.start}`,
  );
  $('lesson-search-open').click();
  check($('lesson-search-dialog').open, 'search modal did not open');
  $('lesson-search-input').value = 'EC2 basics';
  $('lesson-search-input').dispatchEvent(new Event('input'));
  check(
    $('lesson-search-results').querySelectorAll('button').length === 1,
    'title search included description match',
  );
  $('lesson-search-input').value = 'khoi tao';
  $('lesson-search-input').dispatchEvent(new Event('input'));
  check(
    $('lesson-search-results').querySelector('[data-id="038"]'),
    'Vietnamese accent folding failed',
  );
  const previousTrack = video.textTracks[0];
  $('lesson-search-results').querySelector('button').click();
  await until(
    () => $('watch-title').textContent === 'Launch an instance',
    'search result did not open lesson details',
  );
  check(!$('lesson-search-dialog').open, 'search modal did not close');
  document.querySelector('[data-tab="transcript"]').click();
  await until(
    () => video.textTracks[0] !== previousTrack && video.textTracks[0]?.cues?.length === 100,
    'new lesson subtitle failed to load',
  );
  await seek(60);
  check(
    sync.hidden && list.querySelector('.cue.active')?.dataset.start === '60',
    'new lesson did not reset auto-follow',
  );
  $('lesson-search-open').click();
  $('lesson-search-input').value = 'zzzzz';
  $('lesson-search-input').dispatchEvent(new Event('input'));
  check(
    $('lesson-search-results').textContent.includes('No lessons found'),
    'missing empty search state',
  );
  $('lesson-search-close').click();
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({
      passed: true,
      checks: [
        'chapter click/dropdown/restore',
        'two folder chooser entry points',
        'auto-follow seek and playback',
        'manual detach and resume',
        'page scroll unchanged',
        'title-only multilingual modal search',
        'open details and close modal',
        'lesson switch resets following',
        'empty search',
      ],
    }),
  );
} catch (error) {
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({ passed: false, error: String(error), stack: error.stack }),
  );
}

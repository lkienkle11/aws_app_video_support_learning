import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messages } from '../ui/shared/locales/messages.js';
import {
  t,
  getLocale,
  setLocale,
  translateDOM,
  onLocaleChange,
  localizeError,
} from '../ui/shared/i18n.js';

test('every application message has Vietnamese, English and matching parameters', () => {
  const parameters = (text) => [...text.matchAll(/\{\w+\}/g)].map(([value]) => value).sort();
  for (const [key, entry] of Object.entries(messages)) {
    assert.ok(entry.vi?.trim(), key);
    assert.ok(entry.en?.trim(), key);
    assert.deepEqual(parameters(entry.vi), parameters(key), key);
    assert.deepEqual(parameters(entry.en), parameters(key), key);
  }
  const html = readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
  for (const [, encoded] of html.matchAll(
    /data-i18n(?:-(?:title|placeholder|aria-label))?="([^"]+)"/g,
  )) {
    const key = encoded.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
    assert.ok(messages[key], key);
  }
});

test('locale updates labels and accessibility attributes without changing input state', () => {
  const originalDocument = globalThis.document;
  const node = (attributes) => ({
    attributes,
    value: 'unsaved notes',
    getAttribute(key) {
      return this.attributes[key];
    },
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
  });
  const label = node({ 'data-i18n': 'Cài đặt phụ đề' });
  const input = node({
    'data-i18n-placeholder': 'Tìm tên bài học, mô tả…',
    'data-i18n-aria-label': 'Tìm bài học',
  });
  const root = {
    documentElement: {},
    querySelectorAll(selector) {
      return [label, input].filter((element) => selector.slice(1, -1) in element.attributes);
    },
  };
  globalThis.document = root;
  const seen = [];
  const unsubscribe = onLocaleChange((locale) => seen.push(locale));
  try {
    setLocale('en', { persist: false });
    assert.equal(root.documentElement.lang, 'en');
    assert.equal(label.textContent, 'Subtitle settings');
    assert.equal(input.attributes.placeholder, 'Search titles and descriptions…');
    assert.equal(input.attributes['aria-label'], 'Search lessons');
    assert.equal(input.value, 'unsaved notes');
    assert.equal(t('Bài tiếp theo sau {seconds} giây', { seconds: 3 }), 'Next lesson in 3 seconds');
    assert.equal(localizeError(new Error('Invalid caption settings')), 'Invalid caption settings');
    setLocale('vi', { persist: false });
    assert.equal(label.textContent, 'Cài đặt phụ đề');
    assert.equal(localizeError('Invalid caption settings'), 'Cài đặt phụ đề không hợp lệ');
    assert.deepEqual(seen, ['en', 'vi']);
    assert.throws(() => setLocale('xx'), /Unsupported/);
    assert.equal(getLocale(), 'vi');
    assert.equal(t('custom metadata'), 'custom metadata');
    translateDOM(null);
  } finally {
    unsubscribe();
    globalThis.document = originalDocument;
  }
});

test('chosen app language survives reload and storage failures are harmless', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value) },
  });
  try {
    setLocale('en');
    const reopened = await import('../ui/shared/i18n.js?reload');
    assert.equal(reopened.getLocale(), 'en');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('disabled');
      },
    });
    assert.doesNotThrow(() => setLocale('vi'));
    const unavailable = await import('../ui/shared/i18n.js?storage-disabled');
    assert.equal(unavailable.getLocale(), 'vi');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

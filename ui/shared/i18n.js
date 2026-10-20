import { messages } from './locales/messages.js';
export const supportedLocales = ['vi', 'en'];
const storageKey = 'cloud-study:locale';
let locale = 'vi';
try {
  const saved = globalThis.localStorage?.getItem(storageKey);
  if (supportedLocales.includes(saved)) locale = saved;
} catch {
  /* A read-only store must not prevent startup. */
}
const listeners = new Set();
export const getLocale = () => locale;
export function t(key, values = {}) {
  const pattern = messages[key]?.[locale] ?? key;
  return pattern.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
export function translateDOM(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  if (root.documentElement) root.documentElement.lang = locale;
  for (const element of root.querySelectorAll('[data-i18n]'))
    element.textContent = t(element.getAttribute('data-i18n'));
  for (const attribute of ['title', 'placeholder', 'aria-label']) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`))
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
  }
}
export function setLocale(value, { persist = true } = {}) {
  if (!supportedLocales.includes(value)) throw new Error('Unsupported application locale');
  locale = value;
  if (persist) {
    try {
      globalThis.localStorage?.setItem(storageKey, locale);
    } catch {}
  }
  translateDOM();
  for (const listener of listeners) listener(locale);
}
export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function localizeError(error) {
  const message = error?.message || String(error);
  if (messages[message]) return t(message);
  const translated = Object.values(messages).find((entry) =>
    Object.values(entry).includes(message),
  );
  return translated?.[locale] ?? message;
}

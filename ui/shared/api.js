import { t, localizeError } from './i18n.js';
export function invoke(command, args = {}) {
  if (!window.__TAURI__)
    return Promise.reject(
      new Error(
        t('Mở Cloud Study bằng ứng dụng desktop. Giao diện này cần Rust để truy cập thư viện.'),
      ),
    );
  const request = command.startsWith('plugin:')
    ? window.__TAURI__.core.invoke(command, args)
    : window.__TAURI__.core.invoke('backend', { command, args });
  return Promise.resolve(request).catch((error) => {
    throw new Error(localizeError(error));
  });
}
export async function asset(relative) {
  const path = await invoke('media_path', { relative });
  return window.__TAURI__.core.convertFileSrc(path);
}
export function chooseDirectory() {
  return invoke('plugin:dialog|open', {
    options: { directory: true, multiple: false, title: t('Chọn thư mục files chứa khóa học') },
  });
}
export function chooseSubtitle() {
  return invoke('plugin:dialog|open', {
    options: { multiple: false, filters: [{ name: t('Phụ đề'), extensions: ['srt', 'vtt'] }] },
  });
}

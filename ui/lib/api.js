export function invoke(command, args = {}) {
  if (!window.__TAURI__)
    return Promise.reject(
      new Error(
        'Mở Cloud Study bằng ứng dụng desktop. Giao diện này cần Rust để truy cập thư viện.',
      ),
    );
  return command.startsWith('plugin:')
    ? window.__TAURI__.core.invoke(command, args)
    : window.__TAURI__.core.invoke('backend', { command, args });
}
export async function asset(relative) {
  const path = await invoke('media_path', { relative });
  return window.__TAURI__.core.convertFileSrc(path);
}
export function chooseDirectory() {
  return invoke('plugin:dialog|open', {
    options: { directory: true, multiple: false, title: 'Chọn thư mục files chứa khóa học' },
  });
}
export function chooseSubtitle() {
  return invoke('plugin:dialog|open', {
    options: { multiple: false, filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }] },
  });
}

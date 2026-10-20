import { t, localizeError } from '../../shared/i18n.js';
import { $ } from '../../shared/utils.js';
import { invoke } from '../../shared/api.js';
import { captionGeometry, clamp } from './caption-layout.js';
import { captionColors, captionDimensions, defaultCaptionSettings } from './caption-style.js';

export class Captions {
  constructor(notify) {
    this.notify = notify;
    this.frame = $('player');
    this.box = $('caption-overlay');
    this.settings = { ...defaultCaptionSettings };
    this.controlsVisible = false;
    this.loaded = false;
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.frame);
    this.resize.observe($('player-controls'));
    const openSettings = () => $('caption-settings-dialog').showModal();
    $('caption-settings-open').onclick = $('caption-settings-access').onclick = openSettings;
    $('caption-settings-close').onclick = () => $('caption-settings-dialog').close();
    for (const [id, key, parse] of [
      ['caption-size', 'size', Number],
      ['caption-background-width', 'background_width', Number],
      ['caption-background-height', 'background_height', Number],
      ['caption-color', 'color', String],
      ['caption-background', 'background', String],
      ['caption-opacity', 'opacity', (value) => Number(value) / 100],
      ['caption-background-opacity', 'background_opacity', (value) => Number(value) / 100],
    ]) {
      const update = (event) => {
        if (event.target.validity && !event.target.validity.valid) return false;
        this.settings[key] = parse(event.target.value);
        this.apply();
        return true;
      };
      $(id).oninput = update;
      $(id).onchange = (event) => {
        if (update(event)) this.save();
      };
    }
    $('caption-reset').onclick = () => {
      this.settings.x = 0.5;
      this.settings.y = 0;
      this.layout();
      this.save();
    };
    this.box.onpointerdown = (event) => {
      const rect = this.box.getBoundingClientRect();
      this.drag = { x: event.clientX - (rect.left + rect.width / 2), y: event.clientY - rect.top };
      this.box.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };
    this.box.onpointermove = (event) => {
      if (!this.drag) return;
      const frame = this.frame.getBoundingClientRect();
      const geometry = this.geometry();
      this.settings.x = clamp((event.clientX - this.drag.x - frame.left) / frame.width, 0, 1);
      const bottom = frame.bottom - (event.clientY - this.drag.y + this.box.offsetHeight);
      this.settings.y = geometry.span ? clamp((bottom - geometry.base) / geometry.span, 0, 1) : 0;
      this.layout();
    };
    const finish = (event) => {
      if (!this.drag) return;
      this.drag = null;
      if (this.box.hasPointerCapture(event.pointerId))
        this.box.releasePointerCapture(event.pointerId);
      this.save();
    };
    this.box.onpointerup = finish;
    this.box.onpointercancel = finish;
  }
  async load() {
    await this.flush();
    this.settings = await invoke('load_caption_settings');
    this.loaded = true;
    this.lastSaved = JSON.stringify(this.settings);
    this.apply();
  }
  async save() {
    if (!this.loaded) return;
    try {
      const settings = { ...this.settings };
      this.pendingSave = (this.pendingSave || Promise.resolve())
        .then(async () => {
          await invoke('save_caption_settings', { settings });
          this.lastSaved = JSON.stringify(settings);
          this.saveError = null;
        })
        .catch((error) => {
          this.saveError = error;
          this.notify(t('Không lưu được cài đặt phụ đề: {error}', { error: localizeError(error) }));
        });
      await this.pendingSave;
    } catch (error) {
      this.saveError = error;
      this.notify(t('Không lưu được cài đặt phụ đề: {error}', { error: localizeError(error) }));
    }
  }
  async flush() {
    await this.pendingSave;
    if (this.loaded && JSON.stringify(this.settings) !== this.lastSaved) await this.save();
    if (this.saveError) throw this.saveError;
  }
  apply() {
    this.box.style.fontSize = `${this.settings.size}px`;
    Object.assign(this.box.style, captionColors(this.settings), captionDimensions(this.settings));
    $('caption-size').value = this.settings.size;
    $('caption-background-width').value = this.settings.background_width;
    $('caption-background-height').value = this.settings.background_height;
    $('caption-color').value = this.settings.color;
    $('caption-background').value = this.settings.background;
    for (const [id, key] of [
      ['caption-opacity', 'opacity'],
      ['caption-background-opacity', 'background_opacity'],
    ]) {
      const percent = Math.round(this.settings[key] * 100);
      $(id).value = percent;
      $(`${id}-value`).textContent = `${percent}%`;
    }
    this.layout();
  }
  render(track) {
    const text = [...(track?.activeCues || [])]
      .map((c) => c.text.replace(/<[^>]*>/g, ''))
      .join('\n');
    if (this.box.textContent === text && this.box.hidden === !text) return;
    this.box.textContent = text;
    this.box.hidden = !text;
    if (text) this.layout();
  }
  geometry() {
    return captionGeometry({
      width: this.frame.clientWidth,
      height: this.frame.clientHeight,
      boxWidth: this.box.offsetWidth,
      boxHeight: this.box.offsetHeight,
      controlsHeight: $('player-controls').offsetHeight,
      visible: this.controlsVisible,
      x: this.settings.x,
      y: this.settings.y,
    });
  }
  layout() {
    const base = this.controlsVisible ? $('player-controls').offsetHeight + 10 : 10;
    this.box.style.maxHeight = `${Math.max(12, this.frame.clientHeight - base - 8)}px`;
    const { left, bottom } = this.geometry();
    this.box.style.left = `${left}px`;
    this.box.style.bottom = `${bottom}px`;
  }
}

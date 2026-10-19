import { $ } from '../../shared/utils.js';
import { invoke } from '../../shared/api.js';
import { captionGeometry, clamp } from './caption-layout.js';

export class Captions {
  constructor(notify) {
    this.notify = notify;
    this.frame = $('player');
    this.box = $('caption-overlay');
    this.settings = { size: 24, x: 0.5, y: 0, color: 'white', background: 'rgba(0,0,0,.8)' };
    this.controlsVisible = false;
    this.loaded = false;
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.frame);
    this.resize.observe($('player-controls'));
    for (const [id, key, parse] of [
      ['caption-size', 'size', Number],
      ['caption-color', 'color', String],
      ['caption-background', 'background', String],
    ])
      $(id).onchange = (event) => {
        this.settings[key] = parse(event.target.value);
        this.apply();
        this.save();
      };
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
    this.settings = await invoke('load_caption_settings');
    this.loaded = true;
    this.apply();
  }
  async save() {
    if (!this.loaded) return;
    try {
      await invoke('save_caption_settings', { settings: { ...this.settings } });
    } catch (error) {
      this.notify('Không lưu được vị trí phụ đề: ' + error);
    }
  }
  apply() {
    this.box.style.fontSize = `${this.settings.size}px`;
    this.box.style.color = this.settings.color;
    this.box.style.background = this.settings.background;
    $('caption-size').value = this.settings.size;
    $('caption-color').value = this.settings.color;
    $('caption-background').value = this.settings.background;
    this.layout();
  }
  render(track) {
    const text = [...(track?.activeCues || [])]
      .map((c) => c.text.replace(/<[^>]*>/g, ''))
      .join('\n');
    this.box.textContent = text;
    this.box.hidden = !text;
    this.layout();
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

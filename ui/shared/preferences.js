import { invoke } from './api.js';

/** One serialized, coalescing writer per preference document. Flush before changing library. */
export class PreferenceStore {
  constructor(kind, defaults, { request = invoke, onError = () => {}, clock = globalThis } = {}) {
    this.kind = kind;
    this.defaults = defaults;
    this.value = { ...defaults };
    this.request = request;
    this.onError = onError;
    this.clock = clock;
    this.loaded = false;
    this.version = 0;
    this.saved = 0;
    this.args = {};
  }
  async load(args = {}) {
    await this.flush();
    this.loaded = false;
    const generation = (this.loadGeneration = (this.loadGeneration || 0) + 1);
    const value = {
      ...this.defaults,
      ...(await this.request(`load_${this.kind}_settings`, { ...args })),
    };
    if (generation === this.loadGeneration) {
      this.args = { ...args };
      this.value = value;
      this.loaded = true;
    }
    return value;
  }
  update(patch) {
    if (!this.loaded) return;
    const next = { ...this.value, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.value)) return;
    this.value = next;
    this.version++;
    this.clock.clearTimeout(this.timer);
    this.timer = this.clock.setTimeout(() => this.flush().catch(this.onError), 150);
  }
  flush() {
    this.clock.clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (!this.loaded || this.saved === this.version) return Promise.resolve();
    const write = async () => {
      while (this.saved !== this.version) {
        const version = this.version;
        const settings = { ...this.value };
        await this.request(`save_${this.kind}_settings`, { ...this.args, settings });
        this.saved = version;
      }
    };
    this.pending = write().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}
export const playbackDefaults = {
  autoplay: true,
  volume: 1,
  muted: false,
  last_volume: 1,
  audio_boost: 1,
  speed: 1,
  repeat: false,
  subtitle_language: 'auto',
  zoom_touchpad: true,
  zoom_mouse: true,
};
export const workspaceDefaults = {
  locale: null,
  display_language: 'vi',
  search_language: '',
  search_field: 'all',
  query: '',
  chapter: '',
  mode: 'all',
  theater: false,
  active_tab: 'description',
  import_language: 'vi',
  transcript_query: '',
};

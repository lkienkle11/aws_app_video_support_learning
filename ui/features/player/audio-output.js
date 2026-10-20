/** Native volume stays untouched until the user explicitly requests amplification. */
export class AudioOutput {
  constructor(
    video,
    createContext = () => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('Audio boost is unavailable in this WebView');
      return new Context();
    },
  ) {
    this.video = video;
    this.createContext = createContext;
    this.boost = 1;
    this.requestedBoost = 1;
    this.lastAudibleVolume = video.volume || 1;
  }
  get volume() {
    return this.output ? this.level : this.video.volume;
  }
  get muted() {
    return this.video.muted;
  }
  setVolume(value) {
    const level = Math.max(0, Math.min(1, value));
    if (this.output) this.level = level;
    else this.video.volume = level;
    this.video.muted = level === 0;
    if (level > 0) this.lastAudibleVolume = level;
    this.applyVolume();
  }
  toggleMute() {
    if (this.muted || this.volume === 0) {
      if (this.volume === 0) this.setVolume(this.lastAudibleVolume);
      this.video.muted = false;
    } else {
      this.lastAudibleVolume = this.volume;
      this.video.muted = true;
    }
    this.applyVolume();
  }
  syncNativeVolume() {
    if (!this.output) return;
    if (this.video.volume !== 1) {
      this.level = this.video.volume;
      if (this.level > 0) this.lastAudibleVolume = this.level;
      this.video.volume = 1;
    }
    this.applyVolume();
  }
  applyVolume() {
    if (this.output)
      this.output.gain.setTargetAtTime(this.muted ? 0 : this.level, this.context.currentTime, 0.01);
  }
  async resume() {
    if (!this.context) return;
    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio playback needs a user gesture');
  }
  async setBoost(value) {
    if (![1, 1.5, 2].includes(value)) throw new Error('Invalid audio boost');
    this.requestedBoost = value;
    if (value === 1 && !this.context) return;
    this.context ||= this.createContext();
    await this.resume();
    if (!this.gain) {
      const gain = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      // Keep amplification from turning loud speech peaks into sustained clipping.
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      const output = this.context.createGain();
      this.level = this.video.volume;
      output.gain.value = this.muted ? 0 : this.level;
      gain.connect(limiter);
      limiter.connect(output);
      output.connect(this.context.destination);
      const source = this.context.createMediaElementSource(this.video);
      source.connect(gain);
      this.gain = gain;
      this.limiter = limiter;
      this.output = output;
      // Own volume after the limiter, with unity media volume, to avoid either
      // ignoring or applying the slider twice across system WebView engines.
      this.video.volume = 1;
    }
    this.boost = this.requestedBoost;
    this.gain.gain.setTargetAtTime(this.boost, this.context.currentTime, 0.02);
  }
}

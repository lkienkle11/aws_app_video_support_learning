import { t, localizeError, onLocaleChange } from '../../shared/i18n.js';
import { $, time, spritePosition, escapeHTML } from '../../shared/utils.js';
import { invoke, asset } from '../../shared/api.js';
import { AudioOutput } from './audio-output.js';
import { Captions } from './captions.js';
import { EndScreen } from './end-screen.js';
import { resumePosition } from './playback-policy.js';
import { ControlsVisibility } from './controls-visibility.js';

export class Player {
  constructor({ notify, onProgress, onNavigate, getNextTitle = () => null }) {
    this.video = $('video');
    this.audio = new AudioOutput(this.video);
    this.notify = notify;
    this.onProgress = onProgress;
    this.onNavigate = (delta) => {
      this.endScreen.hide();
      onNavigate(delta);
    };
    this.getNextTitle = getNextTitle;
    this.endScreen = new EndScreen({
      onNext: () => this.onNavigate(1),
      onReplay: () => this.replay(),
    });
    this.lesson = null;
    this.urls = [];
    this.generation = 0;
    this.lastSave = 0;
    this.selectedTrack = -1;
    this.offset = 0;
    this.sprite = null;
    this.captions = new Captions(notify);
    this.visibility = new ControlsVisibility($('player'), $('settings'), (visible) => {
      this.captions.controlsVisible = visible;
      this.captions.layout();
      if (!visible) $('seek-preview').hidden = true;
    });
    const v = this.video;
    $('play').onclick = $('center-play').onclick = () => this.toggle();
    v.onclick = () => this.toggle();
    v.ondblclick = () => this.fullscreen();
    v.onplay = () => {
      if (v.paused || v.ended) return;
      this.endScreen.hide();
      this.audio.resume().catch((error) => this.notify(localizeError(error)));
      $('player').classList.add('playing');
      $('play').textContent = 'Ⅱ';
    };
    v.onpause = () => {
      if (!v.paused) return;
      $('player').classList.remove('playing');
      $('play').textContent = '▶';
      this.save().catch(() => {});
    };
    v.onloadedmetadata = () => {
      $('video-empty').hidden = true;
      if (this.lesson && v.currentSrc === this.source)
        v.currentTime = resumePosition(this.lesson, v.duration);
      this.update();
    };
    v.ontimeupdate = () => {
      this.update();
      if (Date.now() - this.lastSave > 5000) this.save().catch(() => {});
    };
    v.onended = async () => {
      const generation = this.generation;
      await this.save(true);
      if (generation !== this.generation || !v.ended) return;
      this.endScreen.show({
        autoplay: $('autoplay').checked && !v.loop,
        nextTitle: this.getNextTitle(),
      });
    };
    v.onerror = () => {
      $('video-empty').hidden = false;
      this.videoError = v.error?.code || 0;
      this.renderVideoError();
      this.notify(`${$('video-empty').textContent} ${v.error?.message || ''}`);
    };
    $('previous').onclick = () => this.onNavigate(-1);
    $('next').onclick = () => this.onNavigate(1);
    $('seek').oninput = (e) => {
      if (Number.isFinite(v.duration)) v.currentTime = (Number(e.target.value) / 1000) * v.duration;
      this.update();
    };
    $('seek').onpointermove = (e) => {
      const box = e.target.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
      $('seek-preview').hidden = false;
      $('seek-preview').style.left =
        `${Math.max(0, Math.min(box.width - 162, f * box.width - 81))}px`;
      $('preview-time').textContent = time(f * v.duration);
      $('preview-frame').style.backgroundPosition = spritePosition(f);
      $('preview-frame').hidden = !this.sprite;
    };
    $('seek').onpointerleave = () => {
      $('seek-preview').hidden = true;
    };
    $('volume').oninput = (e) => {
      this.audio.setVolume(Number(e.target.value));
      this.volumeUI();
    };
    $('mute').onclick = () => {
      this.audio.toggleMute();
      this.volumeUI();
    };
    v.onvolumechange = () => {
      this.audio.syncNativeVolume();
      this.volumeUI();
    };
    $('audio-boost').onchange = async (event) => {
      try {
        await this.audio.setBoost(Number(event.target.value));
      } catch (error) {
        this.notify(t('Không bật được tăng âm: {error}', { error: localizeError(error) }));
      } finally {
        event.target.value = this.audio.boost;
      }
    };
    $('speed').onchange = (e) => {
      v.playbackRate = Number(e.target.value);
    };
    $('loop').onchange = (e) => {
      v.loop = e.target.checked;
      if (v.loop) this.endScreen.cancel();
    };
    $('autoplay').onchange = async (e) => {
      if (!e.target.checked) this.endScreen.cancel();
      try {
        await invoke('save_playback_settings', { settings: { autoplay: e.target.checked } });
      } catch (error) {
        this.notify(t('Không lưu được cài đặt: {error}', { error: localizeError(error) }));
      }
    };
    $('settings-toggle').onclick = () => {
      $('settings').hidden = !$('settings').hidden;
      this.idle();
    };
    $('captions-toggle').onclick = () => {
      if (!v.textTracks.length)
        return this.notify(t('Bài này chưa có phụ đề. Dùng “Thêm phụ đề” để nhập SRT/VTT.'));
      this.selectTrack(this.selectedTrack >= 0 ? -1 : 0);
    };
    $('subtitle-language').onchange = (e) => this.selectTrack(Number(e.target.value));
    $('caption-offset').onchange = (e) => {
      const offset = Math.max(-120, Math.min(120, Number(e.target.value) || 0));
      for (const track of v.textTracks)
        for (const cue of track.cues || []) {
          if (!this.cueTimes.has(cue)) this.cueTimes.set(cue, [cue.startTime, cue.endTime]);
          const [start, end] = this.cueTimes.get(cue);
          cue.startTime = Math.max(0, start + offset);
          cue.endTime = Math.max(cue.startTime + 0.001, end + offset);
        }
      this.offset = offset;
      e.target.value = offset;
      this.transcript();
    };
    $('pip').onclick = async () => {
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else if (v.requestPictureInPicture) await v.requestPictureInPicture();
        else if (v.webkitSetPresentationMode)
          v.webkitSetPresentationMode(
            v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture',
          );
        else this.notify(t('WebView của hệ điều hành này chưa hỗ trợ hình trong hình.'));
      } catch (e) {
        this.notify(t('Không bật được hình trong hình: {error}', { error: localizeError(e) }));
      }
    };
    $('theater').onclick = () => $('watch-view').classList.toggle('theater-mode');
    $('fullscreen').onclick = () => this.fullscreen();
    $('player').onkeydown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.closest?.('#end-screen')) return;
      if (e.target.tagName === 'BUTTON' && [' ', 'Enter'].includes(e.key)) return;
      const key = e.key.toLowerCase();
      if (
        [
          ' ',
          'k',
          'arrowleft',
          'arrowright',
          'arrowup',
          'arrowdown',
          'f',
          'm',
          'c',
          't',
          'j',
          'l',
          'n',
          'p',
        ].includes(key)
      )
        e.preventDefault();
      if (key === ' ' || key === 'k') this.toggle();
      if (key === 'arrowleft' || key === 'j') this.seekBy(key === 'j' ? -10 : -5);
      if (key === 'arrowright' || key === 'l') this.seekBy(key === 'l' ? 10 : 5);
      if (key === 'arrowup' || key === 'arrowdown') {
        this.audio.setVolume(this.audio.volume + (key === 'arrowup' ? 0.05 : -0.05));
        this.volumeUI();
      }
      if (key === 'f') this.fullscreen();
      if (key === 'm') $('mute').click();
      if (key === 'c') $('captions-toggle').click();
      if (key === 't') $('theater').click();
      if (e.shiftKey && key === 'n') this.onNavigate(1);
      if (e.shiftKey && key === 'p') this.onNavigate(-1);
    };
    onLocaleChange(() => {
      const off = $('subtitle-language').querySelector('option[value="-1"]');
      if (off) off.textContent = t('Tắt');
      if (this.videoError !== undefined) this.renderVideoError();
      this.transcript();
    });
    $('transcript-search').oninput = () => this.transcript();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save().catch(() => {});
    });
    window.addEventListener('pagehide', () => {
      this.endScreen.hide();
      this.save().catch(() => {});
    });
  }
  renderVideoError() {
    const reasons = {
      1: t('Đã hủy tải video.'),
      2: t('Không đọc được video từ thư viện. Kiểm tra đường dẫn và quyền đọc file.'),
      3: t('Không giải mã được video. File có thể hỏng hoặc dùng codec chưa được hỗ trợ.'),
      4: t(
        'WebView không mở được định dạng video này. Cần kiểm tra định dạng thực của file, không chỉ đuôi .mp4.',
      ),
    };
    $('video-empty').textContent =
      typeof this.videoError === 'string'
        ? localizeError(this.videoError)
        : reasons[this.videoError] || t('Không mở được video.');
  }
  idle() {
    this.visibility.reveal();
  }
  volumeUI() {
    $('volume').value = this.audio.muted ? 0 : this.audio.volume;
    $('mute').textContent = this.audio.muted ? '⊘' : '♫';
  }
  replay() {
    this.endScreen.hide();
    this.video.currentTime = 0;
    this.video.play().catch((e) => this.notify(e.message));
    $('player').focus();
  }
  async leave() {
    this.generation++;
    this.endScreen.hide();
    this.video.pause();
    await this.save();
    this.source = null;
  }
  toggle() {
    if (this.video.ended) return this.replay();
    if (this.video.paused) this.video.play().catch((e) => this.notify(e.message));
    else this.video.pause();
  }
  seekBy(seconds) {
    if (!Number.isFinite(this.video.duration)) return;
    this.video.currentTime = Math.max(
      0,
      Math.min(this.video.duration, this.video.currentTime + seconds),
    );
    $('seek-feedback').textContent = `${seconds > 0 ? '+' : ''}${seconds}s`;
    $('seek-feedback').hidden = false;
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => ($('seek-feedback').hidden = true), 600);
  }
  async fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('player').requestFullscreen) await $('player').requestFullscreen();
      else if (this.video.webkitEnterFullscreen) this.video.webkitEnterFullscreen();
    } catch (e) {
      this.notify(e.message);
    }
  }
  async open(lesson, play = true) {
    const generation = ++this.generation;
    this.endScreen.hide();
    this.video.pause();
    await this.save();
    if (generation !== this.generation) return;
    this.source = null;
    this.video.pause();
    this.lesson = lesson;
    await this.captions.load();
    const settings = await invoke('load_playback_settings');
    if (generation !== this.generation) return;
    $('autoplay').checked = settings.autoplay;
    this.captions.render(null);
    this.visibility.hide();
    this.lastSave = Date.now();
    this.video.removeAttribute('src');
    this.video.querySelectorAll('track').forEach((t) => t.remove());
    this.video.load();
    $('seek').value = 0;
    this.update();
    this.urls.forEach(URL.revokeObjectURL);
    this.urls = [];
    this.sprite = null;
    this.cueTimes = new WeakMap();
    delete this.videoError;
    $('video-empty').hidden = true;
    $('preview-frame').style.backgroundImage = '';
    $('settings').hidden = true;
    $('subtitle-language').innerHTML = `<option value="-1">${t('Tắt')}</option>`;
    this.selectedTrack = -1;
    this.offset = 0;
    $('caption-offset').value = 0;
    $('transcript').replaceChildren();
    let source;
    try {
      source = await asset(lesson.video);
    } catch (error) {
      if (generation !== this.generation) return;
      this.videoError = error.message || String(error);
      this.renderVideoError();
      $('video-empty').hidden = false;
      return;
    }
    if (generation !== this.generation) return;
    this.video.src = source;
    this.source = this.video.src;
    const stem = lesson.video.replace(/\.[^.]+$/, '');
    asset(`${stem}.sprite.jpg`)
      .then((url) => {
        if (generation === this.generation) {
          this.sprite = url;
          $('preview-frame').style.backgroundImage = `url("${url}")`;
        }
      })
      .catch(() => {});
    for (const [index, track] of lesson.tracks.entries()) {
      try {
        const text = await invoke('read_subtitle', { relative: track.path });
        if (generation !== this.generation) return;
        const url = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
        this.urls.push(url);
        const node = document.createElement('track');
        node.kind = 'subtitles';
        node.srclang = track.language;
        node.label = track.label;
        node.src = url;
        node.onload = () => {
          if (generation !== this.generation) return;
          if (index === 0) this.selectTrack(0);
          node.track.oncuechange = () => this.highlightCue();
        };
        this.video.append(node);
        node.track.mode = 'hidden';
        const option = document.createElement('option');
        option.value = index;
        option.textContent = track.label;
        $('subtitle-language').append(option);
      } catch (e) {
        this.notify(t('Phụ đề {label}: {error}', { label: track.label, error: localizeError(e) }));
      }
    }
    if (play && generation === this.generation) this.video.play().catch(() => {});
  }
  selectTrack(index) {
    this.selectedTrack = index;
    for (const track of this.video.textTracks) track.mode = 'hidden';
    $('subtitle-language').value = index;
    $('captions-toggle').classList.toggle('enabled', index >= 0);
    this.captions.render(index >= 0 ? this.video.textTracks[index] : null);
    this.transcript();
  }
  transcript() {
    const track = this.video.textTracks[this.selectedTrack >= 0 ? this.selectedTrack : 0];
    const cues = [...(track?.cues || [])];
    const query = $('transcript-search').value.toLocaleLowerCase();
    $('transcript').innerHTML = cues
      .filter((c) => !query || c.text.toLocaleLowerCase().includes(query))
      .map(
        (c) =>
          `<button class="cue" data-start="${c.startTime}"><time>${time(c.startTime)}</time><span>${escapeHTML(c.text.replace(/<[^>]*>/g, ''))}</span></button>`,
      )
      .join('');
    if (!cues.length) $('transcript').textContent = t('Chưa có phụ đề cho bài học này.');
    $('transcript')
      .querySelectorAll('.cue')
      .forEach(
        (button) =>
          (button.onclick = () => {
            this.video.currentTime = Number(button.dataset.start);
          }),
      );
  }
  highlightCue() {
    this.captions.render(
      this.selectedTrack >= 0 ? this.video.textTracks[this.selectedTrack] : null,
    );
    if ($('transcript-tab').hidden) return;
    const active = this.video.textTracks[this.selectedTrack]?.activeCues?.[0];
    $('transcript')
      .querySelectorAll('.cue.active')
      .forEach((b) => b.classList.remove('active'));
    if (active)
      $('transcript').querySelector(`[data-start="${active.startTime}"]`)?.classList.add('active');
  }
  update() {
    const v = this.video;
    $('time').textContent = `${time(v.currentTime)} / ${time(v.duration)}`;
    if (v.duration) $('seek').value = (v.currentTime / v.duration) * 1000;
  }
  async save(ended = false) {
    const lesson = this.lesson;
    if (
      !lesson ||
      !this.source ||
      this.video.currentSrc !== this.source ||
      !Number.isFinite(this.video.duration)
    )
      return;
    const finished = ended || this.video.ended;
    lesson.position = finished ? 0 : this.video.currentTime;
    lesson.duration = this.video.duration;
    lesson.completed ||= finished;
    this.lastSave = Date.now();
    return this.writeProgress(lesson);
  }
  async saveNotes(lesson, notes) {
    lesson.notes = notes;
    if (
      lesson === this.lesson &&
      this.source &&
      this.video.currentSrc === this.source &&
      Number.isFinite(this.video.duration)
    )
      return this.save();
    return this.writeProgress(lesson);
  }
  async writeProgress(lesson) {
    const snapshot = {
      id: lesson.id,
      position: lesson.position,
      duration: lesson.duration,
      completed: lesson.completed,
      notes: lesson.notes,
    };
    const pending = (this.pendingSave || Promise.resolve())
      .catch(() => {})
      .then(() => invoke('save_progress', snapshot));
    this.pendingSave = pending;
    try {
      await pending;
      this.onProgress(lesson);
    } catch (e) {
      this.notify(t('Chưa lưu được tiến độ: {error}', { error: localizeError(e) }));
      throw e;
    }
  }
}

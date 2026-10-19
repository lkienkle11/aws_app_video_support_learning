import { $, time, spritePosition, escapeHTML } from '../../shared/utils.js';
import { invoke, asset } from '../../shared/api.js';
import { Captions } from './captions.js';
import { ControlsVisibility } from './controls-visibility.js';

export class Player {
  constructor({ notify, onProgress, onNavigate }) {
    this.video = $('video');
    this.notify = notify;
    this.onProgress = onProgress;
    this.onNavigate = onNavigate;
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
      $('player').classList.add('playing');
      $('play').textContent = 'Ⅱ';
    };
    v.onpause = () => {
      $('player').classList.remove('playing');
      $('play').textContent = '▶';
      this.save();
    };
    v.onloadedmetadata = () => {
      $('video-empty').hidden = true;
      if (this.lesson)
        v.currentTime = Math.min(this.lesson.position, Math.max(0, v.duration - 0.5));
      this.update();
    };
    v.ontimeupdate = () => {
      this.update();
      if (Date.now() - this.lastSave > 5000) this.save();
    };
    v.onended = async () => {
      await this.save(true);
      if ($('autoplay').checked && !v.loop) this.onNavigate(1);
    };
    v.onerror = () => {
      $('video-empty').hidden = false;
      const reasons = {
        1: 'Đã hủy tải video.',
        2: 'Không đọc được video từ thư viện. Kiểm tra đường dẫn và quyền đọc file.',
        3: 'Không giải mã được video. File có thể hỏng hoặc dùng codec chưa được hỗ trợ.',
        4: 'WebView không mở được định dạng video này. Cần kiểm tra định dạng thực của file, không chỉ đuôi .mp4.',
      };
      $('video-empty').textContent = reasons[v.error?.code] || 'Không mở được video.';
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
      v.volume = Number(e.target.value);
      v.muted = v.volume === 0;
      this.volumeUI();
    };
    $('mute').onclick = () => {
      v.muted = !v.muted;
      this.volumeUI();
    };
    $('speed').onchange = (e) => {
      v.playbackRate = Number(e.target.value);
    };
    $('loop').onchange = (e) => {
      v.loop = e.target.checked;
    };
    $('settings-toggle').onclick = () => {
      $('settings').hidden = !$('settings').hidden;
      this.idle();
    };
    $('captions-toggle').onclick = () => {
      if (!v.textTracks.length)
        return this.notify('Bài này chưa có phụ đề. Dùng “Thêm phụ đề” để nhập SRT/VTT.');
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
        else this.notify('WebView của hệ điều hành này chưa hỗ trợ hình trong hình.');
      } catch (e) {
        this.notify('Không bật được hình trong hình: ' + e.message);
      }
    };
    $('theater').onclick = () => $('watch-view').classList.toggle('theater-mode');
    $('fullscreen').onclick = () => this.fullscreen();
    $('player').onkeydown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
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
        v.volume = Math.min(1, Math.max(0, v.volume + (key === 'arrowup' ? 0.05 : -0.05)));
        this.volumeUI();
      }
      if (key === 'f') this.fullscreen();
      if (key === 'm') $('mute').click();
      if (key === 'c') $('captions-toggle').click();
      if (key === 't') $('theater').click();
      if (e.shiftKey && key === 'n') this.onNavigate(1);
      if (e.shiftKey && key === 'p') this.onNavigate(-1);
    };
    $('transcript-search').oninput = () => this.transcript();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
    window.addEventListener('pagehide', () => this.save());
  }
  idle() {
    this.visibility.reveal();
  }
  volumeUI() {
    $('volume').value = this.video.muted ? 0 : this.video.volume;
    $('mute').textContent = this.video.muted ? '⊘' : '♫';
  }
  toggle() {
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
    await this.save();
    if (generation !== this.generation) return;
    this.source = null;
    this.video.pause();
    this.lesson = lesson;
    await this.captions.load();
    if (generation !== this.generation) return;
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
    $('video-empty').hidden = true;
    $('preview-frame').style.backgroundImage = '';
    $('settings').hidden = true;
    $('subtitle-language').innerHTML = '<option value="-1">Tắt</option>';
    this.selectedTrack = -1;
    this.offset = 0;
    $('caption-offset').value = 0;
    $('transcript').replaceChildren();
    let source;
    try {
      source = await asset(lesson.video);
    } catch (error) {
      if (generation !== this.generation) return;
      $('video-empty').textContent = error.message || String(error);
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
        this.notify(`Phụ đề ${track.label}: ${e.message || e}`);
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
    if (!cues.length) $('transcript').textContent = 'Chưa có phụ đề cho bài học này.';
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
    lesson.position = this.video.currentTime;
    lesson.duration = this.video.duration;
    lesson.completed ||= ended;
    this.lastSave = Date.now();
    try {
      await invoke('save_progress', {
        id: lesson.id,
        position: lesson.position,
        duration: lesson.duration,
        completed: lesson.completed,
        notes: lesson.notes,
      });
      this.onProgress(lesson);
    } catch (e) {
      this.notify('Chưa lưu được tiến độ: ' + e);
    }
  }
}

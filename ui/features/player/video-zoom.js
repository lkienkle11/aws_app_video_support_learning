/** Transform only the picture. Captions and controls remain in viewport coordinates. */
export class VideoZoom {
  constructor(frame, video) {
    this.frame = frame;
    this.video = video;
    this.scale = 1;
    this.x = this.y = 0;
    this.configure({ zoom_touchpad: true, zoom_mouse: true });
    const doc = frame.ownerDocument;
    this.requestFrame = (callback) => {
      this.videoFrame =
        !video.paused &&
        !video.ended &&
        video.readyState >= 2 &&
        typeof video.requestVideoFrameCallback === 'function';
      return this.videoFrame
        ? video.requestVideoFrameCallback(callback)
        : doc.defaultView.requestAnimationFrame(callback);
    };
    this.cancelFrame = (id) => {
      if (this.videoFrame) video.cancelVideoFrameCallback(id);
      else doc.defaultView.cancelAnimationFrame(id);
    };
    video.addEventListener('pause', () => {
      // A paused video will not deliver the pending video-frame callback.
      if (this.pendingFrame == null) return;
      this.cancelFrame(this.pendingFrame);
      this.pendingFrame = null;
      this.lastPaint = undefined;
      this.paint();
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Control') this.control = true;
    });
    doc.addEventListener('keyup', (e) => {
      if (e.key === 'Control') this.control = false;
    });
    doc.defaultView.addEventListener('blur', () => {
      this.control = false;
      this.finish();
    });
    frame.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') this.control = e.ctrlKey;
    });
    frame.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    frame.addEventListener(
      'gesturestart',
      (e) => {
        if (!this.surface(e.target)) return;
        e.preventDefault();
        if (!this.touchpad) return;
        this.gesture = this.scale;
      },
      { passive: false },
    );
    frame.addEventListener(
      'gesturechange',
      (e) => {
        if (!this.gesture) return;
        e.preventDefault();
        this.zoom(this.gesture * e.scale, e.clientX, e.clientY);
      },
      { passive: false },
    );
    frame.addEventListener(
      'gestureend',
      (e) => {
        if (this.gesture) e.preventDefault();
        this.gesture = null;
      },
      { passive: false },
    );
    frame.addEventListener('pointerdown', (e) => this.start(e), true);
    frame.addEventListener('pointermove', (e) => this.move(e));
    frame.addEventListener('pointerup', () => this.finish());
    frame.addEventListener('pointercancel', () => this.finish());
    frame.addEventListener('lostpointercapture', () => this.finish());
    frame.addEventListener(
      'click',
      (e) => {
        if (this.suppressClick) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.suppressClick = false;
        }
      },
      true,
    );
    this.resize = new ResizeObserver(() => {
      this.viewport = null;
      this.render();
    });
    this.resize.observe(frame);
    video.addEventListener('loadedmetadata', () => this.render());
  }
  configure(settings) {
    this.touchpad = settings.zoom_touchpad;
    this.mouse = settings.zoom_mouse;
    this.gesture = null;
    this.finish();
    if (!this.touchpad && !this.mouse) this.reset();
  }
  surface(target) {
    return target === this.video || target === this.frame || target.id === 'center-play';
  }
  limits() {
    const { width: w, height: h } = (this.viewport ||= {
      width: this.frame.clientWidth,
      height: this.frame.clientHeight,
    });
    if (!w || !h) return { x: 0, y: 0 };
    const ratio = this.video.videoWidth / this.video.videoHeight || w / h;
    const width = Math.min(w, h * ratio),
      height = Math.min(h, w / ratio);
    return {
      x: Math.max(0, (width * this.scale - w) / 2),
      y: Math.max(0, (height * this.scale - h) / 2),
    };
  }
  zoom(value, clientX, clientY) {
    if (!Number.isFinite(value)) return;
    const next = Math.max(1, Math.min(4, value));
    const rect = this.frame.getBoundingClientRect();
    const px = Number.isFinite(clientX) ? clientX - rect.left - rect.width / 2 : 0;
    const py = Number.isFinite(clientY) ? clientY - rect.top - rect.height / 2 : 0;
    const factor = next / this.scale;
    this.x = px - (px - this.x) * factor;
    this.y = py - (py - this.y) * factor;
    this.scale = next;
    this.render();
  }
  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.render();
  }
  render() {
    const limit = this.limits();
    this.x = Math.max(-limit.x, Math.min(limit.x, this.x));
    this.y = Math.max(-limit.y, Math.min(limit.y, this.y));
    if (this.scale === 1) this.x = this.y = 0;
    if (!this.requestFrame) return this.paint();
    if (this.pendingFrame == null)
      this.pendingFrame = this.requestFrame((time) => this.flushFrame(time));
  }
  flushFrame(time) {
    this.pendingFrame = null;
    // Keep high-rate trackpad events from submitting more than 60 updates/sec.
    if (this.lastPaint !== undefined && time - this.lastPaint < 16) {
      this.pendingFrame = this.requestFrame((next) => this.flushFrame(next));
      return;
    }
    this.lastPaint = time;
    this.paint();
  }
  paint() {
    const transform =
      this.scale === 1 ? '' : `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    if (transform === this.lastTransform) return;
    this.lastTransform = transform;
    this.video.style.transform = transform;
    this.frame.classList.toggle('video-zoomed', this.scale > 1);
  }
  wheel(e) {
    if (!this.surface(e.target)) return;
    if (e.ctrlKey) {
      // Chromium synthesizes ctrlKey for pinch without a physical Control keydown.
      const mouse = this.control || e.deltaMode !== 0;
      e.preventDefault();
      if (mouse ? !this.mouse : !this.touchpad) return;
      if (this.gesture) return; // WebKit can also dispatch wheel during a gesture.
      const delta =
        e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.frame.clientHeight : 1);
      this.zoom(
        this.scale * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.005),
        e.clientX,
        e.clientY,
      );
    } else if (this.touchpad && this.scale > 1) {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.frame.clientHeight : 1;
      this.pan(-e.deltaX * unit, -e.deltaY * unit);
    }
  }
  start(e) {
    this.suppressClick = false;
    if (e.button !== 0 || this.scale <= 1 || !this.surface(e.target)) return;
    if (!(e.ctrlKey ? this.mouse : this.touchpad)) return;
    this.suppressClick = false;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    this.frame.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  move(e) {
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    if (!drag.moved) this.frame.classList.add('video-panning');
    drag.moved = true;
    this.pan(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  finish() {
    const drag = this.drag;
    this.drag = null;
    if (drag) {
      this.suppressClick = drag.moved;
      if (this.frame.hasPointerCapture(drag.id)) this.frame.releasePointerCapture(drag.id);
    }
    this.frame.classList.remove('video-panning');
  }
  reset() {
    this.finish();
    if (this.pendingFrame != null) this.cancelFrame(this.pendingFrame);
    this.pendingFrame = null;
    this.lastPaint = undefined;
    this.scale = 1;
    this.x = this.y = 0;
    this.paint();
  }
}

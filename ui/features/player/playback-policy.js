export function resumePosition(lesson, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const position = Math.max(0, Number(lesson.position) || 0);
  if (lesson.completed && position >= duration - 0.5) return 0;
  return Math.min(position, Math.max(0, duration - 0.5));
}

export class NextLessonCountdown {
  constructor({
    onChange,
    onNext,
    now = () => Date.now(),
    schedule = (fn, ms) => globalThis.setTimeout(fn, ms),
    unschedule = (id) => globalThis.clearTimeout(id),
  }) {
    Object.assign(this, { onChange, onNext, now, schedule, unschedule });
    this.state = 'hidden';
    this.revision = 0;
  }
  publish(seconds = 0) {
    this.onChange({ state: this.state, seconds, nextTitle: this.nextTitle });
  }
  hide() {
    this.revision++;
    this.unschedule(this.timer);
    this.state = 'hidden';
    this.publish();
  }
  show({ autoplay, nextTitle }) {
    this.hide();
    this.nextTitle = nextTitle;
    this.state = autoplay && nextTitle ? 'countdown' : 'finished';
    this.deadline = this.now() + 3000;
    this.tick(this.revision);
  }
  tick(revision) {
    if (revision !== this.revision) return;
    const seconds = Math.max(0, Math.ceil((this.deadline - this.now()) / 1000));
    if (this.state === 'countdown' && !seconds) return this.next();
    this.publish(seconds);
    if (this.state === 'countdown')
      this.timer = this.schedule(
        () => this.tick(revision),
        Math.min(1000, this.deadline - this.now()),
      );
  }
  cancel() {
    if (this.state !== 'countdown') return;
    this.unschedule(this.timer);
    this.revision++;
    this.state = 'finished';
    this.publish();
  }
  next() {
    if (this.state === 'hidden' || !this.nextTitle) return;
    this.hide();
    this.onNext();
  }
}

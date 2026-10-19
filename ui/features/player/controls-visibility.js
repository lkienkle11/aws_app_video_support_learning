/** One visibility policy for hover, keyboard and touch; no video timers. */
export class ControlsVisibility {
  constructor(frame, panel, onChange = () => {}, clock = globalThis) {
    this.frame = frame;
    this.panel = panel;
    this.onChange = onChange;
    this.clock = clock;
    this.inside = false;
    this.visible = false;
    frame.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') {
        this.inside = true;
        this.reveal();
      }
    });
    frame.addEventListener('pointermove', () => {
      if (this.inside) this.reveal();
    });
    frame.addEventListener('pointerleave', () => {
      this.inside = false;
      this.hide();
    });
    frame.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') this.reveal();
    });
    frame.addEventListener('keydown', () => this.reveal());
    this.hide();
  }
  reveal() {
    this.clock.clearTimeout(this.timer);
    this.visible = true;
    this.frame.classList.add('controls-visible');
    this.onChange(true);
    this.timer = this.clock.setTimeout(() => this.hide(), 3000);
  }
  hide() {
    this.clock.clearTimeout(this.timer);
    this.visible = false;
    this.frame.classList.remove('controls-visible');
    this.panel.hidden = true;
    this.onChange(false);
  }
}

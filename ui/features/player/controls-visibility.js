/** One visibility policy for hover, keyboard and touch; no video timers. */
export class ControlsVisibility {
  constructor(frame, panel, onChange = () => {}, clock = globalThis) {
    this.frame = frame;
    this.panel = panel;
    this.onChange = onChange;
    this.clock = clock;
    this.inside = false;
    this.visible = false;
    this.editingColor = false;
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
      this.hideUnlessEditing();
    });
    frame.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') this.reveal();
    });
    frame.addEventListener('focusin', (event) => {
      if (event.target.type === 'color') {
        this.editingColor = true;
        this.reveal();
      }
    });
    const finishColorEdit = (event) => {
      if (event.target.type !== 'color') return;
      this.editingColor = false;
      if (this.inside) this.reveal();
      else this.hide();
    };
    frame.addEventListener('focusout', finishColorEdit);
    frame.addEventListener('change', finishColorEdit);
    frame.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.editingColor = false;
      this.reveal();
    });
    frame.ownerDocument?.addEventListener('pointerdown', (event) => {
      if (this.editingColor && event.target.type !== 'color') {
        this.editingColor = false;
        if (!frame.contains(event.target)) this.hide();
        else this.reveal();
      }
    });
    this.hide();
  }
  reveal() {
    this.clock.clearTimeout(this.timer);
    this.visible = true;
    this.frame.classList.add('controls-visible');
    this.onChange(true);
    this.timer = this.clock.setTimeout(() => this.hideUnlessEditing(), 3000);
  }
  hideUnlessEditing() {
    if (!this.editingColor) this.hide();
  }
  hide() {
    this.editingColor = false;
    this.clock.clearTimeout(this.timer);
    this.visible = false;
    this.frame.classList.remove('controls-visible');
    this.panel.hidden = true;
    this.onChange(false);
  }
}

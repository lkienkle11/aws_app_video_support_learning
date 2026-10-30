/** Scroll only the transcript viewport; manual scrolling away pauses following. */
export class TranscriptFollow {
  constructor(list, button) {
    this.list = list;
    this.button = button;
    this.reset();
    button.onclick = () => this.sync();
    list.addEventListener('scroll', () => {
      if (this.expectedTop != null && Math.abs(list.scrollTop - this.expectedTop) < 1) return;
      this.expectedTop = null;
      if (!this.active) return;
      this.following = this.visible();
      this.updateButton();
    });
    this.resize = new ResizeObserver(() => {
      if (this.following) this.reveal();
    });
    this.resize.observe(list);
  }
  reset() {
    this.active = null;
    this.following = true;
    this.expectedTop = null;
    this.button.hidden = true;
  }
  visible() {
    if (!this.active || !this.list.clientHeight) return false;
    const viewport = this.list.getBoundingClientRect();
    const row = this.active.getBoundingClientRect();
    return row.top >= viewport.top - 1 && row.bottom <= viewport.top + this.list.clientHeight + 1;
  }
  setActive(active) {
    this.active = active;
    if (!this.following && this.visible()) this.following = true;
    if (this.following) this.reveal();
    this.updateButton();
  }
  updateButton() {
    this.button.hidden = !this.active || this.following;
  }
  reveal() {
    if (!this.active || !this.list.clientHeight || this.visible()) return;
    const viewport = this.list.getBoundingClientRect();
    const row = this.active.getBoundingClientRect();
    const top =
      this.list.scrollTop + row.top - viewport.top - (this.list.clientHeight - row.height) / 2;
    this.expectedTop = Math.max(0, Math.min(this.list.scrollHeight - this.list.clientHeight, top));
    this.list.scrollTop = this.expectedTop;
  }
  sync() {
    this.following = true;
    this.reveal();
    this.updateButton();
  }
}

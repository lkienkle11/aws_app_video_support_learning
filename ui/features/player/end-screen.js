import { $ } from '../../shared/utils.js';
import { NextLessonCountdown } from './playback-policy.js';

export class EndScreen extends NextLessonCountdown {
  constructor({ onNext, onReplay }) {
    super({
      onNext,
      onChange: ({ state, seconds, nextTitle }) => {
        $('end-screen').hidden = state === 'hidden';
        $('end-status').textContent =
          state === 'countdown' ? `Bài tiếp theo sau ${seconds} giây` : 'Đã xem hết bài học';
        $('end-title').textContent = nextTitle || 'Bạn đã đến cuối danh sách bài học.';
        $('end-next').hidden = !nextTitle;
        $('end-cancel').hidden = state !== 'countdown';
        $('end-replay').hidden = state !== 'finished';
      },
    });
    $('end-next').onclick = () => this.next();
    $('end-cancel').onclick = () => {
      this.cancel();
      $('end-replay').focus();
    };
    $('end-replay').onclick = () => {
      this.hide();
      onReplay();
    };
  }
}

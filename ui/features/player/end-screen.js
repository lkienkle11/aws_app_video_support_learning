import { t, onLocaleChange } from '../../shared/i18n.js';
import { $ } from '../../shared/utils.js';
import { NextLessonCountdown } from './playback-policy.js';

export class EndScreen extends NextLessonCountdown {
  constructor({ onNext, onReplay }) {
    super({
      onNext,
      onChange: ({ state, seconds, nextTitle }) => {
        $('end-screen').hidden = state === 'hidden';
        $('end-status').textContent =
          state === 'countdown'
            ? t('Bài tiếp theo sau {seconds} giây', { seconds })
            : t('Đã xem hết bài học');
        $('end-title').textContent = nextTitle || t('Bạn đã đến cuối danh sách bài học.');
        $('end-next').hidden = !nextTitle;
        $('end-cancel').hidden = state !== 'countdown';
        $('end-replay').hidden = state !== 'finished';
      },
    });
    onLocaleChange(() =>
      this.publish(
        this.state === 'countdown'
          ? Math.max(0, Math.ceil((this.deadline - this.now()) / 1000))
          : 0,
      ),
    );
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

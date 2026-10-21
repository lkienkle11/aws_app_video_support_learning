import { Captions } from '/features/player/captions.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  const frame = document.getElementById('player');
  const video = document.getElementById('video');
  const box = document.getElementById('caption-overlay');
  document.body.append(frame);
  Object.assign(frame.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '640px',
    height: '360px',
  });
  const captions = new Captions((error) => {
    throw new Error(error);
  });
  captions.apply();
  video.src = 'asset://localhost/video.mp4';
  await new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('video metadata failed')), {
      once: true,
    });
  });
  const track = video.addTextTrack('subtitles', 'English', 'en');
  track.mode = 'hidden';
  track.addCue(
    new VTTCue(0, 1000, 'that could be underpinning successful platform transformations.'),
  );
  video.currentTime = 1;
  await new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
  captions.render(track);
  check(
    !box.hidden && box.textContent.includes('transformations.'),
    'actual text track must render',
  );
  const samples = [];
  for (const size of [12, 24, 48, 96]) {
    captions.settings.size = size;
    captions.apply();
    // Range endpoints snap to CSS pixels; allow two pixels across both edges.
    const glyph = document.createRange();
    glyph.setStart(box.firstChild, 0);
    glyph.setEnd(box.firstChild, 4);
    const baseline = glyph.getBoundingClientRect();
    for (const [mode, width, height] of [
      ['inline', 640, 360],
      ['theater', 1280, 720],
      ['fullscreen-shape', 1440, 900],
      ['wide-letterbox', 1440, 480],
      ['mobile', 296, 166.5],
      ['return-inline', 640, 360],
    ]) {
      Object.assign(frame.style, { width: `${width}px`, height: `${height}px` });
      // Let production resize handling run before measuring actual glyphs.
      await wait(80);
      const pictureWidth = Math.min(
        frame.clientWidth,
        (frame.clientHeight * video.videoWidth) / video.videoHeight,
      );
      const font = parseFloat(getComputedStyle(box).fontSize);
      check(font === size, `${mode}: font changed from ${size} to ${font}`);
      const glyphBounds = glyph.getBoundingClientRect();
      check(
        Math.abs(glyphBounds.width - baseline.width) <= 2,
        `${mode} at ${size}px: glyph width changed from ${baseline.width} to ${glyphBounds.width}`,
      );
      check(Math.abs(glyphBounds.height - baseline.height) <= 2, `${mode}: glyph height changed`);
      check(captions.settings.size === size, `${mode}: resize mutated the saved preference`);
      check(
        Number(document.getElementById('caption-size').value) === size,
        `${mode}: input changed`,
      );
      const bounds = box.getBoundingClientRect();
      const area = frame.getBoundingClientRect();
      check(
        bounds.left >= area.left - 1 && bounds.right <= area.right + 1,
        `${mode}: caption overflows`,
      );
      captions.controlsVisible = true;
      captions.layout();
      const seekTop = document.querySelector('.seek-row').getBoundingClientRect().top;
      const captionBottom = box.getBoundingClientRect().bottom;
      check(Math.abs(seekTop - captionBottom - 10) < 1, 'control clearance changed');
      captions.controlsVisible = false;
      captions.layout();
      check(
        Math.abs(frame.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom - 10) <
          1,
        'hidden controls must leave the same 10px gap',
      );
      samples.push({
        size,
        mode,
        font,
        glyphWidth: glyphBounds.width,
        glyphHeight: glyphBounds.height,
        pictureWidth,
        lines: Math.round(box.clientHeight / parseFloat(getComputedStyle(box).lineHeight)),
      });
    }
  }
  // Media aspect changes must not change the selected font size either.
  Object.assign(frame.style, { width: '1440px', height: '480px' });
  await wait(80);
  Object.defineProperties(video, { videoWidth: { value: 1080 }, videoHeight: { value: 1920 } });
  video.dispatchEvent(new Event('loadedmetadata'));
  check(parseFloat(getComputedStyle(box).fontSize) === 96, 'portrait metadata changed font size');
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({ passed: true, engine: navigator.userAgent, samples }),
  );
} catch (error) {
  window.webkit.messageHandlers.result.postMessage(
    JSON.stringify({ passed: false, error: String(error), stack: error.stack }),
  );
}

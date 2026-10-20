export const defaultCaptionSettings = {
  size: 24,
  x: 0.5,
  y: 0,
  color: '#ffffff',
  background: '#000000',
  opacity: 1,
  background_opacity: 1,
};

/** Separate alpha channels: changing the text must never fade the background. */
export function captionColors(settings) {
  const rgba = (hex, alpha) => {
    const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
    return `rgba(${rgb.join(',')},${alpha})`;
  };
  return {
    color: rgba(settings.color, settings.opacity),
    background: rgba(settings.background, settings.background_opacity),
  };
}

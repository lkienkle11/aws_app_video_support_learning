export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/** y is normalized within the usable region ABOVE the control bar. */
export function captionGeometry({
  width,
  height,
  boxWidth,
  boxHeight,
  controlsHeight,
  visible,
  x,
  y,
}) {
  const half = Math.min(boxWidth, Math.max(0, width - 16)) / 2;
  const base = visible ? controlsHeight + 10 : 10;
  const maximum = Math.max(base, height - boxHeight - 8);
  return {
    left: clamp(x * width, half + 8, Math.max(half + 8, width - half - 8)),
    bottom: base + clamp(y, 0, 1) * (maximum - base),
    base,
    span: maximum - base,
  };
}

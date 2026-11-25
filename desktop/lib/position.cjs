// Keep the bubble on a screen: a saved position from a monitor that is no longer attached falls back to the default.
function clampToDisplays(pos, displays, size) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
  const ok = displays.some(({ workArea: w }) => pos.x >= w.x && pos.y >= w.y && pos.x + size <= w.x + w.width && pos.y + size <= w.y + w.height);
  return ok ? { x: Math.round(pos.x), y: Math.round(pos.y) } : null;
}
module.exports = { clampToDisplays };

// Trial-build flag. The trial installer is built with `npm run dist:trial`
// (cross-env VITE_TRIAL=1); the regular build leaves this false and is
// completely unaffected — all trial limitations live behind this constant.
export const TRIAL = import.meta.env.VITE_TRIAL === '1';

export const BOOSTY_URL = 'https://boosty.to/no.harm.org';

// In the trial build the user may keep at most one tile set of their own
// (the bundled starter pack does not count).
export const TRIAL_MAX_USER_TILESETS = 1;

/**
 * Draw the trial watermark onto a canvas 2D context (bottom-right corner).
 * Font size scales with map width; white fill + dark stroke keeps it
 * readable on any background.
 */
export function drawTrialWatermark(ctx, width, height) {
  const text = '☮ no harm org · пробная версия';
  const fontSize = Math.max(14, Math.round(width * 0.022));
  const pad = Math.round(fontSize * 0.8);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, fontSize / 8);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.strokeText(text, width - pad, height - pad);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, width - pad, height - pad);
  ctx.restore();
}

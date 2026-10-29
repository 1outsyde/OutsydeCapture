/**
 * Crop geometry for the Instagram-style crop box (photo ratios build, step 2a).
 *
 * The photo is drawn centered behind a fixed box, scaled by `scale` (pixels on screen per image pixel)
 * and moved by `tx` / `ty` (screen points, relative to the centered position). The photo must always
 * cover the whole box, so the smallest allowed scale is the "cover" scale and the move is clamped so
 * no edge of the photo enters the box.
 *
 * Pure functions only: no React, no native modules, so they are unit tested in cropMath.test.ts.
 */

export type Size = { width: number; height: number };

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/** Upper limit for zooming in, as a multiple of the cover scale. */
export const MAX_ZOOM = 5;

/** Scale at which the photo exactly covers the box (one side fits, the other overflows). */
export function coverScale(image: Size, box: Size): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  return Math.max(box.width / image.width, box.height / image.height);
}

/** Keeps a zoom factor between 1 (cover) and MAX_ZOOM. */
export function clampZoom(zoom: number): number {
  "worklet";
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

/** Largest move (each direction) that still keeps the photo covering the box at this scale. */
export function maxOffset(
  image: Size,
  box: Size,
  scale: number,
): { x: number; y: number } {
  "worklet";
  return {
    x: Math.max(0, (image.width * scale - box.width) / 2),
    y: Math.max(0, (image.height * scale - box.height) / 2),
  };
}

/** Clamps a move so the photo keeps covering the box. */
export function clampOffset(
  tx: number,
  ty: number,
  image: Size,
  box: Size,
  scale: number,
): { tx: number; ty: number } {
  "worklet";
  const m = maxOffset(image, box, scale);
  return {
    tx: Math.min(m.x, Math.max(-m.x, tx)),
    ty: Math.min(m.y, Math.max(-m.y, ty)),
  };
}

/**
 * The part of the original photo that is inside the box, in image pixels.
 * Whole pixels, always inside the photo, and the same shape as the box (within 1 pixel).
 */
export function cropRectFor(
  image: Size,
  box: Size,
  scale: number,
  tx: number,
  ty: number,
): CropRect {
  const c = clampOffset(tx, ty, image, box, scale);
  // Top-left of the photo in box coordinates.
  const left = box.width / 2 + c.tx - (image.width * scale) / 2;
  const top = box.height / 2 + c.ty - (image.height * scale) / 2;
  let width = Math.round(box.width / scale);
  let height = Math.round(box.height / scale);
  width = Math.max(1, Math.min(image.width, width));
  height = Math.max(1, Math.min(image.height, height));
  let originX = Math.round(-left / scale);
  let originY = Math.round(-top / scale);
  originX = Math.max(0, Math.min(image.width - width, originX));
  originY = Math.max(0, Math.min(image.height - height, originY));
  return { originX, originY, width, height };
}

/** Smallest whole-number pair for a ratio (4/5 -> [4, 5], 16/9 -> [16, 9]); null if none up to 50. */
export function ratioPair(aspect: number): [number, number] | null {
  for (let h = 1; h <= 50; h++) {
    const w = Math.round(aspect * h);
    if (w > 0 && Math.abs(w / h - aspect) < 1e-6) return [w, h];
  }
  return null;
}

/**
 * Final saved size for a crop: never larger than the cropped pixels (no upscaling), long side at
 * most `maxLong` (1920 for wide shapes, 1350 for tall, 1080 for square), exact ratio when the ratio
 * is a simple fraction (4:5 -> 1080x1350, 16:9 -> 1920x1080). Whole pixels, at least 1.
 */
export function outputSizeFor(crop: Size, aspect: number): Size {
  const maxLong = aspect > 1.01 ? 1920 : aspect < 0.99 ? 1350 : 1080;
  const k = Math.min(1, maxLong / Math.max(crop.width, crop.height));
  const maxW = crop.width * k;
  const maxH = crop.height * k;
  const pair = ratioPair(aspect);
  if (pair) {
    const unit = Math.max(
      1,
      // Half a pixel of slack so a crop that is a hair short (2419 for 2419.2) still saves 1080 wide.
      Math.floor(Math.min((maxW + 0.5) / pair[0], (maxH + 0.5) / pair[1])),
    );
    return { width: unit * pair[0], height: unit * pair[1] };
  }
  const height = Math.max(1, Math.floor(Math.min(maxH, maxW / aspect)));
  return { width: Math.max(1, Math.round(height * aspect)), height };
}

/** The box on screen: as wide as allowed, shrunk if it would be taller than maxHeight. */
export function boxSizeFor(
  aspect: number,
  maxWidth: number,
  maxHeight: number,
): Size {
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  return { width: Math.floor(width), height: Math.floor(height) };
}

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

// ── Step 2b: post shapes, start positions and the camera frame ───────────────

/** A crop as fractions (0 to 1) of the photo, so it survives the photo being resized. */
export type FracRect = { x: number; y: number; w: number; h: number };

/** Post shapes run from 4:5 (tall) to 1.91:1 (wide), like Instagram. */
export const POST_MIN_ASPECT = 4 / 5;
export const POST_MAX_ASPECT = 1.91;

/** The photo's own shape, held inside the allowed post range. */
export function clampAspect(
  aspect: number,
  min = POST_MIN_ASPECT,
  max = POST_MAX_ASPECT,
): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return min;
  return Math.min(max, Math.max(min, aspect));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The biggest centered crop of this shape. */
export function centerRectFraction(image: Size, aspect: number): FracRect {
  const imgAspect = image.width / image.height;
  if (imgAspect > aspect) {
    const w = aspect / imgAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imgAspect / aspect;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** A pixel crop as fractions of the photo. */
export function rectFractionOf(rect: CropRect, image: Size): FracRect {
  return {
    x: rect.originX / image.width,
    y: rect.originY / image.height,
    w: rect.width / image.width,
    h: rect.height / image.height,
  };
}

/** A fraction crop as whole pixels inside the photo. */
export function rectFromFraction(frac: FracRect, image: Size): CropRect {
  let width = Math.max(
    1,
    Math.min(image.width, Math.round(frac.w * image.width)),
  );
  let height = Math.max(
    1,
    Math.min(image.height, Math.round(frac.h * image.height)),
  );
  const originX = Math.max(
    0,
    Math.min(image.width - width, Math.round(frac.x * image.width)),
  );
  const originY = Math.max(
    0,
    Math.min(image.height - height, Math.round(frac.y * image.height)),
  );
  return { originX, originY, width, height };
}

/**
 * Zoom (times the cover scale) and move that show this crop in the box: used to reopen a photo
 * where it was left, and to line the crop screen up with the camera frame.
 */
export function viewForFraction(
  image: Size,
  box: Size,
  frac: FracRect,
): { zoom: number; tx: number; ty: number } {
  const cover = coverScale(image, box);
  const wanted = box.width / Math.max(1e-6, frac.w * image.width);
  const zoom = clampZoom(wanted / cover);
  const s = cover * zoom;
  const cx = (frac.x + frac.w / 2) * image.width * s; // crop center, from the photo's left edge
  const cy = (frac.y + frac.h / 2) * image.height * s;
  const c = clampOffset(
    (image.width * s) / 2 - cx,
    (image.height * s) / 2 - cy,
    image,
    box,
    s,
  );
  return { zoom, tx: c.tx, ty: c.ty };
}

/**
 * Photo size turned to match the screen's orientation. Camera photos can report sensor (landscape)
 * sizes; the saved file is shown upright, so a tall preview means a tall photo.
 */
export function uprightSize(photo: Size, area: Size): Size {
  const photoTall = photo.height >= photo.width;
  const areaTall = area.height >= area.width;
  return photoTall === areaTall
    ? photo
    : { width: photo.height, height: photo.width };
}

/**
 * The part of a camera photo inside an on-screen frame. The preview fills its area (cover), so the
 * photo is scaled to cover the area and centered; the frame is in area points.
 */
export function cameraFrameFraction(
  photo: Size,
  area: Size,
  frame: { left: number; top: number; width: number; height: number },
): FracRect {
  const p = uprightSize(photo, area);
  const s = Math.max(area.width / p.width, area.height / p.height);
  const offX = (area.width - p.width * s) / 2;
  const offY = (area.height - p.height * s) / 2;
  const x = clamp01((frame.left - offX) / s / p.width);
  const y = clamp01((frame.top - offY) / s / p.height);
  const w = Math.min(1 - x, frame.width / s / p.width);
  const h = Math.min(1 - y, frame.height / s / p.height);
  return { x, y, w, h };
}

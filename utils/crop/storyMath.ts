/**
 * Geometry for Instagram-style photo stories (photo ratios build, step 2e).
 *
 * Same model as cropMath.ts: the photo is drawn centered behind a 9:16 box, at
 * `cover scale × zoom`, moved by `tx` / `ty` screen points. The difference is that a story may
 * zoom OUT below cover, down to the size where the whole photo fits ("contain"). Wherever the
 * photo doesn't reach, a blurred copy of the same photo shows behind it.
 *
 * Moving: on an axis where the photo is bigger than the box, it keeps covering the box (as in
 * cropMath). On an axis where it is smaller, it stays fully inside the box, so no part of the
 * photo is ever cut off while zoomed out.
 *
 * cropMath.ts is shared by every other uploader and is NOT changed by this file.
 * Pure functions only, unit tested in storyMath.test.ts.
 */
import { MAX_ZOOM, coverScale, type Size } from "./cropMath";

/** Stories are 9:16, like Instagram and TikTok. */
export const STORY_ASPECT = 9 / 16;

/** Every photo story is saved at exactly this size. */
export const STORY_OUTPUT: Size = { width: 1080, height: 1920 };

/** Within this much of 1 (cover), a zoom snaps to exactly 1 when the fingers lift. */
export const STORY_SNAP = 0.04;

/** Zoom (relative to cover) at which the whole photo fits inside the box. At most 1. */
export function storyMinZoom(image: Size, box: Size): number {
  "worklet";
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    box.width <= 0 ||
    box.height <= 0
  )
    return 1;
  const contain = Math.min(box.width / image.width, box.height / image.height);
  const cover = Math.max(box.width / image.width, box.height / image.height);
  return Math.min(1, contain / cover);
}

/** Keeps a story zoom between the whole-photo zoom and MAX_ZOOM. */
export function clampStoryZoom(zoom: number, minZoom: number): number {
  "worklet";
  const lo = Math.min(1, Math.max(0, minZoom));
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(lo, zoom));
}

/** Snaps a zoom that ended very close to cover onto exactly cover. */
export function snapStoryZoom(zoom: number): number {
  "worklet";
  return Math.abs(zoom - 1) < STORY_SNAP ? 1 : zoom;
}

/** True when the photo covers the whole box (no blurred copy visible). */
export function storyCovers(zoom: number): boolean {
  "worklet";
  return zoom >= 1 - 1e-6;
}

function clampAxis(t: number, shown: number, box: number): number {
  "worklet";
  const room = Math.abs(shown - box) / 2;
  return Math.min(room, Math.max(-room, t));
}

/**
 * Clamps a move. `scale` is screen points per image pixel (cover scale × zoom).
 * Bigger than the box on an axis: keeps covering it. Smaller: stays inside it.
 */
export function clampStoryOffset(
  tx: number,
  ty: number,
  image: Size,
  box: Size,
  scale: number,
): { tx: number; ty: number } {
  "worklet";
  return {
    tx: clampAxis(tx, image.width * scale, box.width),
    ty: clampAxis(ty, image.height * scale, box.height),
  };
}

/** Where the photo sits inside the box, in box points (top left corner and size). */
export function storyPhotoFrame(
  image: Size,
  box: Size,
  zoom: number,
  tx: number,
  ty: number,
): { left: number; top: number; width: number; height: number } {
  const s = coverScale(image, box) * zoom;
  const width = image.width * s;
  const height = image.height * s;
  return {
    left: box.width / 2 + tx - width / 2,
    top: box.height / 2 + ty - height / 2,
    width,
    height,
  };
}

/** The same frame scaled from the on-screen box to another size (the saved picture). */
export function scaleFrame(
  frame: { left: number; top: number; width: number; height: number },
  box: Size,
  to: Size,
): { left: number; top: number; width: number; height: number } {
  const k = to.width / box.width;
  return {
    left: frame.left * k,
    top: frame.top * k,
    width: frame.width * k,
    height: frame.height * k,
  };
}

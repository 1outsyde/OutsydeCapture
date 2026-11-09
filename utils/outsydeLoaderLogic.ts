// Outsyde branded loader: geometry, timing and colours for the gold spray Y
// reveal (components/OutsydeLoader.tsx). Pure TS so it can be unit tested.
//
// The reveal copies the approved web preview: three spray strokes paint the
// logo in order, then two drips run down, the full logo settles in, and the
// whole mark fades out before the loop restarts. Coordinates are in the
// logo PNG's own 586 x 586 space (assets/images/outsyde-y-logo.png).
import { Colors } from "@/constants/theme";

export const LOGO_PX = 586;
export const LOOP_MS = 2300;

export type LoaderSize = "screen" | "section" | "button";
export type LoaderTone = "theme" | "emerald";

/** Rendered logo size in points for each loader size. */
export const LOADER_SIZES: Record<LoaderSize, number> = {
  screen: 176,
  section: 96,
  button: 20,
};

/** Below this size the spray strokes are not legible: pulse instead. */
export const MIN_SPRAY_SIZE = 64;

export type Stroke = { x0: number; y0: number; x1: number; y1: number; w: number; from: number; to: number };
export type Drip = { x: number; y: number; w: number; h: number; from: number; to: number };

// from/to are fractions of LOOP_MS (preview: 0-400, 400-950, 950-1200 ms of 2300).
export const STROKES: Stroke[] = [
  { x0: 120, y0: 178, x1: 285, y1: 285, w: 95, from: 0, to: 400 / LOOP_MS },
  { x0: 505, y0: 48, x1: 215, y1: 465, w: 125, from: 400 / LOOP_MS, to: 950 / LOOP_MS },
  { x0: 185, y0: 482, x1: 335, y1: 478, w: 70, from: 950 / LOOP_MS, to: 1200 / LOOP_MS },
];

// Preview: drip 1 1200-1500 ms (88 tall), drip 2 1250-1550 ms (60 tall).
export const DRIPS: Drip[] = [
  { x: 205, y: 498, w: 32, h: 88, from: 1200 / LOOP_MS, to: 1500 / LOOP_MS },
  { x: 238, y: 498, w: 32, h: 60, from: 1250 / LOOP_MS, to: 1550 / LOOP_MS },
];

/** Full logo (splatter specks included) settles in after the drips. */
export const SETTLE = { from: 1500 / LOOP_MS, to: 1650 / LOOP_MS };
/** Whole mark fades out at the end of each loop (preview: 2000-2300 ms). */
export const FADE_OUT = { from: 2000 / LOOP_MS, to: 1 };

/** 0..1 progress of a segment at loop position t (0..1). */
export function phase(t: number, from: number, to: number): number {
  "worklet";
  if (to <= from) return t >= to ? 1 : 0;
  const p = (t - from) / (to - from);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** Same ease in out as the preview. */
export function easeInOut(x: number): number {
  "worklet";
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Cold launch overlay (components/LaunchOverlay.tsx): the spray plays once,
// until the full logo has settled, then fades into the app. If the app is not
// ready yet it keeps looping; a hard cap stops it from ever blocking the app.
export const LAUNCH_MIN_MS = Math.round(SETTLE.to * LOOP_MS);
export const LAUNCH_MIN_REDUCED_MS = 400;
export const LAUNCH_MAX_MS = 8000;
export const LAUNCH_FADE_MS = 300;

/** Should the launch overlay start fading out now? */
export function launchShouldHide(ready: boolean, elapsedMs: number, reducedMotion: boolean): boolean {
  if (elapsedMs >= LAUNCH_MAX_MS) return true;
  const min = reducedMotion ? LAUNCH_MIN_REDUCED_MS : LAUNCH_MIN_MS;
  return ready && elapsedMs >= min;
}

export type StrokeRect = {
  left: number;
  top: number;
  length: number;
  height: number;
  angleDeg: number;
  /** Image offset inside the clip so the logo lines up with its natural spot. */
  imageLeft: number;
  imageTop: number;
  /** Pivot of the image's counter rotation, in the image's own coordinates. */
  pivotX: number;
  pivotY: number;
};

/**
 * A stroke becomes a rotated clipping box that grows along the stroke. The
 * box is lengthened by half its width at both ends so the stroke ends are
 * covered like the round caps in the preview. The logo inside is counter
 * rotated about the same pivot, so on screen it sits exactly where it would
 * without any clipping.
 */
export function strokeRect(s: Stroke, scale: number): StrokeRect {
  const dx = s.x1 - s.x0;
  const dy = s.y1 - s.y0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const half = s.w / 2;
  const xs = s.x0 - ux * half;
  const ys = s.y0 - uy * half;
  const left = xs * scale;
  const top = (ys - half) * scale;
  return {
    left,
    top,
    length: (len + s.w) * scale,
    height: s.w * scale,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    imageLeft: -left,
    imageTop: -top,
    pivotX: xs * scale,
    pivotY: ys * scale,
  };
}

export type LoaderColors = { background: string; text: string };

/** Brand black for dark mode loaders (Street Luxe black, not pitch black). */
export const LOADER_BLACK = "#171717";
/** Logo gold on emerald, as in the approved preview. */
export const LOADER_GOLD_ON_EMERALD = "#D4A93C";

/**
 * Light: cream with the darker gold so the status line passes 4.5:1.
 * Dark: brand black with the bright gold. Emerald: splash and launch.
 */
export function loaderColors(scheme: "light" | "dark", tone: LoaderTone): LoaderColors {
  if (tone === "emerald") {
    return { background: Colors.light.brandPrimary, text: LOADER_GOLD_ON_EMERALD };
  }
  if (scheme === "dark") {
    return { background: LOADER_BLACK, text: Colors.dark.brandGold };
  }
  return { background: Colors.light.brandBg, text: Colors.light.brandGoldDim };
}

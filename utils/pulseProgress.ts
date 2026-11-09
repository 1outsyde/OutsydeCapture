/**
 * Pulse progress bar math (Pulse length step C1). Pure, unit tested in pulseProgress.test.ts.
 */

/** Videos longer than this (seconds) get the progress bar, like TikTok. Shorter ones stay as they are. */
export const PROGRESS_MIN_SECONDS = 60;

export function shouldShowProgress(
  durationSeconds: number | null | undefined,
): boolean {
  return (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > PROGRESS_MIN_SECONDS
  );
}

/** How far along (0 to 1). */
export function progressFraction(current: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(current)) return 0;
  return Math.min(1, Math.max(0, current / duration));
}

/** The time under a finger at `x` points along a bar `width` points wide. */
export function timeAtX(x: number, width: number, duration: number): number {
  if (!(width > 0) || !(duration > 0)) return 0;
  return progressFraction((x / width) * duration, duration) * duration;
}

/** Clock text: 0:07, 3:48, 10:02, 1:02:05. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

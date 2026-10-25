/** Discover tab row. Pure (no React) so the order and swipe rule are testable. */
export type FeedMode = "events" | "following" | "pro" | "pulse";

/** Order on screen and for swiping: EVENTS · FOLLOWING · PRO · PULSE. Discover opens on PRO. */
export const FEED_MODES: ReadonlyArray<{ mode: FeedMode; label: string }> = [
  { mode: "events", label: "EVENTS" },
  { mode: "following", label: "FOLLOWING" },
  { mode: "pro", label: "PRO" },
  { mode: "pulse", label: "PULSE" },
];

/** The mode one swipe away: "left" moves right along the row, "right" moves back. Clamped at both ends. */
export function nextFeedMode(current: FeedMode, direction: "left" | "right"): FeedMode {
  const i = FEED_MODES.findIndex((x) => x.mode === current);
  const j = Math.max(0, Math.min(FEED_MODES.length - 1, i + (direction === "left" ? 1 : -1)));
  return FEED_MODES[j].mode;
}

// How long a paused image story still has to run when it resumes:
// the part of its duration not yet played. Progress is 0..1.
export function remainingStoryMs(totalMs: number, progress: number): number {
  const played = Math.min(1, Math.max(0, progress));
  return Math.max(0, totalMs * (1 - played));
}

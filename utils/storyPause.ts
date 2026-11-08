// How long a paused image story still has to run when it resumes:
// the part of its duration not yet played. Progress is 0..1.
export function remainingStoryMs(totalMs: number, progress: number): number {
  const played = Math.min(1, Math.max(0, progress));
  return Math.max(0, totalMs * (1 - played));
}

// Where a story's progress starts when its timer (re)starts. A new story
// always starts from 0: the bar's live value may still belong to the
// previous story (a JS write to a shared value reaches the UI thread later).
export function resumeProgress(
  isNewStory: boolean,
  currentProgress: number,
): number {
  return isNewStory ? 0 : currentProgress;
}

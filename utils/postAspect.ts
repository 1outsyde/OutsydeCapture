/**
 * A post's shape for its card (photo ratios step 2c): width / height, held between 4:5 and 1.91:1.
 *
 * Post routes send the size in different places, so this reads all of them, in order:
 *   1. photo 1 of a multi-photo post (`mediaItems[0]`), since the whole carousel uses its shape
 *   2. `aspectRatio`, else `mediaWidth` / `mediaHeight` (the post row: /api/feed, /api/feed/:id,
 *      /api/profiles/:id/posts, saved posts)
 *   3. `media.aspectRatio`, else `media.width` / `media.height` (/api/feed, /api/users/:id/posts)
 * No usable size gives 4:5.
 */
import { clampAspect, POST_MIN_ASPECT } from "./crop/cropMath";

type SizeLike = {
  aspectRatio?: number | null;
  width?: number | null;
  height?: number | null;
};

export type PostAspectSource = {
  mediaItems?: SizeLike[] | null;
  aspectRatio?: number | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  media?: SizeLike | null;
};

export const DEFAULT_POST_ASPECT = POST_MIN_ASPECT;

const usable = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

function ratioOf(
  aspect: unknown,
  width: unknown,
  height: unknown,
): number | null {
  if (usable(aspect)) return aspect;
  if (usable(width) && usable(height)) return width / height;
  return null;
}

export function postAspect(post: PostAspectSource | null | undefined): number {
  if (!post) return DEFAULT_POST_ASPECT;
  const items = Array.isArray(post.mediaItems) ? post.mediaItems : [];
  const first = items.length > 1 ? items[0] : null;
  const raw =
    (first ? ratioOf(first.aspectRatio, first.width, first.height) : null) ??
    ratioOf(post.aspectRatio, post.mediaWidth, post.mediaHeight) ??
    (post.media
      ? ratioOf(post.media.aspectRatio, post.media.width, post.media.height)
      : null);
  return raw === null ? DEFAULT_POST_ASPECT : clampAspect(raw);
}

/** Card photo height for a shape at this width, in whole points. */
export function postMediaHeight(width: number, aspect: number): number {
  return Math.round(width / clampAspect(aspect));
}

/**
 * Fill or Fit for Pulse videos and video stories (photo ratios step 2d), TikTok style.
 *   fill: the video is zoomed to fill the whole 9:16 screen (edges may be cut). Today's look.
 *   fit:  the whole video is shown, over a blurred copy of it.
 * The backend saves `videoFit` for videos only (#381); old posts have none, which means fill.
 */
export type VideoFit = "fill" | "fit";

/** Anything other than "fit" is fill, so every old post and story looks as it does today. */
export function normalizeVideoFit(value: unknown): VideoFit {
  return value === "fit" ? "fit" : "fill";
}

/** Same, for API values: keeps "fill" / "fit", drops anything else. */
export function apiVideoFit(value: unknown): VideoFit | undefined {
  return value === "fill" || value === "fit" ? value : undefined;
}

/**
 * The choice picked first on upload: fill for tall videos (and when the size is unknown, as with
 * camera recordings), fit for wide or square ones, so nothing important is cut by default.
 */
export function defaultVideoFit(
  width?: number | null,
  height?: number | null,
): VideoFit {
  if (!width || !height || width <= 0 || height <= 0) return "fill";
  return height / width >= 1.2 ? "fill" : "fit";
}

const isImageUrl = (u: string) =>
  /^https?:\/\//i.test(u) &&
  !/\.m3u8(\?|$)/i.test(u) &&
  !/\.mp4(\?|$)/i.test(u);

/**
 * The picture used for the blur behind a Fit video: the video's thumbnail, else the Mux thumbnail
 * worked out from a Mux stream URL (https://stream.mux.com/<playbackId>.m3u8). Null if neither.
 */
export function videoBlurUri(
  thumbnailUrl?: string | null,
  videoUrl?: string | null,
): string | null {
  if (thumbnailUrl && isImageUrl(thumbnailUrl)) return thumbnailUrl;
  const m = videoUrl?.match(
    /^https:\/\/stream\.mux\.com\/([A-Za-z0-9]+)(\.m3u8)?(\?|$)/,
  );
  return m ? `https://image.mux.com/${m[1]}/thumbnail.jpg` : null;
}

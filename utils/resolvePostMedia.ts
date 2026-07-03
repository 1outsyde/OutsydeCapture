/**
 * resolvePostMedia — single source of truth for resolving a feed post's
 * displayable media (image vs. video, and which URL to use).
 *
 * Canonical precedence (mirrors the working profile-grid chain at
 * screens/AccountScreen.tsx:280-299 / screens/VendorDetailScreen.tsx:312-334):
 *   - type: video ONLY when an explicit backend flag says so
 *       (mediaType === "video" | displayLayout === "pulse" | feedSurface === "pulse").
 *       A stray videoUrl on an otherwise-image post must NOT flip this to "video".
 *   - imageUrl: imageUrl ?? thumbnailUrl ?? mediaUrl ?? images[0] ?? ""
 *   - videoUrl: only populated when type === "video", as videoUrl ?? mediaUrl
 *
 * This resolver is the single source of truth for post media resolution.
 * Stage 2 will migrate other surfaces (profile grid, PostDetail, Pulse feed)
 * onto it; this stage only wires it into the Discover Pro feed.
 */

export interface ResolvablePostMedia {
  mediaType?: "image" | "video" | string;
  displayLayout?: "pro" | "pulse" | string;
  feedSurface?: "pro" | "pulse" | string;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  videoUrl?: string;
  images?: string[];
}

export interface ResolvedPostMedia {
  type: "image" | "video";
  imageUrl: string;
  videoUrl: string | null;
}

export function resolvePostMedia(post: ResolvablePostMedia): ResolvedPostMedia {
  const isVideo =
    post.mediaType === "video" ||
    post.displayLayout === "pulse" ||
    post.feedSurface === "pulse";

  const imageUrl =
    post.imageUrl ||
    post.thumbnailUrl ||
    post.mediaUrl ||
    (post.images && post.images[0]) ||
    "";

  const videoUrl = isVideo ? post.videoUrl || post.mediaUrl || null : null;

  return {
    type: isVideo ? "video" : "image",
    imageUrl,
    videoUrl,
  };
}

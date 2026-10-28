/**
 * One Saved place (Manage Business step 6, backend #378 / migration 077).
 * Saved businesses, photographers and products now live on the account, next to saved posts.
 *
 *   npx tsx utils/savedFavorites.test.ts
 */
export type FavoriteType = "photographer" | "business" | "product";

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  name: string;
  image: string;
  subtitle?: string;
  savedAt: string;
  /** product only */
  businessId?: string;
  priceCents?: number;
}

export type SavedSegment = "posts" | "business" | "photographer" | "product";

export const SAVED_SEGMENTS: { key: SavedSegment; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "business", label: "Businesses" },
  { key: "photographer", label: "Photographers" },
  { key: "product", label: "Products" },
];

const TYPES: FavoriteType[] = ["photographer", "business", "product"];
const isType = (v: unknown): v is FavoriteType => typeof v === "string" && (TYPES as string[]).includes(v);

/** GET /api/users/me/favorites → items. Bad rows are dropped. */
export function favoritesFromServer(body: unknown): FavoriteItem[] {
  const list = (body as any)?.favorites;
  if (!Array.isArray(list)) return [];
  const out: FavoriteItem[] = [];
  for (const f of list) {
    if (!f || !isType(f.type) || (typeof f.id !== "string" && typeof f.id !== "number")) continue;
    out.push({
      id: String(f.id),
      type: f.type,
      name: typeof f.name === "string" && f.name ? f.name : "Saved",
      image: typeof f.image === "string" ? f.image : "",
      subtitle: typeof f.subtitle === "string" && f.subtitle ? f.subtitle : undefined,
      savedAt: typeof f.savedAt === "string" ? f.savedAt : new Date(0).toISOString(),
      ...(typeof f.businessId === "string" ? { businessId: f.businessId } : {}),
      ...(typeof f.priceCents === "number" ? { priceCents: f.priceCents } : {}),
    });
  }
  return out;
}

/**
 * The list older builds kept on the phone → what to send to the import route. Older Search cards saved
 * products and services as "business", so each "business" entry is also tried as a product; the server
 * keeps only ids that are real.
 */
export function legacyImportItems(list: unknown): { type: FavoriteType; id: string; savedAt?: string }[] {
  if (!Array.isArray(list)) return [];
  const out: { type: FavoriteType; id: string; savedAt?: string }[] = [];
  const seen = new Set<string>();
  const add = (type: FavoriteType, id: string, savedAt?: string) => {
    const k = `${type}:${id}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(savedAt ? { type, id, savedAt } : { type, id });
  };
  for (const f of list) {
    if (!f || !isType(f.type) || (typeof f.id !== "string" && typeof f.id !== "number")) continue;
    const id = String(f.id);
    const savedAt = typeof f.savedAt === "string" ? f.savedAt : undefined;
    add(f.type, id, savedAt);
    if (f.type === "business") add("product", id, savedAt);
  }
  return out.slice(0, 500);
}

/**
 * The phone list is removed only when both one-time moves are done: posts (SavedPostsContext reads it
 * to move old post bookmarks) and businesses / photographers / products (import here).
 */
export const canClearLegacy = (importedFlag: string | null, postsMovedFlag: string | null): boolean =>
  !!importedFlag && !!postsMovedFlag;

interface SearchCard {
  id: string;
  resultType: string;
  name?: string;
  avatar?: string;
  productImage?: string;
  city?: string;
  state?: string;
  businessId?: string;
  businessName?: string;
  providerType?: string;
  price?: number;
}

/**
 * What the bookmark on a Search card saves. Services save the business that offers them. People
 * (consumers, staff) have no bookmark: you follow them.
 */
export function searchSaveTarget(item: SearchCard): Omit<FavoriteItem, "savedAt"> | null {
  const place = [item.city, item.state].filter((s) => s && s !== "Unknown").join(", ");
  switch (item.resultType) {
    case "business":
      return { id: item.id, type: "business", name: item.name || "Business", image: item.avatar || "", subtitle: place || undefined };
    case "photographer":
      return { id: item.id, type: "photographer", name: item.name || "Photographer", image: item.avatar || "", subtitle: place || undefined };
    case "product":
      return {
        id: item.id,
        type: "product",
        name: item.name || "Product",
        image: item.productImage || item.avatar || "",
        subtitle: item.businessName || undefined,
        ...(item.businessId ? { businessId: item.businessId } : {}),
        ...(typeof item.price === "number" ? { priceCents: item.price } : {}),
      };
    case "service":
      if (!item.businessId || item.providerType === "photographer") return null;
      return { id: item.businessId, type: "business", name: item.businessName || "Business", image: item.avatar || "", subtitle: place || undefined };
    default:
      return null;
  }
}

/** Where a saved row opens. */
export function savedOpenTarget(
  item: FavoriteItem,
):
  | { screen: "VendorDetail"; params: { vendorId: string } }
  | { screen: "ProductDetail"; params: { id: string; businessId: string; name: string; priceCents: number; imageUrl?: string } } {
  if (item.type === "product") {
    return {
      screen: "ProductDetail",
      params: {
        id: item.id,
        businessId: item.businessId ?? "",
        name: item.name,
        priceCents: item.priceCents ?? 0,
        ...(item.image ? { imageUrl: item.image } : {}),
      },
    };
  }
  // Search opens photographers in VendorDetail with the same id.
  return { screen: "VendorDetail", params: { vendorId: item.id } };
}

export function savedCounts(postCount: number, favorites: FavoriteItem[]): Record<SavedSegment, number> {
  const c: Record<SavedSegment, number> = { posts: postCount, business: 0, photographer: 0, product: 0 };
  for (const f of favorites) c[f.type]++;
  return c;
}

export const EMPTY_TEXT: Record<SavedSegment, string> = {
  posts: "Posts you save show up here",
  business: "Businesses you save show up here",
  photographer: "Photographers you save show up here",
  product: "Products you save show up here",
};

/**
 * Optional stock (Legend 2026-10-28): a business picks No limit, Count it, or Sold out.
 * Same rules as the backend (cartPricing effectiveStock, decrementInventory):
 *  - trackInventory false, or no stock number → no limit, never sells out
 *  - a number → that many, 0 = sold out
 * A no-limit product is saved with inventory null (not 0): older app builds show "Out of stock" for 0.
 *
 *   npx tsx utils/productStock.test.ts
 */
export type StockMode = "unlimited" | "count" | "soldout";

interface StockFields {
  inventory?: number | null;
  trackInventory?: boolean | null;
}

export function stockModeOf(p: StockFields | null | undefined): StockMode {
  if (
    !p ||
    p.trackInventory === false ||
    p.inventory === null ||
    p.inventory === undefined
  )
    return "unlimited";
  return p.inventory <= 0 ? "soldout" : "count";
}

/** Form → what POST/PATCH /api/vendor/products takes. */
export function stockPayload(
  mode: StockMode,
  countInput: string,
): { inventory: number | null; trackInventory: boolean } | { error: string } {
  if (mode === "unlimited") return { inventory: null, trackInventory: false };
  if (mode === "soldout") return { inventory: 0, trackInventory: true };
  const raw = countInput.trim();
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1)
    return { error: "Enter how many you have, or pick No limit or Sold out" };
  if (n > 1_000_000) return { error: "That stock number is too large" };
  return { inventory: n, trackInventory: true };
}

/** Stock that limits a customer's purchase: null = no limit. */
export function customerStock(
  p: StockFields | null | undefined,
): number | null {
  if (!p || p.trackInventory === false) return null;
  return p.inventory ?? null;
}

/** Short line on the business's own product list. */
export function stockLabel(p: StockFields | null | undefined): string {
  const mode = stockModeOf(p);
  if (mode === "unlimited") return "No limit";
  if (mode === "soldout") return "Sold out";
  return `${p!.inventory} in stock`;
}

/**
 * Customer-side option picking for products with options (backend #310).
 * Pure logic (no React), tested by: npx tsx components/products/productPickerLogic.test.ts
 *
 * A product has up to 3 options (position 1..3) and variations that each use
 * one value per option (option1..option3). The customer picks one value per
 * option; the matching active variation is what gets bought.
 */

export interface PickerOption {
  position: number;
  name: string;
  values: { value: string; swatchHex?: string | null }[];
}
export interface PickerVariant {
  id: string;
  label: string;
  priceCents: number; // always a number from the server (own price, else product price)
  inventory?: number | null;
  trackInventory?: boolean;
  isActive?: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageUrl?: string | null;
}
export type Picks = (string | null)[]; // one entry per option, in position order

export type ValueState = "available" | "soldout" | "unavailable";

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
const valueAt = (v: PickerVariant, i: number) =>
  i === 0 ? v.option1 : i === 1 ? v.option2 : v.option3;

/** Options in position order. */
export function sortedOptions<T extends PickerOption>(
  options: T[] | undefined | null,
): T[] {
  return [...(options ?? [])].sort((a, b) => a.position - b.position);
}

/** Variations a customer can buy: switched on and built from options. */
export function liveVariants(variants: PickerVariant[]): PickerVariant[] {
  return variants.filter((v) => v.isActive !== false && !!v.option1);
}

/** Same rule as checkout (cartPricing) and decrementInventory: variation count, else product count, null = no limit. */
export function stockOf(
  v: PickerVariant,
  productInventory: number | null | undefined,
): number | null {
  if (v.trackInventory === false) return null;
  if (v.inventory !== null && v.inventory !== undefined) return v.inventory;
  return productInventory ?? null;
}

/** The variation matching every pick, or null while any option is unpicked. */
export function findVariant(
  variants: PickerVariant[],
  picks: Picks,
  optionCount: number,
): PickerVariant | null {
  if (picks.length < optionCount || picks.slice(0, optionCount).some((p) => !p))
    return null;
  return (
    liveVariants(variants).find((v) =>
      picks.slice(0, optionCount).every((p, i) => same(valueAt(v, i), p)),
    ) ?? null
  );
}

/**
 * Whether a value can be picked given the customer's other picks:
 *  - unavailable: no live variation has it together with the other picks
 *  - soldout: such variations exist but every one is out of stock
 *  - available: at least one can be bought
 */
export function valueState(
  variants: PickerVariant[],
  picks: Picks,
  optionIndex: number,
  value: string,
  productInventory: number | null | undefined,
): ValueState {
  const candidates = liveVariants(variants).filter(
    (v) =>
      same(valueAt(v, optionIndex), value) &&
      picks.every((p, i) => i === optionIndex || !p || same(valueAt(v, i), p)),
  );
  if (candidates.length === 0) return "unavailable";
  return candidates.some((v) => stockOf(v, productInventory) !== 0)
    ? "available"
    : "soldout";
}

/**
 * Pick a value. Other picks that no longer fit (that combination doesn't exist
 * or is sold out) are cleared, so the customer never ends up on a dead end.
 */
export function pick(
  variants: PickerVariant[],
  picks: Picks,
  optionIndex: number,
  value: string,
  productInventory: number | null | undefined,
): Picks {
  const next = [...picks];
  next[optionIndex] = value;
  for (let i = 0; i < next.length; i++) {
    if (i === optionIndex || !next[i]) continue;
    if (
      valueState(variants, next, i, next[i]!, productInventory) !== "available"
    )
      next[i] = null;
  }
  return next;
}

/** Start state: an option with a single value is picked for the customer. */
export function initialPicks(options: PickerOption[]): Picks {
  return sortedOptions(options).map((o) =>
    o.values.length === 1 ? o.values[0].value : null,
  );
}

/** Photo to show: the picked variation's, else one matching the first pick, else null (use the product photo). */
export function photoFor(
  variants: PickerVariant[],
  picks: Picks,
  selected: PickerVariant | null,
): string | null {
  if (selected?.imageUrl) return selected.imageUrl;
  if (picks[0]) {
    const v = liveVariants(variants).find(
      (x) => same(x.option1, picks[0]) && !!x.imageUrl,
    );
    if (v?.imageUrl) return v.imageUrl;
  }
  return null;
}

/** Lowest and highest price among variations that can be bought. */
export function priceRange(
  variants: PickerVariant[],
): { min: number; max: number } | null {
  const prices = liveVariants(variants).map((v) => v.priceCents);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Price shown under a value chip: only when every variation with that value costs the same. */
export function uniformPriceFor(
  variants: PickerVariant[],
  optionIndex: number,
  value: string,
): number | null {
  const prices = new Set(
    liveVariants(variants)
      .filter((v) => same(valueAt(v, optionIndex), value))
      .map((v) => v.priceCents),
  );
  return prices.size === 1 ? [...prices][0] : null;
}

const NAMED_COLORS: Record<string, string> = {
  black: "#0A0A0A",
  white: "#F5F5F5",
  cream: "#EDE4CF",
  ivory: "#FFFFF0",
  beige: "#D9C7A7",
  tan: "#C8A67A",
  brown: "#6B4423",
  chocolate: "#5A3A22",
  grey: "#8A8A8A",
  gray: "#8A8A8A",
  charcoal: "#36454F",
  silver: "#C0C0C0",
  red: "#C0392B",
  burgundy: "#6D1A36",
  maroon: "#6D1A1A",
  pink: "#E8A0B4",
  purple: "#6C3483",
  lavender: "#B8A2D8",
  blue: "#2E5FA8",
  navy: "#1F2A44",
  "baby blue": "#9EC9E8",
  green: "#2E7D4F",
  forest: "#1A3C34",
  olive: "#6B6B2E",
  sage: "#9CAF88",
  yellow: "#E8C547",
  gold: "#E8B930",
  orange: "#E67E22",
  teal: "#1F7A7A",
};

/** Swatch color for a value: the vendor's swatch, else a common color name, else null (show a text chip). */
export function swatchFor(value: {
  value: string;
  swatchHex?: string | null;
}): string | null {
  if (value.swatchHex) return value.swatchHex;
  return NAMED_COLORS[value.value.trim().toLowerCase()] ?? null;
}

/** Show this option as color swatches: its name says color and every value has a swatch. */
export function isColorOption(option: PickerOption): boolean {
  return (
    /colou?r/i.test(option.name) &&
    option.values.length > 0 &&
    option.values.every((v) => swatchFor(v) !== null)
  );
}

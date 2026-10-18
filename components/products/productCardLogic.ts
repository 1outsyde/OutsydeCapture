/**
 * Storefront product cards: what to show for a product with variations
 * (backend #315 variantSummary). Pure logic, tested by:
 *   npx tsx components/products/productCardLogic.test.ts
 */

export interface VariantSummary {
  count: number;
  minPriceCents: number;
  maxPriceCents: number;
  options: { name: string; valueCount: number }[];
}

/** True when the customer has to pick a variation, so a card's Add must open the product page. */
export function needsChoice(
  summary: VariantSummary | null | undefined,
): boolean {
  return !!summary && summary.count > 0;
}

/** Price cents a card shows: lowest variation price, else the product price. */
export function cardPriceCents(
  priceCents: number,
  summary: VariantSummary | null | undefined,
): number {
  return needsChoice(summary) ? summary!.minPriceCents : priceCents;
}

/** "From " when variation prices differ, else nothing. */
export function cardPricePrefix(
  summary: VariantSummary | null | undefined,
): string {
  return needsChoice(summary) &&
    summary!.minPriceCents !== summary!.maxPriceCents
    ? "From "
    : "";
}

const plural = (name: string, n: number): string => {
  const word = name.trim().toLowerCase();
  if (n === 1 || word.endsWith("s")) return word;
  return `${word}s`;
};

/**
 * Short line under the price: "11 lengths", "3 colors · 4 sizes", or for older
 * variations without option names "4 options". null when there is nothing to pick.
 * At most two options are listed so it fits on a card.
 */
export function cardOptionsLine(
  summary: VariantSummary | null | undefined,
): string | null {
  if (!needsChoice(summary)) return null;
  const named = summary!.options
    .filter((o) => o.name.trim() && o.valueCount > 0)
    .slice(0, 2);
  if (named.length > 0)
    return named
      .map((o) => `${o.valueCount} ${plural(o.name, o.valueCount)}`)
      .join(" · ");
  return summary!.count === 1 ? "1 option" : `${summary!.count} options`;
}

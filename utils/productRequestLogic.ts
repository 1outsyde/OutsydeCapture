/**
 * Request forms step P-b (Legend 2026-11-09, calls Q1 to Q7 as recommended): contact for pricing products in the app.
 * A contact for pricing product (backend #436, `requestOnly`) is never bought as is: customers see Price on request
 * and send a request with the product's form; the business quotes it as a Deliverable.
 * Copy rules: commas and periods, no dashes, never the fee rate.
 */

export const PRICE_ON_REQUEST = "Price on request";

/** True for a contact for pricing product. Missing (older backend or an older list) = sold as is. */
export function isRequestProduct(
  p: { requestOnly?: boolean | null } | null | undefined,
): boolean {
  return p?.requestOnly === true;
}

/**
 * What a product card in a business's Products tab shows and does (call Q2). `mustChoose` is the existing rule for
 * products that need a pick first (variations or required add-ons).
 * - contact for pricing: Price on request, button Request, opens the product page (never the cart)
 * - needs a pick: Choose, opens the product page
 * - otherwise: Add, straight to the cart
 */
export function productCardAction(
  p: { requestOnly?: boolean | null },
  mustChoose: boolean,
): {
  priceOnRequest: boolean;
  button: "Request" | "Choose" | "Add";
  opensPage: boolean;
} {
  if (isRequestProduct(p))
    return { priceOnRequest: true, button: "Request", opensPage: true };
  if (mustChoose)
    return { priceOnRequest: false, button: "Choose", opensPage: true };
  return { priceOnRequest: false, button: "Add", opensPage: false };
}

/** The accessibility label for that button. */
export function productCardButtonLabel(
  name: string,
  button: "Request" | "Choose" | "Add",
): string {
  if (button === "Request") return `Request a quote for ${name}`;
  if (button === "Choose") return `Choose an option for ${name}`;
  return `Add ${name} to cart`;
}

/** Products that count toward a profile's "from $X": contact for pricing ones have no price to start from. */
export function pricedProducts<T extends { requestOnly?: boolean | null }>(
  products: T[],
): T[] {
  return products.filter((p) => !isRequestProduct(p));
}

/** The owner's product list line (call Q1): Contact for pricing instead of a price. */
export function ownerProductPriceLine(
  p: { requestOnly?: boolean | null },
  price: string,
): string {
  return isRequestProduct(p) ? "Contact for pricing" : price;
}

/**
 * The product editor's `requestOnly` field (call Q1): sent only when the owner changed the switch, so an edit that
 * never touches it leaves the product as it is (same rule as services, `requestOnlyPatch`).
 */
export function productRequestOnlyPatch(o: {
  touched: boolean;
  value: boolean;
}): { requestOnly?: boolean } {
  return o.touched ? { requestOnly: o.value } : {};
}

/** The RequestQuote route params for a contact for pricing product (call Q5). */
export function productRequestParams(p: {
  id: string;
  name: string;
  businessId: string;
  businessName?: string;
}): {
  serviceId: string;
  serviceName: string;
  businessId: string;
  businessName?: string;
  productId: string;
} {
  return {
    serviceId: p.id,
    serviceName: p.name,
    businessId: p.businessId,
    ...(p.businessName ? { businessName: p.businessName } : {}),
    productId: p.id,
  };
}

/** A small label on request rows (call Q6): Product for product requests, nothing for services. */
export function requestItemLabel(r: {
  productId?: string | null;
  itemType?: string | null;
}): string | null {
  return r.productId || r.itemType === "product" ? "Product" : null;
}

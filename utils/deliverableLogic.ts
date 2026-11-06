/**
 * Deliverables D2 (Legend 2026-11-06, D2 plan calls 1 to 9): pure rules for deliverable quotes and the orders they
 * become. Backend: D1a (pickup or delivery, delivery fee, address) and D1b (paid as a product order, Mark picked up
 * or Mark delivered via POST /api/business/orders/:id/handed-over). Tested in utils/deliverableLogic.test.ts.
 * Copy: commas and periods only, never the fee rate.
 */
import { dateLabel, money } from "./quoteLogic";

type Fulfillment = "pickup" | "delivery" | null | undefined;
const isYmd = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "Due Fri, Nov 20 · Pickup", or just "Delivery" with no due date. */
export function deliverableWhenLine(q: {
  dueDate?: string | null;
  fulfillment?: Fulfillment;
}): string {
  const how = q.fulfillment === "delivery" ? "Delivery" : "Pickup";
  return isYmd(q.dueDate) ? `Due ${dateLabel(q.dueDate)} · ${how}` : how;
}

/** A Delivery quote can't be paid until the customer adds the address. */
export function needsAddress(q: {
  kind: string;
  fulfillment?: Fulfillment;
  deliveryAddress?: string | null;
}): boolean {
  return (
    q.kind === "product" && q.fulfillment === "delivery" && !q.deliveryAddress
  );
}

/** The line on a paid deliverable, from its order's status. */
export function deliverablePaidLine(q: {
  status: string;
  orderStatus?: string | null;
}): string | null {
  if (q.status !== "paid") return null;
  if (q.orderStatus === "delivered") return "Delivered.";
  if (q.orderStatus === "cancelled" || q.orderStatus === "refunded")
    return "Refunded. The business cancelled this order.";
  return "Paid. Your order is in Orders.";
}

export function handOverLabel(f: Fulfillment): string {
  return f === "delivery" ? "Mark delivered" : "Mark picked up";
}

/** Only a paid Pickup or Delivery order (a shipped order keeps carrier and tracking). */
export function canHandOver(o: {
  status?: string | null;
  fulfillment?: Fulfillment;
}): boolean {
  return (
    o.status === "paid" &&
    (o.fulfillment === "pickup" || o.fulfillment === "delivery")
  );
}

/** "Pickup" or "Delivery to …" for an order from a deliverable; null for cart orders (they keep shipping lines). */
export function orderFulfillmentLine(o: {
  fulfillment?: Fulfillment;
  shippingAddress?: string | null;
}): string | null {
  if (o.fulfillment === "pickup") return "Pickup";
  if (o.fulfillment === "delivery")
    return o.shippingAddress ? `Delivery to ${o.shippingAddress}` : "Delivery";
  return null;
}

/** Shipping reminders ("Ship by day 4") only for orders that ship. */
export function showShipBy(o: { fulfillment?: Fulfillment }): boolean {
  return !o.fulfillment;
}

export function isDeliverableOrder(o: { quoteId?: string | null }): boolean {
  return !!o.quoteId;
}

/** A deposit order: what's paid directly to the business. */
export function orderDepositNote(
  o: { paidDirectlyCents?: number | null },
  viewer: "business" | "customer",
): string | null {
  const c = o.paidDirectlyCents ?? 0;
  if (!(c > 0)) return null;
  return viewer === "business"
    ? `Deposit paid. ${money(c)} is paid to you directly.`
    : `Deposit paid. ${money(c)} goes to the business directly.`;
}

export const DELIVERABLE_COPY = {
  kindService: "Service with a time",
  kindDeliverable: "Deliverable",
  kindHint:
    "A deliverable is something you make and hand over, like a cake or a dress. It has no start time.",
  dueDate: "Due date (optional)",
  howLabel: "How it gets to them",
  pickup: "Pickup",
  delivery: "Delivery",
  deliveryFee: "Delivery fee (optional, part of the total)",
  product: "Product (optional)",
  noProduct: "No product",
  depositRest: "The rest is paid to you directly.",
  addressLabel: "Delivery address",
  addressHint:
    "Add where it should be delivered. The business sees it before you pay.",
  addressSave: "Save address",
  addressSaved: "Address saved.",
  addressNeeded: "Add your delivery address, then pay.",
  viewOrder: "View order",
  handOverDone: "Marked. The customer gets an email.",
};

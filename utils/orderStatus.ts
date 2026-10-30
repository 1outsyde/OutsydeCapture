// Product order status as the backend stores it (shared/schema.ts
// ORDER_STATUS_TRANSITIONS): pending, paid, shipped, delivered, refunded,
// cancelled. "cancelled" has two Ls. Older app code used "canceled"; reads
// accept both so nothing is lost, and the app only ever sends "cancelled".

export const ORDER_CANCELLED = "cancelled" as const;

/** One spelling for the cancelled status; every other value is returned unchanged. */
export function normalizeOrderStatus(status: unknown): string {
  if (typeof status !== "string") return "";
  return status === "canceled" ? ORDER_CANCELLED : status;
}

/** Customer side: statuses the order list knows how to show. Anything else shows as pending. */
export const CONSUMER_ORDER_STATUSES = new Set([
  "pending",
  "paid",
  "shipped",
  "delivered",
  ORDER_CANCELLED,
]);

export function consumerOrderStatus(
  status: unknown,
): "pending" | "paid" | "shipped" | "delivered" | "cancelled" {
  const s = normalizeOrderStatus(status);
  return (CONSUMER_ORDER_STATUSES.has(s) ? s : "pending") as
    | "pending"
    | "paid"
    | "shipped"
    | "delivered"
    | "cancelled";
}

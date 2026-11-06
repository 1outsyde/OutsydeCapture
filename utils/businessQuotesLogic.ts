/**
 * Quotes step 6d-2b (app, businesses). Pure: no React Native, no network. Tested in utils/businessQuotesLogic.test.ts.
 *
 * Legend 2026-11-05 (6d-2 calls, all as recommended):
 *   - 2: Requests and Quotes cards under Activity on the owner dashboard, with counts.
 *   - 3: the Requests list (Open and All): Send a quote, Open chat, Close request.
 *   - 4: the Quotes list (Open and All) with chips from the quote status (plus the booking status from 6d-2a).
 *   - 6: bookingStatus (6d-2a) hides Add an extra and Job complete once the booking ended (utils/quoteLogic.ts).
 *   - 7: the contact for pricing switch, sent only when changed.
 *   - 8: the Book tab never opens a booking screen that leaves the service out.
 *   - 9: posts tagged with a business service open that service; photographer services keep the shoot booking.
 * Copy uses commas and periods only and never the fee rate.
 */
import { dateLabel, money } from "./quoteLogic";

// ─── Requests ──────────────────────────────────────────────────────────────

const REQUEST_CHIPS: Record<string, string> = {
  new: "New",
  called: "Called",
  quoted: "Quoted",
  booked: "Booked",
  closed: "Closed",
};
export const requestChip = (status: string): string =>
  REQUEST_CHIPS[status] ?? "Request";
export const requestIsOpen = (status: string): boolean =>
  status === "new" || status === "called" || status === "quoted";

const isYmd = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "Ana T, Sun, Nov 22, Freeport". */
export function requestLine(r: {
  customerName?: string | null;
  preferredDate?: string | null;
  city?: string | null;
}): string {
  const name = (r.customerName ?? "").trim();
  const when = isYmd(r.preferredDate)
    ? dateLabel(r.preferredDate)
    : name
      ? "no date given"
      : "No date given";
  return [name, when, (r.city ?? "").trim()].filter(Boolean).join(", ");
}

// ─── Quotes list ───────────────────────────────────────────────────────────

type ListQuote = {
  status: string;
  paying?: boolean;
  bookingStatus?: string | null;
  kind?: string;
  jobDate?: string | null;
  dueDate?: string | null;
  totalCents: number;
  expiresAt?: string | null;
};

/** Booking statuses after which nothing more happens on the booking. */
const ENDED = [
  "completed",
  "canceled",
  "declined",
  "expired",
  "no_show",
  "late_cancel",
  // Review 4: an outcome the owner sets (PATCH /api/bookings/appointments/:id/status); no new booking is made.
  "rescheduled",
];

/** Review 5: past its expiry, the backend job just hasn't marked it yet (a running payment waits, as the backend does). */
const pastExpiry = (q: ListQuote, now: number) =>
  q.status === "sent" &&
  !q.paying &&
  !!q.expiresAt &&
  Date.parse(q.expiresAt) <= now;

export function quoteListChip(q: ListQuote, now = Date.now()): string {
  if (pastExpiry(q, now)) return "Expired";
  if (q.status === "sent") return q.paying ? "Paying" : "Waiting to pay";
  if (q.status === "paid") {
    if (q.bookingStatus === "completed") return "Complete";
    if (q.bookingStatus === "rescheduled") return "Rescheduled";
    if (q.bookingStatus && ENDED.includes(q.bookingStatus))
      return "Booking canceled";
    return "Booked";
  }
  if (q.status === "withdrawn") return "Withdrawn";
  if (q.status === "declined") return "Declined";
  return "Expired";
}

export function quoteIsOpen(q: ListQuote, now = Date.now()): boolean {
  if (pastExpiry(q, now)) return false;
  if (q.status === "sent") return true;
  if (q.status !== "paid") return false;
  return !q.bookingStatus || !ENDED.includes(q.bookingStatus);
}

/** "Fri, Nov 20, $650.00". */
export function quoteListLine(q: ListQuote): string {
  const when =
    q.kind === "product"
      ? isYmd(q.dueDate)
        ? `Due ${dateLabel(q.dueDate)}`
        : ""
      : isYmd(q.jobDate)
        ? dateLabel(q.jobDate)
        : "";
  return [when, money(q.totalCents)].filter(Boolean).join(", ");
}

/** The dashboard counts. null: that list couldn't be read (the card shows no count). */
export function dashboardCounts(
  requests: { status: string }[] | null,
  quotes: ListQuote[] | null,
  now = Date.now(),
): { newRequests: number | null; waitingQuotes: number | null } {
  return {
    newRequests: requests
      ? requests.filter((r) => r.status === "new").length
      : null,
    waitingQuotes: quotes
      ? quotes.filter((q) => q.status === "sent" && !pastExpiry(q, now)).length
      : null,
  };
}

// ─── Booking status (6d-2a) ────────────────────────────────────────────────

export function bookingEndedLine(
  status: string | null | undefined,
): string | null {
  switch (status) {
    case "canceled":
    case "late_cancel":
      return "This booking was canceled.";
    case "no_show":
      return "This booking was marked as a no show.";
    case "declined":
      return "This booking was declined.";
    case "expired":
      return "This booking expired.";
    case "rescheduled":
      return "This booking was marked as rescheduled.";
    default:
      return null;
  }
}

// ─── Contact for pricing switch (call 7) ───────────────────────────────────

export const REQUEST_ONLY_LABEL = "Contact for pricing";
export const REQUEST_ONLY_SUB =
  "Customers send a request form instead of booking.";
export const STARTING_PRICE_LABEL = "Starting price, not shown";
export const OWN_REQUEST_ONLY_LINE =
  "This service is contact for pricing. Customers send you a request form, and it shows up in Requests.";

/** The editor sends the whole form on every save, so the switch goes out only when it was changed. */
export function requestOnlyPatch(o: {
  touched: boolean;
  value: boolean;
  isNew: boolean;
}): { requestOnly?: boolean } {
  return o.touched ? { requestOnly: o.value } : {};
}

// ─── Book tab (call 8) ─────────────────────────────────────────────────────

export function bookTabAction(
  s: { requestOnly?: boolean | null },
  o: { ownProfile: boolean },
): "book" | "request" | "own-request" {
  if (s.requestOnly !== true) return "book";
  return o.ownProfile ? "own-request" : "request";
}

// ─── Tagged posts (call 9) ─────────────────────────────────────────────────

export function postServiceTarget(p: {
  businessServiceId?: string | null;
  photographerServiceId?: string | null;
  photographerId?: string | null;
  providerId?: string | null;
  userId?: string | null;
  productId?: string | null;
}):
  | {
      kind: "photographer";
      serviceId: string;
      photographerId: string | undefined;
    }
  | { kind: "business"; serviceId: string; vendorId: string }
  | null {
  if (p.photographerServiceId) {
    return {
      kind: "photographer",
      serviceId: p.photographerServiceId,
      photographerId: p.photographerId || p.providerId || p.userId || undefined,
    };
  }
  const vendorId = p.providerId || p.userId;
  if (p.businessServiceId && vendorId)
    return { kind: "business", serviceId: p.businessServiceId, vendorId };
  return null;
}

/** VendorDetail opened on a service: its booking, its request form, or the Book tab when it isn't listed. */
export function serviceStart(
  services: { id: string; requestOnly?: boolean | null }[],
  serviceId: string,
): "book" | "request" | "tab" {
  const s = services.find((x) => x.id === serviceId);
  if (!s) return "tab";
  return s.requestOnly === true ? "request" : "book";
}

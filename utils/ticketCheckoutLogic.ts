/**
 * Pure helpers for buying tickets and My Tickets in the app (p4-buy, Events canvas screens 25 to 29).
 * No React, no network. Backend routes: POST /api/events/:id/checkout, GET /api/events/orders/:orderId,
 * GET /api/events/me/tickets, POST /api/events/orders/:orderId/refund, POST /api/events/orders/:orderId/cancel.
 */

import { eventErrorCopy, fmt, money, revealLine, zonedParts, type PublicTicketType } from "./eventsLogic";

// ─── Types (shapes returned by the backend) ──────────────────────────────────

/** One ticket from GET /api/events/me/tickets (backend ticketsRouter.ts /me/tickets). Valid tickets only. */
export interface MyTicket {
  id: string;
  code: string;
  status: string;
  orderId: string;
  checkedInAt: string | null;
  ticketTypeName: string;
  qrUrl: string | null;
  /** Not sent by the backend yet (Apple Wallet passes come later). The button shows only when it exists. */
  walletUrl?: string | null;
  event: {
    id: string;
    slug: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    coverImageUrl: string | null;
    city: string | null;
    state: string | null;
    venueName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    addressHidden: boolean;
    addressRevealAt: string | null;
  };
}

export type TicketEvent = MyTicket["event"];

export interface TicketGroup {
  event: TicketEvent;
  tickets: MyTicket[];
}

/** GET /api/events/orders/:orderId order (refund route adds the refund fields). */
export interface TicketOrder {
  id: string;
  status: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  ticketCount: number;
  totalCents: number;
  createdAt: string | null;
  cancelledAt: string | null;
  tickets: Array<{ id: string; code: string; status: string; ticketTypeId: string; ticketTypeName: string }>;
  refundedCents?: number;
  refundPendingCents?: number;
  refundReason?: string | null;
}

/** POST /api/events/:id/checkout: an open checkout, or (same key again, already paid) the finished order. */
export interface CheckoutStart {
  orderId?: string;
  paymentIntentId?: string;
  clientSecret?: string | null;
  holdExpiresAt?: string | null;
  subtotalCents?: number;
  serviceFeeCents?: number;
  totalCents?: number;
  repeated?: boolean;
  order?: { id: string; status: string } & Partial<TicketOrder>;
}

// ─── Quote (screen 25) ───────────────────────────────────────────────────────

/** Fees are per ticket on the backend (calculateTicketFees), so qty x per ticket numbers is exact. */
export function quoteLines(t: PublicTicketType, qty: number): { line: string; subtotalCents: number; feeCents: number; totalCents: number } {
  const fee = t.serviceFeeCents ?? 0;
  const each = t.buyerTotalCents ?? t.priceCents + fee;
  return { line: `${qty} × ${t.name}`, subtotalCents: qty * t.priceCents, feeCents: qty * fee, totalCents: qty * each };
}

// ─── Idempotency key ─────────────────────────────────────────────────────────

function newKey(): string {
  return `tix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** One key per checkout attempt: kept across retries, dropped on success, a changed choice or a closed checkout. */
export function checkoutKeyNext(prev: string | null, action: "attempt" | "success" | "changed" | "closed"): string | null {
  if (action === "attempt") return prev ?? newKey();
  return null;
}

const KEY_RESET_CODES = new Set(["CHECKOUT_CLOSED", "IDEMPOTENCY_KEY_REUSED", "PAYMENT_SETUP_FAILED"]);

function errCode(err: unknown): string {
  const code = (err as { body?: { error?: { code?: unknown } } } | null)?.body?.error?.code;
  return typeof code === "string" ? code : "";
}

/** After a failed checkout call: a closed or reused checkout needs a new key; anything else retries with the same one. */
export function checkoutKeyAfterError(prev: string | null, err: unknown): string | null {
  return KEY_RESET_CODES.has(errCode(err)) ? null : prev;
}

const PAID_STATUSES = new Set(["completed", "refunding", "refunded"]);

export function checkoutResponseKind(res: CheckoutStart | null | undefined): "pay" | "paid" | "error" {
  if (!res) return "error";
  if (res.order && PAID_STATUSES.has(res.order.status)) return "paid";
  if (typeof res.clientSecret === "string" && res.clientSecret && res.orderId) return "pay";
  return "error";
}

// ─── Hold and payment sheet (screen 26) ──────────────────────────────────────

export function holdMsLeft(holdExpiresAt: string | null | undefined, now: Date): number {
  if (!holdExpiresAt) return 0;
  const t = new Date(holdExpiresAt).getTime();
  return Number.isFinite(t) ? Math.max(0, t - now.getTime()) : 0;
}

/** "9:42" */
export function holdClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** presentPaymentSheet's error: none is paid, Canceled goes back to choosing, Timeout means the hold ended. */
export function sheetOutcome(error: { code?: string; message?: string } | null | undefined): "paid_sheet" | "canceled" | "expired" | "failed" {
  if (!error) return "paid_sheet";
  if (error.code === "Canceled") return "canceled";
  if (error.code === "Timeout") return "expired";
  return "failed";
}

// ─── After paying (screen 27) ────────────────────────────────────────────────

export const POLL_EVERY_MS = 2000;
export const POLL_MAX_MS = 20000;

/**
 * Polling GET /orders/:id after the sheet said paid. The webhook issues the tickets, so pending waits.
 * Money moved, so a closed order is never shown as "not charged": it shows "Confirming your payment".
 */
export function pollDecision(status: string | null | undefined, elapsedMs: number): "paid" | "wait" | "processing" {
  if (status && PAID_STATUSES.has(status)) return "paid";
  if (!status || status === "pending") return elapsedMs >= POLL_MAX_MS ? "processing" : "wait";
  return "processing";
}

// ─── My Tickets (screen 28) ──────────────────────────────────────────────────

/** Groups by event. Upcoming (not ended yet) soonest first, Past newest first. */
export function splitTickets(tickets: MyTicket[], now: Date): { upcoming: TicketGroup[]; past: TicketGroup[] } {
  const byEvent = new Map<string, TicketGroup>();
  for (const t of tickets) {
    const g = byEvent.get(t.event.id);
    if (g) g.tickets.push(t);
    else byEvent.set(t.event.id, { event: t.event, tickets: [t] });
  }
  const groups = [...byEvent.values()];
  const start = (g: TicketGroup) => new Date(g.event.startsAt).getTime();
  const ended = (g: TicketGroup) => new Date(g.event.endsAt).getTime() < now.getTime();
  return {
    upcoming: groups.filter((g) => !ended(g)).sort((a, b) => start(a) - start(b)),
    past: groups.filter(ended).sort((a, b) => start(b) - start(a)),
  };
}

const cityState = (e: Pick<TicketEvent, "city" | "state">) =>
  [e.city, e.state].filter((x): x is string => !!x && x.trim() !== "").join(", ");

/** "General admission · 2 tickets · Freeport, NY" */
export function groupInfo(g: TicketGroup): string {
  const names = [...new Set(g.tickets.map((t) => t.ticketTypeName).filter(Boolean))].join(", ");
  const n = g.tickets.length;
  return [names, `${n} ${n === 1 ? "ticket" : "tickets"}`, cityState(g.event)].filter(Boolean).join(" · ");
}

/** "ADDRESS SAT 9 AM" while the address is still hidden and the reveal is ahead. */
export function addressTag(e: TicketEvent, now: Date): string | null {
  if (!e.addressHidden || !e.addressRevealAt) return null;
  if (new Date(e.addressRevealAt).getTime() <= now.getTime()) return null;
  const day = fmt(e.addressRevealAt, e.timezone, { weekday: "short" });
  const onTheHour = zonedParts(new Date(e.addressRevealAt), e.timezone).mi === 0;
  const time = fmt(e.addressRevealAt, e.timezone, onTheHour ? { hour: "numeric" } : { hour: "numeric", minute: "2-digit" });
  return `ADDRESS ${day} ${time}`.toUpperCase();
}

function streetParts(e: TicketEvent): string[] {
  const cs = cityState(e);
  const last = [cs, e.postalCode].filter((x) => !!x && String(x).trim() !== "").join(" ");
  return [e.addressLine1, e.addressLine2, last].filter((x): x is string => !!x && x.trim() !== "");
}

/** The place line on a ticket: the address when shown, otherwise the city and when it is shared. */
export function ticketPlaceLine(e: TicketEvent): string {
  if (e.addressHidden) {
    const when = e.addressRevealAt ? `${revealLine(e.addressRevealAt, e.timezone)}.` : "The full address is shared before the event.";
    const cs = cityState(e);
    return cs ? `${cs}. ${when}` : when;
  }
  const venue = e.venueName && e.venueName.trim() ? [e.venueName.trim()] : [];
  return [...venue, ...streetParts(e)].join(", ");
}

// ─── Directions and calendar (screen 29) ─────────────────────────────────────

/** A maps link to the street address, or null while the address is hidden or has no street line. */
export function directionsUrl(e: TicketEvent, os: string): string | null {
  if (e.addressHidden || !e.addressLine1 || !e.addressLine1.trim()) return null;
  const q = encodeURIComponent(streetParts(e).join(", "));
  if (os === "ios") return `https://maps.apple.com/?daddr=${q}`;
  if (os === "android") return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export interface CalendarEventData {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  timeZone: string;
  url: string;
  notes: string;
}

/** What the system calendar editor opens with. The location is left out while the address is hidden. */
export function calendarEventFor(e: TicketEvent): CalendarEventData {
  const url = `https://goutsyde.com/e/${e.slug}`;
  const out: CalendarEventData = {
    title: e.title,
    startDate: new Date(e.startsAt),
    endDate: new Date(e.endsAt),
    timeZone: e.timezone,
    url,
    notes: `Your tickets are in the Outsyde app. ${url}`,
  };
  if (!e.addressHidden) {
    const place = ticketPlaceLine(e);
    if (place) out.location = place;
  }
  return out;
}

// ─── Refund and cancel (screen 29) ───────────────────────────────────────────

export function orderKind(o: Pick<TicketOrder, "totalCents"> | null | undefined): "paid" | "free" | "unknown" {
  if (!o || typeof o.totalCents !== "number") return "unknown";
  return o.totalCents > 0 ? "paid" : "free";
}

const REFUND_COPY: Record<string, string> = {
  NO_REFUNDS: "The host doesn't offer refunds for this event. You can contact the host.",
  CHECKED_IN: "You've already checked in, so this order can't be refunded.",
  NOTHING_TO_REFUND: "Only the service fee was paid on this order, and the service fee isn't refundable.",
  ALREADY_REFUNDED: "This order was already refunded.",
  EVENT_CANCELLED: "This event was cancelled, so your full refund is already on its way.",
  FREE_ORDER: "This is a free RSVP. Cancel it instead.",
  EVENT_PAUSED: "This event is paused. Contact Outsyde support.",
  ORDER_NOT_REFUNDABLE: "This order can't be refunded.",
  TRY_AGAIN: "Something changed. Try again.",
};

const CANCEL_COPY: Record<string, string> = {
  CHECKED_IN: "You've already checked in, so this RSVP can't be cancelled.",
  ALREADY_CANCELLED: "This RSVP is already cancelled.",
  ORDER_NOT_CANCELLABLE: "This RSVP can't be cancelled.",
  EVENT_CLOSED: "This event has started or changed, so RSVPs can't be cancelled now.",
  PAID_ORDER: "Paid tickets follow the host's refund policy.",
  TRY_AGAIN: "Something changed. Try again.",
};

/** Route specific copy first; otherwise the shared events copy (REFUND_WINDOW_CLOSED keeps the backend's hours). */
function withTable(table: Record<string, string>, err: unknown): string {
  const code = errCode(err);
  return code && table[code] ? table[code] : eventErrorCopy(err);
}

export function refundErrorCopy(err: unknown): string {
  return withTable(REFUND_COPY, err);
}

export function cancelErrorCopy(err: unknown): string {
  return withTable(CANCEL_COPY, err);
}

/** The refund route sends the refund inline, so pending is often 0 and the amount is already in refundedCents. */
export function refundShownCents(o: Pick<TicketOrder, "refundPendingCents" | "refundedCents"> | null | undefined): number | null {
  if (o && typeof o.refundPendingCents === "number" && o.refundPendingCents > 0) return o.refundPendingCents;
  if (o && typeof o.refundedCents === "number" && o.refundedCents > 0) return o.refundedCents;
  return null;
}

export function refundConfirmBody(ticketCount: number): string {
  const base = "Your ticket price comes back to the card you paid with. The service fee isn't refundable.";
  if (ticketCount <= 1) return base;
  return `${base} ${ticketCount === 2 ? "Both tickets" : `All ${ticketCount} tickets`} on this order are refunded together.`;
}

export function refundDoneBody(cents: number | null): string {
  const what = cents != null ? `${money(cents)} is` : "your refund is";
  return `Your tickets are cancelled and ${what} on its way back to your card. It can take 5 to 10 business days to show.`;
}

// ─── Push ────────────────────────────────────────────────────────────────────

/** Backend addressReveal.ts sends data { type: "address_reveal", eventId }. Every other type is ignored. */
export function ticketPushTarget(data: { type?: unknown; eventId?: unknown } | null | undefined): { eventId: string | null } | null {
  if (!data || data.type !== "address_reveal") return null;
  return { eventId: typeof data.eventId === "string" ? data.eventId : null };
}

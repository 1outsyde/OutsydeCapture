/**
 * Pure helpers for the app's Your events and manage screens. Ported from goutsyde.com app/events/_host/manageLogic.ts. No React, no network.
 * Shapes follow outsyde-backend server/events/eventsRouter.ts (GET /mine, GET /:id/manage, POST /:id/cancel),
 * ticketRefunds.ts (GET /:id/summary, GET /:id/orders, POST /:id/orders/:orderId/refund) and
 * doorRouter.ts (GET /:id/door/guests). Money comes from the summary as the backend gives it, never recomputed.
 * Unit tests: utils/host/manageLogic.test.ts.
 */

import { fmt, money, GENERIC_ERROR } from "../eventsLogic";
import { whenRange, type ApiBody, type HostEvent, type HostTicketType } from "./editorLogic";

/* ---------- /events/mine ---------- */

export interface MineGroups {
  drafts: HostEvent[];
  upcoming: HostEvent[];
  past: HostEvent[];
  cancelled: HostEvent[];
}

const startMs = (e: HostEvent) => new Date(e.startsAt).getTime();
const endMs = (e: HostEvent) => new Date(e.endsAt).getTime();

/** Drafts, Upcoming (not over yet, soonest first), Past (newest first) and Cancelled. A paused event sorts by its time. */
export function groupMine(events: HostEvent[], now: Date = new Date()): MineGroups {
  const t = now.getTime();
  const g: MineGroups = { drafts: [], upcoming: [], past: [], cancelled: [] };
  for (const e of events) {
    if (e.status === "draft") g.drafts.push(e);
    else if (e.status === "cancelled") { if (e.publishedAt) g.cancelled.push(e); } // a discarded draft (never published) is left out
    else if (endMs(e) >= t) g.upcoming.push(e);
    else g.past.push(e);
  }
  g.drafts.sort((a, b) => startMs(a) - startMs(b));
  g.upcoming.sort((a, b) => startMs(a) - startMs(b));
  g.past.sort((a, b) => startMs(b) - startMs(a));
  g.cancelled.sort((a, b) => startMs(b) - startMs(a));
  return g;
}

/** A draft opens the editor; everything else opens the manage page. */
export function eventHref(e: Pick<HostEvent, "id" | "status">): string {
  return e.status === "draft" ? `/events/${e.id}/edit` : `/events/${e.id}/manage`;
}

export type StatusKind = "draft" | "published" | "ended" | "cancelled" | "paused";

/** A live event whose end time has passed is "ended". */
export function isEnded(e: Pick<HostEvent, "endsAt">, now: Date = new Date()): boolean {
  return new Date(e.endsAt).getTime() < now.getTime();
}

export function statusKind(e: Pick<HostEvent, "status" | "endsAt">, now: Date = new Date()): StatusKind {
  if (e.status === "draft") return "draft";
  if (e.status === "cancelled") return "cancelled";
  if (e.status === "paused") return "paused";
  return isEnded(e, now) ? "ended" : "published";
}

export function statusLabel(e: Pick<HostEvent, "status" | "endsAt">, now: Date = new Date()): string {
  return statusKind(e, now).toUpperCase();
}

/** "Sat, Oct 25, 9:00 PM to 2:00 AM" plus the city when there is one. Never a street address. */
export function whenWhere(e: Pick<HostEvent, "startsAt" | "endsAt" | "timezone" | "city" | "state">): string {
  const where = [e.city, e.state].filter((x): x is string => !!x && !!x.trim()).join(", ");
  return where ? `${whenRange(e.startsAt, e.endsAt, e.timezone)}, ${where}` : whenRange(e.startsAt, e.endsAt, e.timezone);
}

/** "12 / 50", or just "12" when the event has no capacity limit. */
export function takenLine(taken: number, capacity: number | null): string {
  return capacity == null ? String(taken) : `${taken} / ${capacity}`;
}

/* ---------- /events/[id]/manage ---------- */

export interface SummaryType { ticketTypeId: string; name: string; priceCents: number; archived: boolean; sold: number; grossCents: number }
export interface Summary {
  ticketTypes: SummaryType[];
  totals: { sold: number; grossCents: number; hostEarningsCents: number; refundedTickets: number; refundedCents: number; refundPendingTickets: number };
  payout: { expectedAt: string | null; status: string; amountCents: number | null; deductedCents: number | null; paidAt: string | null };
}

export interface HostOrder {
  id: string;
  status: string;
  ticketCount: number;
  ticketPriceCents: number;
  hostNetCents: number;
  refunded: boolean;
  refundReason: string | null;
  guest: { firstName: string | null; username: string | null };
  createdAt: string | null;
  completedAt: string | null;
}

export interface DoorGuest {
  ticketId: string;
  firstName: string | null;
  username: string | null;
  ticketTypeName: string;
  checkedInAt: string | null;
  checkedInBy: string | null;
}

export function isSummary(x: unknown): x is Summary {
  const s = x as Summary | null;
  return !!s && Array.isArray(s.ticketTypes) && !!s.totals && typeof s.totals.sold === "number" && !!s.payout && typeof s.payout.status === "string";
}

export function isHostOrder(x: unknown): x is HostOrder {
  const o = x as HostOrder | null;
  return !!o && typeof o.id === "string" && typeof o.status === "string" && typeof o.ticketPriceCents === "number" && !!o.guest;
}

export function isDoorGuest(x: unknown): x is DoorGuest {
  const g = x as DoorGuest | null;
  return !!g && typeof g.ticketId === "string" && typeof g.ticketTypeName === "string";
}

/** First name and @username exactly as the backend returns them. Falls back to the username, then "Guest". */
export function guestName(g: { firstName: string | null; username: string | null }): string {
  const first = g.firstName?.trim();
  if (first) return first;
  return g.username ? `@${g.username}` : "Guest";
}

export function guestHandle(g: { username: string | null }): string {
  return g.username ? `@${g.username}` : "";
}

/** "@maya · General admission". A guest without a first name is already shown as "@maya", so the handle is not repeated. */
export function guestLine(g: DoorGuest): string {
  const handle = g.firstName?.trim() ? guestHandle(g) : "";
  return [handle, g.ticketTypeName].filter(Boolean).join(" · ");
}

export function checkedInCount(guests: DoorGuest[]): number {
  return guests.filter((g) => !!g.checkedInAt).length;
}

export interface TypeRow { id: string; name: string; taken: number; quantity: number | null; pct: number; soldOut: boolean; hidden: boolean }

/** Progress rows for the ticket types: active types from /manage, plus removed types that still have sales in the summary. */
export function typeRows(types: HostTicketType[], summary: Summary | null): TypeRow[] {
  const rows: TypeRow[] = types
    .filter((t) => t.status === "active")
    .map((t) => ({
      id: t.id, name: t.name, taken: t.takenCount, quantity: t.quantity,
      pct: t.quantity > 0 ? Math.max(0, Math.min(100, Math.round((t.takenCount / t.quantity) * 100))) : 0,
      soldOut: t.quantity > 0 && t.takenCount >= t.quantity, hidden: t.hidden,
    }));
  const known = new Set(types.filter((t) => t.status === "active").map((t) => t.id));
  for (const s of summary?.ticketTypes ?? []) {
    if (known.has(s.ticketTypeId) || s.sold <= 0) continue;
    rows.push({ id: s.ticketTypeId, name: s.name, taken: s.sold, quantity: null, pct: 100, soldOut: false, hidden: false });
  }
  return rows;
}

export function typeRowText(r: TypeRow): string {
  if (r.quantity == null) return `${r.taken} sold, removed`;
  return `${r.taken} of ${r.quantity}${r.soldOut ? ", Sold out" : ""}`;
}

const dayFmt: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };

/** The "Paid to your bank" card: a value line and an optional hint, from the summary's payout. */
export function payoutCard(p: Summary["payout"], tz: string, earningsCents: number): { value: string; hint: string | null } {
  switch (p.status) {
    case "paid":
      return { value: p.paidAt ? fmt(p.paidAt, tz, dayFmt) : "Paid", hint: "Paid" };
    case "scheduled":
      return p.expectedAt ? { value: fmt(p.expectedAt, tz, dayFmt), hint: "Expected" } : { value: "Scheduled", hint: null };
    case "payout_setup_needed":
      return { value: "On hold", hint: "Finish payout setup to be paid." };
    case "event_paused":
      return { value: "On hold", hint: "This event is paused by Outsyde." };
    case "on_hold":
      return { value: "On hold", hint: "Outsyde is reviewing this payout." };
    default:
      return { value: earningsCents > 0 ? "Not scheduled" : "Nothing to pay out", hint: null };
  }
}

export const UNAVAILABLE = "Unavailable";

/** Earnings stay an estimate until the payout is created. */
export function earningsHint(p: Summary["payout"]): string {
  return p.status === "paid" ? "Paid out" : "Estimate until your payout is created";
}

export function refundedLine(t: Summary["totals"]): { value: string; hint: string | null } {
  return {
    value: money(t.refundedCents),
    hint: t.refundPendingTickets > 0 ? `${t.refundPendingTickets} ${t.refundPendingTickets === 1 ? "refund" : "refunds"} on the way` : null,
  };
}

/** Paid orders the host can still refund: completed, not refunded, and more than $0. */
export function refundableOrders(orders: HostOrder[], eventStatus: string): HostOrder[] {
  if (eventStatus !== "published") return [];
  return orders.filter((o) => o.status === "completed" && !o.refunded && o.ticketPriceCents > 0);
}

export function orderLine(o: HostOrder): string {
  return `${o.ticketCount} ${o.ticketCount === 1 ? "ticket" : "tickets"}, ${money(o.ticketPriceCents)}`;
}

export function refundConfirmCopy(o: HostOrder): string {
  return `Refund ${guestName(o.guest)}'s order of ${money(o.ticketPriceCents)}? They get their money back and their tickets stop working. You can't undo this.`;
}

/** Cancel is offered for drafts and for live events that have not ended. The backend decides the rest and its message is shown when it refuses. */
export function canCancel(e: Pick<HostEvent, "status" | "endsAt">, now: Date = new Date()): boolean {
  if (e.status === "draft") return true;
  return e.status === "published" && !isEnded(e, now);
}

/** Scanning and sharing only make sense for a live event that has not ended. */
export function canScan(e: Pick<HostEvent, "status" | "endsAt">, now: Date = new Date()): boolean {
  return e.status === "published" && !isEnded(e, now);
}

export const CANCEL_CONFIRM_COPY =
  "Cancel this event? Every guest who paid is refunded in full, and free RSVPs are cancelled. You can't undo this.";

export const DRAFT_DISCARD_COPY = "Discard this draft? It won't be published.";

export function cancelNotice(guests: unknown): string {
  const g = guests as { freeCancelled?: unknown; refunding?: unknown } | null;
  const free = typeof g?.freeCancelled === "number" ? g.freeCancelled : 0;
  const paid = typeof g?.refunding === "number" ? g.refunding : 0;
  const bits: string[] = [];
  if (free > 0) bits.push(`${free} ${free === 1 ? "RSVP" : "RSVPs"} cancelled`);
  if (paid > 0) bits.push(`${paid} ${paid === 1 ? "refund" : "refunds"} started`);
  return bits.length ? `This event is cancelled. ${bits.join(", ")}.` : "This event is cancelled.";
}

/**
 * Error rule for host actions (cancel, refund, door team add and remove, check in undo): show the backend's
 * full message, which names the exact reason ("This event has already started."). A failed network call
 * (status 0), a server error (500 or more) or a body without a message gets the generic line. Never a raw code.
 * Everywhere else (loading lists, buyer pages) use errorCopy from app/e/_shared/format.ts, which maps known
 * codes to fixed copy.
 */
export function backendMessage(status: number, body: ApiBody): string {
  if (status === 0 || status >= 500) return GENERIC_ERROR;
  return typeof body?.error === "string" && body.error.trim() ? body.error : GENERIC_ERROR;
}

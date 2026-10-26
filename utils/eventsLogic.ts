/**
 * Pure helpers for Events in the app: Discover EVENTS tab, Pro feed event cards and the event page.
 * No React, no network. Ported from goutsyde.com (app/events/eventsLogic.ts, app/e/_shared/format.ts)
 * so the app and the web show the same labels and send the same queries.
 */

export const NEAR_ME_RADIUS_KM = 40;
export const PAGE_SIZE = 20;
/** Pro feed: events starting within this many days, at most one card per FEED_EVENT_EVERY posts. */
export const FEED_EVENT_DAYS = 14;
export const FEED_EVENT_EVERY = 8;
export const FEED_EVENT_LIMIT = 10;
/** Index of the first event card in the Pro feed (after the 4th post). */
const FEED_FIRST_EVENT_AT = 4;

export const GENERIC_ERROR = "Something went wrong. Try again.";

/** Same copy table as goutsyde.com (app/e/_shared/format.ts CODE_COPY). */
export const CODE_COPY: Record<string, string> = {
  SOLD_OUT: "These tickets are sold out.",
  EVENT_FULL: "Sorry, this event is full.",
  LIMIT_REACHED: "You already have the most tickets allowed for this event.",
  SALES_ENDED: "Ticket sales for this event have ended.",
  SALES_NOT_STARTED: "Ticket sales haven't started yet.",
  NOT_OPEN_YET: "This event isn't open for tickets yet.",
  EVENT_STARTED: "This event has already started.",
  EVENT_CANCELLED: "This event was cancelled.",
  TRY_AGAIN: "Tickets just changed. Try again.",
  PAID_TICKET: "This ticket isn't free.",
  IDEMPOTENCY_KEY_REUSED: "Your ticket choice changed. Try again.",
  CHECKOUT_CLOSED: "That checkout closed. Choose your tickets again.",
  ACCOUNT_INACTIVE: "This account can't buy tickets right now. Contact Outsyde support.",
  PAYMENT_SETUP_FAILED: "Couldn't start the payment. Your tickets were released. Try again.",
};

// ─── Types (shapes returned by the backend) ──────────────────────────────────

/** One card from GET /api/events (backend server/events/eventList.ts EventCard). */
export interface EventCard {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  city: string | null;
  state: string | null;
  venueName: string | null;
  addressHidden: boolean;
  host: { name: string; avatarUrl: string | null; kind: string };
  priceFromCents: number | null;
  hasFree: boolean;
  soldOut: boolean;
}

export type SalesStatus = "on_sale" | "upcoming" | "sold_out" | "ended" | "locked";

/** A ticket type on GET /api/events/slug/:slug. */
export interface PublicTicketType {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  serviceFeeCents: number | null;
  buyerTotalCents: number | null;
  salesStatus: SalesStatus | string;
  remaining: number | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
  minPerOrder: number | null;
  maxPerOrder: number | null;
  perAccountLimit: number | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  status: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  addressHidden: boolean;
  addressRevealAt: string | null;
  refundPolicy: string;
  refundCutoffHours: number | null;
  visibility: string;
  soldOut: boolean;
  host: { name: string; avatarUrl: string | null; kind: string; followId: string | null };
  viewerIsHost: boolean;
  viewerHasTicket: boolean;
}

export interface EventPage {
  event: PublicEvent;
  ticketTypes: PublicTicketType[];
}

export type WhenFilter = "tonight" | "weekend" | null;
export interface Filters {
  near: boolean;
  free: boolean;
  when: WhenFilter;
}
export interface Coords {
  lat: number;
  lng: number;
}

// ─── Time zones ──────────────────────────────────────────────────────────────

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number; dow: number };

export function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Wall clock parts of an instant in a time zone. dow: 0 is Sunday. Works without formatToParts (Hermes). */
export function zonedParts(date: Date, tz: string): Parts {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: safeZone(tz), hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  };
  const f = new Intl.DateTimeFormat("en-US", opts);
  let y: number, m: number, d: number, h: number, mi: number, s: number;
  if (typeof (f as any).formatToParts === "function") {
    const p: Record<string, number> = {};
    for (const x of f.formatToParts(date)) if (x.type !== "literal") p[x.type] = Number(x.value);
    ({ year: y, month: m, day: d, hour: h, minute: mi, second: s } = p as any);
  } else {
    const match = f.format(date).match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/);
    if (!match) throw new Error("Unreadable date");
    [m, d, y, h, mi, s] = match.slice(1).map(Number);
  }
  if (h === 24) h = 0;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, h, mi, s, dow };
}

function offsetMs(at: number, tz: string): number {
  const p = zonedParts(new Date(at), tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(at / 1000) * 1000;
}

/** The instant at which the wall clock in `tz` reads y-m-d h:mi:s. Month is 1 to 12; days may overflow. */
export function zonedInstant(y: number, m: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  let t = guess - offsetMs(guess, tz);
  t = guess - offsetMs(t, tz);
  return new Date(t);
}

export function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("en-US", { ...opts, timeZone: safeZone(tz) });
}

/** Tonight: now until 23:59:59 today in the viewer's time zone. */
export function tonightRange(now: Date, tz: string): { from: string; to: string } {
  const p = zonedParts(now, tz);
  return { from: now.toISOString(), to: zonedInstant(p.y, p.m, p.d, 23, 59, 59, tz).toISOString() };
}

/** This weekend: Friday 5:00 PM to Sunday 23:59:59 of the current or coming weekend; inside it, from now. */
export function weekendRange(now: Date, tz: string): { from: string; to: string } {
  const p = zonedParts(now, tz);
  const back = p.dow === 6 ? 1 : p.dow === 0 ? 2 : 0;
  const ahead = p.dow >= 1 && p.dow <= 4 ? 5 - p.dow : 0;
  const day = (offset: number) => {
    const t = new Date(Date.UTC(p.y, p.m - 1, p.d + offset));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  };
  const fri = day(ahead - back);
  const sun = day(ahead - back + 2);
  const start = zonedInstant(fri.y, fri.m, fri.d, 17, 0, 0, tz);
  const end = zonedInstant(sun.y, sun.m, sun.d, 23, 59, 59, tz);
  return { from: (now.getTime() > start.getTime() ? now : start).toISOString(), to: end.toISOString() };
}

// ─── Queries for GET /api/events (lat/lng only here, never to /api/feed) ─────

export function buildEventsQuery(opts: {
  filters: Filters;
  now: Date;
  tz: string;
  coords?: Coords | null;
  city?: string | null;
  cursor?: string | null;
  limit?: number;
}): string {
  const q = new URLSearchParams();
  const { filters } = opts;
  if (opts.city) q.set("city", opts.city);
  if (filters.when) {
    const r = filters.when === "tonight" ? tonightRange(opts.now, opts.tz) : weekendRange(opts.now, opts.tz);
    q.set("from", r.from);
    q.set("to", r.to);
  }
  if (filters.free) q.set("free", "true");
  if (filters.near && opts.coords) {
    q.set("lat", String(opts.coords.lat));
    q.set("lng", String(opts.coords.lng));
    q.set("radiusKm", String(NEAR_ME_RADIUS_KM));
  }
  q.set("limit", String(opts.limit ?? PAGE_SIZE));
  if (opts.cursor) q.set("cursor", opts.cursor);
  return q.toString();
}

/** Events for the Pro feed: starting in the next 14 days; nearest only when coords are already known. */
export function feedEventsQuery(now: Date, coords: Coords | null): string {
  const q = new URLSearchParams();
  q.set("from", now.toISOString());
  q.set("to", new Date(now.getTime() + FEED_EVENT_DAYS * 86_400_000).toISOString());
  if (coords) {
    q.set("lat", String(coords.lat));
    q.set("lng", String(coords.lng));
    q.set("radiusKm", String(NEAR_ME_RADIUS_KM));
  }
  q.set("limit", String(FEED_EVENT_LIMIT));
  return q.toString();
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const ymd = (p: Parts) => `${p.y}-${p.m}-${p.d}`;
const timeOf = (iso: string, tz: string) => fmt(iso, tz, { hour: "numeric", minute: "2-digit" });

/** "TONIGHT · 7:30 PM" (today from 5 PM), "TODAY · 10:00 AM", else "SAT, OCT 25 · 9:00 PM", in the event's zone. */
export function whenLabel(e: { startsAt: string; timezone: string }, now: Date): string {
  const start = new Date(e.startsAt);
  const time = timeOf(e.startsAt, e.timezone);
  const sp = zonedParts(start, e.timezone);
  if (ymd(sp) === ymd(zonedParts(now, e.timezone))) {
    return `${sp.h >= 17 ? "TONIGHT" : "TODAY"} · ${time}`.toUpperCase();
  }
  const day = fmt(e.startsAt, e.timezone, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${time}`.toUpperCase();
}

/** "SAT, OCT 25 · 9:00 PM TO 2:00 AM" in the event's zone. */
export function rangeLine(e: { startsAt: string; endsAt: string; timezone: string }): string {
  const day = fmt(e.startsAt, e.timezone, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${timeOf(e.startsAt, e.timezone)} to ${timeOf(e.endsAt, e.timezone)}`.toUpperCase();
}

/** The small date block on cards: { weekday: "SAT", day: "25" } in the event's zone. */
export function dateBlock(e: { startsAt: string; timezone: string }): { weekday: string; day: string } {
  return {
    weekday: fmt(e.startsAt, e.timezone, { weekday: "short" }).toUpperCase(),
    day: String(zonedParts(new Date(e.startsAt), e.timezone).d),
  };
}

function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** "$20.00". Always two decimals. */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function priceLabel(e: Pick<EventCard, "priceFromCents" | "hasFree" | "soldOut">): string {
  if (e.soldOut) return "Sold out";
  if (e.priceFromCents != null && e.priceFromCents > 0) {
    return e.hasFree ? `Free RSVP or from ${dollars(e.priceFromCents)}` : `From ${dollars(e.priceFromCents)}`;
  }
  if (e.hasFree) return "Free RSVP";
  return "";
}

export function whereLabel(e: Pick<EventCard, "venueName" | "city" | "state" | "addressHidden">): string {
  const place = [e.city, e.state].filter((x): x is string => !!x && x.trim() !== "").join(", ");
  const venue = e.venueName && e.venueName.trim() ? e.venueName.trim() : "";
  const line = [venue, place].filter(Boolean).join(" · ");
  if (line) return line;
  return e.addressHidden ? "Address shared with ticket holders" : "";
}

/** "Full address on Saturday, October 31 at 9:00 AM" (no trailing period). */
export function revealLine(iso: string, tz: string): string {
  const day = fmt(iso, tz, { weekday: "long", month: "long", day: "numeric" });
  return `Full address on ${day} at ${timeOf(iso, tz)}`;
}

export function refundLine(e: { refundPolicy: string; refundCutoffHours: number | null }): string {
  if (e.refundPolicy === "no_refunds") return "No refunds.";
  if (e.refundCutoffHours == null) return "Refunds until the event starts.";
  return `Refunds until ${e.refundCutoffHours} hours before the event.`;
}

export function isEventCard(x: unknown): x is EventCard {
  const e = x as EventCard | null;
  return !!e && typeof e.id === "string" && typeof e.slug === "string" && typeof e.title === "string" &&
    typeof e.startsAt === "string" && typeof e.timezone === "string";
}

// ─── Pro feed mixing ─────────────────────────────────────────────────────────

export interface FeedEventItem {
  kind: "event";
  event: EventCard;
}

export function isFeedEventItem(x: unknown): x is FeedEventItem {
  return !!x && (x as FeedEventItem).kind === "event" && isEventCard((x as FeedEventItem).event);
}

/** Puts the first event after post 4, then one more after every further 8 posts. Spare events are dropped. */
export function mixEventsIntoFeed<T>(posts: T[], events: EventCard[], every = FEED_EVENT_EVERY): Array<T | FeedEventItem> {
  if (events.length === 0 || posts.length < FEED_FIRST_EVENT_AT + 1) return posts;
  const out: Array<T | FeedEventItem> = [];
  let next = 0;
  posts.forEach((p, i) => {
    const slot = i - FEED_FIRST_EVENT_AT;
    if (slot >= 0 && slot % every === 0 && next < events.length) out.push({ kind: "event", event: events[next++] });
    out.push(p);
  });
  return out;
}

// ─── Event page ──────────────────────────────────────────────────────────────

interface QtyLimits {
  minPerOrder: number | null;
  maxPerOrder: number | null;
  remaining: number | null;
  perAccountLimit: number | null;
}

export function maxQty(t: QtyLimits): number {
  const caps = [t.maxPerOrder, t.remaining, t.perAccountLimit].filter((n): n is number => typeof n === "number" && n > 0);
  return caps.length ? Math.max(1, Math.min(...caps)) : 10;
}

export function minQty(t: QtyLimits): number {
  return Math.min(t.minPerOrder && t.minPerOrder > 0 ? t.minPerOrder : 1, maxQty(t));
}

/** What a ticket row shows. Only free types on sale are selectable here; paid types open the checkout. */
export function ticketRow(t: PublicTicketType, tz: string): { right: string; sub: string | null; selectable: boolean; paid: boolean } {
  const paid = t.priceCents > 0;
  switch (t.salesStatus) {
    case "on_sale": {
      const left = typeof t.remaining === "number" && t.remaining <= 10 ? `${t.remaining} left` : null;
      if (!paid) return { right: "Free", sub: left, selectable: true, paid };
      const total = t.buyerTotalCents != null ? `${money(t.buyerTotalCents)} with service fee` : null;
      return { right: money(t.priceCents), sub: [total, left].filter(Boolean).join(" · ") || null, selectable: false, paid };
    }
    case "upcoming":
      return { right: t.salesStartAt ? `On sale ${fmt(t.salesStartAt, tz, { month: "short", day: "numeric" })}` : "Not on sale yet", sub: null, selectable: false, paid };
    case "ended":
      return { right: "Sales ended", sub: null, selectable: false, paid };
    case "sold_out":
      return { right: "Sold out", sub: null, selectable: false, paid };
    case "locked":
      return { right: "Opens when the tier before sells out", sub: null, selectable: false, paid };
    default:
      return { right: "", sub: null, selectable: false, paid };
  }
}

/** Copy for an error the app's api.request threw ({ status, body: { error: { code, message } } }). */
export function eventErrorCopy(err: unknown): string {
  const e = err as { status?: number; body?: { error?: { code?: unknown; message?: unknown } } } | null | undefined;
  const status = typeof e?.status === "number" ? e.status : 0;
  const code = typeof e?.body?.error?.code === "string" ? e.body.error.code : "";
  const message = typeof e?.body?.error?.message === "string" ? e.body.error.message.trim() : "";
  if (code && CODE_COPY[code]) return CODE_COPY[code];
  if (!status || status >= 500 || !code) return GENERIC_ERROR;
  return message || GENERIC_ERROR;
}

function newKey(): string {
  return `rsvp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** One idempotency key per RSVP attempt: kept across retries, dropped on success or when the choice changes. */
export function rsvpKeyNext(prev: string | null, action: "attempt" | "success" | "changed"): string | null {
  if (action === "attempt") return prev ?? newKey();
  return null;
}

/** Near me: use a granted location, ask only if never asked, otherwise send to Settings. Never re-prompts after a no. */
export function nearMeDecision(status: "granted" | "denied" | "undetermined", canAskAgain: boolean): "use" | "ask" | "settings" {
  if (status === "granted") return "use";
  if (status === "undetermined" && canAskAgain) return "ask";
  return "settings";
}

// ─── EVENTS tab state ────────────────────────────────────────────────────────

export type EventsTabView = "loading" | "error" | "location" | "nomatch" | "empty" | "list";

/** Which state the EVENTS tab shows. Loaded events always stay up during a refresh or after a failed one. */
export function eventsTabView(s: { loading: boolean; error: boolean; locationOff: boolean; filters: Filters; count: number }): EventsTabView {
  if (s.count > 0) return "list";
  if (s.loading) return "loading";
  if (s.error) return "error";
  if (s.locationOff && s.filters.near) return "location";
  if (s.filters.near || s.filters.free || s.filters.when) return "nomatch";
  return "empty";
}

/** The line above the event page content, or null. */
export function eventBanner(e: Pick<PublicEvent, "status" | "startsAt" | "endsAt">, now: Date): string | null {
  if (e.status === "cancelled") return "This event was cancelled.";
  if (e.status === "draft") return "Draft. Only you can see this page.";
  if (new Date(e.endsAt).getTime() < now.getTime()) return "This event has ended.";
  if (new Date(e.startsAt).getTime() <= now.getTime()) return "This event has started.";
  return null;
}

const onSaleFree = (types: PublicTicketType[]) => types.filter((t) => t.salesStatus === "on_sale" && t.priceCents === 0);

/** When exactly one free type is on sale, it is picked for the guest. */
export function defaultTicketId(types: PublicTicketType[]): string | null {
  const free = onSaleFree(types);
  return free.length === 1 ? free[0].id : null;
}

export type EventPageBar =
  | { kind: "none" }
  | { kind: "rsvp" | "pick" | "buy" | "sold_out"; label: string; value: string };

/**
 * The bottom bar on the event page. rsvp: a free type is picked; pick: choose a free type first;
 * buy: only paid tickets on sale (opens the ticket checkout); sold_out; none: no bar.
 */
export function eventPageBar(e: PublicEvent, types: PublicTicketType[], selectedId: string | null, going: boolean, now: Date): EventPageBar {
  if (e.viewerIsHost || eventBanner(e, now)) return { kind: "none" };
  const onSale = types.filter((t) => t.salesStatus === "on_sale");
  if (onSale.length === 0) {
    const allGone = e.soldOut || (types.length > 0 && types.every((t) => t.salesStatus === "sold_out"));
    return allGone ? { kind: "sold_out", label: "Tickets", value: "Sold out" } : { kind: "none" };
  }
  const holder = going || e.viewerHasTicket;
  const free = holder ? [] : onSaleFree(types);
  const paid = onSale.filter((t) => t.priceCents > 0);
  if (free.length > 0) {
    const label = paid.length > 0 ? "From" : "Price";
    const picked = free.some((t) => t.id === selectedId);
    return { kind: picked ? "rsvp" : "pick", label, value: "Free" };
  }
  if (paid.length === 0) return { kind: "none" };
  const lowest = Math.min(...paid.map((t) => t.buyerTotalCents ?? t.priceCents));
  return { kind: "buy", label: "From", value: money(lowest) };
}

/** After a failed event page load: null keeps the page already on screen; otherwise the screen to show. */
export function pagePhaseAfterError(hadPage: boolean, status: number | undefined): "notfound" | "error" | null {
  if (hadPage) return null;
  return status === 404 ? "notfound" : "error";
}

/** After a failed EVENTS list load the events already on screen stay (a filter change clears them first). */
export function eventsAfterError(prev: EventCard[]): EventCard[] {
  return prev;
}

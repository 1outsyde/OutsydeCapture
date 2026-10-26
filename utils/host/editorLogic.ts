/**
 * Pure helpers for the event create and edit flow in the app. Ported from goutsyde.com app/events/_host/editorLogic.ts
 * (same rules, same copy) so the app and the web host the same way. App differences: the app reads errors in the
 * backend's nested shape (flatError), offers US time zones (usTimeZones), keeps a live event's last visible ticket
 * type (canRemoveType) and asks for payout setup before hosting (hostSetupState). No React, no network.
 * Shapes follow outsyde-backend server/events/eventsRouter.ts (hostEventJson, hostTicketTypeJson) and
 * ticketsRouter.ts (ticket type body). Unit tests: utils/host/editorLogic.test.ts.
 */

import { CODE_COPY, GENERIC_ERROR, fmt, money, safeZone, zonedInstant, zonedParts } from "../eventsLogic";

/** Error body in the web's flat shape { code, error } (see flatError for the app's thrown errors). */
export type ApiBody = { error?: unknown; code?: unknown } | null | undefined;

/** The app's api.request throws { status, body: { error: { code, message } } }; network failures carry no status. */
export function flatError(err: unknown): { status: number; body: ApiBody } {
  const e = err as { status?: unknown; body?: { error?: { code?: unknown; message?: unknown } } } | null | undefined;
  const status = typeof e?.status === "number" ? e.status : 0;
  if (!status) return { status: 0, body: null };
  const inner = e?.body?.error;
  return { status, body: { code: inner?.code, error: inner?.message } };
}

/** Same rule as goutsyde.com failureCopy, with the app's copy table. */
export function failureCopy(status: number, body: ApiBody): { message: string; code: string } {
  const code = typeof body?.code === "string" ? body.code : "";
  if (code && CODE_COPY[code]) return { message: CODE_COPY[code], code };
  if (status >= 500 || !code) return { message: GENERIC_ERROR, code };
  return { message: typeof body?.error === "string" && body.error.trim() ? body.error : GENERIC_ERROR, code };
}

/** Only a Stripe hosted page (https, stripe.com or a subdomain) is a valid place to send someone for payout setup. */
export function stripeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^https:\/\/([^/?#:]+)(?::\d+)?(?:[/?#]|$)/i.exec(value);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (host !== "stripe.com" && !host.endsWith(".stripe.com")) return null;
  return value;
}

export type HostAs = "user" | "business" | "photographer";
export type AddressVisibility = "public" | "ticket_holders" | "ticket_holders_day_of";
export type RefundPolicy = "no_refunds" | "until_cutoff";

/** GET /api/events/:id/manage `event` (backend hostEventJson). */
export interface HostEvent {
  id: string;
  slug: string;
  status: string;
  hostType: HostAs;
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
  addressVisibility: AddressVisibility;
  visibility: "public" | "unlisted";
  capacity: number | null;
  takenCount: number;
  refundPolicy: RefundPolicy;
  refundCutoffHours: number | null;
  publishedAt: string | null;
  cancelledAt: string | null;
}

/** Backend hostTicketTypeJson. */
export interface HostTicketType {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
  takenCount: number;
  salesStartAt: string | null;
  salesEndAt: string | null;
  unlockAfterTicketTypeId: string | null;
  minPerOrder: number;
  maxPerOrder: number;
  perAccountLimit: number | null;
  hidden: boolean;
  sortOrder: number;
  status: string;
}

export function isHostEvent(x: unknown): x is HostEvent {
  const e = x as HostEvent | null;
  return !!e && typeof e.id === "string" && typeof e.slug === "string" && typeof e.title === "string" &&
    typeof e.startsAt === "string" && typeof e.endsAt === "string" && typeof e.timezone === "string";
}

export function isHostTicketType(x: unknown): x is HostTicketType {
  const t = x as HostTicketType | null;
  return !!t && typeof t.id === "string" && typeof t.name === "string" && typeof t.priceCents === "number";
}

/* ---------- form state ---------- */

/** Everything the three steps edit. Text fields are kept as typed; numbers as strings until saved. */
export interface EventForm {
  title: string;
  description: string;
  coverImageUrl: string | null;
  hostAs: HostAs;
  date: string; // YYYY-MM-DD in the event's time zone
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  /** YYYY-MM-DD when the event ends on a day of its own choosing; empty means the start day, or the next day
   * when the end time is before the start time. */
  endDate: string;
  timezone: string;
  venueName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  addressVisibility: AddressVisibility;
  listed: boolean; // Show in Discover -> visibility public, else unlisted
  capacity: string;
  refundPolicy: RefundPolicy;
  refundCutoffHours: string;
}

export function emptyForm(timezone: string): EventForm {
  return {
    title: "", description: "", coverImageUrl: null, hostAs: "user",
    date: "", startTime: "", endTime: "", endDate: "", timezone,
    venueName: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "",
    addressVisibility: "ticket_holders", listed: true,
    capacity: "", refundPolicy: "until_cutoff", refundCutoffHours: "24",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Wall clock date and time in `tz` as an ISO string with that zone's offset, e.g. "2026-10-25T21:00:00-04:00".
 * addDays moves the date forward (used for an end time after midnight). Null when the input is not valid.
 */
export function isoInZone(date: string, time: string, tz: string, addDays = 0): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm || safeZone(tz) !== tz) return null;
  const [y, m, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const at = zonedInstant(y, m, d + addDays, h, mi, 0, tz);
  if (Number.isNaN(at.getTime())) return null;
  const p = zonedParts(at, tz);
  const offsetMin = Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - at.getTime()) / 60000);
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

type TimeFields = Pick<EventForm, "date" | "startTime" | "endTime" | "endDate" | "timezone">;

/** YYYY-MM-DD plus n days (calendar math, no time zone involved). */
export function addDaysToDate(date: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The end day the simple rule gives: the start day, or the next day when the end time is before the start time. */
export function autoEndDate(f: Pick<EventForm, "date" | "startTime" | "endTime">): string {
  if (!f.date) return "";
  return addDaysToDate(f.date, f.endTime && f.startTime && f.endTime < f.startTime ? 1 : 0);
}

/** Start and end from the form. With no end date, an end time earlier than the start time means the next day. */
export function eventTimes(f: TimeFields): { startsAt: string; endsAt: string } | null {
  const startsAt = isoInZone(f.date, f.startTime, f.timezone);
  const endsAt = f.endDate
    ? isoInZone(f.endDate, f.endTime, f.timezone)
    : isoInZone(f.date, f.endTime, f.timezone, f.endTime < f.startTime ? 1 : 0);
  return startsAt && endsAt ? { startsAt, endsAt } : null;
}

function wallHm(iso: string, tz: string): string {
  return fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
}

/**
 * A wall time that doesn't exist on that date (the spring forward gap) is saved as another time. Returns the note
 * to show under the time inputs, or null when the saved time is what was typed.
 */
export function clockChangeNote(date: string, time: string, tz: string): string | null {
  const iso = isoInZone(date, time, tz);
  if (!iso) return null;
  if (iso.slice(0, 10) === date && iso.slice(11, 16) === time) return null;
  return `That time doesn't exist on this date because of the clock change. We'll use ${wallHm(iso, tz)}.`;
}

function wallDate(iso: string, tz: string): string {
  const p = zonedParts(new Date(iso), tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function wallTime(iso: string, tz: string): string {
  const p = zonedParts(new Date(iso), tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

/** Event JSON back into form state (times in the event's own time zone). */
export function formFromEvent(e: HostEvent): EventForm {
  const f = baseFormFromEvent(e);
  // The saved end day. Kept only when the simple rule wouldn't give it (a multi day event), so moving the start
  // date of an ordinary event keeps moving its end with it.
  const endDay = wallDate(e.endsAt, safeZone(e.timezone));
  return { ...f, endDate: endDay === autoEndDate(f) ? "" : endDay };
}

function baseFormFromEvent(e: HostEvent): EventForm {
  const tz = safeZone(e.timezone);
  return {
    title: e.title ?? "",
    description: e.description ?? "",
    coverImageUrl: e.coverImageUrl ?? null,
    hostAs: e.hostType === "business" || e.hostType === "photographer" ? e.hostType : "user",
    date: wallDate(e.startsAt, tz),
    startTime: wallTime(e.startsAt, tz),
    endTime: wallTime(e.endsAt, tz),
    endDate: "",
    timezone: e.timezone,
    venueName: e.venueName ?? "",
    addressLine1: e.addressLine1 ?? "",
    addressLine2: e.addressLine2 ?? "",
    city: e.city ?? "",
    state: e.state ?? "",
    postalCode: e.postalCode ?? "",
    addressVisibility: e.addressVisibility ?? "ticket_holders",
    listed: e.visibility !== "unlisted",
    capacity: e.capacity == null ? "" : String(e.capacity),
    refundPolicy: e.refundPolicy === "until_cutoff" ? "until_cutoff" : "no_refunds",
    refundCutoffHours: e.refundPolicy === "until_cutoff" && e.refundCutoffHours != null ? String(e.refundCutoffHours) : "24",
  };
}

const txt = (s: string): string | null => (s.trim() === "" ? null : s.trim());

function intOrNull(s: string): number | null {
  const v = s.trim();
  return /^\d+$/.test(v) ? Number(v) : null;
}

/** First problem with the details and tickets steps, in plain words; null when the form can be saved. */
export function validateForm(f: EventForm): string | null {
  if (!f.title.trim()) return "Give your event a name.";
  if (f.title.trim().length > 120) return "Keep the event name to 120 characters or fewer.";
  if (!f.date) return "Pick a date for your event.";
  if (!f.startTime || !f.endTime) return "Pick when your event starts and ends.";
  if (!f.endDate && f.startTime === f.endTime) return "The event has to end after it starts.";
  const times = eventTimes(f);
  if (!times) return f.endDate ? "Check the end date, times and time zone." : "Check the date, times and time zone.";
  if (new Date(times.endsAt).getTime() <= new Date(times.startsAt).getTime()) return "The event has to end after it starts.";
  if (f.capacity.trim() !== "") {
    const c = intOrNull(f.capacity);
    if (c == null || c < 1 || c > 100000) return "Capacity has to be a whole number from 1 to 100,000, or left empty.";
  }
  if (f.refundPolicy === "until_cutoff") {
    const h = intOrNull(f.refundCutoffHours);
    if (h == null || h > 8760) return "Enter how many hours before the event refunds stop.";
  }
  return null;
}

function refundFields(f: EventForm): { refundPolicy: RefundPolicy; refundCutoffHours: number | null } {
  return f.refundPolicy === "until_cutoff"
    ? { refundPolicy: "until_cutoff", refundCutoffHours: intOrNull(f.refundCutoffHours) }
    : { refundPolicy: "no_refunds", refundCutoffHours: null };
}

const TEXT_KEYS = ["title", "description", "venueName", "addressLine1", "addressLine2", "city", "state", "postalCode"] as const;

/** POST /api/events body for the first save. Call validateForm first. */
export function createBody(f: EventForm): Record<string, unknown> {
  const times = eventTimes(f);
  const body: Record<string, unknown> = {
    hostAs: f.hostAs,
    title: f.title.trim(),
    startsAt: times?.startsAt,
    endsAt: times?.endsAt,
    timezone: f.timezone,
    addressVisibility: f.addressVisibility,
    visibility: f.listed ? "public" : "unlisted",
    ...refundFields(f),
  };
  for (const k of TEXT_KEYS) if (k !== "title" && txt(f[k]) !== null) body[k] = txt(f[k]);
  if (f.coverImageUrl) body.coverImageUrl = f.coverImageUrl;
  const cap = intOrNull(f.capacity);
  if (cap != null) body.capacity = cap;
  return body;
}

/**
 * PATCH /api/events/:id body with only what changed since `base` (the last saved state). Host type can't
 * change after the draft exists. The start is only sent when its date, time or zone changed (so a started
 * event's start isn't touched); the end whenever any time field changed.
 */
export function patchBody(base: EventForm, f: EventForm): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) {
    if (txt(base[k]) !== txt(f[k])) body[k] = k === "title" ? f.title.trim() : txt(f[k]);
  }
  if (base.coverImageUrl !== f.coverImageUrl) body.coverImageUrl = f.coverImageUrl;
  if (base.addressVisibility !== f.addressVisibility) body.addressVisibility = f.addressVisibility;
  if (base.listed !== f.listed) body.visibility = f.listed ? "public" : "unlisted";
  if (intOrNull(base.capacity) !== intOrNull(f.capacity)) body.capacity = intOrNull(f.capacity);
  const rb = refundFields(base), rf = refundFields(f);
  if (rb.refundPolicy !== rf.refundPolicy || rb.refundCutoffHours !== rf.refundCutoffHours) Object.assign(body, rf);

  const startMoved = base.date !== f.date || base.startTime !== f.startTime || base.timezone !== f.timezone;
  const endMoved = startMoved || base.endTime !== f.endTime || base.endDate !== f.endDate;
  if (endMoved) {
    const times = eventTimes(f);
    if (times) {
      if (startMoved) body.startsAt = times.startsAt;
      body.endsAt = times.endsAt;
    }
  }
  if (base.timezone !== f.timezone) body.timezone = f.timezone;
  return body;
}

/* ---------- ticket type sheet ---------- */

export type SalesStart = "now" | "date" | "after";

export interface TicketSheet {
  paid: boolean;
  name: string;
  price: string; // dollars as typed
  quantity: string;
  maxPerOrder: string;
  perAccountLimit: string; // empty = no limit
  salesStart: SalesStart;
  salesDate: string;
  salesTime: string;
  unlockAfterId: string;
}

/** Defaults: free RSVPs are 1 per order and 1 per person (backend defaults); paid allows up to 10 per order. */
export const SHEET_DEFAULTS = {
  free: { maxPerOrder: "1", perAccountLimit: "1" },
  paid: { maxPerOrder: "10", perAccountLimit: "" },
} as const;

export function emptySheet(paid = false): TicketSheet {
  const d = paid ? SHEET_DEFAULTS.paid : SHEET_DEFAULTS.free;
  return {
    paid, name: "", price: "", quantity: "", maxPerOrder: d.maxPerOrder, perAccountLimit: d.perAccountLimit,
    salesStart: "now", salesDate: "", salesTime: "", unlockAfterId: "",
  };
}

/** Switch Free and Paid, moving the per order and per person fields along only while they hold the other mode's defaults. */
export function switchPaid(s: TicketSheet, paid: boolean): TicketSheet {
  if (s.paid === paid) return s;
  const from = s.paid ? SHEET_DEFAULTS.paid : SHEET_DEFAULTS.free;
  const to = paid ? SHEET_DEFAULTS.paid : SHEET_DEFAULTS.free;
  return {
    ...s, paid,
    maxPerOrder: s.maxPerOrder === from.maxPerOrder ? to.maxPerOrder : s.maxPerOrder,
    perAccountLimit: s.perAccountLimit === from.perAccountLimit ? to.perAccountLimit : s.perAccountLimit,
  };
}

export function sheetFromType(t: HostTicketType, tz: string): TicketSheet {
  const zone = safeZone(tz);
  const salesStart: SalesStart = t.unlockAfterTicketTypeId ? "after" : t.salesStartAt ? "date" : "now";
  return {
    paid: t.priceCents > 0,
    name: t.name,
    price: t.priceCents > 0 ? (t.priceCents / 100).toFixed(2) : "",
    quantity: String(t.quantity),
    maxPerOrder: String(t.maxPerOrder),
    perAccountLimit: t.perAccountLimit == null ? "" : String(t.perAccountLimit),
    salesStart,
    salesDate: t.salesStartAt ? wallDate(t.salesStartAt, zone) : "",
    salesTime: t.salesStartAt ? wallTime(t.salesStartAt, zone) : "",
    unlockAfterId: t.unlockAfterTicketTypeId ?? "",
  };
}

/** "$20", "20.5", "1,000.00" as cents. Null when it isn't a plain amount with at most 2 decimals. */
export function parsePriceCents(s: string): number | null {
  const v = s.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export type SheetResult = { ok: true; body: Record<string, unknown> } | { ok: false; message: string };

/** Ticket type body for POST or PATCH /api/events/:id/ticket-types[/:typeId]. Times use the event's zone. */
export function ticketBody(s: TicketSheet, tz: string): SheetResult {
  const name = s.name.trim();
  if (!name) return { ok: false, message: "Give this ticket type a name." };
  if (name.length > 80) return { ok: false, message: "Keep the name to 80 characters or fewer." };
  let priceCents = 0;
  if (s.paid) {
    const p = parsePriceCents(s.price);
    if (p == null || p < 100 || p > 1_000_000) return { ok: false, message: "Set a price from $1.00 to $10,000.00." };
    priceCents = p;
  }
  const quantity = intOrNull(s.quantity);
  if (quantity == null || quantity < 1 || quantity > 100000) return { ok: false, message: "Enter how many tickets, from 1 to 100,000." };
  const maxPerOrder = intOrNull(s.maxPerOrder);
  if (maxPerOrder == null || maxPerOrder < 1 || maxPerOrder > 20) return { ok: false, message: "Max per order has to be from 1 to 20." };
  let perAccountLimit: number | null = null;
  if (s.perAccountLimit.trim() !== "") {
    perAccountLimit = intOrNull(s.perAccountLimit);
    if (perAccountLimit == null || perAccountLimit < 1 || perAccountLimit > 1000) {
      return { ok: false, message: "The limit per person has to be from 1 to 1,000, or left empty." };
    }
    if (maxPerOrder > perAccountLimit) return { ok: false, message: "Max per order can't be more than the limit per person." };
  }
  let salesStartAt: string | null = null;
  let unlockAfterTicketTypeId: string | null = null;
  if (s.salesStart === "date") {
    salesStartAt = isoInZone(s.salesDate, s.salesTime, tz);
    if (!salesStartAt) return { ok: false, message: "Pick the date and time sales start." };
  } else if (s.salesStart === "after") {
    if (!s.unlockAfterId) return { ok: false, message: "Pick which ticket type has to run out first." };
    unlockAfterTicketTypeId = s.unlockAfterId;
  }
  return {
    ok: true,
    body: { name, priceCents, quantity, maxPerOrder, perAccountLimit, salesStartAt, unlockAfterTicketTypeId },
  };
}

/**
 * Fields of `next` that differ from `base` (both ticket bodies from ticketBody). Used for a ticket type PATCH so
 * unchanged values (price, sales start, unlock) are not sent again. Values are compared as JSON.
 */
export function changedFields(base: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (JSON.stringify(base[k] ?? null) !== JSON.stringify(v ?? null)) out[k] = v;
  return out;
}

/* ---------- labels ---------- */

/** Business and photographer hosts get paid through that profile's own Stripe account, set up in the app. */
export function profilePayoutNote(hostType: HostAs): string {
  return `Payouts for this event go to your ${hostType === "business" ? "business" : "photographer profile"}'s Stripe account. Finish its payout setup in the Outsyde app.`;
}

/** "Sat, Oct 25, 9:00 PM to 2:00 AM", or with both dates when the event ends after the next morning. */
export function whenRange(startsAt: string, endsAt: string, tz: string): string {
  const day = (iso: string) => wallDate(iso, safeZone(tz));
  const start = fmt(startsAt, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const nextDay = addDaysToDate(day(startsAt), 1);
  const endDay = day(endsAt);
  const shortEnd = endDay === day(startsAt) || (endDay === nextDay && wallTime(endsAt, tz) < wallTime(startsAt, tz));
  const end = shortEnd
    ? wallHm(endsAt, tz)
    : fmt(endsAt, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${start} to ${end}`;
}

export function activeTypes(types: HostTicketType[]): HostTicketType[] {
  return types.filter((t) => t.status === "active");
}

/** Mockup 10 row: "50 spots · 1 per person", "On sale now", "Free". */
export function ticketRowLines(t: HostTicketType, all: HostTicketType[], tz: string, now: Date = new Date()): { qty: string; when: string; price: string } {
  const free = t.priceCents === 0;
  const count = t.takenCount > 0 ? `${t.takenCount} of ${t.quantity} taken` : `${t.quantity} ${free ? (t.quantity === 1 ? "spot" : "spots") : (t.quantity === 1 ? "ticket" : "tickets")}`;
  const limit = t.perAccountLimit === 1 ? "1 per person" : t.maxPerOrder > 1 ? `up to ${t.maxPerOrder} per order` : "";
  let when = "On sale now";
  if (t.unlockAfterTicketTypeId) {
    const before = all.find((x) => x.id === t.unlockAfterTicketTypeId);
    when = before ? `Opens when ${before.name} ${before.priceCents === 0 ? "runs out" : "sells out"}` : "Opens when another ticket type runs out";
  } else if (t.salesStartAt && new Date(t.salesStartAt).getTime() > now.getTime()) {
    when = `On sale ${fmt(t.salesStartAt, tz, { month: "short", day: "numeric" })} at ${fmt(t.salesStartAt, tz, { hour: "numeric", minute: "2-digit" })}`;
  }
  if (t.hidden) when = `${when} · hidden`;
  return { qty: [count, limit].filter(Boolean).join(" · "), when, price: free ? "Free" : money(t.priceCents) };
}

/** "Free RSVP (50), General admission (150)". */
export function ticketsSummary(types: HostTicketType[]): string {
  const list = activeTypes(types);
  return list.length ? list.map((t) => `${t.name} (${t.quantity})`).join(", ") : "No tickets yet";
}

export function refundLabel(policy: RefundPolicy, hours: number | null): string {
  if (policy !== "until_cutoff" || hours == null) return "No refunds";
  if (hours === 0) return "Until the event starts";
  return `Until ${hours} ${hours === 1 ? "hour" : "hours"} before`;
}

export function addressLabel(v: AddressVisibility): string {
  if (v === "public") return "Shown to everyone";
  if (v === "ticket_holders_day_of") return "Shown to people with a ticket on the day of the event";
  return "Shown only to people with a ticket";
}

export function hostAsLabel(h: HostAs): string {
  return h === "business" ? "My business" : h === "photographer" ? "My photographer profile" : "Me";
}

/** "Until then they see Freeport, NY only." (mockup 9). */
export function dayOfNote(city: string, state: string): string {
  const place = [city.trim(), state.trim()].filter(Boolean).join(", ");
  return place ? `Until then they see ${place} only.` : "Until then they see the city and state only.";
}

/**
 * Which hosts the person can pick, from /api/auth/me `user`: Me always, a business or photographer profile
 * only when the account has one. The backend still decides (403 with its message, e.g. not approved).
 */
export function hostOptions(me: { businessId?: unknown; photographerId?: unknown } | null | undefined): HostAs[] {
  const out: HostAs[] = ["user"];
  if (me && typeof me.businessId === "string" && me.businessId) out.push("business");
  if (me && typeof me.photographerId === "string" && me.photographerId) out.push("photographer");
  return out;
}

/** Discover card price line from the ticket types (same rule as the list: visible, active types only). */
export function previewPrice(types: HostTicketType[]): { priceFromCents: number | null; hasFree: boolean; soldOut: boolean } {
  const visible = activeTypes(types).filter((t) => !t.hidden);
  const paid = visible.filter((t) => t.priceCents > 0).map((t) => t.priceCents);
  return { priceFromCents: paid.length ? Math.min(...paid) : null, hasFree: visible.some((t) => t.priceCents === 0), soldOut: false };
}

/* ---------- rules mirrored from the backend for hints (the backend decides) ---------- */

/** eventRules.isRefundPolicyChangeAllowed: after publish a policy can only become more flexible. */
export function refundChangeAllowed(
  current: { policy: RefundPolicy; cutoffHours: number | null },
  next: { policy: RefundPolicy; cutoffHours: number | null },
): boolean {
  if (current.policy === "no_refunds") return true;
  if (next.policy === "no_refunds") return false;
  if (current.cutoffHours == null || next.cutoffHours == null) return false;
  return next.cutoffHours <= current.cutoffHours;
}

/** The agreement counts as read once scrolled to within 8 px of the end, or when it doesn't overflow its box. */
export function isScrolledToEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  if (scrollHeight <= clientHeight) return true;
  return scrollTop + clientHeight >= scrollHeight - 8;
}

/* ---------- publish ---------- */

export type PublishNext = "new" | "tickets" | "payouts" | "agreement" | "reload" | "manage" | null;

const PUBLISH_COPY: Record<string, { message: string; next: PublishNext }> = {
  NO_TICKET_TYPES: { message: "Add at least one ticket type before you publish.", next: "tickets" },
  NO_VISIBLE_TICKET_TYPES: { message: "At least one ticket type has to be visible to guests.", next: "tickets" },
  PAID_TICKETS_NOT_AVAILABLE: { message: "Paid tickets aren't available yet. Use free tickets for now.", next: "tickets" },
  PAYOUTS_NOT_SET_UP: { message: "Set up payouts before you publish. Every host needs them, even for free events.", next: "payouts" },
  // A started event's start can't move (backend checkTimes), so the way forward is a new event.
  EVENT_IN_PAST: { message: "This event's start time has passed, so it can't be published. Create a new event with a future date.", next: "new" },
  NOT_A_DRAFT: { message: "This event isn't a draft anymore, so it can't be published again.", next: "manage" },
  HOST_AGREEMENT_REQUIRED: { message: "Read and accept the Event Host Agreement to publish.", next: "agreement" },
  AGREEMENT_VERSION_CHANGED: { message: "The Event Host Agreement was updated. Read the new version to continue.", next: "agreement" },
  EVENT_CHANGED: { message: "This event just changed. Reload and try again.", next: "reload" },
};

/** Publish refusal to copy and the next step the page offers. The backend's own message wins when it sent one. */
export function publishFailure(status: number, body: ApiBody): { message: string; code: string; next: PublishNext } {
  const code = typeof body?.code === "string" ? body.code : "";
  const known = PUBLISH_COPY[code];
  if (known) {
    const own = typeof body?.error === "string" && body.error.trim() ? body.error : known.message;
    // EVENT_IN_PAST's backend text says what happened, not what to do: keep the copy that names the next step.
    return { message: code === "EVENT_IN_PAST" ? known.message : own, code, next: known.next };
  }
  return { ...failureCopy(status, body), next: null };
}

/** Label for the button that takes the next step after a refused publish. */
export function nextStepLabel(next: PublishNext): string | null {
  switch (next) {
    case "new": return "Create a new event";
    case "tickets": return "Go to tickets";
    case "payouts": return "Set up payouts";
    case "reload": return "Reload";
    case "manage": return "Manage event";
    default: return null;
  }
}

/** The US zones hosts pick from (Legend 2026-10-26), east to west. */
export const US_TIME_ZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
] as const;

const ZONE_LABELS: Record<string, string> = {
  "America/New_York": "New York (Eastern)", "America/Chicago": "Chicago (Central)", "America/Denver": "Denver (Mountain)",
  "America/Phoenix": "Phoenix (Arizona)", "America/Los_Angeles": "Los Angeles (Pacific)", "America/Anchorage": "Anchorage (Alaska)",
  "Pacific/Honolulu": "Honolulu (Hawaii)",
};

export function timeZoneLabel(tz: string): string {
  return ZONE_LABELS[tz] ?? tz;
}

/** Picker choices: the event's own zone and the phone's zone first when they aren't US zones, then the US zones. */
export function usTimeZones(current: string, phoneZone: string): string[] {
  const extra = [phoneZone, current].filter((z, i, all) => !!z && safeZone(z) === z && all.indexOf(z) === i && !(US_TIME_ZONES as readonly string[]).includes(z));
  return [...extra, ...US_TIME_ZONES];
}

/**
 * A live event keeps at least one visible ticket type (Legend 2026-10-26): the backend allows removing or hiding
 * the last one, which would leave a live event nobody can join. Drafts can (publish checks there).
 */
export function canRemoveType(eventStatus: string, types: HostTicketType[], typeId: string): { ok: boolean; reason: string | null } {
  if (eventStatus !== "published") return { ok: true, reason: null };
  const others = activeTypes(types).filter((t) => t.id !== typeId && !t.hidden);
  return others.length > 0
    ? { ok: true, reason: null }
    : { ok: false, reason: "A live event needs at least one ticket type. Add another one first, or cancel the event." };
}

/** Before hosting, from GET /api/events/payouts/status: set up, finish, ready, or unknown when it didn't load. */
export function hostSetupState(s: { hasAccount?: unknown; ready?: unknown; needsSetup?: unknown } | null | undefined): "setup" | "finish" | "ready" | "unknown" {
  if (!s || typeof s.ready !== "boolean") return "unknown";
  if (s.ready) return "ready";
  return s.hasAccount ? "finish" : "setup";
}

export function shareUrl(slug: string): string {
  return `https://goutsyde.com/e/${slug}`;
}

/** An http or https link (cover photos from the backend), or null. Regex, since React Native's URL is partial. */
export function safeHttpUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  return /^https?:\/\/[^\s/?#]+[^\s]*$/i.test(u) ? u : null;
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  zonedParts,
  zonedInstant,
  tonightRange,
  weekendRange,
  buildEventsQuery,
  feedEventsQuery,
  whenLabel,
  rangeLine,
  priceLabel,
  whereLabel,
  dateBlock,
  isEventCard,
  mixEventsIntoFeed,
  isFeedEventItem,
  ticketRow,
  eventErrorCopy,
  rsvpKeyNext,
  nearMeDecision,
  revealLine,
  refundLine,
  maxQty,
  minQty,
  money,
  type EventCard,
  type Filters,
  type PublicTicketType,
} from "./eventsLogic";

const NY = "America/New_York";
const none: Filters = { near: false, free: false, when: null };
const now = new Date("2026-10-23T18:00:00Z"); // Friday 2:00 PM in New York

// ─── zonedParts with and without formatToParts (Hermes may not have it) ──────

function withoutFormatToParts<T>(fn: () => T): T {
  const proto = Intl.DateTimeFormat.prototype as any;
  const saved = proto.formatToParts;
  try {
    delete proto.formatToParts;
    return fn();
  } finally {
    proto.formatToParts = saved;
  }
}

test("zonedParts gives the same wall clock with or without formatToParts", () => {
  const cases: Array<[string, string]> = [
    ["2026-11-01T05:30:00Z", NY], // 1:30 AM EDT just before the DST change
    ["2026-11-01T06:30:00Z", NY], // 1:30 AM EST just after it
    ["2026-10-24T04:00:00Z", NY], // midnight local
    ["2026-10-24T07:15:09Z", "America/Los_Angeles"],
    ["2026-10-23T18:00:00Z", "Asia/Tokyo"],
  ];
  for (const [iso, tz] of cases) {
    const a = zonedParts(new Date(iso), tz);
    const b = withoutFormatToParts(() => zonedParts(new Date(iso), tz));
    assert.deepEqual(b, a, `${iso} ${tz}`);
  }
  assert.deepEqual(zonedParts(new Date("2026-10-24T04:00:00Z"), NY), { y: 2026, m: 10, d: 24, h: 0, mi: 0, s: 0, dow: 6 });
});

test("ranges and labels still work with no formatToParts", () => {
  withoutFormatToParts(() => {
    assert.equal(tonightRange(now, NY).to, "2026-10-24T03:59:59.000Z");
    assert.equal(whenLabel({ startsAt: "2026-10-23T23:30:00Z", timezone: NY }, now), "TONIGHT · 7:30 PM");
  });
});

// ─── Date ranges (same cases as goutsyde.com tests/events-list-logic.test.ts) ─

test("tonightRange", () => {
  assert.deepEqual(tonightRange(now, NY), { from: "2026-10-23T18:00:00.000Z", to: "2026-10-24T03:59:59.000Z" });
  assert.equal(tonightRange(new Date("2026-10-24T03:30:00Z"), NY).to, "2026-10-24T03:59:59.000Z");
  assert.equal(tonightRange(now, "Asia/Tokyo").to, "2026-10-24T14:59:59.000Z");
});

test("weekendRange", () => {
  assert.deepEqual(weekendRange(new Date("2026-10-20T16:00:00Z"), NY), { from: "2026-10-23T21:00:00.000Z", to: "2026-10-26T03:59:59.000Z" });
  assert.deepEqual(weekendRange(new Date("2026-10-21T16:00:00Z"), NY), { from: "2026-10-23T21:00:00.000Z", to: "2026-10-26T03:59:59.000Z" }, "Wednesday");
  assert.equal(weekendRange(new Date("2026-10-23T16:00:00Z"), NY).from, "2026-10-23T21:00:00.000Z");
  assert.equal(weekendRange(new Date("2026-10-23T22:00:00Z"), NY).from, "2026-10-23T22:00:00.000Z");
  assert.deepEqual(weekendRange(new Date("2026-10-24T14:00:00Z"), NY), { from: "2026-10-24T14:00:00.000Z", to: "2026-10-26T03:59:59.000Z" });
  assert.equal(weekendRange(new Date("2026-10-26T00:00:00Z"), NY).to, "2026-10-26T03:59:59.000Z");
  assert.deepEqual(weekendRange(new Date("2026-10-26T16:00:00Z"), NY), { from: "2026-10-30T21:00:00.000Z", to: "2026-11-02T04:59:59.000Z" });
});

test("zonedInstant round trips local wall clock", () => {
  assert.equal(zonedInstant(2026, 10, 23, 17, 0, 0, NY).toISOString(), "2026-10-23T21:00:00.000Z");
});

// ─── Queries ─────────────────────────────────────────────────────────────────

test("buildEventsQuery", () => {
  assert.equal(buildEventsQuery({ filters: none, now, tz: NY }), "limit=20");
  assert.equal(buildEventsQuery({ filters: { ...none, free: true }, now, tz: NY }), "free=true&limit=20");
  assert.equal(buildEventsQuery({ filters: { ...none, near: true }, now, tz: NY, coords: { lat: 40.65, lng: -73.58 } }), "lat=40.65&lng=-73.58&radiusKm=40&limit=20");
  assert.equal(buildEventsQuery({ filters: { ...none, near: true }, now, tz: NY, coords: null }), "limit=20");
  assert.equal(
    buildEventsQuery({ filters: { ...none, when: "tonight" }, now, tz: NY, cursor: "abc" }),
    "from=2026-10-23T18%3A00%3A00.000Z&to=2026-10-24T03%3A59%3A59.000Z&limit=20&cursor=abc",
  );
  assert.equal(buildEventsQuery({ filters: none, now, tz: NY, city: "Freeport" }), "city=Freeport&limit=20");
  const q = buildEventsQuery({ filters: { near: true, free: true, when: "weekend" }, now, tz: NY, coords: { lat: 1, lng: 2 } });
  assert.ok(!q.includes("latitude") && !q.includes("longitude"), "never the feed's location names");
});

test("feedEventsQuery: next 14 days, 10 events, nearest only with coords", () => {
  const p = new URLSearchParams(feedEventsQuery(now, null));
  assert.equal(p.get("from"), "2026-10-23T18:00:00.000Z");
  assert.equal(p.get("to"), "2026-11-06T18:00:00.000Z");
  assert.equal(p.get("limit"), "10");
  assert.equal(p.get("lat"), null);
  const q = new URLSearchParams(feedEventsQuery(now, { lat: 40.65, lng: -73.58 }));
  assert.equal(q.get("lat"), "40.65");
  assert.equal(q.get("lng"), "-73.58");
  assert.equal(q.get("radiusKm"), "40");
});

// ─── Labels ──────────────────────────────────────────────────────────────────

test("whenLabel uses the event's own zone", () => {
  assert.equal(whenLabel({ startsAt: "2026-10-23T23:30:00Z", timezone: NY }, now), "TONIGHT · 7:30 PM");
  assert.equal(whenLabel({ startsAt: "2026-10-23T20:59:00Z", timezone: NY }, now), "TODAY · 4:59 PM");
  assert.equal(whenLabel({ startsAt: "2026-10-23T21:00:00Z", timezone: NY }, now), "TONIGHT · 5:00 PM");
  assert.equal(whenLabel({ startsAt: "2026-10-26T01:00:00Z", timezone: NY }, now), "SUN, OCT 25 · 9:00 PM");
  assert.equal(whenLabel({ startsAt: "2026-10-26T01:00:00Z", timezone: "America/Los_Angeles" }, now), "SUN, OCT 25 · 6:00 PM");
});

test("rangeLine", () => {
  assert.equal(
    rangeLine({ startsAt: "2026-10-26T01:00:00Z", endsAt: "2026-10-26T06:00:00Z", timezone: NY }),
    "SUN, OCT 25 · 9:00 PM TO 2:00 AM",
  );
});

test("priceLabel", () => {
  assert.equal(priceLabel({ priceFromCents: null, hasFree: true, soldOut: false }), "Free RSVP");
  assert.equal(priceLabel({ priceFromCents: 2000, hasFree: false, soldOut: false }), "From $20");
  assert.equal(priceLabel({ priceFromCents: 2550, hasFree: false, soldOut: false }), "From $25.50");
  assert.equal(priceLabel({ priceFromCents: 2000, hasFree: true, soldOut: false }), "Free RSVP or from $20");
  assert.equal(priceLabel({ priceFromCents: 2000, hasFree: false, soldOut: true }), "Sold out");
  assert.equal(priceLabel({ priceFromCents: null, hasFree: false, soldOut: false }), "");
});

test("whereLabel", () => {
  assert.equal(whereLabel({ venueName: "The Hall", city: "Freeport", state: "NY", addressHidden: false }), "The Hall · Freeport, NY");
  assert.equal(whereLabel({ venueName: null, city: "Freeport", state: "NY", addressHidden: true }), "Freeport, NY");
  assert.equal(whereLabel({ venueName: null, city: null, state: null, addressHidden: true }), "Address shared with ticket holders");
  assert.equal(whereLabel({ venueName: null, city: null, state: null, addressHidden: false }), "");
});

test("dateBlock", () => {
  assert.deepEqual(dateBlock({ startsAt: "2026-10-26T01:00:00Z", timezone: NY }), { weekday: "SUN", day: "25" });
});

test("revealLine and refundLine", () => {
  assert.equal(revealLine("2026-10-31T13:00:00Z", NY), "Full address on Saturday, October 31 at 9:00 AM");
  assert.equal(refundLine({ refundPolicy: "no_refunds", refundCutoffHours: null }), "No refunds.");
  assert.equal(refundLine({ refundPolicy: "until_cutoff", refundCutoffHours: null }), "Refunds until the event starts.");
  assert.equal(refundLine({ refundPolicy: "until_cutoff", refundCutoffHours: 24 }), "Refunds until 24 hours before the event.");
});

test("money", () => {
  assert.equal(money(2259), "$22.59");
  assert.equal(money(2000), "$20.00");
});

test("isEventCard", () => {
  assert.ok(isEventCard(card("a")));
  assert.ok(!isEventCard({ id: "a" }));
  assert.ok(!isEventCard(null));
});

// ─── Pro feed mixing ─────────────────────────────────────────────────────────

function card(id: string): EventCard {
  return {
    id, slug: `s-${id}`, title: `T ${id}`, coverImageUrl: null, startsAt: "2026-10-26T01:00:00Z", endsAt: "2026-10-26T06:00:00Z",
    timezone: NY, city: "Freeport", state: "NY", venueName: null, addressHidden: true,
    host: { name: "Host", avatarUrl: null, kind: "user" }, priceFromCents: null, hasFree: true, soldOut: false,
  };
}
const posts = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

test("mixEventsIntoFeed: first card after post 4, then one per 8 posts", () => {
  const mixed = mixEventsIntoFeed(posts(10), [card("e1"), card("e2")]);
  assert.equal(mixed.length, 11);
  assert.ok(isFeedEventItem(mixed[4]) && mixed[4].event.id === "e1");
  assert.equal(mixed.filter(isFeedEventItem).length, 1, "16 posts are needed for a second card");
  const twenty = mixEventsIntoFeed(posts(20), [card("e1"), card("e2"), card("e3")]);
  const at = twenty.map((x, i) => (isFeedEventItem(x) ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(at, [4, 13]);
});

test("mixEventsIntoFeed: short feeds and no events stay unchanged", () => {
  const three = posts(3);
  assert.deepEqual(mixEventsIntoFeed(three, [card("e1")]), three);
  assert.deepEqual(mixEventsIntoFeed(posts(9), []), posts(9));
  assert.ok(!isFeedEventItem({ id: "p1" }));
});

// ─── Ticket rows ─────────────────────────────────────────────────────────────

function tt(over: Partial<PublicTicketType>): PublicTicketType {
  return {
    id: "t", name: "GA", description: null, priceCents: 0, serviceFeeCents: null, buyerTotalCents: null,
    salesStatus: "on_sale", remaining: 100, salesStartAt: null, salesEndAt: null, minPerOrder: 1, maxPerOrder: 10,
    perAccountLimit: null, ...over,
  };
}

test("ticketRow", () => {
  assert.deepEqual(ticketRow(tt({}), NY), { right: "Free", sub: null, selectable: true, paid: false });
  assert.deepEqual(ticketRow(tt({ remaining: 10 }), NY), { right: "Free", sub: "10 left", selectable: true, paid: false });
  assert.deepEqual(
    ticketRow(tt({ priceCents: 2000, serviceFeeCents: 259, buyerTotalCents: 2259 }), NY),
    { right: "$20.00", sub: "$22.59 with service fee", selectable: false, paid: true },
  );
  assert.equal(ticketRow(tt({ salesStatus: "sold_out" }), NY).right, "Sold out");
  assert.equal(ticketRow(tt({ salesStatus: "sold_out" }), NY).selectable, false);
  assert.equal(ticketRow(tt({ salesStatus: "upcoming", salesStartAt: "2026-10-26T14:00:00Z" }), NY).right, "On sale Oct 26");
  assert.equal(ticketRow(tt({ salesStatus: "upcoming" }), NY).right, "Not on sale yet");
  assert.equal(ticketRow(tt({ salesStatus: "ended" }), NY).right, "Sales ended");
  assert.equal(ticketRow(tt({ salesStatus: "locked" }), NY).right, "Opens when the tier before sells out");
});

test("quantity limits", () => {
  assert.equal(maxQty({ minPerOrder: 1, maxPerOrder: 4, remaining: 2, perAccountLimit: null }), 2);
  assert.equal(maxQty({ minPerOrder: 1, maxPerOrder: null, remaining: null, perAccountLimit: null }), 10);
  assert.equal(minQty({ minPerOrder: 2, maxPerOrder: 4, remaining: 100, perAccountLimit: null }), 2);
  assert.equal(minQty({ minPerOrder: 3, maxPerOrder: 4, remaining: 1, perAccountLimit: null }), 1);
});

// ─── Errors, retry keys, location ────────────────────────────────────────────

test("eventErrorCopy reads the app's thrown error", () => {
  assert.equal(eventErrorCopy({ status: 409, body: { success: false, error: { code: "SOLD_OUT", message: "Sold out." } } }), "These tickets are sold out.");
  assert.equal(eventErrorCopy({ status: 409, body: { error: { code: "SOMETHING_NEW", message: "A plain sentence." } } }), "A plain sentence.");
  assert.equal(eventErrorCopy({ status: 500, body: { error: { code: "SERVER_ERROR", message: "Couldn't save your RSVP." } } }), "Something went wrong. Try again.");
  assert.equal(eventErrorCopy({ message: "Network error" }), "Something went wrong. Try again.");
  assert.equal(eventErrorCopy(undefined), "Something went wrong. Try again.");
});

test("rsvpKeyNext reuses one key per attempt", () => {
  const k = rsvpKeyNext(null, "attempt");
  assert.ok(typeof k === "string" && k.length >= 8 && k.length <= 100);
  assert.equal(rsvpKeyNext(k, "attempt"), k);
  assert.equal(rsvpKeyNext(k, "success"), null);
  assert.equal(rsvpKeyNext(k, "changed"), null);
  assert.notEqual(rsvpKeyNext(null, "attempt"), k);
});

test("nearMeDecision never re-prompts after a no", () => {
  assert.equal(nearMeDecision("granted", false), "use");
  assert.equal(nearMeDecision("granted", true), "use");
  assert.equal(nearMeDecision("undetermined", true), "ask");
  assert.equal(nearMeDecision("undetermined", false), "settings");
  assert.equal(nearMeDecision("denied", false), "settings");
  assert.equal(nearMeDecision("denied", true), "settings");
});

// ─── EVENTS tab state ────────────────────────────────────────────────────────
import { eventsTabView } from "./eventsLogic";

test("eventsTabView picks one state", () => {
  const base = { loading: false, error: false, locationOff: false, filters: none, count: 0 };
  assert.equal(eventsTabView({ ...base, loading: true }), "loading");
  assert.equal(eventsTabView({ ...base, loading: true, count: 3 }), "list", "refresh keeps the list up");
  assert.equal(eventsTabView({ ...base, error: true }), "error");
  assert.equal(eventsTabView({ ...base, error: true, count: 2 }), "list", "a failed refresh keeps what loaded");
  assert.equal(eventsTabView({ ...base, locationOff: true, filters: { ...none, near: true } }), "location");
  assert.equal(eventsTabView({ ...base, filters: { ...none, free: true } }), "nomatch");
  assert.equal(eventsTabView({ ...base, filters: { ...none, near: true } }), "nomatch");
  assert.equal(eventsTabView(base), "empty");
  assert.equal(eventsTabView({ ...base, count: 1 }), "list");
});

// ─── Event page: banner, default pick, bottom bar ────────────────────────────
import { eventBanner, defaultTicketId, eventPageBar, type PublicEvent } from "./eventsLogic";

function ev(over: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: "e", slug: "s", status: "published", title: "Party", description: null, coverImageUrl: null,
    startsAt: "2026-10-26T01:00:00Z", endsAt: "2026-10-26T06:00:00Z", timezone: NY,
    venueName: null, addressLine1: null, addressLine2: null, city: "Freeport", state: "NY", postalCode: null,
    addressHidden: true, addressRevealAt: null, refundPolicy: "no_refunds", refundCutoffHours: null,
    visibility: "public", soldOut: false, host: { name: "Host", avatarUrl: null, kind: "user", followId: "u1" },
    viewerIsHost: false, viewerHasTicket: false, ...over,
  };
}

test("eventBanner", () => {
  assert.equal(eventBanner(ev({ status: "cancelled" }), now), "This event was cancelled.");
  assert.equal(eventBanner(ev({ status: "draft" }), now), "Draft. Only you can see this page.");
  assert.equal(eventBanner(ev({ startsAt: "2026-10-23T17:00:00Z", endsAt: "2026-10-23T22:00:00Z" }), now), "This event has started.");
  assert.equal(eventBanner(ev({ startsAt: "2026-10-22T17:00:00Z", endsAt: "2026-10-22T22:00:00Z" }), now), "This event has ended.");
  assert.equal(eventBanner(ev(), now), null);
});

test("defaultTicketId picks the only free type on sale", () => {
  assert.equal(defaultTicketId([tt({ id: "a" })]), "a");
  assert.equal(defaultTicketId([tt({ id: "a" }), tt({ id: "b" })]), null);
  assert.equal(defaultTicketId([tt({ id: "a" }), tt({ id: "p", priceCents: 2000 })]), "a");
  assert.equal(defaultTicketId([tt({ id: "a", salesStatus: "sold_out" })]), null);
});

test("eventPageBar", () => {
  const free = tt({ id: "f" });
  const paid = tt({ id: "p", priceCents: 2000, buyerTotalCents: 2259 });
  assert.deepEqual(eventPageBar(ev(), [free], "f", false, now), { kind: "rsvp", label: "Price", value: "Free" });
  assert.deepEqual(eventPageBar(ev(), [free], null, false, now), { kind: "pick", label: "Price", value: "Free" });
  assert.deepEqual(eventPageBar(ev(), [paid], null, false, now), { kind: "paid_soon", label: "From", value: "$22.59" });
  assert.deepEqual(eventPageBar(ev(), [free, paid], null, false, now), { kind: "pick", label: "From", value: "Free" });
  assert.deepEqual(eventPageBar(ev(), [tt({ salesStatus: "sold_out" })], null, false, now), { kind: "sold_out", label: "Tickets", value: "Sold out" });
  assert.equal(eventPageBar(ev({ viewerHasTicket: true }), [free], "f", false, now).kind, "none", "holder of free tickets");
  assert.equal(eventPageBar(ev(), [free], "f", true, now).kind, "none", "just RSVPed");
  assert.equal(eventPageBar(ev({ viewerHasTicket: true }), [free, paid], null, false, now).kind, "paid_soon", "holder can still see paid");
  assert.equal(eventPageBar(ev({ status: "cancelled" }), [free], "f", false, now).kind, "none");
  assert.equal(eventPageBar(ev({ startsAt: "2026-10-23T17:00:00Z" }), [free], "f", false, now).kind, "none", "started");
  assert.equal(eventPageBar(ev({ viewerIsHost: true }), [free], "f", false, now).kind, "none", "host");
  assert.equal(eventPageBar(ev(), [tt({ salesStatus: "upcoming" })], null, false, now).kind, "none", "nothing on sale yet");
});

// ─── Review fixes: a failed reload or refresh never throws away what loaded ──
import { pagePhaseAfterError, eventsAfterError } from "./eventsLogic";

test("pagePhaseAfterError keeps a loaded event page", () => {
  assert.equal(pagePhaseAfterError(true, 500), null, "keep the page");
  assert.equal(pagePhaseAfterError(true, 404), null, "keep the page even on a later 404");
  assert.equal(pagePhaseAfterError(true, undefined), null, "keep the page on a timeout");
  assert.equal(pagePhaseAfterError(false, 404), "notfound");
  assert.equal(pagePhaseAfterError(false, 500), "error");
  assert.equal(pagePhaseAfterError(false, undefined), "error");
});

test("eventsAfterError keeps the loaded list", () => {
  const list = [card("a"), card("b")];
  assert.deepEqual(eventsAfterError(list), list);
  assert.deepEqual(eventsAfterError([]), []);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  POLL_EVERY_MS,
  POLL_MAX_MS,
  quoteLines,
  checkoutKeyNext,
  checkoutKeyAfterError,
  checkoutResponseKind,
  holdMsLeft,
  holdClock,
  sheetOutcome,
  pollDecision,
  splitTickets,
  groupInfo,
  addressTag,
  directionsUrl,
  calendarEventFor,
  refundErrorCopy,
  cancelErrorCopy,
  refundShownCents,
  refundConfirmBody,
  refundDoneBody,
  ticketPushTarget,
  orderKind,
  ticketPlaceLine,
  type MyTicket,
} from "./ticketCheckoutLogic";
import type { PublicTicketType } from "./eventsLogic";

const ga: PublicTicketType = {
  id: "ga", name: "General admission", description: null, priceCents: 2000, serviceFeeCents: 259, buyerTotalCents: 2259,
  salesStatus: "on_sale", remaining: null, salesStartAt: null, salesEndAt: null, minPerOrder: 1, maxPerOrder: 6, perAccountLimit: null,
};

const apiErr = (status: number, code: string, message = "Backend text.") => ({ status, body: { success: false, error: { code, message } } });

function ticket(over: Partial<MyTicket> = {}, ev: Partial<MyTicket["event"]> = {}): MyTicket {
  return {
    id: "t1", code: "ABCD1234", status: "valid", orderId: "o1", checkedInAt: null, ticketTypeName: "General admission",
    qrUrl: "https://outsyde-backend.onrender.com/api/events/qr/tok.png",
    event: {
      id: "e1", slug: "night", title: "Night", status: "published", startsAt: "2026-10-31T01:00:00.000Z",
      endsAt: "2026-10-31T06:00:00.000Z", timezone: "America/New_York", coverImageUrl: null, city: "Freeport", state: "NY",
      venueName: "The Spot", addressLine1: "1 Main St", addressLine2: null, postalCode: "11520", addressHidden: false, addressRevealAt: null,
      ...ev,
    },
    ...over,
  };
}

// ─── Quote (screen 25) ──────────────────────────────────────────────────────

test("quoteLines: qty x price, qty x per ticket fee, qty x buyer total", () => {
  assert.deepEqual(quoteLines(ga, 2), { line: "2 × General admission", subtotalCents: 4000, feeCents: 518, totalCents: 4518 });
});

test("quoteLines: missing fee fields fall back to price only", () => {
  const t = { ...ga, serviceFeeCents: null, buyerTotalCents: null };
  assert.deepEqual(quoteLines(t, 1), { line: "1 × General admission", subtotalCents: 2000, feeCents: 0, totalCents: 2000 });
});

// ─── Idempotency key ────────────────────────────────────────────────────────

test("checkoutKeyNext: attempt keeps the key across retries", () => {
  const k = checkoutKeyNext(null, "attempt");
  assert.ok(k && k.length >= 8 && k.length <= 100);
  assert.equal(checkoutKeyNext(k, "attempt"), k);
});

test("checkoutKeyNext: success, changed and closed drop the key", () => {
  assert.equal(checkoutKeyNext("tix-abcdefgh", "success"), null);
  assert.equal(checkoutKeyNext("tix-abcdefgh", "changed"), null);
  assert.equal(checkoutKeyNext("tix-abcdefgh", "closed"), null);
});

test("checkoutKeyAfterError: closed or reused or setup failed start a new key; network errors keep it", () => {
  for (const code of ["CHECKOUT_CLOSED", "IDEMPOTENCY_KEY_REUSED", "PAYMENT_SETUP_FAILED"]) {
    assert.equal(checkoutKeyAfterError("tix-abcdefgh", apiErr(409, code)), null, code);
  }
  assert.equal(checkoutKeyAfterError("tix-abcdefgh", new TypeError("Network request failed")), "tix-abcdefgh");
  assert.equal(checkoutKeyAfterError("tix-abcdefgh", apiErr(409, "TRY_AGAIN")), "tix-abcdefgh");
});

// ─── Checkout response ──────────────────────────────────────────────────────

test("checkoutResponseKind: client secret means pay", () => {
  assert.equal(checkoutResponseKind({ orderId: "o1", clientSecret: "pi_secret", holdExpiresAt: "2026-10-26T16:10:00Z", totalCents: 4518 }), "pay");
});

test("checkoutResponseKind: a repeated key with a finished order means paid", () => {
  assert.equal(checkoutResponseKind({ repeated: true, order: { id: "o1", status: "completed" } }), "paid");
  assert.equal(checkoutResponseKind({ repeated: true, order: { id: "o1", status: "refunded" } }), "paid");
});

test("checkoutResponseKind: open checkout without a client secret is an error", () => {
  assert.equal(checkoutResponseKind({ repeated: true, orderId: "o1", clientSecret: null }), "error");
  assert.equal(checkoutResponseKind(null), "error");
});

// ─── Hold ───────────────────────────────────────────────────────────────────

test("holdMsLeft and holdClock", () => {
  const now = new Date("2026-10-26T16:00:00.000Z");
  assert.equal(holdMsLeft("2026-10-26T16:09:42.000Z", now), 582_000);
  assert.equal(holdMsLeft("2026-10-26T15:59:00.000Z", now), 0);
  assert.equal(holdMsLeft(null, now), 0);
  assert.equal(holdClock(582_000), "9:42");
  assert.equal(holdClock(5_000), "0:05");
  assert.equal(holdClock(0), "0:00");
});

// ─── Payment sheet result ───────────────────────────────────────────────────

test("sheetOutcome: no error paid, Canceled back, Timeout hold ended, others failed", () => {
  assert.equal(sheetOutcome(undefined), "paid_sheet");
  assert.equal(sheetOutcome(null), "paid_sheet");
  assert.equal(sheetOutcome({ code: "Canceled" }), "canceled");
  assert.equal(sheetOutcome({ code: "Timeout" }), "expired");
  assert.equal(sheetOutcome({ code: "Failed", message: "Card declined" }), "failed");
});

// ─── Polling after paying ───────────────────────────────────────────────────

test("pollDecision: completed is paid, pending waits until about 20 seconds, then processing", () => {
  assert.equal(POLL_EVERY_MS, 2000);
  assert.equal(POLL_MAX_MS, 20000);
  assert.equal(pollDecision("completed", 0), "paid");
  assert.equal(pollDecision("pending", 2000), "wait");
  assert.equal(pollDecision("pending", 20000), "processing");
  assert.equal(pollDecision(null, 4000), "wait", "a failed read keeps waiting");
});

test("pollDecision: money moved but the order closed is never 'not charged'", () => {
  assert.equal(pollDecision("expired", 2000), "processing");
  assert.equal(pollDecision("cancelled", 2000), "processing");
  assert.equal(pollDecision("refunding", 2000), "paid");
});

// ─── My Tickets (screen 28) ─────────────────────────────────────────────────

test("splitTickets: groups by event, upcoming soonest first, past newest first", () => {
  const now = new Date("2026-10-26T16:00:00.000Z");
  const a1 = ticket({ id: "a1" });
  const a2 = ticket({ id: "a2" });
  const b = ticket({ id: "b", orderId: "o2" }, { id: "e2", startsAt: "2026-10-28T01:00:00.000Z", endsAt: "2026-10-28T04:00:00.000Z" });
  const old1 = ticket({ id: "p1", orderId: "o3" }, { id: "e3", startsAt: "2026-09-01T01:00:00.000Z", endsAt: "2026-09-01T04:00:00.000Z" });
  const old2 = ticket({ id: "p2", orderId: "o4" }, { id: "e4", startsAt: "2026-10-01T01:00:00.000Z", endsAt: "2026-10-01T04:00:00.000Z" });
  const s = splitTickets([a1, old1, b, a2, old2], now);
  assert.deepEqual(s.upcoming.map((g) => g.event.id), ["e2", "e1"]);
  assert.deepEqual(s.upcoming[1].tickets.map((t) => t.id), ["a1", "a2"]);
  assert.deepEqual(s.past.map((g) => g.event.id), ["e4", "e3"]);
});

test("splitTickets: an event that has started but not ended stays upcoming", () => {
  const now = new Date("2026-10-31T02:00:00.000Z");
  assert.equal(splitTickets([ticket()], now).upcoming.length, 1);
});

test("groupInfo: type, count and place", () => {
  const g = splitTickets([ticket({ id: "a" }), ticket({ id: "b" })], new Date("2026-10-26T16:00:00Z")).upcoming[0];
  assert.equal(groupInfo(g), "General admission · 2 tickets · Freeport, NY");
  const one = splitTickets([ticket({}, { city: null, state: null })], new Date("2026-10-26T16:00:00Z")).upcoming[0];
  assert.equal(groupInfo(one), "General admission · 1 ticket");
  const mixed = splitTickets([ticket({ id: "a" }), ticket({ id: "b", ticketTypeName: "VIP" })], new Date("2026-10-26T16:00:00Z")).upcoming[0];
  assert.equal(groupInfo(mixed), "General admission, VIP · 2 tickets · Freeport, NY");
});

test("addressTag: only while hidden and before the reveal", () => {
  const ev = ticket({}, { addressHidden: true, addressRevealAt: "2026-10-31T13:00:00.000Z", startsAt: "2026-11-01T01:00:00.000Z" }).event;
  assert.equal(addressTag(ev, new Date("2026-10-26T16:00:00Z")), "ADDRESS SAT 9 AM");
  assert.equal(addressTag(ev, new Date("2026-10-31T14:00:00Z")), null);
  assert.equal(addressTag(ticket().event, new Date("2026-10-26T16:00:00Z")), null);
  const half = ticket({}, { addressHidden: true, addressRevealAt: "2026-10-31T13:30:00.000Z" }).event;
  assert.equal(addressTag(half, new Date("2026-10-26T16:00:00Z")), "ADDRESS SAT 9:30 AM");
});

test("ticketPlaceLine: address when shown, reveal line when hidden", () => {
  assert.equal(ticketPlaceLine(ticket().event), "The Spot, 1 Main St, Freeport, NY 11520");
  const hidden = ticket({}, { addressHidden: true, addressRevealAt: "2026-10-31T13:00:00.000Z", venueName: null, addressLine1: null, postalCode: null }).event;
  assert.equal(ticketPlaceLine(hidden), "Freeport, NY. Full address on Saturday, October 31 at 9:00 AM.");
  const noDate = ticket({}, { addressHidden: true, addressRevealAt: null, venueName: null, addressLine1: null, postalCode: null }).event;
  assert.equal(ticketPlaceLine(noDate), "Freeport, NY. The full address is shared before the event.");
});

// ─── Directions and calendar (screen 29) ────────────────────────────────────

test("directionsUrl: Apple Maps on iOS, geo on Android, Google Maps on web", () => {
  const ev = ticket().event;
  assert.equal(directionsUrl(ev, "ios"), "https://maps.apple.com/?daddr=1%20Main%20St%2C%20Freeport%2C%20NY%2011520");
  assert.equal(directionsUrl(ev, "android"), "geo:0,0?q=1%20Main%20St%2C%20Freeport%2C%20NY%2011520");
  assert.equal(directionsUrl(ev, "web"), "https://www.google.com/maps/dir/?api=1&destination=1%20Main%20St%2C%20Freeport%2C%20NY%2011520");
});

test("directionsUrl: hidden address or no street gives null", () => {
  assert.equal(directionsUrl(ticket({}, { addressHidden: true, addressLine1: null }).event, "ios"), null);
  assert.equal(directionsUrl(ticket({}, { addressLine1: null, venueName: null }).event, "ios"), null);
});

test("calendarEventFor: location only when shown", () => {
  const c = calendarEventFor(ticket().event);
  assert.deepEqual(c, {
    title: "Night", startDate: new Date("2026-10-31T01:00:00.000Z"), endDate: new Date("2026-10-31T06:00:00.000Z"),
    location: "The Spot, 1 Main St, Freeport, NY 11520", timeZone: "America/New_York", url: "https://goutsyde.com/e/night",
    notes: "Your tickets are in the Outsyde app. https://goutsyde.com/e/night",
  });
  const hidden = calendarEventFor(ticket({}, { addressHidden: true, addressLine1: null, venueName: null, postalCode: null }).event);
  assert.equal(hidden.location, undefined);
});

// ─── Refund and cancel (screen 29) ──────────────────────────────────────────

test("orderKind: paid when the total is above zero", () => {
  assert.equal(orderKind({ totalCents: 4518 }), "paid");
  assert.equal(orderKind({ totalCents: 0 }), "free");
  assert.equal(orderKind(null), "unknown");
});

test("refundErrorCopy: refund specific copy for every refusal code", () => {
  assert.equal(refundErrorCopy(apiErr(409, "NO_REFUNDS")), "The host doesn't offer refunds for this event. You can contact the host.");
  assert.equal(refundErrorCopy(apiErr(409, "REFUND_WINDOW_CLOSED", "Refunds closed 24 hours before the event. You can contact the host.")),
    "Refunds closed 24 hours before the event. You can contact the host.");
  assert.equal(refundErrorCopy(apiErr(409, "CHECKED_IN")), "You've already checked in, so this order can't be refunded.");
  assert.equal(refundErrorCopy(apiErr(409, "NOTHING_TO_REFUND")), "Only the service fee was paid on this order, and the service fee isn't refundable.");
  assert.equal(refundErrorCopy(apiErr(409, "ALREADY_REFUNDED")), "This order was already refunded.");
  assert.equal(refundErrorCopy(apiErr(409, "EVENT_CANCELLED")), "This event was cancelled, so your full refund is already on its way.");
  assert.equal(refundErrorCopy(apiErr(409, "FREE_ORDER")), "This is a free RSVP. Cancel it instead.");
  assert.equal(refundErrorCopy(apiErr(409, "EVENT_PAUSED")), "This event is paused. Contact Outsyde support.");
  assert.equal(refundErrorCopy(apiErr(409, "TRY_AGAIN")), "Something changed. Try again.");
  assert.equal(refundErrorCopy(apiErr(500, "SERVER_ERROR")), "Something went wrong. Try again.");
});

test("cancelErrorCopy: cancel specific copy", () => {
  assert.equal(cancelErrorCopy(apiErr(409, "CHECKED_IN")), "You've already checked in, so this RSVP can't be cancelled.");
  assert.equal(cancelErrorCopy(apiErr(409, "ALREADY_CANCELLED")), "This RSVP is already cancelled.");
  assert.equal(cancelErrorCopy(apiErr(409, "ORDER_NOT_CANCELLABLE")), "This RSVP can't be cancelled.");
  assert.equal(cancelErrorCopy(apiErr(409, "EVENT_CLOSED")), "This event has started or changed, so RSVPs can't be cancelled now.");
  assert.equal(cancelErrorCopy(apiErr(409, "PAID_ORDER")), "Paid tickets follow the host's refund policy.");
});

test("refundShownCents: pending when the job still has it, else what was refunded", () => {
  assert.equal(refundShownCents({ refundPendingCents: 4000, refundedCents: 0 }), 4000);
  assert.equal(refundShownCents({ refundPendingCents: 0, refundedCents: 4000 }), 4000);
  assert.equal(refundShownCents({}), null);
});

test("refund confirm and done copy", () => {
  assert.equal(refundConfirmBody(2),
    "Your ticket price comes back to the card you paid with. The service fee isn't refundable. Both tickets on this order are refunded together.");
  assert.equal(refundConfirmBody(1), "Your ticket price comes back to the card you paid with. The service fee isn't refundable.");
  assert.equal(refundConfirmBody(3),
    "Your ticket price comes back to the card you paid with. The service fee isn't refundable. All 3 tickets on this order are refunded together.");
  assert.equal(refundDoneBody(4000), "Your tickets are cancelled and $40.00 is on its way back to your card. It can take 5 to 10 business days to show.");
  assert.equal(refundDoneBody(null), "Your tickets are cancelled and your refund is on its way back to your card. It can take 5 to 10 business days to show.");
});

// ─── Push ───────────────────────────────────────────────────────────────────

test("ticketPushTarget: address_reveal opens the Tickets tab", () => {
  assert.deepEqual(ticketPushTarget({ type: "address_reveal", eventId: "e1" }), { eventId: "e1" });
  assert.deepEqual(ticketPushTarget({ type: "address_reveal" }), { eventId: null });
  assert.equal(ticketPushTarget({ type: "new_message" }), null);
  assert.equal(ticketPushTarget(null), null);
});

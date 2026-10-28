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
  walletLink,
  refundShownCents,
  refundConfirmBody,
  refundDoneBody,
  ticketPushTarget,
  orderKind,
  ticketPlaceLine,
  resultCopy,
  paidSummary,
  openedNow,
  holdDeadlineMs,
  resolveAfterSheet,
  heldConflictCopy,
  canChangeOrder,
  needsCalendarPermission,
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
  assert.deepEqual(ticketPushTarget({ type: "address_reveal", eventId: "e1" }), { screen: "tickets", eventId: "e1" });
  assert.deepEqual(ticketPushTarget({ type: "address_reveal" }), { screen: "tickets", eventId: null });
  assert.equal(ticketPushTarget({ type: "new_message" }), null);
  assert.equal(ticketPushTarget(null), null);
});

test("ticketPushTarget: a guest reminder opens that event's ticket (screen 36)", () => {
  assert.deepEqual(ticketPushTarget({ type: "event_reminder", kind: "day_before", eventId: "e1" }), { screen: "ticket", eventId: "e1" });
  assert.deepEqual(ticketPushTarget({ type: "event_reminder", kind: "soon", eventId: "e1" }), { screen: "ticket", eventId: "e1" });
  // No event id: fall back to the Tickets tab rather than doing nothing.
  assert.deepEqual(ticketPushTarget({ type: "event_reminder", kind: "soon" }), { screen: "tickets", eventId: null });
  assert.deepEqual(ticketPushTarget({ type: "event_reminder", kind: "day_before", eventId: "" }), { screen: "tickets", eventId: null });
});

test("ticketPushTarget: the host reminder opens the manage screen", () => {
  assert.deepEqual(ticketPushTarget({ type: "event_reminder", kind: "host_day_before", eventId: "e9" }), { screen: "manage", eventId: "e9" });
  assert.equal(ticketPushTarget({ type: "event_reminder", kind: "host_day_before" }), null);
});

test("ticketPushTarget: unknown reminder kinds are ignored", () => {
  assert.equal(ticketPushTarget({ type: "event_reminder", kind: "week_before", eventId: "e1" }), null);
  assert.equal(ticketPushTarget({ type: "event_reminder", eventId: "e1" }), null);
});

// ─── Result copy (screen 27) ────────────────────────────────────────────────

test("resultCopy: paid, processing and hold ended", () => {
  assert.deepEqual(resultCopy("paid", 2), {
    title: "You're going",
    body: "Your 2 tickets are in My Tickets, and a receipt with your QR codes is on its way to your email.",
    primary: "View my tickets",
  });
  assert.equal(resultCopy("paid", 1).body, "Your ticket is in My Tickets, and a receipt with your QR code is on its way to your email.");
  assert.deepEqual(resultCopy("processing", 2), {
    title: "Confirming your payment",
    body: "Your bank is still checking this payment. Your tickets appear in My Tickets as soon as it clears. You can leave this screen.",
    primary: "Go to My Tickets",
  });
  assert.deepEqual(resultCopy("expired", 2), {
    title: "Your hold ended",
    body: "The 10 minutes ran out before payment, so the tickets went back on sale. You were not charged.",
    primary: "Choose tickets again",
  });
});

test("paidSummary: date, count and total", () => {
  const ev = { startsAt: "2026-10-26T01:00:00.000Z", timezone: "America/New_York" };
  assert.equal(paidSummary(ev, 2, 4518), "Sun, Oct 25 · 9:00 PM · 2 tickets · $45.18");
  assert.equal(paidSummary(ev, 1, null), "Sun, Oct 25 · 9:00 PM · 1 ticket");
});

// ─── Review fixes ───────────────────────────────────────────────────────────

test("I-1 openedNow: only the closed to open change resets the sheet", () => {
  assert.equal(openedNow(false, true), true);
  assert.equal(openedNow(true, true), false, "a reload while open never resets a result screen");
  assert.equal(openedNow(true, false), false);
  assert.equal(openedNow(false, false), false);
});

test("I-3 holdDeadlineMs: a new checkout gets 10 minutes from when it was asked, whatever the phone clock says", () => {
  const start = 1_000_000;
  // Phone clock 15 minutes fast: holdExpiresAt is already "in the past" on the phone.
  assert.equal(holdDeadlineMs({ holdExpiresAt: new Date(start - 5 * 60_000).toISOString(), repeated: false, requestStartedMs: start, knownDeadlineMs: null }), start + 10 * 60_000);
});

test("I-3 holdDeadlineMs: a repeated checkout keeps the deadline already known for it", () => {
  const start = 2_000_000;
  assert.equal(holdDeadlineMs({ holdExpiresAt: "2026-10-26T16:00:00Z", repeated: true, requestStartedMs: start, knownDeadlineMs: start + 123_000 }), start + 123_000);
});

test("I-3 holdDeadlineMs: a repeated checkout with no known deadline is capped to 0 to 10 minutes", () => {
  const start = 3_000_000;
  const far = new Date(start + 60 * 60_000).toISOString();
  const past = new Date(start - 60_000).toISOString();
  const mid = new Date(start + 4 * 60_000).toISOString();
  assert.equal(holdDeadlineMs({ holdExpiresAt: far, repeated: true, requestStartedMs: start, knownDeadlineMs: null }), start + 10 * 60_000);
  assert.equal(holdDeadlineMs({ holdExpiresAt: past, repeated: true, requestStartedMs: start, knownDeadlineMs: null }), start);
  assert.equal(holdDeadlineMs({ holdExpiresAt: mid, repeated: true, requestStartedMs: start, knownDeadlineMs: null }), start + 4 * 60_000);
});

test("I-2 resolveAfterSheet: paid sheet confirms by polling", () => {
  assert.equal(resolveAfterSheet("paid_sheet", undefined, 60_000), "confirm");
});

test("I-2 resolveAfterSheet: a closed or failed sheet trusts the order, never assumes 'not charged'", () => {
  assert.equal(resolveAfterSheet("canceled", "completed", 0), "paid", "paid while the sheet was closing");
  assert.equal(resolveAfterSheet("failed", "refunding", 0), "paid");
  assert.equal(resolveAfterSheet("failed", "expired", 0), "expired", "server says the hold ended: not charged");
  assert.equal(resolveAfterSheet("canceled", "cancelled", 0), "expired");
  assert.equal(resolveAfterSheet("canceled", "pending", 30_000), "choose");
  assert.equal(resolveAfterSheet("failed", "pending", 30_000), "choose");
  assert.equal(resolveAfterSheet("canceled", null, 30_000), "choose", "unknown order state: back to choosing");
  assert.equal(resolveAfterSheet("canceled", "pending", 0), "choose_hold_over", "local hold over but the server hasn't closed it yet");
});

test("I-4 heldConflictCopy: a limit or sold out right after a held choice explains the hold", () => {
  const e = (code: string) => ({ status: 409, body: { error: { code, message: "x" } } });
  const held = "Your earlier choice is still held for a few minutes. Go back to it, or try again once that hold ends.";
  assert.equal(heldConflictCopy(e("LIMIT_REACHED"), true), held);
  assert.equal(heldConflictCopy(e("SOLD_OUT"), true), held);
  assert.equal(heldConflictCopy(e("EVENT_FULL"), true), held);
  assert.equal(heldConflictCopy(e("LIMIT_REACHED"), false), null);
  assert.equal(heldConflictCopy(e("TRY_AGAIN"), true), null);
});

test("M-6 canChangeOrder: refund or cancel only before the event starts and before check in", () => {
  const ev = { startsAt: "2026-10-31T01:00:00.000Z" };
  assert.equal(canChangeOrder(ev, false, new Date("2026-10-30T01:00:00Z")), true);
  assert.equal(canChangeOrder(ev, false, new Date("2026-10-31T02:00:00Z")), false);
  assert.equal(canChangeOrder(ev, true, new Date("2026-10-30T01:00:00Z")), false);
});

test("M-5 needsCalendarPermission: only iOS below 17", () => {
  assert.equal(needsCalendarPermission("ios", "16.4"), true);
  assert.equal(needsCalendarPermission("ios", "17.0"), false);
  assert.equal(needsCalendarPermission("ios", "18.1"), false);
  assert.equal(needsCalendarPermission("android", 34), false);
});

test("walletLink: Apple Wallet only on iPhone, only a real https or http link", () => {
  const url = "https://outsyde-backend.onrender.com/api/events/wallet/abc~def.pkpass";
  assert.equal(walletLink("ios", { walletUrl: url }), url);
  assert.equal(walletLink("android", { walletUrl: url }), null);
  assert.equal(walletLink("web", { walletUrl: url }), null);
  assert.equal(walletLink("ios", { walletUrl: null }), null);
  assert.equal(walletLink("ios", {}), null);
  assert.equal(walletLink("ios", null), null);
  assert.equal(walletLink("ios", { walletUrl: "javascript:alert(1)" }), null);
  assert.equal(walletLink("ios", { walletUrl: "   " }), null);
  assert.equal(walletLink("ios", { walletUrl: url }, true), null, "iPad: no Wallet app for passes");
});

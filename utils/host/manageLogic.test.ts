/** Unit tests for the host page helpers, ported from goutsyde.com tests/events-manage-logic.test.ts. npx tsx utils/host/manageLogic.test.ts */
import {
  groupMine, eventHref, statusLabel, whenWhere, takenLine, typeRows, typeRowText, payoutCard, earningsHint, refundedLine,
  refundableOrders, orderLine, canScan, statusKind, isEnded, DRAFT_DISCARD_COPY, refundConfirmCopy, canCancel, cancelNotice, backendMessage, guestName, guestLine, checkedInCount,
  isSummary, type Summary, type HostOrder, type DoorGuest,
} from "./manageLogic";
import type { HostEvent, HostTicketType } from "./editorLogic";

let passed = 0, failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.error(`  FAIL ${name}`, JSON.stringify(actual), "expected", JSON.stringify(expected)); }
}

const NOW = new Date("2026-10-23T12:00:00Z");
const ev = (o: Partial<HostEvent>): HostEvent => ({
  id: "e", slug: "s", status: "published", hostType: "user", title: "T", description: null, coverImageUrl: null,
  startsAt: "2026-10-25T01:00:00.000Z", endsAt: "2026-10-25T06:00:00.000Z", timezone: "America/New_York",
  venueName: null, addressLine1: null, addressLine2: null, city: "Freeport", state: "NY", postalCode: null,
  addressVisibility: "public", visibility: "public", capacity: 50, takenCount: 3, refundPolicy: "no_refunds", refundCutoffHours: null,
  publishedAt: null, cancelledAt: null, ...o,
});

// grouping
const g = groupMine([
  ev({ id: "d1", status: "draft" }),
  ev({ id: "u2", startsAt: "2026-11-02T01:00:00.000Z", endsAt: "2026-11-02T05:00:00.000Z" }),
  ev({ id: "u1" }),
  ev({ id: "p1", startsAt: "2026-10-01T01:00:00.000Z", endsAt: "2026-10-01T05:00:00.000Z" }),
  ev({ id: "p2", startsAt: "2026-10-10T01:00:00.000Z", endsAt: "2026-10-10T05:00:00.000Z" }),
  ev({ id: "c1", status: "cancelled", publishedAt: "2026-10-01T00:00:00.000Z" }),
  ev({ id: "c2", status: "cancelled", publishedAt: null }),
  ev({ id: "live", startsAt: "2026-10-23T10:00:00.000Z", endsAt: "2026-10-23T16:00:00.000Z" }),
], NOW);
eq(g.drafts.map((e) => e.id), ["d1"], "drafts");
eq(g.upcoming.map((e) => e.id), ["live", "u1", "u2"], "upcoming: running now counts, soonest first");
eq(g.past.map((e) => e.id), ["p2", "p1"], "past: newest first");
eq(g.cancelled.map((e) => e.id), ["c1"], "cancelled: only events that were published (a discarded draft is left out)");
eq(eventHref({ id: "x", status: "draft" }), "/events/x/edit", "draft links to edit");
eq(eventHref({ id: "x", status: "published" }), "/events/x/manage", "published links to manage");
eq(eventHref({ id: "x", status: "cancelled" }), "/events/x/manage", "cancelled links to manage");

eq(statusLabel(ev({}), NOW), "PUBLISHED", "label published");
eq(statusLabel(ev({ startsAt: "2026-10-01T01:00:00.000Z", endsAt: "2026-10-01T05:00:00.000Z" }), NOW), "ENDED", "label ended");
eq(statusLabel(ev({ status: "draft" }), NOW), "DRAFT", "label draft");
eq(statusLabel(ev({ status: "cancelled" }), NOW), "CANCELLED", "label cancelled");
eq(whenWhere(ev({})), "Sat, Oct 24, 9:00 PM to 2:00 AM, Freeport, NY", "when and city, in the event's zone");
eq(whenWhere(ev({ city: null, state: null })), "Sat, Oct 24, 9:00 PM to 2:00 AM", "no city");
eq(takenLine(12, 50), "12 / 50", "taken with capacity");
eq(takenLine(12, null), "12", "taken without capacity");

// ticket types
const tt = (o: Partial<HostTicketType>): HostTicketType => ({
  id: "t", name: "GA", description: null, priceCents: 0, quantity: 10, takenCount: 4, salesStartAt: null, salesEndAt: null,
  unlockAfterTicketTypeId: null, minPerOrder: 1, maxPerOrder: 4, perAccountLimit: null, hidden: false, sortOrder: 0, status: "active", ...o,
});
const sum = (o: Partial<Summary> = {}): Summary => ({
  ticketTypes: [], totals: { sold: 0, grossCents: 0, hostEarningsCents: 0, refundedTickets: 0, refundedCents: 0, refundPendingTickets: 0 },
  payout: { expectedAt: null, status: "none", amountCents: null, deductedCents: null, paidAt: null }, ...o,
});
const rows = typeRows([tt({}), tt({ id: "t2", name: "VIP", quantity: 5, takenCount: 5 }), tt({ id: "t3", status: "archived" })],
  sum({ ticketTypes: [{ ticketTypeId: "t3", name: "Old", priceCents: 0, archived: true, sold: 2, grossCents: 0 }, { ticketTypeId: "t4", name: "Empty", priceCents: 0, archived: true, sold: 0, grossCents: 0 }] }));
eq(rows.map((r) => [r.id, r.pct, r.soldOut]), [["t", 40, false], ["t2", 100, true], ["t3", 100, false]], "type rows: bars, sold out, removed type with sales");
eq(typeRowText(rows[0]), "4 of 10", "row text");
eq(typeRowText(rows[1]), "5 of 5, Sold out", "row text sold out");
eq(typeRowText(rows[2]), "2 sold, removed", "row text removed type");

// money cards come from the summary
const tz = "America/New_York";
eq(payoutCard({ expectedAt: "2026-10-28T12:00:00.000Z", status: "scheduled", amountCents: null, deductedCents: null, paidAt: null }, tz, 500),
  { value: "Wed, Oct 28", hint: "Expected" }, "payout scheduled shows the date");
eq(payoutCard({ expectedAt: null, status: "paid", amountCents: 500, deductedCents: 0, paidAt: "2026-10-29T12:00:00.000Z" }, tz, 500).value, "Thu, Oct 29", "payout paid shows paid date");
eq(payoutCard({ expectedAt: null, status: "payout_setup_needed", amountCents: null, deductedCents: null, paidAt: null }, tz, 500).hint, "Finish payout setup to be paid.", "setup needed hint");
eq(payoutCard({ expectedAt: null, status: "none", amountCents: null, deductedCents: null, paidAt: null }, tz, 0).value, "Nothing to pay out", "free event payout");
eq(earningsHint(sum().payout), "Estimate until your payout is created", "earnings are an estimate");
eq(earningsHint({ ...sum().payout, status: "paid" }), "Paid out", "earnings after payout");
eq(refundedLine({ ...sum().totals, refundedCents: 1250, refundPendingTickets: 1 }), { value: "$12.50", hint: "1 refund on the way" }, "refunded line");
eq(isSummary(sum()), true, "summary guard");
eq(isSummary({}), false, "summary guard rejects junk");

// orders
const order = (o: Partial<HostOrder>): HostOrder => ({
  id: "o", status: "completed", ticketCount: 2, ticketPriceCents: 4000, hostNetCents: 3920, refunded: false, refundReason: null,
  guest: { firstName: "Maya", username: "maya" }, createdAt: null, completedAt: null, ...o,
});
eq(refundableOrders([order({}), order({ id: "free", ticketPriceCents: 0 }), order({ id: "r", refunded: true, status: "refunded" }), order({ id: "x", status: "cancelled" })], "published").map((o) => o.id), ["o"], "only paid, completed, unrefunded orders");
eq(refundableOrders([order({})], "cancelled"), [], "no host refunds on a cancelled event");
eq(orderLine(order({})), "2 tickets, $40.00", "order line");
eq(orderLine(order({ ticketCount: 1 })), "1 ticket, $40.00", "order line singular");
eq(refundConfirmCopy(order({})).includes("$40.00"), true, "refund confirm names the amount");
eq(/8%|%/.test(refundConfirmCopy(order({}))), false, "no percentage in refund copy");

// guests
const guest = (o: Partial<DoorGuest>): DoorGuest => ({ ticketId: "k", firstName: "Maya", username: "maya", ticketTypeName: "Free RSVP", checkedInAt: null, checkedInBy: null, ...o });
eq(guestName(guest({})), "Maya", "guest first name");
eq(guestName(guest({ firstName: null })), "@maya", "guest falls back to username");
eq(guestName({ firstName: null, username: null }), "Guest", "guest fallback");
eq(guestLine(guest({})), "@maya · Free RSVP", "guest line");
eq(guestLine(guest({ username: null })), "Free RSVP", "guest line without username");
eq(checkedInCount([guest({}), guest({ checkedInAt: "2026-10-25T02:00:00.000Z" })]), 1, "checked in count");

// cancel
const PAST = "2026-10-01T05:00:00.000Z", FUTURE = "2026-10-25T06:00:00.000Z";
eq(canCancel({ status: "published", endsAt: FUTURE }, NOW), true, "can cancel live");
eq(canCancel({ status: "published", endsAt: PAST }, NOW), false, "cannot cancel an ended event");
eq(canScan({ status: "published", endsAt: FUTURE }, NOW), true, "can scan a live event");
eq(canScan({ status: "published", endsAt: PAST }, NOW), false, "cannot scan an ended event");
eq(canScan({ status: "cancelled", endsAt: FUTURE }, NOW), false, "cannot scan a cancelled event");
eq(statusKind({ status: "published", endsAt: PAST }, NOW), "ended", "kind ended");
eq(isEnded({ endsAt: FUTURE }, NOW), false, "not ended");
eq(DRAFT_DISCARD_COPY, "Discard this draft? It won't be published.", "discard draft copy");
eq(DRAFT_DISCARD_COPY.includes("refund") || DRAFT_DISCARD_COPY.includes("guest"), false, "draft copy has no guests or refunds");
eq(guestLine(guest({ firstName: null })), "Free RSVP", "no first name: handle not repeated");
eq(canCancel({ status: "draft", endsAt: PAST }, NOW), true, "can cancel draft");
eq(canCancel({ status: "cancelled", endsAt: FUTURE }, NOW), false, "cannot cancel twice");
eq(cancelNotice({ freeCancelled: 1, refunding: 2 }), "This event is cancelled. 1 RSVP cancelled, 2 refunds started.", "cancel notice");
eq(cancelNotice(undefined), "This event is cancelled.", "cancel notice with no guests");
eq(backendMessage(409, { error: "This event has already started.", code: "EVENT_STARTED" }), "This event has already started.", "backend message shown");
eq(backendMessage(400, { code: "X" }), "Something went wrong. Try again.", "generic when no message");
eq(backendMessage(500, { error: "Internal details", code: "SERVER_ERROR" }), "Something went wrong. Try again.", "server error: generic line");
eq(backendMessage(0, null), "Something went wrong. Try again.", "network failure: generic line");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/**
 * Quotes step 6d-2b (app, businesses): the Requests and Quotes lists, the dashboard counts, the booking status from
 * 6d-2a, the contact for pricing switch, the Book tab and tagged post taps. Legend 2026-11-05 (6d-2 calls 2 to 4 and
 * 6 to 9, as recommended). Copy rules: commas and periods, no dashes, never the fee rate.
 * Run: npx tsx utils/businessQuotesLogic.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  requestChip,
  requestIsOpen,
  requestLine,
  quoteListChip,
  quoteIsOpen,
  quoteListLine,
  dashboardCounts,
  bookingEndedLine,
  requestOnlyPatch,
  bookTabAction,
  postServiceTarget,
  serviceStart,
  REQUEST_ONLY_LABEL,
  REQUEST_ONLY_SUB,
  STARTING_PRICE_LABEL,
  OWN_REQUEST_ONLY_LINE,
} from "./businessQuotesLogic";
import { bookingOpen, jobCompleteState } from "./quoteLogic";

const clean = (s: string) => !/[—–]| - |%/.test(s);

// ─── Requests ──────────────────────────────────────────────────────────────

test("requestChip names every backend status in plain words", () => {
  assert.deepEqual(
    ["new", "called", "quoted", "booked", "closed"].map(requestChip),
    ["New", "Called", "Quoted", "Booked", "Closed"],
  );
  assert.equal(requestChip("something_new"), "Request");
});

test("requestIsOpen: new, called and quoted are open; booked and closed are done", () => {
  assert.deepEqual(
    ["new", "called", "quoted", "booked", "closed"].map(requestIsOpen),
    [true, true, true, false, false],
  );
});

test("requestLine: who, when and where, leaving out what is missing", () => {
  assert.equal(
    requestLine({
      customerName: "Ana T",
      preferredDate: "2026-11-22",
      city: "Freeport",
    }),
    "Ana T, Sun, Nov 22, Freeport",
  );
  assert.equal(
    requestLine({ customerName: "Ana T", preferredDate: null, city: null }),
    "Ana T, no date given",
  );
  assert.equal(
    requestLine({
      customerName: "",
      preferredDate: "next week",
      city: "Hempstead",
    }),
    "No date given, Hempstead",
  );
  assert.ok(
    clean(
      requestLine({
        customerName: "A",
        preferredDate: "2026-11-22",
        city: "B",
      }),
    ),
  );
});

// ─── Quotes list ───────────────────────────────────────────────────────────

const row = (o: Record<string, unknown> = {}) => ({
  status: "sent",
  paying: false,
  bookingStatus: null,
  kind: "service",
  title: "Two bedroom move",
  jobDate: "2026-11-20",
  startTime: "09:00",
  durationMinutes: 180,
  dueDate: null,
  totalCents: 65000,
  ...o,
});

test("quoteListChip: from the quote status, and the booking status once paid", () => {
  assert.equal(quoteListChip(row()), "Waiting to pay");
  assert.equal(quoteListChip(row({ paying: true })), "Paying");
  assert.equal(
    quoteListChip(row({ status: "paid", bookingStatus: "confirmed" })),
    "Booked",
  );
  assert.equal(
    quoteListChip(row({ status: "paid", bookingStatus: null })),
    "Booked",
  );
  assert.equal(
    quoteListChip(row({ status: "paid", bookingStatus: "completed" })),
    "Complete",
  );
  assert.equal(
    quoteListChip(row({ status: "paid", bookingStatus: "canceled" })),
    "Booking canceled",
  );
  assert.equal(quoteListChip(row({ status: "withdrawn" })), "Withdrawn");
  assert.equal(quoteListChip(row({ status: "declined" })), "Declined");
  assert.equal(quoteListChip(row({ status: "expired" })), "Expired");
});

test("quoteIsOpen: waiting to pay, or booked and not ended", () => {
  assert.equal(quoteIsOpen(row()), true);
  assert.equal(
    quoteIsOpen(row({ status: "paid", bookingStatus: "confirmed" })),
    true,
  );
  assert.equal(quoteIsOpen(row({ status: "paid", bookingStatus: null })), true);
  for (const b of [
    "completed",
    "canceled",
    "declined",
    "expired",
    "no_show",
    "late_cancel",
  ]) {
    assert.equal(
      quoteIsOpen(row({ status: "paid", bookingStatus: b })),
      false,
      b,
    );
  }
  for (const s of ["withdrawn", "declined", "expired"])
    assert.equal(quoteIsOpen(row({ status: s })), false, s);
});

test("quoteListLine: the job date and the total", () => {
  assert.equal(quoteListLine(row()), "Fri, Nov 20, $650.00");
  assert.equal(
    quoteListLine(
      row({ kind: "product", jobDate: null, dueDate: "2026-12-01" }),
    ),
    "Due Tue, Dec 1, $650.00",
  );
  assert.equal(
    quoteListLine(row({ kind: "product", jobDate: null, dueDate: null })),
    "$650.00",
  );
});

test("dashboardCounts: new requests, and quotes waiting on the customer", () => {
  const c = dashboardCounts(
    [
      { status: "new" },
      { status: "new" },
      { status: "called" },
      { status: "closed" },
    ],
    [
      row(),
      row({ paying: true }),
      row({ status: "paid", bookingStatus: "confirmed" }),
      row({ status: "expired" }),
    ],
  );
  assert.deepEqual(c, { newRequests: 2, waitingQuotes: 2 });
  assert.deepEqual(dashboardCounts(null, null), {
    newRequests: null,
    waitingQuotes: null,
  });
});

// ─── Booking status (6d-2a) on the business buttons ────────────────────────

const paid = (bookingStatus: string | null | undefined) =>
  ({
    status: "paid",
    kind: "service",
    appointmentId: "a1",
    balance: null,
    window: null,
    startsAt: "2026-11-20T14:00:00Z",
    ...(bookingStatus === undefined ? {} : { bookingStatus }),
  }) as any;

test("bookingOpen: a canceled or ended booking is not open; an older backend without the field stays as before", () => {
  assert.equal(bookingOpen(paid(undefined)), true);
  assert.equal(bookingOpen(paid(null)), true);
  assert.equal(bookingOpen(paid("confirmed")), true);
  for (const b of ["canceled", "completed", "no_show", "declined", "expired"])
    assert.equal(bookingOpen(paid(b)), false, b);
  assert.equal(
    jobCompleteState(paid("canceled"), Date.parse("2026-11-21T00:00:00Z")).show,
    false,
  );
});

test("bookingEndedLine says what happened to the booking", () => {
  assert.equal(bookingEndedLine("canceled"), "This booking was canceled.");
  assert.equal(
    bookingEndedLine("no_show"),
    "This booking was marked as a no show.",
  );
  assert.equal(bookingEndedLine("confirmed"), null);
  assert.equal(bookingEndedLine(null), null);
  assert.equal(bookingEndedLine("completed"), null);
  for (const b of [
    "canceled",
    "no_show",
    "late_cancel",
    "declined",
    "expired",
  ]) {
    const t = bookingEndedLine(b);
    assert.ok(t && clean(t), b);
  }
});

// ─── Contact for pricing switch (call 7) ───────────────────────────────────

test("requestOnlyPatch sends the switch only when it was changed", () => {
  assert.deepEqual(
    requestOnlyPatch({ touched: false, value: true, isNew: false }),
    {},
  );
  assert.deepEqual(
    requestOnlyPatch({ touched: true, value: true, isNew: false }),
    { requestOnly: true },
  );
  assert.deepEqual(
    requestOnlyPatch({ touched: true, value: false, isNew: false }),
    { requestOnly: false },
  );
  // A new service sends it only when switched on (the backend default is off).
  assert.deepEqual(
    requestOnlyPatch({ touched: false, value: false, isNew: true }),
    {},
  );
  assert.deepEqual(
    requestOnlyPatch({ touched: true, value: true, isNew: true }),
    { requestOnly: true },
  );
  for (const s of [
    REQUEST_ONLY_LABEL,
    REQUEST_ONLY_SUB,
    STARTING_PRICE_LABEL,
    OWN_REQUEST_ONLY_LINE,
  ])
    assert.ok(clean(s), s);
  assert.match(REQUEST_ONLY_SUB, /request form instead of booking/);
});

// ─── Book tab (call 8) ─────────────────────────────────────────────────────

test("bookTabAction: never a dead end", () => {
  assert.equal(
    bookTabAction({ requestOnly: true }, { ownProfile: false }),
    "request",
  );
  assert.equal(
    bookTabAction({ requestOnly: true }, { ownProfile: true }),
    "own-request",
  );
  assert.equal(
    bookTabAction({ requestOnly: false }, { ownProfile: true }),
    "book",
  );
  assert.equal(bookTabAction({}, { ownProfile: false }), "book");
});

// ─── Tagged posts (call 9) ─────────────────────────────────────────────────

test("postServiceTarget keeps business and photographer services apart", () => {
  assert.deepEqual(
    postServiceTarget({
      businessServiceId: "s1",
      providerId: "b1",
      userId: "u1",
    }),
    { kind: "business", serviceId: "s1", vendorId: "b1" },
  );
  assert.deepEqual(
    postServiceTarget({ businessServiceId: "s1", userId: "u1" }),
    { kind: "business", serviceId: "s1", vendorId: "u1" },
  );
  assert.deepEqual(
    postServiceTarget({
      photographerServiceId: "p1",
      photographerId: "ph1",
      userId: "u1",
    }),
    { kind: "photographer", serviceId: "p1", photographerId: "ph1" },
  );
  // Both set: the photographer service wins, as the old mapping did.
  assert.equal(
    postServiceTarget({
      photographerServiceId: "p1",
      businessServiceId: "s1",
      providerId: "x",
      userId: "u",
    })?.kind,
    "photographer",
  );
  assert.equal(postServiceTarget({ productId: "pr1", userId: "u" }), null);
  assert.equal(postServiceTarget({ businessServiceId: "s1" }), null);
});

test("serviceStart: the tagged service opens its booking or its request form; gone means the Book tab", () => {
  const list = [
    { id: "s1", requestOnly: false },
    { id: "s2", requestOnly: true },
  ];
  assert.equal(serviceStart(list, "s1"), "book");
  assert.equal(serviceStart(list, "s2"), "request");
  assert.equal(serviceStart(list, "zz"), "tab");
  assert.equal(serviceStart([], "s1"), "tab");
});

test("review 4: a rescheduled booking counts as ended, with its own line", () => {
  assert.equal(
    quoteIsOpen(row({ status: "paid", bookingStatus: "rescheduled" })),
    false,
  );
  assert.equal(
    quoteListChip(row({ status: "paid", bookingStatus: "rescheduled" })),
    "Rescheduled",
  );
  assert.equal(
    bookingEndedLine("rescheduled"),
    "This booking was marked as rescheduled.",
  );
  assert.equal(bookingOpen(paid("rescheduled")), false);
});

test("review 5: a sent quote past its expiry reads as expired before the backend job catches up", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const past = row({ expiresAt: "2026-11-19T00:00:00Z" });
  const future = row({ expiresAt: "2026-11-21T00:00:00Z" });
  assert.equal(quoteListChip(past, now), "Expired");
  assert.equal(quoteIsOpen(past, now), false);
  assert.equal(quoteListChip(future, now), "Waiting to pay");
  assert.equal(quoteIsOpen(future, now), true);
  assert.deepEqual(dashboardCounts([], [past, future], now), {
    newRequests: 0,
    waitingQuotes: 1,
  });
  // A quote being paid right now is never shown as expired (the backend waits for the payment).
  assert.equal(
    quoteListChip(
      row({ expiresAt: "2026-11-19T00:00:00Z", paying: true }),
      now,
    ),
    "Paying",
  );
});

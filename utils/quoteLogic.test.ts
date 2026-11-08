/**
 * Quotes in the app, customers (step 6c-1): the quote screen's lines and stages, the chat cards and which button
 * each one shows, the payment steps. Legend 2026-11-05 (step 6c calls 1 to 4, all as recommended).
 * Copy rules: commas and periods, no dashes, never the fee rate. Run: npx tsx utils/quoteLogic.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  quotePayBody,
  money,
  whenLine,
  payLines,
  stageOf,
  balanceLine,
  extrasPaymentLine,
  extraStatusLine,
  windowLeft,
  reportProblem,
  decidedLine,
  canPayNow,
  cardView,
  parseStart,
  quoteIdsIn,
  approveStep,
  sheetOutcome,
  errorMessage,
  quoteChip,
  type Quote,
  type Card,
} from "./quoteLogic";

const clean = (s: string) => !/[—–]| - |%/.test(s);

const amounts = {
  totalCents: 65000,
  depositOrTotalCents: 10000,
  serviceFeeCents: 800,
  payNowCents: 10800,
  balanceCents: 55000,
  balanceServiceFeeCents: 4400,
  balanceTotalCents: 59400,
  restPaid: "outsyde" as const,
  paidDirectlyCents: 0,
};
const q = (o: Partial<Quote> = {}): Quote => ({
  id: "q1",
  version: 1,
  status: "sent",
  kind: "service",
  title: "2 Bedroom Move",
  jobDate: "2026-11-13",
  startTime: "09:00",
  durationMinutes: 180,
  timeZone: "America/New_York",
  dueDate: null,
  totalCents: 65000,
  paymentMode: "deposit",
  depositCents: 10000,
  restPaid: "outsyde",
  amounts,
  expiresAt: "2026-11-12T00:00:00Z",
  businessName: "Royal Elite Moving",
  customerId: "c1",
  senderId: "s1",
  conversationId: "conv1",
  details: null,
  extrasNote: null,
  paying: false,
  appointmentId: null,
  paidAt: null,
  balance: null,
  window: null,
  report: null,
  extras: [],
  extrasPayment: null,
  ...o,
});
const card = (o: Partial<Card> = {}): Card => ({
  type: "quote",
  event: "sent",
  quoteId: "q1",
  version: 1,
  title: "2 Bedroom Move",
  ...o,
});

test("money and the job's own date and time", () => {
  assert.equal(money(10800), "$108.00");
  assert.equal(money(123456), "$1,234.56");
  assert.equal(whenLine(q()), "Fri, Nov 13 at 9:00 AM, 3 hours");
  assert.equal(
    whenLine(q({ kind: "product", dueDate: "2026-12-01" })),
    "Due Tue, Dec 1",
  );
});

test("pay lines come from the backend amounts", () => {
  const lines = payLines(amounts, "deposit");
  assert.deepEqual(
    lines.map((l) => [l.label, l.cents]),
    [
      ["Quote total", 65000],
      ["Deposit today", 10000],
      ["Service fee", 800],
      ["Pay now", 10800],
      ["Balance, held on your card the day before", 59400],
    ],
  );
  assert.ok(lines.every((l) => clean(l.label)));
  assert.equal(
    payLines(
      { ...amounts, restPaid: "outside", paidDirectlyCents: 55000 },
      "deposit",
    ).pop()?.label,
    "The rest, paid to the business directly",
  );
  assert.deepEqual(
    payLines(amounts, "full").map((l) => l.label),
    ["Quote total", "Service fee", "Pay now"],
  );
});

test("stages", () => {
  assert.equal(stageOf(q()), "pay");
  assert.equal(stageOf(q({ paying: true })), "paying");
  assert.equal(stageOf(q({ status: "expired" })), "closed");
  assert.equal(stageOf(q({ status: "paid" })), "booked");
  assert.equal(
    stageOf(
      q({
        status: "paid",
        window: {
          state: "open",
          endsAt: null,
          canConfirm: true,
          canReport: true,
        },
      }),
    ),
    "window",
  );
  assert.equal(
    stageOf(
      q({
        status: "paid",
        report: { status: "open", outcome: null, refundCents: null },
      }),
    ),
    "reported",
  );
  assert.equal(
    stageOf(
      q({
        status: "paid",
        report: { status: "decided", outcome: "pay_full", refundCents: null },
      }),
    ),
    "decided",
  );
  assert.equal(
    stageOf(
      q({
        status: "paid",
        window: {
          state: "confirmed",
          endsAt: null,
          canConfirm: false,
          canReport: false,
        },
      }),
    ),
    "complete",
  );
  assert.equal(quoteChip(q({ status: "paid" })), "Booked");
});

test("balance and extras lines with their actions", () => {
  const paid = (b: Partial<NonNullable<Quote["balance"]>>) =>
    q({
      status: "paid",
      balance: {
        status: "held",
        holdCents: 59400,
        capturedCents: null,
        needsNewCard: false,
        completedAt: null,
        ...b,
      },
    });
  assert.equal(
    balanceLine(paid({}))?.text,
    "The balance, $594.00, is on hold on your card. It is charged when the job is complete.",
  );
  assert.deepEqual(
    balanceLine(paid({ status: "hold_failed", needsNewCard: true }))?.action,
    { kind: "balance-card", label: "Update your card" },
  );
  assert.equal(
    balanceLine(paid({ status: "hold_failed", needsNewCard: false }))?.action,
    undefined,
  );
  assert.equal(balanceLine(q({ status: "paid", paymentMode: "full" })), null);
  const ep = (o: Partial<NonNullable<Quote["extrasPayment"]>>) =>
    extrasPaymentLine({
      status: "held",
      approvedCents: 10000,
      holdCents: 10800,
      capturedCents: null,
      needsNewCard: false,
      unpaid: false,
      ...o,
    });
  assert.deepEqual(ep({ unpaid: true, status: "unpaid" })?.action, {
    kind: "extras-card",
    label: "Pay for extras",
  });
  assert.deepEqual(ep({ needsNewCard: true, status: "hold_failed" })?.action, {
    kind: "extras-card",
    label: "Update your card",
  });
  assert.equal(ep({ approvedCents: 0 }), null);
  assert.equal(
    extraStatusLine({ status: "proposed" }),
    "Nothing is charged unless you approve.",
  );
  for (const s of [
    "proposed",
    "approving",
    "approved",
    "declined",
    "withdrawn",
    "lapsed",
    "canceled",
  ])
    assert.ok(clean(extraStatusLine({ status: s })));
});

test("Confirm or Report", () => {
  assert.equal(
    windowLeft("2026-11-13T18:00:00Z", Date.parse("2026-11-13T13:08:00Z")),
    "4 h 52 min left",
  );
  assert.equal(
    windowLeft("2026-11-13T18:00:00Z", Date.parse("2026-11-13T18:00:01Z")),
    "The 6 hours are over.",
  );
  assert.equal(
    reportProblem("short", 0),
    "Tell us what went wrong in at least 10 characters.",
  );
  assert.equal(
    reportProblem("The crew scratched the floor", 6),
    "Add up to 5 photos.",
  );
  assert.equal(reportProblem("The crew scratched the floor", 5), null);
  assert.equal(
    decidedLine(
      { status: "decided", outcome: "partial_refund", refundCents: 5000 },
      "Royal Elite Moving",
    ),
    "Outsyde reviewed your report. You get $50.00 back and the rest is paid to Royal Elite Moving.",
  );
});

test("the quote card in the chat (call 3: live state)", () => {
  const me = { isCustomer: true };
  let v = cardView(card(), q(), me);
  assert.equal(v.pill, "Quote");
  assert.deepEqual(
    v.buttons.map((b) => [b.label, b.start]),
    [
      ["Pay $108.00", "pay"],
      ["View quote", "view"],
    ],
  );
  v = cardView(card(), q({ status: "paid" }), me);
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
    "paid since: no Pay button on the old card",
  );
  assert.equal(v.note, "Paid.");
  v = cardView(card(), q({ version: 2 }), me);
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
  );
  assert.equal(v.note, "This quote was updated. Open the newest one.");
  v = cardView(card(), q({ status: "withdrawn" }), me);
  assert.equal(
    v.note,
    "The business took this quote back. Message them if you still want the job.",
  );
  v = cardView(card(), q({ paying: true }), me);
  assert.equal(v.note, "Your payment is being confirmed.");
  v = cardView(card(), null, me);
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
    "not loaded yet: only View quote",
  );
  v = cardView(card(), q(), { isCustomer: false });
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
    "the business never gets the customer's buttons",
  );
  v = cardView(
    card({ event: "paid", content: "Paid the deposit." }),
    q({ status: "paid" }),
    me,
  );
  assert.equal(v.pill, "Paid");
});

test("extra, balance, extras and window cards", () => {
  const me = { isCustomer: true };
  const x = {
    id: "x1",
    description: "2 extra hours",
    amountCents: 10000,
    serviceFeeCents: 800,
    totalCents: 10800,
    status: "proposed",
    canApprove: true,
    canDecline: true,
    canWithdraw: false,
  };
  let v = cardView(
    card({
      event: "extra_proposed",
      extraId: "x1",
      description: "2 extra hours",
      totalCents: 10800,
    }),
    q({ status: "paid", extras: [x] }),
    me,
  );
  assert.equal(v.pill, "Needs your OK");
  assert.equal(v.title, "2 extra hours");
  assert.deepEqual(
    v.buttons.map((b) => [b.label, b.start]),
    [
      ["Approve $108.00", "approve:x1"],
      ["Decline", "decline:x1"],
      ["View quote", "view"],
    ],
  );
  v = cardView(
    card({
      event: "extra_proposed",
      extraId: "x1",
      description: "2 extra hours",
      totalCents: 10800,
    }),
    q({
      status: "paid",
      extras: [
        { ...x, status: "approved", canApprove: false, canDecline: false },
      ],
    }),
    me,
  );
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
  );
  assert.equal(v.note, "Approved. It is charged when the job is complete.");
  const failed = q({
    status: "paid",
    balance: {
      status: "hold_failed",
      holdCents: 59400,
      capturedCents: null,
      needsNewCard: true,
      completedAt: null,
    },
  });
  v = cardView(
    card({ event: "balance_failed", content: "We couldn't hold the balance." }),
    failed,
    me,
  );
  assert.deepEqual(
    v.buttons.map((b) => [b.label, b.start]),
    [
      ["Update your card", "balance-card"],
      ["View quote", "view"],
    ],
  );
  v = cardView(
    card({ event: "balance_failed", content: "We couldn't hold the balance." }),
    q({
      status: "paid",
      balance: {
        status: "held",
        holdCents: 59400,
        capturedCents: null,
        needsNewCard: false,
        completedAt: null,
      },
    }),
    me,
  );
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
    "fixed since: no button",
  );
  v = cardView(
    card({ event: "extras_failed", content: "x" }),
    q({
      status: "paid",
      extrasPayment: {
        status: "unpaid",
        approvedCents: 1,
        holdCents: 108,
        capturedCents: null,
        needsNewCard: false,
        unpaid: true,
      },
    }),
    me,
  );
  assert.deepEqual(
    v.buttons.map((b) => [b.label, b.start]),
    [
      ["Pay for extras", "extras-card"],
      ["View quote", "view"],
    ],
  );
  v = cardView(
    card({ event: "job_complete", content: "Done." }),
    q({
      status: "paid",
      window: {
        state: "open",
        endsAt: null,
        canConfirm: true,
        canReport: true,
      },
    }),
    me,
  );
  assert.deepEqual(
    v.buttons.map((b) => [b.label, b.start]),
    [
      ["Confirm or report", "window"],
      ["View quote", "view"],
    ],
  );
  v = cardView(
    card({ event: "something_new", content: "Something new happened." }),
    q(),
    me,
  );
  assert.equal(
    v.body,
    "Something new happened.",
    "an event this build doesn't know: its own text",
  );
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
  );
  v = cardView(
    {
      type: "request",
      serviceName: "Standard Move",
      preferredDate: "2026-11-13",
      answerCount: 6,
    } as Card,
    null,
    me,
  );
  assert.equal(v.pill, "Request");
  assert.equal(v.title, "Standard Move");
  assert.deepEqual(v.buttons, []);
});

test("card copy follows the rules", () => {
  const events = [
    "sent",
    "updated",
    "withdrawn",
    "declined",
    "expired",
    "paid",
    "balance_held",
    "balance_failed",
    "extra_proposed",
    "extra_approved",
    "extra_declined",
    "extra_withdrawn",
    "extras_failed",
    "extras_hold_failed",
    "extras_reminder",
    "job_complete",
    "job_confirmed",
    "problem_reported",
    "report_decided",
  ];
  for (const e of events) {
    const v = cardView(
      card({
        event: e,
        content: "Text.",
        description: "Boxes",
        extraId: "x9",
        totalCents: 100,
      }),
      q({ status: "paid" }),
      { isCustomer: true },
    );
    assert.ok(
      clean(v.pill) &&
        clean(v.note ?? "") &&
        v.buttons.every((b) => clean(b.label)),
      e,
    );
    assert.notEqual(v.pill, "", e);
  }
});

test("Pay only where it can be paid (review I2)", () => {
  assert.equal(canPayNow(q()), true);
  // Deliverables D2: a deliverable is paid as a product order; a Delivery one needs the address first.
  assert.equal(canPayNow(q({ kind: "product", dueDate: "2026-12-01", jobDate: null, startTime: null })), true);
  assert.equal(canPayNow(q({ kind: "product", fulfillment: "delivery", deliveryAddress: null, jobDate: null, startTime: null } as any)), false);
  assert.equal(canPayNow(q({ jobDate: null })), false);
  assert.equal(canPayNow(q({ startTime: null })), false);
  assert.equal(canPayNow(q({ paying: true })), false);
  const v = cardView(card(), q({ kind: "product", fulfillment: "delivery", deliveryAddress: null } as any), { isCustomer: true });
  assert.deepEqual(
    v.buttons.map((b) => b.start),
    ["view"],
    "a Delivery deliverable without an address: no Pay button on the card",
  );
});

test("starts and ids", () => {
  assert.deepEqual(parseStart("approve:x1"), {
    kind: "approve",
    extraId: "x1",
  });
  assert.deepEqual(parseStart("decline:x2"), {
    kind: "decline",
    extraId: "x2",
  });
  assert.deepEqual(parseStart("pay"), { kind: "pay" });
  assert.equal(parseStart("approve:"), null);
  assert.equal(parseStart("nope"), null);
  assert.equal(parseStart(undefined), null);
  assert.deepEqual(
    quoteIdsIn([
      { kind: "quote", card: { quoteId: "a" } },
      { kind: "text" },
      { kind: "quote", card: { quoteId: "a" } },
      { kind: "quote", card: { quoteId: "b" } },
      { kind: "request", card: { requestId: "r" } },
      { kind: "quote", card: null },
    ]),
    ["a", "b"],
  );
});

test("payment steps (call 4)", () => {
  assert.equal(approveStep({ status: "approved" }, false), "done");
  assert.equal(
    approveStep(
      { status: "needs_action", intentType: "payment", clientSecret: "pi_s" },
      false,
    ),
    "bank",
  );
  assert.equal(
    approveStep(
      { status: "needs_action", intentType: "setup", clientSecret: "seti_s" },
      false,
    ),
    "bank-setup",
  );
  assert.equal(
    approveStep(
      { status: "needs_action", intentType: "payment", clientSecret: "pi_s" },
      true,
    ),
    "sheet",
  );
  assert.equal(
    approveStep({ status: "needs_action" }, false),
    "failed",
    "no secret: can't finish",
  );
  assert.deepEqual(sheetOutcome(undefined), { next: "done" });
  assert.deepEqual(sheetOutcome({ code: "Canceled", message: "x" }), {
    next: "canceled",
  });
  const f = sheetOutcome({
    code: "Failed",
    message: "Your card was declined.",
  });
  assert.deepEqual(f, { next: "failed", message: "Your card was declined." });
  assert.deepEqual(sheetOutcome({ code: "Failed" }), {
    next: "failed",
    message: "Payment didn't go through. Try again or use another card.",
  });
  assert.equal(
    errorMessage({
      body: {
        message: "This quote was changed. Check the new quote before you pay.",
      },
    }),
    "This quote was changed. Check the new quote before you pay.",
  );
  assert.equal(
    errorMessage({ body: { error: "Quote not found" } }),
    "Quote not found",
  );
  assert.equal(
    errorMessage({ message: "Network request failed" }),
    "Something went wrong. Check your connection and try again.",
  );
});

// ─── App payment methods Step 3: product quotes get every payment method ─────
test("quote pay asks for the saved card fields and every payment method", () => {
  assert.deepEqual(quotePayBody(3), {
    version: 3,
    paymentSheet: true,
    redirectCapable: true,
  });
});

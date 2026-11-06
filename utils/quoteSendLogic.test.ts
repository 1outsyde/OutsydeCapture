/**
 * Quotes in the app, businesses (step 6d-1): who gets Create a quote, the quote form and its checks (the same rules
 * as the backend's checkQuoteInput and checkExtraInput), Review, the business buttons on the quote screen and on the
 * chat cards, Job complete. Legend 2026-11-05 (step 6d calls 1 to 6, all as recommended).
 * Copy rules: commas and periods, no dashes, never the fee rate. Run: npx tsx utils/quoteSendLogic.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDollars,
  centsInput,
  emptyForm,
  formFromQuote,
  formFromRequest,
  formToBody,
  durationOptions,
  checkExtra,
  sendSide,
  composerOptions,
  extraTargets,
  canManageView,
  jobCompleteState,
  jobCompleteConfirm,
  reviewLines,
  vendorBalanceLine,
  vendorExtraStatusLine,
  vendorExtrasPaymentLine,
  EXPIRY_LINE,
  EXTRA_FEE_LINE,
  editBody,
  type QuoteForm,
} from "./quoteSendLogic";
import { cardView, parseStart, type Quote, type Card } from "./quoteLogic";

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
function q(over: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    version: 1,
    status: "sent",
    kind: "service",
    title: "Two bedroom move",
    jobDate: "2026-11-20",
    startTime: "09:00",
    durationMinutes: 180,
    timeZone: "America/New_York",
    dueDate: null,
    totalCents: 65000,
    paymentMode: "deposit",
    depositCents: 10000,
    restPaid: "outsyde",
    amounts,
    expiresAt: "2026-11-19T14:00:00Z",
    businessName: "Royal Elite Moving",
    businessId: "b1",
    customerId: "cust",
    senderId: "owner",
    conversationId: "c1",
    details: "Two movers and a truck",
    extrasNote: "Stairs are extra",
    paying: false,
    appointmentId: null,
    paidAt: null,
    startsAt: "2026-11-20T14:00:00Z",
    serviceId: null,
    requestId: null,
    balance: null,
    window: null,
    report: null,
    extras: [],
    extrasPayment: null,
    ...over,
  };
}
const paid = (over: Partial<Quote> = {}) =>
  q({
    status: "paid",
    appointmentId: "a1",
    paidAt: "2026-11-10T10:00:00Z",
    balance: {
      status: "scheduled",
      holdCents: 59400,
      capturedCents: null,
      needsNewCard: false,
      completedAt: null,
    },
    ...over,
  });

const START = new Date("2026-11-20T14:00:00Z").getTime();

// ─── Money input ──────────────────────────────────────────────────────────

test("parseDollars reads what a business types, in whole cents", () => {
  assert.equal(parseDollars("650"), 65000);
  assert.equal(parseDollars("$1,250.50"), 125050);
  assert.equal(parseDollars(" 7.5 "), 750);
  assert.equal(parseDollars("0.07"), 7);
  assert.equal(parseDollars(""), null);
  assert.equal(parseDollars("abc"), null);
  assert.equal(parseDollars("1.234"), null);
  assert.equal(parseDollars("-5"), null);
  assert.equal(parseDollars("1.2.3"), null);
});

test("centsInput shows cents back as an editable amount", () => {
  assert.equal(centsInput(65000), "650");
  assert.equal(centsInput(125050), "1250.50");
  assert.equal(centsInput(null), "");
  // Round trip.
  for (const c of [700, 65000, 125050, 999])
    assert.equal(parseDollars(centsInput(c)), c);
});

// ─── The form ────────────────────────────────────────────────────────────

function filled(): QuoteForm {
  return {
    ...emptyForm(),
    title: "  Two   bedroom move ",
    jobDate: "2026-11-20",
    startTime: "09:00",
    durationMinutes: 180,
    details: "Two movers",
    extrasNote: "",
    total: "650",
    paymentMode: "deposit" as const,
    deposit: "100",
    restPaid: "outsyde" as const,
  };
}

test("formToBody builds the same body the backend checks (services only)", () => {
  const r = formToBody(filled());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.body, {
    kind: "service",
    title: "Two bedroom move",
    jobDate: "2026-11-20",
    startTime: "09:00",
    durationMinutes: 180,
    details: "Two movers",
    extrasNote: null,
    totalCents: 65000,
    paymentMode: "deposit",
    depositCents: 10000,
    restPaid: "outsyde",
    serviceId: null,
  });
});

test("full payment sends no deposit and the rest is always through Outsyde", () => {
  const r = formToBody({
    ...filled(),
    paymentMode: "full",
    deposit: "100",
    restPaid: "outside",
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.body.depositCents, null);
  assert.equal(r.body.restPaid, "outsyde");
});

test("a request and a service ride along when there is one", () => {
  const r = formToBody({ ...filled(), serviceId: "s1", requestId: "r1" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.body.serviceId, "s1");
  assert.equal(r.body.requestId, "r1");
});

test("formToBody refuses what the backend would refuse, on the right field", () => {
  const bad: [Partial<ReturnType<typeof filled>>, string][] = [
    [{ title: "  " }, "title"],
    [{ title: "x".repeat(121) }, "title"],
    [{ details: "x".repeat(2001) }, "details"],
    [{ extrasNote: "x".repeat(301) }, "extrasNote"],
    [{ jobDate: "" }, "jobDate"],
    [{ jobDate: "2026-02-30" }, "jobDate"],
    [{ startTime: "" }, "startTime"],
    [{ startTime: "24:00" }, "startTime"],
    [{ durationMinutes: null }, "durationMinutes"],
    [{ durationMinutes: 10 }, "durationMinutes"],
    [{ durationMinutes: 3 * 24 * 60 + 15 }, "durationMinutes"],
    [{ total: "" }, "totalCents"],
    [{ total: "6.99" }, "totalCents"],
    [{ total: "100000.01" }, "totalCents"],
    [{ deposit: "" }, "depositCents"],
    [{ deposit: "6" }, "depositCents"],
    [{ deposit: "650" }, "depositCents"],
    [{ deposit: "700" }, "depositCents"],
  ];
  for (const [over, field] of bad) {
    const r = formToBody({ ...filled(), ...over });
    assert.equal(r.ok, false, JSON.stringify(over));
    if (!r.ok) {
      assert.equal(r.field, field, JSON.stringify(over));
      assert.ok(clean(r.message), r.message);
    }
  }
});

test("the edges the backend allows are allowed", () => {
  assert.ok(formToBody({ ...filled(), total: "7", paymentMode: "full" }).ok);
  assert.ok(formToBody({ ...filled(), total: "100000", deposit: "7" }).ok);
  assert.ok(formToBody({ ...filled(), durationMinutes: 15 }).ok);
  assert.ok(formToBody({ ...filled(), durationMinutes: 3 * 24 * 60 }).ok);
  assert.ok(formToBody({ ...filled(), deposit: "649.99" }).ok);
  assert.ok(formToBody({ ...filled(), title: "x".repeat(120) }).ok);
});

test("formFromQuote fills Edit from the live quote, and back gives the same body", () => {
  const f = formFromQuote(
    q({
      restPaid: "outside",
      amounts: { ...amounts, restPaid: "outside" },
      serviceId: "s1",
    }),
  );
  assert.equal(f.title, "Two bedroom move");
  assert.equal(f.total, "650");
  assert.equal(f.deposit, "100");
  assert.equal(f.restPaid, "outside");
  assert.equal(f.serviceId, "s1");
  assert.equal(f.requestId, null);
  const r = formToBody(f);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.body.totalCents, 65000);
    assert.equal(r.body.extrasNote, "Stairs are extra");
    assert.equal(r.body.restPaid, "outside");
  }
});

test("formFromRequest prefills the service, a real preferred date and the request", () => {
  const f = formFromRequest({
    requestId: "r1",
    serviceId: "s1",
    serviceName: "Local move",
    preferredDate: "2026-11-22",
  });
  assert.equal(f.title, "Local move");
  assert.equal(f.jobDate, "2026-11-22");
  assert.equal(f.requestId, "r1");
  assert.equal(f.serviceId, "s1");
  const g = formFromRequest({ requestId: "r2", preferredDate: "next week" });
  assert.equal(g.jobDate, "");
  assert.equal(g.title, "");
  assert.equal(g.serviceId, null);
});

test("durationOptions run from 15 minutes to 3 days, in order, and keep an odd saved length", () => {
  const o = durationOptions();
  assert.equal(o[0].value, "15");
  assert.equal(o[o.length - 1].value, String(3 * 24 * 60));
  const n = o.map((x) => Number(x.value));
  assert.deepEqual(
    [...n].sort((a, b) => a - b),
    n,
  );
  assert.equal(new Set(n).size, n.length);
  assert.ok(o.every((x) => clean(x.label)));
  const kept = durationOptions(100).map((x) => Number(x.value));
  assert.ok(kept.includes(100));
  assert.deepEqual(
    [...kept].sort((a, b) => a - b),
    kept,
  );
});

// ─── Extras ──────────────────────────────────────────────────────────────

test("checkExtra matches the backend: 3 to 200 characters, $1 to $10,000", () => {
  assert.deepEqual(checkExtra("  Extra   flight of stairs ", "75"), {
    ok: true,
    body: { description: "Extra flight of stairs", amountCents: 7500 },
  });
  const bad: [string, string, string][] = [
    ["ab", "10", "description"],
    ["x".repeat(201), "10", "description"],
    ["Stairs", "", "amountCents"],
    ["Stairs", "0.99", "amountCents"],
    ["Stairs", "10000.01", "amountCents"],
  ];
  for (const [d, a, field] of bad) {
    const r = checkExtra(d, a);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.field, field);
      assert.ok(clean(r.message));
    }
  }
  assert.ok(checkExtra("abc", "1").ok);
  assert.ok(checkExtra("abc", "10000").ok);
  assert.ok(clean(EXTRA_FEE_LINE) && /service fee on top/.test(EXTRA_FEE_LINE));
});

// ─── Who sends ───────────────────────────────────────────────────────────

test("sendSide: the owner, or active staff for the business the app picked; never the customer side", () => {
  assert.deepEqual(sendSide({ role: "business" }, "consumer"), {
    businessId: undefined,
  });
  assert.deepEqual(
    sendSide({ role: "consumer", businessId: "b1" }, "consumer"),
    { businessId: undefined },
  );
  assert.deepEqual(
    sendSide({ role: "staff", staffBusinessId: "b9" }, "consumer"),
    { businessId: "b9" },
  );
  assert.equal(sendSide({ role: "staff" }, "consumer"), null);
  assert.equal(sendSide({ role: "consumer" }, "consumer"), null);
  assert.equal(sendSide({ role: "photographer" }, "consumer"), null);
  // Chatting with a business: you are their customer there.
  assert.equal(sendSide({ role: "business" }, "business"), null);
  assert.equal(sendSide(null, "consumer"), null);
  // Your own chat with yourself.
  assert.equal(sendSide({ role: "business" }, "consumer", true), null);
});

test("composerOptions: customers get Photos and Camera only; businesses add Create a quote, and Add an extra only with an open booking", () => {
  const keys = (o: { key: string }[]) => o.map((x) => x.key);
  assert.deepEqual(
    keys(composerOptions({ business: false, extraCount: 0, photoRoom: 10 })),
    ["camera", "library"],
  );
  assert.deepEqual(
    keys(composerOptions({ business: false, extraCount: 2, photoRoom: 10 })),
    ["camera", "library"],
  );
  assert.deepEqual(
    keys(composerOptions({ business: true, extraCount: 0, photoRoom: 10 })),
    ["camera", "library", "quote"],
  );
  assert.deepEqual(
    keys(composerOptions({ business: true, extraCount: 1, photoRoom: 10 })),
    ["camera", "library", "quote", "extra"],
  );
  // Photo tray full: photos are left out, the quote stays.
  assert.deepEqual(
    keys(composerOptions({ business: true, extraCount: 0, photoRoom: 0 })),
    ["quote"],
  );
  const all = composerOptions({ business: true, extraCount: 1, photoRoom: 10 });
  assert.deepEqual(
    all.map((x) => x.label),
    ["Take photo", "Choose from library", "Create a quote", "Add an extra"],
  );
});

test("extraTargets: paid service quotes in this chat whose job is not complete, that this business manages", () => {
  const list = [
    paid({ id: "open" }),
    paid({
      id: "done",
      balance: {
        status: "captured",
        holdCents: 1,
        capturedCents: 1,
        needsNewCard: false,
        completedAt: "2026-11-20T18:00:00Z",
      },
    }),
    paid({
      id: "win",
      window: {
        state: "open",
        endsAt: "x",
        canConfirm: false,
        canReport: false,
      },
    }),
    paid({ id: "outside", restPaid: "outside", balance: null }),
    q({ id: "sent" }),
    paid({ id: "product", kind: "product" }),
    paid({ id: "other", customerId: "owner" }),
  ];
  assert.deepEqual(
    extraTargets(list, { id: "owner", role: "business" }).map((x) => x.id),
    ["open", "outside"],
  );
});

test("canManageView: the sender or the owner side; not the customer; not an admin just looking", () => {
  assert.equal(canManageView(q(), { id: "owner", role: "business" }), true);
  assert.equal(
    canManageView(q({ senderId: "staff1" }), { id: "staff1", role: "staff" }),
    true,
  );
  assert.equal(
    canManageView(q({ senderId: "staff1" }), { id: "owner", role: "business" }),
    true,
  );
  assert.equal(canManageView(q(), { id: "cust", role: "consumer" }), false);
  assert.equal(
    canManageView(q(), { id: "adm", role: "consumer", isAdmin: true }),
    false,
  );
  assert.equal(
    canManageView(q(), {
      id: "adm",
      role: "business",
      isAdmin: true,
      businessId: "b2",
    }),
    false,
  );
  assert.equal(
    canManageView(q(), {
      id: "adm",
      role: "business",
      isAdmin: true,
      businessId: "b1",
    }),
    true,
  );
  assert.equal(canManageView(q(), null), false);
});

// ─── Job complete ────────────────────────────────────────────────────────

test("jobCompleteState: shown for an open paid booking, ready once the job has started", () => {
  const before = jobCompleteState(paid(), START - 60_000);
  assert.equal(before.show, true);
  assert.equal(before.ready, false);
  assert.ok(before.hint && clean(before.hint));
  const after = jobCompleteState(paid(), START + 60_000);
  assert.deepEqual(after, { show: true, ready: true });
  assert.equal(jobCompleteState(q(), START + 1).show, false);
  assert.equal(
    jobCompleteState(
      paid({
        window: {
          state: "open",
          endsAt: "x",
          canConfirm: false,
          canReport: false,
        },
      }),
      START + 1,
    ).show,
    false,
  );
  assert.equal(
    jobCompleteState(
      paid({
        balance: {
          status: "captured",
          holdCents: 1,
          capturedCents: 1,
          needsNewCard: false,
          completedAt: "x",
        },
      }),
      START + 1,
    ).show,
    false,
  );
  // No start time known: never ready here, the backend decides.
  assert.equal(
    jobCompleteState(paid({ startsAt: null }), START + 1).ready,
    false,
  );
});

test("jobCompleteConfirm says what is charged, never the rate", () => {
  const d = jobCompleteConfirm(paid());
  assert.match(d, /charges the balance and any approved extras/);
  const full = jobCompleteConfirm(
    paid({ paymentMode: "full", depositCents: null }),
  );
  assert.doesNotMatch(full, /balance/);
  const out = jobCompleteConfirm(
    paid({
      restPaid: "outside",
      amounts: { ...amounts, restPaid: "outside", paidDirectlyCents: 55000 },
    }),
  );
  assert.doesNotMatch(out, /charges the balance/);
  for (const s of [d, full, out]) assert.ok(clean(s), s);
});

// ─── Review ──────────────────────────────────────────────────────────────

test("reviewLines show the business's amounts and that the customer pays a service fee on top", () => {
  const r = formToBody(filled());
  assert.ok(r.ok);
  if (!r.ok) return;
  const lines = reviewLines(r.body);
  assert.deepEqual(
    lines.map((l) => [l.label, l.value]),
    [
      ["Quote total", "$650.00"],
      ["Deposit to pay now", "$100.00"],
      ["The rest, held on the customer's card the day before", "$550.00"],
    ],
  );
  const out = reviewLines({ ...r.body, restPaid: "outside" });
  assert.equal(out[2].label, "The rest, paid to you directly");
  const full = reviewLines({
    ...r.body,
    paymentMode: "full",
    depositCents: null,
  });
  assert.deepEqual(
    full.map((l) => l.label),
    ["Quote total", "Paid in full now"],
  );
  for (const l of [...lines, ...out, ...full]) assert.ok(clean(l.label));
  assert.ok(clean(EXPIRY_LINE) && /7 days/.test(EXPIRY_LINE));
});

// ─── Business wording on the quote screen ────────────────────────────────

test("vendorBalanceLine talks about the customer's card", () => {
  assert.match(
    vendorBalanceLine(paid())!,
    /held on the customer's card the day before/,
  );
  assert.match(
    vendorBalanceLine(
      paid({
        balance: {
          status: "held",
          holdCents: 59400,
          capturedCents: null,
          needsNewCard: false,
          completedAt: null,
        },
      }),
    )!,
    /on hold/,
  );
  assert.match(
    vendorBalanceLine(
      paid({
        balance: {
          status: "hold_failed",
          holdCents: 59400,
          capturedCents: null,
          needsNewCard: true,
          completedAt: null,
        },
      }),
    )!,
    /asked to update/,
  );
  assert.match(
    vendorBalanceLine(
      paid({
        restPaid: "outside",
        balance: null,
        amounts: { ...amounts, restPaid: "outside", paidDirectlyCents: 55000 },
      }),
    )!,
    /pays the rest, \$550\.00, to you directly/,
  );
  assert.equal(vendorBalanceLine(paid({ paymentMode: "full" })), null);
  for (const s of [
    "scheduled",
    "holding",
    "held",
    "capturing",
    "captured",
    "hold_failed",
  ]) {
    const t = vendorBalanceLine(
      paid({
        balance: {
          status: s,
          holdCents: 59400,
          capturedCents: 59400,
          needsNewCard: false,
          completedAt: null,
        },
      }),
    );
    assert.ok(t && clean(t), s);
  }
});

test("vendorExtraStatusLine: Approved, held on the card (B3)", () => {
  assert.equal(
    vendorExtraStatusLine({ status: "proposed" }, null),
    "Waiting for the customer to approve.",
  );
  assert.equal(
    vendorExtraStatusLine({ status: "approved" }, { status: "held" } as any),
    "Approved, held on the card.",
  );
  assert.match(
    vendorExtraStatusLine({ status: "approved" }, {
      status: "scheduled",
    } as any),
    /held on the card the day before/,
  );
  assert.match(
    vendorExtraStatusLine({ status: "approved" }, {
      status: "captured",
    } as any),
    /charged/,
  );
  for (const s of ["approving", "declined", "withdrawn", "lapsed", "canceled"])
    assert.ok(clean(vendorExtraStatusLine({ status: s }, null)));
});

// ─── Chat cards, business side ───────────────────────────────────────────

const card = (over: Partial<Card> = {}): Card => ({
  type: "quote",
  event: "sent",
  quoteId: "q1",
  version: 1,
  title: "Two bedroom move",
  ...over,
});
const biz = { isCustomer: false, canManage: true, nowMs: START + 60_000 };

test("business cards: View quote on a sent quote; Job complete on the booked card once started", () => {
  assert.deepEqual(
    cardView(card(), q(), biz).buttons.map((b) => b.start),
    ["view"],
  );
  const booked = cardView(card({ event: "paid" }), paid(), biz);
  assert.deepEqual(
    booked.buttons.map((b) => [b.label, b.start, !!b.primary]),
    [
      ["Job complete", "job-complete", true],
      ["View quote", "view", false],
    ],
  );
  // Review 9: one Job complete button per booking, on the paid card only.
  const held = cardView(card({ event: "balance_held" }), paid(), biz);
  assert.deepEqual(
    held.buttons.map((b) => b.start),
    ["view"],
  );
  // Before the start, not complete yet, or not managing: View quote only.
  assert.deepEqual(
    cardView(card({ event: "paid" }), paid(), {
      ...biz,
      nowMs: START - 1,
    }).buttons.map((b) => b.start),
    ["view"],
  );
  assert.deepEqual(
    cardView(
      card({ event: "paid" }),
      paid({
        window: {
          state: "open",
          endsAt: "x",
          canConfirm: false,
          canReport: false,
        },
      }),
      biz,
    ).buttons.map((b) => b.start),
    ["view"],
  );
  assert.deepEqual(
    cardView(card({ event: "paid" }), paid(), {
      isCustomer: false,
    }).buttons.map((b) => b.start),
    ["view"],
  );
  // The customer never gets business buttons.
  assert.deepEqual(
    cardView(card({ event: "paid" }), paid(), {
      isCustomer: true,
      canManage: false,
      nowMs: START + 1,
    }).buttons.map((b) => b.start),
    ["view"],
  );
});

test("request cards: Send a quote for the business, nothing for the customer", () => {
  const r: Card = {
    type: "request",
    requestId: "r1",
    serviceName: "Local move",
    preferredDate: "2026-11-22",
    answerCount: 3,
  };
  assert.deepEqual(
    cardView(r, null, { isCustomer: false, canManage: true }).buttons.map(
      (b) => [b.label, b.start],
    ),
    [["Send a quote", "send-quote"]],
  );
  assert.deepEqual(cardView(r, null, { isCustomer: true }).buttons, []);
  assert.deepEqual(cardView(r, null, { isCustomer: false }).buttons, []);
});

test("parseStart knows the business starts", () => {
  assert.deepEqual(parseStart("job-complete"), { kind: "job-complete" });
  assert.deepEqual(parseStart("extra"), { kind: "extra" });
  assert.equal(parseStart("send-quote"), null);
});

test("vendorExtrasPaymentLine: what the business needs to know about the extras payment", () => {
  assert.equal(vendorExtrasPaymentLine(null), null);
  assert.equal(
    vendorExtrasPaymentLine({
      status: "none",
      approvedCents: 0,
      holdCents: 0,
      capturedCents: null,
      needsNewCard: false,
      unpaid: false,
    }),
    null,
  );
  const base = {
    approvedCents: 5000,
    holdCents: 5400,
    capturedCents: null,
    needsNewCard: false,
    unpaid: false,
  };
  assert.match(
    vendorExtrasPaymentLine({ ...base, status: "unpaid", unpaid: true })!,
    /asked to pay/,
  );
  assert.match(
    vendorExtrasPaymentLine({
      ...base,
      status: "hold_failed",
      needsNewCard: true,
    })!,
    /can't be marked complete until/,
  );
  assert.match(
    vendorExtrasPaymentLine({
      ...base,
      status: "captured",
      capturedCents: 5400,
    })!,
    /charged/,
  );
  assert.match(
    vendorExtrasPaymentLine({ ...base, status: "held" })!,
    /on hold/,
  );
  assert.match(
    vendorExtrasPaymentLine({ ...base, status: "scheduled" })!,
    /day before/,
  );
  for (const st of ["unpaid", "hold_failed", "captured", "held", "scheduled"]) {
    const t = vendorExtrasPaymentLine({
      ...base,
      status: st,
      unpaid: st === "unpaid",
      needsNewCard: st === "hold_failed",
    });
    assert.ok(t && clean(t) && !/your card/.test(t), st);
  }
});

test("vendorExtraStatusLine never says held when the hold failed or isn't placed yet (review 8)", () => {
  assert.match(
    vendorExtraStatusLine({ status: "approved" }, {
      status: "hold_failed",
    } as any),
    /couldn't be held/,
  );
  for (const st of ["holding", "capturing", "releasing", "none"]) {
    assert.equal(
      vendorExtraStatusLine({ status: "approved" }, { status: st } as any),
      "Approved.",
      st,
    );
  }
  assert.equal(
    vendorExtraStatusLine({ status: "approved" }, null),
    "Approved.",
  );
});

test("EXPIRY_LINE covers a job less than a day away (review 8)", () => {
  assert.match(EXPIRY_LINE, /less than a day away/);
  assert.ok(clean(EXPIRY_LINE));
});

test("editBody leaves the service out unless it changed, so a retired service never blocks an edit (review 3)", () => {
  const r = formToBody({ ...filled(), serviceId: "old" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal("serviceId" in editBody(r.body, "old"), false);
  assert.equal(editBody(r.body, "new").serviceId, "old");
  assert.equal(editBody({ ...r.body, serviceId: null }, "old").serviceId, null);
  assert.equal(
    "requestId" in editBody({ ...r.body, requestId: "r1" }, null),
    false,
  );
});

test("sendSide waits until the chat's other side is known (review 2)", () => {
  assert.equal(sendSide({ role: "business" }, "consumer", false, false), null);
  assert.deepEqual(sendSide({ role: "business" }, "consumer", false, true), {
    businessId: undefined,
  });
  assert.deepEqual(sendSide({ role: "business" }, "user"), {
    businessId: undefined,
  });
});

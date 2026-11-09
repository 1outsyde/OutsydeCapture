/**
 * Quotes in the app, customers (step 6c-2b): request only services, the request form, the pop-up and the Quotes
 * tab. Legend 2026-11-05 (step 6c-2 calls 2 to 6, all as recommended; contact for pricing always opens the form).
 * Copy rules: commas and periods, no dashes, never the fee rate. Run: npx tsx utils/requestLogic.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  serviceAction,
  checkRequest,
  requestBody,
  nextAction,
  actionKey,
  actionCopy,
  quotesTabRows,
  activityQuoteId,
  type RequestForm,
  type QuoteAction,
} from "./requestLogic";

const clean = (s: string) => !/[—–]| - |%/.test(s);

const form = (o: Partial<RequestForm> = {}): RequestForm => ({
  service: { id: "s1", name: "Standard Move" },
  business: { id: "b1", name: "Royal Elite Moving" },
  cities: ["Norfolk", "Chesapeake"],
  cityRequired: true,
  phoneRequired: true,
  questions: [
    { id: "date", type: "date", label: "Move date", required: true },
    {
      id: "beds",
      type: "choice",
      label: "Bedrooms",
      required: true,
      options: ["1", "2", "3"],
    },
    {
      id: "extras",
      type: "choice",
      label: "Extras",
      required: false,
      options: ["Piano", "Safe"],
      multiple: true,
    },
    { id: "notes", type: "long_text", label: "Anything else", required: false },
    {
      id: "pics",
      type: "photos",
      label: "Photos",
      required: false,
      maxPhotos: 3,
    },
  ],
  ...o,
});

test("request only services (calls 2 and contact for pricing)", () => {
  assert.deepEqual(serviceAction({ requestOnly: true, priceCents: 0 }), {
    price: "Price on request",
    button: "Request a quote",
    kind: "request",
  });
  assert.deepEqual(serviceAction({ requestOnly: false, priceCents: 15000 }), {
    price: "$150.00",
    button: "Book",
    kind: "book",
  });
  assert.deepEqual(
    serviceAction({ priceCents: 15000 }),
    { price: "$150.00", button: "Book", kind: "book" },
    "older backends: bookable",
  );
});

test("the form is checked before sending (call 3)", () => {
  const ok = { date: "2026-11-13", beds: "2" };
  assert.equal(checkRequest(form(), ok, "7575551234", "Norfolk", 0), null);
  assert.deepEqual(checkRequest(form(), ok, "7575551234", "", 0), {
    field: "city",
    message: "Please choose your city.",
  });
  assert.deepEqual(checkRequest(form(), ok, "123", "Norfolk", 0), {
    field: "phone",
    message: "Please add a phone number the business can call.",
  });
  assert.deepEqual(
    checkRequest(form(), { beds: "2" }, "7575551234", "Norfolk", 0),
    { field: "date", message: 'Please answer "Move date"' },
  );
  assert.deepEqual(
    checkRequest(
      form(),
      { date: "2026-11-13", beds: "9" },
      "7575551234",
      "Norfolk",
      0,
    ),
    { field: "beds", message: 'Please pick one of the choices for "Bedrooms"' },
  );
  assert.deepEqual(
    checkRequest(
      form(),
      { ...ok, notes: "x".repeat(2001) },
      "7575551234",
      "Norfolk",
      0,
    ),
    {
      field: "notes",
      message: '"Anything else" can be up to 2,000 characters',
    },
  );
  assert.deepEqual(
    checkRequest(
      form(),
      { ...ok, pics: ["a", "b", "c", "d"] },
      "7575551234",
      "Norfolk",
      0,
    ),
    { field: "pics", message: '"Photos" takes up to 3 photos' },
  );
  assert.deepEqual(checkRequest(form(), ok, "7575551234", "Norfolk", 11), {
    field: "pics",
    message: "A request can have up to 10 photos.",
  });
  assert.equal(
    checkRequest(
      form({ cityRequired: false, cities: [] }),
      ok,
      "7575551234",
      "",
      0,
    ),
    null,
    "no city list: no city",
  );
  for (const m of [checkRequest(form(), {}, "", "", 0)?.message ?? ""])
    assert.ok(clean(m));
});

test("what is sent", () => {
  const body = requestBody(
    form(),
    { firstName: "Jordan", lastName: "Miles", email: "j@x.test" },
    { date: "2026-11-13", beds: "2", extras: [], notes: "  third floor  " },
    { pics: ["https://r2/requests/a.jpg"] },
    " 7575551234 ",
    "Norfolk",
  );
  assert.deepEqual(body, {
    businessId: "b1",
    serviceId: "s1",
    city: "Norfolk",
    name: "Jordan Miles",
    email: "j@x.test",
    phone: "7575551234",
    preferredDate: "2026-11-13",
    source: "app",
    answers: {
      date: "2026-11-13",
      beds: "2",
      notes: "third floor",
      pics: ["https://r2/requests/a.jpg"],
    },
  });
  assert.equal(
    requestBody(
      form({ cityRequired: false, cities: [] }),
      { firstName: "", lastName: "", email: "j@x.test" },
      { beds: "2" },
      {},
      "7575551234",
      "",
    ).name,
    "Outsyde customer",
  );
  assert.equal(
    requestBody(
      form({ questions: [] }),
      { firstName: "A", lastName: "", email: "a@x.test" },
      {},
      {},
      "7575551234",
      "",
    ).preferredDate,
    null,
    "no date question: no preferred date",
  );
});

test("F2b: a photographer's form sends photographerId, never businessId", () => {
  const body = requestBody(
    form({
      vendorType: "photographer",
      business: { id: "p1", name: "Lens" },
      cityRequired: false,
      cities: [],
    }),
    { firstName: "Tasha", lastName: "M", email: "t@x.test" },
    { date: "2027-06-13" },
    {},
    "5165550142",
    "",
  ) as Record<string, unknown>;
  assert.equal(body.photographerId, "p1");
  assert.equal("businessId" in body, false);
  assert.equal(body.serviceId, "s1");
  const biz = requestBody(
    form({ vendorType: "business" }),
    { firstName: "A", lastName: "", email: "a@x.test" },
    {},
    {},
    "7575551234",
    "Norfolk",
  ) as Record<string, unknown>;
  assert.equal(biz.businessId, "b1");
  assert.equal("photographerId" in biz, false);
});

const act = (o: Partial<QuoteAction>): QuoteAction => ({
  kind: "approve_extra",
  quoteId: "q1",
  conversationId: "c1",
  businessName: "Royal Elite Moving",
  title: "2 Bedroom Move",
  ...o,
});

test("the pop-up (call 4)", () => {
  const list = [
    act({ kind: "update_card", amountCents: 59400 }),
    act({ extraId: "x1", description: "2 extra hours", totalCents: 10800 }),
  ];
  assert.equal(
    nextAction(list, new Set()),
    list[0],
    "money first, as the backend sends it",
  );
  assert.equal(
    nextAction(list, new Set([actionKey(list[0])])),
    list[1],
    "Not now: the next one",
  );
  assert.equal(nextAction(list, new Set(list.map(actionKey))), null);
  assert.equal(actionKey(list[1]), "approve_extra:q1:x1");
  const c = actionCopy(list[1]);
  assert.deepEqual(c, {
    pill: "Needs your OK",
    title: "Royal Elite Moving added 2 extra hours",
    body: "$108.00 with the service fee. Nothing is charged unless you approve.",
    button: "Review",
    start: "approve:x1",
  });
  assert.equal(actionCopy(list[0]).start, "balance-card");
  assert.equal(
    actionCopy(act({ kind: "pay_extras", amountCents: 10800 })).start,
    "extras-card",
  );
  assert.equal(
    actionCopy(act({ kind: "update_extras_card", amountCents: 10800 })).start,
    "extras-card",
  );
  assert.equal(actionCopy(act({ kind: "confirm_or_report" })).start, "window");
  for (const k of [
    "update_card",
    "update_extras_card",
    "pay_extras",
    "approve_extra",
    "confirm_or_report",
  ] as const) {
    const x = actionCopy(
      act({
        kind: k,
        amountCents: 100,
        totalCents: 100,
        description: "Boxes",
        extraId: "x",
      }),
    );
    assert.ok(
      clean(x.title) && clean(x.body) && clean(x.button) && clean(x.pill),
      k,
    );
  }
});

test("the Quotes tab (call 6)", () => {
  const rows = quotesTabRows(
    [
      {
        id: "q1",
        status: "paid",
        title: "2 Bedroom Move",
        businessName: "Royal Elite Moving",
        jobDate: "2026-11-13",
        startTime: "09:00",
        durationMinutes: 180,
        kind: "service",
        dueDate: null,
        paying: false,
        window: null,
        report: null,
        sentAt: "2026-11-04T10:00:00Z",
      },
      {
        id: "q2",
        status: "sent",
        title: "Office move",
        businessName: "Royal Elite Moving",
        jobDate: "2026-11-20",
        startTime: null,
        durationMinutes: null,
        kind: "service",
        dueDate: null,
        paying: false,
        window: null,
        report: null,
        sentAt: "2026-11-05T10:00:00Z",
      },
    ],
    [
      {
        id: "r1",
        status: "new",
        serviceName: "Standard Move",
        businessName: "Royal Elite Moving",
        conversationId: "c9",
        createdAt: "2026-11-05T12:00:00Z",
      },
    ],
    [act({ quoteId: "q1", extraId: "x1" })],
  );
  assert.deepEqual(
    rows.map((r) => [r.key, r.chip, r.needsYou]),
    [
      ["request:r1", "Waiting for a quote", false],
      ["quote:q2", "Ready to pay", true],
      ["quote:q1", "Needs you", true],
    ],
  );
  assert.equal(
    rows[2].sub,
    "Royal Elite Moving, Fri, Nov 13 at 9:00 AM, 3 hours",
  );
  assert.equal(rows[0].conversationId, "c9");
});

test("Activity rows open their quote (call 5)", () => {
  for (const t of [
    "quote_extra",
    "quote_paid",
    "quote_extra_approved",
    "quote_extra_declined",
    "quote_problem_reported",
    "quote_card_failed",
  ]) {
    assert.equal(
      activityQuoteId({ type: t, metadata: { quoteId: "q1" } }),
      "q1",
      t,
    );
  }
  assert.equal(
    activityQuoteId({ type: "new_follower", metadata: { quoteId: "q1" } }),
    null,
  );
  assert.equal(activityQuoteId({ type: "quote_paid", metadata: {} }), null);
  assert.equal(activityQuoteId({ type: "quote_paid" }), null);
});

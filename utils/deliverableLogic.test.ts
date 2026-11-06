/**
 * Deliverables D2 (Legend 2026-11-06, D2 plan calls 1 to 9): deliverable quotes in the app. A deliverable (a cake,
 * a dress) has an optional due date, Pickup or Delivery, is paid as a normal product order, and is finished with Mark
 * picked up or Mark delivered. Copy: commas and periods, no dashes, never the fee rate.
 * Run: npx tsx utils/deliverableLogic.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  deliverableWhenLine,
  needsAddress,
  deliverablePaidLine,
  handOverLabel,
  canHandOver,
  orderFulfillmentLine,
  orderDepositNote,
  showShipBy,
  isDeliverableOrder,
  DELIVERABLE_COPY,
} from "./deliverableLogic";
import { canPayNow } from "./quoteLogic";
import { formToBody, emptyForm, editBody } from "./quoteSendLogic";

const clean = (s: string) => !/[—–]| - |%/.test(s);
const sent = {
  status: "sent",
  paying: false,
  window: null,
  report: null,
  jobDate: null,
  startTime: null,
} as any;

test("the when line: Due date and Pickup or Delivery", () => {
  assert.equal(
    deliverableWhenLine({ dueDate: "2026-11-20", fulfillment: "pickup" }),
    "Due Fri, Nov 20 · Pickup",
  );
  assert.equal(
    deliverableWhenLine({ dueDate: null, fulfillment: "delivery" }),
    "Delivery",
  );
  assert.equal(
    deliverableWhenLine({ dueDate: "2026-11-20", fulfillment: null }),
    "Due Fri, Nov 20",
    "an older quote with no pickup or delivery says only its due date",
  );
});

test("Pay: a Delivery quote needs the address first; services unchanged", () => {
  assert.equal(
    needsAddress({
      kind: "product",
      fulfillment: "delivery",
      deliveryAddress: null,
    }),
    true,
  );
  assert.equal(
    needsAddress({
      kind: "product",
      fulfillment: "delivery",
      deliveryAddress: "14 Oak Ave",
    }),
    false,
  );
  assert.equal(
    needsAddress({
      kind: "product",
      fulfillment: "pickup",
      deliveryAddress: null,
    }),
    false,
  );
  assert.equal(
    needsAddress({ kind: "service", fulfillment: null, deliveryAddress: null }),
    false,
  );
  assert.equal(
    canPayNow({ ...sent, kind: "product", fulfillment: "pickup" }),
    true,
  );
  assert.equal(
    canPayNow({
      ...sent,
      kind: "product",
      fulfillment: "delivery",
      deliveryAddress: null,
    }),
    false,
  );
  assert.equal(
    canPayNow({
      ...sent,
      kind: "product",
      fulfillment: "delivery",
      deliveryAddress: "14 Oak Ave",
    }),
    true,
  );
  assert.equal(
    canPayNow({ ...sent, kind: "service" }),
    false,
    "a service still needs its date and time",
  );
  assert.equal(
    canPayNow({
      ...sent,
      kind: "service",
      jobDate: "2026-11-13",
      startTime: "09:00",
    }),
    true,
  );
  assert.equal(
    canPayNow({
      ...sent,
      status: "paid",
      kind: "product",
      fulfillment: "pickup",
    }),
    false,
  );
});

test("after paying: Paid with the order, Delivered, Refunded", () => {
  assert.equal(
    deliverablePaidLine({ status: "paid", orderStatus: "paid" }),
    "Paid. Your order is in Orders.",
  );
  assert.equal(
    deliverablePaidLine({ status: "paid", orderStatus: "delivered" }),
    "Delivered.",
  );
  assert.equal(
    deliverablePaidLine({ status: "paid", orderStatus: "cancelled" }),
    "Refunded. The business cancelled this order.",
  );
  assert.equal(
    deliverablePaidLine({ status: "sent", orderStatus: null }),
    null,
  );
});

test("Mark picked up or Mark delivered, only for paid Pickup or Delivery orders", () => {
  assert.equal(handOverLabel("pickup"), "Mark picked up");
  assert.equal(handOverLabel("delivery"), "Mark delivered");
  assert.equal(canHandOver({ status: "paid", fulfillment: "pickup" }), true);
  assert.equal(canHandOver({ status: "paid", fulfillment: "delivery" }), true);
  assert.equal(
    canHandOver({ status: "pending", fulfillment: "pickup" }),
    false,
  );
  assert.equal(
    canHandOver({ status: "delivered", fulfillment: "pickup" }),
    false,
  );
  assert.equal(
    canHandOver({ status: "paid", fulfillment: null }),
    false,
    "a shipped order keeps carrier and tracking",
  );
});

test("Orders screens: Pickup or Delivery instead of shipping, no ship by badge", () => {
  assert.equal(
    orderFulfillmentLine({ fulfillment: "pickup", shippingAddress: null }),
    "Pickup",
  );
  assert.equal(
    orderFulfillmentLine({
      fulfillment: "delivery",
      shippingAddress: "14 Oak Ave, Uniondale, NY",
    }),
    "Delivery to 14 Oak Ave, Uniondale, NY",
  );
  assert.equal(
    orderFulfillmentLine({ fulfillment: null, shippingAddress: "x" }),
    null,
    "cart orders keep their shipping lines",
  );
  assert.equal(showShipBy({ fulfillment: "pickup" }), false);
  assert.equal(showShipBy({ fulfillment: null }), true);
  assert.equal(isDeliverableOrder({ quoteId: "q1" }), true);
  assert.equal(isDeliverableOrder({ quoteId: null }), false);
});

test("deposit orders say what's paid directly", () => {
  assert.equal(
    orderDepositNote({ paidDirectlyCents: 35000 }, "business"),
    "Deposit paid. $350.00 is paid to you directly.",
  );
  assert.equal(
    orderDepositNote({ paidDirectlyCents: 35000 }, "customer"),
    "Deposit paid. $350.00 goes to the business directly.",
  );
  assert.equal(orderDepositNote({ paidDirectlyCents: 0 }, "business"), null);
  assert.equal(orderDepositNote({ paidDirectlyCents: null }, "customer"), null);
});

test("Create a quote: a deliverable body has no time, an optional due date, Pickup or Delivery", () => {
  const f = {
    ...emptyForm(),
    kind: "product" as const,
    title: "Two tier cake",
    total: "200",
    paymentMode: "full" as const,
    dueDate: "2026-11-20",
  };
  const r = formToBody(f);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.body.kind, "product");
    assert.equal(r.body.jobDate, null);
    assert.equal(r.body.startTime, null);
    assert.equal(r.body.durationMinutes, null);
    assert.equal(r.body.dueDate, "2026-11-20");
    assert.equal(r.body.fulfillment, "pickup");
    assert.equal(r.body.extrasNote, null);
    assert.equal(r.body.serviceId, null);
  }
  const noDue = formToBody({ ...f, dueDate: "" });
  assert.ok(
    noDue.ok && noDue.body.dueDate === null,
    "the due date is optional",
  );
  const del = formToBody({ ...f, fulfillment: "delivery", deliveryFee: "20" });
  assert.ok(
    del.ok &&
      del.body.deliveryFeeCents === 2000 &&
      del.body.totalCents === 20000,
    "Delivery with a fee line inside the total",
  );
  const big = formToBody({ ...f, fulfillment: "delivery", deliveryFee: "200" });
  assert.ok(!big.ok && big.field === "deliveryFeeCents");
  const pickFee = formToBody({
    ...f,
    fulfillment: "pickup",
    deliveryFee: "20",
  });
  assert.ok(
    pickFee.ok && pickFee.body.deliveryFeeCents === null,
    "no fee on Pickup",
  );
  const dep = formToBody({
    ...f,
    paymentMode: "deposit",
    deposit: "50",
    restPaid: "outsyde",
  });
  assert.ok(
    dep.ok && dep.body.restPaid === "outside",
    "a deliverable's deposit has the rest paid directly",
  );
  const bad = formToBody({ ...f, dueDate: "2026-02-30" });
  assert.ok(!bad.ok && bad.field === "dueDate");
  const svc = formToBody({
    ...emptyForm(),
    title: "Move",
    total: "650",
    paymentMode: "full",
    jobDate: "2026-11-13",
    startTime: "09:00",
    durationMinutes: 300,
  });
  assert.ok(
    svc.ok &&
      svc.body.kind === "service" &&
      svc.body.fulfillment === undefined &&
      svc.body.productId === undefined,
    "services are unchanged",
  );
});

test("editing a deliverable leaves the product out when unchanged", () => {
  const r = formToBody({
    ...emptyForm(),
    kind: "product",
    title: "Cake",
    total: "200",
    paymentMode: "full",
    productId: "p1",
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal("productId" in editBody(r.body, null, "p1"), false);
    assert.equal(editBody(r.body, null, "p2").productId, "p1");
    assert.equal(editBody(r.body, null, null).productId, "p1");
  }
});

test("copy follows the rules", () => {
  for (const s of Object.values(DELIVERABLE_COPY)) assert.ok(clean(s), s);
  for (const s of [
    deliverablePaidLine({ status: "paid", orderStatus: "cancelled" })!,
    orderDepositNote({ paidDirectlyCents: 100 }, "business")!,
  ])
    assert.ok(clean(s), s);
});

test("the chat card line and the Quotes list chip", async () => {
  const { whenLine } = await import("./quoteLogic");
  const { quoteListChip } = await import("./businessQuotesLogic");
  assert.equal(
    whenLine({
      kind: "product",
      dueDate: "2026-11-20",
      fulfillment: "delivery",
      jobDate: null,
      startTime: null,
      durationMinutes: null,
    } as any),
    "Due Fri, Nov 20 · Delivery",
  );
  assert.equal(
    whenLine({
      kind: "product",
      dueDate: "2026-11-20",
      jobDate: null,
      startTime: null,
      durationMinutes: null,
    } as any),
    "Due Fri, Nov 20",
    "an older card with no pickup or delivery",
  );
  assert.equal(
    whenLine({
      kind: "product",
      dueDate: null,
      fulfillment: "pickup",
      jobDate: null,
      startTime: null,
      durationMinutes: null,
    } as any),
    "Pickup",
  );
  assert.equal(
    quoteListChip({
      status: "paid",
      kind: "product",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    } as any),
    "Paid",
  );
  assert.equal(
    quoteListChip({
      status: "paid",
      kind: "service",
      bookingStatus: "confirmed",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    } as any),
    "Booked",
  );
});

test("review fixes: the business's own words, and the header chip for a paid deliverable", async () => {
  const { quoteChip } = await import("./quoteLogic");
  assert.equal(
    deliverablePaidLine(
      { status: "paid", orderStatus: "cancelled" },
      "business",
    ),
    "Refunded. You cancelled this order.",
  );
  assert.equal(
    deliverablePaidLine({ status: "paid", orderStatus: "paid" }, "business"),
    "Paid. The order is in Orders.",
  );
  const base = {
    status: "paid",
    paying: false,
    window: null,
    report: null,
    kind: "product",
  } as any;
  assert.equal(quoteChip({ ...base, orderStatus: "paid" }), "Paid");
  assert.equal(quoteChip({ ...base, orderStatus: "delivered" }), "Delivered");
  assert.equal(quoteChip({ ...base, orderStatus: "cancelled" }), "Refunded");
  assert.equal(
    quoteChip({ ...base, kind: "service" }),
    "Booked",
    "a paid service quote still reads Booked",
  );
});

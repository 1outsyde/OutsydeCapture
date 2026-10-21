import test from "node:test";
import assert from "node:assert/strict";
import { fullRefundDollars, refundRequestBody, refundedDollars } from "./refundAmount";

test("full refund is the deposit on deposit bookings", () => {
  assert.equal(fullRefundDollars({ amount: 100, depositAmountCents: 2000 }), 20);
});

test("full refund is the service price without a deposit", () => {
  assert.equal(fullRefundDollars({ amount: 100, depositAmountCents: null }), 100);
  assert.equal(fullRefundDollars({ amount: 100 }), 100);
  assert.equal(fullRefundDollars({ amount: 100, depositAmountCents: 0 }), 100);
});

test("a typed dollar amount is sent as cents", () => {
  assert.deepEqual(refundRequestBody(25), { amountCents: 2500, amount: 25 });
  assert.deepEqual(refundRequestBody(25.5), { amountCents: 2550, amount: 25.5 });
  assert.deepEqual(refundRequestBody(0.1 + 0.2), { amountCents: 30, amount: 0.1 + 0.2 });
});

test("no amount means a full refund", () => {
  assert.deepEqual(refundRequestBody(undefined), {});
});

test("the alert shows what Stripe refunded", () => {
  assert.equal(refundedDollars({ refundedAmountCents: 2550, amount: 2550 }, 25.5, 100), 25.5);
  assert.equal(refundedDollars({ amount: 25 }, 25, 100), 25);
  assert.equal(refundedDollars({}, undefined, 20), 20);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrderStatus,
  consumerOrderStatus,
  ORDER_CANCELLED,
} from "./orderStatus";

test("the app sends the backend's spelling", () => {
  assert.equal(ORDER_CANCELLED, "cancelled");
});

test("both spellings read as cancelled; other values unchanged", () => {
  assert.equal(normalizeOrderStatus("cancelled"), "cancelled");
  assert.equal(normalizeOrderStatus("canceled"), "cancelled");
  for (const s of [
    "pending",
    "paid",
    "shipped",
    "delivered",
    "refunded",
    "processing",
  ]) {
    assert.equal(normalizeOrderStatus(s), s);
  }
  assert.equal(normalizeOrderStatus(undefined), "");
  assert.equal(normalizeOrderStatus(null), "");
});

test("customer list: a cancelled order shows as cancelled, not pending (the 7 production orders)", () => {
  assert.equal(consumerOrderStatus("cancelled"), "cancelled");
  assert.equal(consumerOrderStatus("canceled"), "cancelled");
  assert.equal(consumerOrderStatus("paid"), "paid");
  assert.equal(consumerOrderStatus("shipped"), "shipped");
  assert.equal(consumerOrderStatus("delivered"), "delivered");
  assert.equal(consumerOrderStatus("pending"), "pending");
  assert.equal(consumerOrderStatus("something-new"), "pending");
  assert.equal(consumerOrderStatus(undefined), "pending");
});

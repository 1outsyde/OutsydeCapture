import test from "node:test";
import assert from "node:assert/strict";
import { sheetOptions } from "./paymentSheetOptions";

const session = { customerId: "cus_1", customerSessionClientSecret: "cuss_secret_1" };

test("iOS with a session: Apple Pay plus the customer session", () => {
  assert.deepEqual(sheetOptions(session, "ios"), {
    applePay: { merchantCountryCode: "US" },
    customerId: "cus_1",
    customerSessionClientSecret: "cuss_secret_1",
  });
});

test("iOS without a session (older backend or Stripe error): Apple Pay only", () => {
  assert.deepEqual(sheetOptions({}, "ios"), { applePay: { merchantCountryCode: "US" } });
});

test("Android with a session: saved cards, no Apple Pay", () => {
  assert.deepEqual(sheetOptions(session, "android"), {
    customerId: "cus_1",
    customerSessionClientSecret: "cuss_secret_1",
  });
});

test("web: nothing extra", () => {
  assert.deepEqual(sheetOptions(session, "web"), {});
});

test("only a customer id: no session fields (the sheet needs both)", () => {
  assert.deepEqual(sheetOptions({ customerId: "cus_1" }, "android"), {});
});

test("only a session secret: no session fields", () => {
  assert.deepEqual(sheetOptions({ customerSessionClientSecret: "cuss_secret_1" }, "android"), {});
});

test("empty strings or wrong types count as missing", () => {
  assert.deepEqual(sheetOptions({ customerId: "", customerSessionClientSecret: "cuss_secret_1" }, "android"), {});
  assert.deepEqual(sheetOptions({ customerId: "cus_1", customerSessionClientSecret: 5 as any }, "android"), {});
});

test("null or missing response is safe", () => {
  assert.deepEqual(sheetOptions(null, "ios"), { applePay: { merchantCountryCode: "US" } });
  assert.deepEqual(sheetOptions(undefined, "android"), {});
});

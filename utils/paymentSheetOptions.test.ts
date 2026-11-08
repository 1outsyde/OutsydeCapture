import test from "node:test";
import assert from "node:assert/strict";
import { sheetOptions } from "./paymentSheetOptions";
import { outsydeAppearance } from "./outsydePaymentAppearance";

const session = {
  customerId: "cus_1",
  customerSessionClientSecret: "cuss_secret_1",
};

test("iOS with a session: Apple Pay plus the customer session", () => {
  assert.deepEqual(sheetOptions(session, "ios"), {
    applePay: { merchantCountryCode: "US" },
    customerId: "cus_1",
    customerSessionClientSecret: "cuss_secret_1",
  });
});

test("iOS without a session (older backend or Stripe error): Apple Pay only", () => {
  assert.deepEqual(sheetOptions({}, "ios"), {
    applePay: { merchantCountryCode: "US" },
  });
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
  assert.deepEqual(
    sheetOptions({ customerSessionClientSecret: "cuss_secret_1" }, "android"),
    {},
  );
});

test("empty strings or wrong types count as missing", () => {
  assert.deepEqual(
    sheetOptions(
      { customerId: "", customerSessionClientSecret: "cuss_secret_1" },
      "android",
    ),
    {},
  );
  assert.deepEqual(
    sheetOptions(
      { customerId: "cus_1", customerSessionClientSecret: 5 as any },
      "android",
    ),
    {},
  );
});

test("null or missing response is safe", () => {
  assert.deepEqual(sheetOptions(null, "ios"), {
    applePay: { merchantCountryCode: "US" },
  });
  assert.deepEqual(sheetOptions(undefined, "android"), {});
});

// App payment methods Step 2: return link, Google Pay on Android, Outsyde styling.
const live = { scheme: "dark" as const, publishableKey: "pk_live_1" };

test("iOS with styling: return link and the app's current look, Apple Pay, no Google Pay", () => {
  assert.deepEqual(sheetOptions(session, "ios", live), {
    applePay: { merchantCountryCode: "US" },
    returnURL: "outsyde://stripe-redirect",
    appearance: outsydeAppearance("dark"),
    customerId: "cus_1",
    customerSessionClientSecret: "cuss_secret_1",
  });
});

test("Android with styling: Google Pay (live key = live Google Pay), no Apple Pay", () => {
  assert.deepEqual(
    sheetOptions(null, "android", {
      scheme: "light",
      publishableKey: "pk_live_1",
    }),
    {
      googlePay: {
        merchantCountryCode: "US",
        currencyCode: "USD",
        testEnv: false,
      },
      returnURL: "outsyde://stripe-redirect",
      appearance: outsydeAppearance("light"),
    },
  );
});

test("Android with a test key: Google Pay test mode", () => {
  const o = sheetOptions(null, "android", {
    scheme: "light",
    publishableKey: "pk_test_1",
  }) as any;
  assert.equal(o.googlePay.testEnv, true);
});

test("web with styling: still nothing extra", () => {
  assert.deepEqual(sheetOptions(session, "web", live), {});
});

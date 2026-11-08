// App payment methods Step 4b: product checkout with Stripe's embedded picker (compact layout, mockup approved
// 2026-11-07). Copy rules: commas and periods, no dashes, never the fee rate. Run: npx tsx utils/checkoutPaymentLogic.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  payIn4Shown,
  methodSub,
  payButtonLabel,
  chargeMatchesPreview,
  intentAmount,
  checkoutSessionBody,
  cartIntentBody,
  checkoutElementConfig,
  pickerReady,
  previewFor,
  resultErrorText,
} from "./checkoutPaymentLogic";

const style = { scheme: "light" as const, publishableKey: "pk_test_123" };
const session = {
  customerId: "cus_1",
  customerSessionClientSecret: "cuss_secret_1",
};
const who = { firstName: "Jane", lastName: "Doe", email: "jane@example.com" };
const addr = {
  line1: "1 Main St",
  city: "Freeport",
  state: "NY",
  zipCode: "11520",
};

test("pay in 4 line shows only where Klarna and Afterpay pay in 4 both work in the US ($1 to $2,000)", () => {
  assert.equal(payIn4Shown(99), false);
  assert.equal(payIn4Shown(100), true);
  assert.equal(payIn4Shown(2025), true);
  assert.equal(payIn4Shown(200000), true);
  assert.equal(payIn4Shown(200001), false);
  assert.equal(payIn4Shown(Number.NaN), false);
});

test("summary row line under each method, no dashes", () => {
  assert.equal(
    methodSub("klarna", 2025),
    "4 interest free payments of about $5.07",
  );
  assert.equal(
    methodSub("afterpay_clearpay", 2025),
    "4 interest free payments of about $5.07",
  );
  assert.equal(
    methodSub("klarna", 250000),
    null,
    "outside the pay in 4 range, no promise",
  );
  assert.equal(methodSub("cashapp", 2025), "You approve in Cash App");
  assert.equal(methodSub("amazon_pay", 2025), "You approve on Amazon");
  assert.equal(methodSub("card", 2025), null);
  assert.equal(methodSub(undefined, 2025), null);
  for (const t of ["klarna", "afterpay_clearpay", "cashapp", "amazon_pay"]) {
    const s = methodSub(t, 2025) ?? "";
    assert.ok(!/[—–-]/.test(s), s);
  }
});

test("pay button says where the customer goes next", () => {
  assert.equal(payButtonLabel("klarna", 2025), "Continue to Klarna");
  assert.equal(
    payButtonLabel("afterpay_clearpay", 2025),
    "Continue to Afterpay",
  );
  assert.equal(payButtonLabel("cashapp", 2025), "Continue to Cash App");
  assert.equal(payButtonLabel("amazon_pay", 2025), "Continue to Amazon Pay");
  assert.equal(payButtonLabel("card", 2025), "Confirm & Pay $20.25");
  assert.equal(payButtonLabel("google_pay", 2025), "Confirm & Pay $20.25");
  assert.equal(payButtonLabel(null, 100000), "Confirm & Pay $1,000.00");
});

test("the charge must match the total the customer saw", () => {
  assert.equal(chargeMatchesPreview(2025, 2025), true);
  assert.equal(chargeMatchesPreview(2025, 2026), false);
  assert.equal(
    chargeMatchesPreview(null, 2025),
    true,
    "no preview yet: nothing to compare",
  );
  assert.equal(
    chargeMatchesPreview(2025, null),
    true,
    "server sent no amount: the server's charge stands",
  );
});

test("picker amount prefers the server preview, else the local estimate, always whole positive cents", () => {
  assert.equal(intentAmount(2025, 1999), 2025);
  assert.equal(intentAmount(null, 2024.6), 2025);
  assert.equal(
    intentAmount(null, 0),
    50,
    "Stripe needs a positive amount; the real charge comes from the server",
  );
  assert.equal(intentAmount(0, 2025), 2025);
});

test("Android asks for chosen cards only (backend #430); iPhone gets every saved card", () => {
  assert.deepEqual(checkoutSessionBody("android"), { chosenCardsOnly: true });
  assert.deepEqual(checkoutSessionBody("ios"), {});
});

test("the charge request asks for every payment method and keeps today's fields", () => {
  const items = [
    {
      productId: "p1",
      vendorId: "v1",
      priceCents: 1875,
      quantity: 1,
      name: "Herbs",
    },
  ];
  assert.deepEqual(cartIntentBody(items, addr, null), {
    items,
    shippingAddress: addr,
    redirectCapable: true,
  });
  assert.deepEqual(cartIntentBody(items, addr, "promo_1"), {
    items,
    shippingAddress: addr,
    promoCodeId: "promo_1",
    redirectCapable: true,
  });
});

test("iPhone picker: Outsyde look, return link, saved cards, no Apple Pay row (the button sits on top)", () => {
  const c = checkoutElementConfig({
    os: "ios",
    style,
    session,
    user: who,
    address: addr,
  });
  assert.equal(c.merchantDisplayName, "Outsyde");
  assert.equal(c.returnURL, "outsyde://stripe-redirect");
  assert.equal(c.style, "alwaysLight");
  assert.equal(c.applePay, undefined);
  assert.equal(c.googlePay, undefined);
  assert.equal(c.customerId, "cus_1");
  assert.equal(c.customerSessionClientSecret, "cuss_secret_1");
  assert.equal(
    (c.appearance?.colors as { primary?: string } | undefined)?.primary,
    "#B38600",
  );
  assert.deepEqual(c.formSheetAction, { type: "continue" });
  assert.equal(c.allowsDelayedPaymentMethods, false);
  assert.deepEqual(c.defaultBillingDetails, {
    name: "Jane Doe",
    email: "jane@example.com",
    address: {
      line1: "1 Main St",
      city: "Freeport",
      state: "NY",
      postalCode: "11520",
      country: "US",
    },
  });
});

test("Android picker: Google Pay inside the picker, no iOS style", () => {
  const c = checkoutElementConfig({
    os: "android",
    style: { scheme: "dark", publishableKey: "pk_live_9" },
    session,
    user: who,
    address: addr,
  });
  assert.deepEqual(c.googlePay, {
    merchantCountryCode: "US",
    currencyCode: "USD",
    testEnv: false,
  });
  assert.equal(c.style, undefined);
  assert.equal(
    (c.appearance?.colors as { primary?: string } | undefined)?.primary,
    "#E8B930",
  );
});

test("without a session or details the picker still works (new card, no saved cards)", () => {
  const c = checkoutElementConfig({
    os: "ios",
    style,
    session: {},
    user: null,
    address: null,
  });
  assert.equal(c.customerId, undefined);
  assert.equal(c.customerSessionClientSecret, undefined);
  assert.equal(c.defaultBillingDetails, undefined);
  const half = checkoutElementConfig({
    os: "ios",
    style,
    session: { customerId: "cus_1" },
    user: { firstName: "", lastName: "", email: "" },
    address: { line1: " ", city: "", state: "", zipCode: "" },
  });
  assert.equal(
    half.customerId,
    undefined,
    "a lone customer id is never sent without its secret",
  );
  assert.equal(
    half.defaultBillingDetails,
    undefined,
    "blank fields are left for Stripe's form to ask",
  );
});

test("pay button waits for the picker, a method, an address and no other checkout in flight", () => {
  const ok = {
    loaded: true,
    hasOption: true,
    hasAddress: true,
    busy: false,
    empty: false,
    loadFailed: false,
  };
  assert.equal(pickerReady(ok), true);
  for (const k of ["loaded", "hasOption", "hasAddress"] as const)
    assert.equal(pickerReady({ ...ok, [k]: false }), false, k);
  for (const k of ["busy", "empty", "loadFailed"] as const)
    assert.equal(pickerReady({ ...ok, [k]: true }), false, k);
});

test("preview counts only for the cart and code it priced; pay waits until it answers", () => {
  assert.deepEqual(previewFor(null, "k1"), { pending: true, cents: null });
  assert.deepEqual(previewFor({ key: "k1", cents: 2025 }, "k1"), {
    pending: false,
    cents: 2025,
  });
  assert.deepEqual(
    previewFor({ key: "k0", cents: 2025 }, "k1"),
    { pending: true, cents: null },
    "a points code change makes the old preview stale",
  );
  assert.deepEqual(
    previewFor({ key: "k1", cents: null }, "k1"),
    { pending: false, cents: null },
    "a failed preview stops waiting; the shown estimate is checked instead",
  );
});

test("Stripe's picker sends its failure as text on both phones (StripeSdkImpl+Embedded.swift:129)", () => {
  assert.equal(
    resultErrorText({
      status: "failed",
      error: "Your card was declined." as unknown as Error,
    }),
    "Your card was declined.",
  );
  assert.equal(
    resultErrorText({ status: "failed", error: new Error("Card expired") }),
    "Card expired",
  );
  assert.equal(
    resultErrorText({ status: "failed", error: undefined as unknown as Error }),
    null,
  );
  assert.equal(
    resultErrorText({ status: "failed", error: "  " as unknown as Error }),
    null,
  );
});

test("against an estimate (preview failed) a one cent rounding gap is allowed; against the preview it must be exact", () => {
  assert.equal(chargeMatchesPreview(2025, 2026, { estimate: true }), true);
  assert.equal(chargeMatchesPreview(2025, 2024, { estimate: true }), true);
  assert.equal(chargeMatchesPreview(2025, 2027, { estimate: true }), false);
  assert.equal(chargeMatchesPreview(2025, 2026, { estimate: false }), false);
});

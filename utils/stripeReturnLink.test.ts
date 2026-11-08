// App payment methods Step 2 regression: Stripe's return link must not be claimed by the app's other link
// handlers (account setup, quote links, Stripe payout return, subscriptions, password reset).
import test from "node:test";
import assert from "node:assert/strict";
import { STRIPE_RETURN_URL } from "./outsydePaymentAppearance";
import { parseAccountSetupLink } from "./accountSetup";
import { parseQuoteLink } from "./quoteLinks";

// What Stripe sends back after a redirect payment.
const returned = [
  STRIPE_RETURN_URL,
  `${STRIPE_RETURN_URL}?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_abc&redirect_status=succeeded`,
  `${STRIPE_RETURN_URL}?setup_intent=seti_123&setup_intent_client_secret=seti_123_secret_abc&redirect_status=failed`,
];

test("account setup links ignore Stripe's return link", () => {
  for (const url of returned)
    assert.equal(parseAccountSetupLink(url), null, url);
});

test("quote links ignore Stripe's return link", () => {
  for (const url of returned) assert.equal(parseQuoteLink(url), null, url);
});

test("payout return, subscription and password reset listeners don't match it", () => {
  // Those listeners test url.includes("stripe-return"), url.includes("checkout") and url.includes("reset-password").
  for (const url of returned) {
    assert.ok(!url.includes("stripe-return"), url);
    assert.ok(!url.includes("checkout"), url);
    assert.ok(!url.includes("reset-password"), url);
  }
});

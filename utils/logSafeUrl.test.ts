// Review finding 3: incoming links are logged; Stripe's return link carries payment secrets.
import test from "node:test";
import assert from "node:assert/strict";
import { logSafeUrl } from "./logSafeUrl";

test("Stripe return links lose their query (client secrets) before logging", () => {
  assert.equal(
    logSafeUrl(
      "outsyde://stripe-redirect?payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=succeeded",
    ),
    "outsyde://stripe-redirect?[redacted]",
  );
  assert.equal(
    logSafeUrl(
      "outsyde://stripe-redirect?setup_intent=seti_1&setup_intent_client_secret=seti_1_secret_x",
    ),
    "outsyde://stripe-redirect?[redacted]",
  );
});

test("any link carrying a client secret is redacted", () => {
  assert.equal(
    logSafeUrl("outsyde://other?client_secret=abc"),
    "outsyde://other?[redacted]",
  );
});

test("other links log exactly as before", () => {
  assert.equal(
    logSafeUrl("outsyde://reset-password?token=t1"),
    "outsyde://reset-password?token=t1",
  );
  assert.equal(
    logSafeUrl("https://www.goutsyde.com/q/ABC123"),
    "https://www.goutsyde.com/q/ABC123",
  );
  assert.equal(logSafeUrl(null), null);
});

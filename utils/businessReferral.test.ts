import test from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_REFERRAL_COPY,
  businessReferralLine,
  businessReferralShareMessage,
  businessSignupLink,
  needsPayoutSetup,
  type BusinessReferral,
} from "./businessReferral";
import { isReferralRewardPush } from "./friendReferral";

const NOW = new Date("2026-10-24T16:00:00Z");
const base: BusinessReferral = {
  businessName: "Shop",
  status: "pending",
  qualifiedAt: null,
  expiresAt: "2027-01-22T16:00:00Z",
  payout: null,
};
const pay = (o: Partial<NonNullable<BusinessReferral["payout"]>>) => ({
  status: "pending",
  amountCents: 2500,
  payableAfter: "2026-10-31T16:00:00Z",
  paidAt: null,
  holdReason: null,
  ...o,
});
const q = (
  o: Partial<NonNullable<BusinessReferral["payout"]>>,
): BusinessReferral => ({ ...base, status: "qualified", payout: pay(o) });

test("link: web business signup with the code", () => {
  assert.equal(
    businessSignupLink("ab3k9pq2"),
    "https://www.goutsyde.com/business-signup?ref=AB3K9PQ2",
  );
  assert.match(
    businessReferralShareMessage("AB3K9PQ2"),
    /business-signup\?ref=AB3K9PQ2$/,
  );
  assert.match(businessReferralShareMessage("AB3K9PQ2"), /Outsyde/);
});

test("status lines say what's next", () => {
  assert.match(businessReferralLine(base, NOW), /live/i);
  assert.match(businessReferralLine(base, NOW), /Jan 22/);
  assert.match(
    businessReferralLine({ ...base, status: "expired" }, NOW),
    /90 days/,
  );
  assert.match(
    businessReferralLine({ ...base, status: "blocked" }, NOW),
    /doesn't qualify/,
  );
  assert.match(businessReferralLine(q({}), NOW), /\$25.*Oct 31/);
  assert.match(
    businessReferralLine(q({ payableAfter: "2026-10-20T00:00:00Z" }), NOW),
    /Sending soon/,
  );
  assert.match(
    businessReferralLine(q({ status: "held", holdReason: "no_account" }), NOW),
    /Set up payouts/,
  );
  assert.match(
    businessReferralLine(
      q({ status: "held", holdReason: "stripe_not_ready" }),
      NOW,
    ),
    /Stripe/,
  );
  assert.match(
    businessReferralLine(
      q({ status: "paid", paidAt: "2026-10-31T17:00:00Z" }),
      NOW,
    ),
    /\$25 sent on Oct 31/,
  );
  assert.ok(businessReferralLine(q({ status: "review" }), NOW).length > 0);
  assert.match(
    businessReferralLine(q({ status: "cancelled" }), NOW),
    /refunded/,
  );
});

test("payout setup only for a missing or unfinished account", () => {
  assert.equal(
    needsPayoutSetup([q({ status: "held", holdReason: "no_account" })]),
    true,
  );
  assert.equal(
    needsPayoutSetup([q({ status: "held", holdReason: "not_complete" })]),
    true,
  );
  assert.equal(
    needsPayoutSetup([
      q({ status: "held", holdReason: "stripe_not_ready" }),
      base,
    ]),
    false,
  );
  assert.equal(needsPayoutSetup([]), false);
});

test("copy: no dashes, no percentages", () => {
  const all = [
    ...Object.values(BUSINESS_REFERRAL_COPY),
    businessReferralShareMessage("AB3K9PQ2").replace(/https:\S+/, ""),
    ...["pending", "expired", "blocked"].map((s) =>
      businessReferralLine({ ...base, status: s }, NOW),
    ),
    ...["pending", "held", "review", "paid", "cancelled"].map((s) =>
      businessReferralLine(q({ status: s }), NOW),
    ),
  ];
  for (const t of all) {
    assert.doesNotMatch(t, /—|–| - /, t);
    assert.doesNotMatch(t, /%/, t);
  }
  assert.equal(BUSINESS_REFERRAL_COPY.fieldLabel, "Referral code (optional)");
});

test("reward pushes: friend and business both open Points", () => {
  assert.equal(
    isReferralRewardPush({ type: "business_referral_reward", kind: "paid" }),
    true,
  );
  assert.equal(isReferralRewardPush({ type: "referral_reward" }), true);
  assert.equal(isReferralRewardPush({ type: "plan_offer" }), false);
});

test("stripe return for personal payouts", async () => {
  const { hostStripeReturnMessage } = await import("./businessReferral");
  assert.match(hostStripeReturnMessage("refresh")!.body, /expired/);
  assert.match(hostStripeReturnMessage("complete")!.body, /Stripe/);
  assert.equal(hostStripeReturnMessage("cancel"), null);
  for (const s of ["refresh", "complete"])
    assert.doesNotMatch(
      JSON.stringify(hostStripeReturnMessage(s)),
      /—|–| - |%/,
    );
});

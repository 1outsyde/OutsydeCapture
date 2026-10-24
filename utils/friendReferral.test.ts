import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReferralCode,
  referralCodeFromUrl,
  isReferralRewardPush,
  openPointsFromReward,
  REFERRAL_COPY,
  referralCounts,
  referralShareMessage,
} from "./friendReferral";

function fakeNav() {
  const calls: unknown[][] = [];
  return { calls, navigate: (...args: unknown[]) => calls.push(args) };
}

test("codes: letters and digits up to 20, uppercased", () => {
  assert.equal(normalizeReferralCode(" ab3k9pq2 "), "AB3K9PQ2");
  assert.equal(normalizeReferralCode("AB3K-9PQ2"), null);
  assert.equal(normalizeReferralCode("A".repeat(21)), null);
  assert.equal(normalizeReferralCode(""), null);
  assert.equal(normalizeReferralCode(undefined), null);
  assert.equal(normalizeReferralCode(42 as unknown), null);
});

test("links: goutsyde.com/r/<CODE> on either host", () => {
  assert.equal(
    referralCodeFromUrl("https://www.goutsyde.com/r/ab3k9pq2"),
    "AB3K9PQ2",
  );
  assert.equal(
    referralCodeFromUrl("https://goutsyde.com/r/AB3K9PQ2/"),
    "AB3K9PQ2",
  );
  assert.equal(
    referralCodeFromUrl("https://GOUTSYDE.com/r/AB3K9PQ2"),
    "AB3K9PQ2",
  );
});

test("links: anything else is not a friend code", () => {
  assert.equal(referralCodeFromUrl("https://evil.example/r/AB3K9PQ2"), null);
  assert.equal(referralCodeFromUrl("http://www.goutsyde.com/r/AB3K9PQ2"), null);
  assert.equal(
    referralCodeFromUrl("https://www.goutsyde.com/r/AB3K9PQ2/extra"),
    null,
  );
  assert.equal(
    referralCodeFromUrl("https://www.goutsyde.com/claim?token=x"),
    null,
  );
  assert.equal(
    referralCodeFromUrl("https://www.goutsyde.com/r/bad-code"),
    null,
  );
  assert.equal(referralCodeFromUrl("outsyde://stripe-return"), null);
  assert.equal(referralCodeFromUrl("not a url"), null);
});

test("push: only referral_reward", () => {
  assert.equal(
    isReferralRewardPush({ type: "referral_reward", referenceId: "r1" }),
    true,
  );
  assert.equal(isReferralRewardPush({ type: "plan_offer" }), false);
  assert.equal(isReferralRewardPush(null), false);
  assert.equal(isReferralRewardPush(undefined), false);
});

test("reward tap: signed in goes to Points without a second copy of the tabs", () => {
  const nav = fakeNav();
  openPointsFromReward(nav, { role: "consumer", isGuest: false });
  assert.deepEqual(nav.calls, [
    [
      "Main",
      { screen: "AccountTab", params: { screen: "OutsydePoints" } },
      { pop: true },
    ],
  ]);
});

test("reward tap: guest or signed out goes to sign in", () => {
  const a = fakeNav();
  openPointsFromReward(a, null);
  const b = fakeNav();
  openPointsFromReward(b, { role: "consumer", isGuest: true });
  assert.deepEqual(a.calls, [["Auth", {}]]);
  assert.deepEqual(b.calls, [["Auth", {}]]);
});

test("counts: waiting includes friends who bought but whose purchase isn't final yet", () => {
  assert.deepEqual(
    referralCounts({
      totalReferrals: 4,
      pendingReferrals: 1,
      qualifyingReferrals: 2,
      completedReferrals: 1,
      totalPointsEarned: 2500,
    }),
    { invited: 4, waiting: 3, earned: 2500 },
  );
  assert.deepEqual(referralCounts(undefined), {
    invited: 0,
    waiting: 0,
    earned: 0,
  });
});

test("share message carries the link", () => {
  const m = referralShareMessage("https://www.goutsyde.com/r/AB3K9PQ2");
  assert.ok(m.endsWith("https://www.goutsyde.com/r/AB3K9PQ2"));
});

test("copy: real punctuation, no dashes, no percentages, loyalty rewards named", () => {
  for (const v of [
    ...Object.values(REFERRAL_COPY),
    referralShareMessage("https://x.test/r/A"),
  ]) {
    assert.ok(!/(—|–| - )/.test(v), `dash in: ${v}`);
    assert.ok(!/%/.test(v), `percent in: ${v}`);
  }
  assert.match(REFERRAL_COPY.cardBody, /2,500/);
  assert.match(REFERRAL_COPY.cardBody, /\$10/);
  assert.match(REFERRAL_COPY.cardBody, /loyalty rewards/i);
});

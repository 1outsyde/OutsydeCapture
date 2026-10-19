import test from "node:test";
import assert from "node:assert/strict";
import {
  describePaidPlan,
  switchChargeNote,
  hasPaidPlan,
  isSubscriptionPush,
} from "./subscriptionState";

const noDash = (s: string | null) => !s || !/[–—]| - /.test(s);

test("active plan", () => {
  const s = describePaidPlan({ status: "active" });
  assert.equal(s.kind, "active");
  assert.equal(s.label, "Active");
  assert.equal(s.note, null);
});

test("late plan names the day listings pause", () => {
  const s = describePaidPlan({
    status: "past_due",
    graceEndsAt: "2026-10-23T12:00:00.000Z",
  });
  assert.equal(s.kind, "late");
  assert.equal(s.label, "Payment late");
  assert.ok(s.note!.includes("by Friday, October 23"), s.note!);
});

test("late plan without a date says soon (older backend)", () => {
  assert.ok(
    describePaidPlan({ status: "past_due" }).note!.includes("payment soon"),
  );
});

test("paused wins over late", () => {
  const s = describePaidPlan({ status: "past_due", listingsPaused: true });
  assert.equal(s.kind, "paused");
  assert.equal(s.label, "Paused");
});

test("other statuses get a readable label", () => {
  assert.equal(
    describePaidPlan({ status: "incomplete_expired" }).label,
    "Incomplete expired",
  );
});

test("switch charge note only for paid to paid while paid up", () => {
  assert.equal(
    switchChargeNote({
      currentIsPaid: true,
      currentStatus: "active",
      targetPriceInCents: 5900,
    }),
    "You'll be charged $59.00 today and your billing date moves to today. There's no credit for time left on your current plan.",
  );
  assert.equal(
    switchChargeNote({
      currentIsPaid: false,
      currentStatus: "active",
      targetPriceInCents: 5900,
    }),
    null,
  );
  assert.equal(
    switchChargeNote({
      currentIsPaid: true,
      currentStatus: "past_due",
      targetPriceInCents: 5900,
    }),
    null,
  );
  assert.equal(
    switchChargeNote({
      currentIsPaid: true,
      currentStatus: "active",
      targetPriceInCents: 0,
    }),
    null,
  );
});

test("late or paused vendors count as having a paid plan (open Manage, not Plans)", () => {
  assert.equal(
    hasPaidPlan({ stripeSubscriptionId: "sub_1", status: "past_due" }),
    true,
  );
  assert.equal(
    hasPaidPlan({ stripeSubscriptionId: "sub_1", status: "active" }),
    true,
  );
  assert.equal(
    hasPaidPlan({ stripeSubscriptionId: "sub_1", status: "canceled" }),
    false,
  );
  assert.equal(
    hasPaidPlan({ stripeSubscriptionId: null, status: "active" }),
    true,
  );
  assert.equal(hasPaidPlan(null), false);
});

test("subscription push detection", () => {
  assert.equal(
    isSubscriptionPush({
      type: "subscription_payment_failed",
      screen: "subscription",
    }),
    true,
  );
  assert.equal(
    isSubscriptionPush({ type: "booking_request", screen: "dashboard" }),
    false,
  );
  assert.equal(isSubscriptionPush(null), false);
});

test("copy has no dashes and no fee percentage", () => {
  for (const s of [
    describePaidPlan({
      status: "past_due",
      graceEndsAt: "2026-10-23T12:00:00Z",
    }).note,
    describePaidPlan({ status: "past_due", listingsPaused: true }).note,
    switchChargeNote({
      currentIsPaid: true,
      currentStatus: "active",
      targetPriceInCents: 4099,
    }),
  ]) {
    assert.ok(noDash(s), s ?? "");
    assert.ok(!/8\s?%/.test(s ?? ""));
  }
});

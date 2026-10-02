import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowConnectPrompt, type ConnectPromptInput } from "./connectPrompt";

const clear = { requiresApproval: false, requiresPlanSelection: false, requiresOnboarding: false, requiresSubscription: false };
const notReady = { chargesEnabled: false, payoutsEnabled: false };

const base: ConnectPromptInput = {
  role: "business",
  connectReady: false,
  stripeStatus: notReady,
  eligibility: clear,
  snoozed: false,
  blockingModalOpen: false,
  mainFocused: true,
};
const show = (o: Partial<ConnectPromptInput>) => shouldShowConnectPrompt({ ...base, ...o });

test("Lana: waived free vendor, no Connect account", () => {
  assert.equal(show({}), true);
});
test("BWL / Lotus / Dia Lux: paid (connectReady null)", () => {
  assert.equal(show({ connectReady: null }), false);
  assert.equal(show({ connectReady: undefined }), false);
});
test("free vendor with Connect complete (connectReady true)", () => {
  assert.equal(show({ connectReady: true, stripeStatus: { chargesEnabled: true, payoutsEnabled: true } }), false);
});
test("free vendor mid-verification: account exists, payouts not enabled", () => {
  assert.equal(show({ stripeStatus: { chargesEnabled: true, payoutsEnabled: false } }), true);
});
test("backend false but live status says ready (Stripe blip) -> hidden", () => {
  assert.equal(show({ connectReady: false, stripeStatus: { chargesEnabled: true, payoutsEnabled: true } }), false);
});
test("staff, consumer, photographer, guest, missing role", () => {
  for (const role of ["staff", "consumer", "photographer", "admin", "guest", null, undefined]) {
    assert.equal(show({ role }), false, String(role));
  }
});
test("getVendorStripeStatus failed -> hidden", () => {
  assert.equal(show({ stripeStatus: null }), false);
  assert.equal(show({ stripeStatus: undefined }), false);
});
test("eligibility not loaded or failed -> hidden", () => {
  assert.equal(show({ eligibility: null }), false);
  assert.equal(show({ eligibility: undefined }), false);
});
test("each eligibility gate flag hides the prompt", () => {
  for (const k of ["requiresApproval", "requiresPlanSelection", "requiresOnboarding", "requiresSubscription"] as const) {
    assert.equal(show({ eligibility: { ...clear, [k]: true } }), false, k);
  }
});
test("snoozed, blocking modal open, Main not focused", () => {
  assert.equal(show({ snoozed: true }), false);
  assert.equal(show({ blockingModalOpen: true }), false);
  assert.equal(show({ mainFocused: false }), false);
});

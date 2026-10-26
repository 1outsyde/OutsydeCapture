/** Unit tests for the app's payout gate and Stripe return helpers (Events canvas 35). npx tsx utils/host/hostGate.test.ts */
import {
  gateCopy, hostChoicesFromStatus, statusResult, gateAtOpen, markHostSetupPending, takeHostSetupPending, HOST_SETUP_TTL_MS,
  clearHostSetupPending, onHostSetupReturn, notifyHostSetupReturn,
} from "./hostGate";

let passed = 0, failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.error(`  FAIL ${name}`, JSON.stringify(actual), "expected", JSON.stringify(expected)); }
}

console.log("statusResult");
eq(statusResult({ success: true, hasAccount: false, ready: false, needsSetup: true }), "setup", "no account");
eq(statusResult({ success: true, hasAccount: true, ready: false }), "finish", "unfinished account");
eq(statusResult({ success: true, hasAccount: true, ready: true }), "ready", "ready");
eq(statusResult(null, { status: 403, body: { error: { code: "NOT_A_BUSINESS_OWNER", message: "x" } } }), "none", "not a business owner: not a host choice");
eq(statusResult(null, { status: 403, body: { error: { code: "BUSINESS_NOT_APPROVED", message: "x" } } }), "none", "business not approved: not a host choice");
eq(statusResult(null, { status: 403, body: { error: { code: "NOT_A_PHOTOGRAPHER", message: "x" } } }), "none", "no photographer profile: not a host choice");
eq(statusResult(null, { status: 500, body: {} }), "unknown", "server error: unknown");
eq(statusResult(null, { message: "Network error" }), "unknown", "network error: unknown");
eq(statusResult(null, { status: 403, body: { error: { code: "ACCOUNT_INACTIVE", message: "x" } } }), "unknown", "inactive account is not hidden as a missing profile");

console.log("hostChoicesFromStatus");
eq(hostChoicesFromStatus({ user: "setup", business: "none", photographer: "none" }), ["user"], "consumer only");
eq(hostChoicesFromStatus({ user: "setup", business: "ready", photographer: "none" }), ["user", "business"], "business owner");
eq(hostChoicesFromStatus({ user: "ready", business: "unknown", photographer: "finish" }), ["user", "photographer"], "unknown business is left out");

console.log("gateAtOpen");
eq(gateAtOpen(["user"], { user: "setup", business: "none", photographer: "none" }), "user", "consumer without payouts: gate first");
eq(gateAtOpen(["user"], { user: "finish", business: "none", photographer: "none" }), "user", "consumer with an unfinished account: gate first");
eq(gateAtOpen(["user"], { user: "ready", business: "none", photographer: "none" }), null, "consumer ready: no gate");
eq(gateAtOpen(["user"], { user: "unknown", business: "none", photographer: "none" }), null, "unknown status: no gate (publish still checks)");
eq(gateAtOpen(["user", "business"], { user: "setup", business: "finish", photographer: "none" }), null, "two host choices: the gate waits for the pick");

console.log("gateCopy");
const consumer = gateCopy("user", "setup");
eq(consumer.title, "Set up payouts to host events", "consumer title");
eq(consumer.body, "Every Outsyde host connects a bank through Stripe first, even for free RSVPs, so adding paid tickets later never stops your event.", "consumer body");
eq(consumer.step1, "Tap Set up payouts. It opens the same Stripe setup businesses and photographers use.", "consumer step 1");
eq(consumer.cta, "Set up payouts", "consumer button");
const biz = gateCopy("business", "finish");
eq(biz.title, "Finish your payout setup", "business title");
eq(biz.body, "Your business's Stripe account isn't finished yet. Finish it once and you can host free and paid events.", "business body");
eq(biz.step1, "Tap Finish payout setup. It opens your business's Stripe setup.", "business step 1");
eq(biz.cta, "Finish payout setup", "business button");
eq(gateCopy("business", "setup").title, "Set up payouts to host events", "business with no account yet");
eq(gateCopy("business", "setup").cta, "Set up payouts", "business with no account: set up button");
eq(gateCopy("photographer", "finish").body, "Your photographer Stripe account isn't finished yet. Finish it once and you can host free and paid events.", "photographer body");
eq(gateCopy("user", "finish").body, "Your payout setup isn't finished yet. Finish it once and you can host free and paid events.", "consumer unfinished body");
for (const h of ["user", "business", "photographer"] as const) {
  for (const s of ["setup", "finish"] as const) {
    const c = gateCopy(h, s);
    const all = [c.title, c.body, c.step1, c.cta].join(" ");
    eq(/[–—]| - /.test(all), false, `${h} ${s}: no dashes`);
    eq(/%/.test(all), false, `${h} ${s}: no percentages`);
  }
}

console.log("pending Stripe return");
eq(takeHostSetupPending(1000), false, "nothing pending");
markHostSetupPending(1000);
eq(takeHostSetupPending(2000), true, "pending after opening Stripe");
eq(takeHostSetupPending(3000), false, "taken once");
markHostSetupPending(1000);
eq(takeHostSetupPending(1000 + HOST_SETUP_TTL_MS + 1), false, "an old setup no longer redirects returns");

markHostSetupPending(1000);
clearHostSetupPending();
eq(takeHostSetupPending(1001), false, "leaving the editor clears it");

console.log("return listeners");
let calls = 0;
const off = onHostSetupReturn(() => { calls++; });
notifyHostSetupReturn();
eq(calls, 1, "the editor hears the return");
off();
notifyHostSetupReturn();
eq(calls, 1, "not after it unsubscribed");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

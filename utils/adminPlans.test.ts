/**
 * Admin vendor plans: New York dates without Intl, plan and offer labels, typed dates, error text.
 * The New York math is checked against Intl (what goutsyde.com uses). Run with: npx tsx utils/adminPlans.test.ts
 */
import assert from "node:assert/strict";
import {
  adminErrorMessage,
  adminOfferText,
  errorHint,
  etDatePlusDays,
  etDatePlusMonths,
  etEndOfDayIso,
  etOffsetHours,
  etToday,
  formatEtDate,
  isAfterEtToday,
  parseTypedDate,
  planLabel,
  SYNC_HINT,
  type AdminSubscriptionSummary,
} from "./adminPlans";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} ${name}`);
};

// goutsyde.com's own versions (lib/free-plan.ts), used only as the reference here.
const ET = "America/New_York";
const webEtToday = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: ET });
const webFormatEtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { timeZone: ET, month: "long", day: "numeric", year: "numeric" });
function webEtEndOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const noonEt = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ET, timeZoneName: "longOffset" }).formatToParts(noonEt);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(raw);
  const offset = match ? `${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}` : "+00:00";
  return `${dateStr}T23:59:59${offset}`;
}

t("New York date and format match Intl every 37 minutes across 2025 to 2028 (both DST switches)", () => {
  let checked = 0;
  for (let ms = Date.UTC(2025, 0, 1); ms < Date.UTC(2029, 0, 1); ms += 37 * 60 * 1000) {
    const now = new Date(ms);
    assert.equal(etToday(now), webEtToday(now), `etToday at ${now.toISOString()}`);
    assert.equal(formatEtDate(now), webFormatEtDate(ms), `formatEtDate at ${now.toISOString()}`);
    checked++;
  }
  assert.ok(checked > 50000);
});

t("end of day offset matches Intl for every day 2025 to 2030", () => {
  for (let ms = Date.UTC(2025, 0, 1); ms < Date.UTC(2031, 0, 1); ms += 24 * 3600 * 1000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    assert.equal(etEndOfDayIso(d), webEtEndOfDayIso(d), d);
  }
});

t("switch instants: 2026-03-08 07:00Z is EDT, a minute before is EST; 2026-11-01 06:00Z is EST", () => {
  assert.equal(etOffsetHours(Date.UTC(2026, 2, 8, 7, 0)), -4);
  assert.equal(etOffsetHours(Date.UTC(2026, 2, 8, 6, 59)), -5);
  assert.equal(etOffsetHours(Date.UTC(2026, 10, 1, 6, 0)), -5);
  assert.equal(etOffsetHours(Date.UTC(2026, 10, 1, 5, 59)), -4);
  assert.equal(etEndOfDayIso("2026-07-04"), "2026-07-04T23:59:59-04:00");
  assert.equal(etEndOfDayIso("2026-12-31"), "2026-12-31T23:59:59-05:00");
});

t("late evening New York is still today, not tomorrow", () => {
  const now = new Date("2026-11-06T04:30:00Z"); // 11:30 PM Nov 5 in New York
  assert.equal(etToday(now), "2026-11-05");
  assert.equal(isAfterEtToday("2026-11-05", now), false);
  assert.equal(isAfterEtToday("2026-11-06", now), true);
  assert.equal(isAfterEtToday("2026-02-30", now), false);
});

t("presets: days and months from New York today, month end clamped", () => {
  const now = new Date("2026-11-06T04:30:00Z");
  assert.equal(etDatePlusDays(30, now), "2026-12-05");
  assert.equal(etDatePlusDays(90, now), "2027-02-03");
  assert.equal(etDatePlusMonths(6, now), "2027-05-05");
  assert.equal(etDatePlusMonths(12, now), "2026-11-05".replace("2026", "2027"));
  assert.equal(etDatePlusMonths(1, new Date("2027-01-31T17:00:00Z")), "2027-02-28");
});

t("typed dates", () => {
  assert.equal(parseTypedDate("12/31/2026"), "2026-12-31");
  assert.equal(parseTypedDate(" 1/5/2027 "), "2027-01-05");
  assert.equal(parseTypedDate("12-31-2026"), "2026-12-31");
  assert.equal(parseTypedDate("2026-12-31"), "2026-12-31");
  assert.equal(parseTypedDate("2/30/2027"), null);
  assert.equal(parseTypedDate("13/01/2027"), null);
  assert.equal(parseTypedDate("tomorrow"), null);
  assert.equal(parseTypedDate(""), null);
});

const sub = (over: Partial<AdminSubscriptionSummary>): AdminSubscriptionSummary => ({
  tierName: "waived",
  tierDisplayName: "Waived",
  isComplimentary: true,
  status: "active",
  currentPeriodEnd: null,
  hasStripeSubscription: false,
  ...over,
});

t("plan labels match the web", () => {
  const now = new Date("2026-11-06T15:00:00Z");
  assert.deepEqual(planLabel({ subscription: null }, now), { kind: "none", text: null, activeFree: false, needsStripeConnect: false });
  assert.equal(planLabel({ subscription: sub({ isComplimentary: false, tierDisplayName: "Pro", status: "active" }) }, now).text, "Pro · active");
  assert.equal(planLabel({ subscription: sub({ hasStripeSubscription: true, tierDisplayName: "Growth", status: "past_due" }) }, now).kind, "paid");
  const perm = planLabel({ subscription: sub({ currentPeriodEnd: "2099-01-01T00:00:00Z" }), hasConnectAccount: true, stripeOnboardingComplete: true }, now);
  assert.equal(perm.text, "Free, no end date");
  assert.equal(perm.activeFree, true);
  assert.equal(perm.needsStripeConnect, false);
  const until = planLabel({ subscription: sub({ currentPeriodEnd: "2027-01-01T04:59:59Z" }), hasConnectAccount: false }, now);
  assert.equal(until.text, "Free until December 31, 2026");
  assert.equal(until.needsStripeConnect, true);
  assert.equal(planLabel({ subscription: sub({ currentPeriodEnd: "2026-10-01T03:59:59Z" }) }, now).text, "Free plan ended September 30, 2026");
  const canceled = planLabel({ subscription: sub({ status: "canceled", currentPeriodEnd: "2027-01-01T04:59:59Z" }) }, now);
  assert.equal(canceled.activeFree, false);
  assert.equal(canceled.needsStripeConnect, false);
});

t("offer text matches the web", () => {
  assert.deepEqual(adminOfferText(null), { text: "No offer", tone: "none" });
  const base = { id: "o", permanent: false, freeExpiresAt: null, createdAt: "2026-11-05T15:00:00Z", acceptedAt: null, withdrawnAt: null };
  assert.equal(adminOfferText({ ...base, plan: "grandfathered", status: "pending" }).text, "Grandfathered offer sent November 5, 2026. Waiting for them to accept.");
  assert.equal(adminOfferText({ ...base, plan: "free", status: "pending", permanent: true }).text, "Free plan, no end date offer sent November 5, 2026. Waiting for them to accept.");
  assert.equal(adminOfferText({ ...base, plan: "free", status: "accepted", freeExpiresAt: "2027-01-01T04:59:59Z", acceptedAt: "2026-11-06T15:00:00Z" }).text, "Free plan until December 31, 2026 accepted November 6, 2026");
  assert.equal(adminOfferText({ ...base, plan: "grandfathered", status: "withdrawn", withdrawnAt: null }).text, "Grandfathered offer withdrawn");
});

t("error text: nested offer errors, flat free plan errors, sync hint", () => {
  assert.equal(adminErrorMessage({ message: "[object Object]", body: { success: false, error: { code: "ALREADY_ON_PLAN", message: "This business is already on the Grandfathered plan." } } }, "x"), "This business is already on the Grandfathered plan.");
  assert.equal(adminErrorMessage({ message: "expiresAt must be in the future", body: { error: "expiresAt must be in the future" } }, "x"), "expiresAt must be in the future");
  assert.equal(adminErrorMessage({ message: "Network error" }, "x"), "Network error");
  assert.equal(adminErrorMessage({}, "Could not send the offer."), "Could not send the offer.");
  assert.equal(errorHint("This business has a paid subscription that is still live in Stripe."), SYNC_HINT);
  assert.equal(errorHint("Business not found"), null);
});

console.log(`\n${n} passed`);

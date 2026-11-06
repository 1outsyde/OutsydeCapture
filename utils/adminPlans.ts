// Admin vendor plans (App Admin Step 6). App copy of goutsyde.com lib/free-plan.ts and the
// adminOfferText part of lib/plan-offer.ts, so labels and dates match the web exactly.
//
// The web reads New York time with Intl (timeZone + timeZoneName "longOffset"), which the app's
// JS engine may not support. Here New York time comes from the US daylight saving rule instead:
// EDT (UTC-4) from the second Sunday of March 2:00 local to the first Sunday of November 2:00
// local, EST (UTC-5) otherwise. utils/adminPlans.test.ts checks it against Intl.
// Run with: npx tsx utils/adminPlans.test.ts

/** Permanent grants end here (backend PERMANENT_EXPIRY_ISO). */
const PERMANENT_FROM_MS = Date.UTC(2099, 0, 1);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface AdminSubscriptionSummary {
  tierName: string;
  tierDisplayName: string;
  isComplimentary: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  hasStripeSubscription: boolean;
}

export type OfferPlan = "grandfathered" | "free";

export interface AdminOfferSummary {
  id: string;
  plan: OfferPlan;
  status: "pending" | "accepted" | "withdrawn";
  freeExpiresAt: string | null;
  permanent: boolean;
  createdAt: string | null;
  acceptedAt: string | null;
  withdrawnAt: string | null;
}

function toMs(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** UTC day of month of the nth Sunday (n = 1 or 2) of a month. */
function nthSundayUtc(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

/** New York's offset from UTC in hours at this instant: -4 (EDT) or -5 (EST). */
export function etOffsetHours(ms: number): -4 | -5 {
  const year = new Date(ms).getUTCFullYear();
  // 2:00 EST = 07:00 UTC (start); 2:00 EDT = 06:00 UTC (end).
  const start = Date.UTC(year, 2, nthSundayUtc(year, 2, 2), 7);
  const end = Date.UTC(year, 10, nthSundayUtc(year, 10, 1), 6);
  return ms >= start && ms < end ? -4 : -5;
}

/** The New York calendar date of an instant. */
function etParts(ms: number): { y: number; m: number; d: number } {
  const shifted = new Date(ms + etOffsetHours(ms) * 3600 * 1000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isPermanentEnd(value: string | Date | null | undefined): boolean {
  const ms = toMs(value);
  return ms !== null && ms >= PERMANENT_FROM_MS;
}

/** "October 7, 2026", in New York time (web formatEtDate). */
export function formatEtDate(value: string | Date): string {
  const ms = toMs(value);
  if (ms === null) return "";
  const { y, m, d } = etParts(ms);
  return `${MONTHS[m]} ${d}, ${y}`;
}

/** "Oct 7, 2026", in New York time (for tight rows). */
export function formatEtDateShort(value: string | Date): string {
  const ms = toMs(value);
  if (ms === null) return "";
  const { y, m, d } = etParts(ms);
  return `${SHORT_MONTHS[m]} ${d}, ${y}`;
}

/** Today's date in New York as YYYY-MM-DD. */
export function etToday(now: Date = new Date()): string {
  const { y, m, d } = etParts(now.getTime());
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** True when `dateStr` (YYYY-MM-DD) is a real date strictly after today in New York. */
export function isAfterEtToday(dateStr: string, now: Date = new Date()): boolean {
  return isRealDate(dateStr) && dateStr > etToday(now);
}

/**
 * End of the picked day in New York, ISO-8601 with the DST-correct offset (-04:00 / -05:00).
 * The offset is read at noon that day (never ambiguous), same as the web.
 */
export function etEndOfDayIso(dateStr: string): string {
  if (!isRealDate(dateStr)) throw new Error("Invalid date");
  const [y, m, d] = dateStr.split("-").map(Number);
  const noonEt = Date.UTC(y, m - 1, d, 17, 0, 0); // 12:00 EST / 13:00 EDT
  const off = etOffsetHours(noonEt);
  return `${dateStr}T23:59:59-${pad(-off)}:00`;
}

/** New York date `days` after today, as YYYY-MM-DD. */
export function etDatePlusDays(days: number, now: Date = new Date()): string {
  const [y, m, d] = etToday(now).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** New York date `months` after today (day clamped to the month's length), as YYYY-MM-DD. */
export function etDatePlusMonths(months: number, now: Date = new Date()): string {
  const [y, m, d] = etToday(now).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${pad(tm + 1)}-${pad(Math.min(d, lastDay))}`;
}

/**
 * A date typed by hand: "12/31/2026", "12-31-2026" or "2026-12-31" → "2026-12-31".
 * Null when it is not a real calendar date.
 */
export function parseTypedDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isRealDate(iso) ? iso : null;
}

export type FreePlanEndKind = "permanent" | "until" | "ended";

/** Web describeFreePlanEnd: permanent first, then ended (canceled or past), else until. */
export function describeFreePlanEnd(
  plan: { status?: string | null; currentPeriodEnd?: string | Date | null },
  now: Date = new Date(),
): { kind: FreePlanEndKind; label: string } {
  if (isPermanentEnd(plan.currentPeriodEnd)) return { kind: "permanent", label: "Free, no end date" };
  const end = toMs(plan.currentPeriodEnd);
  const canceled = (plan.status ?? "").toLowerCase() === "canceled";
  if (canceled || (end !== null && end <= now.getTime())) {
    return { kind: "ended", label: end !== null ? `Free plan ended ${formatEtDate(plan.currentPeriodEnd as string | Date)}` : "Free plan ended" };
  }
  if (end === null) return { kind: "until", label: "Free plan" };
  return { kind: "until", label: `Free until ${formatEtDate(plan.currentPeriodEnd as string | Date)}` };
}

export interface PlanLabelInput {
  subscription?: AdminSubscriptionSummary | null;
  hasConnectAccount?: boolean | null;
  stripeOnboardingComplete?: boolean | null;
}

export interface PlanLabel {
  kind: "none" | "free" | "paid";
  text: string | null;
  end?: FreePlanEndKind;
  /** A free plan that has not ended (what Extend and Revoke apply to). */
  activeFree: boolean;
  needsStripeConnect: boolean;
}

/** Web planLabel: the plan line under a business name. */
export function planLabel(row: PlanLabelInput, now: Date = new Date()): PlanLabel {
  const sub = row.subscription;
  if (!sub) return { kind: "none", text: null, activeFree: false, needsStripeConnect: false };
  if (!sub.isComplimentary || sub.hasStripeSubscription) {
    return { kind: "paid", text: `${sub.tierDisplayName} · ${sub.status ?? ""}`, activeFree: false, needsStripeConnect: false };
  }
  const end = describeFreePlanEnd({ status: sub.status, currentPeriodEnd: sub.currentPeriodEnd }, now);
  const activeFree = end.kind !== "ended";
  return {
    kind: "free",
    text: end.label,
    end: end.kind,
    activeFree,
    needsStripeConnect: activeFree && (!row.hasConnectAccount || !row.stripeOnboardingComplete),
  };
}

/** Web adminOfferText: the offer line for a business. */
export function adminOfferText(o: AdminOfferSummary | null | undefined): { text: string; tone: "none" | "pending" | "accepted" | "withdrawn" } {
  if (!o) return { text: "No offer", tone: "none" };
  const plan = o.plan === "free"
    ? (o.permanent || !o.freeExpiresAt ? "Free plan, no end date" : `Free plan until ${formatEtDate(o.freeExpiresAt)}`)
    : "Grandfathered";
  if (o.status === "pending") return { text: `${plan} offer sent ${o.createdAt ? formatEtDate(o.createdAt) : ""}. Waiting for them to accept.`.replace(" .", "."), tone: "pending" };
  if (o.status === "accepted") return { text: `${plan} accepted ${o.acceptedAt ? formatEtDate(o.acceptedAt) : ""}`.trim(), tone: "accepted" };
  return { text: `${plan} offer withdrawn ${o.withdrawnAt ? formatEtDate(o.withdrawnAt) : ""}`.trim(), tone: "withdrawn" };
}

const SYNC_HINT_TRIGGER = "paid subscription that is still live";
export const SYNC_HINT = "If their paid plan was already canceled in Stripe, sync the subscription first.";

/** Web errorHint: the extra line for the "paid subscription that is still live" 409. */
export function errorHint(message: string): string | null {
  return message.includes(SYNC_HINT_TRIGGER) ? SYNC_HINT : null;
}

/**
 * The readable message from an app ApiError. Plan offer routes answer { error: { code, message } };
 * the free plan routes answer { error: "..." }.
 */
export function adminErrorMessage(err: any, fallback: string): string {
  const nested = err?.body?.error;
  if (nested && typeof nested === "object" && typeof nested.message === "string" && nested.message) return nested.message;
  if (typeof nested === "string" && nested) return nested;
  if (typeof err?.body?.message === "string" && err.body.message) return err.body.message;
  if (typeof err?.message === "string" && err.message && err.message !== "[object Object]") return err.message;
  return fallback;
}

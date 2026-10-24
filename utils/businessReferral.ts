// Business referrals (2026-10-24). Anyone who refers a business earns $25 cash once the business is
// approved, on a paid plan whose first charge cleared, has a feed post and something live, all within
// 90 days. The $25 goes out 7 days later. Rules live on the backend (GET /api/referral/business).
// Copy rules: real punctuation, no dashes, never a percentage.

import { normalizeReferralCode } from "./friendReferral";

export interface BusinessReferralPayout {
  status: string;
  amountCents: number;
  payableAfter: string;
  paidAt: string | null;
  holdReason: string | null;
}
export interface BusinessReferral {
  businessName: string;
  status: string;
  qualifiedAt: string | null;
  expiresAt: string;
  payout: BusinessReferralPayout | null;
}
export interface BusinessReferralTotals {
  invited: number;
  qualified: number;
  paidCents: number;
  waitingCents: number;
}
export interface BusinessReferralsInfo {
  success?: boolean;
  rewardCents?: number;
  referrals: BusinessReferral[];
  totals: BusinessReferralTotals;
}

export const BUSINESS_REFERRAL_COPY = {
  cardTitle: "Refer a business, get $25",
  cardBody:
    "Know a business that belongs on Outsyde? Share your link. You get $25 cash when they're approved, on a paid plan, and have a post and a service or product live within 90 days.",
  share: "Bring your business to Outsyde. Sign up with my link:",
  fieldLabel: "Referral code (optional)",
  fieldHint: "Did someone refer you? Enter their code.",
  setupPayouts: "Set up payouts",
  setupPayoutsBody:
    "Connect a bank account through Stripe so we can send your $25.",
  setupReturn: "Back from Stripe. Your payout status updates in a minute.",
  empty: "No businesses yet. Share your link to get started.",
} as const;

/** The web business signup with the code (the app has no business deep link). */
export function businessSignupLink(code: string): string {
  return `https://www.goutsyde.com/business-signup?ref=${encodeURIComponent((normalizeReferralCode(code) ?? code).toUpperCase())}`;
}

export function businessReferralShareMessage(code: string): string {
  return `${BUSINESS_REFERRAL_COPY.share} ${businessSignupLink(code)}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  } catch {
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
}

/** One plain line for a referred business's status. `now` is for tests. */
export function businessReferralLine(
  r: BusinessReferral,
  now: Date = new Date(),
): string {
  const p = r.payout;
  if (r.status === "blocked") return "This one doesn't qualify for the $25.";
  if (r.status === "expired") return "Didn't finish setting up within 90 days.";
  if (r.status === "pending" || !p)
    return `Waiting for them to go live on a paid plan, by ${shortDate(r.expiresAt)}.`;
  switch (p.status) {
    case "paid":
      return `$25 sent${p.paidAt ? ` on ${shortDate(p.paidAt)}` : ""}.`;
    case "cancelled":
      return "Their plan payment was refunded, so the $25 was cancelled.";
    case "review":
      return "We're checking this payout. No action needed.";
    case "held":
      if (p.holdReason === "stripe_not_ready")
        return "$25 earned. Stripe is still checking your payout account.";
      return "$25 earned. Set up payouts so we can send it.";
    default:
      return new Date(p.payableAfter).getTime() > now.getTime()
        ? `$25 earned. We send it on ${shortDate(p.payableAfter)}.`
        : "$25 earned. Sending soon.";
  }
}

/** True when a held payout waits on the referrer to connect or finish a payout account. */
export function needsPayoutSetup(rs: BusinessReferral[]): boolean {
  return rs.some(
    (r) =>
      r.payout?.status === "held" &&
      (r.payout.holdReason === "no_account" ||
        r.payout.holdReason === "not_complete"),
  );
}

export function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** What to tell someone coming back from personal payout setup (outsyde://stripe-return?type=host). */
export function hostStripeReturnMessage(
  status: string | undefined,
): { title: string; body: string } | null {
  if (status === "refresh")
    return {
      title: "Link expired",
      body: "Your Stripe link expired. Tap Set up payouts to get a new one.",
    };
  if (status === "complete" || status === "success")
    return { title: "Payouts", body: BUSINESS_REFERRAL_COPY.setupReturn };
  return null;
}

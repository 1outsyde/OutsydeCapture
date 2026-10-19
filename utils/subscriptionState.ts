// What a paid plan's state means for the vendor (backend subscription lifecycle, step 1.0b).
// GET /api/vendor/subscription sends status (Stripe's: active, trialing, past_due, canceled, ...) and,
// since backend #342, graceEndsAt (the day listings pause) and listingsPaused.
// Copy rules: commas and periods, no dashes, never the service fee percentage.

export interface PaidPlanFields {
  status: string;
  graceEndsAt?: string | null;
  listingsPaused?: boolean | null;
}

export type PaidPlanKind = "active" | "late" | "paused" | "other";

export interface PaidPlanState {
  kind: PaidPlanKind;
  label: string;
  /** Explanation for the vendor, or null when nothing needs saying. */
  note: string | null;
}

export function formatPlanDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

export function describePaidPlan(sub: PaidPlanFields): PaidPlanState {
  if (sub.listingsPaused) {
    return {
      kind: "paused",
      label: "Paused",
      note: "Your listings are paused because your plan payment hasn't come through. Update your payment and they go live again on their own.",
    };
  }
  if (sub.status === "past_due" || sub.status === "unpaid") {
    const when = sub.graceEndsAt
      ? `by ${formatPlanDay(sub.graceEndsAt)}`
      : "soon";
    return {
      kind: "late",
      label: "Payment late",
      note: `We couldn't take your last plan payment. Update your payment ${when} so your listings stay live.`,
    };
  }
  if (sub.status === "active" || sub.status === "trialing") {
    return { kind: "active", label: "Active", note: null };
  }
  const label = sub.status
    ? sub.status.charAt(0).toUpperCase() +
      sub.status.slice(1).replace(/_/g, " ")
    : "Unknown";
  return { kind: "other", label, note: null };
}

/**
 * Charge line shown before switching from one paid plan to another (full new price today, billing
 * date restarts, no credit). Null when it doesn't apply (free plan, late plan, free target).
 */
export function switchChargeNote(params: {
  currentIsPaid: boolean;
  currentStatus: string | null | undefined;
  targetPriceInCents: number | null | undefined;
}): string | null {
  const { currentIsPaid, currentStatus, targetPriceInCents } = params;
  if (!currentIsPaid || !targetPriceInCents || targetPriceInCents <= 0)
    return null;
  if (currentStatus !== "active" && currentStatus !== "trialing") return null;
  return `You'll be charged $${(targetPriceInCents / 100).toFixed(2)} today and your billing date moves to today. There's no credit for time left on your current plan.`;
}

/** A plan with a Stripe subscription (paid). Late or paused vendors should land on Manage, not Plans. */
export function hasPaidPlan(
  sub:
    | { stripeSubscriptionId?: string | null; status?: string | null }
    | null
    | undefined,
): boolean {
  if (!sub) return false;
  if (sub.stripeSubscriptionId)
    return sub.status !== "canceled" && sub.status !== "incomplete_expired";
  return sub.status === "active";
}

/** Backend subscription notices send push data { type: "subscription_<event>", screen: "subscription" }. */
export function isSubscriptionPush(
  data: { type?: unknown; screen?: unknown } | null | undefined,
): boolean {
  return (
    !!data &&
    typeof data.type === "string" &&
    data.type.startsWith("subscription_") &&
    data.screen === "subscription"
  );
}

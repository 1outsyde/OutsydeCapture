// Hidden plan offers in the app (Plan Offers board, step 3). Pure rules and copy, no React, no I/O,
// tested with `npx tsx --test utils/planOffer.test.ts`.
//
// Backend contract (outsyde-backend #346): GET /api/vendor/plan-offer → { offer | null },
// POST /api/vendor/plan-offer/accept { offerId } → { accepted } or { error: { code, message } }.
// Push data { type: "plan_offer", offerId, screen: "plan_offer" }; in-app notification type "plan_offer".
// Screens copy the "Hidden Plan Offer Flow" canvas artboards Main, Reminder, FreeOffer and FreeLive,
// with the same wording as goutsyde.com (outsyde-web lib/plan-offer.ts, components/plan-offer/OfferPrompt.tsx).
// Paid plans are never bought in the app: Accept opens goutsyde.com /plan-offer signed in.
// Copy rules: commas and periods, no dashes, never the service fee percentage.

export type OfferPlan = "grandfathered" | "free";

export type OfferOutcome =
  | "start_free"
  | "replace_paid_with_free"
  | "start_paid"
  | "switch_paid"
  | "start_paid_after_free"
  | "replace_free_with_paid"
  | "invoice_billed"
  | "paid_plan_late"
  | "already_on_plan";

/** The fields of GET /api/vendor/plan-offer `offer` that the app reads (the backend sends more). */
export interface PlanOffer {
  id: string;
  plan: OfferPlan;
  planName: string;
  priceInCents: number | null;
  maxStaff: number | null;
  freeExpiresAt: string | null;
  permanent: boolean;
  businessName: string;
  username: string | null;
  outcome: OfferOutcome;
  dueTodayCents: number | null;
  billingStartsAt: string | null;
  currentPlanName: string | null;
  savedCard: { brand: string | null; last4: string | null } | null;
}

export const PLAN_OFFER_WEB_URL = "https://www.goutsyde.com/plan-offer";

/** "$40.99". */
export function formatMoney(cents: number | null | undefined): string {
  return typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "";
}

/** "December 31, 2026" in New York time (same as goutsyde.com formatEtDate). */
export function formatEtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function hasNoEnd(o: Pick<PlanOffer, "permanent" | "freeExpiresAt">): boolean {
  return o.permanent || !o.freeExpiresAt;
}

export function priceLine(o: Pick<PlanOffer, "plan" | "priceInCents" | "freeExpiresAt" | "permanent">): string {
  if (o.plan === "free") return hasNoEnd(o) ? "Free, no end date" : `Free until ${formatEtDate(o.freeExpiresAt)}`;
  return `${formatMoney(o.priceInCents)} a month`;
}

/** Banner text (artboard Reminder). */
export function bannerText(o: PlanOffer): { title: string; body: string } {
  if (o.plan === "free") {
    return { title: "Your free Outsyde plan is waiting", body: `${priceLine(o)}. Tap to claim it.` };
  }
  return {
    title: `Your ${o.planName} plan is waiting`,
    body: `${formatMoney(o.priceInCents)} a month, reserved for you. Tap to review.`,
  };
}

/** What the popup's main button does. */
export type PrimaryAction = "claim" | "review_free" | "open_web";

export interface PopupCopy {
  tag: string;
  title: string;
  lead: string;
  price: string;
  priceNote: string;
  checks: string[];
  primary: string;
  fine: string;
  primaryAction: PrimaryAction;
}

/** Popup copy (artboards Main and FreeOffer). */
export function popupCopy(o: PlanOffer): PopupCopy {
  if (o.plan === "free") {
    const replacesPaid = o.outcome === "replace_paid_with_free";
    return {
      tag: "YOU WON",
      title: "Your free Outsyde plan",
      lead: "Outsyde is covering your subscription. No card needed.",
      price: "Free",
      priceNote: hasNoEnd(o) ? "with no end date" : `until ${formatEtDate(o.freeExpiresAt)}`,
      checks: ["Growth plan features", "Customers can book and buy from you", "Nothing to pay for the plan"],
      primary: replacesPaid ? "Review and claim" : "Claim free plan",
      fine: replacesPaid
        ? "Your current paid plan ends when you claim. Review it on the next screen."
        : "One tap and it's active. It happens right here in the app.",
      primaryAction: replacesPaid ? "review_free" : "claim",
    };
  }
  return {
    tag: "AN INVITATION FROM OUTSYDE",
    title: `Your ${o.planName} plan is ready`,
    lead: `We saved a founding price for ${o.businessName}. New businesses can't get this plan.`,
    price: formatMoney(o.priceInCents),
    priceNote: "a month",
    checks: [
      "Everything in the app, including all analytics",
      `Up to ${o.maxStaff ?? 8} staff seats`,
      "Your price stays locked while you keep it",
    ],
    primary: "Accept plan",
    fine: "You'll confirm on goutsyde.com. Nothing is charged until you confirm.",
    primaryAction: "open_web",
  };
}

/** The warning before a free offer replaces a paid plan (same wording as goutsyde.com /plan-offer). */
export function freeWarningCopy(o: PlanOffer): { title: string; body: string; primary: string; fine: string } {
  const who = o.currentPlanName ? `${o.currentPlanName} is` : "Your paid plan is";
  return {
    title: "Your paid plan ends today",
    body: `${who} cancelled when you claim, and the free plan starts right away. Unused paid time isn't refunded.`,
    primary: "Claim free plan",
    fine: "One tap and it's active.",
  };
}

/** Line under "Your free plan is active" (artboard FreeLive). */
export function freeDoneText(o: Pick<PlanOffer, "permanent" | "freeExpiresAt" | "plan" | "priceInCents">): string {
  const when = hasNoEnd(o) ? "It has no end date." : `${priceLine(o)}.`;
  return `${when} You'll find it anytime under Manage Plan.`;
}

/** A tapped push for a plan offer (backend planOffers.ts notifyOffer). */
export function isPlanOfferPush(data: { type?: unknown } | null | undefined): boolean {
  return !!data && data.type === "plan_offer";
}

/** "gone": the offer was withdrawn, accepted elsewhere or isn't theirs, so close and forget it. */
export function acceptErrorAction(status: number | undefined, code: string | undefined): "gone" | "message" {
  if (code === "OFFER_NOT_AVAILABLE" || code === "OFFER_NOT_FOUND" || status === 404) return "gone";
  return "message";
}

/** Only a signed in business owner can have an offer. */
export function shouldFetchOffer(user: { role?: string | null; isGuest?: boolean | null } | null | undefined): boolean {
  return !!user && !user.isGuest && user.role === "business";
}

export interface OfferPopupInput {
  hasOffer: boolean;
  /** The store says the popup should be open (first time this launch, or a tap asked for it). */
  wantsPopup: boolean;
  /** Another popup is registered with the modal coordinator. */
  blockingModalOpen: boolean;
  /** Main is the screen in front (no setup screen, dashboard or other stack screen on top). */
  mainFocused: boolean;
}

export function shouldShowOfferPopup(i: OfferPopupInput): boolean {
  return i.hasOffer && i.wantsPopup && !i.blockingModalOpen && i.mainFocused;
}

/** goutsyde.com confirm page, signed in with the app's token (the page moves it into a cookie). */
export function planOfferWebUrl(token: string | null | undefined): string {
  return token
    ? `${PLAN_OFFER_WEB_URL}?from=app&token=${encodeURIComponent(token)}`
    : `${PLAN_OFFER_WEB_URL}?from=app`;
}

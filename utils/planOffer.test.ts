import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptErrorAction,
  readAcceptFailure,
  warningTapAllowed,
  readOfferResponse,
  bannerText,
  formatEtDate,
  formatMoney,
  freeDoneText,
  freeWarningCopy,
  isPlanOfferPush,
  planOfferWebUrl,
  popupCopy,
  priceLine,
  shouldFetchOffer,
  shouldShowOfferPopup,
  type OfferOutcome,
  type PlanOffer,
} from "./planOffer";

const DASH = /[–—]| - /;

const grandfathered: PlanOffer = {
  id: "o1",
  plan: "grandfathered",
  planName: "Grandfathered",
  priceInCents: 4099,
  maxStaff: 8,
  freeExpiresAt: null,
  permanent: false,
  businessName: "Royal Elite Moving",
  username: "royalelitemover",
  outcome: "start_paid",
  dueTodayCents: 4099,
  billingStartsAt: null,
  currentPlanName: null,
  savedCard: null,
};

const free: PlanOffer = {
  ...grandfathered,
  id: "o2",
  plan: "free",
  planName: "Free plan",
  priceInCents: 0,
  freeExpiresAt: "2026-12-31T17:00:00.000Z",
  outcome: "start_free",
  dueTodayCents: 0,
};

const OUTCOMES: OfferOutcome[] = [
  "start_free",
  "replace_paid_with_free",
  "start_paid",
  "switch_paid",
  "start_paid_after_free",
  "replace_free_with_paid",
  "invoice_billed",
  "paid_plan_late",
  "already_on_plan",
];

test("money and dates", () => {
  assert.equal(formatMoney(4099), "$40.99");
  assert.equal(formatMoney(null), "");
  assert.equal(formatEtDate("2026-12-31T17:00:00.000Z"), "December 31, 2026");
  // 02:00 UTC on Nov 10 is still Nov 9 in New York
  assert.equal(formatEtDate("2026-11-10T02:00:00.000Z"), "November 9, 2026");
  assert.equal(formatEtDate("not a date"), "");
});

test("price line", () => {
  assert.equal(priceLine(grandfathered), "$40.99 a month");
  assert.equal(priceLine(free), "Free until December 31, 2026");
  assert.equal(
    priceLine({ ...free, freeExpiresAt: null, permanent: true }),
    "Free, no end date",
  );
});

test("banner text matches the Reminder artboard", () => {
  assert.deepEqual(bannerText(grandfathered), {
    title: "Your Grandfathered plan is waiting",
    body: "$40.99 a month, reserved for you. Tap to review.",
  });
  assert.deepEqual(bannerText(free), {
    title: "Your free Outsyde plan is waiting",
    body: "Free until December 31, 2026. Tap to claim it.",
  });
});

test("grandfathered popup opens goutsyde.com (Main artboard)", () => {
  const c = popupCopy(grandfathered);
  assert.equal(c.primaryAction, "open_web");
  assert.equal(c.tag, "AN INVITATION FROM OUTSYDE");
  assert.equal(c.title, "Your Grandfathered plan is ready");
  assert.equal(
    c.lead,
    "We saved a founding price for Royal Elite Moving. New businesses can't get this plan.",
  );
  assert.equal(c.price, "$40.99");
  assert.equal(c.priceNote, "a month");
  assert.deepEqual(c.checks, [
    "Everything in the app, including all analytics",
    "Up to 8 staff seats",
    "Your price stays locked while you keep it",
  ]);
  assert.equal(c.primary, "Accept plan");
  assert.equal(
    c.fine,
    "You'll confirm on goutsyde.com. Nothing is charged until you confirm.",
  );
});

test("free popup claims in the app (FreeOffer artboard)", () => {
  const c = popupCopy(free);
  assert.equal(c.primaryAction, "claim");
  assert.equal(c.tag, "YOU WON");
  assert.equal(c.title, "Your free Outsyde plan");
  assert.equal(c.price, "Free");
  assert.equal(c.priceNote, "until December 31, 2026");
  assert.equal(c.primary, "Claim free plan");
  assert.equal(
    c.fine,
    "One tap and it's active. It happens right here in the app.",
  );
  assert.equal(
    popupCopy({ ...free, freeExpiresAt: null, permanent: true }).priceNote,
    "with no end date",
  );
});

test("a free offer over a paid plan never claims in one tap", () => {
  const c = popupCopy({
    ...free,
    outcome: "replace_paid_with_free",
    currentPlanName: "Growth",
  });
  assert.equal(c.primaryAction, "review_free");
  assert.equal(c.primary, "Review and claim");
  assert.equal(
    c.fine,
    "Your current paid plan ends when you claim. Review it on the next screen.",
  );
  const w = freeWarningCopy({
    ...free,
    outcome: "replace_paid_with_free",
    currentPlanName: "Growth",
  });
  assert.equal(w.title, "Your paid plan ends today");
  assert.equal(
    w.body,
    "Growth is cancelled when you claim, and the free plan starts right away. Unused paid time isn't refunded.",
  );
  assert.equal(w.primary, "Claim free plan");
  assert.match(
    freeWarningCopy({ ...free, outcome: "replace_paid_with_free" }).body,
    /^Your paid plan is cancelled/,
  );
});

test("free done text (FreeLive artboard)", () => {
  assert.equal(
    freeDoneText(free),
    "Free until December 31, 2026. You'll find it anytime under Manage Plan.",
  );
  assert.equal(
    freeDoneText({ ...free, freeExpiresAt: null, permanent: true }),
    "It has no end date. You'll find it anytime under Manage Plan.",
  );
});

test("no dash and no percent in any copy, every outcome", () => {
  for (const base of [grandfathered, free]) {
    for (const outcome of OUTCOMES) {
      const o = { ...base, outcome };
      const strings = [
        ...Object.values(popupCopy(o)).flat(),
        ...Object.values(freeWarningCopy(o)),
        ...Object.values(bannerText(o)),
        freeDoneText(o),
        priceLine(o),
      ].filter((s): s is string => typeof s === "string");
      for (const s of strings) {
        assert.ok(!DASH.test(s), `dash in "${s}"`);
        assert.ok(!s.includes("%"), `percent in "${s}"`);
      }
    }
  }
});

test("push filter: only plan_offer", () => {
  assert.equal(
    isPlanOfferPush({
      type: "plan_offer",
      screen: "plan_offer",
      offerId: "o1",
    }),
    true,
  );
  assert.equal(isPlanOfferPush({ type: "plan_offer" }), true);
  assert.equal(
    isPlanOfferPush({ type: "subscription_activated", screen: "subscription" }),
    false,
  );
  assert.equal(isPlanOfferPush({ type: "new_message" }), false);
  assert.equal(isPlanOfferPush(null), false);
  assert.equal(isPlanOfferPush(undefined), false);
});

test("accept errors: offer gone closes, others show the message", () => {
  assert.equal(acceptErrorAction(409, "OFFER_NOT_AVAILABLE"), "gone");
  assert.equal(acceptErrorAction(404, "OFFER_NOT_FOUND"), "gone");
  assert.equal(acceptErrorAction(404, undefined), "gone");
  assert.equal(acceptErrorAction(409, "OFFER_BUSY"), "message");
  assert.equal(acceptErrorAction(500, "SERVER_ERROR"), "message");
  assert.equal(acceptErrorAction(undefined, undefined), "message");
});

test("only signed in business owners check for an offer", () => {
  assert.equal(shouldFetchOffer({ role: "business", isGuest: false }), true);
  assert.equal(shouldFetchOffer({ role: "business", isGuest: true }), false);
  assert.equal(shouldFetchOffer({ role: "staff", isGuest: false }), false);
  assert.equal(
    shouldFetchOffer({ role: "photographer", isGuest: false }),
    false,
  );
  assert.equal(shouldFetchOffer({ role: "consumer", isGuest: false }), false);
  assert.equal(shouldFetchOffer(null), false);
});

test("popup waits for other popups and for Main to be in front", () => {
  const ok = {
    hasOffer: true,
    wantsPopup: true,
    blockingModalOpen: false,
    mainFocused: true,
  };
  assert.equal(shouldShowOfferPopup(ok), true);
  assert.equal(shouldShowOfferPopup({ ...ok, hasOffer: false }), false);
  assert.equal(shouldShowOfferPopup({ ...ok, wantsPopup: false }), false);
  assert.equal(shouldShowOfferPopup({ ...ok, blockingModalOpen: true }), false);
  assert.equal(shouldShowOfferPopup({ ...ok, mainFocused: false }), false);
});

test("web confirm url carries the app sign in", () => {
  assert.equal(
    planOfferWebUrl("ey.a+b/c"),
    "https://www.goutsyde.com/plan-offer?from=app&token=ey.a%2Bb%2Fc",
  );
  assert.equal(
    planOfferWebUrl(null),
    "https://www.goutsyde.com/plan-offer?from=app",
  );
});

test("reads the backend error shape from an ApiError", () => {
  assert.deepEqual(
    readAcceptFailure({
      status: 409,
      message: "[object Object]",
      body: {
        success: false,
        error: {
          code: "OFFER_BUSY",
          message: "Your plan is already being set up. Give it a moment.",
        },
      },
    }),
    {
      status: 409,
      code: "OFFER_BUSY",
      message: "Your plan is already being set up. Give it a moment.",
    },
  );
  // a network error has no status or body
  assert.deepEqual(readAcceptFailure({ message: "Network error" }), {
    status: undefined,
    code: undefined,
    message: "Something went wrong. Please try again in a moment.",
  });
  // never show "[object Object]"
  assert.equal(
    readAcceptFailure({ status: 500, message: "[object Object]", body: {} })
      .message,
    "Something went wrong. Please try again in a moment.",
  );
  assert.equal(
    readAcceptFailure(null).message,
    "Something went wrong. Please try again in a moment.",
  );
});

test("reads the offer from GET /api/vendor/plan-offer", () => {
  assert.equal(readOfferResponse({ success: true, offer: null }), null);
  assert.equal(readOfferResponse(null), null);
  assert.equal(readOfferResponse({ offer: { id: "" } }), null);
  assert.equal(readOfferResponse({ offer: { id: "o1", plan: "other" } }), null);
  const o = readOfferResponse({ offer: { ...grandfathered, extra: 1 } });
  assert.equal(o?.id, "o1");
  assert.equal(o?.plan, "grandfathered");
});

test("warning screen ignores the second tap of a double tap (review C1)", () => {
  assert.equal(warningTapAllowed(1000, 1100), false);
  assert.equal(warningTapAllowed(1000, 1000 + 699), false);
  assert.equal(warningTapAllowed(1000, 1000 + 700), true);
  assert.equal(warningTapAllowed(null, 5000), false);
});

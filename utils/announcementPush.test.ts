/**
 * Admin announcement push taps: screen map, role rules, links. Run with: npx tsx utils/announcementPush.test.ts
 */
import assert from "node:assert/strict";
import {
  ANNOUNCEMENT_SCREEN_KEYS,
  announcementTarget,
  isAllowedAnnouncementUrl,
  isAnnouncementPush,
} from "./announcementPush";
import { isBookingPushType, bookingPushTarget } from "../services/bookingPush";
import { isSubscriptionPush } from "./subscriptionState";
import { isPlanOfferPush } from "./planOffer";
import { isReferralRewardPush } from "./friendReferral";
import { isMessagePush } from "../services/messagePush";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} ${name}`);
};

const consumer = { role: "consumer" };
const business = { role: "business" };
const photographer = { role: "photographer" };
const staff = { role: "staff" };

t(
  "keys match the backend list (server/push/pushScreens.ts) in the same order",
  () => {
    assert.deepEqual(ANNOUNCEMENT_SCREEN_KEYS, [
      "activity",
      "home",
      "events",
      "search",
      "messages",
      "create_post",
      "account",
      "edit_profile",
      "points",
      "settings",
      "cart_bookings",
      "favorites",
      "finish_setup",
      "business_dashboard",
      "business_bookings",
      "business_orders",
      "analytics",
      "storefront",
      "subscription",
      "staff_management",
      "photographer_dashboard",
      "photographer_bookings",
      "staff_dashboard",
      "link",
    ]);
  },
);

t("only type announcement is an announcement", () => {
  assert.equal(isAnnouncementPush({ type: "announcement" }), true);
  for (const type of [
    "new_message",
    "booking_request",
    "plan_offer",
    "subscription_paid",
    "referral_reward",
    "account_setup",
    undefined,
  ]) {
    assert.equal(isAnnouncementPush({ type }), false);
  }
  assert.equal(isAnnouncementPush(null), false);
});

t("the other push hooks ignore an announcement", () => {
  const data = {
    type: "announcement",
    sendId: "s1",
    screen: "business_dashboard",
  };
  assert.equal(isBookingPushType(data.type), false);
  assert.equal(bookingPushTarget(data), null);
  assert.equal(
    bookingPushTarget({ type: "announcement", screen: "dashboard" }),
    null,
  );
  assert.equal(isSubscriptionPush(data), false);
  assert.equal(isPlanOfferPush(data), false);
  assert.equal(isReferralRewardPush(data), false);
  assert.equal(isMessagePush(data), false);
  assert.equal(data.type.startsWith("subscription_"), false);
});

t("everyone screens open for every role", () => {
  for (const u of [consumer, business, photographer, staff]) {
    assert.deepEqual(announcementTarget({ screen: "activity" }, u), {
      kind: "navigate",
      name: "Notifications",
    });
    assert.deepEqual(announcementTarget({ screen: "home" }, u), {
      kind: "navigate",
      name: "Main",
      params: { screen: "DiscoverTab", params: { screen: "Discover" } },
      pop: true,
    });
    assert.deepEqual(announcementTarget({ screen: "edit_profile" }, u), {
      kind: "navigate",
      name: "Main",
      params: { screen: "AccountTab", params: { screen: "EditProfile" } },
      pop: true,
    });
    assert.deepEqual(announcementTarget({ screen: "points" }, u), {
      kind: "navigate",
      name: "Main",
      params: { screen: "AccountTab", params: { screen: "OutsydePoints" } },
      pop: true,
    });
    assert.deepEqual(announcementTarget({ screen: "messages" }, u), {
      kind: "navigate",
      name: "Main",
      params: { screen: "InboxTab" },
      pop: true,
    });
    assert.deepEqual(announcementTarget({ screen: "search" }, u), {
      kind: "navigate",
      name: "Main",
      params: { screen: "SearchTab" },
      pop: true,
    });
    assert.deepEqual(announcementTarget({ screen: "create_post" }, u), {
      kind: "navigate",
      name: "CreatePost",
    });
    assert.deepEqual(announcementTarget({ screen: "favorites" }, u), {
      kind: "navigate",
      name: "Favorites",
    });
    assert.deepEqual(announcementTarget({ screen: "finish_setup" }, u), {
      kind: "navigate",
      name: "FinishSetup",
    });
  }
});

t("events opens the EVENTS tab of Discover", () => {
  const r = announcementTarget({ screen: "events" }, consumer);
  assert.equal(r.kind, "navigate");
  if (r.kind !== "navigate") return;
  assert.equal(r.name, "Main");
  const inner = (r.params as any).params;
  assert.equal((r.params as any).screen, "DiscoverTab");
  assert.equal(inner.screen, "Discover");
  assert.equal(inner.params.mode, "events");
  assert.equal(typeof inner.params._ts, "number");
});

t("business screens only for business owners", () => {
  const map: Record<string, string> = {
    business_dashboard: "BusinessDashboard",
    business_bookings: "DashboardBookingsScreen",
    business_orders: "DashboardOrdersScreen",
    analytics: "DashboardAnalytics",
    storefront: "StorefrontEditor",
    subscription: "SubscriptionPlan",
    staff_management: "StaffManagement",
  };
  for (const [key, name] of Object.entries(map)) {
    assert.deepEqual(announcementTarget({ screen: key }, business), {
      kind: "navigate",
      name,
    });
    for (const u of [consumer, photographer, staff])
      assert.deepEqual(
        announcementTarget({ screen: key }, u),
        { kind: "navigate", name: "Notifications" },
        `${key} ${u.role}`,
      );
  }
});

t("photographer and staff screens only for their roles", () => {
  assert.deepEqual(
    announcementTarget({ screen: "photographer_dashboard" }, photographer),
    { kind: "navigate", name: "PhotographerDashboard" },
  );
  assert.deepEqual(
    announcementTarget({ screen: "photographer_bookings" }, photographer),
    { kind: "navigate", name: "PhotographerBookingsScreen" },
  );
  assert.deepEqual(
    announcementTarget({ screen: "photographer_dashboard" }, business),
    { kind: "navigate", name: "Notifications" },
  );
  assert.deepEqual(announcementTarget({ screen: "staff_dashboard" }, staff), {
    kind: "navigate",
    name: "StaffDashboard",
  });
  assert.deepEqual(
    announcementTarget({ screen: "staff_dashboard" }, consumer),
    { kind: "navigate", name: "Notifications" },
  );
});

t("unknown or missing screen opens Activity", () => {
  assert.deepEqual(announcementTarget({ screen: "dashboard" }, business), {
    kind: "navigate",
    name: "Notifications",
  });
  assert.deepEqual(announcementTarget({}, consumer), {
    kind: "navigate",
    name: "Notifications",
  });
  assert.deepEqual(announcementTarget(null, consumer), {
    kind: "navigate",
    name: "Notifications",
  });
  assert.deepEqual(announcementTarget({ screen: 5 }, consumer), {
    kind: "navigate",
    name: "Notifications",
  });
});

t("signed out or guest goes to sign in", () => {
  assert.deepEqual(announcementTarget({ screen: "home" }, null), {
    kind: "auth",
  });
  assert.deepEqual(
    announcementTarget({ screen: "home" }, { role: "consumer", isGuest: true }),
    { kind: "auth" },
  );
});

t("links: goutsyde.com https only, else Activity", () => {
  assert.deepEqual(
    announcementTarget(
      { screen: "link", url: "https://goutsyde.com/events" },
      consumer,
    ),
    { kind: "browser", url: "https://goutsyde.com/events" },
  );
  assert.deepEqual(
    announcementTarget(
      { screen: "link", url: "https://www.goutsyde.com/partner-kit?a=1" },
      consumer,
    ),
    { kind: "browser", url: "https://www.goutsyde.com/partner-kit?a=1" },
  );
  for (const bad of [
    "http://goutsyde.com/",
    "https://goutsyde.com.evil.com/",
    "https://evil.com/?goutsyde.com",
    "javascript:alert(1)",
    "",
    undefined,
  ]) {
    assert.deepEqual(
      announcementTarget({ screen: "link", url: bad }, consumer),
      { kind: "navigate", name: "Notifications" },
      String(bad),
    );
  }
  assert.equal(isAllowedAnnouncementUrl("https://goutsyde.com"), true);
  assert.equal(
    isAllowedAnnouncementUrl(`https://goutsyde.com/${"a".repeat(500)}`),
    false,
  );
});

console.log(`\n${n} passed`);

// Admin push announcements (backend server/push/*, sent from goutsyde.com/admin/emails?tab=push).
// Push data: { type: "announcement", sendId, screen, url? }. The Activity row (notifications type
// "announcement") carries the same screen and url in its metadata.
//
// Pure (no React Native imports) so the screen map and role rules are testable with npx tsx.
// The keys must match PUSH_SCREENS in outsyde-backend server/push/pushScreens.ts.
// services/announcementPush.ts runs the result (navigate or open the link).

export type AnnouncementTarget =
  | { kind: "auth" }
  | { kind: "browser"; url: string }
  | {
      kind: "navigate";
      name: string;
      params?: Record<string, unknown>;
      pop?: boolean;
    };

type Fit = "everyone" | "business" | "photographer" | "staff";

type MinimalUser =
  | { role?: string | null; isGuest?: boolean | null }
  | null
  | undefined;

/** One screen of the main tabs, opened the same way Points is opened from a referral push (pop back to the tabs). */
const tab = (
  screen: string,
  inner?: string,
  innerParams?: Record<string, unknown>,
): Omit<Extract<AnnouncementTarget, { kind: "navigate" }>, "kind"> => ({
  name: "Main",
  params: inner
    ? {
        screen,
        params: {
          screen: inner,
          ...(innerParams ? { params: innerParams } : {}),
        },
      }
    : { screen },
  pop: true,
});

const ACTIVITY = { name: "Notifications" };

const SCREENS: Record<
  string,
  {
    fit: Fit;
    to: () => Omit<Extract<AnnouncementTarget, { kind: "navigate" }>, "kind">;
  }
> = {
  activity: { fit: "everyone", to: () => ACTIVITY },
  home: { fit: "everyone", to: () => tab("DiscoverTab", "Discover") },
  events: {
    fit: "everyone",
    to: () =>
      tab("DiscoverTab", "Discover", { mode: "events", _ts: Date.now() }),
  },
  search: { fit: "everyone", to: () => tab("SearchTab") },
  messages: { fit: "everyone", to: () => tab("InboxTab") },
  create_post: { fit: "everyone", to: () => ({ name: "CreatePost" }) },
  account: { fit: "everyone", to: () => tab("AccountTab", "Account") },
  edit_profile: { fit: "everyone", to: () => tab("AccountTab", "EditProfile") },
  points: { fit: "everyone", to: () => tab("AccountTab", "OutsydePoints") },
  settings: { fit: "everyone", to: () => tab("AccountTab", "Settings") },
  cart_bookings: {
    fit: "everyone",
    to: () => ({ name: "CartOrders", params: { _ts: Date.now() } }),
  },
  favorites: { fit: "everyone", to: () => ({ name: "Favorites" }) },
  finish_setup: { fit: "everyone", to: () => ({ name: "FinishSetup" }) },
  business_dashboard: {
    fit: "business",
    to: () => ({ name: "BusinessDashboard" }),
  },
  business_bookings: {
    fit: "business",
    to: () => ({ name: "DashboardBookingsScreen" }),
  },
  business_orders: {
    fit: "business",
    to: () => ({ name: "DashboardOrdersScreen" }),
  },
  analytics: { fit: "business", to: () => ({ name: "DashboardAnalytics" }) },
  storefront: { fit: "business", to: () => ({ name: "StorefrontEditor" }) },
  subscription: { fit: "business", to: () => ({ name: "SubscriptionPlan" }) },
  staff_management: {
    fit: "business",
    to: () => ({ name: "StaffManagement" }),
  },
  photographer_dashboard: {
    fit: "photographer",
    to: () => ({ name: "PhotographerDashboard" }),
  },
  photographer_bookings: {
    fit: "photographer",
    to: () => ({ name: "PhotographerBookingsScreen" }),
  },
  staff_dashboard: { fit: "staff", to: () => ({ name: "StaffDashboard" }) },
};

export const ANNOUNCEMENT_SCREEN_KEYS = [...Object.keys(SCREENS), "link"];

export function isAnnouncementPush(
  data: { type?: unknown } | null | undefined,
): boolean {
  return !!data && data.type === "announcement";
}

/** https on goutsyde.com or www.goutsyde.com only (same rule as the backend). */
export function isAllowedAnnouncementUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 500) return false;
  const m = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(raw);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return host === "goutsyde.com" || host === "www.goutsyde.com";
}

function fits(fit: Fit, role: string | null | undefined): boolean {
  if (fit === "everyone") return true;
  if (fit === "business") return role === "business";
  if (fit === "photographer") return role === "photographer";
  return role === "staff";
}

/**
 * Where a tapped announcement (push data or Activity metadata) goes for this signed in person.
 * Signed out or guest: sign in. A screen their role can't open, an unknown screen, or a bad link: Activity.
 */
export function announcementTarget(
  data: { screen?: unknown; url?: unknown } | null | undefined,
  user: MinimalUser,
): AnnouncementTarget {
  if (!user || user.isGuest) return { kind: "auth" };
  const screen = typeof data?.screen === "string" ? data.screen : "activity";
  if (screen === "link") {
    return isAllowedAnnouncementUrl(data?.url)
      ? { kind: "browser", url: data!.url as string }
      : { kind: "navigate", ...ACTIVITY };
  }
  const s = SCREENS[screen];
  if (!s || !fits(s.fit, user.role)) return { kind: "navigate", ...ACTIVITY };
  return { kind: "navigate", ...s.to() };
}

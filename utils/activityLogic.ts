// Activity redesign (step 2, 2026-11-10): chips, groups, icons and row buttons for NotificationsScreen.
// Pure so it can be tested: npx tsx utils/activityLogic.test.ts
// Tap targets stay in NotificationsScreen.handleNotificationPress; this file only says which
// rows get a button and what it says, and it must only offer a button where a tap opens something.

import type { Ionicons } from "@expo/vector-icons";
import { activityQuoteId } from "@/utils/requestLogic";
import { activityTarget } from "@/utils/ticketCheckoutLogic";
import { isBookingPushType } from "@/services/bookingPush";

export type ActivityCategory =
  | "bookings"
  | "orders"
  | "social"
  | "events"
  | "outsyde"
  | "admin"
  | "other";
export type ActivityChip = "all" | Exclude<ActivityCategory, "other">;

export type ActivityRow = {
  id: string;
  type: string;
  date: string;
  read: boolean;
  metadata?: Record<string, unknown> | null;
};

const BOOKING_TYPES = new Set([
  "booking",
  "reminder",
  "booking_confirmed",
  "booking_canceled",
  "booking_request",
  "booking_request_sent",
  "booking_request_reminder",
  "booking_expired",
  "addon_charged",
  "photographer_assigned",
]);
const ORDER_TYPES = new Set([
  "new_order",
  "order_confirmed",
  "order_shipped",
  "refund_issued",
  "payment_succeeded",
  "payment_failed",
]);
const SOCIAL_TYPES = new Set(["follow", "new_follower"]);
const OUTSYDE_TYPES = new Set([
  "announcement",
  "plan_offer",
  "referral_reward",
  "business_referral_reward",
  "subscription_activated",
  "subscription_canceled",
  "subscription_tier_changed",
  "vendor_approved",
  "vendor_rejected",
  "stripe_onboarding_complete",
  "staff_invite_accepted",
  "staff_onboarding_complete",
  "staff_bookable",
  "promotion",
  "system",
]);
const ADMIN_TYPES = new Set([
  "admin",
  "business_pending",
  "new_vendor_application",
  "new_photographer_application",
  "new_influencer_application",
  "new_consumer_signup",
]);
const EVENT_PREFIX = /^(ticket|door|team|event|host)_/;

export function activityCategory(n: ActivityRow): ActivityCategory {
  const t = n.type;
  if (BOOKING_TYPES.has(t) || activityQuoteId(n) || t.startsWith("quote_"))
    return "bookings";
  if (ORDER_TYPES.has(t)) return "orders";
  if (SOCIAL_TYPES.has(t)) return "social";
  if (ADMIN_TYPES.has(t)) return "admin";
  if (OUTSYDE_TYPES.has(t)) return "outsyde";
  if (EVENT_PREFIX.test(t) || activityTarget(n as any)) return "events";
  return "other";
}

const CHIP_LABELS: Record<ActivityChip, string> = {
  all: "All",
  bookings: "Bookings",
  orders: "Orders",
  social: "Social",
  events: "Events",
  outsyde: "Outsyde",
  admin: "Admin",
};

/** The chips to show. Admin only for platform admins (Legend 2026-11-10). */
export function activityChips(
  isAdmin: boolean,
): { key: ActivityChip; label: string }[] {
  const keys: ActivityChip[] = [
    "all",
    "bookings",
    "orders",
    "social",
    "events",
    "outsyde",
  ];
  if (isAdmin) keys.push("admin");
  return keys.map((key) => ({ key, label: CHIP_LABELS[key] }));
}

/** Rows a chip shows. "other" rows (types this build doesn't know) only show under All. */
export function filterByChip<T extends ActivityRow>(
  rows: T[],
  chip: ActivityChip,
): T[] {
  if (chip === "all") return rows;
  return rows.filter((n) => activityCategory(n) === chip);
}

export type ActivitySection<T> = {
  key: "today" | "week" | "earlier";
  title: string;
  rows: T[];
};

/** Today (same local day), This week (last 7 days), Earlier. Empty sections are left out; row order is kept. */
export function groupByWhen<T extends ActivityRow>(
  rows: T[],
  now: Date = new Date(),
): ActivitySection<T>[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const weekAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const today: T[] = [];
  const week: T[] = [];
  const earlier: T[] = [];
  for (const n of rows) {
    const t = new Date(n.date).getTime();
    if (Number.isNaN(t)) earlier.push(n);
    else if (t >= startOfToday) today.push(n);
    else if (t >= weekAgo) week.push(n);
    else earlier.push(n);
  }
  const out: ActivitySection<T>[] = [];
  if (today.length) out.push({ key: "today", title: "Today", rows: today });
  if (week.length) out.push({ key: "week", title: "This week", rows: week });
  if (earlier.length)
    out.push({ key: "earlier", title: "Earlier", rows: earlier });
  return out;
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

/** Short time: Just now, 5m, 2h, 3d, then Oct 26 (with the year when it isn't this year). */
export function activityTime(date: string, now: Date = new Date()): string {
  const d = new Date(date);
  const ms = now.getTime() - d.getTime();
  if (Number.isNaN(ms)) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear()
    ? label
    : `${label}, ${d.getFullYear()}`;
}

/** Filled icon per type (Ionicons; Legend 2026-11-10: filled, not outlined). */
export function activityIcon(n: ActivityRow): keyof typeof Ionicons.glyphMap {
  switch (n.type) {
    case "booking_canceled":
    case "vendor_rejected":
    case "subscription_canceled":
      return "close-circle";
    case "payment_failed":
      return "alert-circle";
    case "refund_issued":
      return "refresh-circle";
    case "order_shipped":
      return "cube";
    case "new_order":
    case "order_confirmed":
      return "bag-handle";
    case "payment_succeeded":
    case "addon_charged":
      return "card";
    case "plan_offer":
    case "referral_reward":
    case "business_referral_reward":
      return "gift";
    case "announcement":
      return "megaphone";
    case "subscription_activated":
    case "subscription_tier_changed":
      return "star";
    case "photographer_assigned":
    case "new_photographer_application":
      return "camera";
    case "new_vendor_application":
    case "business_pending":
      return "briefcase";
    case "vendor_approved":
    case "stripe_onboarding_complete":
      return "checkmark-circle";
  }
  switch (activityCategory(n)) {
    case "bookings":
      return activityQuoteId(n) ? "receipt" : "calendar";
    case "social":
      return "person-add";
    case "events":
      return "ticket";
    case "admin":
      return "shield-checkmark";
    case "outsyde":
      return "sparkles";
    default:
      return "notifications";
  }
}

export type ActivityAction =
  | { kind: "open"; label: string }
  | { kind: "follow"; userId: string };

/**
 * The button under a row, or null. Every "open" button does the same as tapping the row, so it is
 * only offered for types handleNotificationPress opens. Follow back needs the follower's id.
 */
export function activityAction(
  n: ActivityRow,
  isAdmin: boolean,
): ActivityAction | null {
  const m = n.metadata ?? {};
  if (n.type === "new_follower") {
    const id =
      typeof m.referenceId === "string" && m.referenceId
        ? m.referenceId
        : typeof m.followerUserId === "string" && m.followerUserId
          ? m.followerUserId
          : null;
    return id ? { kind: "follow", userId: id } : null;
  }
  if (activityQuoteId(n)) return { kind: "open", label: "View quote" };
  if (isBookingPushType(n.type)) return { kind: "open", label: "View booking" };
  if (n.type === "plan_offer") return { kind: "open", label: "View offer" };
  if (n.type === "referral_reward" || n.type === "business_referral_reward") {
    return { kind: "open", label: "Open points" };
  }
  if (n.type === "order_confirmed" || n.type === "order_shipped")
    return { kind: "open", label: "View order" };
  if (n.type === "new_order") return { kind: "open", label: "View orders" };
  if (n.type === "business_pending" && isAdmin && m.businessId)
    return { kind: "open", label: "Review" };
  if (activityTarget(n as any)) return { kind: "open", label: "View" };
  return null;
}

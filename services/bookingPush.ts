// Booking request push helpers (backend manualRequests.ts sends data { type, screen, bookingId }).
//
//   booking_request           screen "dashboard"  → the business / photographer
//   booking_request_reminder  screen "dashboard"  → the business / photographer
//   booking_expired           screen "dashboard"  → the business / photographer
//   booking_request_sent      screen "bookings"   → the customer
//   booking_expired           screen "bookings"   → the customer
//
// Used by useBookingPushLinks (push taps, cold start included) and by the in-app
// Activity list (NotificationsScreen) so both open the same screen.

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type PushData = { type?: unknown; screen?: unknown } | null | undefined;

export const BOOKING_PUSH_TYPES = [
  "booking_request",
  "booking_request_sent",
  "booking_request_reminder",
  "booking_expired",
] as const;

export type BookingPushType = (typeof BOOKING_PUSH_TYPES)[number];

/** Where a booking push should take the person, or null when it is not a booking push. */
export type BookingPushTarget = "provider" | "customer";

const PROVIDER_TYPES = new Set<string>([
  "booking_request",
  "booking_request_reminder",
  "booking_expired",
]);

export function isBookingPushType(type: unknown): type is BookingPushType {
  return (
    typeof type === "string" &&
    (BOOKING_PUSH_TYPES as readonly string[]).includes(type)
  );
}

export function bookingPushTarget(data: PushData): BookingPushTarget | null {
  if (!data || !isBookingPushType(data.type)) return null;
  const type = data.type as string;
  const screen = typeof data.screen === "string" ? data.screen : "";
  if (type === "booking_request_sent" || screen === "bookings")
    return "customer";
  if (screen === "dashboard" && PROVIDER_TYPES.has(type)) return "provider";
  return null;
}

type MinimalUser =
  | { role?: string | null; isGuest?: boolean }
  | null
  | undefined;

/**
 * Opens the right bookings screen for a booking push.
 * Provider pushes go to the bookings list for the signed-in role (business owner
 * or photographer, the same role check PersonalSettingsMenu uses for dashboards).
 * Customer pushes go to the Bookings tab of CartOrders.
 * Returns false when nothing was opened.
 */
export function openBookingPushTarget(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  user: MinimalUser,
  target: BookingPushTarget,
): boolean {
  if (!user || user.isGuest) {
    navigation.navigate("Auth", {});
    return true;
  }
  if (target === "provider") {
    if (user.role === "business") {
      navigation.navigate("DashboardBookingsScreen");
      return true;
    }
    if (user.role === "photographer") {
      navigation.navigate("PhotographerBookingsScreen");
      return true;
    }
    return false;
  }
  navigation.navigate("CartOrders", { openTab: "bookings", _ts: Date.now() });
  return true;
}

// Shared booking status rules for provider surfaces (business owner, staff,
// photographer) and the customer booking lists.
//
// Backend vocabulary: draft, pending_payment, pending_provider, confirmed,
// completed, canceled, expired, no_show, declined. Shoot sessions on the
// customer side use "cancelled". The legacy literal "pending" is treated the
// same as pending_provider so older payloads still behave.

type MaybeStatus = string | null | undefined;

const norm = (status: MaybeStatus): string =>
  String(status ?? "").toLowerCase();

/**
 * draft (pre-payment slot lock) and pending_payment (unpaid checkout) are not
 * real bookings yet. They never appear on a provider surface and are never
 * counted. The backend already leaves them out of the provider lists (PR #326);
 * this is the app-side guard for older backends and races.
 */
export function isUnpaidBookingStatus(status: MaybeStatus): boolean {
  const s = norm(status);
  return s === "draft" || s === "pending_payment";
}

/** Drop draft and pending_payment rows from a list of bookings. */
export function filterVisibleBookings<T extends { status?: MaybeStatus }>(
  list: readonly T[] | null | undefined,
): T[] {
  return (list ?? []).filter((b) => !!b && !isUnpaidBookingStatus(b.status));
}

/** A real request waiting on the provider (card on hold). */
export function isPendingRequestStatus(status: MaybeStatus): boolean {
  const s = norm(status);
  return s === "pending_provider" || s === "pending";
}

/** Accepts both spellings ("canceled" for appointments, "cancelled" for shoot sessions). */
export function isCanceledStatus(status: MaybeStatus): boolean {
  const s = norm(status);
  return s === "canceled" || s === "cancelled";
}

export function isExpiredStatus(status: MaybeStatus): boolean {
  return norm(status) === "expired";
}

/** Upcoming / active on a provider surface: a real pending request or a confirmed booking. */
export function isActiveProviderStatus(status: MaybeStatus): boolean {
  return isPendingRequestStatus(status) || norm(status) === "confirmed";
}

/** Readable label for any booking status. Never returns the raw snake_case value. */
export function bookingStatusLabel(status: MaybeStatus): string {
  const s = norm(status);
  switch (s) {
    case "pending_provider":
    case "pending":
      return "Pending Review";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "canceled":
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No Show";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "draft":
      return "Draft";
    case "pending_payment":
      return "Awaiting Payment";
    case "":
      return "Unknown";
    default: {
      const words = s.replace(/_/g, " ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    }
  }
}

// Booking redesign step 5 (Legend 2026-11-06): what the photographer Booking
// route hands to the shared booking screen. Pure, so it can be unit tested.
import { resolveBrandColor, parseBrandColorSpec } from "@/constants/colorOptions";

/** The photographer fields the booking screen uses (route data or GET /api/photographers/:id). */
export type PhotographerLike = {
  id?: string;
  name?: string | null;
  displayName?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  studioAddress?: string | null;
  vendorTermsAndConditions?: string | null;
  brandColors?: unknown;
};

export type PhotographerBookingParams = {
  providerId: string;
  providerType: "photographer";
  providerName: string;
  providerAddress: string | null;
  providerCity: string | null;
  providerState: string | null;
  providerVendorTerms: string | null;
  accentColor: string;
  preselectedServiceId?: string;
};

/** Display name the same way the old BookingScreen did. */
export function photographerName(p: PhotographerLike | null | undefined): string {
  return (p?.displayName || p?.name || "").trim() || "Photographer";
}

/**
 * Old BookingScreen showed studioAddress, else "location" (or "City, ST"), else
 * "Name's location". The shared screen shows the address line plus city and
 * state, so with a studio we pass the studio plus city and state; without one
 * the area becomes the address line (no city or state, so nothing repeats).
 */
export function photographerBookingParams(
  id: string,
  p: PhotographerLike | null | undefined,
  colorMode: "light" | "dark",
  preselectedServiceId?: string,
): PhotographerBookingParams {
  const city = p?.city?.trim() || null;
  const state = p?.state?.trim() || null;
  const studio = p?.studioAddress?.trim() || null;
  const area = p?.location?.trim() || [city, state].filter(Boolean).join(", ") || null;
  return {
    providerId: id,
    providerType: "photographer",
    providerName: photographerName(p),
    providerAddress: studio ?? area,
    providerCity: studio ? city : null,
    providerState: studio ? state : null,
    providerVendorTerms: p?.vendorTermsAndConditions ?? null,
    accentColor: resolveBrandColor(parseBrandColorSpec((p?.brandColors as any) ?? null), colorMode),
    ...(preselectedServiceId ? { preselectedServiceId } : {}),
  };
}

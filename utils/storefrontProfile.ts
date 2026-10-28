// Profile and contact save on Manage business (2026-10-28).
//
// Before: every text field was sent as `value || undefined`, so emptying a
// field and saving kept the old value. Now an emptied optional field is sent
// as null, which clears it (all these columns are nullable; readers already
// treat null as "not set"). The business name stays required.
//
// Business terms are no longer sent from here: they have their own Save on
// Booking settings (they used to sit in the service form but were only saved
// by Save Profile, so terms typed there were lost).

/** Text a business can clear: empty or spaces only becomes null. */
export function cleared(value: string): string | null {
  return value.trim() ? value : null;
}

/** knownFor arrives as a JSON array, or older rows as comma text. */
export function knownForFrom(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export interface ProfileFormValues {
  name: string;
  tagline: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  showResponseTime: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showStoreHours: boolean;
  hasPhysicalLocation: boolean;
  showAddress: boolean;
  defaultServiceLocationType: string;
  responseTimeValue: number;
  responseTimeUnit: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  knownFor: string[];
  /** Only sent when the business changed the Known For chips. */
  knownForChanged: boolean;
}

export function profilePayload(v: ProfileFormValues): Record<string, unknown> {
  return {
    name: v.name.trim() ? v.name : undefined,
    tagline: cleared(v.tagline),
    description: cleared(v.description),
    contactEmail: cleared(v.contactEmail),
    contactPhone: cleared(v.contactPhone),
    websiteUrl: cleared(v.websiteUrl),
    showResponseTime: v.showResponseTime,
    showEmail: v.showEmail,
    showPhone: v.showPhone,
    showWebsite: v.showWebsite,
    showStoreHours: v.showStoreHours,
    hasPhysicalLocation: v.hasPhysicalLocation,
    showAddress: v.showAddress,
    defaultServiceLocationType: v.defaultServiceLocationType,
    responseTimeValue: v.responseTimeValue,
    responseTimeUnit: v.responseTimeUnit,
    address: cleared(v.address),
    city: cleared(v.city),
    state: cleared(v.state),
    zipCode: cleared(v.zipCode),
    ...(v.knownForChanged ? { knownFor: v.knownFor } : {}),
  };
}

/** Business terms payload: empty clears them, which hides the booking checkbox. */
export function termsPayload(terms: string): { vendorTermsAndConditions: string | null } {
  return { vendorTermsAndConditions: cleared(terms) };
}

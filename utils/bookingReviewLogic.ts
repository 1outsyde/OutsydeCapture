// Booking redesign step 3 (Legend 2026-11-06): pure helpers for the Review and
// Pay screen. One agreement line instead of separate checkboxes, and a reason
// under Pay whenever it is grey. No React, so they can be unit tested.

/** Outsyde Terms version the app shows ("Last Updated: November 2026"). Sent with the agreement (backend #422). */
export const OUTSYDE_TERMS_VERSION = "2026-11";

export type ServiceLocationType = "business" | "alternate" | "customer" | "virtual" | null | undefined;

/** One piece of the agreement sentence. Links open the policy, the vendor's terms or the Outsyde Terms. */
export type AgreementPart =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; target: "policy" | "vendorTerms" | "outsydeTerms" };

/**
 * "I agree to the cancellation policy, Braids With Love's terms and the Outsyde
 * Terms, and I understand this appointment is at the address above."
 * Parts that don't apply drop out; the location ending follows the service's place.
 */
export function agreementParts(o: {
  hasPolicy: boolean;
  hasVendorTerms: boolean;
  providerName: string;
  locationType: ServiceLocationType;
  /** Business address hidden by the vendor: only the city is shown. */
  addressHidden?: boolean;
}): AgreementPart[] {
  // Each item: the word before its link ("the " or none) and the link itself.
  const items: { lead: string; link: AgreementPart }[] = [];
  if (o.hasPolicy) items.push({ lead: "the ", link: { kind: "link", text: "cancellation policy", target: "policy" } });
  if (o.hasVendorTerms) {
    const name = o.providerName.trim() || "the business";
    items.push({ lead: "", link: { kind: "link", text: `${name}'s terms`, target: "vendorTerms" } });
  }
  items.push({ lead: "the ", link: { kind: "link", text: "Outsyde Terms", target: "outsydeTerms" } });

  const parts: AgreementPart[] = [];
  let pending = "I agree to ";
  items.forEach((item, i) => {
    if (i > 0) pending += i === items.length - 1 ? " and " : ", ";
    parts.push({ kind: "text", text: pending + item.lead });
    parts.push(item.link);
    pending = "";
  });
  parts.push({ kind: "text", text: locationEnding(o.locationType, !!o.addressHidden) });
  return parts;
}

function locationEnding(t: ServiceLocationType, addressHidden: boolean): string {
  switch (t) {
    case "customer":
      return ", and I'll be ready at the address I entered.";
    case "virtual":
      return ", and I'll join the meeting link at my appointment time.";
    case "alternate":
      return ", and I understand this service is at the address above.";
    default:
      return addressHidden
        ? ", and I understand this appointment is in the city above."
        : ", and I understand this appointment is at the address above.";
  }
}

/** The agreement as plain text (screen readers, tests). */
export function agreementText(parts: AgreementPart[]): string {
  return parts.map((p) => p.text).join("");
}

/**
 * Why Pay is grey, or null when it can be tapped. Checked in the order the
 * customer can fix them: total still loading, address missing, box unchecked.
 */
export function payBlockReason(o: {
  amountsReady: boolean;
  needsAddress: boolean;
  addressComplete: boolean;
  /** Policy text still loading: the box can't be checked yet. */
  policyLoading: boolean;
  agreed: boolean;
}): string | null {
  if (!o.amountsReady) return "Getting your total…";
  if (o.needsAddress && !o.addressComplete) return "Add your service address";
  if (o.policyLoading) return "Loading the cancellation policy…";
  if (!o.agreed) return "Check the box above to agree first";
  return null;
}

/** Every part of a customer address filled in. */
export function isAddressComplete(a: { line1: string; city: string; state: string; zipCode: string }): boolean {
  return [a.line1, a.city, a.state, a.zipCode].every((x) => x.trim().length > 0);
}

/** Body field for create-payment-intent (backend #422), only when the box is checked. */
export function agreementPayload(agreed: boolean): { agreed: true; termsVersion: string } | undefined {
  return agreed ? { agreed: true, termsVersion: OUTSYDE_TERMS_VERSION } : undefined;
}

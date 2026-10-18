// Industry choice for a business (shared list, GET /api/taxonomy/business-categories).
// Used by the storefront editor so a business can change its industry after signup.
// The backend (PATCH /api/vendor/my-business) checks every change again and keeps
// the readable category in step with the code. Codes never change.

import type { BusinessTaxonomy, TaxonomyCategory, TaxonomySpecialty } from "@/services/api";

export const OTHER_DESCRIPTION_MAX = 500;

export type OfferType = "products" | "services" | "both";

export interface IndustryValue {
  categoryCode: string;
  specialties: string[];
  otherDescription: string;
}

export function isOtherCode(code: string): boolean {
  return code === "other" || code.endsWith(".other");
}

export function offerTypeOf(hasProducts?: boolean | null, hasServices?: boolean | null): OfferType | "" {
  if (hasProducts && hasServices) return "both";
  if (hasProducts) return "products";
  if (hasServices) return "services";
  return "";
}

/** What the business can pick for its offer type (services: service picks, products: product picks). */
export function specialtiesFor(category: TaxonomyCategory | undefined, offer: OfferType | ""): TaxonomySpecialty[] {
  if (!category || !offer) return [];
  return category.specialties.filter((s) =>
    offer === "both" ? true : offer === "services" ? s.kind === "service" : s.kind === "product",
  );
}

export function findCategory(taxonomy: BusinessTaxonomy | null, code: string): TaxonomyCategory | undefined {
  return taxonomy?.categories.find((c) => c.code === code);
}

export function needsOtherDescription(value: IndustryValue): boolean {
  return value.categoryCode === "other" || value.specialties.some(isOtherCode);
}

/** A message to show, or "" when the choice can be saved. */
export function industryProblem(value: IndustryValue, offer: OfferType | ""): string {
  if (!value.categoryCode) return "Choose your industry.";
  if (!offer) return "Your business has no products or services set. Contact Outsyde to update it.";
  if (value.categoryCode !== "other" && value.specialties.length === 0) return "Choose at least one thing you do.";
  if (needsOtherDescription(value) && !value.otherDescription.trim()) return "Tell us what you do when you choose Other.";
  if (value.otherDescription.trim().length > OTHER_DESCRIPTION_MAX) {
    return `Keep the description to ${OTHER_DESCRIPTION_MAX} characters or less.`;
  }
  return "";
}

/** The fields sent to PATCH /api/vendor/my-business. */
export function industryPayload(value: IndustryValue) {
  return {
    categoryCode: value.categoryCode,
    specialties: value.categoryCode === "other" ? [] : value.specialties,
    otherDescription: value.otherDescription.trim() || null,
  };
}

export function industryFrom(biz: { categoryCode?: string | null; specialties?: string[] | null; otherDescription?: string | null } | null): IndustryValue {
  return {
    categoryCode: biz?.categoryCode ?? "",
    specialties: Array.isArray(biz?.specialties) ? biz!.specialties! : [],
    otherDescription: biz?.otherDescription ?? "",
  };
}

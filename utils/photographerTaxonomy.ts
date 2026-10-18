// Photographer specialties on the shared list (GET /api/taxonomy/photographer, backend #320).
// Used by the photographer signup and the dashboard profile editor. The backend checks every
// save again (max, unknown codes, Other text) and keeps the readable names in step with the codes.

import type { PhotographerTaxonomy, PhotographerSpecialtyOption } from "@/services/api";

export const PHOTO_OTHER_CODE = "photo.other";

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

/** The specialties a photographer can pick (retired ones are hidden). */
export function pickableSpecialties(taxonomy: PhotographerTaxonomy | null): PhotographerSpecialtyOption[] {
  return (taxonomy?.specialties ?? []).filter((s) => !s.retired);
}

/** Codes for a saved profile: its codes when it has them, otherwise its older names mapped onto the list. */
export function codesForProfile(
  taxonomy: PhotographerTaxonomy | null,
  profile: { specialtyCodes?: string[] | null; specialties?: string[] | null } | null | undefined,
): string[] {
  const codes = Array.isArray(profile?.specialtyCodes) ? profile!.specialtyCodes!.filter((c) => typeof c === "string") : [];
  if (codes.length) return codes;
  if (!taxonomy) return [];
  const out: string[] = [];
  for (const name of profile?.specialties ?? []) {
    if (typeof name !== "string") continue;
    const n = norm(name);
    const hit = taxonomy.specialties.find(
      (s) => s.code === name || norm(s.label) === n || norm(s.code.replace(/^photo\./, "")) === n || (s.aliases ?? []).some((a) => norm(a) === n),
    );
    if (hit && !out.includes(hit.code)) out.push(hit.code);
  }
  return out;
}

/** Toggles a code, never past the maximum. */
export function toggleSpecialtyCode(codes: string[], code: string, max: number): string[] {
  if (codes.includes(code)) return codes.filter((c) => c !== code);
  if (codes.length >= max) return codes;
  return [...codes, code];
}

/** A message to show, or "" when the picks can be saved. */
export function specialtyProblem(codes: string[], other: string, taxonomy: PhotographerTaxonomy | null): string {
  const max = taxonomy?.maxSpecialties ?? 5;
  const otherMax = taxonomy?.otherMax ?? 500;
  if (codes.length === 0) return "Please choose at least one specialty.";
  if (codes.length > max) return `Choose up to ${max} specialties.`;
  if (codes.includes(PHOTO_OTHER_CODE) && !other.trim()) return "Tell us what you shoot when you choose Other.";
  if (other.trim().length > otherMax) return `Keep the description to ${otherMax} characters or less.`;
  return "";
}

export function specialtyLabel(taxonomy: PhotographerTaxonomy | null, code: string): string {
  return taxonomy?.specialties.find((s) => s.code === code)?.label ?? code;
}

/** Answer choices from the shared list, falling back to the screen's own list if it didn't load. */
export function optionsFor(
  taxonomy: PhotographerTaxonomy | null,
  field: string,
  fallback: { value: string; label: string }[],
): { value: string; label: string }[] {
  const fromServer = taxonomy?.options?.[field];
  return Array.isArray(fromServer) && fromServer.length ? fromServer : fallback;
}

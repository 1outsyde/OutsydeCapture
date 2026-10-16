// Pure helpers for the add-on library screens (no React, unit-tested).
import type { LibraryAddon, LibraryAttachResult } from "@/services/api";

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// "Added to 2 services. Skipped Fill (already has it)."
export function describeAttach(
  result: LibraryAttachResult,
  nameOf: (serviceId: string) => string,
): string {
  const n = result.added.length;
  const parts = [
    n === 0
      ? "Not added to any new service."
      : `Added to ${n} service${n === 1 ? "" : "s"}.`,
  ];
  const why: Record<string, string> = {
    already_added: "already has it",
    limit: "already has 20 add-ons",
    archived: "archived",
  };
  if (result.skipped.length > 0) {
    parts.push(
      `Skipped ${result.skipped.map((s) => `${nameOf(s.serviceId)} (${why[s.reason] ?? s.reason})`).join(", ")}.`,
    );
  }
  return parts.join(" ");
}

// The library add-on only counts as off when no service offers it any more.
// The backend sets the library flag with every on/off, so after turning it off
// for some services the screen puts the library flag back on.
export function keepsLibraryOnAfterTurnOff(
  addon: LibraryAddon,
  turnedOffServiceIds: string[],
): boolean {
  return addon.services.some(
    (s) => s.isActive && !turnedOffServiceIds.includes(s.serviceId),
  );
}

export function countPriceReviews(addons: LibraryAddon[]): number {
  return addons.reduce(
    (n, a) => n + a.services.filter((s) => s.needsPriceReview).length,
    0,
  );
}

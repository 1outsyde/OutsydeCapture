/**
 * Photographer Manage business: the "Finish setting up" checklist and hub counts.
 *
 * Worked out in the app from data the screen already loads. The backend has no
 * photographer setup-status route (GET /api/vendor/setup-status is business only,
 * and /api/account-setup/status only sends the payouts step for photographers).
 */

export type PhotographerSetupTarget = "profile" | "hours" | "services" | "payouts";

export type PhotographerSetupStep = {
  key: "profile" | "hours" | "first_service" | "service_photos" | "payouts";
  label: string;
  done: boolean;
  target: PhotographerSetupTarget;
};

type ServiceLike = { status?: string | null; imageUrl?: string | null };

const isLive = (s: ServiceLike) => s.status === "live" || s.status === "active";
const notArchived = (s: ServiceLike) => s.status !== "archived";

/** Services still offered (not archived) that have no photo. */
export function servicesMissingPhoto(services: ServiceLike[]): number {
  return services.filter((s) => notArchived(s) && !s.imageUrl).length;
}

/** "No services yet", "2 live" or "1 live, 1 not live" (archived left out), like the business hub. */
export function serviceCountText(services: ServiceLike[]): string {
  const offered = services.filter(notArchived);
  if (offered.length === 0) return "No services yet";
  const live = offered.filter(isLive).length;
  const other = offered.length - live;
  return other > 0 ? `${live} live, ${other} not live` : `${live} live`;
}

export function photographerSetupSteps(input: {
  name: string | null | undefined;
  hourlyRate: number | null | undefined;
  hasHours: boolean;
  services: ServiceLike[];
  payoutsReady: boolean;
}): PhotographerSetupStep[] {
  const offered = input.services.filter(notArchived);
  const missing = servicesMissingPhoto(input.services);
  const steps: PhotographerSetupStep[] = [
    {
      key: "profile",
      label: "Add your name and rate",
      // Same rule as the dashboard's "Profile details" (name and an hourly rate).
      done: Boolean((input.name ?? "").trim() && (input.hourlyRate ?? 0) > 0),
      target: "profile",
    },
    { key: "hours", label: "Set your hours", done: input.hasHours, target: "hours" },
    { key: "first_service", label: "Add your first service", done: offered.length > 0, target: "services" },
  ];
  if (offered.length > 0) {
    steps.push({
      key: "service_photos",
      label: missing === 1 ? "Add a photo to 1 service" : `Add photos to ${missing} services`,
      done: missing === 0,
      target: "services",
    });
  }
  steps.push({ key: "payouts", label: "Connect payouts", done: input.payoutsReady, target: "payouts" });
  return steps;
}

/** Banner from photographers.visibility_status (public / hidden / flagged). Unknown → no banner. */
export function visibilityBanner(
  status: string | null | undefined,
): { tone: "ok" | "warn"; title: string; desc: string } | null {
  if (status === "public") {
    return { tone: "ok", title: "Profile visible", desc: "Customers can find and book you" };
  }
  if (status === "hidden" || status === "flagged") {
    return {
      tone: "warn",
      title: "Profile hidden",
      desc: "Customers can't see your profile right now. Contact Outsyde support.",
    };
  }
  return null;
}

// "Finish setting up" checklist on the Manage business page (2026-10-28).
// Built only from data the editor already loads (my-business, products,
// services, eligibility), so it needs no backend change. A cancellation
// policy step is left out on purpose: the backend can't yet tell "never
// refund" chosen by the business apart from the column default.

export type SetupTarget = "products" | "services" | "hours" | "booking" | "payouts";

export interface SetupStep {
  key: string;
  label: string;
  done: boolean;
  /** Page on Manage business that fixes it. */
  target: SetupTarget;
}

interface ItemLike {
  name: string;
  imageUrl?: string | null;
  status?: string | null;
}

export interface SetupInput {
  products: ItemLike[];
  services: ItemLike[];
  /** Business offers services (or already has some): booking steps apply. */
  offersServices: boolean;
  hoursOfOperation: unknown;
  vendorTermsAndConditions: string | null | undefined;
  /** From GET /api/vendor/eligibility; null when it couldn't be loaded. */
  requiresOnboarding: boolean | null;
  requiresSubscription: boolean | null;
}

const active = (list: ItemLike[]) => list.filter((i) => i.status !== "archived");

const photoLabel = (missing: ItemLike[], noun: string) =>
  missing.length === 1
    ? `Add a photo to ${missing[0].name}`
    : `Add photos to ${missing.length} ${noun}`;

export function hasHours(raw: unknown): boolean {
  if (!raw) return false;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return false;
    }
  }
  return typeof value === "object" && value !== null && Object.keys(value as object).length > 0;
}

export function buildSetupSteps(input: SetupInput): SetupStep[] {
  const products = active(input.products);
  const services = active(input.services);
  const steps: SetupStep[] = [];

  steps.push({
    key: "first-item",
    label: "Add your first product or service",
    done: products.length + services.length > 0,
    target: products.length === 0 && input.offersServices ? "services" : "products",
  });

  if (products.length > 0) {
    const missing = products.filter((p) => !p.imageUrl);
    steps.push({
      key: "product-photos",
      label: missing.length ? photoLabel(missing, "products") : "Add a photo to every product",
      done: missing.length === 0,
      target: "products",
    });
  }

  if (services.length > 0) {
    const missing = services.filter((s) => !s.imageUrl);
    steps.push({
      key: "service-photos",
      label: missing.length ? photoLabel(missing, "services") : "Add a photo to every service",
      done: missing.length === 0,
      target: "services",
    });
  }

  if (input.offersServices) {
    steps.push({
      key: "hours",
      label: "Set your hours",
      done: hasHours(input.hoursOfOperation),
      target: "hours",
    });
    steps.push({
      key: "terms",
      label: "Add your business terms",
      done: Boolean(input.vendorTermsAndConditions && input.vendorTermsAndConditions.trim()),
      target: "booking",
    });
  }

  if (input.requiresOnboarding !== null) {
    steps.push({
      key: "payouts",
      label: "Connect payouts",
      done: !input.requiresOnboarding,
      target: "payouts",
    });
  }

  if (input.requiresSubscription !== null) {
    steps.push({
      key: "plan",
      label: "Choose your plan",
      done: !input.requiresSubscription,
      target: "payouts",
    });
  }

  return steps;
}

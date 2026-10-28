import test from "node:test";
import assert from "node:assert/strict";
import { cleared, knownForFrom, profilePayload, termsPayload, type ProfileFormValues } from "./storefrontProfile";
import { buildSetupSteps, hasHours } from "./setupChecklist";

const filled: ProfileFormValues = {
  name: "Jazzy Sweet Tooth",
  tagline: "Fresh fruit cakes",
  description: "Custom cakes made in Uniondale.",
  contactEmail: "hello@example.com",
  contactPhone: "(516) 555-0100",
  websiteUrl: "https://example.com",
  showResponseTime: true,
  showEmail: true,
  showPhone: false,
  showWebsite: true,
  showStoreHours: true,
  hasPhysicalLocation: true,
  showAddress: false,
  defaultServiceLocationType: "business",
  responseTimeValue: 2,
  responseTimeUnit: "hours",
  address: "1 Main St",
  city: "Uniondale",
  state: "NY",
  zipCode: "11553",
  knownFor: [],
  knownForChanged: false,
};

// What the old Save Profile sent for the same form (StorefrontEditorScreen @ 63b517c, :652-674),
// minus vendorTermsAndConditions, which now saves from Booking settings.
const oldPayload = (v: ProfileFormValues) => ({
  name: v.name || undefined,
  tagline: v.tagline || undefined,
  description: v.description || undefined,
  contactEmail: v.contactEmail || undefined,
  contactPhone: v.contactPhone || undefined,
  websiteUrl: v.websiteUrl || undefined,
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
  address: v.address || undefined,
  city: v.city || undefined,
  state: v.state || undefined,
});

test("filled form: same values as before, plus the ZIP that was never sent", () => {
  const { zipCode, ...rest } = profilePayload(filled);
  assert.deepEqual(rest, oldPayload(filled));
  assert.equal(zipCode, "11553");
});

test("emptied optional fields are sent as null so they clear", () => {
  const p = profilePayload({ ...filled, tagline: "", description: "   ", websiteUrl: "", city: "", zipCode: "" });
  assert.equal(p.tagline, null);
  assert.equal(p.description, null);
  assert.equal(p.websiteUrl, null);
  assert.equal(p.city, null);
  assert.equal(p.zipCode, null);
  assert.equal(p.contactEmail, "hello@example.com");
});

test("an empty business name is never sent", () => {
  assert.equal(profilePayload({ ...filled, name: "  " }).name, undefined);
});

test("knownFor only goes out when the chips changed", () => {
  assert.equal("knownFor" in profilePayload(filled), false);
  assert.deepEqual(profilePayload({ ...filled, knownFor: ["Custom Orders"], knownForChanged: true }).knownFor, ["Custom Orders"]);
});

test("terms never ride along with the profile save", () => {
  assert.equal("vendorTermsAndConditions" in profilePayload(filled), false);
});

test("terms: text saves as typed, empty clears", () => {
  assert.deepEqual(termsPayload("Arrive 10 minutes early."), { vendorTermsAndConditions: "Arrive 10 minutes early." });
  assert.deepEqual(termsPayload("  "), { vendorTermsAndConditions: null });
});

test("cleared and knownForFrom", () => {
  assert.equal(cleared(" a "), " a ");
  assert.equal(cleared(""), null);
  assert.deepEqual(knownForFrom(["Fast Service", 3, null]), ["Fast Service"]);
  assert.deepEqual(knownForFrom("Fast Service, Local Favorite"), ["Fast Service", "Local Favorite"]);
  assert.deepEqual(knownForFrom(null), []);
});

const base = {
  products: [],
  services: [],
  offersServices: false,
  hoursOfOperation: null,
  vendorTermsAndConditions: null,
  requiresOnboarding: null,
  requiresSubscription: null,
};

test("checklist: brand new products business", () => {
  const steps = buildSetupSteps(base);
  assert.deepEqual(steps.map((s) => [s.key, s.done]), [["first-item", false]]);
  assert.equal(steps[0].target, "products");
});

test("checklist: one product without a photo is named", () => {
  const steps = buildSetupSteps({
    ...base,
    products: [
      { name: "Fresh Fruit Cake", imageUrl: "https://x/cake.jpg", status: "live" },
      { name: "Sweet Potato S’more Cookie", imageUrl: null, status: "live" },
      { name: "Old cookie", imageUrl: null, status: "archived" },
    ],
  });
  const photos = steps.find((s) => s.key === "product-photos")!;
  assert.equal(photos.done, false);
  assert.equal(photos.label, "Add a photo to Sweet Potato S’more Cookie");
});

test("checklist: service business gets hours and terms, payouts from eligibility", () => {
  const steps = buildSetupSteps({
    ...base,
    services: [{ name: "Box braids", imageUrl: "https://x/b.jpg", status: "live" }],
    offersServices: true,
    hoursOfOperation: JSON.stringify({ tuesday: { open: true } }),
    vendorTermsAndConditions: "  ",
    requiresOnboarding: false,
    requiresSubscription: true,
  });
  assert.deepEqual(
    steps.map((s) => [s.key, s.done]),
    [
      ["first-item", true],
      ["service-photos", true],
      ["hours", true],
      ["terms", false],
      ["payouts", true],
      ["plan", false],
    ],
  );
});

test("hasHours", () => {
  assert.equal(hasHours(null), false);
  assert.equal(hasHours("not json"), false);
  assert.equal(hasHours("{}"), false);
  assert.equal(hasHours({ monday: { open: true } }), true);
});

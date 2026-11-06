/**
 * Photographer Manage business checklist and counts — run with: npx tsx utils/photographerSetup.test.ts
 */
import assert from "node:assert/strict";
import {
  photographerSetupSteps,
  serviceCountText,
  servicesMissingPhoto,
  visibilityBanner,
} from "./photographerSetup";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const base = {
  name: "Gio",
  hourlyRate: 150,
  hasHours: true,
  services: [{ status: "live", imageUrl: "https://x/a.jpg" }],
  payoutsReady: true,
};

test("everything done gives five done steps", () => {
  const steps = photographerSetupSteps(base);
  assert.deepEqual(steps.map((s) => s.key), ["profile", "hours", "first_service", "service_photos", "payouts"]);
  assert.ok(steps.every((s) => s.done));
});

test("profile needs a name and a rate above 0 (same rule as the dashboard)", () => {
  assert.equal(photographerSetupSteps({ ...base, hourlyRate: 0 })[0].done, false);
  assert.equal(photographerSetupSteps({ ...base, name: "" })[0].done, false);
  assert.equal(photographerSetupSteps({ ...base, name: "  " })[0].done, false);
});

test("no services: first service is open and the photo step is left out", () => {
  const steps = photographerSetupSteps({ ...base, services: [] });
  assert.equal(steps.find((s) => s.key === "first_service")?.done, false);
  assert.equal(steps.find((s) => s.key === "service_photos"), undefined);
  assert.equal(steps.length, 4);
});

test("archived services don't count as a first service or need a photo", () => {
  const steps = photographerSetupSteps({ ...base, services: [{ status: "archived", imageUrl: null }] });
  assert.equal(steps.find((s) => s.key === "first_service")?.done, false);
  assert.equal(steps.find((s) => s.key === "service_photos"), undefined);
});

test("photo step names how many services need a photo", () => {
  const services = [
    { status: "live", imageUrl: null },
    { status: "draft", imageUrl: "" },
    { status: "live", imageUrl: "https://x/b.jpg" },
    { status: "archived", imageUrl: null },
  ];
  assert.equal(servicesMissingPhoto(services), 2);
  const step = photographerSetupSteps({ ...base, services }).find((s) => s.key === "service_photos");
  assert.equal(step?.done, false);
  assert.equal(step?.label, "Add photos to 2 services");
  assert.equal(
    photographerSetupSteps({ ...base, services: [{ status: "live", imageUrl: null }] }).find((s) => s.key === "service_photos")?.label,
    "Add a photo to 1 service",
  );
});

test("hours and payouts", () => {
  const steps = photographerSetupSteps({ ...base, hasHours: false, payoutsReady: false });
  assert.equal(steps.find((s) => s.key === "hours")?.done, false);
  assert.equal(steps.find((s) => s.key === "payouts")?.done, false);
  assert.equal(steps.find((s) => s.key === "payouts")?.target, "payouts");
});

test("service count text matches the business hub wording", () => {
  assert.equal(serviceCountText([]), "No services yet");
  assert.equal(serviceCountText([{ status: "live" }, { status: "live" }]), "2 live");
  assert.equal(serviceCountText([{ status: "live" }, { status: "draft" }, { status: "archived" }]), "1 live, 1 not live");
  assert.equal(serviceCountText([{ status: "active" }]), "1 live");
});

test("visibility banner", () => {
  assert.equal(visibilityBanner("public")?.tone, "ok");
  assert.equal(visibilityBanner("hidden")?.tone, "warn");
  assert.equal(visibilityBanner("flagged")?.tone, "warn");
  assert.equal(visibilityBanner(undefined), null);
  assert.equal(visibilityBanner("something_else"), null);
});

console.log(`\n${passed} passed`);

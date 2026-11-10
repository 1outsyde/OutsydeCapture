/**
 * Account menu redesign (2026-11-10): every place the old menu opened is still reachable, and the
 * menu stays a full screen page (Full Screen Pass #525). Reads the component source, no rendering.
 * Run with: npx tsx utils/accountMenuRoutes.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(__dirname, "..", "components", "PersonalSettingsMenu.tsx"),
  "utf8",
);
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

test("every destination of the old menu is still there", () => {
  const routes = [
    "AdminDashboard",
    "PhotographerDashboard",
    "PhotographerManageBusiness",
    "StaffDashboard",
    "BusinessDashboard",
    "StorefrontEditor",
    "StaffManagement",
    "Settings",
    "NotificationSettings",
    "OutsydePoints",
    "YourEvents",
    "DoorEvents",
    "InfluencerDashboard",
    "InfluencerApplication",
    "BlockedUsers",
    "SupportContact",
    "TermsOfService",
    "PrivacyPolicy",
  ];
  for (const r of routes) assert.ok(src.includes(`"${r}"`), r);
  assert.ok(src.includes("handleManageSubscription"), "subscription link");
});

test("who sees what is unchanged", () => {
  for (const rule of [
    'user?.role === "business"',
    'user?.role === "photographer"',
    'user?.role === "staff"',
    "isMultiStaff ?",
    "!user?.isGuest ?",
    '!!user?.isInfluencer && user?.influencerStatus === "approved"',
    "!user?.isInfluencer && isConsumerOrGuest",
  ]) {
    assert.ok(src.includes(rule), rule);
  }
});

test("still a full screen page with filled icons only", () => {
  assert.ok(src.includes('presentationStyle="fullScreen"'));
  assert.ok(!/name="[a-z-]+-outline"/.test(src), "no outline icons");
  assert.ok(!src.includes("Feather"), "Feather (outline set) not used");
});

console.log(`\n${passed} passed`);

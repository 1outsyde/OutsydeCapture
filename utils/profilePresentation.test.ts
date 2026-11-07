import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MODAL_ROUTE_NAMES,
  aboveModalOptions,
  isAboveModal,
  profilePresentationFor,
} from "./profilePresentation";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("opened from the tabs pushes as a card", () => {
  assert.equal(profilePresentationFor(["Main", "VendorDetail"], 1), "card");
});

test("profile on profile stays a card", () => {
  assert.equal(
    profilePresentationFor(
      ["Main", "VendorDetail", "FollowList", "UserProfile"],
      3,
    ),
    "card",
  );
});

test("opened from PostDetail goes full screen modal", () => {
  assert.equal(
    profilePresentationFor(["Main", "PostDetail", "VendorDetail"], 2),
    "fullScreenModal",
  );
});

test("opened from Notifications goes full screen modal", () => {
  assert.equal(
    profilePresentationFor(["Main", "Notifications", "UserProfile"], 2),
    "fullScreenModal",
  );
});

test("any modal lower in the stack counts", () => {
  assert.equal(
    profilePresentationFor(
      ["Main", "Favorites", "VendorDetail", "FollowList"],
      3,
    ),
    "fullScreenModal",
  );
});

test("a modal above this route does not count", () => {
  assert.equal(
    profilePresentationFor(["Main", "VendorDetail", "PostDetail"], 1),
    "card",
  );
});

test("unknown index looks at the whole stack", () => {
  assert.equal(
    profilePresentationFor(["Main", "Sessions"], -1),
    "fullScreenModal",
  );
  assert.equal(profilePresentationFor(["Main"], -1), "card");
});

test("MODAL_ROUTE_NAMES matches RootNavigator", () => {
  const src = readFileSync(
    join(__dirname, "..", "navigation", "RootNavigator.tsx"),
    "utf8",
  );
  const modal = new Set<string>();
  for (const m of src.matchAll(/<Stack\.Screen\b[\s\S]*?\/>/g)) {
    const block = m[0];
    const name = /name="([^"]+)"/.exec(block)?.[1];
    const pres = /presentation:\s*["'](\w+)["']/.exec(block)?.[1];
    if (name && pres && pres !== "card") modal.add(name);
  }
  assert.deepEqual([...modal].sort(), [...MODAL_ROUTE_NAMES].sort());
});

const back = () => "BACK";

test("aboveModalOptions: no modal below returns the route's own options", () => {
  const base = { presentation: "card", animation: "slide_from_right", headerShown: true };
  assert.equal(aboveModalOptions(base, false, back), base);
});

test("aboveModalOptions: above a modal goes full screen modal", () => {
  const out = aboveModalOptions({ headerShown: false }, true, back) as Record<string, unknown>;
  assert.equal(out.presentation, "fullScreenModal");
  assert.equal(out.animation, "slide_from_bottom");
  assert.equal(out.headerLeft, undefined);
});

test("aboveModalOptions: native header gets a back button", () => {
  const out = aboveModalOptions({ headerShown: true, headerTitle: "Chat" }, true, back) as Record<string, unknown>;
  assert.equal(out.headerLeft, back);
  assert.equal(out.headerTitle, "Chat");
});

test("aboveModalOptions: keeps a headerLeft the route already set", () => {
  const own = () => "OWN";
  const out = aboveModalOptions({ headerShown: true, headerLeft: own }, true, back) as Record<string, unknown>;
  assert.equal(out.headerLeft, own);
});

test("isAboveModal", () => {
  assert.equal(isAboveModal(["Main", "PostDetail", "Chat"], 2), true);
  assert.equal(isAboveModal(["Main", "VendorDetail", "Chat"], 2), false);
});

test("every non-modal root route uses stackAware or profileOptions", () => {
  const src = readFileSync(
    join(__dirname, "..", "navigation", "RootNavigator.tsx"),
    "utf8",
  );
  const missing: string[] = [];
  for (const m of src.matchAll(/<Stack\.Screen\b[\s\S]*?\n\s*\/>/g)) {
    const block = m[0];
    const name = /name="([^"]+)"/.exec(block)?.[1];
    if (!name || name === "Onboarding" || name === "Main") continue;
    if (MODAL_ROUTE_NAMES.has(name)) continue;
    if (!/options=\{(stackAware|profileOptions)\(/.test(block)) missing.push(name);
  }
  assert.deepEqual(missing, []);
});

console.log(`\n${passed} passed`);

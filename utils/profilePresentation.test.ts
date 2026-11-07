import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MODAL_ROUTE_NAMES,
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

console.log(`\n${passed} passed`);

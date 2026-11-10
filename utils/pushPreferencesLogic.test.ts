/**
 * Per-category push switches (Activity step 3b). Run with: npx tsx utils/pushPreferencesLogic.test.ts
 */
import assert from "node:assert/strict";
import {
  PUSH_CATEGORY_KEYS,
  parsePushPreferences,
  pushCategoryRows,
} from "./pushPreferencesLogic";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

test("same four keys as the backend (outsyde-backend pushCategories.ts)", () => {
  assert.deepEqual(
    [...PUSH_CATEGORY_KEYS],
    ["bookings", "messages", "orders", "events"],
  );
});

test("reads the new reply", () => {
  assert.deepEqual(
    parsePushPreferences({
      success: true,
      news: false,
      categories: {
        bookings: false,
        messages: true,
        orders: true,
        events: false,
      },
    }),
    {
      news: false,
      categories: {
        bookings: false,
        messages: true,
        orders: true,
        events: false,
      },
    },
  );
});

test("an older backend (news only) hides the category rows, keeps news", () => {
  assert.deepEqual(parsePushPreferences({ success: true, news: true }), {
    news: true,
    categories: null,
  });
  assert.deepEqual(
    parsePushPreferences({ news: true, categories: { bookings: true } }),
    {
      news: true,
      categories: null,
    },
  );
});

test("unusable replies give null", () => {
  for (const r of [null, undefined, "x", {}, { news: "yes" }])
    assert.equal(parsePushPreferences(r), null);
});

test("rows: order, labels without dashes, note only for businesses, photographers and staff", () => {
  const consumer = pushCategoryRows("consumer");
  assert.deepEqual(
    consumer.map((r) => r.key),
    ["bookings", "messages", "orders", "events"],
  );
  assert.equal(consumer[0].note, undefined);
  for (const role of ["business", "photographer", "staff"]) {
    assert.equal(
      pushCategoryRows(role)[0].note,
      "New bookings still show in your Activity and by email.",
    );
  }
  assert.equal(pushCategoryRows(undefined)[0].note, undefined);
  for (const r of pushCategoryRows("business")) {
    for (const text of [r.label, r.description, r.note ?? ""])
      assert.ok(!/[–—]|\s-\s/.test(text), text);
  }
});

console.log(`\n${passed} passed`);

import test from "node:test";
import assert from "node:assert/strict";
import { FEED_MODES, nextFeedMode } from "./feedModes";

test("tab row order is EVENTS, FOLLOWING, PRO, PULSE", () => {
  assert.deepEqual(FEED_MODES.map((m) => m.label), ["EVENTS", "FOLLOWING", "PRO", "PULSE"]);
});

test("swiping left moves right along the row, right moves back, clamped", () => {
  assert.equal(nextFeedMode("events", "left"), "following");
  assert.equal(nextFeedMode("following", "left"), "pro");
  assert.equal(nextFeedMode("pro", "left"), "pulse");
  assert.equal(nextFeedMode("pulse", "left"), "pulse");
  assert.equal(nextFeedMode("pulse", "right"), "pro");
  assert.equal(nextFeedMode("pro", "right"), "following");
  assert.equal(nextFeedMode("following", "right"), "events");
  assert.equal(nextFeedMode("events", "right"), "events");
});

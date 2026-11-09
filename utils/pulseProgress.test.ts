import test from "node:test";
import assert from "node:assert/strict";
import {
  PROGRESS_MIN_SECONDS,
  clockText,
  progressFraction,
  shouldShowProgress,
  timeAtX,
} from "./pulseProgress";

test("the bar shows only on videos over 60 seconds", () => {
  assert.equal(PROGRESS_MIN_SECONDS, 60);
  assert.equal(shouldShowProgress(45), false);
  assert.equal(shouldShowProgress(60), false);
  assert.equal(shouldShowProgress(60.5), true);
  assert.equal(shouldShowProgress(3600), true);
  assert.equal(shouldShowProgress(0), false);
  assert.equal(shouldShowProgress(null), false);
  assert.equal(shouldShowProgress(undefined), false);
  assert.equal(shouldShowProgress(NaN), false);
  assert.equal(shouldShowProgress(Infinity), false);
});

test("progressFraction stays between 0 and 1", () => {
  assert.equal(progressFraction(30, 120), 0.25);
  assert.equal(progressFraction(-5, 120), 0);
  assert.equal(progressFraction(200, 120), 1);
  assert.equal(progressFraction(10, 0), 0);
  assert.equal(progressFraction(NaN, 120), 0);
});

test("timeAtX maps a finger position to a time, held to the video", () => {
  assert.equal(timeAtX(180, 360, 602), 301);
  assert.equal(timeAtX(0, 360, 602), 0);
  assert.equal(timeAtX(-20, 360, 602), 0);
  assert.equal(timeAtX(400, 360, 602), 602);
  assert.equal(timeAtX(100, 0, 602), 0);
});

test("clockText reads like a player clock", () => {
  assert.equal(clockText(7), "0:07");
  assert.equal(clockText(228.9), "3:48");
  assert.equal(clockText(602), "10:02");
  assert.equal(clockText(3725), "1:02:05");
  assert.equal(clockText(-3), "0:00");
  assert.equal(clockText(NaN), "0:00");
});

import assert from "node:assert/strict";
import { remainingStoryMs } from "./storyPause";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("nothing played yet: the whole duration remains", () => {
  assert.equal(remainingStoryMs(5000, 0), 5000);
});
test("half played: half remains", () => {
  assert.equal(remainingStoryMs(5000, 0.5), 2500);
});
test("fully played: nothing remains", () => {
  assert.equal(remainingStoryMs(5000, 1), 0);
});
test("progress past the end is treated as done", () => {
  assert.equal(remainingStoryMs(5000, 1.4), 0);
});
test("negative progress is treated as not started", () => {
  assert.equal(remainingStoryMs(5000, -0.2), 5000);
});

console.log(`\n${passed} passed`);

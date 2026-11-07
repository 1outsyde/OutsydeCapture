import assert from "node:assert/strict";
import { createAfterClose } from "./afterSheetClose";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("iOS: queued action waits for onDismiss, then runs once", () => {
  const after = createAfterClose("ios");
  let runs = 0;
  after.queue(() => runs++);
  after.runIfImmediate();
  assert.equal(runs, 0);
  after.onDismiss();
  assert.equal(runs, 1);
  after.onDismiss();
  assert.equal(runs, 1);
});

test("Android: runIfImmediate runs the queued action once", () => {
  const after = createAfterClose("android");
  let runs = 0;
  after.queue(() => runs++);
  after.runIfImmediate();
  assert.equal(runs, 1);
  after.runIfImmediate();
  after.onDismiss();
  assert.equal(runs, 1);
});

test("a newer queued action replaces the older one", () => {
  const after = createAfterClose("ios");
  const seen: string[] = [];
  after.queue(() => seen.push("a"));
  after.queue(() => seen.push("b"));
  after.onDismiss();
  assert.deepEqual(seen, ["b"]);
});

test("onDismiss with nothing queued does nothing", () => {
  const after = createAfterClose("ios");
  after.onDismiss();
});

console.log(`\n${passed} passed`);

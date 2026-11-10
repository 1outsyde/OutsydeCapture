/**
 * Activity read status (step 1, 2026-11-10). Run with: npx tsx utils/notificationReadSync.test.ts
 */
import assert from "node:assert/strict";
import {
  isServerNotificationId,
  mergeServerNotifications,
  markOneRead,
  markEveryRead,
} from "./notificationReadSync";

type Row = { id: string; read: boolean; title?: string };
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

test("phone-only ids are not server ids", () => {
  assert.equal(isServerNotificationId("notif_1731240000000"), false);
  assert.equal(isServerNotificationId("4f6c2a8e-1b2c-4d5e-9f00-123456789abc"), true);
  assert.equal(isServerNotificationId(""), false);
  assert.equal(isServerNotificationId(undefined), false);
});

test("a row read on the phone stays read when the server still says unread", () => {
  const current: Row[] = [{ id: "a", read: true }, { id: "b", read: false }];
  const server: Row[] = [{ id: "a", read: false }, { id: "b", read: false }];
  assert.deepEqual(mergeServerNotifications(current, server), [
    { id: "a", read: true },
    { id: "b", read: false },
  ]);
});

test("a row the server says is read stays read", () => {
  const merged = mergeServerNotifications<Row>([{ id: "a", read: false }], [{ id: "a", read: true }]);
  assert.deepEqual(merged, [{ id: "a", read: true }]);
});

test("phone-only rows come first and are kept; server rows keep server order and fields", () => {
  const current: Row[] = [{ id: "notif_9", read: false }, { id: "old", read: true }];
  const server: Row[] = [{ id: "new", read: false, title: "N" }, { id: "x", read: false, title: "X" }];
  assert.deepEqual(mergeServerNotifications(current, server), [
    { id: "notif_9", read: false },
    { id: "new", read: false, title: "N" },
    { id: "x", read: false, title: "X" },
  ]);
});

test("the old bug: merging from an empty stale copy turned read rows unread; the latest list keeps them", () => {
  const latest: Row[] = [{ id: "a", read: true }];
  const server: Row[] = [{ id: "a", read: false }];
  assert.equal(mergeServerNotifications([] as Row[], server)[0].read, false);
  assert.equal(mergeServerNotifications(latest, server)[0].read, true);
});

test("markOneRead only reports a change for an unread row", () => {
  const rows: Row[] = [{ id: "a", read: false }, { id: "b", read: true }];
  const first = markOneRead(rows, "a");
  assert.equal(first.changed, true);
  assert.deepEqual(first.rows, [{ id: "a", read: true }, { id: "b", read: true }]);
  const again = markOneRead(first.rows, "a");
  assert.equal(again.changed, false);
  assert.equal(again.rows, first.rows);
  assert.equal(markOneRead(rows, "missing").changed, false);
});

test("markEveryRead calls the server only when an unread server row exists", () => {
  const onlyLocal = markEveryRead<Row>([{ id: "notif_1", read: false }, { id: "a", read: true }]);
  assert.equal(onlyLocal.serverChanged, false);
  assert.ok(onlyLocal.rows.every((n) => n.read));
  const withServer = markEveryRead<Row>([{ id: "a", read: false }]);
  assert.equal(withServer.serverChanged, true);
  assert.deepEqual(withServer.rows, [{ id: "a", read: true }]);
  assert.equal(markEveryRead<Row>([]).serverChanged, false);
});

console.log(`\n${passed} passed`);

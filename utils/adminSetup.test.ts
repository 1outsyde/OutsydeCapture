/** Admin account setup emails (same as goutsyde.com AccountSetupTab). Run with: npx tsx utils/adminSetup.test.ts */
import assert from "node:assert/strict";
import { SETUP_FILTERS, setupName, setupOrdinal, setupSendBody, setupSendResult, type DueReminder } from "./adminSetup";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${n} ${name}`); };

const r = (o: Partial<DueReminder>): DueReminder => ({
  userId: "u", email: "a@b.co", displayName: null, role: "business", reminderNumber: 1,
  template: "steps_left", steps: ["plan"], channels: ["email"], outcome: "planned", ...o,
});

t("send body: dryRun false, ticked ids only, never empty", () => {
  assert.deepEqual(setupSendBody(["u1", "u2", "u1"]), { dryRun: false, userIds: ["u1", "u2"] });
  assert.throws(() => setupSendBody([]), /Tick at least one/);
  assert.throws(() => setupSendBody(["", "x".repeat(101)]), /Tick at least one/);
  assert.throws(() => setupSendBody(Array.from({ length: 201 }, (_, i) => `u${i}`)), /at most 200/);
  assert.equal(setupSendBody(Array.from({ length: 200 }, (_, i) => `u${i}`)).userIds.length, 200);
});

t("filters match the web", () => {
  const list = [r({ userId: "c", template: "claim", steps: ["password"] }), r({ userId: "p", steps: ["payouts", "plan"] }), r({ userId: "n", steps: ["username"] })];
  const ids = (k: string) => list.filter(SETUP_FILTERS.find((f) => f.key === k)!.match).map((x) => x.userId);
  assert.deepEqual(ids("all"), ["c", "p", "n"]);
  assert.deepEqual(ids("claim"), ["c"]);
  assert.deepEqual(ids("payouts"), ["p"]);
  assert.deepEqual(ids("plan"), ["p"]);
  assert.deepEqual(ids("username"), ["n"]);
});

t("result split like the web", () => {
  const res = setupSendResult({
    reminders: [r({ userId: "a", outcome: "sent" }), r({ userId: "b", outcome: "failed", error: "bounce" }), r({ userId: "c", outcome: "skipped_recently_claimed" })],
    notDue: ["d"],
  });
  assert.deepEqual(res.sent.map((x) => x.userId), ["a"]);
  assert.deepEqual(res.failed.map((x) => x.userId), ["b"]);
  assert.deepEqual(res.notDue, ["d", "c"]);
  assert.deepEqual(setupSendResult({}), { sent: [], failed: [], notDue: [] });
});

t("labels", () => {
  assert.equal(setupOrdinal(1), "1st email");
  assert.equal(setupOrdinal(3), "3rd email");
  assert.equal(setupOrdinal(4), "4th email");
  assert.equal(setupName({ displayName: "  ", email: "a@b.co" }), "a@b.co");
  assert.equal(setupName({ displayName: "Nails by Pam", email: "a@b.co" }), "Nails by Pam");
});
console.log(`\n${n} passed`);

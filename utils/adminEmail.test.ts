/** Admin email history labels (same as goutsyde.com HistoryTab). Run with: npx tsx utils/adminEmail.test.ts */
import assert from "node:assert/strict";
import { emailAudienceLabel, emailBudgetLine, emailCountsLine, emailKindLabel, emailPersonName, emailSendTitle } from "./adminEmail";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${n} ${name}`); };

t("kind labels", () => {
  assert.equal(emailKindLabel("broadcast"), "Announcement");
  assert.equal(emailKindLabel("setup_claim"), "Claim email");
  assert.equal(emailKindLabel("setup_steps_left"), "Steps left email");
  assert.equal(emailKindLabel("order_receipt"), "Order receipt");
});
t("send titles", () => {
  assert.equal(emailSendTitle({ kind: "setup", subject: null }), "Account setup emails");
  assert.equal(emailSendTitle({ kind: "setup", subject: " Finish your account " }), "Finish your account");
  assert.equal(emailSendTitle({ kind: "broadcast", subject: "" }), "No subject");
  assert.equal(emailSendTitle({ kind: "broadcast", subject: "Holiday hours" }), "Holiday hours");
});
t("counts", () => {
  assert.equal(emailCountsLine({ sent_count: 40, failed_count: 0, recipient_count: 40 }), "40 sent of 40");
  assert.equal(emailCountsLine({ sent_count: 38, failed_count: 2, recipient_count: 40 }), "38 sent, 2 failed of 40");
  assert.equal(emailCountsLine({ sent_count: "7" as any, failed_count: null as any, recipient_count: "9" as any }), "7 sent of 9");
});
t("audience, names, budget", () => {
  assert.equal(emailAudienceLabel("vendors"), "All businesses");
  assert.equal(emailAudienceLabel(null), null);
  assert.equal(emailAudienceLabel("toString"), null);
  assert.equal(emailPersonName({ name: "  ", email: "a@b.co" }), "a@b.co");
  assert.equal(emailPersonName({}), "Unknown account");
  assert.equal(emailBudgetLine({ sentToday: 12, limit: 80, remaining: 68 }), "12 of 80 sent today");
  assert.equal(emailBudgetLine({ sentToday: 3, limit: null, remaining: null }), "3 sent today");
});
console.log(`\n${n} passed`);

/**
 * Admin push: same checks and wording as goutsyde.com PushTab / PushHistory. Run with: npx tsx utils/adminPush.test.ts
 */
import assert from "node:assert/strict";
import {
  countsLine,
  formatEtDateTime,
  isAllowedPushLink,
  newPushKey,
  OFFLINE,
  pushContentError,
  pushErrorText,
  pushSendBlocker,
  pushWhyNot,
  quietLine,
} from "./adminPush";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} ${name}`);
};

const base = { title: "Your partner kit is ready", body: "Tap to see your new flyers.", screen: "activity", url: "", maxTitle: 65, maxBody: 178 };

t("content checks match the web and backend", () => {
  assert.equal(pushContentError(base), null);
  assert.equal(pushContentError({ ...base, title: "   " }), "Add a title.");
  assert.equal(pushContentError({ ...base, title: "x".repeat(66) }), "Keep the title to 65 characters.");
  assert.equal(pushContentError({ ...base, title: "x".repeat(65) }), null);
  assert.equal(pushContentError({ ...base, title: "two\nlines" }), "The title must be one line.");
  assert.equal(pushContentError({ ...base, body: "" }), "Add a message.");
  assert.equal(pushContentError({ ...base, body: "y".repeat(179) }), "Keep the message to 178 characters.");
  assert.equal(pushContentError({ ...base, screen: "link", url: "https://evil.com" }), "The link must start with https://goutsyde.com.");
  assert.equal(pushContentError({ ...base, screen: "link", url: "https://www.goutsyde.com/events" }), null);
});

t("links: only goutsyde.com over https", () => {
  for (const ok of ["https://goutsyde.com", "https://goutsyde.com/", "https://www.goutsyde.com/events?x=1", "https://goutsyde.com#a"]) assert.ok(isAllowedPushLink(ok), ok);
  for (const bad of ["http://goutsyde.com", "https://goutsyde.com.evil.com", "https://evilgoutsyde.com", "goutsyde.com/x", ""]) assert.ok(!isAllowedPushLink(bad), bad);
});

t("send blockers", () => {
  const limits = { sentToday: 1, max: 3, remaining: 2, quietHours: false, nowNewYork: "8:31 AM" };
  assert.equal(pushSendBlocker({ contentError: null, audience: "vendors", recipients: 12, limits }), null);
  assert.equal(pushSendBlocker({ contentError: "Add a title.", audience: "vendors", recipients: 12, limits }), "Add a title.");
  assert.equal(pushSendBlocker({ contentError: null, audience: null, recipients: 0, limits }), "Pick who to send to.");
  assert.equal(pushSendBlocker({ contentError: null, audience: "picked", recipients: 0, limits }), "Tick at least one person.");
  assert.equal(pushSendBlocker({ contentError: null, audience: "all", recipients: 0, limits }), "Nobody in this group can get a push right now.");
  assert.equal(pushSendBlocker({ contentError: null, audience: "all", recipients: 9, limits: { ...limits, remaining: 0 } }), "You've sent 3 pushes today. Send it tomorrow.");
});

t("why someone can't get a push", () => {
  const p = { id: "u", name: "A", username: "a", role: "consumer", hasToken: true, newsOptOut: false, canPush: false };
  assert.equal(pushWhyNot({ ...p, newsOptOut: true }), "Turned off Outsyde news and offers");
  assert.equal(pushWhyNot({ ...p, hasToken: false }), "Hasn't allowed notifications on a phone");
  assert.equal(pushWhyNot(p), "Can't get pushes (disabled, demo or admin account)");
});

t("quiet hours line and counts line", () => {
  assert.equal(quietLine("10:15 PM"), "It is after 9 PM in New York (10:15 PM). People may be asleep.");
  assert.equal(quietLine("6:02 AM"), "It is before 9 AM in New York (6:02 AM). People may be asleep.");
  assert.equal(countsLine({ sentCount: 40, failedCount: 0, skippedCount: 0, recipientCount: 40 }), "40 sent of 40");
  assert.equal(countsLine({ sentCount: 30, failedCount: 2, skippedCount: 1, recipientCount: 33 }), "30 sent, 2 failed, 1 skipped of 33");
});

t("one-time keys are unique and short enough for the backend (<= 100)", () => {
  const keys = new Set<string>();
  for (let i = 0; i < 5000; i++) keys.add(newPushKey());
  assert.equal(keys.size, 5000);
  for (const k of keys) assert.ok(k.length > 8 && k.length <= 100, k);
  const saved = (globalThis as any).crypto;
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  try {
    const fallback = new Set<string>();
    for (let i = 0; i < 5000; i++) fallback.add(newPushKey());
    assert.equal(fallback.size, 5000);
  } finally {
    Object.defineProperty(globalThis, "crypto", { value: saved, configurable: true });
  }
});

t("date and time in New York matches Intl (web format) across both DST switches", () => {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  for (let ms = Date.UTC(2025, 0, 1); ms < Date.UTC(2028, 0, 1); ms += 53 * 60 * 1000) {
    const iso = new Date(ms).toISOString();
    assert.equal(formatEtDateTime(iso).replace(/ /g, " "), fmt.format(new Date(ms)).replace(/ /g, " "), iso);
  }
  assert.equal(formatEtDateTime(null), "");
  assert.equal(formatEtDateTime("nope"), "");
});

t("error text: nested push errors, no answer = offline", () => {
  assert.equal(pushErrorText({ status: 429, message: "[object Object]", body: { success: false, error: { code: "OVER_DAILY_LIMIT", message: "You've sent 3 pushes today. Send it tomorrow." } } }, "x"), "You've sent 3 pushes today. Send it tomorrow.");
  assert.equal(pushErrorText({ status: 409, body: { error: { code: "DUPLICATE_SEND", message: "You sent this same push in the last 10 minutes." } } }, "x"), "You sent this same push in the last 10 minutes.");
  assert.equal(pushErrorText({ message: "Network request failed" }, "x"), OFFLINE);
  assert.equal(pushErrorText({ message: "Request timed out. Please try again." }, "x"), OFFLINE);
  assert.equal(pushErrorText({ status: 500 }, "The push didn't start."), "The push didn't start.");
});

console.log(`\n${n} passed`);

/** Unit tests for Report event and on hold (p5-safety A1 to A5). npx tsx utils/reportEventLogic.test.ts */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ON_HOLD_COPY,
  REPORT_COPY,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  canShowReport,
  isOnHold,
  isReportReason,
  onHoldBanner,
  reportBody,
  reportErrorCopy,
  reportFormError,
} from "./reportEventLogic";
import { GENERIC_ERROR } from "./eventsLogic";

test("six reasons, the backend's keys, in order", () => {
  assert.deepEqual(
    REPORT_REASONS.map((r) => r.id),
    ["scam", "illegal", "hate", "sexual", "wrong_details", "other"],
  );
  assert.ok(
    isReportReason("scam") && !isReportReason("spam") && !isReportReason(1),
  );
});

test("form rules", () => {
  assert.equal(reportFormError(null, ""), REPORT_COPY.pick);
  assert.equal(reportFormError("other", "   "), REPORT_COPY.noteNeeded);
  assert.equal(reportFormError("other", "Copied flyer"), null);
  assert.equal(reportFormError("scam", ""), null, "note optional otherwise");
  assert.notEqual(
    reportFormError("scam", "x".repeat(REPORT_NOTE_MAX + 1)),
    null,
  );
  assert.equal(reportFormError("scam", "x".repeat(REPORT_NOTE_MAX)), null);
});

test("body: note trimmed, left out when blank", () => {
  assert.deepEqual(reportBody("scam", "  "), { reason: "scam" });
  assert.deepEqual(reportBody("other", " Fake "), {
    reason: "other",
    note: "Fake",
  });
});

test("error copy", () => {
  const own = {
    status: 403,
    body: {
      error: {
        code: "CANT_REPORT_OWN",
        message: "You can't report an event you host or work on.",
      },
    },
  };
  assert.equal(
    reportErrorCopy(own),
    "You can't report an event you host or work on.",
  );
  assert.equal(
    reportErrorCopy({
      status: 404,
      body: { error: { code: "EVENT_NOT_FOUND", message: "x" } },
    }),
    "This event isn't available to report anymore.",
  );
  assert.equal(
    reportErrorCopy({
      status: 500,
      body: { error: { code: "SERVER_ERROR", message: "boom" } },
    }),
    GENERIC_ERROR,
  );
  assert.equal(reportErrorCopy(new Error("network")), GENERIC_ERROR);
  assert.equal(reportErrorCopy(null), GENERIC_ERROR);
});

test("who sees Report event", () => {
  assert.equal(
    canShowReport({ status: "published", viewerIsHost: false }),
    true,
  );
  assert.equal(
    canShowReport({ status: "paused", viewerIsHost: false }),
    true,
    "a holder can report it on hold",
  );
  assert.equal(
    canShowReport({ status: "published", viewerIsHost: true }),
    false,
  );
  assert.equal(
    canShowReport({
      status: "published",
      viewerIsHost: false,
      viewerIsCohost: true,
    }),
    false,
  );
  assert.equal(canShowReport({ status: "draft", viewerIsHost: false }), false);
  assert.equal(
    canShowReport({ status: "cancelled", viewerIsHost: false }),
    false,
  );
});

test("on hold", () => {
  assert.equal(isOnHold({ status: "paused" }), true);
  assert.equal(isOnHold({ status: "published", onHold: true }), true);
  assert.equal(isOnHold({ status: "published" }), false);
  assert.equal(
    onHoldBanner({ status: "published", viewerIsHost: false }),
    null,
  );
  assert.equal(
    onHoldBanner({ status: "paused", viewerIsHost: false }),
    ON_HOLD_COPY.holder,
  );
  assert.equal(
    onHoldBanner({ status: "paused", viewerIsHost: true }),
    ON_HOLD_COPY.host,
  );
  assert.equal(
    onHoldBanner({
      status: "paused",
      viewerIsHost: false,
      viewerIsCohost: true,
    }),
    ON_HOLD_COPY.host,
  );
});

test("copy: same words as goutsyde.com, no dashes, no percentages", () => {
  assert.equal(REPORT_COPY.thanks, "Thanks. We'll review this event.");
  assert.equal(
    ON_HOLD_COPY.holder,
    "This event is on hold while Outsyde reviews it. Your ticket is safe, and we'll email you if anything changes.",
  );
  const all = [
    ...Object.values(REPORT_COPY),
    ...Object.values(ON_HOLD_COPY),
    ...REPORT_REASONS.map((r) => r.label),
  ];
  assert.deepEqual(
    all.filter((s) => /[‒–—―]| - /.test(s)),
    [],
  );
  assert.deepEqual(
    all.filter((s) => /\d\s*%/.test(s)),
    [],
  );
});

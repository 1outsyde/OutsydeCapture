/**
 * Booking settings defaults — run with: npx tsx utils/businessDefaults.test.ts
 */
import assert from "node:assert/strict";
import {
  depositInputFrom,
  parseDefaultDepositInput,
  policyDraftFrom,
  policyFromDraft,
  stepsFromSetupStatus,
} from "./businessDefaults";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test("draft from a business with no policy", () => {
  const d = policyDraftFrom({});
  assert.equal(d.fullRefundWindow, "never");
  assert.equal(d.hasPartialRefund, false);
  assert.deepEqual(policyFromDraft(d), {
    policy: {
      fullRefundWindow: "never",
      hasPartialRefund: false,
      partialRefundWindow: null,
      partialRefundPercentage: null,
      hasCancellationFee: false,
      cancellationFeeType: null,
      cancellationFeeAmount: null,
    },
  });
});
test("round trip of a full policy (flat fee in dollars)", () => {
  const b = {
    fullRefundWindow: "48_hours",
    hasPartialRefund: true,
    partialRefundWindow: "24_hours",
    partialRefundPercentage: 50,
    hasCancellationFee: true,
    cancellationFeeType: "flat",
    cancellationFeeAmount: 1000,
  };
  const d = policyDraftFrom(b);
  assert.equal(d.feeInput, "10.00");
  assert.deepEqual((policyFromDraft(d) as any).policy, b);
});
test("percentage fee and switched off parts", () => {
  const d = {
    ...policyDraftFrom({}),
    hasCancellationFee: true,
    cancellationFeeType: "percentage" as const,
    feeInput: "20",
    partialPercentInput: "40",
  };
  const p = (policyFromDraft(d) as any).policy;
  assert.equal(p.cancellationFeeAmount, 20);
  assert.equal(p.partialRefundPercentage, null);
});
test("problems", () => {
  const base = policyDraftFrom({});
  assert.ok(
    "error" in
      policyFromDraft({
        ...base,
        hasPartialRefund: true,
        partialPercentInput: "",
      }),
  );
  assert.ok(
    "error" in
      policyFromDraft({
        ...base,
        hasPartialRefund: true,
        partialPercentInput: "120",
      }),
  );
  assert.ok(
    "error" in
      policyFromDraft({ ...base, hasCancellationFee: true, feeInput: "abc" }),
  );
  assert.ok(
    "error" in
      policyFromDraft({ ...base, hasCancellationFee: true, feeInput: "0" }),
  );
  assert.ok(
    "error" in
      policyFromDraft({
        ...base,
        hasCancellationFee: true,
        cancellationFeeType: "percentage",
        feeInput: "150",
      }),
  );
});
test("unknown stored window falls back", () => {
  assert.equal(
    policyDraftFrom({ fullRefundWindow: "2_days" }).fullRefundWindow,
    "never",
  );
});
test("default deposit input", () => {
  assert.deepEqual(parseDefaultDepositInput(""), { cents: null });
  assert.deepEqual(parseDefaultDepositInput("0"), { cents: null });
  assert.deepEqual(parseDefaultDepositInput("25"), { cents: 2500 });
  assert.deepEqual(parseDefaultDepositInput("$7.00"), { cents: 700 });
  assert.ok("error" in parseDefaultDepositInput("6.99"));
  assert.ok("error" in parseDefaultDepositInput("2.555"));
  assert.equal(depositInputFrom(2500), "25.00");
  assert.equal(depositInputFrom(null), "");
});
test("server checklist → hub steps, waiting left out, null when unusable", () => {
  const steps = stepsFromSetupStatus({
    businessId: "b",
    complete: false,
    next: "hours",
    doneCount: 1,
    totalCount: 3,
    steps: [
      {
        key: "approval",
        state: "waiting",
        label: "Business approval",
        target: null,
      },
      {
        key: "first_item",
        state: "done",
        label: "Add your first product or service",
        target: "services",
      },
      {
        key: "cancellation_policy",
        state: "todo",
        label: "Choose your cancellation policy",
        target: "booking",
      },
    ],
  });
  assert.deepEqual(steps, [
    {
      key: "first_item",
      label: "Add your first product or service",
      done: true,
      target: "services",
    },
    {
      key: "cancellation_policy",
      label: "Choose your cancellation policy",
      done: false,
      target: "booking",
    },
  ]);
  assert.equal(stepsFromSetupStatus(null), null);
  assert.equal(stepsFromSetupStatus({} as any), null);
});

console.log(`\n${passed} passed`);

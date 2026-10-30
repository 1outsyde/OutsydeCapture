import test from "node:test";
import assert from "node:assert/strict";
import { cancelPreviewMessage, manualFeeLine } from "./cancelPreviewMessage";

const base = {
  feeAmountCents: 0,
  feeWouldBeCharged: false,
  isDepositBooking: false,
};

test("deposit booking: only says the deposit is non-refundable (B $275, D $30, charged $32.40)", () => {
  const msg = cancelPreviewMessage({
    ...base,
    refundTier: "none",
    refundAmountCents: 0,
    chargedAmountCents: 3240,
    isDepositBooking: true,
  });
  assert.equal(msg, "Your deposit is non-refundable.");
  assert.ok(!msg.includes("297"));
});

test("full refund shows what was charged and that the service fee stays", () => {
  assert.equal(
    cancelPreviewMessage({
      ...base,
      refundTier: "full",
      refundAmountCents: 27500,
      chargedAmountCents: 29700,
    }),
    "You paid $297.00. You'll receive a full refund of $275.00. The service fee is non-refundable.",
  );
});

test("full refund equal to the charge has no service fee sentence", () => {
  assert.equal(
    cancelPreviewMessage({
      ...base,
      refundTier: "full",
      refundAmountCents: 29700,
      chargedAmountCents: 29700,
    }),
    "You paid $297.00 and will receive a full refund of $297.00.",
  );
});

test("partial refund, with and without a cancellation fee", () => {
  const p = {
    ...base,
    refundTier: "partial" as const,
    refundAmountCents: 13750,
    chargedAmountCents: 29700,
  };
  assert.equal(
    cancelPreviewMessage(p),
    "You paid $297.00. You'll receive a partial refund of $137.50.",
  );
  assert.equal(
    cancelPreviewMessage({
      ...p,
      feeAmountCents: 500,
      feeWouldBeCharged: true,
    }),
    "You paid $297.00. You'll receive a partial refund of $137.50. A $5.00 cancellation fee also applies.",
  );
});

test("no refund, with and without a cancellation fee", () => {
  const p = {
    ...base,
    refundTier: "none" as const,
    refundAmountCents: 0,
    chargedAmountCents: 29700,
  };
  assert.equal(
    cancelPreviewMessage(p),
    "You paid $297.00 and will not receive a refund.",
  );
  assert.equal(
    cancelPreviewMessage({
      ...p,
      feeAmountCents: 500,
      feeWouldBeCharged: true,
    }),
    "You paid $297.00 and will not receive a refund. A $5.00 cancellation fee applies.",
  );
});

test("copy rules: no dashes and no percentages in any message", () => {
  const all = [
    cancelPreviewMessage({
      ...base,
      refundTier: "none",
      refundAmountCents: 0,
      chargedAmountCents: 3240,
      isDepositBooking: true,
    }),
    cancelPreviewMessage({
      ...base,
      refundTier: "full",
      refundAmountCents: 27500,
      chargedAmountCents: 29700,
    }),
    cancelPreviewMessage({
      ...base,
      refundTier: "partial",
      refundAmountCents: 13750,
      chargedAmountCents: 29700,
      feeAmountCents: 500,
      feeWouldBeCharged: true,
    }),
    cancelPreviewMessage({
      ...base,
      refundTier: "none",
      refundAmountCents: 0,
      chargedAmountCents: 29700,
      feeAmountCents: 500,
      feeWouldBeCharged: true,
    }),
    manualFeeLine(500, "business"),
    manualFeeLine(500, "photographer"),
  ];
  for (const m of all) {
    assert.ok(!/[—–]| - /.test(m), m);
    assert.ok(!m.includes("%"), m);
  }
});

test("manual fee line", () => {
  assert.equal(
    manualFeeLine(500, "business"),
    "A $5.00 cancellation fee applies. The business will collect this separately.",
  );
  assert.equal(
    manualFeeLine(500, "photographer"),
    "A $5.00 cancellation fee applies. The photographer will collect this separately.",
  );
});

// Customer cancel dialog text, from the backend's cancel-preview response
// (GET /api/bookings/appointments/:id/cancel-preview and
// GET /api/bookings/shoot/:id/cancel-preview).
// "You paid" is chargedAmountCents: what the booking PaymentIntent charged
// (the deposit plus the service fee on deposit bookings). Never use
// grossChargeAmountCents here, it is the full price plus the fee.
// No local money math: every amount comes from the backend.

export interface CancelPreviewAmounts {
  refundTier: "full" | "partial" | "none";
  refundAmountCents: number;
  feeAmountCents: number;
  feeWouldBeCharged: boolean;
  chargedAmountCents: number;
  isDepositBooking: boolean;
}

export const formatCents = (cents: number): string =>
  `$${(cents / 100).toFixed(2)}`;

export function cancelPreviewMessage(p: CancelPreviewAmounts): string {
  const fmt = formatCents;
  let msg: string;
  if (p.isDepositBooking) {
    msg = "Your deposit is non-refundable.";
  } else if (p.refundTier === "full") {
    msg =
      p.chargedAmountCents > p.refundAmountCents
        ? `You paid ${fmt(p.chargedAmountCents)}. You'll receive a full refund of ${fmt(p.refundAmountCents)}. The service fee is non-refundable.`
        : `You paid ${fmt(p.chargedAmountCents)} and will receive a full refund of ${fmt(p.refundAmountCents)}.`;
  } else if (p.refundTier === "partial") {
    msg = `You paid ${fmt(p.chargedAmountCents)}. You'll receive a partial refund of ${fmt(p.refundAmountCents)}.`;
  } else {
    msg = `You paid ${fmt(p.chargedAmountCents)} and will not receive a refund.`;
  }
  // Same as before this change: a fee line only on the partial and none tiers.
  if (p.refundTier !== "full" && p.feeWouldBeCharged) {
    msg +=
      p.refundTier === "partial"
        ? ` A ${fmt(p.feeAmountCents)} cancellation fee also applies.`
        : ` A ${fmt(p.feeAmountCents)} cancellation fee applies.`;
  }
  return msg;
}

// Success alert line when the provider collects the cancellation fee themselves.
export function manualFeeLine(
  feeAmountCents: number,
  collector: "business" | "photographer",
): string {
  return `A ${formatCents(feeAmountCents)} cancellation fee applies. The ${collector} will collect this separately.`;
}

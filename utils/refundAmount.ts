// Provider refunds (business owner or photographer). Backend rules (outsyde-backend
// server/providerRefund.ts, Oct 21 2026):
//  - full refund = what was charged before the service fee: the deposit on deposit
//    bookings, otherwise the service price. The service fee is kept.
//  - amountCents is the amount in cents. The legacy `amount` field is read as dollars.

/** The most a provider can refund, in dollars: the deposit, or the service price. */
export function fullRefundDollars(booking: {
  amount: number;
  depositAmountCents?: number | null;
}): number {
  const deposit = booking.depositAmountCents;
  if (typeof deposit === "number" && deposit > 0) return deposit / 100;
  return booking.amount;
}

/** Request body for a refund. `amountDollars` undefined = full refund. */
export function refundRequestBody(amountDollars?: number): {
  amountCents?: number;
  amount?: number;
} {
  if (amountDollars === undefined) return {};
  // amountCents is what newer backends read; amount (dollars) keeps a partial
  // refund partial if an older backend answers.
  return { amountCents: Math.round(amountDollars * 100), amount: amountDollars };
}

/** Dollars actually refunded, from the refund response. */
export function refundedDollars(
  result: { refundedAmountCents?: number; amount?: number },
  requestedDollars: number | undefined,
  fullDollars: number,
): number {
  if (typeof result.refundedAmountCents === "number") return result.refundedAmountCents / 100;
  return requestedDollars ?? fullDollars;
}

/**
 * Shop checkout payment block (p4-applepay step 2). Pure: no React Native or Stripe imports.
 *
 * The backend already returns only the cards a customer may see again, one per card, never Apple Pay
 * (GET /api/me/payment-methods, backend #383). `olderPaymentMethodIds` names the customer's older cards,
 * saved before the save rules started; they never go up front unless the customer made one the default.
 */

/** One card up front (the default, else the first chosen card); everything else under "Other saved cards". */
export function splitSavedCards<C extends { id: string; isDefault: boolean }>(
  cards: C[],
  olderIds: string[],
): { upFront: C | null; others: C[] } {
  const older = new Set(olderIds);
  const upFront = cards.find((c) => c.isDefault) ?? cards.find((c) => !older.has(c.id)) ?? null;
  return { upFront, others: cards.filter((c) => c !== upFront) };
}

/** The Apple Pay sheet's one line: "Pay Outsyde $64.80". The amount is the charge the server set. */
export function applePayCartItems(totalCents: number): { label: string; amount: string }[] {
  return [{ label: "Outsyde", amount: (totalCents / 100).toFixed(2) }];
}

/** What the card is charged, from the server's fee breakdown (after points). null when unknown. */
export function chargedCents(
  fb: { amountChargedCents?: number; totalChargedToConsumerCents?: number } | null | undefined,
): number | null {
  const v = fb?.amountChargedCents ?? fb?.totalChargedToConsumerCents;
  return typeof v === "number" ? v : null;
}

/** confirmPlatformPayPayment's error: none = paid, Canceled = the customer closed Apple Pay. */
export function applePayOutcome(error: { code?: string } | null | undefined): "paid" | "canceled" | "failed" {
  if (!error) return "paid";
  return error.code === "Canceled" ? "canceled" : "failed";
}

/**
 * The server breakdown to show in the price lines, or null to keep the local preview. A multi shop cart
 * answers with the total only; showing it as-is printed "$NaN" for the subtotal and fee.
 */
export function shownBreakdown<B extends { basePriceCents?: number; consumerUpchargeCents?: number }>(fb: B | null | undefined): B | null {
  return fb && typeof fb.basePriceCents === "number" && typeof fb.consumerUpchargeCents === "number" ? fb : null;
}

/** One checkout at a time: a second tap before the first finishes is ignored (state updates arrive late). */
export function makeOneAtATime(): { start(): boolean; done(): void } {
  let busy = false;
  return {
    start() { if (busy) return false; busy = true; return true; },
    done() { busy = false; },
  };
}

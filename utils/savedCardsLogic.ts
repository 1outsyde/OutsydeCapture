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

// One-shot, module-level flag: "the vendor just came back from Stripe onboarding".
// Set when an outsyde://stripe-return link arrives; consumed once by the dashboard so the
// "Your Stripe account is now connected!" alert can fire only after a return, never on a
// plain foreground refresh. Module state survives the navigation reset that remounts screens.

let returnPending = false;

export function markStripeReturn(): void {
  returnPending = true;
}

/** Returns true once per return, then clears. */
export function consumeStripeReturn(): boolean {
  const was = returnPending;
  returnPending = false;
  return was;
}

// Pure show/hide decision for the "Set up Stripe Connect" popup. No React, no I/O.

export interface ConnectPromptEligibility {
  requiresApproval?: boolean;
  requiresPlanSelection?: boolean;
  requiresOnboarding?: boolean;
  requiresSubscription?: boolean;
}

export interface ConnectPromptStripeStatus {
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

export interface ConnectPromptInput {
  role: string | null | undefined;
  /** subscription.connectReady from GET /api/vendor/subscription (null on paid plans). */
  connectReady: boolean | null | undefined;
  /** Live status that confirms connectReady; null when it could not be fetched. */
  stripeStatus: ConnectPromptStripeStatus | null | undefined;
  /** null until loaded (or when the fetch failed). */
  eligibility: ConnectPromptEligibility | null | undefined;
  snoozed: boolean;
  blockingModalOpen: boolean;
  mainFocused: boolean;
}

export function shouldShowConnectPrompt(input: ConnectPromptInput): boolean {
  const { role, connectReady, stripeStatus, eligibility, snoozed, blockingModalOpen, mainFocused } = input;

  if (role !== "business") return false;
  if (connectReady !== false) return false;

  // The status call must have succeeded and must agree that payouts are not ready.
  if (!stripeStatus) return false;
  if (stripeStatus.chargesEnabled === true && stripeStatus.payoutsEnabled === true) return false;

  // Those cases belong to the existing eligibility gate.
  if (!eligibility) return false;
  if (
    eligibility.requiresApproval ||
    eligibility.requiresPlanSelection ||
    eligibility.requiresOnboarding ||
    eligibility.requiresSubscription
  ) {
    return false;
  }

  if (snoozed || blockingModalOpen || !mainFocused) return false;
  return true;
}

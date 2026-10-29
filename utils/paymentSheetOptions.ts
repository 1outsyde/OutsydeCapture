// Extra Stripe payment sheet options for booking and ticket payments (p4-applepay step 3).
// Pure: no React Native imports, so it runs under the node tests.

/** The two fields the backend adds when the app sends `paymentSheet: true` (backend #383). */
export interface PaymentSheetSession {
  customerId?: unknown;
  customerSessionClientSecret?: unknown;
}

/**
 * Stripe's SetupParams only accepts the customer session as a pair of strings, so the result
 * is either without them or with both.
 */
export type SheetOptions =
  | { applePay?: { merchantCountryCode: string }; customerId?: never; customerSessionClientSecret?: never }
  | { applePay?: { merchantCountryCode: string }; customerId: string; customerSessionClientSecret: string };

/**
 * Apple Pay on iOS (merchant id comes from StripeProvider); the customer's saved cards and the
 * Save box when the backend sent a session. Without a session the sheet works as before.
 */
export function sheetOptions(res: PaymentSheetSession | null | undefined, os: string): SheetOptions {
  const out: { applePay?: { merchantCountryCode: string }; customerId?: string; customerSessionClientSecret?: string } = {};
  if (os === "web") return {};
  if (os === "ios") out.applePay = { merchantCountryCode: "US" };
  const customerId = res?.customerId;
  const secret = res?.customerSessionClientSecret;
  if (typeof customerId === "string" && customerId && typeof secret === "string" && secret) {
    return { ...out, customerId, customerSessionClientSecret: secret };
  }
  return out.applePay ? { applePay: out.applePay } : {};
}

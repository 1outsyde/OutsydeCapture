// Extra Stripe payment sheet options for booking and ticket payments (p4-applepay step 3).
// Pure: no React Native imports, so it runs under the node tests.
import {
  STRIPE_RETURN_URL,
  googlePayTestEnv,
  outsydeAppearance,
  type OutsydeAppearance,
} from "./outsydePaymentAppearance";

/** The two fields the backend adds when the app sends `paymentSheet: true` (backend #383). */
export interface PaymentSheetSession {
  customerId?: unknown;
  customerSessionClientSecret?: unknown;
}

/**
 * Stripe's SetupParams only accepts the customer session as a pair of strings, so the result
 * is either without them or with both.
 */
interface SheetExtras {
  applePay?: { merchantCountryCode: string };
  googlePay?: {
    merchantCountryCode: string;
    currencyCode: string;
    testEnv: boolean;
  };
  returnURL?: string;
  appearance?: OutsydeAppearance;
}
export type SheetOptions =
  | (SheetExtras & { customerId?: never; customerSessionClientSecret?: never })
  | (SheetExtras & { customerId: string; customerSessionClientSecret: string });

/** App payment methods Step 2: the app's current light/dark mode and the Stripe key (for Google Pay test mode). */
export interface SheetStyle {
  scheme: "light" | "dark";
  publishableKey: string | undefined;
}

/**
 * Apple Pay on iOS (merchant id comes from StripeProvider); the customer's saved cards and the
 * Save box when the backend sent a session. Without a session the sheet works as before.
 */
export function sheetOptions(
  res: PaymentSheetSession | null | undefined,
  os: string,
  style?: SheetStyle,
): SheetOptions {
  const out: SheetExtras = {};
  if (os === "web") return {};
  if (os === "ios") out.applePay = { merchantCountryCode: "US" };
  if (style) {
    // Step 2: Google Pay on Android, the return link for Klarna, Afterpay and card checks, Outsyde colors.
    if (os === "android") {
      out.googlePay = {
        merchantCountryCode: "US",
        currencyCode: "USD",
        testEnv: googlePayTestEnv(style.publishableKey),
      };
    }
    out.returnURL = STRIPE_RETURN_URL;
    out.appearance = outsydeAppearance(style.scheme);
  }
  const customerId = res?.customerId;
  const secret = res?.customerSessionClientSecret;
  if (
    typeof customerId === "string" &&
    customerId &&
    typeof secret === "string" &&
    secret
  ) {
    return { ...out, customerId, customerSessionClientSecret: secret };
  }
  return { ...out };
}

/** The style every sheet passes: the app's own light/dark mode and the app's Stripe key. */
export function sheetStyle(isDark: boolean): SheetStyle {
  return {
    scheme: isDark ? "dark" : "light",
    publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };
}

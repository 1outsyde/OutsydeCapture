// App payment methods Step 4b: product checkout with Stripe's embedded picker, in the compact layout Legend
// approved 2026-11-07 (Apple Pay on top, one summary row with Change, a pay in 4 line, every other method in a
// "Choose how to pay" sheet). Pure: no React Native imports, so it runs under the node tests.
import type { EmbeddedPaymentElementConfiguration } from "@stripe/stripe-react-native";
import {
  STRIPE_RETURN_URL,
  googlePayTestEnv,
  outsydeAppearance,
} from "./outsydePaymentAppearance";
import type { PaymentSheetSession, SheetStyle } from "./paymentSheetOptions";

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Klarna and Afterpay pay in 4 both cover $1 to $2,000 in the US (Stripe docs, checked 2026-11-07). */
const PAY_IN_4_MIN = 100;
const PAY_IN_4_MAX = 200000;

/** Show "Or pay in 4 interest free with Klarna or Afterpay" only where it's true. */
export function payIn4Shown(totalCents: number): boolean {
  return (
    Number.isFinite(totalCents) &&
    totalCents >= PAY_IN_4_MIN &&
    totalCents <= PAY_IN_4_MAX
  );
}

/** The small line under the chosen method in the summary row, or null for none. */
export function methodSub(
  type: string | null | undefined,
  totalCents: number,
): string | null {
  switch (type) {
    case "klarna":
    case "afterpay_clearpay":
      // Klarna can make the first payment a little larger, so "about".
      return payIn4Shown(totalCents)
        ? `4 interest free payments of about ${money(Math.ceil(totalCents / 4))}`
        : null;
    case "cashapp":
      return "You approve in Cash App";
    case "amazon_pay":
      return "You approve on Amazon";
    default:
      return null;
  }
}

/** The main button: where the customer goes next for methods that leave the app, the total otherwise. */
export function payButtonLabel(
  type: string | null | undefined,
  totalCents: number,
): string {
  switch (type) {
    case "klarna":
      return "Continue to Klarna";
    case "afterpay_clearpay":
      return "Continue to Afterpay";
    case "cashapp":
      return "Continue to Cash App";
    case "amazon_pay":
      return "Continue to Amazon Pay";
    default:
      return `Confirm & Pay ${money(totalCents)}`;
  }
}

/**
 * Stripe's SDK doesn't compare the picker's amount with the PaymentIntent (stripe-ios
 * PaymentSheetDeferredValidator.swift:12), so the app does: never charge a total the customer didn't see.
 */
export function chargeMatchesPreview(
  previewCents: number | null,
  chargedCents: number | null,
  opts: { estimate?: boolean } = {},
): boolean {
  if (previewCents == null || chargedCents == null) return true;
  // The local estimate can be a cent off the server's fee rounding; the server preview never is.
  return Math.abs(previewCents - chargedCents) <= (opts.estimate ? 1 : 0);
}

/** The picker's amount: the server preview when there is one, else the local estimate. Whole, positive cents. */
export function intentAmount(
  previewCents: number | null,
  localCents: number,
): number {
  const c =
    previewCents && previewCents > 0 ? previewCents : Math.round(localCents);
  return c > 0 ? c : 50;
}

/** Body for POST /api/me/payment-methods/checkout-session. Android: chosen cards only (backend #430). */
export function checkoutSessionBody(os: string): { chosenCardsOnly?: true } {
  return os === "android" ? { chosenCardsOnly: true } : {};
}

export interface ShippingFields {
  line1: string;
  city: string;
  state: string;
  zipCode: string;
}

/** Body for POST /api/cart/payment-intent: today's fields plus redirectCapable (backend #429). */
export function cartIntentBody<I>(
  items: I[],
  shippingAddress: ShippingFields,
  promoCodeId: string | null,
) {
  return {
    items,
    shippingAddress,
    ...(promoCodeId ? { promoCodeId } : {}),
    redirectCapable: true as const,
  };
}

interface ConfigInput {
  os: string;
  style: SheetStyle;
  session: PaymentSheetSession | null | undefined;
  user:
    | { firstName?: string; lastName?: string; email?: string }
    | null
    | undefined;
  /** The shipping address picked when the screen loaded, used to prefill billing (Afterpay asks for it). */
  address: ShippingFields | null | undefined;
}

/**
 * The picker's setup. Built once per screen (the SDK rebuilds the picker whenever this object changes,
 * EmbeddedPaymentElement.tsx:463-479), so it only uses values known when the screen loads.
 * Apple Pay is left out on iPhone: the Apple Pay button sits above the picker and must not show twice.
 */
export function checkoutElementConfig(
  i: ConfigInput,
): EmbeddedPaymentElementConfiguration {
  const c: EmbeddedPaymentElementConfiguration = {
    merchantDisplayName: "Outsyde",
    returnURL: STRIPE_RETURN_URL,
    appearance: outsydeAppearance(
      i.style.scheme,
    ) as EmbeddedPaymentElementConfiguration["appearance"],
    allowsDelayedPaymentMethods: false,
    formSheetAction: { type: "continue" },
  };
  if (i.os === "ios")
    c.style = i.style.scheme === "dark" ? "alwaysDark" : "alwaysLight";
  if (i.os === "android")
    c.googlePay = {
      merchantCountryCode: "US",
      currencyCode: "USD",
      testEnv: googlePayTestEnv(i.style.publishableKey),
    };

  const id = i.session?.customerId;
  const secret = i.session?.customerSessionClientSecret;
  if (typeof id === "string" && id && typeof secret === "string" && secret) {
    c.customerId = id;
    c.customerSessionClientSecret = secret;
  }

  const name = `${i.user?.firstName ?? ""} ${i.user?.lastName ?? ""}`.trim();
  const email = (i.user?.email ?? "").trim();
  const a = i.address;
  const hasAddress =
    !!a &&
    [a.line1, a.city, a.state, a.zipCode].every((v) => v.trim().length > 0);
  const billing: NonNullable<
    EmbeddedPaymentElementConfiguration["defaultBillingDetails"]
  > = {};
  if (name) billing.name = name;
  if (email) billing.email = email;
  if (hasAddress)
    billing.address = {
      line1: a!.line1.trim(),
      city: a!.city.trim(),
      state: a!.state.trim(),
      postalCode: a!.zipCode.trim(),
      country: "US",
    };
  if (Object.keys(billing).length > 0) c.defaultBillingDetails = billing;
  return c;
}

/** Whether the pay button can be tapped. */
export function pickerReady(s: {
  loaded: boolean;
  hasOption: boolean;
  hasAddress: boolean;
  busy: boolean;
  empty: boolean;
  loadFailed: boolean;
}): boolean {
  return (
    s.loaded &&
    s.hasOption &&
    s.hasAddress &&
    !s.busy &&
    !s.empty &&
    !s.loadFailed
  );
}

/**
 * The preview for the current cart and points code. pending: still asking (pay waits). A failed preview
 * (cents null) stops waiting; the charge is then checked against the estimate on screen.
 */
export function previewFor(
  preview: { key: string; cents: number | null } | null,
  key: string,
): { pending: boolean; cents: number | null } {
  if (!preview || preview.key !== key) return { pending: true, cents: null };
  return { pending: false, cents: preview.cents };
}

/**
 * The failure text from the picker's confirm. The native sides send `error` as a string
 * (stripe-react-native 0.81.0 StripeSdkImpl+Embedded.swift:129, EmbeddedPaymentElementView.kt:179),
 * despite the Error type. Null when there's nothing to show.
 */
export function resultErrorText(result: {
  status: "failed";
  error: Error | string;
}): string | null {
  const e = result.error as unknown;
  const text =
    typeof e === "string"
      ? e
      : e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "";
  return text.trim() ? text.trim() : null;
}

// Outsyde look for every Stripe payment screen (app payment methods, Step 2).
// Pure: no React Native imports, so it runs under the node tests.
import { Colors, BorderRadius } from "../constants/theme";

/**
 * Where Stripe sends customers back after Klarna, Afterpay, Cash App Pay or Amazon Pay (and some card
 * security checks). App.tsx forwards it to Stripe. Avoids "stripe-return" and "checkout", which other
 * link handlers in the app react to.
 */
export const STRIPE_RETURN_URL = "outsyde://stripe-redirect";

/** Google Pay test mode follows the Stripe key: only a live key (pk_live_) uses live Google Pay. */
export function googlePayTestEnv(
  publishableKey: string | undefined | null,
): boolean {
  return !(
    typeof publishableKey === "string" && publishableKey.startsWith("pk_live_")
  );
}

const toHex2 = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");

/**
 * Stripe takes colors only as #RRGGBB (or #AARRGGBB). The dark theme uses see-through rgba() colors, so they
 * are blended over the background they sit on to give the exact solid color the app shows.
 */
export function toStripeHex(color: string, over: string): string {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return `#${hex[1].toUpperCase()}`;
  const rgba = color
    .trim()
    .match(
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
    );
  const base = over.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!rgba || !base)
    throw new Error(`toStripeHex: unsupported color ${color} over ${over}`);
  const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
  const mix = (c: string, b: string) =>
    toHex2(Number(c) * a + parseInt(b, 16) * (1 - a));
  return `#${mix(rgba[1], base[1])}${mix(rgba[2], base[2])}${mix(rgba[3], base[3])}`;
}

export interface OutsydeAppearance {
  colors: {
    primary: string;
    background: string;
    componentBackground: string;
    componentBorder: string;
    componentDivider: string;
    primaryText: string;
    secondaryText: string;
    componentText: string;
    placeholderText: string;
    icon: string;
    error: string;
  };
  shapes: { borderRadius: number };
  primaryButton: {
    colors: { background: string; text: string };
    shapes: { borderRadius: number };
  };
}

/**
 * Stripe appearance for the app's current mode (the app has its own light/dark setting, so the caller passes
 * it rather than letting Stripe follow the phone). Roles match constants/theme.ts: gold accents, emerald Pay
 * button, cream (dark) or near-black (light) text, the app's 12px card corners. Font stays the system font,
 * like the rest of the app (Fonts = "System").
 */
export function outsydeAppearance(scheme: "light" | "dark"): OutsydeAppearance {
  const c = Colors[scheme];
  const background = c.brandBgElevated;
  const surface = toStripeHex(c.brandSurface, background);
  const border = toStripeHex(c.brandSurfaceBorder, background);
  const dim = toStripeHex(c.brandTextDim, background);
  const text = toStripeHex(c.brandCream, background);
  return {
    colors: {
      primary: toStripeHex(c.brandGold, background),
      background: toStripeHex(background, background),
      componentBackground: surface,
      componentBorder: border,
      componentDivider: border,
      primaryText: text,
      secondaryText: dim,
      componentText: text,
      placeholderText: dim,
      icon: dim,
      error: toStripeHex(c.brandError, background),
    },
    shapes: { borderRadius: BorderRadius.md },
    primaryButton: {
      colors: {
        background: toStripeHex(c.brandPrimary, background),
        text: toStripeHex(c.brandPrimaryText, background),
      },
      shapes: { borderRadius: BorderRadius.md },
    },
  };
}

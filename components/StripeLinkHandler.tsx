// Passes links that open the app to Stripe (app payment methods, Step 2). Klarna, Afterpay, Cash App Pay,
// Amazon Pay and some card security checks send the customer back with outsyde://stripe-redirect; Stripe
// only finishes those payments if the app hands the link over. Stripe answers false for links that aren't
// its own, and the app's other link listeners keep running side by side, so nothing else changes.
import { useEffect } from "react";
import { Linking } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";

export function StripeLinkHandler() {
  const { handleURLCallback } = useStripe();

  useEffect(() => {
    const pass = (url: string | null | undefined) => {
      if (!url) return;
      handleURLCallback(url).catch(() => {});
    };
    Linking.getInitialURL()
      .then(pass)
      .catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => pass(url));
    return () => sub.remove();
  }, [handleURLCallback]);

  return null;
}

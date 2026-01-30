// Stripe SDK disabled for Expo Go compatibility
// PaymentSheet requires native modules not available in Expo Go
// When PAYMENTS_ENABLED=false on backend, the "paused" flow handles payments
// 
// To enable real PaymentSheet in a dev build, uncomment the Stripe import below

export function useStripePayment() {
  return {
    initPaymentSheet: async (_params: any) => ({ error: null }),
    presentPaymentSheet: async () => ({ error: null }),
    isNative: true,
  };
}

// For EAS dev builds with native Stripe support, use this instead:
// import { useStripe } from "@stripe/stripe-react-native";
// 
// export function useStripePayment() {
//   const { initPaymentSheet, presentPaymentSheet } = useStripe();
//   return {
//     initPaymentSheet,
//     presentPaymentSheet,
//     isNative: true,
//   };
// }

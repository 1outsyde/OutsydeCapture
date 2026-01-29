// NOTE: @stripe/stripe-react-native cannot be used in Expo Go because:
// 1. The SDK v0.58.0 auto-loads OnrampSdk module which isn't in Expo Go
// 2. PaymentSheet requires a development build with native modules
// 
// For Expo Go, we use the same web checkout flow.
// When building a development build, you can re-enable the Stripe SDK import.

export function useStripePayment() {
  return {
    initPaymentSheet: async () => ({ error: null }),
    presentPaymentSheet: async () => ({ error: null }),
    isNative: false, // Treat as web to use web checkout in Expo Go
  };
}

// To enable native PaymentSheet in a development build, uncomment below:
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

import { useStripe } from "@stripe/stripe-react-native";

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  return {
    initPaymentSheet,
    presentPaymentSheet,
    isNative: true,
  };
}

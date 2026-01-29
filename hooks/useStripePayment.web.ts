// Web platform - PaymentSheet is not available
// We use expo-web-browser to redirect to Stripe Checkout instead

export function useStripePayment() {
  return {
    initPaymentSheet: async (_params: any) => ({ error: null }),
    presentPaymentSheet: async () => ({ error: null }),
    isNative: false,
  };
}

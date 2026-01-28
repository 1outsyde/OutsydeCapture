export function useStripePayment() {
  return {
    initPaymentSheet: async () => ({ error: null }),
    presentPaymentSheet: async () => ({ error: null }),
    isNative: false,
  };
}

// Quotes step 6c-1 (call 4): every card step on a quote. Pay, Update your card and Pay for extras open the
// payment sheet (Apple Pay on iPhone, saved cards when the backend sends a session); Approve uses the card on file
// with the bank's check (3D Secure) when the bank asks, and Use another card opens the sheet. The backend's webhook
// finishes every payment, so a success here is followed by a few reads of the quote until it shows the change.
import { useCallback } from "react";
import { Platform } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";

import api, { type ApiError, type QuotePayStart } from "@/services/api";
import { sheetOptions, sheetStyle } from "@/utils/paymentSheetOptions";
import { useTheme } from "@/hooks/useTheme";
import {
  approveStep,
  errorMessage,
  sheetOutcome,
  type Quote,
} from "@/utils/quoteLogic";

export type StepResult =
  | { ok: true }
  | { ok: false; canceled: true }
  | { ok: false; message: string; declined?: boolean; code?: string };

const RETURN_URL = "outsyde://stripe-redirect";
const fail = (err: unknown): StepResult => {
  const e = err as ApiError;
  return {
    ok: false,
    message: errorMessage(e),
    declined: e?.status === 402,
    code: e?.body?.code,
  };
};

export function useQuotePayments(getToken: () => Promise<string | null>) {
  const {
    initPaymentSheet,
    presentPaymentSheet,
    handleNextAction,
    handleNextActionForSetup,
  } = useStripe();
  const { isDark } = useTheme();

  /** Opens the payment sheet for a PaymentIntent (charged now or held) or a SetupIntent (a card check). */
  const runSheet = useCallback(
    async (
      start:
        | QuotePayStart
        | {
            clientSecret: string;
            customerId?: string;
            customerSessionClientSecret?: string;
          },
      setup = false,
    ): Promise<StepResult> => {
      const init = await initPaymentSheet({
        merchantDisplayName: "Outsyde",
        ...(setup
          ? { setupIntentClientSecret: start.clientSecret }
          : { paymentIntentClientSecret: start.clientSecret }),
        ...sheetOptions(start, Platform.OS, sheetStyle(isDark)),
      } as any);
      if (init.error)
        return {
          ok: false,
          message: "Payment didn't go through. Try again or use another card.",
        };
      const out = sheetOutcome((await presentPaymentSheet()).error);
      if (out.next === "done") return { ok: true };
      if (out.next === "canceled") return { ok: false, canceled: true };
      return { ok: false, message: out.message };
    },
    [initPaymentSheet, presentPaymentSheet, isDark],
  );

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t)
      throw {
        message: "Not signed in",
        body: { message: "Sign in again to continue." },
      };
    return t;
  }, [getToken]);

  /** The deposit or the full price. QUOTE_CLOSED with status paid means it is already paid. */
  const pay = useCallback(
    async (q: Quote): Promise<StepResult> => {
      try {
        const start = await api.payQuote(await token(), q.id, q.version);
        return await runSheet(start);
      } catch (err) {
        const e = err as ApiError;
        if (e?.body?.code === "QUOTE_CLOSED" && e.body?.status === "paid")
          return { ok: true };
        return fail(err);
      }
    },
    [runSheet, token],
  );

  /** Update your card (balance or extras hold) or Pay for extras. */
  const card = useCallback(
    async (q: Quote, which: "balance" | "extras"): Promise<StepResult> => {
      try {
        return await runSheet(
          await api.quoteCardPayment(await token(), q.id, which),
        );
      } catch (err) {
        return fail(err);
      }
    },
    [runSheet, token],
  );

  /** Approve an extra. newCard: Use another card (after a declined card). */
  const approve = useCallback(
    async (q: Quote, extraId: string, newCard = false): Promise<StepResult> => {
      try {
        const t = await token();
        let r = await api.approveQuoteExtra(t, q.id, extraId, newCard);
        let step = approveStep(r, newCard);
        if (step === "bank" || step === "bank-setup") {
          const res =
            step === "bank"
              ? await handleNextAction(r.clientSecret!, RETURN_URL)
              : await handleNextActionForSetup(r.clientSecret!, RETURN_URL);
          if (res.error)
            return res.error.code === "Canceled"
              ? { ok: false, canceled: true }
              : {
                  ok: false,
                  message:
                    res.error.message || "Your bank didn't confirm the card.",
                  declined: true,
                };
          r = await api.approveQuoteExtra(t, q.id, extraId, false);
          step = approveStep(r, false);
        } else if (step === "sheet") {
          const s = await runSheet(
            {
              clientSecret: r.clientSecret!,
              customerId: r.customerId,
              customerSessionClientSecret: r.customerSessionClientSecret,
            },
            r.intentType === "setup",
          );
          if (!s.ok) return s;
          r = await api.approveQuoteExtra(t, q.id, extraId, true);
          step = approveStep(r, true) === "done" ? "done" : "failed";
        }
        if (step === "done") return { ok: true };
        // Review I1: still waiting on the bank after its check: say so, never "Approved".
        if (r.status === "needs_action")
          return {
            ok: false,
            message:
              "Your bank is still confirming this card. Check back in a minute.",
          };
        return {
          ok: false,
          message: "We couldn't approve this extra. Try again.",
        };
      } catch (err) {
        return fail(err);
      }
    },
    [handleNextAction, handleNextActionForSetup, runSheet, token],
  );

  const simple = useCallback(
    async (fn: (t: string) => Promise<unknown>): Promise<StepResult> => {
      try {
        await fn(await token());
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [token],
  );

  return {
    pay,
    card,
    approve,
    declineExtra: (q: Quote, extraId: string) =>
      simple((t) => api.declineQuoteExtra(t, q.id, extraId)),
    declineQuote: (q: Quote) => simple((t) => api.declineQuote(t, q.id)),
    confirm: (q: Quote) => simple((t) => api.confirmQuoteJob(t, q.id)),
    report: (q: Quote, reason: string, photos: string[]) =>
      simple((t) => api.reportQuoteJob(t, q.id, reason, photos)),
  };
}

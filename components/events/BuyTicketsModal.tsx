import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useStripePayment } from "@/hooks/useStripePayment";
import api from "@/services/api";
import { EVENT_CREAM, EVENT_GOLD, EVENT_GREEN, EVENT_GREEN_TEXT } from "@/components/events/eventColors";
import { GENERIC_ERROR, eventErrorCopy, maxQty, minQty, money, refundLine, type PublicEvent, type PublicTicketType } from "@/utils/eventsLogic";
import {
  POLL_EVERY_MS,
  checkoutKeyAfterError,
  checkoutKeyNext,
  checkoutResponseKind,
  holdClock,
  holdMsLeft,
  paidSummary,
  pollDecision,
  quoteLines,
  resultCopy,
  sheetOutcome,
  type BuyResult,
  type CheckoutStart,
} from "@/utils/ticketCheckoutLogic";

type Step = "choose" | "starting" | "pay" | "confirming" | BuyResult;

interface Props {
  visible: boolean;
  event: PublicEvent;
  types: PublicTicketType[];
  /** Type picked when the sheet opens (a paid row tapped on the event page), else the first one on sale. */
  initialTypeId: string | null;
  onClose: () => void;
  /** The order is paid (or may be): the event page reloads to show "You're going". */
  onPaid: () => void;
  onViewTickets: () => void;
  onNeedSignIn: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Buy paid tickets (Events canvas 25 choose, 26 pay, 27 result). One ticket type per order, card only
 * through the shared Stripe payment sheet. Unpaid holds are released by the backend job after they expire.
 */
export default function BuyTicketsModal({ visible, event, types, initialTypeId, onClose, onPaid, onViewTickets, onNeedSignIn }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

  const paidTypes = useMemo(() => types.filter((t) => t.priceCents > 0), [types]);
  const firstOnSale = paidTypes.find((t) => t.salesStatus === "on_sale")?.id ?? null;

  const [step, setStep] = useState<Step>("choose");
  const [pickedId, setPickedId] = useState<string | null>(initialTypeId ?? firstOnSale);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const [checkout, setCheckout] = useState<CheckoutStart | null>(null);
  const [now, setNow] = useState(() => new Date());
  const keyRef = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Each time the sheet opens it starts on the choose step with the tapped type.
  useEffect(() => {
    if (!visible) return;
    setStep("choose");
    setMsg("");
    setPickedId(initialTypeId ?? firstOnSale);
  }, [visible, initialTypeId, firstOnSale]);

  const picked = paidTypes.find((t) => t.id === pickedId && t.salesStatus === "on_sale") ?? null;

  useEffect(() => {
    if (picked) setQty((q) => Math.min(Math.max(q, minQty(picked)), maxQty(picked)));
  }, [picked]);

  // Hold timer on the pay step.
  useEffect(() => {
    if (step !== "pay") return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const pick = (id: string) => {
    if (id === pickedId) return;
    setPickedId(id);
    setQty(1);
    keyRef.current = checkoutKeyNext(keyRef.current, "changed");
    setMsg("");
  };

  const changeQty = (next: number) => {
    setQty(next);
    keyRef.current = checkoutKeyNext(keyRef.current, "changed");
  };

  const confirm = useCallback(async (orderId: string) => {
    setStep("confirming");
    const started = Date.now();
    for (;;) {
      await sleep(POLL_EVERY_MS);
      if (!alive.current) return;
      let status: string | null = null;
      try {
        const token = await getToken();
        if (token) status = (await api.getTicketOrder(orderId, token)).status;
      } catch {
        status = null;
      }
      if (!alive.current) return;
      const d = pollDecision(status, Date.now() - started);
      if (d === "wait") continue;
      setStep(d);
      onPaid();
      return;
    }
  }, [getToken, onPaid]);

  const start = async () => {
    if (!picked || step === "starting") return;
    setMsg("");
    setStep("starting");
    keyRef.current = checkoutKeyNext(keyRef.current, "attempt");
    let res: CheckoutStart;
    try {
      const token = await getToken();
      if (!token) {
        setStep("choose");
        onNeedSignIn();
        return;
      }
      res = await api.checkoutTickets(event.id, { ticketTypeId: picked.id, quantity: qty, idempotencyKey: keyRef.current as string }, token);
    } catch (err: any) {
      if (!alive.current) return;
      keyRef.current = checkoutKeyAfterError(keyRef.current, err);
      setStep("choose");
      if (err?.status === 401) onNeedSignIn();
      else setMsg(eventErrorCopy(err));
      return;
    }
    if (!alive.current) return;
    const kind = checkoutResponseKind(res);
    if (kind === "paid") {
      keyRef.current = checkoutKeyNext(keyRef.current, "success");
      setCheckout(res);
      setStep("paid");
      onPaid();
      return;
    }
    if (kind === "error") {
      setStep("choose");
      setMsg(GENERIC_ERROR);
      return;
    }
    setCheckout(res);
    setStep("pay");

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: res.clientSecret as string,
      merchantDisplayName: "Outsyde",
      allowsDelayedPaymentMethods: false,
    });
    if (!alive.current) return;
    if (initError) {
      setStep("choose");
      setMsg(initError.message || GENERIC_ERROR);
      return;
    }
    const msLeft = holdMsLeft(res.holdExpiresAt, new Date());
    if (msLeft <= 0) {
      keyRef.current = checkoutKeyNext(keyRef.current, "closed");
      setStep("expired");
      return;
    }
    const { error } = await presentPaymentSheet({ timeout: Math.max(1, Math.floor(msLeft)) });
    if (!alive.current) return;
    const outcome = sheetOutcome(error as any);
    if (outcome === "canceled") {
      // The hold stays until it expires; Continue again reuses it (same key, same checkout).
      setStep("choose");
      return;
    }
    if (outcome === "expired") {
      keyRef.current = checkoutKeyNext(keyRef.current, "closed");
      setStep("expired");
      return;
    }
    if (outcome === "failed") {
      setStep("choose");
      setMsg((error as any)?.message || GENERIC_ERROR);
      return;
    }
    keyRef.current = checkoutKeyNext(keyRef.current, "success");
    confirm(res.orderId as string);
  };

  const close = () => {
    if (step === "starting" || step === "pay" || step === "confirming") return;
    onClose();
  };

  const quote = picked ? quoteLines(picked, qty) : null;
  const busy = step === "starting" || step === "pay";
  const resultKind: BuyResult | null = step === "paid" || step === "processing" || step === "expired" ? step : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      {resultKind ? (
        <View style={[styles.result, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          {(() => {
            const copy = resultCopy(resultKind, checkout?.order?.ticketCount ?? qty);
            const icon = resultKind === "paid" ? "check" : resultKind === "processing" ? "clock" : "alert-circle";
            const iconBg = resultKind === "paid" ? EVENT_GREEN : resultKind === "processing" ? "#2E2A1E" : theme.card;
            const iconFg = resultKind === "paid" ? EVENT_GREEN_TEXT : resultKind === "processing" ? "#F5D26B" : theme.text;
            const total = checkout?.order?.totalCents ?? checkout?.totalCents ?? null;
            return (
              <>
                <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
                  <Feather name={icon as any} size={38} color={iconFg} />
                </View>
                <ThemedText style={[styles.resultTitle, { color: theme.text }]} accessibilityRole="header">{copy.title}</ThemedText>
                <ThemedText style={[styles.resultBody, { color: theme.textSecondary }]}>{copy.body}</ThemedText>
                {resultKind === "paid" ? (
                  <View style={styles.paidCard}>
                    <ThemedText style={styles.paidTitle} numberOfLines={2}>{event.title}</ThemedText>
                    <ThemedText style={styles.paidLine}>{paidSummary(event, checkout?.order?.ticketCount ?? qty, total)}</ThemedText>
                  </View>
                ) : null}
                <Pressable
                  onPress={resultKind === "expired" ? () => setStep("choose") : onViewTickets}
                  accessibilityRole="button"
                  style={[styles.cta, styles.ctaWide, { backgroundColor: EVENT_GOLD }]}
                >
                  <ThemedText style={styles.ctaText}>{copy.primary}</ThemedText>
                </Pressable>
                <Pressable onPress={onClose} accessibilityRole="button" style={styles.textBtn}>
                  <ThemedText style={[styles.textBtnLabel, { color: theme.textSecondary }]}>Back to the event</ThemedText>
                </Pressable>
              </>
            );
          })()}
        </View>
      ) : step === "confirming" ? (
        <View style={[styles.result, { backgroundColor: theme.backgroundRoot }]}>
          <ActivityIndicator size="large" color={EVENT_GOLD} />
          <ThemedText style={[styles.resultBody, { color: theme.textSecondary }]}>Confirming your payment</ThemedText>
        </View>
      ) : step === "pay" && checkout ? (
        <View style={[styles.result, { backgroundColor: theme.backgroundRoot, justifyContent: "flex-start", alignItems: "stretch", paddingTop: insets.top + 40 }]}>
          <ThemedText style={[styles.sheetTitle, { color: theme.text }]}>{event.title}</ThemedText>
          <View style={styles.hold} accessibilityLiveRegion="polite">
            <Feather name="clock" size={16} color="#F5D26B" />
            <ThemedText style={styles.holdText}>Your tickets are held for {holdClock(holdMsLeft(checkout.holdExpiresAt, now))}</ThemedText>
          </View>
          <View style={styles.lines}>
            <View style={styles.lineRow}>
              <ThemedText style={[styles.lineText, { color: theme.text }]}>{quote?.line}</ThemedText>
              <ThemedText style={[styles.lineText, { color: theme.text }]}>{money(checkout.subtotalCents ?? 0)}</ThemedText>
            </View>
            <View style={styles.lineRow}>
              <ThemedText style={[styles.lineText, { color: theme.textSecondary }]}>Service fee</ThemedText>
              <ThemedText style={[styles.lineText, { color: theme.textSecondary }]}>{money(checkout.serviceFeeCents ?? 0)}</ThemedText>
            </View>
            <View style={[styles.lineRow, styles.totalRow, { borderTopColor: theme.border }]}>
              <ThemedText style={[styles.totalText, { color: theme.text }]}>Total</ThemedText>
              <ThemedText style={[styles.totalText, { color: theme.text }]}>{money(checkout.totalCents ?? 0)}</ThemedText>
            </View>
          </View>
          <ActivityIndicator color={EVENT_GOLD} style={{ marginTop: 24 }} />
        </View>
      ) : (
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
          <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText style={[styles.sheetTitle, { color: theme.text }]} accessibilityRole="header">Choose tickets</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>One ticket type per order</ThemedText>
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={[styles.closeBtn, { backgroundColor: theme.backgroundRoot }]}>
                <Feather name="x" size={18} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 10 }}>
              {paidTypes.map((t) => {
                const onSale = t.salesStatus === "on_sale";
                const on = onSale && t.id === pickedId;
                const each = t.buyerTotalCents != null ? `${money(t.priceCents)} each, ${money(t.buyerTotalCents)} with service fee` : `${money(t.priceCents)} each`;
                const left = typeof t.remaining === "number" && t.remaining <= 10 ? `, ${t.remaining} left` : "";
                return (
                  <View key={t.id} style={[styles.type, { borderColor: on ? EVENT_GOLD : theme.border, opacity: onSale ? 1 : 0.5 }]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <ThemedText style={[styles.typeName, { color: theme.text }]}>{t.name}</ThemedText>
                      <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{onSale ? `${each}${left}` : t.salesStatus === "sold_out" ? "Sold out" : "Not on sale"}</ThemedText>
                    </View>
                    {on ? (
                      <View style={styles.qtyCtl}>
                        <Pressable
                          onPress={() => changeQty(qty - 1)}
                          disabled={busy || qty <= minQty(t)}
                          accessibilityRole="button"
                          accessibilityLabel="One less"
                          style={[styles.qtyBtn, { borderColor: theme.border, opacity: qty <= minQty(t) ? 0.4 : 1 }]}
                        >
                          <Feather name="minus" size={18} color={theme.text} />
                        </Pressable>
                        <ThemedText style={[styles.qtyValue, { color: theme.text }]} accessibilityLabel={`${qty} tickets`}>{qty}</ThemedText>
                        <Pressable
                          onPress={() => changeQty(qty + 1)}
                          disabled={busy || qty >= maxQty(t)}
                          accessibilityRole="button"
                          accessibilityLabel="One more"
                          style={[styles.qtyBtn, { backgroundColor: EVENT_GOLD, borderColor: EVENT_GOLD, opacity: qty >= maxQty(t) ? 0.4 : 1 }]}
                        >
                          <Feather name="plus" size={18} color="#0B0B0B" />
                        </Pressable>
                      </View>
                    ) : onSale ? (
                      <Pressable onPress={() => pick(t.id)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Choose ${t.name}`} style={[styles.choose, { borderColor: theme.textSecondary }]}>
                        <ThemedText style={[styles.chooseText, { color: theme.text }]}>Choose</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            {quote ? (
              <View style={styles.lines}>
                <View style={styles.lineRow}>
                  <ThemedText style={[styles.lineText, { color: theme.text }]}>{quote.line}</ThemedText>
                  <ThemedText style={[styles.lineText, { color: theme.text }]}>{money(quote.subtotalCents)}</ThemedText>
                </View>
                <View style={styles.lineRow}>
                  <ThemedText style={[styles.lineText, { color: theme.textSecondary }]}>Service fee</ThemedText>
                  <ThemedText style={[styles.lineText, { color: theme.textSecondary }]}>{money(quote.feeCents)}</ThemedText>
                </View>
                <View style={[styles.lineRow, styles.totalRow, { borderTopColor: theme.border }]}>
                  <ThemedText style={[styles.totalText, { color: theme.text }]}>Total</ThemedText>
                  <ThemedText style={[styles.totalText, { color: theme.text }]}>{money(quote.totalCents)}</ThemedText>
                </View>
              </View>
            ) : null}
            <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{`${refundLine(event)} The service fee isn't refundable.`}</ThemedText>

            {msg ? <ThemedText style={[styles.error, { color: theme.error }]} accessibilityRole="alert">{msg}</ThemedText> : null}

            <Pressable
              onPress={start}
              disabled={!picked || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !picked || busy, busy }}
              style={[styles.cta, styles.ctaWide, { backgroundColor: picked ? EVENT_GOLD : theme.border, opacity: busy ? 0.7 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#0B0B0B" /> : <ThemedText style={[styles.ctaText, !picked && { color: theme.textSecondary }]}>Continue to payment</ThemedText>}
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center" },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  small: { fontSize: 12, lineHeight: 17 },
  type: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  typeName: { fontSize: 15, fontWeight: "600" },
  qtyCtl: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontSize: 16, fontWeight: "700", minWidth: 18, textAlign: "center" },
  choose: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chooseText: { fontSize: 13, fontWeight: "600" },
  lines: { gap: 8, paddingTop: 4 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  lineText: { fontSize: 14 },
  totalRow: { borderTopWidth: 1, paddingTop: 8 },
  totalText: { fontSize: 17, fontWeight: "800" },
  error: { fontSize: 14 },
  cta: { minHeight: 54, paddingHorizontal: 24, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  ctaWide: { alignSelf: "stretch" },
  ctaText: { color: "#0B0B0B", fontSize: 16, fontWeight: "700", textAlign: "center" },
  result: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 14 },
  resultIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 28, fontWeight: "800", textAlign: "center", lineHeight: 34 },
  resultBody: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  paidCard: { alignSelf: "stretch", backgroundColor: "#10241F", borderColor: EVENT_GREEN, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  paidTitle: { color: EVENT_CREAM, fontSize: 15, fontWeight: "700" },
  paidLine: { color: EVENT_GREEN_TEXT, fontSize: 13 },
  textBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  textBtnLabel: { fontSize: 14, fontWeight: "600" },
  hold: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2E2A1E", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 12 },
  holdText: { color: "#F5D26B", fontSize: 13 },
});

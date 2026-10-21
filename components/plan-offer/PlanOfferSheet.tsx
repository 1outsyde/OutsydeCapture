// Hidden plan offer popup (canvas artboards Main, FreeOffer, FreeLive; goutsyde.com OfferPrompt does the same).
//   · offer:   Grandfathered → "Accept plan" opens goutsyde.com /plan-offer signed in (paid plans are never
//              bought in the app). Free → "Claim free plan" claims right here.
//   · warning: a free offer that replaces a paid plan (outcome replace_paid_with_free) never claims in one
//              tap: this screen says the paid plan ends first.
//   · done:    "Your free plan is active", with the Stripe payouts step when payouts aren't set up.
// Every screen has an X. Closing the offer screen never loses the offer: the banner keeps it one tap away.

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  acceptErrorAction,
  freeDoneText,
  freeWarningCopy,
  planOfferWebUrl,
  popupCopy,
  warningTapAllowed,
  type PlanOffer,
} from "@/utils/planOffer";
import * as store from "@/utils/planOfferStore";

const C = {
  black: "#000000",
  cream: "#F5F0E6",
  creamLine: "#E2D9C6",
  grip: "#CFC6B4",
  ink: "#111111",
  body: "#3A3A3A",
  muted: "#555555",
  fine: "#5A5A5A",
  gold: "#E8B930",
  emerald: "#1A3C34",
  darkCard: "#111111",
  darkLine: "#2A2A2A",
  darkBorder: "#3A3A3A",
  sand: "#CFC6B4",
  error: "#B42318",
};

type Mode = "offer" | "warning";

interface Props {
  offer: PlanOffer;
  visible: boolean;
  /** Set once the free plan is claimed: the sheet shows "Your free plan is active" (state lives in the store). */
  done: { payoutsReady: boolean } | null;
  /** X or Not now on the offer or warning screen: the banner takes over. */
  onDismiss: () => void;
  /** The free plan was claimed (payoutsReady false = show the Stripe payouts step). */
  onClaimed: (payoutsReady: boolean) => void;
  /** The offer was withdrawn, accepted elsewhere or isn't theirs any more. */
  onGone: () => void;
  /** The vendor closed the done screen. */
  onFinished: () => void;
  /** "Set up payouts" on the done screen. */
  onSetUpPayouts: () => void;
}

const SIGN_IN_AGAIN = "Please sign in again and retry.";
const TRY_AGAIN = "Something went wrong. Please try again in a moment.";

export default function PlanOfferSheet({
  offer,
  visible,
  done,
  onDismiss,
  onClaimed,
  onGone,
  onFinished,
  onSetUpPayouts,
}: Props) {
  const insets = useSafeAreaInsets();
  const { getToken, refreshUser } = useAuth();
  const [mode, setMode] = useState<Mode>("offer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const warningShownAtRef = useRef<number | null>(null);
  const payoutsReady = done?.payoutsReady ?? true;

  // Opening (or a different offer) always starts on the offer screen.
  useEffect(() => {
    if (visible) {
      setMode("offer");
      setError("");
      warningShownAtRef.current = null;
    }
  }, [visible, offer.id]);

  const copy = popupCopy(offer);
  const warning = freeWarningCopy(offer);

  function showWarning() {
    setError("");
    warningShownAtRef.current = Date.now();
    setMode("warning");
  }

  async function claimFree(fromWarning: boolean) {
    if (busyRef.current) return;
    // The warning's button sits where "Review and claim" was: a double tap must not claim unseen.
    if (
      fromWarning &&
      !warningTapAllowed(warningShownAtRef.current, Date.now())
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) {
        setError(SIGN_IN_AGAIN);
        return;
      }
      if (!fromWarning) {
        // One tap only while it still can't end a paid plan: the vendor may have subscribed since we last checked.
        const fresh = await api.getPlanOffer(token).catch(() => undefined);
        if (fresh === undefined) {
          setError(TRY_AGAIN);
          return;
        }
        if (!fresh || fresh.id !== offer.id) {
          onGone();
          return;
        }
        if (fresh.outcome === "replace_paid_with_free") {
          store.setOffer(fresh);
          showWarning();
          return;
        }
      }
      const res = await api.acceptPlanOffer(token, offer.id);
      if (res.ok) {
        // Payouts step only when we know payouts aren't set up (a failed check hides it, fail quiet).
        const sub = await api.getCurrentSubscription(token).catch(() => null);
        onClaimed(sub?.subscription?.connectReady === false ? false : true);
        refreshUser().catch(() => {});
        return;
      }
      if (acceptErrorAction(res.status, res.code) === "gone") {
        onGone();
        return;
      }
      setError(res.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function openWeb() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      // Check again the moment the vendor is back, so a paid offer doesn't linger as "waiting".
      store.recheckOnReturn();
      await Linking.openURL(planOfferWebUrl(token));
      onDismiss();
    } catch {
      setError("We couldn't open goutsyde.com. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onPrimary() {
    if (mode === "warning") return claimFree(true);
    if (copy.primaryAction === "claim") return claimFree(false);
    if (copy.primaryAction === "review_free") return showWarning();
    return openWeb();
  }

  function close() {
    if (busyRef.current) return;
    if (done) onFinished();
    else onDismiss();
  }

  const isFree = offer.plan === "free";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      {done ? (
        <View
          style={[
            styles.dark,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={styles.darkTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={styles.darkX}
              hitSlop={8}
            >
              <Feather name="x" size={20} color={C.cream} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.darkContent}>
            <View style={styles.badge}>
              <Feather name="check" size={40} color={C.black} />
            </View>
            <Text accessibilityRole="header" style={styles.darkTitle}>
              Your free plan is active
            </Text>
            <Text style={styles.darkBody}>{freeDoneText(offer)}</Text>
            {!payoutsReady ? (
              <View style={styles.darkCard}>
                <Text style={styles.eyebrow}>ONE STEP LEFT</Text>
                <Text style={styles.darkCardTitle}>Set up Stripe payouts</Text>
                <Text style={styles.darkCardBody}>
                  Connect or sign in with Stripe so the money from your bookings
                  and sales is sent to you.
                </Text>
              </View>
            ) : null}
          </ScrollView>
          {!payoutsReady ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSetUpPayouts}
              style={[styles.btn, { backgroundColor: C.gold }]}
            >
              <Text style={[styles.btnText, { color: C.black }]}>
                Set up payouts
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onFinished}
            style={[styles.btnGhost, { marginTop: 10 }]}
          >
            <Text style={[styles.btnGhostText, { color: C.cream }]}>
              {payoutsReady ? "Done" : "Do this later"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close"
            onPress={close}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={styles.sheetX}
              hitSlop={8}
            >
              <Feather name="x" size={18} color={C.ink} />
            </Pressable>
            <View style={styles.grip} />
            <ScrollView contentContainerStyle={{ gap: 18 }} bounces={false}>
              {mode === "offer" ? (
                <>
                  <View
                    style={[
                      styles.tag,
                      { backgroundColor: isFree ? C.gold : C.emerald },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: isFree ? C.black : C.cream },
                      ]}
                    >
                      {copy.tag}
                    </Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text accessibilityRole="header" style={styles.title}>
                      {copy.title}
                    </Text>
                    <Text style={styles.lead}>{copy.lead}</Text>
                  </View>
                  <View style={styles.card}>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{copy.price}</Text>
                      <Text style={styles.priceNote}>{copy.priceNote}</Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {copy.checks.map((t) => (
                        <View key={t} style={styles.check}>
                          <Feather name="check" size={18} color={C.emerald} />
                          <Text style={styles.checkText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.tag, { backgroundColor: C.gold }]}>
                    <Text style={[styles.tagText, { color: C.black }]}>
                      {copy.tag}
                    </Text>
                  </View>
                  <View style={styles.warn}>
                    <Feather name="alert-circle" size={20} color="#8A5A00" />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.warnTitle}>{warning.title}</Text>
                      <Text style={styles.warnBody}>{warning.body}</Text>
                    </View>
                  </View>
                  <View style={styles.card}>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{copy.price}</Text>
                      <Text style={styles.priceNote}>{copy.priceNote}</Text>
                    </View>
                  </View>
                </>
              )}
              {error ? (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              <View style={{ gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy, disabled: busy }}
                  disabled={busy}
                  onPress={onPrimary}
                  style={[
                    styles.btn,
                    { backgroundColor: C.black, opacity: busy ? 0.7 : 1 },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={C.gold} />
                  ) : (
                    <Text style={[styles.btnText, { color: C.gold }]}>
                      {mode === "warning" ? warning.primary : copy.primary}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={close}
                  style={styles.btnPlain}
                >
                  <Text style={styles.btnPlainText}>Not now</Text>
                </Pressable>
              </View>
              <Text style={styles.fine}>
                {mode === "warning" ? warning.fine : copy.fine}
              </Text>
            </ScrollView>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 24,
    maxHeight: "92%",
  },
  sheetX: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.creamLine,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  grip: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.grip,
    marginBottom: 18,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  title: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "800",
    color: C.ink,
    textTransform: "uppercase",
    paddingRight: 40,
  },
  lead: { fontSize: 16, lineHeight: 23, color: C.body },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.creamLine,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  price: { fontSize: 34, fontWeight: "800", color: C.ink },
  priceNote: { fontSize: 15, color: C.muted },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { fontSize: 15, color: C.ink, flex: 1 },
  warn: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FBE7C6",
    borderRadius: 14,
    padding: 14,
  },
  warnTitle: { fontSize: 15, fontWeight: "700", color: "#7A4A00" },
  warnBody: { fontSize: 14, lineHeight: 20, color: "#5C3A00" },
  error: { color: C.error, fontSize: 14, textAlign: "center" },
  btn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 17, fontWeight: "700" },
  btnPlain: {
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPlainText: { fontSize: 16, fontWeight: "600", color: C.body },
  fine: { textAlign: "center", fontSize: 13, color: C.fine, marginBottom: 4 },
  dark: { flex: 1, backgroundColor: C.black, paddingHorizontal: 24 },
  darkTop: { flexDirection: "row", justifyContent: "flex-end" },
  darkX: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  darkContent: { gap: 24, paddingTop: 8 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  darkTitle: {
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "800",
    color: C.cream,
    textTransform: "uppercase",
  },
  darkBody: { fontSize: 16, lineHeight: 24, color: C.sand, marginTop: -12 },
  darkCard: {
    backgroundColor: C.darkCard,
    borderWidth: 1,
    borderColor: C.darkLine,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: C.gold,
  },
  darkCardTitle: { fontSize: 16, fontWeight: "600", color: C.cream },
  darkCardBody: { fontSize: 14, lineHeight: 21, color: C.sand },
  btnGhost: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.darkBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { fontSize: 16, fontWeight: "600" },
});

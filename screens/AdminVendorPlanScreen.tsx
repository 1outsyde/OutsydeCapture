// Admin: one business's plan (App Admin Step 6). Same actions, routes and bodies as goutsyde.com
// /admin/vendors (OfferCell + FreePlanPanel):
//  - Offer plan: Grandfathered, or Free with an end date or no end date. Emails, pushes and notifies
//    the owner. One pending offer at a time; Withdraw closes it and any open checkout.
//  - Give / Extend free plan, Revoke free plan (their storefront goes offline).
// End dates are the end of that day in New York (utils/adminPlans.ts).
import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import {
  adminErrorMessage,
  adminOfferText,
  errorHint,
  etDatePlusDays,
  etDatePlusMonths,
  etEndOfDayIso,
  formatEtDate,
  isAfterEtToday,
  parseTypedDate,
  planLabel,
  type AdminOfferSummary,
  type AdminSubscriptionSummary,
} from "@/utils/adminPlans";

type RouteType = RouteProp<RootStackParamList, "AdminVendorPlan">;

type EndChoice = "30d" | "90d" | "6m" | "1y" | "none" | "date";
const END_CHOICES: { key: EndChoice; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "1y", label: "1 year" },
  { key: "none", label: "No end date" },
  { key: "date", label: "Pick a date" },
];

/** The chosen end: permanent, a New York date (YYYY-MM-DD), or an error to show. */
function resolveEnd(choice: EndChoice, typed: string): { permanent: true } | { date: string } | { error: string } {
  if (choice === "none") return { permanent: true };
  const date =
    choice === "30d" ? etDatePlusDays(30)
    : choice === "90d" ? etDatePlusDays(90)
    : choice === "6m" ? etDatePlusMonths(6)
    : choice === "1y" ? etDatePlusMonths(12)
    : parseTypedDate(typed);
  if (!date) return { error: "Type the date like 12/31/2026." };
  if (!isAfterEtToday(date)) return { error: "Pick a date after today." };
  return { date };
}

const endPhrase = (end: { permanent: true } | { date: string }) =>
  "permanent" in end ? "with no end date" : `until the end of ${formatEtDate(etEndOfDayIso(end.date))}, New York time`;

export default function AdminVendorPlanScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { business } = useRoute<RouteType>().params;
  const { getToken } = useAuth();

  const C = useMemo(() => ({
    bg: theme.brandBg,
    card: theme.brandBgElevated,
    border: theme.brandSurfaceBorder,
    text: theme.brandCream,
    dim: theme.brandCream + "B3",
    gold: theme.brandGold,
    goldText: isDark ? theme.brandGold : theme.brandGoldDim,
    onGold: isDark ? theme.brandBg : theme.brandCream,
    primary: theme.brandPrimary,
    primaryText: theme.brandPrimaryText,
    pending: theme.brandPending,
    error: theme.brandError,
    success: theme.brandSuccess,
  }), [theme, isDark]);

  // Local copies, updated from each response (the dashboard list reloads on return).
  const [subscription, setSubscription] = useState<AdminSubscriptionSummary | null>(business.subscription ?? null);
  const [offer, setOffer] = useState<AdminOfferSummary | null>(business.planOffer ?? null);
  const [busy, setBusy] = useState<null | "offer" | "withdraw" | "give" | "revoke">(null);
  const lock = useRef(false);

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPlan, setOfferPlan] = useState<"grandfathered" | "free">("grandfathered");
  const [offerEnd, setOfferEnd] = useState<EndChoice>("90d");
  const [offerTyped, setOfferTyped] = useState("");
  const [giveEnd, setGiveEnd] = useState<EndChoice>("90d");
  const [giveTyped, setGiveTyped] = useState("");

  const label = planLabel({ subscription, hasConnectAccount: business.hasConnectAccount, stripeOnboardingComplete: business.stripeOnboardingComplete });
  const offerState = adminOfferText(offer);
  const hasPendingOffer = offer?.status === "pending";
  const owner = business.ownerName || business.ownerEmail || "the owner";

  const run = async (kind: NonNullable<typeof busy>, fn: (token: string) => Promise<void>, fallback: string) => {
    if (lock.current) return;
    lock.current = true;
    const token = await getToken();
    if (!token) {
      lock.current = false;
      Alert.alert("Signed out", "Sign in again, then reopen this business.");
      return;
    }
    setBusy(kind);
    try {
      await fn(token);
    } catch (err: any) {
      if (kind === "withdraw" && err?.status === 404) {
        Alert.alert("Offer already closed", "There is no pending offer anymore. Go back to refresh the list.");
        setOffer((o) => (o && o.status === "pending" ? null : o));
      } else {
        const message = adminErrorMessage(err, fallback);
        const hint = errorHint(message);
        Alert.alert("Couldn't save", hint ? `${message}\n\n${hint}` : message);
      }
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const sendOffer = () => {
    let body: Parameters<typeof api.offerPlan>[2];
    let what: string;
    if (offerPlan === "grandfathered") {
      body = { plan: "grandfathered" };
      what = "the Grandfathered plan (the founding price, monthly)";
    } else {
      const end = resolveEnd(offerEnd, offerTyped);
      if ("error" in end) return Alert.alert("Check the end date", end.error);
      body = "permanent" in end ? { plan: "free", permanent: true } : { plan: "free", expiresAt: etEndOfDayIso(end.date) };
      what = `the Free plan ${endPhrase(end)}`;
    }
    Alert.alert("Send this offer?", `${business.name} gets an email, a push and an in-app notice offering ${what}. Nothing changes until ${owner} accepts.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send offer",
        onPress: () =>
          run("offer", async (token) => {
            const res = await api.offerPlan(token, business.id, body);
            if (res?.offer) setOffer(res.offer);
            setOfferOpen(false);
            Alert.alert("Offer sent", res?.notified === false ? "Saved, but the notice could not be sent. They'll still see it in the app." : "They'll see it in the app and by email.");
          }, "Could not send the offer."),
      },
    ]);
  };

  const withdraw = () =>
    Alert.alert("Withdraw this offer?", "An open checkout is closed too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () =>
          run("withdraw", async (token) => {
            const res = await api.withdrawPlanOffer(token, business.id);
            setOffer(res?.offer ?? null);
          }, "Could not withdraw the offer."),
      },
    ]);

  const give = () => {
    const end = resolveEnd(giveEnd, giveTyped);
    if ("error" in end) return Alert.alert("Check the end date", end.error);
    const body = "permanent" in end ? ({ permanent: true } as const) : { expiresAt: etEndOfDayIso(end.date) };
    Alert.alert(label.activeFree ? "Extend the free plan?" : "Give a free plan?", `${business.name} is on the Free plan ${endPhrase(end)}. This takes effect right away.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: label.activeFree ? "Extend" : "Give free plan",
        onPress: () =>
          run("give", async (token) => {
            const res = await api.grantFreePlan(token, business.id, body);
            if (res?.subscription) setSubscription(res.subscription);
            Alert.alert("Free plan saved", res?.connectReady === false ? "Needs Stripe Connect before they can get paid." : "Their plan is updated.");
          }, "Could not save the free plan."),
      },
    ]);
  };

  const revoke = () =>
    Alert.alert("Revoke the free plan now?", "Their storefront will go offline.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () =>
          run("revoke", async (token) => {
            const res = await api.revokeFreePlan(token, business.id);
            if (res?.subscription) setSubscription(res.subscription);
          }, "Could not revoke the free plan."),
      },
    ]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: insets.bottom + 40, gap: 16 },
    header: { gap: 4 },
    name: { fontSize: 22, fontWeight: "700", color: C.text },
    sub: { fontSize: 14, color: C.dim },
    card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, gap: 10 },
    heading: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.dim },
    big: { fontSize: 17, fontWeight: "600", color: C.text },
    line: { fontSize: 14, color: C.dim, lineHeight: 20 },
    tag: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: C.pending + "26" },
    tagText: { fontSize: 12, fontWeight: "700", color: C.pending },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
    chipOn: { borderColor: C.gold, backgroundColor: C.gold + "1F" },
    chipText: { fontSize: 14, color: C.dim, fontWeight: "500" },
    chipTextOn: { color: C.goldText, fontWeight: "700" },
    option: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 2, backgroundColor: C.bg },
    optionOn: { borderColor: C.gold, backgroundColor: C.gold + "14" },
    optionTitle: { fontSize: 15, fontWeight: "600", color: C.text },
    optionSub: { fontSize: 13, color: C.dim },
    input: { minHeight: 44, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: C.text },
    btn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 },
    btnGold: { backgroundColor: C.gold },
    btnGoldText: { color: C.onGold, fontSize: 15, fontWeight: "700" },
    btnOutline: { borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
    btnOutlineText: { color: C.text, fontSize: 15, fontWeight: "600" },
    btnDanger: { borderWidth: 1, borderColor: C.error, backgroundColor: C.error + "1F" },
    btnDangerText: { color: C.error, fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });

  // A render function, not a component: a component declared here would remount every render and
  // drop the keyboard focus from the typed date.
  const renderEndPicker = ({ value, onChange, typed, onTyped, idPrefix }: { value: EndChoice; onChange: (v: EndChoice) => void; typed: string; onTyped: (s: string) => void; idPrefix: string }) => (
    <View style={{ gap: 8 }}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {END_CHOICES.map((c) => {
          const on = value === c.key;
          return (
            <Pressable
              key={`${idPrefix}-${c.key}`}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => onChange(c.key)}
              disabled={!!busy}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value === "date" ? (
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={onTyped}
          placeholder="12/31/2026"
          placeholderTextColor={C.dim}
          keyboardType="numbers-and-punctuation"
          editable={!busy}
          accessibilityLabel="End date, month day year"
        />
      ) : null}
      <Text style={styles.line}>Ends at the end of that day, New York time.</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.name}>{business.name}</Text>
        {business.ownerName || business.ownerEmail ? <Text style={styles.sub}>Owner: {business.ownerName || business.ownerEmail}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Current plan</Text>
        <Text style={styles.big}>{label.text ?? "No plan"}</Text>
        {label.needsStripeConnect ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>Needs Stripe Connect</Text>
          </View>
        ) : null}
        {label.kind === "paid" ? <Text style={styles.line}>Paid plans are managed by the owner on goutsyde.com.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Plan offer</Text>
        <Text style={styles.line}>{offerState.text}</Text>
        {hasPendingOffer ? (
          <Pressable style={[styles.btn, styles.btnOutline, busy && styles.disabled]} disabled={!!busy} onPress={withdraw} accessibilityRole="button">
            {busy === "withdraw" ? <ActivityIndicator color={C.text} /> : <Text style={styles.btnOutlineText}>Withdraw offer</Text>}
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.btn, styles.btnOutline, busy && styles.disabled]}
              disabled={!!busy}
              onPress={() => setOfferOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: offerOpen }}
            >
              <Feather name="send" size={16} color={C.text} />
              <Text style={styles.btnOutlineText}>Offer plan</Text>
            </Pressable>
            {offerOpen ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.heading}>Which plan?</Text>
                <Pressable style={[styles.option, offerPlan === "grandfathered" && styles.optionOn]} onPress={() => setOfferPlan("grandfathered")} accessibilityRole="radio" accessibilityState={{ checked: offerPlan === "grandfathered" }}>
                  <Text style={styles.optionTitle}>Grandfathered</Text>
                  <Text style={styles.optionSub}>The founding price, monthly. They add a card if none is saved.</Text>
                </Pressable>
                <Pressable style={[styles.option, offerPlan === "free" && styles.optionOn]} onPress={() => setOfferPlan("free")} accessibilityRole="radio" accessibilityState={{ checked: offerPlan === "free" }}>
                  <Text style={styles.optionTitle}>Free plan</Text>
                  <Text style={styles.optionSub}>No charge. Pick an end date or make it permanent.</Text>
                </Pressable>
                {offerPlan === "free" ? (
                  renderEndPicker({ idPrefix: "offer", value: offerEnd, onChange: setOfferEnd, typed: offerTyped, onTyped: setOfferTyped })
                ) : null}
                <Pressable style={[styles.btn, styles.btnGold, busy && styles.disabled]} disabled={!!busy} onPress={sendOffer} accessibilityRole="button">
                  {busy === "offer" ? <ActivityIndicator color={C.onGold} /> : <Text style={styles.btnGoldText}>Send offer</Text>}
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{label.activeFree ? "Extend free plan" : "Give free plan"}</Text>
        <Text style={styles.line}>Takes effect right away, no offer to accept.</Text>
        {renderEndPicker({ idPrefix: "give", value: giveEnd, onChange: setGiveEnd, typed: giveTyped, onTyped: setGiveTyped })}
        <Pressable style={[styles.btn, styles.btnGold, busy && styles.disabled]} disabled={!!busy} onPress={give} accessibilityRole="button">
          {busy === "give" ? <ActivityIndicator color={C.onGold} /> : <Text style={styles.btnGoldText}>{label.activeFree ? "Extend" : "Give free plan"}</Text>}
        </Pressable>
        {label.activeFree ? (
          <Pressable style={[styles.btn, styles.btnDanger, busy && styles.disabled]} disabled={!!busy} onPress={revoke} accessibilityRole="button">
            {busy === "revoke" ? <ActivityIndicator color={C.error} /> : <Text style={styles.btnDangerText}>Revoke free plan</Text>}
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

// Admin: decide one pending refund request or quote report (App Admin Step 5).
// Same routes, body and rules as goutsyde.com app/admin/refunds/page.tsx:
//  - Quote report: Pay vendor in full (sent as rejected), Partial refund or Full refund (sent as
//    approved), each with the outcome; partial adds amountCents (more than $0, under the held amount).
//  - Legacy request: Approve (refunds `amount`) or Reject with an optional note.
// Money moves on the server, so a decision is sent once per tap, buttons lock while it is in flight,
// and nothing retries on its own. Error handling copies the web: 402 Stripe declined (nothing moved),
// 400 already processed, 500 the refund may already have been issued, no response = status unknown.
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { type AdminRefundDecision, type AdminReportOutcome } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

type RouteType = RouteProp<RootStackParamList, "AdminRefundRequest">;

/** cents → "$12.50" */
export function formatCents(cents: number): string {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

/** "shoot_booking" → "Shoot Booking" */
function formatTargetType(targetType: string): string {
  if (!targetType) return "Unknown";
  return targetType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Partial refund amount as typed (dollars) → cents, with the web's rules. Returns an error message
 * instead when the amount is not allowed.
 */
export function parsePartialRefund(typed: string, maxRefundCents: number): { cents: number } | { error: string } {
  const s = typed.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { error: "Enter the amount in dollars and cents, like 50.25." };
  const cents = Math.round(Number(s) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return { error: "Enter the amount to refund, more than $0." };
  if (cents >= maxRefundCents) {
    return { error: `That is everything the customer paid (${formatCents(maxRefundCents)}). Choose Full refund instead.` };
  }
  return { cents };
}

export default function AdminRefundRequestScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { request } = useRoute<RouteType>().params;
  const { getToken } = useAuth();

  const C = useMemo(() => ({
    bg: theme.brandBg,
    card: theme.brandBgElevated,
    border: theme.brandSurfaceBorder,
    text: theme.brandCream,
    dim: theme.brandCream + "B3",
    gold: theme.brandGold,
    goldText: isDark ? theme.brandGold : theme.brandGoldDim,
    primary: theme.brandPrimary,
    primaryText: theme.brandPrimaryText,
    success: theme.brandSuccess,
    error: theme.brandError,
  }), [theme, isDark]);

  const [busy, setBusy] = useState(false);
  // Set synchronously, so two fast taps can never send two decisions (state updates are async).
  const sendingRef = useRef(false);
  const [done, setDone] = useState(false);
  const locked = busy || done;
  const [notes, setNotes] = useState("");
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialDollars, setPartialDollars] = useState("");

  const report = request.quoteReport;
  const requester = request.requesterName || request.requesterEmail || "Unknown person";
  const created = (() => {
    const d = new Date(request.createdAt);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();

  const send = async (decision: AdminRefundDecision, doneTitle: string, doneText: string) => {
    if (sendingRef.current) return; // one decision per tap
    sendingRef.current = true;
    const token = await getToken();
    if (!token) {
      sendingRef.current = false;
      Alert.alert("Signed out", "Sign in again, then reopen this report.");
      return;
    }
    setBusy(true);
    let decided = false;
    try {
      await api.decideAdminRefundRequest(token, request.id, decision);
      decided = true;
      setDone(true);
      Alert.alert(doneTitle, doneText, [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      const status: number | undefined = typeof err?.status === "number" ? err.status : undefined;
      const message: string = (typeof err?.message === "string" && err.message) || "";
      if (status === 402) {
        // Stripe declined. The backend returns before any write: nothing moved, still pending.
        Alert.alert("Stripe declined this refund", `No money was transferred and the request is still pending. ${message}`.trim());
      } else if (status === 400 && /already been processed/i.test(message)) {
        decided = true; // outcome may be final: keep this screen locked
        setDone(true);
        Alert.alert("Already processed", "Someone already decided this request. The list will refresh.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else if (status === 500) {
        // The refund may have gone through before a later step failed. Never retry from here.
        decided = true; // outcome may be final: keep this screen locked
        setDone(true);
        Alert.alert(
          "Check Stripe before retrying",
          "The server errored after the refund was attempted. The refund may already have been issued.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else if (status === undefined) {
        decided = true; // outcome may be final: keep this screen locked
        setDone(true);
        Alert.alert(
          "Status unknown",
          "Couldn't reach the server, so the result is unknown. Refresh the list and check before trying again.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert("Couldn't decide this request", message || `Request failed (${status}).`);
      }
    } finally {
      if (!decided) sendingRef.current = false; // stays locked after a decision went through
      setBusy(false);
    }
  };

  const decideReport = (outcome: AdminReportOutcome) => {
    if (!report) return;
    const note = notes.trim() || undefined;
    if (outcome === "partial_refund") {
      const parsed = parsePartialRefund(partialDollars, report.maxRefundCents);
      if ("error" in parsed) {
        Alert.alert("Check the amount", parsed.error);
        return;
      }
      Alert.alert(
        `Refund ${formatCents(parsed.cents)}?`,
        "The customer gets this amount back, from the balance first, then the deposit. The service fee is not refunded. The vendor is paid the rest of their share. This decision is final.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Partial refund",
            style: "destructive",
            onPress: () =>
              send({ status: "approved", outcome, amountCents: parsed.cents, ...(note ? { adminNotes: note } : {}) },
                "Partial refund sent", `${formatCents(parsed.cents)} is going back to the customer.`),
          },
        ]
      );
      return;
    }
    const isFull = outcome === "full_refund";
    Alert.alert(
      isFull ? `Full refund of ${formatCents(report.maxRefundCents)}?` : "Pay the vendor in full?",
      isFull
        ? `The customer gets back everything the business was paid, ${formatCents(report.maxRefundCents)}. The service fee is not refunded. The vendor is not paid the balance. This decision is final.`
        : "The vendor is paid their share in full. Nothing is refunded. This decision is final.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isFull ? "Full refund" : "Pay vendor in full",
          style: isFull ? "destructive" : "default",
          onPress: () =>
            send({ status: isFull ? "approved" : "rejected", outcome, ...(note ? { adminNotes: note } : {}) },
              isFull ? "Full refund sent" : "Vendor paid in full",
              isFull ? `${formatCents(report.maxRefundCents)} is going back to the customer.` : "The report is closed with no refund."),
        },
      ]
    );
  };

  const decideLegacy = (status: "approved" | "rejected") => {
    const note = notes.trim();
    Alert.alert(
      status === "approved" ? `Refund ${formatCents(request.amount)}?` : "Reject this request?",
      status === "approved"
        ? `${formatCents(request.amount)} is refunded to ${requester} through Stripe. This decision is final.`
        : "Nothing is refunded. This decision is final.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status === "approved" ? "Approve refund" : "Reject",
          style: "destructive",
          onPress: () =>
            send(
              status === "rejected" && note ? { status, adminNotes: note } : { status },
              status === "approved" ? "Refund approved" : "Request rejected",
              status === "approved" ? `${formatCents(request.amount)} is going back to ${requester}.` : "The request is closed."
            ),
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: insets.bottom + 40, gap: 16 },
    card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, gap: 6 },
    held: { backgroundColor: C.primary, borderRadius: 14, padding: 16, gap: 4 },
    heldLabel: { fontSize: 13, color: C.primaryText + "CC" },
    heldValue: { fontSize: 28, fontWeight: "700", color: isDark ? C.gold : C.primaryText, fontVariant: ["tabular-nums"] },
    kind: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.dim },
    title: { fontSize: 18, fontWeight: "700", color: C.text },
    line: { fontSize: 14, color: C.dim, lineHeight: 20 },
    reason: { fontSize: 15, color: C.text, lineHeight: 22 },
    heading: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.dim },
    photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    photo: { width: 96, height: 96, borderRadius: 10, backgroundColor: C.card },
    input: {
      minHeight: 44,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: C.text,
    },
    notesInput: { minHeight: 80, textAlignVertical: "top" },
    help: { fontSize: 13, color: C.dim },
    actions: { gap: 10 },
    btn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 },
    btnPrimary: { backgroundColor: C.primary },
    btnPrimaryText: { color: C.primaryText, fontSize: 15, fontWeight: "700" },
    btnOutline: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    btnOutlineText: { color: C.text, fontSize: 15, fontWeight: "600" },
    btnDanger: { backgroundColor: C.error + "1F", borderWidth: 1, borderColor: C.error },
    btnDangerText: { color: C.error, fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.5 },
    busyRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {report ? (
        <View style={styles.held} accessible accessibilityLabel={`Held for this report: ${formatCents(report.maxRefundCents)}`}>
          <Text style={styles.heldLabel}>Quote report, held for the vendor</Text>
          <Text style={styles.heldValue}>{formatCents(report.maxRefundCents)}</Text>
          <Text style={styles.heldLabel}>The most that can be refunded. The service fee is never refunded.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.kind}>{report ? "Quote report" : `Refund request · ${formatTargetType(request.targetType)}`}</Text>
        <Text style={styles.title}>{requester}</Text>
        {request.requesterEmail && request.requesterName ? <Text style={styles.line}>{request.requesterEmail}</Text> : null}
        {!report ? <Text style={styles.line}>Amount asked: {formatCents(request.amount)}</Text> : null}
        {created ? <Text style={styles.line}>Sent {created}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{report ? "What they reported" : "Their reason"}</Text>
        <Text style={styles.reason}>{request.reason || "No reason given."}</Text>
      </View>

      {report && report.photos.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.heading}>Photos ({report.photos.length})</Text>
          <View style={styles.photos}>
            {report.photos.map((url, i) => (
              <Pressable
                key={`${url}-${i}`}
                onPress={() => Linking.openURL(url).catch(() => Alert.alert("Couldn't open the photo"))}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Open photo ${i + 1} of ${report.photos.length}`}
              >
                <Image source={{ uri: url }} style={styles.photo} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={styles.heading}>Note</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={!locked}
          placeholder="Optional note for the record. Not sent to the customer or the vendor."
          placeholderTextColor={C.dim}
          accessibilityLabel="Optional note for the record"
        />
        {!report ? <Text style={styles.help}>A note is saved only when you reject.</Text> : null}
      </View>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={C.gold} />
          <Text style={styles.line}>{"Sending your decision. Don't close the app."}</Text>
        </View>
      ) : null}

      {report ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, locked && styles.disabled]}
            disabled={locked}
            onPress={() => decideReport("pay_full")}
            accessibilityRole="button"
          >
            <Feather name="check" size={18} color={C.primaryText} />
            <Text style={styles.btnPrimaryText}>Pay vendor in full</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnOutline, locked && styles.disabled]}
            disabled={locked}
            onPress={() => setPartialOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: partialOpen }}
          >
            <Feather name="percent" size={18} color={C.text} />
            <Text style={styles.btnOutlineText}>Partial refund</Text>
          </Pressable>
          {partialOpen ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.help}>Amount to refund, up to {formatCents(report.maxRefundCents - 1)}</Text>
              <TextInput
                style={styles.input}
                value={partialDollars}
                onChangeText={setPartialDollars}
                keyboardType="decimal-pad"
                editable={!locked}
                placeholder="50.00"
                placeholderTextColor={C.dim}
                accessibilityLabel="Partial refund amount in dollars"
              />
              <Pressable
                style={[styles.btn, styles.btnDanger, locked && styles.disabled]}
                disabled={locked}
                onPress={() => decideReport("partial_refund")}
                accessibilityRole="button"
              >
                <Text style={styles.btnDangerText}>Send partial refund</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[styles.btn, styles.btnDanger, locked && styles.disabled]}
            disabled={locked}
            onPress={() => decideReport("full_refund")}
            accessibilityRole="button"
          >
            <Feather name="rotate-ccw" size={18} color={C.error} />
            <Text style={styles.btnDangerText}>Full refund ({formatCents(report.maxRefundCents)})</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnDanger, locked && styles.disabled]}
            disabled={locked}
            onPress={() => decideLegacy("approved")}
            accessibilityRole="button"
          >
            <Feather name="rotate-ccw" size={18} color={C.error} />
            <Text style={styles.btnDangerText}>Approve refund ({formatCents(request.amount)})</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnOutline, locked && styles.disabled]}
            disabled={locked}
            onPress={() => decideLegacy("rejected")}
            accessibilityRole="button"
          >
            <Feather name="x" size={18} color={C.text} />
            <Text style={styles.btnOutlineText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// Admin: account setup emails from the app (App Admin Step 7c). Same routes, filters and wording as
// goutsyde.com /admin/emails?tab=account-setup (AccountSetupTab.tsx). Only the ticked people are sent
// (setupSendBody), and each reminder is reserved by the backend before it goes out, so a retry can't
// email anyone twice. Counts toward the same daily email budget as broadcasts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { ROLE_LABEL, pushErrorText } from "@/utils/adminPush";
import { emailBudgetLine, type EmailBudget } from "@/utils/adminEmail";
import {
  MAX_SETUP_PICKED,
  SETUP_FILTERS,
  SETUP_STEP_LABEL,
  SETUP_TEMPLATE_LABEL,
  setupName,
  setupOrdinal,
  setupSendResult,
  type DueReminder,
  type SetupEmailPreview,
  type SetupFilter,
  type SetupSendResult,
} from "@/utils/adminSetup";

export default function AdminSetupEmailsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
    pending: theme.brandPending,
    error: theme.brandError,
    success: theme.brandSuccess,
  }), [theme, isDark]);

  const [due, setDue] = useState<DueReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [budget, setBudget] = useState<EmailBudget | null>(null);
  const [filter, setFilter] = useState<SetupFilter>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SetupSendResult | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<(SetupEmailPreview & { userId: string }) | null>(null);
  const [previewErrorFor, setPreviewErrorFor] = useState<{ id: string; text: string } | null>(null);
  const sendLock = useRef(false);

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [list, b] = await Promise.all([
        api.getAdminSetupDue(token),
        api.getAdminEmailBudget(token).catch(() => null),
      ]);
      setDue(list);
      setBudget(b);
      setLoadError(null);
      // Keep only ticks that are still due.
      setPicked((prev) => new Set(Array.from(prev).filter((id) => list.some((r) => r.userId === id))));
    } catch (err: any) {
      setLoadError(pushErrorText(err, "Couldn't load who is due."));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadPreview = useCallback(async (userId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const p = await api.getAdminSetupEmailPreview(token, userId);
      setPreview({ ...p, userId });
      setPreviewErrorFor(null);
    } catch (err: any) {
      setPreviewErrorFor({
        id: userId,
        text: err?.status === 404 ? "Nothing is due for this account right now." : pushErrorText(err, "Couldn't build the preview."),
      });
    }
  }, [getToken]);

  useEffect(() => {
    if (previewFor) loadPreview(previewFor);
  }, [previewFor, loadPreview]);

  const shown = useMemo(() => {
    const match = SETUP_FILTERS.find((f) => f.key === filter)?.match ?? (() => true);
    return due.filter(match);
  }, [due, filter]);

  const toggle = (id: string) => {
    if (sending) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SETUP_PICKED) next.add(id);
      return next;
    });
  };

  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.userId));
  const toggleAllShown = () => {
    if (sending) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (allShownPicked) shown.forEach((r) => next.delete(r.userId));
      else for (const r of shown) {
        if (next.size >= MAX_SETUP_PICKED) break;
        next.add(r.userId);
      }
      return next;
    });
  };

  const pickedPush = due.filter((r) => picked.has(r.userId) && r.channels.includes("push")).length;
  const overBudget = budget?.remaining !== null && budget?.remaining !== undefined && picked.size > budget.remaining;

  const doSend = async () => {
    if (sendLock.current || picked.size === 0) return;
    sendLock.current = true;
    const token = await getToken();
    if (!token) {
      sendLock.current = false;
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const data = await api.sendAdminSetupReminders(token, picked);
      setResult(setupSendResult(data ?? {}));
      setPicked(new Set());
    } catch (err: any) {
      const noAnswer = typeof err?.status !== "number";
      Alert.alert(
        "Send didn't finish",
        noAnswer || err.status === 502
          ? "Couldn't reach the server. Some emails may have gone out, so the list was reloaded. Check it before sending again. Nobody gets the same reminder twice."
          : pushErrorText(err, "Send failed. Reload the list before trying again.")
      );
    } finally {
      sendLock.current = false;
      setSending(false);
      loadData();
    }
  };

  const confirmSend = () => {
    if (picked.size === 0) return;
    const n = picked.size;
    Alert.alert(
      `Email ${n === 1 ? "1 person" : `${n} people`}?`,
      `Each gets their due setup email now${pickedPush ? `, and ${pickedPush === 1 ? "1 also gets" : `${pickedPush} also get`} a push` : ""}. ` +
        `${budget ? `${emailBudgetLine(budget)}${budget.remaining !== null ? `, ${budget.remaining} left` : ""}. ` : ""}` +
        "Anyone no longer due is skipped.",
      [
        { text: "Cancel", style: "cancel" },
        { text: `Send ${n}`, onPress: doSend },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: insets.bottom + 120, gap: 16 },
    line: { fontSize: 14, color: C.dim, lineHeight: 20 },
    warn: { fontSize: 14, color: C.pending, lineHeight: 20 },
    err: { fontSize: 14, color: C.error, lineHeight: 20 },
    heading: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.dim },
    card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, gap: 8 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
    chipOn: { borderColor: C.gold, backgroundColor: C.gold + "1F" },
    chipText: { fontSize: 14, color: C.dim, fontWeight: "500" },
    chipTextOn: { color: C.goldText, fontWeight: "700" },
    row: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    check: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 2 },
    checkOn: { backgroundColor: C.gold, borderColor: C.gold },
    rowText: { flex: 1, minWidth: 0, gap: 3 },
    name: { fontSize: 15, fontWeight: "600", color: C.text },
    link: { fontSize: 14, fontWeight: "600", color: C.goldText },
    preview: { marginTop: 6, padding: 12, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, gap: 6 },
    previewSubject: { fontSize: 15, fontWeight: "700", color: C.text },
    previewText: { fontSize: 14, color: C.text, lineHeight: 20 },
    bar: {
      position: "absolute", left: 0, right: 0, bottom: 0,
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12,
      backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, gap: 6,
    },
    btn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.gold },
    btnText: { color: C.onGold, fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor={C.gold} />}
      >
        <View style={{ gap: 4 }}>
          <Text style={styles.line}>
            {"People who can't sign in yet get a claim email. Businesses, photographers and staff missing a plan, payouts or a username get a steps left email, and a push when they have the app."}
          </Text>
          <Text style={styles.line}>Follow ups come 3, 7 and 14 days after the first, so nobody gets the same reminder twice.</Text>
          {budget ? <Text style={styles.line}>{emailBudgetLine(budget)}{budget.remaining !== null ? `, ${budget.remaining} left` : ""}</Text> : null}
        </View>

        {result ? (
          <View style={styles.card} accessibilityLiveRegion="polite">
            <Text style={styles.heading}>Sent</Text>
            <Text style={styles.line}>
              {`${result.sent.length} sent`}
              {result.failed.length ? `, ${result.failed.length} failed` : ""}
              {result.notDue.length ? `, ${result.notDue.length} no longer due` : ""}.
            </Text>
            {result.failed.map((r) => (
              <Text key={r.userId} style={styles.err}>{setupName(r)}{r.error ? `: ${r.error}` : ""}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.chips} accessibilityRole="radiogroup">
          {SETUP_FILTERS.map((f) => {
            const on = filter === f.key;
            const count = due.filter(f.match).length;
            return (
              <Pressable key={f.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(f.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                <Text style={styles.chipText}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          {loadError ? <Text style={styles.err}>{loadError}</Text> : null}
          {loading && due.length === 0 ? <ActivityIndicator color={C.gold} /> : null}
          {!loading && !loadError && shown.length === 0 ? <Text style={styles.line}>Nobody is due right now.</Text> : null}
          {shown.length > 0 ? (
            <Pressable onPress={toggleAllShown} disabled={sending} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{allShownPicked ? "Untick all shown" : `Tick all ${shown.length} shown`}</Text>
            </Pressable>
          ) : null}
          {shown.map((r) => {
            const on = picked.has(r.userId);
            const open = previewFor === r.userId;
            return (
              <View key={r.userId} style={styles.row}>
                <Pressable
                  onPress={() => toggle(r.userId)}
                  disabled={sending}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Pick ${setupName(r)}`}
                  hitSlop={10}
                >
                  <View style={[styles.check, on && styles.checkOn]}>{on ? <Feather name="check" size={16} color={C.onGold} /> : null}</View>
                </Pressable>
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>{setupName(r)}</Text>
                  <Text style={styles.line} numberOfLines={1}>{[ROLE_LABEL[r.role] ?? r.role, r.email].join(" · ")}</Text>
                  <Text style={styles.line}>
                    {[SETUP_TEMPLATE_LABEL[r.template] ?? r.template, setupOrdinal(r.reminderNumber), r.channels.includes("push") ? "plus push" : null].filter(Boolean).join(" · ")}
                  </Text>
                  {r.steps.length > 0 ? <Text style={styles.line}>Left: {r.steps.map((s) => SETUP_STEP_LABEL[s] ?? s).join(", ")}</Text> : null}
                  <Pressable onPress={() => setPreviewFor(open ? null : r.userId)} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                    <Text style={styles.link}>{open ? "Hide email" : "Preview email"}</Text>
                  </Pressable>
                  {open ? (
                    <View style={styles.preview}>
                      {previewErrorFor?.id === r.userId ? <Text style={styles.err}>{previewErrorFor.text}</Text> : null}
                      {preview?.userId !== r.userId && previewErrorFor?.id !== r.userId ? <ActivityIndicator color={C.gold} /> : null}
                      {preview?.userId === r.userId ? (
                        <>
                          <Text style={styles.previewSubject}>{preview.subject}</Text>
                          <Text style={styles.previewText}>{preview.text}</Text>
                          {r.template === "claim" ? <Text style={styles.line}>The claim link is a placeholder here. The real email has a working link.</Text> : null}
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bar}>
        {overBudget ? <Text style={styles.warn}>{`That's more than the ${budget?.remaining} emails left today. The send will be refused.`}</Text> : null}
        <Pressable
          style={[styles.btn, (picked.size === 0 || sending) && styles.disabled]}
          onPress={confirmSend}
          disabled={picked.size === 0 || sending}
          accessibilityRole="button"
        >
          {sending ? <ActivityIndicator color={C.onGold} /> : <Text style={styles.btnText}>{picked.size ? `Send to ${picked.size}` : "Tick people to send"}</Text>}
        </Pressable>
        {sending ? <Text style={styles.line}>Sending one by one. Keep the app open.</Text> : null}
      </View>
    </View>
  );
}

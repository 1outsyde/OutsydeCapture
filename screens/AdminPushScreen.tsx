// Admin: send a push announcement from the app (App Admin Step 7a). Same routes, checks and wording as
// goutsyde.com /admin/emails?tab=push (PushTab.tsx, PushHistory.tsx). The backend enforces every rule
// (3 a day shared with the web, no repeat within 10 minutes, one send at a time, eligibility, screens
// per audience); this screen explains them. Each push carries a one-time key, so a retry after a dropped
// connection returns the same send and never sends twice.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import {
  AUDIENCE_LABEL,
  MAX_PICKED,
  POLL_MS,
  PUSH_AUDIENCES,
  ROLE_LABEL,
  STATUS_LABEL,
  countsLine,
  formatEtDateTime,
  newPushKey,
  plural,
  pushContentError,
  pushErrorText,
  pushSendBlocker,
  pushWhyNot,
  quietLine,
  type PushAudience,
  type PushCounts,
  type PushLimits,
  type PushPerson,
  type PushRecipientRow,
  type PushScreensData,
  type PushSendRow,
} from "@/utils/adminPush";

type Tab = "write" | "history";
interface SendState { id: string; status: string; recipients: number; sent: number; failed: number; skipped: number }

export default function AdminPushScreen() {
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
    primary: theme.brandPrimary,
    primaryText: theme.brandPrimaryText,
    pending: theme.brandPending,
    error: theme.brandError,
    success: theme.brandSuccess,
  }), [theme, isDark]);

  const [tab, setTab] = useState<Tab>("write");

  // ── shared data ───────────────────────────────────────────────────────────
  const [counts, setCounts] = useState<PushCounts | null>(null);
  const [screens, setScreens] = useState<PushScreensData | null>(null);
  const [limits, setLimits] = useState<PushLimits | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLimits = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setLimits(await api.getAdminPushLimits(token));
    } catch {
      /* keep the last value */
    }
  }, [getToken]);

  const loadMeta = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoadError(null);
    try {
      const [c, s, l] = await Promise.all([
        api.getAdminPushAudiences(token),
        api.getAdminPushScreens(token),
        api.getAdminPushLimits(token),
      ]);
      setCounts(c);
      setScreens(s);
      setLimits(l);
    } catch (err: any) {
      setLoadError(pushErrorText(err, "Couldn't load the push tools."));
    }
  }, [getToken]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // ── write ────────────────────────────────────────────────────────────────
  const [audience, setAudience] = useState<PushAudience | null>(null);
  const [picked, setPicked] = useState<Record<string, PushPerson>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PushPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [screen, setScreen] = useState("activity");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<null | "test" | "send">(null);
  const [send, setSend] = useState<SendState | null>(null);
  const keyRef = useRef(newPushKey());
  const sendLock = useRef(false);
  const searchSeq = useRef(0);

  /** Anything that changes what would be sent gets a new key (web "markChanged"). */
  const changed = useCallback(() => {
    keyRef.current = newPushKey();
  }, []);

  const maxTitle = screens?.maxTitle ?? 65;
  const maxBody = screens?.maxBody ?? 178;
  const pickedList = Object.values(picked);
  const searchActive = query.trim().length >= 2;
  const shownResults = searchActive ? results : [];
  const recipients = audience === "picked" ? pickedList.length : audience && counts ? counts[audience] : 0;
  const allowedScreens = screens ? screens.screens.filter((s) => (screens.byAudience[audience ?? "picked"] ?? []).includes(s.key)) : [];
  const contentError = pushContentError({ title, body, screen, url, maxTitle, maxBody });
  const blocker = pushSendBlocker({ contentError, audience, recipients, limits });
  const sendRunning = send?.status === "sending";
  const locked = busy !== null || sendRunning;

  const pickAudience = (a: PushAudience) => {
    setAudience(a);
    changed();
    if (screens && !(screens.byAudience[a] ?? []).includes(screen)) setScreen(screens.defaultScreen || "activity");
  };

  // People search (2+ characters, debounced), like the web.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      searchSeq.current++; // drop any search still in flight
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token || seq !== searchSeq.current) return;
      setSearching(true);
      try {
        const people = await api.searchAdminPushPeople(token, q);
        if (seq !== searchSeq.current) return;
        setResults(people);
        setSearchError(null);
      } catch (err: any) {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setSearchError(pushErrorText(err, "Search failed."));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, getToken]);

  const togglePerson = useCallback((p: PushPerson) => {
    if (!p.canPush) return;
    setPicked((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else if (Object.keys(next).length < MAX_PICKED) next[p.id] = p;
      return next;
    });
    changed();
  }, [changed]);

  const target = () => (screen === "link" ? { screen, url: url.trim() } : { screen });

  const sendTest = async () => {
    if (contentError || busy) return;
    const token = await getToken();
    if (!token) return;
    setBusy("test");
    try {
      const r = await api.sendAdminPushTest(token, { title: title.trim(), body: body.trim(), ...target() });
      if (r?.status !== "sent") {
        Alert.alert("Test not delivered", `Expo didn't take the test push${r?.error ? ` (${r.error})` : ""}. Open the app on your phone and try again.`);
      } else {
        Alert.alert("Test sent", "Check your phone. Tap it to see the screen it opens.");
      }
    } catch (err: any) {
      Alert.alert("Test didn't send", pushErrorText(err, "The test didn't send."));
    } finally {
      setBusy(null);
    }
  };

  const startSend = async () => {
    if (sendLock.current || blocker || !audience) return;
    sendLock.current = true;
    const token = await getToken();
    if (!token) {
      sendLock.current = false;
      return;
    }
    setBusy("send");
    try {
      const r = await api.startAdminPushSend(token, {
        audience,
        ...(audience === "picked" ? { userIds: Object.keys(picked) } : {}),
        title: title.trim(),
        body: body.trim(),
        ...target(),
        clientKey: keyRef.current,
      });
      if (!r?.sendId) throw { message: "The push didn't start.", status: 500 };
      setSend({ id: r.sendId, status: "sending", recipients: Number(r.recipients) || recipients, sent: 0, failed: 0, skipped: 0 });
      keyRef.current = newPushKey();
    } catch (err: any) {
      // The key is kept: pressing Send again for the same push returns the same send.
      const noAnswer = typeof err?.status !== "number";
      Alert.alert(
        "The push didn't start",
        noAnswer
          ? "Couldn't reach the server. Press Send again: the same push can't go out twice."
          : pushErrorText(err, "The push didn't start.")
      );
      loadLimits();
    } finally {
      sendLock.current = false;
      setBusy(null);
    }
  };

  const confirmSend = () => {
    if (blocker || !audience) return;
    const who = audience === "picked" ? plural(recipients, "person", "people") : `${AUDIENCE_LABEL[audience]} (${plural(recipients, "person", "people")})`;
    Alert.alert(
      `Send to ${who}?`,
      `${limits?.quietHours ? `${quietLine(limits.nowNewYork)}\n\n` : ""}This goes out to real accounts now and counts toward today's ${limits?.max ?? 3}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: limits?.quietHours ? "Send anyway" : `Yes, send ${recipients}`, onPress: startSend },
      ]
    );
  };

  // Follow a running send until the backend marks it done.
  const sendId = send?.id ?? null;
  useEffect(() => {
    if (!sendId || !sendRunning) return;
    let stopped = false;
    const tick = async () => {
      const token = await getToken();
      if (!token || stopped) return;
      try {
        const r = await api.getAdminPushSend(token, sendId);
        if (stopped || !r) return;
        const s = r.send;
        setSend((prev) =>
          prev && prev.id === sendId
            ? { ...prev, status: s.status, recipients: Number(s.recipientCount) || prev.recipients, sent: Number(s.sentCount) || 0, failed: Number(s.failedCount) || 0, skipped: Number(s.skippedCount) || 0 }
            : prev
        );
        if (s.status !== "sending") loadLimits();
      } catch {
        /* keep polling */
      }
    };
    const timer = setInterval(tick, POLL_MS);
    tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sendId, sendRunning, getToken, loadLimits]);

  const startOver = () => {
    setSend(null);
    setTitle("");
    setBody("");
    setUrl("");
    setPicked({});
    setQuery("");
    changed();
  };

  // ── history ──────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<PushSendRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ send: PushSendRow; recipients: PushRecipientRow[] } | null>(null);
  const [detailErrorFor, setDetailErrorFor] = useState<{ id: string; text: string } | null>(null);

  const loadHistory = useCallback(async (before?: string) => {
    const token = await getToken();
    if (!token) return;
    setHistoryLoading(true);
    try {
      const r = await api.listAdminPushSends(token, before);
      setHistory((prev) => (before ? [...prev, ...r.sends] : r.sends));
      setHasMore(r.sends.length >= 50);
      setHistoryError(null);
    } catch (err: any) {
      setHistoryError(pushErrorText(err, "Couldn't load the push history."));
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const loadDetail = useCallback(async (id: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const r = await api.getAdminPushSend(token, id);
      if (!r) {
        setDetailErrorFor({ id, text: "This push wasn't found." });
        return;
      }
      setDetail(r);
      setDetailErrorFor(null);
    } catch (err: any) {
      setDetailErrorFor({ id, text: err?.status === 404 ? "This push wasn't found." : pushErrorText(err, "Couldn't load this push.") });
    }
  }, [getToken]);

  useEffect(() => {
    if (openId) loadDetail(openId);
  }, [openId, loadDetail]);

  const detailRunning = !!openId && detail?.send.id === openId && detail.send.status === "sending";
  useEffect(() => {
    if (!openId || !detailRunning) return;
    const timer = setInterval(() => loadDetail(openId), POLL_MS);
    return () => clearInterval(timer);
  }, [openId, detailRunning, loadDetail]);

  const screenLabel = (s: PushSendRow) =>
    s.screen === "link" ? s.url ?? "A link" : screens?.screens.find((x) => x.key === s.screen)?.label ?? s.screen ?? "Activity";

  // ── styles ───────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: insets.bottom + 40, gap: 16 },
    tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    tabBtn: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    tabBtnOn: { backgroundColor: C.gold },
    tabText: { fontSize: 14, fontWeight: "600", color: C.dim },
    tabTextOn: { color: C.onGold },
    card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, gap: 10 },
    heading: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.dim },
    line: { fontSize: 14, color: C.dim, lineHeight: 20 },
    warn: { fontSize: 14, color: C.pending, lineHeight: 20 },
    err: { fontSize: 14, color: C.error, lineHeight: 20 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
    chipOn: { borderColor: C.gold, backgroundColor: C.gold + "1F" },
    chipText: { fontSize: 14, color: C.dim, fontWeight: "500" },
    chipTextOn: { color: C.goldText, fontWeight: "700" },
    chipCount: { fontSize: 12, color: C.dim, fontVariant: ["tabular-nums"] },
    input: { minHeight: 44, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    counter: { fontSize: 12, color: C.dim, fontVariant: ["tabular-nums"] },
    counterOver: { color: C.error },
    person: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    personText: { flex: 1, minWidth: 0 },
    personName: { fontSize: 15, fontWeight: "600", color: C.text },
    personSub: { fontSize: 13, color: C.dim },
    check: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: C.gold, borderColor: C.gold },
    preview: { borderRadius: 16, padding: 14, gap: 4, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
    previewApp: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: C.dim },
    previewTitle: { fontSize: 15, fontWeight: "700", color: C.text },
    previewBody: { fontSize: 14, color: C.text, lineHeight: 19 },
    btnRow: { flexDirection: "row", gap: 10 },
    btn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 12 },
    btnGold: { backgroundColor: C.gold },
    btnGoldText: { color: C.onGold, fontSize: 15, fontWeight: "700" },
    btnOutline: { borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
    btnOutlineText: { color: C.text, fontSize: 15, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: C.border, overflow: "hidden" },
    progressFill: { height: 8, backgroundColor: C.gold },
    row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 4 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" },
    rowTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },
    tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: C.border },
    tagText: { fontSize: 12, fontWeight: "700", color: C.dim },
  });

  const statusTag = (status: string) => {
    const tone = status === "sent" || status === "done" ? C.success : status === "failed" ? C.error : status === "sending" || status === "unknown" ? C.pending : C.dim;
    return (
      <View style={[styles.tag, { backgroundColor: tone + "26" }]}>
        <Text style={[styles.tagText, { color: tone }]}>{STATUS_LABEL[status] ?? status}</Text>
      </View>
    );
  };

  // ── render ───────────────────────────────────────────────────────────────
  const renderWrite = () => {
    if (loadError) {
      return (
        <View style={styles.card}>
          <Text style={styles.err}>{loadError}</Text>
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={loadMeta} accessibilityRole="button">
            <Text style={styles.btnOutlineText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (!screens || !counts) {
      return <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} />;
    }

    if (send) {
      const done = send.status !== "sending";
      const progress = send.recipients > 0 ? Math.min(100, Math.round(((send.sent + send.failed + send.skipped) / send.recipients) * 100)) : 0;
      return (
        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.heading}>{done ? "Done" : "Sending"}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${done ? 100 : progress}%` }]} />
          </View>
          <Text style={styles.line}>
            {done
              ? `Done. ${send.sent} sent${send.failed ? `, ${send.failed} failed` : ""}${send.skipped ? `, ${send.skipped} skipped` : ""} out of ${send.recipients}.`
              : `Sending: ${send.sent + send.failed + send.skipped} of ${send.recipients}. You can leave this screen, it keeps going.`}
          </Text>
          {done ? (
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => { setOpenId(send.id); setTab("history"); }} accessibilityRole="button">
                <Text style={styles.btnOutlineText}>Open in History</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGold]} onPress={startOver} accessibilityRole="button">
                <Text style={styles.btnGoldText}>New push</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.heading}>Send to</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PUSH_AUDIENCES.map((a) => {
              const on = audience === a;
              return (
                <Pressable key={a} style={[styles.chip, on && styles.chipOn]} onPress={() => pickAudience(a)} disabled={locked} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{AUDIENCE_LABEL[a]}</Text>
                  {a !== "picked" ? <Text style={styles.chipCount}>{counts[a]}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {audience === "picked" ? (
            <View style={{ gap: 8 }}>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, business or username"
                placeholderTextColor={C.dim}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!locked}
                accessibilityLabel="Search people"
              />
              {searchActive && searching ? <Text style={styles.line}>Searching</Text> : null}
              {searchActive && searchError ? <Text style={styles.err}>{searchError}</Text> : null}
              {searchActive && !searching && shownResults.length === 0 && !searchError ? <Text style={styles.line}>No accounts match.</Text> : null}
              {shownResults.map((p) => {
                const on = !!picked[p.id];
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.person, !p.canPush && styles.disabled]}
                    onPress={() => togglePerson(p)}
                    disabled={!p.canPush || locked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !p.canPush }}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>{on ? <Feather name="check" size={16} color={C.onGold} /> : null}</View>
                    <View style={styles.personText}>
                      <Text style={styles.personName} numberOfLines={1}>{p.name || p.username || "Unknown"}</Text>
                      <Text style={styles.personSub} numberOfLines={1}>
                        {[ROLE_LABEL[p.role] ?? p.role, p.username ? `@${p.username}` : null].filter(Boolean).join(" · ")}
                        {!p.canPush ? ` · ${pushWhyNot(p)}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {pickedList.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.heading}>{plural(pickedList.length, "person", "people")} picked</Text>
                    <Pressable onPress={() => { setPicked({}); changed(); }} disabled={locked} hitSlop={10} accessibilityRole="button">
                      <Text style={[styles.chipText, { color: C.goldText }]}>Clear all</Text>
                    </Pressable>
                  </View>
                  <View style={styles.chips}>
                    {pickedList.map((p) => (
                      <Pressable key={p.id} style={[styles.chip, styles.chipOn]} onPress={() => togglePerson(p)} disabled={locked} accessibilityRole="button" accessibilityLabel={`Remove ${p.name || p.username}`}>
                        <Text style={[styles.chipText, styles.chipTextOn]} numberOfLines={1}>{p.name || p.username}</Text>
                        <Feather name="x" size={14} color={C.goldText} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.heading}>Title</Text>
            <Text style={[styles.counter, title.trim().length > maxTitle && styles.counterOver]}>{title.trim().length}/{maxTitle}</Text>
          </View>
          <TextInput style={styles.input} value={title} onChangeText={(v) => { setTitle(v.replace(/[\r\n]+/g, " ")); changed(); }} placeholder="Your Outsyde partner kit is ready" placeholderTextColor={C.dim} editable={!locked} accessibilityLabel="Push title" />
          <View style={styles.labelRow}>
            <Text style={styles.heading}>Message</Text>
            <Text style={[styles.counter, body.trim().length > maxBody && styles.counterOver]}>{body.trim().length}/{maxBody}</Text>
          </View>
          <TextInput style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]} value={body} onChangeText={(v) => { setBody(v); changed(); }} multiline placeholder="Tap to see your new flyers and QR codes." placeholderTextColor={C.dim} editable={!locked} accessibilityLabel="Push message" />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>When tapped, open</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {allowedScreens.map((s) => {
              const on = screen === s.key;
              return (
                <Pressable key={s.key} style={[styles.chip, on && styles.chipOn]} onPress={() => { setScreen(s.key); changed(); }} disabled={locked} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {screen === "link" ? (
            <>
              <TextInput style={styles.input} value={url} onChangeText={(v) => { setUrl(v); changed(); }} placeholder="https://goutsyde.com/events" placeholderTextColor={C.dim} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!locked} accessibilityLabel="Link to open" />
              <Text style={styles.line}>Opens inside the app. Only goutsyde.com links.</Text>
            </>
          ) : null}
        </View>

        <View style={styles.preview} accessible accessibilityLabel={`Preview: ${title.trim() || "Title"}. ${body.trim() || "Message"}`}>
          <Text style={styles.previewApp}>OUTSYDE</Text>
          <Text style={styles.previewTitle} numberOfLines={1}>{title.trim() || "Title"}</Text>
          <Text style={styles.previewBody} numberOfLines={4}>{body.trim() || "Your message shows here."}</Text>
        </View>

        <View style={{ gap: 6 }}>
          {limits ? <Text style={styles.line}>{`${limits.remaining} of ${limits.max} sends left today. Tests don't count.`}</Text> : null}
          {limits?.quietHours ? <Text style={styles.warn}>{quietLine(limits.nowNewYork)}</Text> : null}
          {blocker ? <Text style={styles.line}>{blocker}</Text> : null}
        </View>

        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnOutline, (locked || !!contentError) && styles.disabled]} onPress={sendTest} disabled={locked || !!contentError} accessibilityRole="button">
            {busy === "test" ? <ActivityIndicator color={C.text} /> : <Text style={styles.btnOutlineText}>Test to me</Text>}
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGold, (locked || !!blocker) && styles.disabled]} onPress={confirmSend} disabled={locked || !!blocker} accessibilityRole="button">
            {busy === "send" ? <ActivityIndicator color={C.onGold} /> : <Text style={styles.btnGoldText}>{recipients > 0 ? `Send to ${recipients}` : "Send"}</Text>}
          </Pressable>
        </View>
      </>
    );
  };

  const renderHistory = () => (
    <View style={styles.card}>
      {historyError ? <Text style={styles.err}>{historyError}</Text> : null}
      {!historyLoading && history.length === 0 && !historyError ? <Text style={styles.line}>No pushes yet.</Text> : null}
      {history.map((s) => {
        const open = openId === s.id;
        return (
          <View key={s.id} style={styles.row}>
            <Pressable onPress={() => setOpenId(open ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ gap: 4 }}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle} numberOfLines={1}>{s.title}</Text>
                {statusTag(s.status)}
              </View>
              <Text style={styles.line} numberOfLines={open ? undefined : 1}>{s.body}</Text>
              <Text style={styles.line}>
                {[s.kind === "test" ? "Test to me" : AUDIENCE_LABEL[s.audience as PushAudience] ?? s.audience, countsLine(s), formatEtDateTime(s.createdAt)].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
            {open ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                <Text style={styles.line}>Opens: {screenLabel(s)}</Text>
                {s.createdByName ? <Text style={styles.line}>By {s.createdByName}</Text> : null}
                {detailErrorFor?.id === s.id ? <Text style={styles.err}>{detailErrorFor.text}</Text> : null}
                {detail?.send.id !== s.id && detailErrorFor?.id !== s.id ? <ActivityIndicator color={C.gold} /> : null}
                {detail && detail.send.id === s.id
                  ? detail.recipients.map((r, i) => (
                      <View key={`${r.userId ?? "x"}-${i}`} style={styles.rowTop}>
                        <Text style={[styles.line, { flex: 1 }]} numberOfLines={1}>
                          {r.name || "Unknown"}{r.role ? ` · ${ROLE_LABEL[r.role] ?? r.role}` : ""}{r.error ? ` · ${r.error}` : ""}
                        </Text>
                        {statusTag(r.status)}
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {historyLoading ? <ActivityIndicator color={C.gold} /> : null}
      {hasMore && !historyLoading ? (
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => loadHistory(history[history.length - 1]?.createdAt)} accessibilityRole="button">
          <Text style={styles.btnOutlineText}>Load more</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => (tab === "history" ? loadHistory() : loadMeta())}
          tintColor={C.gold}
        />
      }
    >
      <View style={styles.tabs} accessibilityRole="tablist">
        {(["write", "history"] as Tab[]).map((k) => {
          const on = tab === k;
          return (
            <Pressable key={k} style={[styles.tabBtn, on && styles.tabBtnOn]} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{k === "write" ? "Write" : "History"}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === "write" ? renderWrite() : renderHistory()}
    </ScrollView>
  );
}

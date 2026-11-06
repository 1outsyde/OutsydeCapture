// Admin: email history in the app (App Admin Step 7b). Read only, same routes and labels as
// goutsyde.com /admin/emails?tab=history. Writing and sending broadcasts stays on goutsyde.com
// (Legend 2026-11-06): the HTML preview needs a WebView, and POST /broadcasts has no one-time key.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { ROLE_LABEL, formatEtDateTime, pushErrorText } from "@/utils/adminPush";
import {
  EMAIL_POLL_MS,
  EMAIL_STATUS_LABEL,
  SEND_KIND_LABEL,
  emailAudienceLabel,
  emailBudgetLine,
  emailCountsLine,
  emailKindLabel,
  emailPersonName,
  emailSendTitle,
  type EmailBudget,
  type EmailPerson,
  type EmailPersonInfo,
  type EmailRecipientRow,
  type EmailSendRow,
  type PersonEmailRow,
} from "@/utils/adminEmail";

type View_ = "sends" | "people";

export default function AdminEmailsScreen() {
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

  const [view, setView] = useState<View_>("sends");
  const [budget, setBudget] = useState<EmailBudget | null>(null);

  // By send
  const [sends, setSends] = useState<EmailSendRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ send: EmailSendRow; recipients: EmailRecipientRow[] } | null>(null);
  const [detailErrorFor, setDetailErrorFor] = useState<{ id: string; text: string } | null>(null);

  // By person
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<EmailPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [person, setPerson] = useState<{ person: EmailPersonInfo; emails: PersonEmailRow[] } | null>(null);
  const [personErrorFor, setPersonErrorFor] = useState<{ id: string; text: string } | null>(null);
  const searchSeq = useRef(0);

  const loadBudget = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setBudget(await api.getAdminEmailBudget(token));
    } catch {
      /* the line just stays hidden */
    }
  }, [getToken]);

  const loadSends = useCallback(async (before?: string) => {
    const token = await getToken();
    if (!token) return;
    setListLoading(true);
    try {
      const rows = await api.listAdminEmailSends(token, before);
      setSends((prev) => (before ? [...prev, ...rows] : rows));
      setHasMore(rows.length >= 50);
      setListError(null);
    } catch (err: any) {
      setListError(pushErrorText(err, "Couldn't load the email history."));
    } finally {
      setListLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadBudget();
    loadSends();
  }, [loadBudget, loadSends]);

  const loadDetail = useCallback(async (id: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const r = await api.getAdminEmailSend(token, id);
      if (!r) return setDetailErrorFor({ id, text: "This send wasn't found." });
      setDetail(r);
      setDetailErrorFor(null);
    } catch (err: any) {
      setDetailErrorFor({ id, text: err?.status === 404 ? "This send wasn't found." : pushErrorText(err, "Couldn't load this send.") });
    }
  }, [getToken]);

  useEffect(() => {
    if (openId) loadDetail(openId);
  }, [openId, loadDetail]);

  // A send still going out updates on its own, like the web.
  const detailRunning = !!openId && detail?.send.id === openId && detail.send.status === "sending";
  useEffect(() => {
    if (!openId || !detailRunning) return;
    const timer = setInterval(() => loadDetail(openId), EMAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [openId, detailRunning, loadDetail]);

  // People search (2+ characters, debounced).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      searchSeq.current++;
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token || seq !== searchSeq.current) return;
      setSearching(true);
      try {
        const found = await api.searchAdminEmailPeople(token, q);
        if (seq !== searchSeq.current) return;
        setPeople(found);
        setPeopleError(null);
      } catch (err: any) {
        if (seq !== searchSeq.current) return;
        setPeople([]);
        setPeopleError(pushErrorText(err, "Search failed."));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, getToken]);

  const loadPerson = useCallback(async (id: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const r = await api.getAdminPersonEmails(token, id);
      if (!r) return setPersonErrorFor({ id, text: "This account wasn't found." });
      setPerson(r);
      setPersonErrorFor(null);
    } catch (err: any) {
      setPersonErrorFor({ id, text: err?.status === 404 ? "This account wasn't found." : pushErrorText(err, "Couldn't load this person's emails.") });
    }
  }, [getToken]);

  useEffect(() => {
    if (personId) loadPerson(personId);
  }, [personId, loadPerson]);

  const searchActive = query.trim().length >= 2;
  const shownPeople = searchActive ? people : [];

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
    err: { fontSize: 14, color: C.error, lineHeight: 20 },
    input: { minHeight: 44, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: C.text },
    row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 4 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" },
    rowTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },
    tags: { flexDirection: "row", gap: 6, alignItems: "center" },
    tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    tagText: { fontSize: 12, fontWeight: "700" },
    person: { minHeight: 52, paddingVertical: 8, gap: 2 },
    personName: { fontSize: 15, fontWeight: "600", color: C.text },
    btn: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
    btnText: { color: C.text, fontSize: 15, fontWeight: "600" },
  });

  const tag = (text: string, tone: string) => (
    <View style={[styles.tag, { backgroundColor: tone + "26" }]}>
      <Text style={[styles.tagText, { color: tone }]}>{text}</Text>
    </View>
  );
  const statusTone = (s: string) => (s === "sent" || s === "done" ? C.success : s === "failed" ? C.error : s === "sending" || s === "unknown" ? C.pending : C.dim);
  const statusTag = (s: string) => tag(EMAIL_STATUS_LABEL[s] ?? s, statusTone(s));
  // No blue tag: brandInfo is under 4.5:1 at 12px in both themes. The label tells Test apart.
  const kindTone = (k: string) => (k === "broadcast" ? C.goldText : C.dim);

  const renderSends = () => (
    <View style={styles.card}>
      {listError ? <Text style={styles.err}>{listError}</Text> : null}
      {!listLoading && sends.length === 0 && !listError ? <Text style={styles.line}>No emails sent from the admin yet.</Text> : null}
      {sends.map((s) => {
        const open = openId === s.id;
        const audience = emailAudienceLabel(s.audience);
        return (
          <View key={s.id} style={styles.row}>
            <Pressable onPress={() => setOpenId(open ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ gap: 4 }}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle} numberOfLines={open ? undefined : 1}>{emailSendTitle(s)}</Text>
                <View style={styles.tags}>
                  {tag(SEND_KIND_LABEL[s.kind] ?? s.kind, kindTone(s.kind))}
                  {statusTag(s.status)}
                </View>
              </View>
              <Text style={styles.line}>
                {[emailCountsLine(s), audience, s.created_by_name ? `by ${s.created_by_name}` : null, formatEtDateTime(s.created_at)].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
            {open ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                {detailErrorFor?.id === s.id ? <Text style={styles.err}>{detailErrorFor.text}</Text> : null}
                {detail?.send.id !== s.id && detailErrorFor?.id !== s.id ? <ActivityIndicator color={C.gold} /> : null}
                {detail?.send.id === s.id ? (
                  detail.recipients.length === 0 ? (
                    <Text style={styles.line}>No recipients logged.</Text>
                  ) : (
                    detail.recipients.map((r, i) => (
                      <View key={r.id ?? `${r.user_id ?? "x"}-${i}`} style={styles.rowTop}>
                        <Text style={[styles.line, { flex: 1 }]} numberOfLines={2}>
                          {emailPersonName(r)}{r.email && r.name ? ` · ${r.email}` : ""}{r.error ? ` · ${r.error}` : ""}
                        </Text>
                        {statusTag(r.status)}
                      </View>
                    ))
                  )
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
      {listLoading ? <ActivityIndicator color={C.gold} /> : null}
      {hasMore && !listLoading ? (
        <Pressable style={styles.btn} onPress={() => loadSends(sends[sends.length - 1]?.created_at)} accessibilityRole="button">
          <Text style={styles.btnText}>Load more</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderPeople = () => (
    <View style={styles.card}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={(v) => { setQuery(v); setPersonId(null); }}
        placeholder="Search by name, business or email"
        placeholderTextColor={C.dim}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search people"
      />
      {searchActive && searching ? <Text style={styles.line}>Searching</Text> : null}
      {searchActive && peopleError ? <Text style={styles.err}>{peopleError}</Text> : null}
      {searchActive && !searching && shownPeople.length === 0 && !peopleError ? <Text style={styles.line}>No accounts match.</Text> : null}
      {!personId
        ? shownPeople.map((p) => (
            <Pressable key={p.id} style={styles.person} onPress={() => setPersonId(p.id)} accessibilityRole="button">
              <Text style={styles.personName} numberOfLines={1}>{emailPersonName(p)}</Text>
              <Text style={styles.line} numberOfLines={1}>
                {[ROLE_LABEL[p.role] ?? p.role, p.email, p.unsubscribed ? "unsubscribed from announcements" : null].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          ))
        : null}
      {personId ? (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setPersonId(null)} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.line, { color: C.goldText, fontWeight: "600" }]}>Back to results</Text>
          </Pressable>
          {personErrorFor?.id === personId ? <Text style={styles.err}>{personErrorFor.text}</Text> : null}
          {person?.person.id !== personId && personErrorFor?.id !== personId ? <ActivityIndicator color={C.gold} /> : null}
          {person?.person.id === personId ? (
            <>
              <Text style={styles.personName}>{emailPersonName(person.person)}</Text>
              <View style={styles.tags}>
                {person.person.email ? <Text style={styles.line}>{person.person.email}</Text> : null}
                {person.person.unsubscribed ? tag("Unsubscribed from announcements", C.error) : null}
              </View>
              {person.emails.length === 0 ? <Text style={styles.line}>No logged emails for this account.</Text> : null}
              {person.emails.map((e, i) => (
                <View key={e.id ?? `${e.send_id ?? "x"}-${i}`} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{e.subject?.trim() || emailKindLabel(e.kind)}</Text>
                    {statusTag(e.status)}
                  </View>
                  <Text style={styles.line}>
                    {[emailKindLabel(e.kind), formatEtDateTime(e.sent_at ?? e.created_at), e.error || null].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
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
          onRefresh={() => {
            loadBudget();
            if (view === "sends") loadSends();
            else if (personId) loadPerson(personId);
          }}
          tintColor={C.gold}
        />
      }
    >
      <View style={{ gap: 4 }}>
        {budget ? <Text style={styles.line}>{emailBudgetLine(budget)}</Text> : null}
        <Text style={styles.line}>Write and send broadcasts on goutsyde.com.</Text>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(["sends", "people"] as View_[]).map((k) => {
          const on = view === k;
          return (
            <Pressable key={k} style={[styles.tabBtn, on && styles.tabBtnOn]} onPress={() => setView(k)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{k === "sends" ? "By send" : "By person"}</Text>
            </Pressable>
          );
        })}
      </View>
      {view === "sends" ? renderSends() : renderPeople()}
    </ScrollView>
  );
}

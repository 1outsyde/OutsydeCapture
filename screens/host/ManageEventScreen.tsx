/**
 * Manage one hosted event (Events canvas 33): status, share, stats, ticket types, guests, paid orders with refund,
 * cancel or discard. Same data and rules as goutsyde.com/events/[id]/manage. The door team and the scanner come
 * with the scanner step (p4-scanner).
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { Centered, ErrorText, GOLD, Hint, HostHeader, OkText, OutlineButton, PrimaryButton, TextButton, hostStyles } from "@/components/host/hostUi";
import { EVENT_GREEN } from "@/components/events/eventColors";
import { GENERIC_ERROR, money } from "@/utils/eventsLogic";
import { failureCopy, flatError, isHostEvent, isHostTicketType, shareUrl, type HostEvent, type HostTicketType } from "@/utils/host/editorLogic";
import {
  CANCEL_CONFIRM_COPY, DRAFT_DISCARD_COPY, UNAVAILABLE, backendMessage, canCancel, canScan, cancelNotice, checkedInCount, earningsHint,
  guestHandle, guestLine, guestName, isDoorGuest, isHostOrder, isSummary, orderLine, payoutCard, refundConfirmCopy, refundableOrders,
  refundedLine, statusKind, statusLabel, takenLine, typeRowText, typeRows, whenWhere,
  type DoorGuest, type HostOrder, type Summary,
} from "@/utils/host/manageLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = "loading" | "ready" | "notfound" | "error";
type Ask = null | { kind: "cancel" } | { kind: "refund"; order: HostOrder };
const GUEST_PREVIEW = 8;
/** The sheet title already asks the question ("Cancel this event?"): the body keeps the rest. */
const withoutQuestion = (copy: string) => copy.replace(/^[^?]*\?\s*/, "");

export default function ManageEventScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { eventId } = useRoute<RouteProp<RootStackParamList, "ManageEvent">>().params;
  // getToken changes on every auth update: a ref keeps the loaders stable.
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [event, setEvent] = useState<HostEvent | null>(null);
  const [types, setTypes] = useState<HostTicketType[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<HostOrder[]>([]);
  const [guests, setGuests] = useState<DoorGuest[]>([]);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [working, setWorking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  const loadSales = useCallback(async (t: string) => {
    const call = async (fn: () => Promise<Record<string, any>>) => {
      try { return { ok: true as const, body: await fn() }; } catch (e) { return { ok: false as const, err: e }; }
    };
    const [sm, o, g] = await Promise.all([
      call(() => api.getEventSummary(eventId, t)),
      call(() => api.getEventOrders(eventId, t)),
      call(() => api.getDoorGuests(eventId, t)),
    ]);
    let err: string | null = null;
    const copy = (x: { ok: false; err: unknown }) => { const f = flatError(x.err); return failureCopy(f.status, f.body).message; };
    if (sm.ok && sm.body?.success && isSummary(sm.body)) setSummary(sm.body as Summary);
    else { setSummary(null); err = sm.ok ? GENERIC_ERROR : copy(sm); }
    if (o.ok && Array.isArray(o.body?.orders)) setOrders((o.body.orders as unknown[]).filter(isHostOrder));
    else { setOrders([]); err = err ?? (o.ok ? GENERIC_ERROR : copy(o)); }
    if (g.ok && Array.isArray(g.body?.guests)) setGuests((g.body.guests as unknown[]).filter(isDoorGuest));
    else { setGuests([]); err = err ?? (g.ok ? GENERIC_ERROR : copy(g)); }
    setSalesError(err);
  }, [eventId]);

  const load = useCallback(async (quiet = false) => {
    const mine = ++seq.current;
    if (!quiet) { setPhase("loading"); setLoadError(null); }
    const t = await token();
    if (!t) return;
    try {
      const r = await api.getManageEvent(eventId, t);
      if (mine !== seq.current) return;
      if (!r?.success || !isHostEvent(r.event)) throw { status: 500 };
      setEvent(r.event);
      setTypes(Array.isArray(r.ticketTypes) ? (r.ticketTypes as unknown[]).filter(isHostTicketType) : []);
      setPhase("ready");
      if (r.event.status !== "draft") await loadSales(t);
    } catch (e) {
      if (mine !== seq.current) return;
      const f = flatError(e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return; }
      if (f.status === 404) { setPhase("notfound"); return; }
      setLoadError(failureCopy(f.status, f.body).message);
      setPhase("error");
    }
  }, [eventId, token, loadSales, navigation]);

  // Fresh numbers each time the screen shows (after editing, or coming back from the event page).
  // Quiet once something is on screen: no spinner over the numbers being refreshed.
  const hadEvent = useRef(false);
  if (event) hadEvent.current = true;
  useFocusEffect(useCallback(() => { if (!discarded) load(hadEvent.current); }, [load, discarded]));

  const rows = useMemo(() => typeRows(types, summary), [types, summary]);
  const refundable = useMemo(() => refundableOrders(orders, event?.status ?? ""), [orders, event]);

  async function share() {
    if (!event) return;
    try { await Share.share({ message: `${event.title} ${shareUrl(event.slug)}` }); } catch { /* closed */ }
  }

  async function confirm() {
    if (!event || !ask || working) return;
    const t = await token();
    if (!t) return;
    setWorking(true);
    setAskError(null);
    try {
      if (ask.kind === "cancel") {
        const r = await api.cancelEvent(event.id, t);
        setAsk(null);
        if (event.status === "draft") { setDiscarded(true); return; }
        setNotice(cancelNotice(r?.guests));
        await load(true);
      } else {
        await api.hostRefundOrder(event.id, ask.order.id, t);
        setNotice(`Refund started for ${guestName(ask.order.guest)}.`);
        setAsk(null);
        await loadSales(t);
      }
    } catch (e) {
      const f = flatError(e);
      setAskError(backendMessage(f.status, f.body));
    } finally {
      setWorking(false);
    }
  }

  const root = (children: React.ReactNode) => <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>{children}</View>;
  const header = <HostHeader left={{ icon: "chevron-left", label: "Back", onPress: () => navigation.goBack() }} title="Manage event" />;

  if (phase === "loading") return root(<>{header}<Centered><ActivityIndicator color={GOLD} /></Centered></>);
  if (phase === "notfound") {
    return root(
      <>{header}<Centered>
        <ThemedText style={hostStyles.h1} accessibilityRole="header">EVENT NOT FOUND</ThemedText>
        <ThemedText style={[hostStyles.body, { textAlign: "center" }]}>Event not found. It may have been removed, or it belongs to another account.</ThemedText>
        <PrimaryButton label="Your events" onPress={() => navigation.replace("YourEvents")} style={{ alignSelf: "stretch" }} />
      </Centered></>,
    );
  }
  if (phase === "error" || !event) {
    return root(
      <>{header}<Centered>
        <ErrorText>{loadError ?? GENERIC_ERROR}</ErrorText>
        <PrimaryButton label="Try again" onPress={() => load()} style={{ alignSelf: "stretch" }} />
      </Centered></>,
    );
  }
  if (discarded) {
    return root(
      <>{header}<Centered>
        <ThemedText style={hostStyles.h1}>{event.title}</ThemedText>
        <OkText>Draft discarded.</OkText>
        <PrimaryButton label="Back to your events" onPress={() => navigation.goBack()} style={{ alignSelf: "stretch" }} />
      </Centered></>,
    );
  }

  const kind = statusKind(event);
  const isDraft = event.status === "draft";
  const live = event.status === "published";
  const scannable = canScan(event);
  const missing = salesError ? UNAVAILABLE : "…";
  const earnings = summary ? summary.totals.hostEarningsCents : 0;
  const payout = summary ? payoutCard(summary.payout, event.timezone, earnings) : null;
  const refunded = summary ? refundedLine(summary.totals) : null;
  const shown = showAll ? guests : guests.slice(0, GUEST_PREVIEW);
  const chip = kind === "published" ? { bg: EVENT_GREEN, fg: "#BFE3D5" } : kind === "cancelled" ? { bg: "rgba(255,138,122,0.16)", fg: theme.error } : { bg: theme.border, fg: theme.text };

  return root(
    <>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={async () => { setRefreshing(true); await load(true); setRefreshing(false); }} />}
      >
        {notice ? <OkText>{notice}</OkText> : null}
        <View style={{ gap: 8 }}>
          <View style={[s.chip, { backgroundColor: chip.bg }]}><ThemedText style={[s.chipText, { color: chip.fg }]} testID="status">{statusLabel(event)}</ThemedText></View>
          <ThemedText style={s.title} accessibilityRole="header">{event.title}</ThemedText>
          <ThemedText style={[s.sub, { color: theme.textSecondary }]}>{whenWhere(event)}</ThemedText>
        </View>

        <View style={s.actions}>
          {event.status !== "cancelled" ? <OutlineButton label="Edit" onPress={() => navigation.navigate("EventEditor", { eventId: event.id })} style={{ flex: 1 }} /> : null}
          {kind !== "paused" && !isDraft ? <OutlineButton label="View page" onPress={() => navigation.navigate("EventDetail", { slug: event.slug })} style={{ flex: 1 }} /> : null}
          {!isDraft && scannable ? <OutlineButton label="Share" onPress={share} style={{ flex: 1 }} /> : null}
        </View>

        {isDraft ? <Hint>This event is a draft. Finish it in the editor to publish it. Guests can't see it yet.</Hint> : null}

        {!isDraft ? (
          <>
            {salesError ? (
              <View style={{ gap: 4 }}>
                <ErrorText>{salesError}</ErrorText>
                <View style={{ alignSelf: "flex-start" }}><TextButton label="Try again" gold onPress={() => load(true)} /></View>
              </View>
            ) : null}
            <View style={s.stats}>
              <Stat label="Tickets taken" big={takenLine(event.takenCount, event.capacity)} testID="taken" />
              <Stat label="Your earnings" big={summary ? money(earnings) : missing} gold hint={summary ? earningsHint(summary.payout) : null} testID="earnings" />
              <Stat label="Paid to your bank" mid={payout ? payout.value : missing} hint={payout?.hint ?? null} />
              <Stat label="Refunded" mid={refunded ? refunded.value : missing} hint={refunded?.hint ?? null} />
            </View>
          </>
        ) : null}

        <View style={{ gap: 12 }} accessibilityLabel="Ticket types">
          <ThemedText style={[hostStyles.section, { color: theme.textSecondary }]} accessibilityRole="header">TICKET TYPES</ThemedText>
          {rows.length === 0 ? <Hint>No ticket types yet.</Hint> : null}
          {rows.map((r) => (
            <View key={r.id} style={{ gap: 6 }} testID="type-row">
              <View style={s.trow}>
                <ThemedText style={{ fontSize: 15, flex: 1 }}>{r.name}{r.hidden ? " (hidden)" : ""}</ThemedText>
                <ThemedText style={{ fontSize: 14, color: theme.textSecondary }}>{typeRowText(r)}</ThemedText>
              </View>
              <View style={[s.bar, { backgroundColor: theme.border }]} accessible accessibilityLabel={`${r.pct} percent taken`}>
                <View style={{ width: `${r.pct}%`, height: 6, borderRadius: 3, backgroundColor: GOLD }} />
              </View>
            </View>
          ))}
        </View>

        {!isDraft ? (
          <View style={{ gap: 10 }} testID="guests">
            <View style={s.trow}>
              <ThemedText style={[hostStyles.section, { color: theme.textSecondary, flex: 1 }]} accessibilityRole="header">
                GUESTS{guests.length > 0 ? ` (${checkedInCount(guests)} OF ${guests.length} CHECKED IN)` : ""}
              </ThemedText>
              {guests.length > GUEST_PREVIEW ? <TextButton label={showAll ? "Show fewer" : "See all"} gold onPress={() => setShowAll((v) => !v)} /> : null}
            </View>
            {guests.length === 0 ? <Hint>No guests yet.</Hint> : shown.map((g) => (
              <View key={g.ticketId} style={[s.li, { borderBottomColor: theme.border }]} testID="guest-row">
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={hostStyles.strong}>{guestName(g)}</ThemedText>
                  <Hint>{guestLine(g)}</Hint>
                </View>
                {g.checkedInAt ? <ThemedText style={{ color: theme.success, fontSize: 13, fontWeight: "700" }}>Checked in</ThemedText> : null}
              </View>
            ))}
          </View>
        ) : null}

        {refundable.length > 0 ? (
          <View style={{ gap: 10 }} testID="orders">
            <ThemedText style={[hostStyles.section, { color: theme.textSecondary }]} accessibilityRole="header">PAID ORDERS</ThemedText>
            {refundable.map((o) => (
              <View key={o.id} style={[s.li, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={hostStyles.strong}>{guestName(o.guest)}</ThemedText>
                  <Hint>{[guestHandle(o.guest), orderLine(o)].filter(Boolean).join(" · ")}</Hint>
                </View>
                <OutlineButton label="Refund" onPress={() => { setAskError(null); setAsk({ kind: "refund", order: o }); }} />
              </View>
            ))}
          </View>
        ) : null}

        {live ? <Hint>Door team and scanning come with the door scanner step.</Hint> : null}

        {canCancel(event) ? (
          <View style={{ alignItems: "center" }}>
            <TextButton label={isDraft ? "Discard draft" : "Cancel event"} onPress={() => { setAskError(null); setAsk({ kind: "cancel" }); }} />
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!!ask} transparent animationType="slide" onRequestClose={() => {
        if (!working) setAsk(null);
      }}>
        <Pressable style={s.backdrop} onPress={() => !working && setAsk(null)} accessibilityRole="button" accessibilityLabel="Close" />
        {ask ? (
          <View style={[s.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
            <ThemedText style={s.sheetTitle} accessibilityRole="header">
              {ask.kind === "refund" ? "Refund this order?" : isDraft ? "Discard this draft?" : "Cancel this event?"}
            </ThemedText>
            <ThemedText style={hostStyles.body}>{ask.kind === "refund" ? refundConfirmCopy(ask.order) : withoutQuestion(isDraft ? DRAFT_DISCARD_COPY : CANCEL_CONFIRM_COPY)}</ThemedText>
            {askError ? <ErrorText>{askError}</ErrorText> : null}
            <Pressable onPress={confirm} disabled={working} accessibilityRole="button"
              style={[s.danger, { backgroundColor: ask.kind === "refund" ? GOLD : "#FF8A7A", opacity: working ? 0.7 : 1 }]}>
              {working ? <ActivityIndicator color="#0B0B0B" style={{ marginRight: 8 }} /> : null}
              <ThemedText style={{ color: "#0B0B0B", fontWeight: "700", fontSize: 16 }}>
                {ask.kind === "refund" ? (working ? "Refunding…" : "Yes, refund") : isDraft ? (working ? "Discarding…" : "Yes, discard draft") : working ? "Cancelling…" : "Yes, cancel event"}
              </ThemedText>
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <TextButton label={ask.kind === "refund" ? "Keep order" : isDraft ? "Keep draft" : "Keep event"} disabled={working} onPress={() => setAsk(null)} />
            </View>
          </View>
        ) : null}
      </Modal>
    </>,
  );
}

function Stat({ label, big, mid, hint, gold, testID }: { label: string; big?: string; mid?: string; hint?: string | null; gold?: boolean; testID?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[s.stat, { borderColor: theme.border }]}>
      <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>{label}</ThemedText>
      {big ? <ThemedText style={[s.big, gold ? { color: theme.brandGold } : null]} testID={testID}>{big}</ThemedText> : null}
      {mid ? <ThemedText style={s.mid}>{mid}</ThemedText> : null}
      {hint ? <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>{hint}</ThemedText> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  chip: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  title: { fontSize: 24, fontWeight: "800" },
  sub: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  big: { fontSize: 24, fontWeight: "800" },
  mid: { fontSize: 17, fontWeight: "700" },
  trow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  li: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  danger: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", flexDirection: "row" },
});

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { EVENT_GOLD } from "@/components/events/eventColors";
import { fmt } from "@/utils/eventsLogic";
import {
  calendarEventFor,
  canChangeOrder,
  cancelErrorCopy,
  directionsUrl,
  needsCalendarPermission,
  orderKind,
  refundConfirmBody,
  refundDoneBody,
  refundErrorCopy,
  refundShownCents,
  ticketPlaceLine,
  type MyTicket,
  type TicketOrder,
} from "@/utils/ticketCheckoutLogic";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Phase = "loading" | "ready" | "gone" | "error";
type Sheet = null | { kind: "ask"; mode: "refund" | "cancel" } | { kind: "done"; mode: "refund" | "cancel"; cents: number | null };

const PAPER = "#F5F0E6";
const INK = "#0B0B0B";
const INK_SOFT = "#4A453C";
const CARD_W_PAD = 20;

/** One event's tickets with QR codes (Events canvas 29). Swipe for the next ticket. */
export default function TicketDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { eventId } = useRoute<RouteProp<RootStackParamList, "TicketDetail">>().params;
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>("loading");
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [orders, setOrders] = useState<Record<string, TicketOrder | null>>({});
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const token = await getToken();
      if (!token) {
        navigation.navigate("Auth", {});
        return;
      }
      const all = await api.getMyTickets(token);
      if (mine !== seq.current) return;
      const mineTickets = all.filter((t) => t.event.id === eventId);
      setTickets(mineTickets);
      setIndex((i) => Math.min(i, Math.max(0, mineTickets.length - 1)));
      setPhase(mineTickets.length ? "ready" : "gone");
      const ids = [...new Set(mineTickets.map((t) => t.orderId))];
      const pairs = await Promise.all(ids.map(async (id) => [id, await api.getTicketOrder(id, token).catch(() => null)] as const));
      if (mine === seq.current) setOrders(Object.fromEntries(pairs));
    } catch {
      if (mine === seq.current) setPhase((p) => (p === "ready" ? p : "error"));
    }
  }, [eventId, getToken, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Inside the card's 1px border on each side.
  const cardW = width - CARD_W_PAD * 2 - 2;
  const onSwipe = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(ev.nativeEvent.contentOffset.x / Math.max(1, cardW));
    if (i !== index) setIndex(Math.max(0, Math.min(tickets.length - 1, i)));
  };

  const current = tickets[index] ?? null;
  const ev = current?.event ?? null;
  const order = current ? orders[current.orderId] ?? null : null;
  const kind = orderKind(order);
  // The whole order is refunded or cancelled together; the order knows its count, the list is the fallback.
  const orderTicketCount = useMemo(
    () => order?.ticketCount ?? (current ? tickets.filter((t) => t.orderId === current.orderId).length : 0),
    [order, tickets, current],
  );
  const checkedIn = current ? tickets.some((t) => t.orderId === current.orderId && !!t.checkedInAt) : false;
  // The backend refuses refunds and RSVP cancels once the event starts or someone checks in.
  const changeable = ev ? canChangeOrder(ev, checkedIn, new Date()) : false;
  const directions = ev ? directionsUrl(ev, Platform.OS) : null;
  const wallet = current?.walletUrl ?? null;

  const openDirections = () => {
    if (!directions) return;
    Linking.openURL(directions).catch(() => setNote("Couldn't open maps."));
  };

  const addToCalendar = async () => {
    if (!ev) return;
    setNote("");
    try {
      const Calendar = await import("expo-calendar/legacy");
      // Below iOS 17 the system editor needs calendar permission first (CalendarModule.swift checks it).
      if (needsCalendarPermission(Platform.OS, Platform.Version)) {
        const { granted } = await Calendar.requestCalendarPermissionsAsync();
        if (!granted) {
          setNote("Allow calendar access for Outsyde in Settings to add this event.");
          return;
        }
      }
      const c = calendarEventFor(ev);
      await Calendar.createEventInCalendarAsync({
        title: c.title,
        startDate: c.startDate,
        endDate: c.endDate,
        timeZone: c.timeZone,
        url: c.url,
        notes: c.notes,
        ...(c.location ? { location: c.location } : {}),
      });
    } catch {
      setNote("Couldn't open your calendar.");
    }
  };

  const confirm = async () => {
    if (!current || !sheet || sheet.kind !== "ask" || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const token = await getToken();
      if (!token) {
        navigation.navigate("Auth", {});
        return;
      }
      if (sheet.mode === "refund") {
        const res = await api.requestTicketRefund(current.orderId, token);
        setSheet({ kind: "done", mode: "refund", cents: refundShownCents(res) });
      } else {
        await api.cancelRsvp(current.orderId, token);
        setSheet({ kind: "done", mode: "cancel", cents: null });
      }
    } catch (err: any) {
      if (err?.status === 401) navigation.navigate("Auth", {});
      else setMsg(sheet.mode === "refund" ? refundErrorCopy(err) : cancelErrorCopy(err));
    } finally {
      setBusy(false);
    }
  };

  const closeSheet = () => {
    if (busy) return;
    const wasDone = sheet?.kind === "done";
    setSheet(null);
    setMsg("");
    if (wasDone) load();
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" style={[styles.back, { backgroundColor: theme.card }]}>
        <Feather name="chevron-left" size={22} color={theme.text} />
      </Pressable>
      <ThemedText style={[styles.headerTitle, { color: theme.text }]} accessibilityRole="header">
        {tickets.length > 1 ? "Your tickets" : "Your ticket"}
      </ThemedText>
    </View>
  );

  if (phase !== "ready" || !current || !ev) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        {header}
        <View style={styles.center}>
          {phase === "loading" ? (
            <ActivityIndicator size="large" color={theme.brandGold} />
          ) : (
            <>
              <ThemedText style={[styles.centerText, { color: theme.text }]}>
                {phase === "gone" ? "You have no tickets for this event now." : "Your tickets could not be loaded."}
              </ThemedText>
              {phase === "error" ? (
                <Pressable onPress={() => { setPhase("loading"); load(); }} accessibilityRole="button" style={[styles.pill, { backgroundColor: EVENT_GOLD }]}>
                  <ThemedText style={styles.pillText}>Try again</ThemedText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  const day = `${fmt(ev.startsAt, ev.timezone, { weekday: "short", month: "short", day: "numeric" })} · ${fmt(ev.startsAt, ev.timezone, { hour: "numeric", minute: "2-digit" })}`;
  const sheetMode = sheet?.mode ?? "refund";

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: CARD_W_PAD, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <View style={[styles.card, { borderColor: theme.border }]}>
          <View style={styles.cardTop}>
            <ThemedText style={styles.evTitle}>{ev.title}</ThemedText>
            <ThemedText style={styles.evDay}>{day}</ThemedText>
            <ThemedText style={styles.evPlace}>{ticketPlaceLine(ev)}</ThemedText>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onSwipe}
            onScroll={Platform.OS === "web" ? onSwipe : undefined}
            scrollEventThrottle={64}
            style={{ width: cardW }}
          >
            {tickets.map((t, i) => (
              <View key={t.id} style={[styles.qrPage, { width: cardW }]}>
                {t.qrUrl ? (
                  <Image
                    source={{ uri: t.qrUrl }}
                    style={styles.qr}
                    contentFit="contain"
                    accessible
                    accessibilityLabel={`QR code for ticket ${i + 1}`}
                  />
                ) : (
                  <View style={[styles.qr, styles.qrMissing]}>
                    <ThemedText style={styles.qrMissingText}>QR code not available</ThemedText>
                  </View>
                )}
                <ThemedText style={styles.code} selectable>{t.code}</ThemedText>
                <ThemedText style={styles.meta}>
                  {[t.ticketTypeName, tickets.length > 1 ? `Ticket ${i + 1} of ${tickets.length}` : null, tickets.length > 1 && i < tickets.length - 1 ? "swipe for the next" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </ThemedText>
                {t.checkedInAt ? <ThemedText style={styles.checked}>Checked in</ThemedText> : null}
              </View>
            ))}
          </ScrollView>

          {tickets.length > 1 ? (
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {tickets.map((t, i) => (
                <View key={t.id} style={[styles.dot, { backgroundColor: i === index ? INK : "#B8B0A0" }]} />
              ))}
            </View>
          ) : null}
          <ThemedText style={styles.tip}>Turn your screen brightness up at the door.</ThemedText>

          <View style={styles.actions}>
            <Pressable
              onPress={openDirections}
              disabled={!directions}
              accessibilityRole="button"
              accessibilityState={{ disabled: !directions }}
              accessibilityHint={directions ? undefined : "Available once the full address is shared"}
              style={[styles.action, styles.actionLeft, { opacity: directions ? 1 : 0.4 }]}
            >
              <ThemedText style={styles.actionText}>Directions</ThemedText>
            </Pressable>
            {Platform.OS !== "web" ? (
              <Pressable onPress={addToCalendar} accessibilityRole="button" style={styles.action}>
                <ThemedText style={styles.actionText}>Add to calendar</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        {note ? <ThemedText style={[styles.note, { color: theme.error }]} accessibilityRole="alert">{note}</ThemedText> : null}

        {wallet ? (
          <Pressable onPress={() => Linking.openURL(wallet).catch(() => {})} accessibilityRole="button" style={[styles.pill, { backgroundColor: INK, borderWidth: 1, borderColor: theme.border }]}>
            <ThemedText style={[styles.pillText, { color: "#FFFFFF" }]}>Add to Apple Wallet</ThemedText>
          </Pressable>
        ) : null}

        {changeable && kind !== "unknown" ? (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Pressable
              onPress={() => {
                setMsg("");
                setSheet({ kind: "ask", mode: kind === "paid" ? "refund" : "cancel" });
              }}
              accessibilityRole="button"
              style={styles.textBtn}
            >
              <ThemedText style={[styles.textBtnLabel, { color: theme.textSecondary }]}>
                {kind === "paid" ? "Request a refund" : "Cancel RSVP"}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={closeSheet} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Close" accessibilityRole="button" />
          <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 20 }]}>
            <ThemedText style={[styles.sheetTitle, { color: theme.text }]} accessibilityRole="header">
              {sheet?.kind === "done"
                ? sheetMode === "refund" ? "Refund on its way" : "RSVP cancelled"
                : sheetMode === "refund" ? "Refund your tickets?" : "Cancel your RSVP?"}
            </ThemedText>
            <ThemedText style={[styles.sheetBody, { color: theme.textSecondary }]}>
              {sheet?.kind === "done"
                ? sheetMode === "refund" ? refundDoneBody(sheet.cents) : "Your RSVP is cancelled."
                : sheetMode === "refund"
                  ? refundConfirmBody(orderTicketCount)
                  : orderTicketCount > 1 ? `All ${orderTicketCount} spots on this RSVP are cancelled together.` : "Your spot opens up for someone else."}
            </ThemedText>
            {msg ? <ThemedText style={[styles.note, { color: theme.error }]} accessibilityRole="alert">{msg}</ThemedText> : null}
            {sheet?.kind === "ask" ? (
              <Pressable onPress={confirm} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }} style={[styles.pill, { backgroundColor: EVENT_GOLD, opacity: busy ? 0.7 : 1 }]}>
                {busy ? (
                  <ActivityIndicator color={INK} />
                ) : (
                  <ThemedText style={styles.pillText}>
                    {sheetMode === "refund"
                      ? `Refund ${orderTicketCount} ${orderTicketCount === 1 ? "ticket" : "tickets"}`
                      : "Cancel RSVP"}
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
            <Pressable onPress={closeSheet} disabled={busy} accessibilityRole="button" style={styles.textBtn}>
              <ThemedText style={[styles.textBtnLabel, { color: theme.textSecondary }]}>
                {sheet?.kind === "done" ? "Done" : sheetMode === "refund" ? "Keep my tickets" : "Keep my RSVP"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  centerText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  card: { backgroundColor: PAPER, borderRadius: 22, overflow: "hidden", borderWidth: 1 },
  cardTop: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4, gap: 4 },
  evTitle: { color: INK, fontSize: 22, fontWeight: "800", lineHeight: 27 },
  evDay: { color: INK, fontSize: 13, fontWeight: "600" },
  evPlace: { color: INK_SOFT, fontSize: 13, lineHeight: 18 },
  qrPage: { alignItems: "center", paddingTop: 12, paddingBottom: 6, gap: 8 },
  qr: { width: 190, height: 190, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#DDD4C2" },
  qrMissing: { alignItems: "center", justifyContent: "center", padding: 10 },
  qrMissingText: { color: INK_SOFT, fontSize: 12, textAlign: "center" },
  code: { color: INK, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  meta: { color: INK_SOFT, fontSize: 12, textAlign: "center", paddingHorizontal: 12 },
  checked: { color: "#1A3C34", fontSize: 12, fontWeight: "700" },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center", paddingTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tip: { color: INK_SOFT, fontSize: 11, textAlign: "center", paddingTop: 8, paddingBottom: 10 },
  actions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#B8B0A0", borderStyle: "dashed" },
  action: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center" },
  actionLeft: { borderRightWidth: 1, borderRightColor: "#DDD4C2" },
  actionText: { color: INK, fontSize: 14, fontWeight: "600" },
  note: { fontSize: 13, textAlign: "center" },
  pill: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  pillText: { color: INK, fontSize: 16, fontWeight: "700" },
  textBtn: { minHeight: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  textBtnLabel: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  sheetBody: { fontSize: 14, lineHeight: 21 },
});

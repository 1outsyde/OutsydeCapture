/**
 * Door scanner (Events canvas 14 and 15). Same rules as goutsyde.com/events/[id]/scan:
 *  - camera (expo-camera CameraView, QR only, flashlight), Type a code, Guest list with tap to check in;
 *  - the same code is ignored for 3 seconds; scanning pauses while a result shows, until Scan next;
 *  - Undo check in for the host only. Members see no money and no contact details (the backend never sends them).
 * Who may scan comes from GET /door/mine?roles=all canScan (host, Admissions or a co-host; call 74, same as goutsyde.com).
 * Undo: the host or a co-host (backend doorUser allows both), never a door member. The host or a co-host also gets in
 * through /manage when the list doesn't have the event (not published, or ended over 14 days ago), so Undo still works.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useIsFocused, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { Centered, ErrorText, GOLD, Hint, OutlineButton, PrimaryButton, TextButton, hostStyles } from "@/components/host/hostUi";
import { GENERIC_ERROR } from "@/utils/eventsLogic";
import { failureCopy, flatError } from "@/utils/host/editorLogic";
import { backendMessage, guestLine, guestName, isDoorGuest, type DoorGuest } from "@/utils/host/manageLogic";
import {
  CODE_LENGTH, LAST_SCAN_COLOR, TONE_BG, cleanTyped, filterGuests, invalidCodeResult, lastScanLabel, makeRecent,
  makeGate, progressPct, qrToCode, replaceGuest, resultFor, scanWindowNote, timeOnly, undoneResult, type ScanResult,
} from "@/utils/host/doorLogic";
import { isTeamEvent } from "@/utils/host/teamLogic";
import { manageAccess } from "@/utils/host/eventTeamRules";
import { canUndo as undoAllowed, scanAccess, type ScanAs } from "@/utils/host/memberLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Info = { title: string; startsAt: string; endsAt: string; timezone: string; status?: string; role: ScanAs };
type Last = { key: string; r: ScanResult };

export default function DoorScannerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const focused = useIsFocused();
  const { eventId } = useRoute<RouteProp<RootStackParamList, "DoorScanner">>().params;
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);
  const [perm, requestPerm] = useCameraPermissions();

  const [phase, setPhase] = useState<"loading" | "ready" | "noaccess" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [guests, setGuests] = useState<DoorGuest[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [last, setLast] = useState<Last[]>([]);
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  // Taken before any await: a second QR frame or tap while a request runs is dropped.
  const gate = useRef(makeGate()).current;
  const recent = useRef(makeRecent());
  const seq = useRef(0);

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  const loadGuests = useCallback(async (t: string) => {
    const g = await api.getDoorGuests(eventId, t);
    setGuests(Array.isArray(g?.guests) ? (g.guests as unknown[]).filter(isDoorGuest) : []);
  }, [eventId]);

  const load = useCallback(async () => {
    const t = await token();
    if (!t) return;
    try {
      const mine = await api.getTeamEvents(t).catch(() => null);
      const listed = scanAccess(Array.isArray(mine?.events) ? (mine.events as unknown[]).filter(isTeamEvent) : [], eventId);
      let next: Info | null = listed ? { title: listed.title, startsAt: listed.startsAt, endsAt: listed.endsAt, timezone: listed.timezone, role: listed.as } : null;
      if (!next) {
        // The host or a co-host, on an event the list doesn't have (not published, or long over): still allowed, check in stays closed.
        const m = await api.getManageEvent(eventId, t).catch(() => null);
        if (m?.success && m.event) next = { title: m.event.title, startsAt: m.event.startsAt, endsAt: m.event.endsAt, timezone: m.event.timezone, status: m.event.status, role: manageAccess(m).as };
      }
      if (!next) { setPhase("noaccess"); return; }
      setInfo(next);
      await loadGuests(t);
      setPhase("ready");
    } catch (e) {
      const f = flatError(e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return; }
      if (f.status === 404) { setPhase("noaccess"); return; }
      setLoadError(failureCopy(f.status, f.body).message);
      setPhase("error");
    }
  }, [eventId, token, loadGuests, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pushLast = (r: ScanResult) => {
    seq.current += 1;
    setLast((l) => [{ key: `${r.ticket?.ticketId ?? r.outcome}:${Date.now()}:${seq.current}`, r }, ...l].slice(0, 3));
  };

  /** One check in, by code (camera, typed) or by ticket id (guest list). */
  const checkIn = useCallback(async (by: { code: string } | { ticketId: string }) => {
    if (!info || !gate.enter()) return;
    setBusy(true); setUndoError(null);
    const t = await token();
    if (!t) { gate.leave(); setBusy(false); return; }
    let r: ScanResult;
    try {
      const body = "code" in by ? await api.doorCheckIn(eventId, by.code, t) : await api.doorCheckInTicket(eventId, by.ticketId, t);
      r = resultFor(200, body, info.timezone);
    } catch (e) {
      const err = e as { status?: number; body?: unknown };
      r = resultFor(typeof err?.status === "number" ? err.status : 0, err?.body ?? null, info.timezone);
    }
    if (r.ticket) setGuests((g) => replaceGuest(g, r.ticket!));
    setResult(r);
    pushLast(r);
    gate.leave(); setBusy(false);
  }, [eventId, info, token, gate]);

  const onScan = useCallback((scan: BarcodeScanningResult) => {
    if (gate.busy() || result || typing || listOpen) return;
    const text = typeof scan?.data === "string" ? scan.data : "";
    if (!recent.current.allow(text, Date.now())) return;
    const code = qrToCode(text);
    if (!code) { const r = invalidCodeResult(); setResult(r); pushLast(r); return; }
    checkIn({ code });
  }, [checkIn, result, typing, listOpen, gate]);

  async function undo(tk: DoorGuest) {
    if (!gate.enter()) return;
    setBusy(true); setUndoError(null);
    const t = await token();
    if (!t) { gate.leave(); setBusy(false); return; }
    try {
      const r = await api.doorUndo(eventId, tk.ticketId, t);
      if (isDoorGuest(r?.ticket)) {
        setGuests((g) => replaceGuest(g, r.ticket));
        const u = undoneResult(r.ticket);
        if (result) setResult(u);
        pushLast(u);
      }
    } catch (e) {
      const f = flatError(e);
      setUndoError(backendMessage(f.status, f.body));
    } finally {
      gate.leave(); setBusy(false);
    }
  }

  const checkedIn = useMemo(() => guests.filter((g) => !!g.checkedInAt).length, [guests]);
  const shown = useMemo(() => filterGuests(guests, query), [guests, query]);
  const isHost = !!info && undoAllowed(info.role);
  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("DoorEvents"));

  const top = (
    <View style={[st.top, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close scanner" hitSlop={10} style={st.icon}>
        <Feather name="x" size={22} color="#F5F0E6" />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <ThemedText style={st.topTitle} accessibilityRole="header">Check in</ThemedText>
        {info ? <ThemedText style={st.topSub} numberOfLines={1}>{`${info.title} · ${timeOnly(info.startsAt, info.timezone)}`}</ThemedText> : null}
      </View>
      <Pressable onPress={() => setTorch((v) => !v)} accessibilityRole="button" accessibilityLabel={torch ? "Turn the flashlight off" : "Turn the flashlight on"}
        accessibilityState={{ checked: torch }} hitSlop={10} style={st.icon} disabled={Platform.OS === "web"}>
        <Feather name={torch ? "zap-off" : "zap"} size={20} color={torch ? GOLD : "#F5F0E6"} />
      </Pressable>
    </View>
  );

  if (phase === "loading") return <View style={st.root}>{top}<Centered><ActivityIndicator color={GOLD} /></Centered></View>;
  if (phase === "noaccess") {
    return <View style={st.root}>{top}<Centered>
      <ThemedText style={[hostStyles.h1, { color: "#F5F0E6" }]} accessibilityRole="header">NO ACCESS</ThemedText>
      <ThemedText style={[hostStyles.body, { color: "#CFC7B8", textAlign: "center" }]}>You can't scan tickets for this event. Ask the host to invite you to their door team.</ThemedText>
      <PrimaryButton label="Done" onPress={close} style={{ alignSelf: "stretch" }} />
    </Centered></View>;
  }
  if (phase === "error" || !info) {
    return <View style={st.root}>{top}<Centered>
      <ErrorText>{loadError ?? GENERIC_ERROR}</ErrorText>
      <PrimaryButton label="Try again" onPress={load} style={{ alignSelf: "stretch" }} />
    </Centered></View>;
  }

  const note = scanWindowNote(info);
  const canUndo = isHost && !!result?.ticket && (result.outcome === "CHECKED_IN" || result.outcome === "ALREADY_CHECKED_IN") && !!result.ticket.checkedInAt;
  const cameraOn = Platform.OS !== "web" && !!perm?.granted && focused && !result && !typing && !listOpen;

  // ----- result (canvas 15) -----
  if (result) {
    return (
      <View style={st.root}>
        {top}
        <View style={[st.result, { backgroundColor: TONE_BG[result.tone] }]} testID="scan-result" accessibilityLiveRegion="assertive">
          <View style={st.resultIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Feather name={result.tone === "ok" ? "check" : result.tone === "warn" ? "alert-circle" : "x"} size={52} color="#FFFFFF" />
          </View>
          <ThemedText style={st.resultTitle} accessibilityRole="header">{result.title}</ThemedText>
          {result.who ? <ThemedText style={st.resultWho}>{result.who}</ThemedText> : null}
          <ThemedText style={st.resultDetail}>{result.detail}</ThemedText>
        </View>
        <View style={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 10 }}>
          {undoError ? <ErrorText>{undoError}</ErrorText> : null}
          <PrimaryButton label="Scan next" onPress={() => { setResult(null); setUndoError(null); }} disabled={busy} />
          {canUndo ? (
            <Pressable onPress={() => undo(result.ticket!)} disabled={busy} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "center", paddingVertical: 8, opacity: busy ? 0.5 : 1 }}>
              <ThemedText style={{ color: "#CFC7B8", fontSize: 15, fontWeight: "600" }}>{busy ? "Undoing…" : "Undo check in"}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // ----- scanner (canvas 14) -----
  return (
    <View style={st.root}>
      {top}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 6 }}>
        <View style={st.countRow}>
          <ThemedText style={{ color: "#F5F0E6", fontWeight: "700", fontSize: 14 }} testID="counter">{`${checkedIn} checked in`}</ThemedText>
          <ThemedText style={{ color: "#A0A0A0", fontSize: 13 }}>{`of ${guests.length} tickets`}</ThemedText>
        </View>
        <View style={st.bar} accessible accessibilityLabel={`${checkedIn} of ${guests.length} checked in`}>
          <View style={{ width: `${progressPct(checkedIn, guests.length)}%`, height: 6, borderRadius: 3, backgroundColor: GOLD }} />
        </View>
        {note ? <ThemedText style={{ color: "#F0B54A", fontSize: 13 }} testID="window-note">{note}</ThemedText> : null}
      </View>

      <View style={{ flex: 1, padding: 16, gap: 14 }}>
        <View style={st.camera}>
          {cameraOn ? (
            <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} active={cameraOn}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={busy ? undefined : onScan} />
          ) : null}
          {Platform.OS === "web" ? (
            <Hint style={{ color: "#CFC7B8", textAlign: "center", padding: 24 }}>The camera works in the Outsyde app on a phone. Here, use Type a code or the guest list.</Hint>
          ) : !perm ? (
            <ActivityIndicator color={GOLD} />
          ) : !perm.granted ? (
            <View style={{ alignItems: "center", gap: 12, padding: 24 }} testID="camera-off">
              <ThemedText style={{ color: "#F5F0E6", textAlign: "center", fontSize: 15, lineHeight: 22 }}>
                {perm.canAskAgain ? "Allow camera access to scan ticket QR codes." : "Camera access is off for Outsyde. Turn it on in Settings to scan, or type a code."}
              </ThemedText>
              <PrimaryButton label={perm.canAskAgain ? "Allow camera" : "Open Settings"} onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
            </View>
          ) : null}
          <View pointerEvents="none" style={st.frame}>
            <View style={[st.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 }]} />
            <View style={[st.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 }]} />
            <View style={[st.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 }]} />
            <View style={[st.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 }]} />
          </View>
          {cameraOn ? <ThemedText style={st.aim}>Point the camera at a ticket QR code</ThemedText> : null}
          {busy ? <View style={st.busy}><ActivityIndicator color={GOLD} /></View> : null}
        </View>

        <View style={st.twoBtns}>
          <DarkButton label="Type a code" onPress={() => { setTyped(""); setTyping(true); }} />
          <DarkButton label="Guest list" onPress={() => { setQuery(""); setListOpen(true); }} />
        </View>

        {last.length > 0 ? (
          <View style={{ gap: 6, paddingBottom: insets.bottom + 8 }}>
            <ThemedText style={st.lastHead}>LAST SCANS</ThemedText>
            {last.map(({ key, r }) => (
              <View key={key} style={st.lastRow}>
                <ThemedText style={{ color: "#F5F0E6", fontSize: 13, flex: 1 }} numberOfLines={1}>{r.who || r.detail}</ThemedText>
                <ThemedText style={{ color: LAST_SCAN_COLOR[r.tone], fontWeight: "700", fontSize: 13 }}>{lastScanLabel(r)}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Type a code */}
      <Modal visible={typing} transparent animationType="slide" onRequestClose={() => setTyping(false)}>
        <Pressable style={st.backdrop} onPress={() => setTyping(false)} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[st.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <ThemedText style={st.sheetTitle} accessibilityRole="header">Type a code</ThemedText>
          <Hint>The 16 letters and numbers under the guest's QR code.</Hint>
          <TextInput value={typed} onChangeText={(v) => setTyped(cleanTyped(v))} autoCapitalize="characters" autoCorrect={false} autoFocus
            maxLength={CODE_LENGTH} placeholder="ABCD1234EFGH5678" placeholderTextColor={theme.textSecondary} accessibilityLabel="Ticket code"
            style={[st.codeIn, { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundDefault }]} testID="code-input"
            onSubmitEditing={() => { if (typed.length === CODE_LENGTH) { setTyping(false); checkIn({ code: typed }); } }} />
          <PrimaryButton label="Check in" disabled={typed.length !== CODE_LENGTH} onPress={() => { setTyping(false); checkIn({ code: typed }); }} />
          <TextButton center label="Cancel" onPress={() => setTyping(false)} />
        </View>
      </Modal>

      {/* Guest list */}
      <Modal visible={listOpen} animationType="slide" onRequestClose={() => setListOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.backgroundRoot, paddingTop: insets.top + 8 }}>
          <View style={st.listHead}>
            <ThemedText style={st.sheetTitle} accessibilityRole="header">{`Guest list (${checkedIn} of ${guests.length} in)`}</ThemedText>
            <TextButton label="Done" gold onPress={() => setListOpen(false)} />
          </View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by name, @username or ticket" placeholderTextColor={theme.textSecondary}
            autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search guests"
            style={[st.search, { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundDefault }]} />
          {undoError ? <View style={{ paddingHorizontal: 16 }}><ErrorText>{undoError}</ErrorText></View> : null}
          <FlatList data={shown} keyExtractor={(g) => g.ticketId} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
            ListEmptyComponent={<Hint style={{ paddingVertical: 16 }}>{guests.length === 0 ? "No guests yet." : "No guest matches that search."}</Hint>}
            renderItem={({ item: g }) => (
              <View style={[st.gRow, { borderBottomColor: theme.border }]} testID="scan-guest">
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <ThemedText style={hostStyles.strong} numberOfLines={1}>{guestName(g)}</ThemedText>
                  <Hint>{g.checkedInAt ? `${guestLine(g)} · In at ${timeOnly(g.checkedInAt, info.timezone)}` : guestLine(g)}</Hint>
                </View>
                {g.checkedInAt
                  ? (isHost ? <OutlineButton label="Undo" disabled={busy} onPress={() => undo(g)} /> : <ThemedText style={{ color: theme.success, fontWeight: "700" }}>In</ThemedText>)
                  : <OutlineButton label="Check in" disabled={busy} onPress={() => { setListOpen(false); checkIn({ ticketId: g.ticketId }); }} />}
              </View>
            )} />
        </View>
      </Modal>
    </View>
  );
}

/** The scanner is always dark (canvas 14), in light mode too: its own buttons keep light text. */
function DarkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [st.darkBtn, { opacity: pressed ? 0.75 : 1 }]}>
      <ThemedText style={{ color: "#F5F0E6", fontSize: 14, fontWeight: "600" }}>{label}</ThemedText>
    </Pressable>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#F5F0E6", fontSize: 17, fontWeight: "700" },
  topSub: { color: "#A0A0A0", fontSize: 12 },
  countRow: { flexDirection: "row", justifyContent: "space-between" },
  bar: { height: 6, borderRadius: 3, backgroundColor: "#2A2A2A", overflow: "hidden" },
  camera: { flex: 1, borderRadius: 22, overflow: "hidden", backgroundColor: "#1A1F1D", alignItems: "center", justifyContent: "center", minHeight: 260 },
  frame: { position: "absolute", width: 230, height: 230 },
  corner: { position: "absolute", width: 44, height: 44, borderColor: GOLD },
  aim: { position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center", color: "#F5F0E6", fontSize: 14, fontWeight: "600" },
  busy: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  twoBtns: { flexDirection: "row", gap: 10 },
  darkBtn: { flex: 1, minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: "#38383A", backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center" },
  lastHead: { color: "#A0A0A0", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  lastRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  result: { flex: 1, marginHorizontal: 16, marginTop: 8, borderRadius: 26, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  resultIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  resultTitle: { color: "#FFFFFF", fontSize: 34, fontWeight: "800", textAlign: "center", lineHeight: 40 },
  resultWho: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center" },
  resultDetail: { color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 290 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  codeIn: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 18, letterSpacing: 2, fontWeight: "600" },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, marginHorizontal: 16, marginBottom: 8 },
  gRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

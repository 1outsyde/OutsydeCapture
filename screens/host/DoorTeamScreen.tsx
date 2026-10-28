/**
 * The host's door team for one event (Events canvas 38). Same data and rules as goutsyde.com/events/[id]/team.
 * Invite by username, for all my events or only this event (backend 075: they scan once they accept). Rows show
 * on the team (Remove), invited (Cancel invite) or said no (Invite again). Remove and cancel confirm first.
 * Host only: GET /door/team answers 404 for anyone else.
 */
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { Centered, Chip, ErrorText, Field, GOLD, Hint, HostHeader, OkText, OutlineButton, PrimaryButton, TextButton, hostStyles } from "@/components/host/hostUi";
import { GENERIC_ERROR } from "@/utils/eventsLogic";
import { failureCopy, flatError } from "@/utils/host/editorLogic";
import { backendMessage, guestName } from "@/utils/host/manageLogic";
import {
  USERNAME_MAX, cancelInviteCopy, cleanUsername, inviteSentCopy, isTeamMember, makeGate, memberAction, memberStatus, memberStatusLine,
  removeConfirmCopy, type Scope, type TeamMember,
} from "@/utils/host/doorLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = "loading" | "ready" | "notfound" | "error";
type Ask = { member: TeamMember; scope: Scope } | null;

export default function DoorTeamScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { eventId } = useRoute<RouteProp<RootStackParamList, "DoorTeam">>().params;
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [standing, setStanding] = useState<TeamMember[]>([]);
  const [eventOnly, setEventOnly] = useState<TeamMember[]>([]);
  const [username, setUsername] = useState("");
  const [scope, setScope] = useState<Scope>("event");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [working, setWorking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const gate = useRef(makeGate()).current;

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setPhase("loading"); setLoadError(null); }
    const t = await token();
    if (!t) return;
    try {
      const r = await api.getDoorTeam(eventId, t);
      setStanding(Array.isArray(r?.standing) ? (r.standing as unknown[]).filter(isTeamMember) : []);
      setEventOnly(Array.isArray(r?.event) ? (r.event as unknown[]).filter(isTeamMember) : []);
      setPhase("ready");
      // Only the host gets here (door/team is host only), so /manage is asked just for the title.
      api.getManageEvent(eventId, t).then((m) => setTitle(typeof m?.event?.title === "string" ? m.event.title : null)).catch(() => {});
    } catch (e) {
      const f = flatError(e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return; }
      if (f.status === 404) { setPhase("notfound"); return; }
      setLoadError(failureCopy(f.status, f.body).message);
      setPhase("error");
    }
  }, [eventId, token, navigation]);

  const loaded = useRef(false);
  useFocusEffect(useCallback(() => { load(loaded.current); loaded.current = true; }, [load]));

  /** Sends an invite; an "invite again" replaces the declined row instead of adding one. Returns an error or null. */
  async function sendInvite(name: string, s: Scope): Promise<string | null> {
    const t = await token();
    if (!t) return null;
    try {
      const r = await api.inviteDoorMember(eventId, name, s, t);
      if (!r?.success || !isTeamMember(r.member)) return GENERIC_ERROR;
      const m = r.member as TeamMember;
      const upsert = (l: TeamMember[]) => (l.some((x) => x.userId === m.userId) ? l.map((x) => (x.userId === m.userId ? m : x)) : [...l, m]);
      if (s === "standing") setStanding(upsert); else setEventOnly(upsert);
      setNotice(inviteSentCopy(m));
      return null;
    } catch (e) {
      const f = flatError(e);
      return backendMessage(f.status, f.body);
    }
  }

  async function send() {
    const name = cleanUsername(username);
    if (!name || !gate.enter()) return;
    setSending(true); setSendError(null); setNotice(null); setRowError(null);
    const err = await sendInvite(name, scope);
    gate.leave(); setSending(false);
    if (err) setSendError(err); else setUsername("");
  }

  async function inviteAgain(m: TeamMember, s: Scope) {
    if (!m.username || !gate.enter()) return;
    setSending(true); setRowError(null); setNotice(null);
    const err = await sendInvite(m.username, s);
    gate.leave(); setSending(false);
    if (err) setRowError(err);
  }

  async function confirm() {
    if (!ask || !gate.enter()) return;
    setWorking(true); setAskError(null);
    const t = await token();
    if (!t) { gate.leave(); setWorking(false); return; }
    const { member: m, scope: s } = ask;
    try {
      await api.removeDoorMember(eventId, m.userId, s, t);
      gone(m, s);
    } catch (e) {
      const f = flatError(e);
      // NOT_ON_TEAM: they're already gone, drop them from the list as well.
      if (f.body?.code === "NOT_ON_TEAM") gone(m, s);
      else setAskError(backendMessage(f.status, f.body));
    } finally {
      gate.leave(); setWorking(false);
    }
  }

  function gone(m: TeamMember, s: Scope) {
    if (s === "standing") setStanding((l) => l.filter((x) => x.userId !== m.userId));
    else setEventOnly((l) => l.filter((x) => x.userId !== m.userId));
    setNotice(memberStatus(m) === "invited" ? `${guestName(m)}'s invite was cancelled.` : `${guestName(m)} was removed from the door team.`);
    setAsk(null);
  }

  const root = (children: React.ReactNode) => <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>{children}</View>;
  const header = <HostHeader left={{ icon: "chevron-left", label: "Back", onPress: () => navigation.goBack() }} title="Door team" sub={title ?? undefined} />;

  if (phase === "loading") return root(<>{header}<Centered><ActivityIndicator color={GOLD} /></Centered></>);
  if (phase === "notfound") {
    return root(<>{header}<Centered>
      <ThemedText style={hostStyles.h1} accessibilityRole="header">EVENT NOT FOUND</ThemedText>
      <ThemedText style={[hostStyles.body, { textAlign: "center" }]}>Event not found. It may have been removed, or it belongs to another account.</ThemedText>
      <PrimaryButton label="Your events" onPress={() => navigation.navigate("YourEvents")} style={{ alignSelf: "stretch" }} />
    </Centered></>);
  }
  if (phase === "error") {
    return root(<>{header}<Centered>
      <ErrorText>{loadError ?? GENERIC_ERROR}</ErrorText>
      <PrimaryButton label="Try again" onPress={() => load()} style={{ alignSelf: "stretch" }} />
    </Centered></>);
  }

  const list = (members: TeamMember[], s: Scope, label: string, empty: string) => (
    <View style={{ gap: 2 }} testID={`team-${s}`}>
      <ThemedText style={[hostStyles.section, { color: theme.textSecondary }]} accessibilityRole="header">{label}</ThemedText>
      {members.length === 0 ? <Hint style={{ paddingVertical: 8 }}>{empty}</Hint> : null}
      {members.map((m) => {
        const action = memberAction(m);
        const invited = memberStatus(m) === "invited";
        return (
          <View key={m.userId} style={[st.row, { borderBottomColor: theme.border }]} testID="team-row">
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <ThemedText style={hostStyles.strong} numberOfLines={1}>{guestName(m)}</ThemedText>
              <ThemedText style={{ fontSize: 13, lineHeight: 18, color: invited ? theme.brandGold : theme.textSecondary }}>{memberStatusLine(m, s)}</ThemedText>
            </View>
            <OutlineButton label={action} disabled={sending || working}
              onPress={() => { if (action === "Invite again") inviteAgain(m, s); else { setAskError(null); setAsk({ member: m, scope: s }); } }} />
          </View>
        );
      })}
    </View>
  );

  const cancelling = ask ? memberStatus(ask.member) === "invited" : false;
  return root(
    <>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 18 }} keyboardShouldPersistTaps="handled">
        <Hint>People you invite can scan tickets and see the guest list once they accept. They can't see sales, earnings or edit the event.</Hint>
        <View style={{ gap: 10 }}>
          <Field label="INVITE SOMEONE" value={username} placeholder="@username" autoCapitalize="none" autoCorrect={false} autoComplete="off"
            maxLength={username.startsWith("@") ? USERNAME_MAX + 1 : USERNAME_MAX}
            onChangeText={(v) => { setUsername(v); setSendError(null); }} onSubmitEditing={send} returnKeyType="send" />
          <View style={st.chips} accessibilityRole="radiogroup" accessibilityLabel="Access">
            <Chip label="All my events" on={scope === "standing"} onPress={() => setScope("standing")} />
            <Chip label="Only this event" on={scope === "event"} onPress={() => setScope("event")} />
          </View>
          <Hint>{scope === "standing" ? "Once they accept, they can scan every event you host until you remove them." : "Once they accept, they can scan this event until it ends."}</Hint>
          <PrimaryButton label={sending ? "Sending…" : "Send invite"} busy={sending} disabled={!cleanUsername(username)} onPress={send} />
          {sendError ? <ErrorText>{sendError}</ErrorText> : null}
        </View>
        {notice ? <OkText>{notice}</OkText> : null}
        {rowError ? <ErrorText>{rowError}</ErrorText> : null}
        {list(standing, "standing", "YOUR TEAM, ALL EVENTS", "No one yet. Invite someone with All my events to have them at every event.")}
        {list(eventOnly, "event", "ONLY THIS EVENT", "No one invited just for this event.")}
      </ScrollView>

      <Modal visible={!!ask} transparent animationType="slide" onRequestClose={() => { if (!working) setAsk(null); }}>
        <Pressable style={st.backdrop} onPress={() => !working && setAsk(null)} accessibilityRole="button" accessibilityLabel="Close" />
        {ask ? (
          <View style={[st.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
            <ThemedText style={st.sheetTitle} accessibilityRole="header">{cancelling ? "Cancel this invite?" : "Remove from the door team?"}</ThemedText>
            <ThemedText style={hostStyles.body}>{cancelling ? cancelInviteCopy(ask.member) : removeConfirmCopy(ask.member, ask.scope)}</ThemedText>
            {askError ? <ErrorText>{askError}</ErrorText> : null}
            <PrimaryButton label={working ? (cancelling ? "Cancelling…" : "Removing…") : cancelling ? "Yes, cancel invite" : "Yes, remove"} busy={working} onPress={confirm} />
            <TextButton center label={cancelling ? "Keep invite" : "Keep"} disabled={working} onPress={() => setAsk(null)} />
          </View>
        ) : null}
      </Modal>
    </>,
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
});

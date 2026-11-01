/**
 * An Event team invite for any role (p4-team step 9c-1, mockup E; route name DoorInvite kept so pushes already sent
 * still open it), from its push, its Activity item or the Event team screen. Every call sends ?roles=all (the backend
 * answers 404 for non Admissions invites without it). States: invited (Accept, Decline), accepted (Open the scanner for
 * Admissions, Open your event page for other roles, Leave), declined and gone (Done).
 * Only the person invited can open it (backend answers 404 for anyone else).
 * Step 9d-3 (calls 84, 86): an invite that offers pay shows the Event Team note above one "Accept and join" (join
 * first, then the note); a failed note save leaves them on the team and the note waits on their event page. The note
 * loads on its own, so a slow answer never holds up the invite.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { Centered, ErrorText, GOLD, Hint, HostHeader, OutlineButton, PrimaryButton, TextButton, hostStyles } from "@/components/host/hostUi";
import { GENERIC_ERROR } from "@/utils/eventsLogic";
import { failureCopy, flatError } from "@/utils/host/editorLogic";
import { backendMessage } from "@/utils/host/manageLogic";
import { makeGate } from "@/utils/host/doorLogic";
import { inviteAfter, isTeamInvite, memberInviteCopy, type TeamInvite } from "@/utils/host/memberLogic";
import {
  acceptLabel,
  isTeamNote,
  noteOnAccept,
  NOTE_SAVE_FAILED,
  type TeamNote,
} from "@/utils/host/teamNoteLogic";
import TeamNoteCard from "@/components/host/TeamNoteCard";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DoorInviteScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { inviteId } = useRoute<RouteProp<RootStackParamList, "DoorInvite">>().params;
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);

  const [invite, setInvite] = useState<TeamInvite | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "accept" | "decline" | "leave">(null);
  const [error, setError] = useState<string | null>(null);
  const [askLeave, setAskLeave] = useState(false);
  const [left, setLeft] = useState(false);
  // The Event Team note (null until loaded or when it fails: accepting still works, just without the card).
  const [note, setNote] = useState<TeamNote | null>(null);
  const [noteNotice, setNoteNotice] = useState<string | null>(null);
  const gate = useRef(makeGate()).current;
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  const load = useCallback(async (): Promise<TeamInvite | null> => {
    const t = await token();
    if (!t) return null;
    // The note loads on its own: a slow answer never holds up the invite (its card just appears when it arrives).
    api.getTeamNote(t).then(
      (n) => {
        if (live.current) setNote(isTeamNote(n?.note) ? n.note : null);
      },
      () => {
        if (live.current) setNote(null);
      },
    );
    try {
      const r = await api.getTeamInvite(inviteId, t);
      if (!isTeamInvite(r?.invite)) throw { status: 500 };
      setInvite(r.invite);
      setPhase("ready");
      return r.invite;
    } catch (e) {
      const f = flatError(e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return null; }
      if (f.status === 404) { setPhase("notfound"); return null; }
      setLoadError(failureCopy(f.status, f.body).message);
      setPhase("error");
    }
    return null;
  }, [inviteId, token, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Call 84: joined first; now the note they saw above Accept and join. A failure here never undoes joining. */
  async function saveNote(seen: TeamNote, t: string) {
    const saved = await api.acceptTeamNote(seen.version, t).then(
      (n) => !!n?.success,
      () => false,
    );
    if (!live.current) return;
    if (saved) setNote({ ...seen, accepted: true });
    else {
      setNoteNotice(NOTE_SAVE_FAILED);
      AccessibilityInfo.announceForAccessibility(NOTE_SAVE_FAILED);
    }
  }

  async function answer(a: "accept" | "decline" | "leave") {
    if (!gate.enter()) return;
    setBusy(a); setError(null); setNoteNotice(null);
    const t = await token();
    if (!t) { gate.leave(); setBusy(null); return; }
    const withNote =
      a === "accept" && !!invite && noteOnAccept(invite.pay, note);
    try {
      const r = await api.answerTeamInvite(inviteId, a, t);
      if (isTeamInvite(r?.invite)) setInvite(r.invite);
      if (withNote && note) await saveNote(note, t);
      if (a === "leave") setLeft(true);
      setAskLeave(false);
    } catch (e) {
      const f = flatError(e);
      setError(backendMessage(f.status, f.body));
      setAskLeave(false);
      // Closed meanwhile (cancelled by the host, the event ended, or answered on another device): show the fresh
      // state, and drop the error when it already is what was asked (accepted on goutsyde.com at the same time).
      if (f.status === 409) {
        const fresh = await load();
        const wanted = a === "accept" ? "accepted" : a === "decline" ? "declined" : "gone";
        if (fresh?.status === wanted) {
          setError(null);
          // Accepted on another device at the same moment: they still saw the note here and tapped Accept and join.
          if (withNote && note) await saveNote(note, t);
        }
      }
    } finally {
      gate.leave(); setBusy(null);
    }
  }

  function openNext() {
    if (!invite) return;
    const next = inviteAfter(invite);
    if (next.to === "scanner") navigation.navigate("DoorScanner", { eventId: next.eventId });
    else if (next.to === "myTeam") navigation.navigate("MyTeam", { eventId: next.eventId });
    else navigation.navigate("DoorEvents");
  }

  const root = (children: React.ReactNode) => <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>{children}</View>;
  const header = <HostHeader left={{ icon: "x", label: "Close", onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Main" as never)) }} title="Event team invite" />;

  if (phase === "loading") return root(<>{header}<Centered><ActivityIndicator color={GOLD} /></Centered></>);
  if (phase === "notfound") {
    return root(<>{header}<Centered>
      <ThemedText style={hostStyles.h1} accessibilityRole="header">INVITE NOT FOUND</ThemedText>
      <ThemedText style={[hostStyles.body, { textAlign: "center" }]}>This invite isn't for this account, or it doesn't exist.</ThemedText>
      <PrimaryButton label="Done" onPress={() => navigation.goBack()} style={{ alignSelf: "stretch" }} />
    </Centered></>);
  }
  if (phase === "error" || !invite) {
    return root(<>{header}<Centered>
      <ErrorText>{loadError ?? GENERIC_ERROR}</ErrorText>
      <PrimaryButton label="Try again" onPress={() => { load(); }} style={{ alignSelf: "stretch" }} />
    </Centered></>);
  }

  // Just left: say so (the backend now reports the invite as gone, whose copy is about the host cancelling).
  const c = memberInviteCopy(invite, left);
  const next = inviteAfter(invite);
  const nextLabel = next.to === "scanner" ? "Open the scanner" : next.to === "myTeam" ? "Open your event page" : "Open Event team";
  const withNote = c.state === "invited" && noteOnAccept(invite.pay, note);
  return root(
    <>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, flexGrow: 1 }}>
        <View style={{ alignItems: "center", gap: 12, paddingTop: 8 }}>
          <View style={[st.badge, { backgroundColor: theme.backgroundDefault }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Feather name={c.state === "accepted" ? "check" : c.state === "invited" ? "users" : "slash"} size={30} color={c.state === "accepted" ? theme.success : theme.brandGold} />
          </View>
          <ThemedText style={st.headline} accessibilityRole="header" testID="invite-headline">{c.headline}</ThemedText>
          <ThemedText style={[hostStyles.body, { color: theme.textSecondary, textAlign: "center", maxWidth: 320 }]}>{c.body}</ThemedText>
        </View>
        <View style={[st.card, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[hostStyles.section, { color: theme.textSecondary, fontSize: 12 }]}>{c.scopeLabel}</ThemedText>
          {c.events.map((e) => (
            <View key={e.id} style={st.evRow}>
              <ThemedText style={[hostStyles.strong, { flex: 1 }]} numberOfLines={2}>{e.title}</ThemedText>
              <ThemedText style={{ fontSize: 14, color: theme.textSecondary }}>{e.when}</ThemedText>
            </View>
          ))}
          {c.state !== "gone" && c.events.length === 0 ? <Hint>No upcoming events yet.</Hint> : null}
          {c.pay && c.state !== "gone" ? <ThemedText style={hostStyles.strong} testID="invite-pay">{c.pay}</ThemedText> : null}
          {c.privacy && c.state !== "gone" ? <Hint>{c.privacy}</Hint> : null}
        </View>
        {withNote && note ? (
          <TeamNoteCard note={note} testID="invite-note" />
        ) : null}
        {noteNotice ? (
          <View accessibilityLiveRegion="polite">
            <Hint warn>{noteNotice}</Hint>
          </View>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 8 }}>
        {c.state === "invited" ? (
          <>
            <PrimaryButton label={busy === "accept" ? "Accepting…" : acceptLabel(withNote)} busy={busy === "accept"} disabled={!!busy} onPress={() => answer("accept")} />
            <OutlineButton label={busy === "decline" ? "Declining…" : "Decline"} disabled={!!busy} onPress={() => answer("decline")} />
          </>
        ) : null}
        {c.state === "accepted" ? (
          <>
            <PrimaryButton label={nextLabel} onPress={openNext} />
            <TextButton center label="Leave this Event team" onPress={() => { setError(null); setAskLeave(true); }} />
          </>
        ) : null}
        {c.state === "declined" || c.state === "gone" ? <OutlineButton label="Done" onPress={() => navigation.goBack()} /> : null}
      </View>

      <Modal visible={askLeave} transparent animationType="slide" onRequestClose={() => { if (!busy) setAskLeave(false); }}>
        <Pressable style={st.backdrop} onPress={() => !busy && setAskLeave(false)} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[st.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <ThemedText style={st.sheetTitle} accessibilityRole="header">Leave this Event team?</ThemedText>
          <ThemedText style={hostStyles.body}>{`You'll come off the Event team for ${invite.scope === "event" && invite.event ? invite.event.title : `${invite.host.name}'s events`}. The host can invite you again.`}</ThemedText>
          <PrimaryButton label={busy === "leave" ? "Leaving…" : "Yes, leave"} busy={busy === "leave"} onPress={() => answer("leave")} />
          <TextButton center label="Stay on the team" disabled={!!busy} onPress={() => setAskLeave(false)} />
        </View>
      </Modal>
    </>,
  );
}

const st = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  headline: { fontSize: 24, fontWeight: "800", lineHeight: 30, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  evRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
});

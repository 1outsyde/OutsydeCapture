/**
 * A door team invite (Events canvas 39), opened from its push, its Activity item or Door check in.
 * States: invited (Accept, Decline), accepted (Open the scanner, Leave this door team), declined and gone (Done).
 * Only the person invited can open it (backend answers 404 for anyone else).
 */
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { inviteScreenCopy, isDoorInvite, type DoorInvite } from "@/utils/host/doorLogic";

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

  const [invite, setInvite] = useState<DoorInvite | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "accept" | "decline" | "leave">(null);
  const [error, setError] = useState<string | null>(null);
  const [askLeave, setAskLeave] = useState(false);
  const [left, setLeft] = useState(false);

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  const load = useCallback(async () => {
    const t = await token();
    if (!t) return;
    try {
      const r = await api.getDoorInvite(inviteId, t);
      if (!isDoorInvite(r?.invite)) throw { status: 500 };
      setInvite(r.invite);
      setPhase("ready");
    } catch (e) {
      const f = flatError(e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return; }
      if (f.status === 404) { setPhase("notfound"); return; }
      setLoadError(failureCopy(f.status, f.body).message);
      setPhase("error");
    }
  }, [inviteId, token, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function answer(a: "accept" | "decline" | "leave") {
    if (busy) return;
    const t = await token();
    if (!t) return;
    setBusy(a); setError(null);
    try {
      const r = await api.answerDoorInvite(inviteId, a, t);
      if (isDoorInvite(r?.invite)) setInvite(r.invite);
      if (a === "leave") setLeft(true);
      setAskLeave(false);
    } catch (e) {
      const f = flatError(e);
      setError(backendMessage(f.status, f.body));
      setAskLeave(false);
      // Closed meanwhile (cancelled by the host, the event ended): show the fresh state.
      if (f.status === 409) load();
    } finally {
      setBusy(null);
    }
  }

  function openScanner() {
    if (!invite) return;
    if (invite.scope === "event" && invite.event) navigation.navigate("DoorScanner", { eventId: invite.event.id });
    else navigation.navigate("DoorEvents");
  }

  const root = (children: React.ReactNode) => <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>{children}</View>;
  const header = <HostHeader left={{ icon: "x", label: "Close", onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Main" as never)) }} title="Door team invite" />;

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
      <PrimaryButton label="Try again" onPress={load} style={{ alignSelf: "stretch" }} />
    </Centered></>);
  }

  const base = inviteScreenCopy(invite);
  // Just left: say so (the backend now reports the invite as gone, whose copy is about the host cancelling).
  const c = left && base.state === "gone" ? { ...base, headline: "You left the door team", body: `${invite.host.name} can invite you again.` } : base;
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
          <Hint>You'll be able to scan tickets and see the guest list. You won't see sales, earnings or anyone's contact details.</Hint>
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 8 }}>
        {c.state === "invited" ? (
          <>
            <PrimaryButton label={busy === "accept" ? "Accepting…" : "Accept"} busy={busy === "accept"} disabled={!!busy} onPress={() => answer("accept")} />
            <OutlineButton label={busy === "decline" ? "Declining…" : "Decline"} disabled={!!busy} onPress={() => answer("decline")} />
          </>
        ) : null}
        {c.state === "accepted" ? (
          <>
            <PrimaryButton label="Open the scanner" onPress={openScanner} />
            <TextButton center label="Leave this door team" onPress={() => { setError(null); setAskLeave(true); }} />
          </>
        ) : null}
        {c.state === "declined" || c.state === "gone" ? <OutlineButton label="Done" onPress={() => navigation.goBack()} /> : null}
      </View>

      <Modal visible={askLeave} transparent animationType="slide" onRequestClose={() => { if (!busy) setAskLeave(false); }}>
        <Pressable style={st.backdrop} onPress={() => !busy && setAskLeave(false)} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[st.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <ThemedText style={st.sheetTitle} accessibilityRole="header">Leave this door team?</ThemedText>
          <ThemedText style={hostStyles.body}>{`You won't be able to scan tickets for ${invite.scope === "event" && invite.event ? invite.event.title : `${invite.host.name}'s events`}. The host can invite you again.`}</ThemedText>
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

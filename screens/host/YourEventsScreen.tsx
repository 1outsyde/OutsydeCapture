/**
 * Events you host (Events canvas 30): drafts, upcoming, past and cancelled. From the EVENTS tab and the Account menu.
 * Step 9c-1 (call 63): CO-HOSTING, events I co-host (GET /api/events/cohosting), each opening Manage, like goutsyde.com
 * MineClient. A failed co-hosting call leaves that list empty; my own events still show.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { Centered, ErrorText, GOLD, HostHeader, PrimaryButton, TextButton, hostStyles } from "@/components/host/hostUi";
import { EVENT_GREEN } from "@/components/events/eventColors";
import { failureCopy, flatError, isHostEvent, type HostEvent } from "@/utils/host/editorLogic";
import { groupMine, statusKind, statusLabel, takenLine, whenWhere } from "@/utils/host/manageLogic";
import { cohostingEvents } from "@/utils/host/memberLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function YourEventsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  // getToken changes on every auth update: a ref keeps the loaders stable.
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);
  const [events, setEvents] = useState<HostEvent[] | null>(null);
  const [cohosting, setCohosting] = useState<HostEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    const token = await getToken();
    if (!token) { navigation.navigate("Auth", {}); return; }
    try {
      const [r, c] = await Promise.all([
        api.getMyHostedEvents(token),
        api.getCohosting(token).catch(() => null),
      ]);
      if (mine !== seq.current) return;
      setCohosting(cohostingEvents(c));
      setEvents(Array.isArray(r?.events) ? (r.events as unknown[]).filter(isHostEvent) : []);
    } catch (e) {
      if (mine !== seq.current) return;
      const f = flatError(e);
      if (f.status === 401) navigation.navigate("Auth", {});
      setError(failureCopy(f.status, f.body).message);
    }
  }, [getToken, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const groups = useMemo(() => groupMine(events ?? []), [events]);
  const sections = [
    { key: "drafts", title: "DRAFTS", list: groups.drafts },
    { key: "upcoming", title: "UPCOMING", list: groups.upcoming },
    { key: "past", title: "PAST", list: groups.past },
    { key: "cancelled", title: "CANCELLED", list: groups.cancelled },
    { key: "cohosting", title: "CO-HOSTING", list: cohosting },
  ].filter((x) => x.list.length > 0);

  const host = () => navigation.navigate("EventEditor", undefined);
  // My drafts open the editor; everything else, and every co-hosted event (drafts too, like goutsyde.com), opens Manage.
  const open = (e: HostEvent, cohosted: boolean) =>
    e.status === "draft" && !cohosted
      ? navigation.navigate("EventEditor", { eventId: e.id })
      : navigation.navigate("ManageEvent", { eventId: e.id });

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>
      <HostHeader left={{ icon: "chevron-left", label: "Back", onPress: () => navigation.goBack() }} title="Your events"
        right={events && events.length > 0 ? <TextButton label="Host an event" gold onPress={host} /> : null} />
      {events === null && !error ? <Centered><ActivityIndicator color={GOLD} /></Centered> : null}
      {events === null && error ? (
        <Centered>
          <ErrorText>{error}</ErrorText>
          <PrimaryButton label="Try again" onPress={load} style={{ alignSelf: "stretch" }} />
        </Centered>
      ) : null}
      {events !== null && sections.length === 0 ? (
        <Centered>
          <ThemedText style={hostStyles.h1} accessibilityRole="header">NO EVENTS YET</ThemedText>
          <ThemedText style={[hostStyles.body, { textAlign: "center", color: theme.textSecondary }]}>Host your first event. Free RSVPs and paid tickets both work.</ThemedText>
          <PrimaryButton label="Host an event" onPress={host} style={{ alignSelf: "stretch" }} />
        </Centered>
      ) : null}
      {events !== null && sections.length > 0 ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 22 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {error ? <ErrorText>{error}</ErrorText> : null}
          {sections.map((sec) => (
            <View key={sec.key} style={{ gap: 10 }} accessibilityLabel={sec.title}>
              <ThemedText style={[hostStyles.section, { color: theme.textSecondary }]} accessibilityRole="header">{sec.title}</ThemedText>
              {sec.list.map((e) => <Row key={e.id} e={e} onPress={() => open(e, sec.key === "cohosting")} />)}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Row({ e, onPress }: { e: HostEvent; onPress: () => void }) {
  const { theme } = useTheme();
  const kind = statusKind(e);
  const chip = kind === "published" ? { bg: EVENT_GREEN, fg: "#BFE3D5" } : kind === "cancelled" ? { bg: "rgba(255,138,122,0.16)", fg: theme.error } : { bg: theme.border, fg: theme.text };
  const sub = e.status === "draft" ? "Finish it to publish" : e.status === "published" ? `${takenLine(e.takenCount, e.capacity)} taken` : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${e.title}, ${statusLabel(e)}`}
      style={({ pressed }) => [s.row, { borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <ThemedText style={hostStyles.strong} numberOfLines={2}>{e.title}</ThemedText>
        <ThemedText style={[s.sub, { color: theme.textSecondary }]}>{whenWhere(e)}</ThemedText>
        {sub ? <ThemedText style={[s.sub, { color: theme.brandGold }]}>{sub}</ThemedText> : null}
      </View>
      <View style={[s.chip, { backgroundColor: chip.bg }]}>
        <ThemedText style={[s.chipText, { color: chip.fg }]}>{statusLabel(e)}</ThemedText>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  sub: { fontSize: 13, lineHeight: 18 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
});

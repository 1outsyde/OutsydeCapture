/**
 * Door check in (Account menu, and "Open the scanner" on an all events invite). Same lists as goutsyde.com/events/door
 * (Events canvas 40): my open door team invites (tap to open, canvas 39) and the events I can scan (host, or an
 * accepted invite; published and not ended), each opening the scanner.
 */
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { Centered, ErrorText, GOLD, Hint, HostHeader, PrimaryButton, hostStyles } from "@/components/host/hostUi";
import { GENERIC_ERROR } from "@/utils/eventsLogic";
import { failureCopy, flatError, whenRange } from "@/utils/host/editorLogic";
import { inviteScreenCopy, isDoorEvent, isDoorInvite, roleLabel, scanWindowNote, type DoorEvent, type DoorInvite } from "@/utils/host/doorLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DoorEventsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);

  const [events, setEvents] = useState<DoorEvent[] | null>(null);
  const [invites, setInvites] = useState<DoorInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const t = await getToken();
    if (!t) { navigation.navigate("Auth", {}); return; }
    const [m, i] = await Promise.all([
      api.getDoorEvents(t).then((b) => ({ ok: true as const, b }), (e) => ({ ok: false as const, e })),
      api.getDoorInvites(t).then((b) => b, () => null),
    ]);
    if (!m.ok) {
      const f = flatError(m.e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return; }
      setError(failureCopy(f.status, f.body).message);
      return;
    }
    setEvents(Array.isArray(m.b?.events) ? (m.b.events as unknown[]).filter(isDoorEvent) : []);
    // Invites are extra: if that call fails the scan list still shows.
    setInvites(Array.isArray(i?.invites) ? (i.invites as unknown[]).filter(isDoorInvite).filter((x) => x.status === "invited") : []);
  }, [getToken, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = <HostHeader left={{ icon: "chevron-left", label: "Back", onPress: () => navigation.goBack() }} title="Door check in" />;
  const root = (children: React.ReactNode) => <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>{header}{children}</View>;

  if (events === null && !error) return root(<Centered><ActivityIndicator color={GOLD} /></Centered>);
  if (error && events === null) {
    return root(<Centered><ErrorText>{error ?? GENERIC_ERROR}</ErrorText><PrimaryButton label="Try again" onPress={load} style={{ alignSelf: "stretch" }} /></Centered>);
  }

  return root(
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {invites.length > 0 ? (
        <View style={{ gap: 10 }} testID="door-invites">
          <ThemedText style={[hostStyles.section, { color: theme.textSecondary }]} accessibilityRole="header">INVITES FOR YOU</ThemedText>
          {invites.map((inv) => {
            const c = inviteScreenCopy(inv);
            return (
              <Pressable key={inv.id} onPress={() => navigation.navigate("DoorInvite", { inviteId: inv.id })} accessibilityRole="button"
                accessibilityLabel={`${c.headline}. Open to accept or decline`}
                style={({ pressed }) => [st.invite, { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 }]} testID="door-invite">
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText style={hostStyles.strong}>{c.headline}</ThemedText>
                  <Hint>{inv.scope === "event" && inv.event ? `Only this event: ${inv.event.title}, ${c.events[0]?.when ?? ""}` : `All of ${inv.host.name}'s events`}</Hint>
                </View>
                <ThemedText style={{ color: theme.brandGold, fontWeight: "700", fontSize: 14 }}>Open</ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 10 }} testID="door-events">
        <ThemedText style={[hostStyles.section, { color: theme.textSecondary }]} accessibilityRole="header">EVENTS YOU CAN SCAN</ThemedText>
        {events && events.length === 0 ? <Hint>When you host an event, or accept a host's door team invite, the event shows up here until it ends.</Hint> : null}
        {(events ?? []).map((e) => {
          const note = scanWindowNote(e);
          return (
            <Pressable key={e.id} onPress={() => navigation.navigate("DoorScanner", { eventId: e.id })} accessibilityRole="button"
              style={({ pressed }) => [st.row, { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 }]} testID="door-row">
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <ThemedText style={hostStyles.strong} numberOfLines={2}>{e.title}</ThemedText>
                <Hint>{whenRange(e.startsAt, e.endsAt, e.timezone)}</Hint>
                <Hint>{`${roleLabel(e.role)} · ${note ?? "Check in is open."}`}</Hint>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>,
  );
}

const st = StyleSheet.create({
  invite: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: GOLD },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, minHeight: 68 },
});

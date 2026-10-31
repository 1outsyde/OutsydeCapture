/**
 * Event team (p4-team step 9c-1, mockup D; route name DoorEvents kept so pushes already sent still open it). Same lists
 * as goutsyde.com/events/door:
 *   INVITES FOR YOU   GET /door/invites?roles=all: open invites for every role, with the pay offered (tap to answer).
 *   YOUR EVENTS       GET /door/mine?roles=all: events I host or am on the team for, upcoming. Each row: Open (my page
 *                     for that event), Scan (Admissions, co-hosts and the host, until the end), Manage (host, co-host).
 *   RECENTLY ENDED    the same list, ended in the last 14 days (the pay is worked out 3 days after).
 */
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import {
  Centered,
  ErrorText,
  GOLD,
  Hint,
  HostHeader,
  PrimaryButton,
  hostStyles,
} from "@/components/host/hostUi";
import { GENERIC_ERROR } from "@/utils/eventsLogic";
import { failureCopy, flatError, whenRange } from "@/utils/host/editorLogic";
import { scanWindowNote } from "@/utils/host/doorLogic";
import {
  isTeamEvent,
  teamInviteHeadline,
  teamInviteLine,
  teamRolesLine,
  type TeamEvent,
} from "@/utils/host/teamLogic";
import {
  isTeamInvite,
  rowActions,
  splitTeamEvents,
  type TeamInvite,
} from "@/utils/host/memberLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DoorEventsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);

  const [events, setEvents] = useState<TeamEvent[] | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    const t = await getToken();
    if (!t) {
      navigation.navigate("Auth", {});
      return;
    }
    const [m, i] = await Promise.all([
      api.getTeamEvents(t).then(
        (b) => ({ ok: true as const, b }),
        (e) => ({ ok: false as const, e }),
      ),
      api.getTeamInvites(t).then(
        (b) => b,
        () => null,
      ),
    ]);
    if (mine !== seq.current) return;
    if (!m.ok) {
      const f = flatError(m.e);
      if (f.status === 401) {
        navigation.navigate("Auth", {});
        return;
      }
      setError(failureCopy(f.status, f.body).message);
      return;
    }
    setEvents(
      Array.isArray(m.b?.events)
        ? (m.b.events as unknown[]).filter(isTeamEvent)
        : [],
    );
    // Invites are extra: if that call fails the list still shows.
    setInvites(
      Array.isArray(i?.invites)
        ? (i.invites as unknown[])
            .filter(isTeamInvite)
            .filter((x) => x.status === "invited")
        : [],
    );
  }, [getToken, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const header = (
    <HostHeader
      left={{
        icon: "chevron-left",
        label: "Back",
        onPress: () => navigation.goBack(),
      }}
      title="Event team"
    />
  );
  const root = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {header}
      {children}
    </View>
  );

  if (events === null && !error)
    return root(
      <Centered>
        <ActivityIndicator color={GOLD} />
      </Centered>,
    );
  if (error && events === null) {
    return root(
      <Centered>
        <ErrorText>{error ?? GENERIC_ERROR}</ErrorText>
        <PrimaryButton
          label="Try again"
          onPress={load}
          style={{ alignSelf: "stretch" }}
        />
      </Centered>,
    );
  }

  const { upcoming, past } = splitTeamEvents(events ?? []);

  const row = (e: TeamEvent) => {
    const a = rowActions(e);
    const note = a.scan ? scanWindowNote(e) : null;
    const actions: { key: string; label: string; go: () => void }[] = [];
    if (a.open)
      actions.push({
        key: "open",
        label: "Open",
        go: () => navigation.navigate("MyTeam", { eventId: e.id }),
      });
    if (a.scan)
      actions.push({
        key: "scan",
        label: "Scan",
        go: () => navigation.navigate("DoorScanner", { eventId: e.id }),
      });
    if (a.manage)
      actions.push({
        key: "manage",
        label: "Manage",
        go: () => navigation.navigate("ManageEvent", { eventId: e.id }),
      });
    const main = actions[0];
    return (
      <View
        key={e.id}
        style={[st.row, { backgroundColor: theme.backgroundDefault }]}
        testID="door-row"
      >
        <Pressable
          onPress={main?.go}
          disabled={!main}
          accessibilityRole="button"
          accessibilityLabel={`${e.title}. ${teamRolesLine(e)}`}
          style={({ pressed }) => ({ gap: 3, opacity: pressed ? 0.8 : 1 })}
        >
          <ThemedText style={hostStyles.strong} numberOfLines={2}>
            {e.title}
          </ThemedText>
          <Hint>{whenRange(e.startsAt, e.endsAt, e.timezone)}</Hint>
          <Hint>{`${teamRolesLine(e)}${a.scan ? ` · ${note ?? "Check in is open."}` : ""}`}</Hint>
        </Pressable>
        {actions.length > 0 ? (
          <View style={st.actions}>
            {actions.map((x) => (
              <Pressable
                key={x.key}
                onPress={x.go}
                accessibilityRole="button"
                accessibilityLabel={`${x.label}, ${e.title}`}
                style={({ pressed }) => [
                  st.small,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}
                testID={`door-${x.key}`}
              >
                <ThemedText
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: theme.brandGold,
                  }}
                >
                  {x.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return root(
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 40,
        gap: 20,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={GOLD}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {error ? <ErrorText>{error}</ErrorText> : null}
      {invites.length > 0 ? (
        <View style={{ gap: 10 }} testID="door-invites">
          <ThemedText
            style={[hostStyles.section, { color: theme.textSecondary }]}
            accessibilityRole="header"
          >
            INVITES FOR YOU
          </ThemedText>
          {invites.map((inv) => {
            const headline = teamInviteHeadline(inv);
            return (
              <Pressable
                key={inv.id}
                onPress={() =>
                  navigation.navigate("DoorInvite", { inviteId: inv.id })
                }
                accessibilityRole="button"
                accessibilityLabel={`${headline}. Open to accept or decline`}
                style={({ pressed }) => [
                  st.invite,
                  {
                    backgroundColor: theme.backgroundDefault,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                testID="door-invite"
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText style={hostStyles.strong}>{headline}</ThemedText>
                  <Hint>{teamInviteLine(inv)}</Hint>
                </View>
                <ThemedText
                  style={{
                    color: theme.brandGold,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  Open
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {events && events.length === 0 ? (
        <View style={{ gap: 8 }}>
          <ThemedText style={hostStyles.h1} accessibilityRole="header">
            NOTHING HERE YET
          </ThemedText>
          <Hint>
            {
              "When you host an event, or accept a host's Event team invite, the event shows up here."
            }
          </Hint>
        </View>
      ) : null}
      {upcoming.length > 0 ? (
        <View style={{ gap: 10 }} testID="door-events">
          <ThemedText
            style={[hostStyles.section, { color: theme.textSecondary }]}
            accessibilityRole="header"
          >
            YOUR EVENTS
          </ThemedText>
          {upcoming.map(row)}
        </View>
      ) : null}
      {past.length > 0 ? (
        <View style={{ gap: 10 }} testID="door-past">
          <ThemedText
            style={[hostStyles.section, { color: theme.textSecondary }]}
            accessibilityRole="header"
          >
            RECENTLY ENDED
          </ThemedText>
          {past.map(row)}
        </View>
      ) : null}
    </ScrollView>,
  );
}

const st = StyleSheet.create({
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLD,
  },
  row: { gap: 10, padding: 14, borderRadius: 16 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  small: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});

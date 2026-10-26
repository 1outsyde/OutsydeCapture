import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { EVENT_GREEN } from "@/components/events/eventColors";
import { whenLabel } from "@/utils/eventsLogic";
import { addressTag, groupInfo, splitTickets, type MyTicket, type TicketGroup } from "@/utils/ticketCheckoutLogic";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Tickets tab in Cart & activity (Events canvas 28): Upcoming, then Past. `refreshKey` changes on pull to refresh. */
export default function MyTicketsList({ refreshKey }: { refreshKey: number }) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { getToken, isAuthenticated } = useAuth();
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    const mine = ++seq.current;
    try {
      const token = await getToken();
      if (!token) return;
      const list = await api.getMyTickets(token);
      if (mine !== seq.current) return;
      setTickets(list);
      setFailed(false);
    } catch {
      // A failed refresh keeps the tickets already on screen.
      if (mine === seq.current) setFailed(true);
    }
  }, [getToken, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (refreshKey > 0) load();
  }, [refreshKey, load]);

  if (!isAuthenticated) {
    return (
      <View style={styles.empty}>
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>Sign in to see your tickets.</ThemedText>
        <Pressable onPress={() => navigation.navigate("Auth", {})} accessibilityRole="button" style={[styles.signIn, { backgroundColor: theme.brandGold }]}>
          <ThemedText style={styles.signInText}>Sign in</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (tickets === null) {
    return failed ? (
      <View style={styles.empty}>
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>Your tickets could not be loaded.</ThemedText>
        <Pressable onPress={load} accessibilityRole="button" style={[styles.signIn, { backgroundColor: theme.brandGold }]}>
          <ThemedText style={styles.signInText}>Try again</ThemedText>
        </Pressable>
      </View>
    ) : (
      <ActivityIndicator style={{ marginTop: 40 }} color={theme.brandGold} />
    );
  }

  const now = new Date();
  const { upcoming, past } = splitTickets(tickets, now);

  const row = (g: TicketGroup) => {
    const tag = addressTag(g.event, now);
    return (
      <Pressable
        key={g.event.id}
        onPress={() => navigation.navigate("TicketDetail", { eventId: g.event.id })}
        accessibilityRole="button"
        accessibilityLabel={`${g.event.title}, ${whenLabel(g.event, now)}, ${groupInfo(g)}`}
        style={[styles.row, { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder }]}
      >
        <View style={styles.thumb}>
          {g.event.coverImageUrl ? <Image source={{ uri: g.event.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <ThemedText style={[styles.when, { color: theme.brandGold }]}>{whenLabel(g.event, now)}</ThemedText>
          <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={2}>{g.event.title}</ThemedText>
          <ThemedText style={[styles.info, { color: theme.textSecondary }]} numberOfLines={2}>{groupInfo(g)}</ThemedText>
        </View>
        {tag ? (
          <View style={styles.tag}>
            <ThemedText style={styles.tagText}>{tag}</ThemedText>
          </View>
        ) : (
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <ThemedText style={[styles.section, { color: theme.brandGoldDim }]}>UPCOMING</ThemedText>
      {upcoming.length ? upcoming.map(row) : (
        <ThemedText style={[styles.info, { color: theme.textSecondary }]}>No upcoming tickets. Events you get tickets for show up here.</ThemedText>
      )}
      <ThemedText style={[styles.section, { color: theme.brandGoldDim, paddingTop: 6 }]}>PAST</ThemedText>
      {past.length ? past.map(row) : (
        <ThemedText style={[styles.info, { color: theme.textSecondary }]}>Events you went to show up here.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  row: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, alignItems: "center", minHeight: 88 },
  thumb: { width: 68, height: 68, borderRadius: 12, backgroundColor: EVENT_GREEN, overflow: "hidden" },
  when: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: "800" },
  info: { fontSize: 12, lineHeight: 17 },
  tag: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, backgroundColor: "#2E2A1E", maxWidth: 96 },
  tagText: { fontSize: 10, fontWeight: "700", color: "#F5D26B", textAlign: "center" },
  empty: { alignItems: "center", gap: 14, paddingTop: 40, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: "center" },
  signIn: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  signInText: { color: "#000000", fontSize: 15, fontWeight: "600" },
});

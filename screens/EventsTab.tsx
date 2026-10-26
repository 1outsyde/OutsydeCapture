import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { FeaturedEventCard, EventRow } from "@/components/events/EventListItems";
import { EVENT_CREAM, EVENT_GREEN, EVENT_GREEN_TEXT } from "@/components/events/eventColors";
import { getEventCoords, requestOnce, savedCity } from "@/utils/eventLocation";
import {
  buildEventsQuery,
  eventsAfterError,
  eventsTabView,
  nearMeDecision,
  type Coords,
  type EventCard,
  type Filters,
} from "@/utils/eventsLogic";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NO_FILTERS: Filters = { near: false, free: false, when: null };

function phoneZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

/** Discover EVENTS tab (canvas 22 and 24): filters, a featured card, then rows. */
export default function EventsTab() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [locationOff, setLocationOff] = useState(false);
  const [locating, setLocating] = useState(false);
  const [events, setEvents] = useState<EventCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // Drop answers from an older request (quick filter taps, refresh + paging).
  const seq = useRef(0);

  const load = useCallback(
    async (opts: { filters: Filters; coords: Coords | null; city: string | null; more?: string | null }) => {
      const mine = ++seq.current;
      if (opts.more) setLoadingMore(true);
      else setLoading(true);
      setError(false);
      try {
        const query = buildEventsQuery({
          filters: opts.filters,
          now: new Date(),
          tz: phoneZone(),
          coords: opts.coords,
          // City only stands in for Near me when location is off.
          city: opts.filters.near && !opts.coords ? opts.city : null,
          cursor: opts.more ?? null,
        });
        const token = await getTokenRef.current().catch(() => null);
        const res = await api.listEvents(query, token);
        if (mine !== seq.current) return;
        setEvents((prev) => {
          if (!opts.more) return res.events;
          const seen = new Set(prev.map((e) => e.id));
          return [...prev, ...res.events.filter((e) => !seen.has(e.id))];
        });
        setCursor(res.nextCursor);
      } catch (err) {
        if (mine !== seq.current) return;
        console.error("[EventsTab] Failed to load events:", err);
        setError(true);
        // Keep what loaded: a failed refresh never empties the list (apply() clears it on a filter change).
        setEvents(eventsAfterError);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    load({ filters: NO_FILTERS, coords: null, city: null });
  }, [load]);

  const apply = useCallback(
    (next: Filters, nextCoords: Coords | null, nextCity: string | null) => {
      setFilters(next);
      setEvents([]);
      setCursor(null);
      load({ filters: next, coords: nextCoords, city: nextCity });
    },
    [load],
  );

  const toggleNear = useCallback(async () => {
    if (filters.near) {
      setLocationOff(false);
      apply({ ...filters, near: false }, null, null);
      return;
    }
    setLocating(true);
    try {
      const known = await getEventCoords();
      const decision = nearMeDecision(known.status, known.canAskAgain);
      let c: Coords | null = decision === "use" ? known.coords : null;
      if (decision === "ask") c = await requestOnce();
      if (c) {
        setLocationOff(false);
        setCoords(c);
        apply({ ...filters, near: true }, c, null);
        return;
      }
      const saved = await savedCity();
      setLocationOff(true);
      setCoords(null);
      setCity(saved);
      apply({ ...filters, near: true }, null, saved);
    } finally {
      setLocating(false);
    }
  }, [filters, apply]);

  const toggleWhen = (w: "tonight" | "weekend") =>
    apply({ ...filters, when: filters.when === w ? null : w }, filters.near ? coords : null, city);
  const toggleFree = () => apply({ ...filters, free: !filters.free }, filters.near ? coords : null, city);
  const clearFilters = () => {
    setLocationOff(false);
    apply(NO_FILTERS, null, null);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ filters, coords: filters.near ? coords : null, city });
    setRefreshing(false);
  }, [load, filters, coords, city]);

  const onEndReached = useCallback(() => {
    if (!cursor || loading || loadingMore) return;
    load({ filters, coords: filters.near ? coords : null, city, more: cursor });
  }, [cursor, loading, loadingMore, load, filters, coords, city]);

  const open = (e: EventCard) => navigation.navigate("EventDetail", { slug: e.slug });

  const view = eventsTabView({ loading, error, locationOff: locationOff && !city, filters, count: events.length });
  const showingCity = filters.near && locationOff && !!city;

  const chip = (label: string, on: boolean, onPress: () => void, busy = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected: on, busy }}
      style={[styles.chip, { backgroundColor: on ? theme.brandGold : theme.card, borderColor: on ? theme.brandGold : theme.textMuted }]}
    >
      <ThemedText style={[styles.chipText, { color: on ? "#000000" : theme.text }]}>{label}</ThemedText>
    </Pressable>
  );

  const message = (icon: keyof typeof Feather.glyphMap, title: string, body: string, actions: Array<{ label: string; onPress: () => void }>) => (
    <View style={styles.message}>
      <View style={styles.messageIcon}>
        <Feather name={icon} size={28} color={EVENT_GREEN_TEXT} />
      </View>
      <ThemedText style={[styles.messageTitle, { color: theme.text }]}>{title}</ThemedText>
      <ThemedText style={[styles.messageBody, { color: theme.textSecondary }]}>{body}</ThemedText>
      {actions.map((a) => (
        <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" style={styles.greenButton}>
          <ThemedText style={styles.greenButtonText}>{a.label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.chips}>
        <Pressable
          key="my-tickets"
          onPress={() => navigation.navigate("CartOrders", { openTab: "tickets", _ts: Date.now() })}
          accessibilityRole="button"
          accessibilityLabel="My Tickets"
          style={[styles.chip, styles.ticketsChip, { borderColor: theme.brandGold }]}
        >
          <Feather name="tag" size={15} color={theme.brandGold} />
          <ThemedText style={[styles.chipText, { color: theme.brandGold }]}>My Tickets</ThemedText>
        </Pressable>
        {chip(locating ? "Finding you" : "Near me", filters.near, toggleNear, locating)}
        {chip("Tonight", filters.when === "tonight", () => toggleWhen("tonight"))}
        {chip("This weekend", filters.when === "weekend", () => toggleWhen("weekend"))}
        {chip("Free", filters.free, toggleFree)}
      </View>
      {showingCity ? (
        <View style={styles.note}>
          <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
            Location is off, so these are events in {city}.
          </ThemedText>
          <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button" hitSlop={8}>
            <ThemedText style={[styles.noteLink, { color: theme.brandGold }]}>Open Settings</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (view === "loading") {
    empty = (
      <View style={styles.skeletons} accessibilityLabel="Loading events">
        <View style={[styles.skeletonBig, { backgroundColor: theme.card }]} />
        <View style={[styles.skeletonRow, { backgroundColor: theme.card }]} />
        <View style={[styles.skeletonRow, { backgroundColor: theme.card }]} />
      </View>
    );
  } else if (view === "error") {
    empty = message("alert-circle", "COULD NOT LOAD", "These events could not be loaded. Check your connection and try again.", [
      { label: "Try again", onPress: () => load({ filters, coords: filters.near ? coords : null, city }) },
    ]);
  } else if (view === "location") {
    empty = message("map-pin", "TURN ON LOCATION", "Allow location for Outsyde in Settings to see events near you. You can still browse every event without it.", [
      { label: "Open Settings", onPress: () => Linking.openSettings() },
      { label: "Show all events", onPress: clearFilters },
    ]);
  } else if (view === "nomatch") {
    empty = message("calendar", "NOTHING MATCHES", "No events match those filters right now. Try turning one off.", [
      { label: "Clear filters", onPress: clearFilters },
    ]);
  } else if (view === "empty") {
    empty = message("calendar", "NO EVENTS YET", "There are no upcoming events right now. Check back soon.", []);
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(e) => `ev-${e.id}`}
      renderItem={({ item, index }) =>
        index === 0 ? <FeaturedEventCard event={item} onPress={() => open(item)} /> : <EventRow event={item} onPress={() => open(item)} />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: Spacing.lg }} color={theme.primary} /> : null}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      contentContainerStyle={[styles.content, events.length === 0 && { flexGrow: 1 }]}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.md, paddingBottom: 120 },
  headerWrap: { paddingTop: Spacing.xs, paddingBottom: Spacing.md, gap: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "600" },
  ticketsChip: { flexDirection: "row", gap: 6, backgroundColor: "transparent" },
  note: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  noteText: { fontSize: 13 },
  noteLink: { fontSize: 13, fontWeight: "700" },
  message: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: 48, gap: 10 },
  messageIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: EVENT_GREEN, alignItems: "center", justifyContent: "center" },
  messageTitle: { fontSize: 22, fontWeight: "800", letterSpacing: 1, textAlign: "center" },
  messageBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  greenButton: { marginTop: 6, minHeight: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: EVENT_GREEN, alignItems: "center", justifyContent: "center" },
  greenButtonText: { color: EVENT_CREAM, fontSize: 15, fontWeight: "600" },
  skeletons: { gap: Spacing.md },
  skeletonBig: { height: 250, borderRadius: 16 },
  skeletonRow: { height: 96, borderRadius: 16 },
});

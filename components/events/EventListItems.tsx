import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { EVENT_GREEN, EVENT_GREEN_TEXT } from "@/components/events/eventColors";
import { dateBlock, priceLabel, whenLabel, whereLabel, type EventCard } from "@/utils/eventsLogic";

function Cover({ uri, height, width, radius }: { uri: string | null; height: number; width?: number; radius?: number }) {
  // A row thumbnail needs a fixed width; without it the cover takes the whole row and the text gets none.
  return (
    <View style={[styles.cover, { width: width ?? "100%", height, backgroundColor: EVENT_GREEN, borderRadius: radius ?? 0 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : null}
    </View>
  );
}

/** The large first card on the EVENTS tab (canvas 22). */
export function FeaturedEventCard({ event, onPress }: { event: EventCard; onPress: () => void }) {
  const { theme } = useTheme();
  const block = dateBlock(event);
  const badge = priceLabel(event);
  const time = whenLabel(event, new Date()).split(" · ").pop() ?? "";
  const info = [time, whereLabel(event), event.host?.name ? `by ${event.host.name}` : ""].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}, ${whenLabel(event, new Date())}`}
      style={[styles.featured, { backgroundColor: theme.card }]}
    >
      <View>
        <Cover uri={event.coverImageUrl} height={180} />
        {!event.coverImageUrl ? <ThemedText style={styles.coverLabel}>Event</ThemedText> : null}
        {badge ? (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{badge}</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.featuredFoot}>
        <View style={styles.dateCol}>
          <ThemedText style={[styles.dateWeekday, { color: theme.brandGold }]}>{block.weekday}</ThemedText>
          <ThemedText style={[styles.dateDay, { color: theme.text }]}>{block.day}</ThemedText>
        </View>
        <View style={styles.textCol}>
          <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={2}>{event.title}</ThemedText>
          {info ? <ThemedText style={[styles.info, { color: theme.textSecondary }]} numberOfLines={2}>{info}</ThemedText> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** A compact row on the EVENTS tab. */
export function EventRow({ event, onPress }: { event: EventCard; onPress: () => void }) {
  const { theme } = useTheme();
  const when = whenLabel(event, new Date());
  const info = [whereLabel(event), priceLabel(event)].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}, ${when}`}
      style={[styles.row, { backgroundColor: theme.card }]}
    >
      <Cover uri={event.coverImageUrl} height={76} width={76} radius={12} />
      <View style={styles.textCol}>
        <ThemedText style={[styles.rowWhen, { color: theme.brandGold }]}>{when}</ThemedText>
        <ThemedText style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>{event.title}</ThemedText>
        {info ? <ThemedText style={[styles.info, { color: theme.textSecondary }]} numberOfLines={1}>{info}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: "hidden", flexShrink: 0 },
  coverLabel: { position: "absolute", top: 80, alignSelf: "center", color: EVENT_GREEN_TEXT, fontSize: 13 },
  featured: { borderRadius: 16, overflow: "hidden" },
  badge: { position: "absolute", left: 12, bottom: 12, backgroundColor: "#000000", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: "#F5F0E6", fontSize: 12, fontWeight: "600" },
  featuredFoot: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md },
  dateCol: { width: 44, alignItems: "center" },
  dateWeekday: { fontSize: 10, fontWeight: "700" },
  dateDay: { fontSize: 24, fontWeight: "800", lineHeight: 28 },
  textCol: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 19, fontWeight: "800", lineHeight: 23 },
  info: { fontSize: 12, lineHeight: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: 10, borderRadius: 16 },
  rowWhen: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  rowTitle: { fontSize: 17, fontWeight: "800", lineHeight: 21 },
});

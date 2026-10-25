import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { EVENT_GOLD, EVENT_GREEN, EVENT_GREEN_TEXT } from "@/components/events/eventColors";
import { dateBlock, priceLabel, whenLabel, whereLabel, type EventCard } from "@/utils/eventsLogic";

/** An event inside the Pro feed (canvas 21). The whole card opens the event page. */
export function EventFeedCard({ event, onPress }: { event: EventCard; onPress: () => void }) {
  const { theme } = useTheme();
  const now = new Date();
  const when = whenLabel(event, now);
  const time = when.split(" · ").pop() ?? "";
  const line = [time, whereLabel(event), priceLabel(event)].filter(Boolean).join(" · ");
  const block = dateBlock(event);
  const hostName = event.host?.name || "Outsyde host";
  const avatar = event.host?.avatarUrl || null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}, ${when}`}
      style={[styles.card, { backgroundColor: theme.card }]}
    >
      <View style={styles.head}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: EVENT_GREEN }]}>
            <ThemedText style={styles.avatarLetter}>{hostName.replace(/^@/, "").charAt(0).toUpperCase()}</ThemedText>
          </View>
        )}
        <View style={styles.who}>
          <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>{hostName}</ThemedText>
          <ThemedText style={[styles.sub, { color: theme.textSecondary }]}>Hosting an event</ThemedText>
        </View>
        <View style={styles.tag}>
          <ThemedText style={styles.tagText}>EVENT</ThemedText>
        </View>
      </View>

      <View style={styles.cover}>
        {event.coverImageUrl ? (
          <Image source={{ uri: event.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <ThemedText style={styles.coverLabel}>Event</ThemedText>
        )}
        <View style={styles.dateBlock}>
          <ThemedText style={styles.dateWeekday}>{block.weekday}</ThemedText>
          <ThemedText style={styles.dateDay}>{block.day}</ThemedText>
        </View>
      </View>

      <View style={styles.foot}>
        <View style={styles.text}>
          <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={2}>{event.title}</ThemedText>
          {line ? <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>{line}</ThemedText> : null}
        </View>
        <View style={styles.cta}>
          <ThemedText style={styles.ctaText}>Get tickets</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginVertical: Spacing.sm, borderRadius: 16, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarLetter: { color: "#F5F0E6", fontWeight: "700", fontSize: 14 },
  who: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 12, lineHeight: 16 },
  tag: { backgroundColor: EVENT_GOLD, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: "#000000", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  cover: { height: 220, backgroundColor: EVENT_GREEN, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverLabel: { color: EVENT_GREEN_TEXT, fontSize: 13 },
  dateBlock: { position: "absolute", left: 12, bottom: 12, width: 50, height: 56, borderRadius: 12, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  dateWeekday: { color: EVENT_GOLD, fontSize: 10, fontWeight: "700" },
  dateDay: { color: "#F5F0E6", fontSize: 24, fontWeight: "800", lineHeight: 28 },
  foot: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 19, fontWeight: "800", lineHeight: 23 },
  cta: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: EVENT_GOLD, justifyContent: "center" },
  ctaText: { color: "#000000", fontSize: 14, fontWeight: "700" },
});

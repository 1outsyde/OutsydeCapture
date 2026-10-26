/** How the event looks in Discover (Events canvas 12), also on the live screen. */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { EVENT_GOLD, EVENT_GREEN, EVENT_GREEN_TEXT } from "@/components/events/eventColors";
import { priceLabel, whenLabel, whereLabel } from "@/utils/eventsLogic";
import { previewPrice, safeHttpUrl, type EventForm, type HostTicketType } from "@/utils/host/editorLogic";

export default function PreviewCard({ form, types, startsAt, showPrice = true }: { form: EventForm; types: HostTicketType[]; startsAt: string; showPrice?: boolean }) {
  const { theme } = useTheme();
  const hidden = form.addressVisibility !== "public";
  const card = { venueName: hidden ? null : form.venueName || null, city: form.city || null, state: form.state || null, addressHidden: hidden };
  const parts = [
    whenLabel({ startsAt, timezone: form.timezone }, new Date()),
    whereLabel(card),
    showPrice ? priceLabel(previewPrice(types)) : "",
  ].filter(Boolean);
  const cover = safeHttpUrl(form.coverImageUrl);
  return (
    <View style={[s.card, { borderColor: theme.border, backgroundColor: theme.card }]} accessible accessibilityLabel={`Preview: ${form.title || "Your event"}, ${parts.join(", ")}`}>
      <View style={[s.cover, { backgroundColor: EVENT_GREEN }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ThemedText style={{ color: EVENT_GREEN_TEXT }}>No cover photo yet</ThemedText>}
        <View style={s.tag}><ThemedText style={s.tagText}>EVENT</ThemedText></View>
      </View>
      <View style={s.body}>
        <ThemedText style={s.title} numberOfLines={2}>{form.title || "Your event"}</ThemedText>
        <ThemedText style={[s.sub, { color: theme.textSecondary }]}>{parts.join(" · ")}</ThemedText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  cover: { height: 170, alignItems: "center", justifyContent: "center" },
  tag: { position: "absolute", top: 10, left: 10, backgroundColor: EVENT_GOLD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: "#0B0B0B", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  body: { padding: 14, gap: 4 },
  title: { fontSize: 17, fontWeight: "700" },
  sub: { fontSize: 13, lineHeight: 18 },
});

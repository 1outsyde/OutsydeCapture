/** A full page with a list to pick one value from (time zone, the ticket type that unlocks another). */
import React from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { FullScreenSheet } from "@/components/FullScreenSheet";
import { useTheme } from "@/hooks/useTheme";

export type Option = { value: string; label: string };

export default function OptionSheet({ title, options, selected, onPick, onClose }: {
  title: string; options: Option[] | null; selected: string; onPick: (v: string) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  return (
    <FullScreenSheet visible={!!options} onClose={onClose} title={title}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        {(options ?? []).map((o) => {
          const on = o.value === selected;
          return (
            <Pressable key={o.value} onPress={() => onPick(o.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={[s.row, { borderBottomColor: theme.border }]}>
              <ThemedText style={{ fontSize: 16, flex: 1, fontWeight: on ? "700" : "400", color: on ? theme.brandGold : theme.text }}>{o.label}</ThemedText>
              {on ? <Feather name="check" size={20} color={theme.brandGold} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </FullScreenSheet>
  );
}

const s = StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});

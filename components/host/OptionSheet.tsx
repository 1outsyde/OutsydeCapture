/** A bottom sheet with a list to pick one value from (time zone, the ticket type that unlocks another). */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

export type Option = { value: string; label: string };

export default function OptionSheet({ title, options, selected, onPick, onClose }: {
  title: string; options: Option[] | null; selected: string; onPick: (v: string) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!options} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[s.sheet, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + 12, borderColor: theme.border }]} accessibilityViewIsModal>
        <View style={s.head}>
          <ThemedText style={s.title} accessibilityRole="header">{title}</ThemedText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 380 }}>
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
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});

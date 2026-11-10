import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export type InboxMode = "activity" | "messages";

interface InboxToggleProps {
  mode: InboxMode;
  onModeChange: (mode: InboxMode) => void;
}

// Activity redesign step 2 (Legend 2026-11-10): filled pills instead of underlined text.
// Used only by InboxScreen.
export function InboxToggle({ mode, onModeChange }: InboxToggleProps) {
  const { theme } = useTheme();

  const pill = (value: InboxMode, label: string) => {
    const on = mode === value;
    return (
      <Pressable
        onPress={() => onModeChange(value)}
        style={[
          styles.pill,
          { backgroundColor: on ? theme.brandGold : theme.brandChip },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
      >
        <ThemedText
          style={[
            styles.pillText,
            {
              color: on ? theme.brandScreen : theme.text,
              fontWeight: on ? "700" : "600",
            },
          ]}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {pill("activity", "Activity")}
      {pill("messages", "Messages")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 15,
  },
});

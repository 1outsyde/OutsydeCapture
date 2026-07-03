import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export type FeedMode = "pro" | "pulse";

interface FeedToggleProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

export function FeedToggle({ mode, onModeChange }: FeedToggleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.segmentBackground}>
        <Pressable
          onPress={() => onModeChange("pro")}
          style={styles.segment}
          hitSlop={8}
        >
          <ThemedText
            style={[
              styles.segmentText,
              {
                color: theme.brandGold,
                opacity: mode === "pro" ? 1 : 0.4,
                fontWeight: mode === "pro" ? "700" : "500",
              },
            ]}
          >
            PRO
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => onModeChange("pulse")}
          style={styles.segment}
          hitSlop={8}
        >
          <ThemedText
            style={[
              styles.segmentText,
              {
                color: theme.brandGold,
                opacity: mode === "pulse" ? 1 : 0.4,
                fontWeight: mode === "pulse" ? "700" : "500",
              },
            ]}
          >
            PULSE
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  segmentBackground: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  segment: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});

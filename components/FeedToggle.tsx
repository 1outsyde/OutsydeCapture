import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

import { FEED_MODES, type FeedMode } from "@/utils/feedModes";

export type { FeedMode };

interface FeedToggleProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

export function FeedToggle({ mode, onModeChange }: FeedToggleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.segmentBackground}>
        {FEED_MODES.map(({ mode: m, label }) => (
          <Pressable
            key={m}
            onPress={() => onModeChange(m)}
            style={styles.segment}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
          >
            <ThemedText
              style={[
                styles.segmentText,
                {
                  color: theme.brandGold,
                  opacity: mode === m ? 1 : 0.4,
                  fontWeight: mode === m ? "700" : "500",
                },
              ]}
            >
              {label}
            </ThemedText>
          </Pressable>
        ))}
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

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
  /** Drawn over full-screen video (Pulse): soft text shadow and stronger unselected tabs. */
  overVideo?: boolean;
}

export function FeedToggle({ mode, onModeChange, overVideo = false }: FeedToggleProps) {
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
                  opacity: mode === m ? 1 : overVideo ? 0.65 : 0.4,
                  fontWeight: mode === m ? "700" : "500",
                },
                overVideo ? styles.segmentTextOverVideo : null,
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
  segmentTextOverVideo: {
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

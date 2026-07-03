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

export function InboxToggle({ mode, onModeChange }: InboxToggleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.segmentBackground}>
        <Pressable
          onPress={() => onModeChange("activity")}
          style={styles.segment}
          hitSlop={8}
        >
          <View style={styles.segmentColumn}>
            <ThemedText
              style={[
                styles.segmentText,
                {
                  color: theme.brandGold,
                  opacity: mode === "activity" ? 1 : 0.4,
                  fontWeight: mode === "activity" ? "700" : "500",
                },
              ]}
            >
              ACTIVITY
            </ThemedText>
            <View
              style={[
                styles.segmentUnderline,
                {
                  backgroundColor:
                    mode === "activity" ? theme.brandGold : "transparent",
                },
              ]}
            />
          </View>
        </Pressable>
        <Pressable
          onPress={() => onModeChange("messages")}
          style={styles.segment}
          hitSlop={8}
        >
          <View style={styles.segmentColumn}>
            <ThemedText
              style={[
                styles.segmentText,
                {
                  color: theme.brandGold,
                  opacity: mode === "messages" ? 1 : 0.4,
                  fontWeight: mode === "messages" ? "700" : "500",
                },
              ]}
            >
              MESSAGES
            </ThemedText>
            <View
              style={[
                styles.segmentUnderline,
                {
                  backgroundColor:
                    mode === "messages" ? theme.brandGold : "transparent",
                },
              ]}
            />
          </View>
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
  segmentColumn: {
    alignItems: "center",
  },
  segmentText: {
    fontSize: 12,
    letterSpacing: 1,
  },
  segmentUnderline: {
    height: 2,
    width: "100%",
    marginTop: 6,
    borderRadius: 2,
  },
});

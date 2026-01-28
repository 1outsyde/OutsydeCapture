import React, { useRef, useEffect } from "react";
import { View, Pressable, StyleSheet, Animated } from "react-native";
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
  const slideAnim = useRef(new Animated.Value(mode === "pro" ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === "pro" ? 0 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 12,
    }).start();
  }, [mode, slideAnim]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.segmentBackground, { backgroundColor: theme.border }]}>
        <Animated.View
          style={[
            styles.segmentIndicator,
            {
              backgroundColor: mode === "pro" ? theme.primary : "#FFFFFF",
              transform: [{ translateX }],
            },
          ]}
        />
        <Pressable
          onPress={() => onModeChange("pro")}
          style={styles.segment}
          hitSlop={8}
        >
          <ThemedText
            style={[
              styles.segmentText,
              {
                color: mode === "pro" ? "#000000" : theme.textSecondary,
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
                color: mode === "pulse" ? "#000000" : theme.textSecondary,
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
    borderRadius: BorderRadius.lg,
    padding: 3,
    position: "relative",
  },
  segmentIndicator: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 80,
    height: 32,
    borderRadius: BorderRadius.md,
  },
  segment: {
    width: 80,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  segmentText: {
    fontSize: 13,
    letterSpacing: 1,
  },
});

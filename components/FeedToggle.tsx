import React, { useRef, useEffect } from "react";
import { View, Pressable, StyleSheet, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

export type FeedMode = "pro" | "pulse";

interface FeedToggleProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

export function FeedToggle({ mode, onModeChange }: FeedToggleProps) {
  const { theme } = useTheme();
  const underlinePosition = useRef(new Animated.Value(mode === "pro" ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(underlinePosition, {
      toValue: mode === "pro" ? 0 : 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [mode, underlinePosition]);

  const underlineTranslateX = underlinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => onModeChange("pro")}
          hitSlop={12}
          style={styles.toggleOption}
        >
          <ThemedText
            style={[
              styles.toggleText,
              { color: mode === "pro" ? theme.text : theme.textSecondary },
            ]}
          >
            Pro
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onModeChange("pulse")}
          hitSlop={12}
          style={styles.toggleOption}
        >
          <ThemedText
            style={[
              styles.toggleText,
              { color: mode === "pulse" ? theme.text : theme.textSecondary },
            ]}
          >
            Pulse
          </ThemedText>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.underline,
          {
            backgroundColor: theme.text,
            transform: [{ translateX: underlineTranslateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 24,
  },
  toggleOption: {
    width: 48,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  underline: {
    width: 36,
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    marginLeft: 6,
  },
});

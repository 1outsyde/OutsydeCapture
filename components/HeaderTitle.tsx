import React from "react";
import { View, StyleSheet } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface HeaderTitleProps {
  title?: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.container}>
      <ThemedText type="h2" style={[styles.title, { color: theme.primary }]}>
        Outsyde
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "700",
    letterSpacing: 1,
  },
});

import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: "#000000" }]}>
        <Image
          source={require("../assets/logo.jpg")}
          style={styles.icon}
          resizeMode="cover"
        />
      </View>
      <ThemedText style={[styles.title, { color: theme.primary }]}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    overflow: "hidden",
  },
  icon: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
  },
});

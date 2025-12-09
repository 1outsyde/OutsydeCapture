import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { BorderRadius } from "@/constants/theme";

interface HeaderTitleProps {
  title?: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: "#000000" }]}>
        <Image
          source={require("../assets/logo.jpg")}
          style={styles.icon}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  icon: {
    width: 40,
    height: 40,
  },
});

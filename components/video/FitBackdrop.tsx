/**
 * The blurred background behind a "Fit" video (photo ratios step 2d): the video's own picture,
 * blurred and slightly darkened, filling the screen. Black when there is no picture.
 * Draw it first, then the video with contentFit "contain" on top.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

type BackdropSource = React.ComponentProps<typeof Image>["source"];

export function FitBackdrop({
  source,
}: {
  source: string | BackdropSource | null | undefined;
}) {
  if (!source)
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.black]}
      />
    );
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID="fit-backdrop"
    >
      <Image
        source={typeof source === "string" ? { uri: source } : source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={40}
      />
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
    </View>
  );
}

const styles = StyleSheet.create({
  black: { backgroundColor: "#000000" },
  shade: { backgroundColor: "rgba(0,0,0,0.25)" },
});

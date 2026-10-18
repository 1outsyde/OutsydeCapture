// Photos inside a chat bubble. 1 photo: one tall tile. 2: side by side. 3: one large + two stacked.
// 4 or more: 2 x 2, the last tile shows "+N" for the rest. Tapping any tile opens the viewer there.
// While a message is uploading, tiles are dimmed with a progress ring; a failed send shows a retry tag.

import React from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

const GAP = 2;
const RADIUS = 18;
const TAIL = 6;

type Props = {
  urls: string[];
  width: number;
  isOwn: boolean;
  /** Bubble has text under the photos: square off the bottom corners. */
  hasTextBelow?: boolean;
  /** Last bubble in a run from the same sender: small "tail" corner. */
  showTail?: boolean;
  uploading?: boolean;
  /** 0..100 while uploading. */
  progress?: number;
  onOpen: (index: number) => void;
};

export default function MessagePhotoGrid({
  urls,
  width,
  isOwn,
  hasTextBelow,
  showTail,
  uploading,
  progress,
  onOpen,
}: Props) {
  const { theme } = useTheme();
  const n = urls.length;
  if (n === 0) return null;

  const corner = {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    borderBottomLeftRadius: hasTextBelow
      ? 4
      : !isOwn && showTail
        ? TAIL
        : RADIUS,
    borderBottomRightRadius: hasTextBelow
      ? 4
      : isOwn && showTail
        ? TAIL
        : RADIUS,
  };

  const tile = (index: number, style: object, extra?: number) => (
    <Pressable
      key={`${urls[index]}-${index}`}
      onPress={() => onOpen(index)}
      disabled={uploading}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo ${index + 1} of ${n}`}
      style={[styles.tile, { backgroundColor: theme.brandSurface }, style]}
    >
      <Image
        source={{ uri: urls[index] }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />
      {extra ? (
        <View style={styles.moreOverlay}>
          <ThemedText style={styles.moreText}>+{extra}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );

  let body: React.ReactNode;
  if (n === 1) {
    body = tile(0, { width, height: Math.round(width * 1.25) });
  } else if (n === 2) {
    const w = (width - GAP) / 2;
    body = (
      <View style={styles.row}>
        {tile(0, { width: w, height: Math.round(width * 0.75) })}
        {tile(1, { width: w, height: Math.round(width * 0.75) })}
      </View>
    );
  } else if (n === 3) {
    const h = Math.round(width * 0.8);
    const big = Math.round((width - GAP) * 0.62);
    const small = width - GAP - big;
    const half = (h - GAP) / 2;
    body = (
      <View style={styles.row}>
        {tile(0, { width: big, height: h })}
        <View style={{ gap: GAP }}>
          {tile(1, { width: small, height: half })}
          {tile(2, { width: small, height: half })}
        </View>
      </View>
    );
  } else {
    const w = (width - GAP) / 2;
    const extra = n - 4;
    body = (
      <View style={{ gap: GAP }}>
        <View style={styles.row}>
          {tile(0, { width: w, height: w })}
          {tile(1, { width: w, height: w })}
        </View>
        <View style={styles.row}>
          {tile(2, { width: w, height: w })}
          {tile(3, { width: w, height: w }, extra > 0 ? extra : undefined)}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, corner, { width }]}>
      {body}
      {uploading ? (
        <View style={styles.uploading} pointerEvents="none">
          <View style={styles.uploadPill}>
            <ActivityIndicator size="small" color="#F0EAD6" />
            <ThemedText style={styles.uploadText}>
              {typeof progress === "number" && progress > 0
                ? `${Math.min(99, Math.round(progress))}%`
                : "Sending"}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  row: { flexDirection: "row", gap: GAP },
  tile: { overflow: "hidden" },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { color: "#F0EAD6", fontSize: 24, fontWeight: "700" },
  uploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,12,8,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  uploadText: {
    color: "#F0EAD6",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});

// Full screen photo viewer for chat photos. Swipe left and right between photos, "2 of 5" counter,
// close with the X or the Android back button.

import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";

type Props = {
  visible: boolean;
  urls: string[];
  initialIndex: number;
  onClose: () => void;
  /** Shown under the counter, e.g. the sender's name. */
  caption?: string;
};

export default function PhotoViewer({
  visible,
  urls,
  initialIndex,
  onClose,
  caption,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={urls}
          keyExtractor={(u, i) => `${u}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(
            Math.max(initialIndex, 0),
            Math.max(urls.length - 1, 0),
          )}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image
                source={{ uri: item }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
              />
            </View>
          )}
        />
        <View
          style={[styles.topBar, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={({ pressed }) => [
              styles.close,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={22} color="#F0EAD6" />
          </Pressable>
          <View style={styles.titleWrap} pointerEvents="none">
            {urls.length > 1 ? (
              <ThemedText style={styles.counter}>
                {index + 1} of {urls.length}
              </ThemedText>
            ) : null}
            {caption ? (
              <ThemedText style={styles.caption} numberOfLines={1}>
                {caption}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.spacer} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  spacer: { width: 40, height: 40 },
  titleWrap: { flex: 1, alignItems: "center" },
  counter: {
    color: "#F0EAD6",
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  caption: { color: "rgba(240,234,214,0.7)", fontSize: 12, marginTop: 2 },
});

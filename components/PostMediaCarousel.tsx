import React, { createContext, useContext, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";

/**
 * The feed-level horizontal swipe (Discover's Pro/Pulse toggle). When provided, a carousel
 * blocks it while the user swipes between photos, so paging photos never flips the feed.
 * Screens without a feed swipe (e.g. PostDetail) leave this null.
 */
export const FeedSwipeGestureContext = createContext<GestureType | null>(null);

type Props = {
  images: string[];
  height: number;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function PostMediaCarousel({ images, height }: Props) {
  const feedSwipe = useContext(FeedSwipeGestureContext);
  const [width, setWidth] = useState(SCREEN_WIDTH);
  const [index, setIndex] = useState(0);

  // Native gesture of the horizontal ScrollView. blocksExternalGesture makes the feed swipe
  // wait for this gesture to fail: a horizontal drag on the photos pages the carousel, while a
  // vertical drag fails it and the feed scrolls as before.
  const nativeGesture = useMemo(() => {
    const g = Gesture.Native();
    return feedSwipe ? g.blocksExternalGesture(feedSwipe) : g;
  }, [feedSwipe]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(Math.max(next, 0), images.length - 1));
  };

  const list = (
    <ScrollView
      horizontal
      pagingEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={16}
      style={{ width, height }}
    >
      {images.map((uri, i) => (
        <Image
          key={`${i}-${uri}`}
          source={{ uri }}
          style={{ width, height }}
          contentFit="cover"
          transition={200}
          accessibilityLabel={`Photo ${i + 1} of ${images.length}`}
        />
      ))}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {feedSwipe ? (
        <GestureDetector gesture={nativeGesture}>{list}</GestureDetector>
      ) : (
        list
      )}

      <View style={styles.counter} pointerEvents="none">
        <Text style={styles.counterText}>
          {index + 1}/{images.length}
        </Text>
      </View>

      <View style={styles.dots} pointerEvents="none">
        {images.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index ? styles.dotActive : null]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
  },
  counter: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
});

export default PostMediaCarousel;

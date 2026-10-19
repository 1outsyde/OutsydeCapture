import React, { useCallback, useMemo, useRef } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type Props = {
  /** Whether the viewer already likes the post. A double tap never unlikes. */
  isLiked: boolean;
  /** Called on a double tap when the post is not liked yet (the screen's existing like handler). */
  onLike: () => void;
  /**
   * Optional single tap action (play / pause on videos). When set, a single tap waits for the
   * double tap to fail first, so double tapping a video likes it without pausing it.
   */
  onSingleTap?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Gap allowed between the two taps. It is also how long a single tap (play / pause) waits.
const MAX_TAP_GAP_MS = 300;
// Movement allowed. Gesture handler measures a double tap from the FIRST touch, and real second
// taps land 15 to 30 points away, so the double tap gets more room than a single tap. A real swipe
// still wins: the feed swipe and scroll views take over and cancel the tap.
const MAX_DOUBLE_TAP_MOVE = 36;
const MAX_TAP_MOVE = 12;

/**
 * Double tap a post's media to like it, with the big heart pop (Instagram style).
 * Keep buttons (mute, like, etc.) OUTSIDE this wrapper as siblings: a React Native Pressable
 * inside a gesture handler tap would fire both.
 */
export function DoubleTapLike({ isLiked, onLike, onSingleTap, style, children }: Props) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Read the latest values at tap time, so a gesture built for an older render can't like twice.
  const likedRef = useRef(isLiked);
  likedRef.current = isLiked;
  const onLikeRef = useRef(onLike);
  onLikeRef.current = onLike;
  const onSingleTapRef = useRef(onSingleTap);
  onSingleTapRef.current = onSingleTap;

  const handleDoubleTap = useCallback(() => {
    scale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.15, { damping: 7, stiffness: 320 }),
      withSpring(1, { damping: 12, stiffness: 220 })
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(550, withTiming(0, { duration: 250 }))
    );
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (!likedRef.current) {
      // Mark it now so a second double tap before the screen re-renders can't send another like.
      likedRef.current = true;
      onLikeRef.current();
    }
  }, [opacity, scale]);

  const hasSingleTap = !!onSingleTap;
  const gesture = useMemo(() => {
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(MAX_TAP_GAP_MS)
      .maxDistance(MAX_DOUBLE_TAP_MOVE)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success) handleDoubleTap();
      });
    if (!hasSingleTap) return doubleTap;
    const singleTap = Gesture.Tap()
      .maxDistance(MAX_TAP_MOVE)
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success) onSingleTapRef.current?.();
      });
    return Gesture.Exclusive(doubleTap, singleTap);
  }, [handleDoubleTap, hasSingleTap]);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={style} collapsable={false}>
        {children}
        <View style={styles.heartLayer} pointerEvents="none">
          <Animated.View style={[styles.heart, heartStyle]}>
            <Ionicons name="heart" size={96} color="#FFFFFF" />
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  heartLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heart: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});

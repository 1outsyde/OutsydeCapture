/**
 * Pulse progress bar (Pulse length step C1): a thin bar along the bottom of Pulse videos over
 * 60 seconds. Drag it to skip, like TikTok: while dragging it gets thicker with a dot and the time
 * shows in the middle; the card pauses the video and hides its overlays, then seeks on release.
 *
 * The parent owns playback: this only reports where the finger is (onScrubStart / onScrub /
 * onScrubEnd, in seconds). Math lives in utils/pulseProgress.ts (unit tested).
 */
import React, { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { clockText, progressFraction, timeAtX } from "@/utils/pulseProgress";

/** Touch area height (points); the bar itself is drawn at its bottom. */
const TOUCH_HEIGHT = 28;
const SIDE = 12;

export interface PulseProgressBarProps {
  /** Seconds played so far. */
  current: number;
  /** Video length in seconds. */
  duration: number;
  /** Distance from the bottom of the card (points). */
  bottom: number;
  onScrubStart: () => void;
  onScrub: (seconds: number) => void;
  onScrubEnd: (seconds: number) => void;
}

export function PulseProgressBar({
  current,
  duration,
  bottom,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: PulseProgressBarProps) {
  const [width, setWidth] = useState(0);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  // Set while a drag is active, so a cancel only reports back when a drag really started.
  // A shared value (not a ref) so the gesture callbacks can read and write it.
  const dragging = useSharedValue(false);

  const scrubbing = scrubTime !== null;
  const shown = scrubbing ? scrubTime : current;
  const fraction = progressFraction(shown, duration);

  const pan = Gesture.Pan()
    .runOnJS(true)
    // Horizontal drags only; a mostly vertical swipe is left to the feed.
    .activeOffsetX([-4, 4])
    .failOffsetY([-24, 24])
    .onStart((e) => {
      dragging.set(true);
      const t = timeAtX(e.x, width, duration);
      setScrubTime(t);
      onScrubStart();
      onScrub(t);
    })
    .onUpdate((e) => {
      const t = timeAtX(e.x, width, duration);
      setScrubTime(t);
      onScrub(t);
    })
    .onEnd((e, success) => {
      if (!dragging.get()) return;
      dragging.set(false);
      // Cancelled (e.g. the system took the touch): end without seeking (-1).
      onScrubEnd(success ? timeAtX(e.x, width, duration) : -1);
    })
    .onFinalize(() => {
      if (dragging.get()) {
        dragging.set(false);
        onScrubEnd(-1);
      }
      setScrubTime(null);
    });

  return (
    <>
      {scrubbing ? (
        <View
          pointerEvents="none"
          style={[styles.timeWrap, { bottom: bottom + TOUCH_HEIGHT + 18 }]}
        >
          <Text style={styles.time} testID="pulse-progress-time">
            {clockText(shown)}{" "}
            <Text style={styles.timeTotal}>/ {clockText(duration)}</Text>
          </Text>
        </View>
      ) : null}
      <GestureDetector gesture={pan}>
        <View
          style={[styles.touch, { bottom }]}
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width)
          }
          accessibilityRole="adjustable"
          accessibilityLabel="Video progress"
          accessibilityValue={{
            text: `${clockText(shown)} of ${clockText(duration)}`,
          }}
          testID="pulse-progress"
        >
          <View style={[styles.track, scrubbing && styles.trackScrubbing]}>
            <View
              style={[
                styles.fill,
                scrubbing && styles.fillScrubbing,
                { width: `${fraction * 100}%` },
              ]}
            />
          </View>
          {scrubbing ? (
            <View style={[styles.knob, { left: fraction * width - 7 }]} />
          ) : null}
        </View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  touch: {
    position: "absolute",
    left: SIDE,
    right: SIDE,
    height: TOUCH_HEIGHT,
    justifyContent: "flex-end",
  },
  track: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  trackScrubbing: { height: 4, borderRadius: 2 },
  fill: { height: "100%", backgroundColor: "rgba(255,255,255,0.9)" },
  fillScrubbing: { backgroundColor: "#FFFFFF" },
  knob: {
    position: "absolute",
    bottom: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
  },
  timeWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  time: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 6,
  },
  timeTotal: { color: "rgba(255,255,255,0.65)" },
});

// Cold launch overlay: emerald screen where the gold spray Y paints itself in
// once, then fades into the app. Mounted once in App.tsx, so it only plays on
// a cold start (never when coming back from the background). The native
// splash (app.json) is plain emerald, so the spray starts from the same empty
// screen with no jump.
//
// Hides when the app's navigation is ready AND the spray has played once
// (launchShouldHide). It keeps looping if the app is slower, and a hard cap
// (LAUNCH_MAX_MS) means it can never block the app. While fading and after,
// it lets every touch through.
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import OutsydeLoader from "@/components/OutsydeLoader";
import { LAUNCH_FADE_MS, LAUNCH_MAX_MS, launchShouldHide } from "@/utils/outsydeLoaderLogic";

export default function LaunchOverlay({ ready }: { ready: boolean }) {
  const reduceMotion = useReducedMotion();
  const startedAt = useRef(Date.now());
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);
  const opacity = useSharedValue(1);

  // Re-check on ready changes and on a short tick until it is time to hide.
  useEffect(() => {
    if (hiding) return;
    const check = () => {
      if (launchShouldHide(ready, Date.now() - startedAt.current, reduceMotion)) setHiding(true);
    };
    check();
    const id = setInterval(check, 100);
    return () => clearInterval(id);
  }, [ready, reduceMotion, hiding]);

  useEffect(() => {
    if (!hiding) return;
    opacity.value = withTiming(0, { duration: LAUNCH_FADE_MS });
    const id = setTimeout(() => setGone(true), LAUNCH_FADE_MS + 50);
    return () => clearTimeout(id);
  }, [hiding, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={hiding ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, styles.top, fade]}
      testID="launch-overlay"
    >
      <OutsydeLoader size="screen" tone="emerald" />
    </Animated.View>
  );
}

// Exported for tests: the cap that guarantees the overlay always goes away.
export const LAUNCH_OVERLAY_MAX_MS = LAUNCH_MAX_MS;

const styles = StyleSheet.create({
  top: { zIndex: 1000, elevation: 1000 },
});

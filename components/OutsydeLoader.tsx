// Outsyde branded loader: the gold spray Y painting itself in, replacing the
// generic ActivityIndicator. Sizes: "screen" (full screen load, with status
// line and background), "section" (inside a screen) and "button" (small mark
// for Pay / Save buttons). Colours follow the user's light or dark mode;
// tone="emerald" is for the splash and app launch.
//
// Built with Reanimated only (no react-native-svg / no native change): each
// spray stroke is a rotated clipping box that grows along the stroke, with
// the logo counter rotated inside it. Reduced motion and the button size
// show the full logo with a soft pulse instead.
import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import {
  DRIPS,
  FADE_OUT,
  LOADER_SIZES,
  LOGO_PX,
  LOOP_MS,
  MIN_SPRAY_SIZE,
  SETTLE,
  STROKES,
  easeInOut,
  loaderColors,
  phase,
  strokeRect,
  type Drip,
  type LoaderSize,
  type LoaderTone,
  type Stroke,
} from "@/utils/outsydeLoaderLogic";

const LOGO = require("../assets/images/outsyde-y-logo.png");

type Props = {
  size?: LoaderSize;
  tone?: LoaderTone;
  /** Status line under the logo (screen size only). */
  label?: string;
  /** Read by screen readers. Defaults to the label, else "Loading". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function OutsydeLoader({
  size = "section",
  tone = "theme",
  label,
  accessibilityLabel,
  style,
}: Props) {
  const { colorScheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const px = LOADER_SIZES[size];
  const colors = loaderColors(colorScheme, tone);
  const spray = !reduceMotion && px >= MIN_SPRAY_SIZE;
  const isScreen = size === "screen";
  const statusLine = isScreen ? (label ?? "Getting things ready…") : undefined;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? statusLine ?? "Loading"}
      accessibilityState={{ busy: true }}
      style={[
        isScreen ? [styles.screen, { backgroundColor: colors.background }] : styles.inline,
        style,
      ]}
    >
      {spray ? <SprayMark px={px} /> : <PulseMark px={px} />}
      {statusLine ? (
        <Text style={[styles.status, { color: colors.text }]} importantForAccessibility="no">
          {statusLine}
        </Text>
      ) : null}
    </View>
  );
}

function SprayMark({ px }: { px: number }) {
  const t = useSharedValue(0);
  const scale = px / LOGO_PX;

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);

  const fadeOut = useAnimatedStyle(() => ({ opacity: 1 - phase(t.value, FADE_OUT.from, FADE_OUT.to) }));
  const settle = useAnimatedStyle(() => ({ opacity: phase(t.value, SETTLE.from, SETTLE.to) }));

  return (
    <Animated.View pointerEvents="none" style={[{ width: px, height: px }, fadeOut]}>
      {STROKES.map((s, i) => (
        <StrokeClip key={`s${i}`} stroke={s} scale={scale} px={px} t={t} />
      ))}
      {DRIPS.map((d, i) => (
        <DripClip key={`d${i}`} drip={d} scale={scale} px={px} t={t} />
      ))}
      <Animated.Image source={LOGO} resizeMode="contain" style={[styles.fill, { width: px, height: px }, settle]} />
    </Animated.View>
  );
}

function StrokeClip({ stroke, scale, px, t }: { stroke: Stroke; scale: number; px: number; t: SharedValue<number> }) {
  const r = strokeRect(stroke, scale);
  const grow = useAnimatedStyle(() => ({
    width: r.length * easeInOut(phase(t.value, stroke.from, stroke.to)),
  }));
  return (
    <Animated.View
      style={[
        styles.clip,
        {
          left: r.left,
          top: r.top,
          height: r.height,
          transformOrigin: [0, r.height / 2, 0],
          transform: [{ rotate: `${r.angleDeg}deg` }],
        },
        grow,
      ]}
    >
      <Image
        source={LOGO}
        resizeMode="contain"
        style={{
          position: "absolute",
          left: r.imageLeft,
          top: r.imageTop,
          width: px,
          height: px,
          transformOrigin: [r.pivotX, r.pivotY, 0],
          transform: [{ rotate: `${-r.angleDeg}deg` }],
        }}
      />
    </Animated.View>
  );
}

function DripClip({ drip, scale, px, t }: { drip: Drip; scale: number; px: number; t: SharedValue<number> }) {
  const left = drip.x * scale;
  const top = drip.y * scale;
  const grow = useAnimatedStyle(() => ({ height: drip.h * scale * phase(t.value, drip.from, drip.to) }));
  return (
    <Animated.View style={[styles.clip, { left, top, width: drip.w * scale }, grow]}>
      <Image
        source={LOGO}
        resizeMode="contain"
        style={{ position: "absolute", left: -left, top: -top, width: px, height: px }}
      />
    </Animated.View>
  );
}

function PulseMark({ px }: { px: number }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(o);
  }, [o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.Image
      source={LOGO}
      resizeMode="contain"
      pointerEvents="none"
      style={[{ width: px, height: px }, pulse]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  inline: { alignItems: "center", justifyContent: "center" },
  fill: { position: "absolute", left: 0, top: 0 },
  clip: { position: "absolute", overflow: "hidden" },
  status: { fontSize: 15, fontWeight: "500", letterSpacing: 0.6 },
});

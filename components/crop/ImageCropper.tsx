/**
 * Instagram-style crop screen (photo ratios build, step 2a).
 *
 * Shows the picked photo behind a box of the required shape (4:5, 1:1, 16:9, circle...). The person
 * pinches to zoom and drags to move; the photo always covers the whole box. "Use photo" saves only
 * the part inside the box as a new JPEG and returns its local uri and real size.
 *
 * It is its own full-screen Modal with its own GestureHandlerRootView, so it works on normal screens
 * AND when opened from inside another Modal (product, service and profile editors), where gestures
 * would otherwise not reach it. Its gestures also stop parent swipes (CreatePost mode swipe, Discover
 * tab swipe) because nothing underneath receives touches while it is open.
 *
 * Step 2b adds optional shape chips (4:5, 1:1, 16:9, Original for posts) and a start position, so a
 * photo can reopen where it was left or line up with the camera frame. Without those props it
 * behaves exactly as in 2a.
 *
 * Geometry lives in utils/crop/cropMath.ts (unit tested).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  boxSizeFor,
  clampAspect,
  clampOffset,
  clampZoom,
  coverScale,
  cropRectFor,
  outputSizeFor,
  rectFractionOf,
  viewForFraction,
  type FracRect,
  type Size,
} from "@/utils/crop/cropMath";

export type CropShape = "rect" | "circle";

export type CropResult = {
  uri: string;
  width: number;
  height: number;
  /** The shape used (width / height). */
  aspect: number;
  /** Which chip was picked, when chips were shown. */
  aspectKey?: string;
  /** Where the crop sat in the photo, to reopen it there later. */
  fraction: FracRect;
};

/** A shape chip. "original" = the photo's own shape, held between 4:5 and 1.91:1. */
export type AspectOption = {
  key: string;
  label: string;
  aspect: number | "original";
};

/** The post shapes, 4:5 first. */
export const POST_ASPECT_OPTIONS: AspectOption[] = [
  { key: "4:5", label: "4:5", aspect: 4 / 5 },
  { key: "1:1", label: "1:1", aspect: 1 },
  { key: "16:9", label: "16:9", aspect: 16 / 9 },
  { key: "original", label: "Original", aspect: "original" },
];

export interface ImageCropperProps {
  visible: boolean;
  /** Local uri of the picked or captured photo. */
  sourceUri: string | null;
  /** Width / height of the box, e.g. 4 / 5, 1, 16 / 9. */
  aspect: number;
  shape?: CropShape;
  title?: string;
  /** Shape chips. When given, `aspect` is ignored and the chips decide the shape. */
  aspectOptions?: AspectOption[];
  /** Chip picked when the screen opens (defaults to the first). */
  initialAspectKey?: string;
  /** Where the crop starts, as fractions of the photo (defaults to centered). */
  initialFraction?: FracRect | null;
  onCancel: () => void;
  onDone: (result: CropResult) => void;
}

/** Large phone photos are decoded at most this big, which is plenty for a 1920 px result. */
const DECODE_MAX = 2400;
const SIDE_GUTTER = 16;
const DIM = "rgba(0,0,0,0.62)";

export default function ImageCropper({
  visible,
  sourceUri,
  aspect,
  shape = "rect",
  title = "Crop photo",
  aspectOptions,
  initialAspectKey,
  initialFraction,
  onCancel,
  onDone,
}: ImageCropperProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // The photo upright and downsampled once, so what's shown and what's cropped are the same pixels.
  // Keyed by the source uri, so a new photo never shows the previous one (no reset needed on close).
  const [preparedFor, setPreparedFor] = useState<{
    source: string;
    uri: string;
    size: Size;
  } | null>(null);
  const [openErrorFor, setOpenErrorFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const active = visible && sourceUri ? sourceUri : null;
  const prepared =
    active && preparedFor?.source === active ? preparedFor : null;
  const openFailed = !!active && openErrorFor === active;
  const busy = saving || (!!active && !prepared && !openFailed);
  const error = openFailed
    ? "This photo couldn't be opened. Try another one."
    : saveError;

  // Chip choice, keyed by the source so each new photo starts on initialAspectKey.
  const [choice, setChoice] = useState<{ source: string; key: string } | null>(
    null,
  );
  const options = shape === "circle" ? undefined : aspectOptions;
  const chosenKey =
    options && options.length > 0
      ? choice && choice.source === active
        ? choice.key
        : (initialAspectKey ?? options[0].key)
      : undefined;
  const chosen = options?.find((o) => o.key === chosenKey) ?? options?.[0];
  const effectiveAspect = !chosen
    ? shape === "circle"
      ? 1
      : aspect
    : chosen.aspect === "original"
      ? clampAspect(
          prepared ? prepared.size.width / prepared.size.height : 4 / 5,
        )
      : chosen.aspect;

  const box = useMemo(
    () =>
      boxSizeFor(
        effectiveAspect,
        screenW - SIDE_GUTTER * 2,
        Math.max(160, screenH - insets.top - insets.bottom - 220),
      ),
    [effectiveAspect, screenW, screenH, insets.top, insets.bottom],
  );

  const base = prepared ? coverScale(prepared.size, box) : 1;

  const zoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const imgW = useSharedValue(1);
  const imgH = useSharedValue(1);
  const boxW = useSharedValue(box.width);
  const boxH = useSharedValue(box.height);
  const baseScale = useSharedValue(base);

  useEffect(() => {
    boxW.set(box.width);
    boxH.set(box.height);
    baseScale.set(base);
  }, [box.width, box.height, base, boxW, boxH, baseScale]);

  // Prepare the photo each time the cropper opens with a new source.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = await ImageManipulator.manipulate(active, {
          maxWidth: DECODE_MAX,
          maxHeight: DECODE_MAX,
        }).renderAsync();
        const saved = await ref.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.95,
        });
        if (cancelled) return;
        imgW.set(saved.width);
        imgH.set(saved.height);
        setSaveError(null);
        setPreparedFor({
          source: active,
          uri: saved.uri,
          size: { width: saved.width, height: saved.height },
        });
      } catch {
        if (!cancelled) setOpenErrorFor(active);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, imgW, imgH]);

  // Start position, once per prepared photo: where it was left, or centered.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!prepared || startedFor.current === prepared.uri) return;
    startedFor.current = prepared.uri;
    const v = initialFraction
      ? viewForFraction(prepared.size, box, initialFraction)
      : { zoom: 1, tx: 0, ty: 0 };
    zoom.set(v.zoom);
    tx.set(v.tx);
    ty.set(v.ty);
  }, [prepared, box, initialFraction, zoom, tx, ty]);

  const pickAspect = (key: string) => {
    if (!active || key === chosenKey) return;
    setChoice({ source: active, key });
    // New shape: start again centered, fully zoomed out.
    zoom.set(1);
    tx.set(0);
    ty.set(0);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.set(zoom.get());
    })
    .onUpdate((e) => {
      zoom.set(clampZoom(startZoom.get() * e.scale));
      const s = baseScale.get() * zoom.get();
      const c = clampOffset(
        tx.get(),
        ty.get(),
        { width: imgW.get(), height: imgH.get() },
        { width: boxW.get(), height: boxH.get() },
        s,
      );
      tx.set(c.tx);
      ty.set(c.ty);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startTx.set(tx.get());
      startTy.set(ty.get());
    })
    .onUpdate((e) => {
      const s = baseScale.get() * zoom.get();
      const c = clampOffset(
        startTx.get() + e.translationX,
        startTy.get() + e.translationY,
        { width: imgW.get(), height: imgH.get() },
        { width: boxW.get(), height: boxH.get() },
        s,
      );
      tx.set(c.tx);
      ty.set(c.ty);
    });

  const gestures = Gesture.Simultaneous(pinch, pan);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: zoom.get() },
    ],
  }));

  const handleDone = async () => {
    if (!prepared || busy) return;
    try {
      setSaving(true);
      setSaveError(null);
      const scale = base * zoom.get();
      const rect = cropRectFor(prepared.size, box, scale, tx.get(), ty.get());
      const out = outputSizeFor(
        { width: rect.width, height: rect.height },
        effectiveAspect,
      );
      const ref = await ImageManipulator.manipulate(prepared.uri)
        .crop(rect)
        .resize(out)
        .renderAsync();
      const saved = await ref.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.85,
      });
      onDone({
        uri: saved.uri,
        width: Math.round(saved.width),
        height: Math.round(saved.height),
        aspect: effectiveAspect,
        aspectKey: chosen?.key,
        fraction: rectFractionOf(rect, prepared.size),
      });
    } catch {
      setSaveError("This photo couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const dispW = prepared ? prepared.size.width * base : 0;
  const dispH = prepared ? prepared.size.height * base : 0;
  // Where the box sits on screen (centered in the area between the bars).
  const areaTop = insets.top + 64;
  const areaH = screenH - areaTop - insets.bottom - 110;
  const boxLeft = (screenW - box.width) / 2;
  const boxTop = areaTop + Math.max(0, (areaH - box.height) / 2);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gestures}>
          <View style={styles.stage} collapsable={false} testID="image-cropper">
            {prepared ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: boxLeft + box.width / 2 - dispW / 2,
                  top: boxTop + box.height / 2 - dispH / 2,
                  width: dispW,
                  height: dispH,
                }}
              >
                <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
                  <Image
                    source={{ uri: prepared.uri }}
                    style={{ width: dispW, height: dispH }}
                    resizeMode="cover"
                  />
                </Animated.View>
              </View>
            ) : null}

            {/* Dimmed area around the box. */}
            {shape === "circle" ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: boxLeft - screenH,
                  top: boxTop - screenH,
                  width: box.width + screenH * 2,
                  height: box.height + screenH * 2,
                  borderRadius: box.width / 2 + screenH,
                  borderWidth: screenH,
                  borderColor: DIM,
                }}
              />
            ) : (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.dim,
                    { left: 0, right: 0, top: 0, height: boxTop },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.dim,
                    { left: 0, right: 0, top: boxTop + box.height, bottom: 0 },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.dim,
                    {
                      left: 0,
                      width: boxLeft,
                      top: boxTop,
                      height: box.height,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.dim,
                    {
                      right: 0,
                      width: boxLeft,
                      top: boxTop,
                      height: box.height,
                    },
                  ]}
                />
              </>
            )}

            {/* Box outline and thirds grid. */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: boxLeft,
                top: boxTop,
                width: box.width,
                height: box.height,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.9)",
                borderRadius: shape === "circle" ? box.width / 2 : 0,
              }}
            >
              {shape === "rect"
                ? [1, 2].map((i) => (
                    <React.Fragment key={i}>
                      <View
                        style={[styles.gridV, { left: (box.width / 3) * i }]}
                      />
                      <View
                        style={[styles.gridH, { top: (box.height / 3) * i }]}
                      />
                    </React.Fragment>
                  ))
                : null}
            </View>

            {busy ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, styles.center]}
              >
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </GestureDetector>

        {/* Top bar: outside the gesture area so taps always reach the buttons. */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            testID="crop-cancel"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={handleDone}
            hitSlop={12}
            accessibilityRole="button"
            disabled={!prepared || busy}
            testID="crop-done"
          >
            <Text
              style={[styles.done, (!prepared || busy) && { opacity: 0.4 }]}
            >
              Use photo
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}
          pointerEvents="box-none"
        >
          {options && options.length > 1 ? (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {options.map((o) => {
                const on = o.key === chosen?.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => pickAspect(o.key)}
                    disabled={!prepared || saving}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    testID={`crop-shape-${o.key}`}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={error ? styles.error : styles.hint} pointerEvents="none">
            {error ?? "Pinch to zoom, drag to move"}
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  stage: { flex: 1, overflow: "hidden" },
  dim: { position: "absolute", backgroundColor: DIM },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cancel: { color: "#FFFFFF", fontSize: 16 },
  done: { color: "#E8B930", fontSize: 16, fontWeight: "700" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: 14,
  },
  hint: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  chipOn: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  chipText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#000000" },
  error: {
    color: "#FF8A80",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

/**
 * Instagram-style photo story editor (photo ratios build, step 2e).
 *
 * The picked or captured photo sits in a 9:16 box. Pinch to zoom in (up to 5x) or out until the
 * whole photo shows; drag to move. Wherever the photo doesn't reach, a blurred copy of the same
 * photo fills the box, so a story is never black or empty. "Use photo" saves one JPEG of exactly
 * 1080 x 1920:
 *  - photo covers the box: cropped straight from the photo with expo-image-manipulator;
 *  - zoomed out: the box is flattened with react-native-view-shot (captureStory.native.ts),
 *    then resized to 1080 x 1920.
 *
 * Same structure as ImageCropper (own Modal + GestureHandlerRootView, photo prepared upright once).
 * ImageCropper and cropMath.ts are not changed; story geometry is in utils/crop/storyMath.ts.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { FitBackdrop } from "@/components/video/FitBackdrop";
import {
  boxSizeFor,
  coverScale,
  cropRectFor,
  type Size,
} from "@/utils/crop/cropMath";
import {
  STORY_ASPECT,
  STORY_OUTPUT,
  clampStoryOffset,
  clampStoryZoom,
  snapStoryZoom,
  storyCovers,
  storyMinZoom,
} from "@/utils/crop/storyMath";
import { captureStoryView } from "@/utils/crop/captureStory";

export type StoryEditResult = { uri: string; width: number; height: number };

export interface StoryEditorProps {
  visible: boolean;
  /** Local uri of the picked or captured photo. */
  sourceUri: string | null;
  onCancel: () => void;
  onDone: (result: StoryEditResult) => void;
}

/** Large phone photos are decoded at most this big, plenty for a 1920 px story. */
const DECODE_MAX = 2400;
const SIDE_GUTTER = 12;

export default function StoryEditor({
  visible,
  sourceUri,
  onCancel,
  onDone,
}: StoryEditorProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const boxRef = useRef<React.ComponentRef<typeof View>>(null);

  // The photo upright and downsampled once, keyed by source so a new photo never shows the old one.
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

  const box = useMemo(
    () =>
      boxSizeFor(
        STORY_ASPECT,
        screenW - SIDE_GUTTER * 2,
        Math.max(200, screenH - insets.top - insets.bottom - 130),
      ),
    [screenW, screenH, insets.top, insets.bottom],
  );

  const base = prepared ? coverScale(prepared.size, box) : 1;
  const minZoom = prepared ? storyMinZoom(prepared.size, box) : 1;

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
  const minZoomSv = useSharedValue(minZoom);

  useEffect(() => {
    boxW.set(box.width);
    boxH.set(box.height);
    baseScale.set(base);
    minZoomSv.set(minZoom);
  }, [box.width, box.height, base, minZoom, boxW, boxH, baseScale, minZoomSv]);

  // Prepare the photo each time the editor opens with a new source.
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
        // Every photo starts filling the box, centered, like Instagram.
        zoom.set(1);
        tx.set(0);
        ty.set(0);
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
  }, [active, imgW, imgH, zoom, tx, ty]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.set(zoom.get());
    })
    .onUpdate((e) => {
      zoom.set(clampStoryZoom(startZoom.get() * e.scale, minZoomSv.get()));
      const c = clampStoryOffset(
        tx.get(),
        ty.get(),
        { width: imgW.get(), height: imgH.get() },
        { width: boxW.get(), height: boxH.get() },
        baseScale.get() * zoom.get(),
      );
      tx.set(c.tx);
      ty.set(c.ty);
    })
    .onEnd(() => {
      // Close to filling the box: fill it exactly, so the blurred copy doesn't peek at an edge.
      zoom.set(clampStoryZoom(snapStoryZoom(zoom.get()), minZoomSv.get()));
      const c = clampStoryOffset(
        tx.get(),
        ty.get(),
        { width: imgW.get(), height: imgH.get() },
        { width: boxW.get(), height: boxH.get() },
        baseScale.get() * zoom.get(),
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
      const c = clampStoryOffset(
        startTx.get() + e.translationX,
        startTy.get() + e.translationY,
        { width: imgW.get(), height: imgH.get() },
        { width: boxW.get(), height: boxH.get() },
        baseScale.get() * zoom.get(),
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

  const toStoryFile = useCallback(
    async (uri: string, crop?: ReturnType<typeof cropRectFor>) => {
      let ctx = ImageManipulator.manipulate(uri);
      if (crop) ctx = ctx.crop(crop);
      const ref = await ctx.resize(STORY_OUTPUT).renderAsync();
      const saved = await ref.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.85,
      });
      return {
        uri: saved.uri,
        width: Math.round(saved.width),
        height: Math.round(saved.height),
      };
    },
    [],
  );

  const handleDone = async () => {
    if (!prepared || busy) return;
    try {
      setSaving(true);
      setSaveError(null);
      const z = zoom.get();
      if (storyCovers(z)) {
        // Photo fills the box: crop the photo itself (sharpest, no capture needed).
        const rect = cropRectFor(
          prepared.size,
          box,
          base * z,
          tx.get(),
          ty.get(),
        );
        onDone(await toStoryFile(prepared.uri, rect));
      } else {
        // Zoomed out: flatten the box (photo over its blurred copy), then make it 1080 x 1920.
        const shot = await captureStoryView(boxRef);
        onDone(await toStoryFile(shot));
      }
    } catch {
      setSaveError("This photo couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const dispW = prepared ? prepared.size.width * base : 0;
  const dispH = prepared ? prepared.size.height * base : 0;
  const areaTop = insets.top + 56;
  const areaH = screenH - areaTop - insets.bottom - 74;
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
          <View style={styles.stage} collapsable={false} testID="story-editor">
            {/* The story itself. Only this view is flattened, so nothing else may be drawn in it. */}
            <View
              ref={boxRef}
              collapsable={false}
              pointerEvents="none"
              testID="story-editor-box"
              style={[
                styles.box,
                {
                  left: boxLeft,
                  top: boxTop,
                  width: box.width,
                  height: box.height,
                },
              ]}
            >
              {prepared ? (
                <>
                  <FitBackdrop source={prepared.uri} />
                  <View
                    style={{
                      position: "absolute",
                      left: box.width / 2 - dispW / 2,
                      top: box.height / 2 - dispH / 2,
                      width: dispW,
                      height: dispH,
                    }}
                  >
                    <Animated.View
                      style={[StyleSheet.absoluteFill, photoStyle]}
                    >
                      <Image
                        source={{ uri: prepared.uri }}
                        style={{ width: dispW, height: dispH }}
                        resizeMode="cover"
                      />
                    </Animated.View>
                  </View>
                </>
              ) : null}
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
            testID="story-cancel"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            Story
          </Text>
          <Pressable
            onPress={handleDone}
            hitSlop={12}
            accessibilityRole="button"
            disabled={!prepared || busy}
            testID="story-done"
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
          pointerEvents="none"
        >
          <Text style={error ? styles.error : styles.hint}>
            {error ?? "Pinch to zoom in or out, drag to move"}
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Promise-style wrapper, like useCropPicker: `edit(uri)` opens the editor and resolves with the
 * saved 1080 x 1920 photo, or null when cancelled. Render `editor` once in the screen.
 */
export function useStoryEditor() {
  const [uri, setUri] = useState<string | null>(null);
  const resolver = useRef<((r: StoryEditResult | null) => void) | null>(null);

  const finish = useCallback((r: StoryEditResult | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setUri(null);
    resolve?.(r);
  }, []);

  const edit = useCallback(
    (source: string): Promise<StoryEditResult | null> => {
      resolver.current?.(null);
      return new Promise((resolve) => {
        resolver.current = resolve;
        setUri(source);
      });
    },
    [],
  );

  const editor = (
    <StoryEditor
      visible={!!uri}
      sourceUri={uri}
      onCancel={() => finish(null)}
      onDone={(r) => finish(r)}
    />
  );

  return { edit, editor, isEditing: !!uri };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  stage: { flex: 1, overflow: "hidden" },
  box: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#000000",
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
  error: {
    color: "#FF8A80",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

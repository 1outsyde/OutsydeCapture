/**
 * Fill / Fit choice for a Pulse video or a video story (photo ratios step 2d), TikTok style.
 * A small live 9:16 preview of the picked video (muted, looping) shows exactly how it will look:
 *   Fill: zoomed to fill the screen.  Fit: the whole video, over a blurred still of it.
 * The player is released when this unmounts (leaving step 2), so only one video plays.
 */
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { VideoView } from "expo-video";
import { useVideoPlayerRecreate } from "@/hooks/useVideoPlayerRecreate";
import { FitBackdrop } from "@/components/video/FitBackdrop";
import type { VideoFit } from "@/utils/videoFit";

const PREVIEW_WIDTH = 135;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 16) / 9);

type Thumb = React.ComponentProps<typeof FitBackdrop>["source"];

export function VideoFitPicker({
  uri,
  fit,
  onChange,
  disabled,
}: {
  uri: string;
  fit: VideoFit;
  onChange: (fit: VideoFit) => void;
  disabled?: boolean;
}) {
  const player = useVideoPlayerRecreate(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // A still from the video for the Fit blur. Best effort: black if it can't be made.
  const [thumb, setThumb] = useState<{ uri: string; source: Thumb } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    // Not available on web, and it can throw right away instead of rejecting: guard both.
    if (Platform.OS !== "web") {
      try {
        player
          .generateThumbnailsAsync(0.5)
          .then((t) => {
            if (!cancelled && t?.[0])
              setThumb({ uri, source: t[0] as unknown as Thumb });
          })
          .catch(() => {});
      } catch {
        // No still: Fit sits on black.
      }
    }
    return () => {
      cancelled = true;
    };
  }, [player, uri]);

  return (
    <View style={styles.row}>
      <View style={styles.preview} testID="video-fit-preview">
        {fit === "fit" ? (
          <FitBackdrop
            source={thumb && thumb.uri === uri ? thumb.source : null}
          />
        ) : null}
        <VideoView
          player={player}
          style={styles.video}
          contentFit={fit === "fit" ? "contain" : "cover"}
          nativeControls={false}
        />
      </View>
      <View style={styles.side}>
        <Text style={styles.label}>How it fills the screen</Text>
        <View style={styles.buttons} accessibilityRole="radiogroup">
          {(["fill", "fit"] as const).map((v) => {
            const on = v === fit;
            return (
              <Pressable
                key={v}
                onPress={() => onChange(v)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                testID={`video-fit-${v}`}
                style={[styles.button, on && styles.buttonOn]}
              >
                <Text style={[styles.buttonText, on && styles.buttonTextOn]}>
                  {v === "fill" ? "Fill" : "Fit"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {fit === "fill"
            ? "Fills the whole screen. Edges may be cut."
            : "Shows the whole video over a blur."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 16, alignItems: "center" },
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  // Explicit size: the web player ignores absolute fill and draws at the video's own size.
  video: {
    position: "absolute",
    left: 0,
    top: 0,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: "transparent",
  },
  side: { flex: 1, gap: 10 },
  label: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  buttons: { flexDirection: "row", gap: 8 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  buttonOn: { backgroundColor: "#D4A94A", borderColor: "#D4A94A" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  buttonTextOn: { color: "#000000" },
  hint: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});

/**
 * Flattens the on-screen story box (photo over its blurred copy) into one JPEG (photo ratios 2e).
 * iOS and Android only; Metro picks this file over captureStory.ts on phones.
 *
 * view-shot's width / height are points on iOS and pixels on Android, so the caller resizes the
 * result to exactly 1080 x 1920 afterwards either way. These sizes only ask for enough detail.
 */
import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";
import { PixelRatio, Platform } from "react-native";
import { captureRef } from "react-native-view-shot";
import { STORY_OUTPUT } from "./storyMath";

export async function captureStoryView(
  view: RefObject<ComponentRef<typeof View> | null>,
): Promise<string> {
  const ratio = Platform.OS === "ios" ? PixelRatio.get() || 1 : 1;
  return captureRef(view, {
    format: "jpg",
    quality: 0.92,
    result: "tmpfile",
    width: STORY_OUTPUT.width / ratio,
    height: STORY_OUTPUT.height / ratio,
  });
}

import { Platform } from "react-native";
import { useReleasingSharedObject } from "expo";
import { createVideoPlayer, type VideoPlayer, type VideoSource } from "expo-video";

/**
 * Keeps the expo-video 57 player behaviour on expo-video 58. Use it instead of `useVideoPlayer`.
 *
 * 1. A new player, with `setup` run again, every time `source` changes. From 58, `useVideoPlayer`
 *    swaps the source in place with `replaceAsync` and skips `setup`, so players whose source starts
 *    empty and fills in later (cover videos, the upload preview, a feed card whose URL changes on
 *    refresh) would not get `play()` and their loop/mute settings for the real video.
 *    Same building blocks 57 used: `createVideoPlayer` (parseSource + new VideoPlayer(source, false))
 *    and `useReleasingSharedObject`, keyed on the source.
 * 2. iOS audio: 58 changed the iOS default `audioMixingMode` from `doNotMix` to `auto`. Set back to
 *    `doNotMix` on iOS only, before `setup` (which may call `play()`). Android's default stays `auto`
 *    (unchanged since 57); `doNotMix` there would make even muted players take audio focus and pause
 *    the user's music.
 */
export function useVideoPlayerRecreate(
  source: VideoSource,
  setup?: (player: VideoPlayer) => void,
): VideoPlayer {
  return useReleasingSharedObject(() => {
    const player = createVideoPlayer(source);
    if (Platform.OS === "ios") {
      player.audioMixingMode = "doNotMix";
    }
    setup?.(player);
    return player;
  }, [JSON.stringify(source)]);
}

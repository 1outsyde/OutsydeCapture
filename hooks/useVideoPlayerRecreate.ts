import { useReleasingSharedObject } from "expo";
import { createVideoPlayer, type VideoPlayer, type VideoSource } from "expo-video";

/**
 * The expo-video 57 `useVideoPlayer` behaviour: a brand new player, with `setup` run again,
 * every time `source` changes.
 *
 * From expo-video 58, `useVideoPlayer` swaps the source in place with `replaceAsync` and does
 * not run `setup` again. Players whose source starts empty and fills in once data loads
 * (profile cover videos, the upload preview) would then skip `setup`, so `play()` and the
 * loop/mute settings would not run for the real video. Use this hook for those players.
 *
 * `createVideoPlayer` and `useReleasingSharedObject` are exactly what expo-video 57 used inside
 * `useVideoPlayer`, so the player lifecycle (creation, release on change and unmount) is the same.
 */
export function useVideoPlayerRecreate(
  source: VideoSource,
  setup?: (player: VideoPlayer) => void,
): VideoPlayer {
  return useReleasingSharedObject(() => {
    const player = createVideoPlayer(source);
    setup?.(player);
    return player;
  }, [JSON.stringify(source)]);
}

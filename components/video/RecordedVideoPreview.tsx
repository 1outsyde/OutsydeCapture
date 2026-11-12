/**
 * Full screen playback of a video that was just recorded (or picked) on the Create Post camera,
 * TikTok style: plays with sound, loops, tap to pause and tap again to play.
 *
 * The camera is unmounted while this shows (CreatePostScreen renders one or the other), so the
 * recording session never holds the audio while the clip plays. The player is released when this
 * unmounts (useVideoPlayerRecreate), for example on Retake or Next.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayerRecreate } from "@/hooks/useVideoPlayerRecreate";

type Props = {
  uri: string;
};

export function RecordedVideoPreview({ uri }: Props) {
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayerRecreate(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  const toggle = () => {
    if (paused) {
      player.play();
      setPaused(false);
    } else {
      player.pause();
      setPaused(true);
    }
  };

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={paused ? "Play your video" : "Pause your video"}
      testID="recorded-video-preview"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {paused ? (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Feather name="play" size={40} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pausedBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "45%",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },
});

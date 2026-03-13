import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { Post } from "@/context/DataContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 80;
export const PULSE_CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

export interface PulseEngagementEvent {
  watchTimeSeconds: number;
  completionRate: number;
  isRewatch: boolean;
}

export interface PulseVideoCardProps {
  post: Post;
  isActive: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onAuthorPress: (post: Post) => void;
  onActionPress: (post: Post) => void;
  onEngagement: (postId: string, e: PulseEngagementEvent) => void;
}

// ─── Web video (HTML element) ────────────────────────────────────────────────
interface VideoInnerProps {
  videoUrl: string;
  isActive: boolean;
  isPaused: boolean;
  postId: string;
  onEngagement?: (e: PulseEngagementEvent) => void;
}

function WebPulseVideo({ videoUrl, isActive, isPaused, postId, onEngagement }: VideoInnerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchStartTime = useRef<number | null>(null);
  const totalWatchTime = useRef(0);
  const loopCount = useRef(0);

  const reportEngagement = useCallback(() => {
    if (!onEngagement || !watchStartTime.current) return;
    const session = (Date.now() - watchStartTime.current) / 1000;
    totalWatchTime.current += session;
    watchStartTime.current = null;
    if (totalWatchTime.current < 1) return;
    const duration = videoRef.current?.duration ?? 30;
    onEngagement({
      watchTimeSeconds: Math.round(totalWatchTime.current),
      completionRate: Math.round(Math.min(totalWatchTime.current / duration, 1) * 100) / 100,
      isRewatch: loopCount.current > 0,
    });
  }, [onEngagement]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !isPaused) {
      watchStartTime.current = Date.now();
      v.play().catch(() => {});
    } else if (isActive && isPaused) {
      if (watchStartTime.current) {
        totalWatchTime.current += (Date.now() - watchStartTime.current) / 1000;
        watchStartTime.current = null;
      }
      v.pause();
    } else {
      reportEngagement();
      totalWatchTime.current = 0;
      loopCount.current = 0;
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, isPaused, reportEngagement]);

  const handleEnded = useCallback(() => {
    loopCount.current += 1;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={videoRef as any}
        src={videoUrl}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
        playsInline
        onEnded={handleEnded}
      />
    </View>
  );
}

// ─── Native video (expo-video) ───────────────────────────────────────────────
function NativePulseVideo({ videoUrl, isActive, isPaused, postId, onEngagement }: VideoInnerProps) {
  const watchStartTime = useRef<number | null>(null);
  const totalWatchTime = useRef(0);
  const loopCount = useRef(0);
  const videoDuration = useRef(0);
  const lastTime = useRef(0);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const reportEngagement = useCallback(() => {
    if (!onEngagement || !watchStartTime.current) return;
    const session = (Date.now() - watchStartTime.current) / 1000;
    totalWatchTime.current += session;
    watchStartTime.current = null;
    if (totalWatchTime.current < 1) return;
    const duration = videoDuration.current > 0 ? videoDuration.current : 30;
    onEngagement({
      watchTimeSeconds: Math.round(totalWatchTime.current),
      completionRate: Math.round(Math.min(totalWatchTime.current / duration, 1) * 100) / 100,
      isRewatch: loopCount.current > 0,
    });
  }, [onEngagement]);

  useEffect(() => {
    if (isActive && !isPaused) {
      watchStartTime.current = Date.now();
      player.play();
    } else if (isActive && isPaused) {
      if (watchStartTime.current) {
        totalWatchTime.current += (Date.now() - watchStartTime.current) / 1000;
        watchStartTime.current = null;
      }
      player.pause();
    } else {
      reportEngagement();
      totalWatchTime.current = 0;
      loopCount.current = 0;
      player.pause();
    }
  }, [isActive, isPaused, player, reportEngagement]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (player.duration && player.duration > 0) videoDuration.current = player.duration;
        if (player.currentTime !== undefined) {
          if (videoDuration.current > 0 && player.currentTime < lastTime.current - 1) {
            loopCount.current += 1;
          }
          lastTime.current = player.currentTime;
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ─── Main PulseVideoCard ─────────────────────────────────────────────────────
export default function PulseVideoCard({
  post,
  isActive,
  isLiked = false,
  isSaved = false,
  onLike,
  onComment,
  onBookmark,
  onAuthorPress,
  onActionPress,
  onEngagement,
}: PulseVideoCardProps) {
  const { theme } = useTheme();
  const [isPaused, setIsPaused] = useState(false);

  // Reset pause state when card becomes inactive
  useEffect(() => {
    if (!isActive) setIsPaused(false);
  }, [isActive]);

  const handleTap = useCallback(() => {
    if (!isActive) return;
    setIsPaused((p) => !p);
  }, [isActive]);

  const handleEngagement = useCallback(
    (e: PulseEngagementEvent) => onEngagement(post.id, e),
    [onEngagement, post.id]
  );

  const hasVideo = !!post.videoUrl;
  const hasCommerce = !!(post.serviceId || post.productId);
  const soundName = (post as any).soundName || "Original Sound";

  const VideoComponent = Platform.OS === "web" ? WebPulseVideo : NativePulseVideo;

  return (
    <Pressable
      onPress={handleTap}
      style={[styles.card, { height: PULSE_CARD_HEIGHT }]}
    >
      {/* Background media */}
      {hasVideo && post.videoUrl ? (
        <VideoComponent
          videoUrl={post.videoUrl}
          isActive={isActive}
          isPaused={isPaused}
          postId={post.id}
          onEngagement={handleEngagement}
        />
      ) : post.image ? (
        <Image
          source={{ uri: post.image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />
      )}

      {/* Pause indicator */}
      {isActive && isPaused ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseIcon}>
            <Feather name="pause" size={36} color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.75)"]}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* Right engagement stack — absolute, right:16, bottom:160 */}
      <View style={styles.actionBar} pointerEvents="box-none">
        <Pressable
          onPress={() => onLike(post.id)}
          style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="heart" size={26} color={isLiked ? "#FF3B30" : "#FFFFFF"} />
          </View>
          <ThemedText style={styles.actionCount}>{post.likes}</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onComment(post)}
          style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="message-circle" size={26} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.actionCount}>{post.comments.length}</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionItem, { opacity: 0.7 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="star" size={26} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.actionCount}>
            {post.rating > 0 ? post.rating.toFixed(1) : "—"}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onBookmark(post)}
          style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="bookmark" size={26} color={isSaved ? theme.primary : "#FFFFFF"} />
          </View>
        </Pressable>
      </View>

      {/* Bottom-left author block — absolute, left:16, bottom:100 */}
      <View style={styles.authorBlock} pointerEvents="box-none">
        <Pressable onPress={() => onAuthorPress(post)} style={styles.authorRow}>
          {post.authorAvatar && post.authorAvatar.startsWith("http") ? (
            <Image
              source={{ uri: post.authorAvatar }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.avatarInitial}>
                {(post.displayName || post.authorName || "?").charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={styles.authorTexts}>
            <ThemedText style={styles.displayName} numberOfLines={1}>
              {post.displayName || post.authorName}
            </ThemedText>
            {post.username ? (
              <ThemedText style={styles.usernameText}>@{post.username}</ThemedText>
            ) : null}
          </View>
        </Pressable>

        {post.caption ? (
          <ThemedText style={styles.caption} numberOfLines={2}>
            {post.caption}
          </ThemedText>
        ) : null}

        {hasCommerce ? (
          <Pressable
            onPress={() => onActionPress(post)}
            style={({ pressed }) => [
              styles.commerceBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather
              name={post.productId ? "shopping-bag" : "calendar"}
              size={16}
              color="#000000"
            />
            <ThemedText style={styles.commerceBtnText}>
              {post.productId ? "Buy Now" : "Book Now"}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Bottom-right sound label — absolute, right:16, bottom:80 */}
      <View style={styles.soundLabel} pointerEvents="none">
        <Feather name="music" size={12} color="rgba(255,255,255,0.8)" />
        <ThemedText style={styles.soundText} numberOfLines={1}>
          {soundName}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pauseIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Right engagement stack
  actionBar: {
    position: "absolute",
    right: 16,
    bottom: 160,
    alignItems: "center",
    gap: Spacing.lg,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  // Bottom-left author block
  authorBlock: {
    position: "absolute",
    left: 16,
    bottom: 100,
    right: 80,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  authorTexts: {
    marginLeft: Spacing.sm,
  },
  displayName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  usernameText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
  },
  caption: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  commerceBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 9999,
    gap: Spacing.sm,
  },
  commerceBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },

  // Bottom-right sound label
  soundLabel: {
    position: "absolute",
    right: 16,
    bottom: 80,
    maxWidth: "60%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  soundText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
});

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { ApiPost } from "@/services/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
export const PROFILE_PAGER_CARD_HEIGHT = SCREEN_HEIGHT;

export interface ProfilePagerAuthor {
  name: string;
  avatarUrl?: string;
  username?: string;
}

export interface ProfilePagerCardProps {
  post: ApiPost;
  author: ProfilePagerAuthor | null;
  isOwner: boolean;
  isActive: boolean;
  isLiked: boolean;
  likesCount: number;
  isSaved: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: (postId: string) => void;
  onComment: (post: ApiPost) => void;
  onSave: (postId: string, currentlySaved: boolean) => void;
  onActionPress: (post: ApiPost) => void;
  onEdit: (post: ApiPost) => void;
  onDelete: (post: ApiPost) => void;
}

// ─── Web video (HTML element) ────────────────────────────────────────────────
interface VideoInnerProps {
  videoUrl: string;
  isActive: boolean;
  isPaused: boolean;
  muted: boolean;
}

function WebProfileVideo({ videoUrl, isActive, isPaused, muted }: VideoInnerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !isPaused) {
      v.play().catch(() => {});
    } else if (isActive && isPaused) {
      v.pause();
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, isPaused]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={videoRef as any}
        src={videoUrl}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted={muted}
        loop
        playsInline
      />
    </View>
  );
}

// ─── Native video (expo-video) ───────────────────────────────────────────────
function NativeProfileVideo({ videoUrl, isActive, isPaused, muted }: VideoInnerProps) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (isActive && !isPaused) {
      player.play();
    } else if (isActive && isPaused) {
      player.pause();
    } else {
      player.pause();
    }
  }, [isActive, isPaused, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function ProfilePagerCard({
  post,
  author,
  isOwner,
  isActive,
  isLiked,
  likesCount,
  isSaved,
  muted,
  onToggleMute,
  onLike,
  onComment,
  onSave,
  onActionPress,
  onEdit,
  onDelete,
}: ProfilePagerCardProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isPaused, setIsPaused] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Floating tab bar overlays content rather than reserving layout space
  // (see MainTabNavigator.tsx: height = 83 + insets.bottom / 2), so
  // bottom-anchored elements here must add their own clearance.
  const TAB_BAR_OVERLAY = 83 + insets.bottom / 2;
  const authorBlockBottom = TAB_BAR_OVERLAY + 16;
  const actionBarBottom = authorBlockBottom + 60;

  useEffect(() => {
    if (!isActive) setIsPaused(false);
  }, [isActive]);

  const handleTap = useCallback(() => {
    if (!isActive) return;
    setIsPaused((p) => !p);
  }, [isActive]);

  const mediaUrl = post.videoUrl || post.mediaUrl || post.imageUrl;
  const isVideo = post.mediaType === "video" || !!post.videoUrl;
  const hasCommerce = !!(post.serviceId || post.productId);
  const displayName = author?.name || "Outsyde User";

  const VideoComponent = Platform.OS === "web" ? WebProfileVideo : NativeProfileVideo;

  const handleSheetEdit = () => {
    setSheetVisible(false);
    onEdit(post);
  };

  const handleSheetDelete = () => {
    setSheetVisible(false);
    onDelete(post);
  };

  return (
    <Pressable
      onPress={handleTap}
      style={[styles.card, { height: PROFILE_PAGER_CARD_HEIGHT }]}
    >
      {/* Background media */}
      {isVideo && mediaUrl ? (
        <VideoComponent
          videoUrl={mediaUrl}
          isActive={isActive}
          isPaused={isPaused}
          muted={muted}
        />
      ) : mediaUrl ? (
        <Image
          source={{ uri: mediaUrl }}
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

      {/* Right action stack */}
      <View style={[styles.actionBar, { bottom: actionBarBottom }]} pointerEvents="box-none">
        <Pressable
          onPress={() => onLike(post.id)}
          style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="heart" size={26} color={isLiked ? "#FF3B30" : "#FFFFFF"} />
          </View>
          <ThemedText style={styles.actionCount}>{likesCount}</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onComment(post)}
          style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="message-circle" size={26} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.actionCount}>{post.commentsCount ?? 0}</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onSave(post.id, isSaved)}
          style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.actionIcon}>
            <Feather name="bookmark" size={26} color={isSaved ? theme.brandGold : "#FFFFFF"} />
          </View>
        </Pressable>

        {isOwner ? (
          <Pressable
            onPress={() => setSheetVisible(true)}
            style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.actionIcon}>
              <Feather name="more-horizontal" size={26} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : null}

        {isVideo ? (
          <Pressable
            onPress={onToggleMute}
            style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.actionIcon}>
              <Feather name={muted ? "volume-x" : "volume-2"} size={26} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* Bottom-left author block */}
      <View style={[styles.authorBlock, { bottom: authorBlockBottom }]} pointerEvents="box-none">
        <View style={styles.authorRow}>
          {author?.avatarUrl ? (
            <Image
              source={{ uri: author.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.avatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={styles.authorTexts}>
            <ThemedText style={styles.displayName} numberOfLines={1}>
              {displayName}
            </ThemedText>
            {author?.username ? (
              <ThemedText style={styles.usernameText}>@{author.username}</ThemedText>
            ) : null}
          </View>
        </View>

        {post.content ? (
          <ThemedText style={styles.caption} numberOfLines={2}>
            {post.content}
          </ThemedText>
        ) : null}

        {hasCommerce ? (
          <Pressable
            onPress={() => onActionPress(post)}
            style={({ pressed }) => [
              styles.commerceBtn,
              { backgroundColor: theme.brandPrimary, opacity: pressed ? 0.85 : 1 },
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

      {/* Owner ••• branded bottom sheet */}
      <Modal
        transparent
        animationType="fade"
        visible={sheetVisible}
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSheetVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheetPanel, { backgroundColor: theme.card ?? theme.backgroundRoot }]}>
                <View style={styles.sheetGrabber} />
                <Pressable style={styles.sheetItem} onPress={handleSheetEdit}>
                  <Feather name="edit-2" size={18} color={theme.text} />
                  <ThemedText style={styles.sheetItemText}>Edit Caption</ThemedText>
                </Pressable>
                <Pressable style={styles.sheetItem} onPress={handleSheetDelete}>
                  <Feather name="trash-2" size={18} color="#FF3B30" />
                  <ThemedText style={[styles.sheetItemText, { color: "#FF3B30" }]}>
                    Delete Post
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.sheetItem, styles.sheetItemCancel]}
                  onPress={() => setSheetVisible(false)}
                >
                  <ThemedText style={styles.sheetItemText}>Cancel</ThemedText>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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

  // Right action stack
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

  // Branded bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetPanel: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  sheetItemText: {
    fontSize: 16,
  },
  sheetItemCancel: {
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
  },
});

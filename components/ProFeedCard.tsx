import React, { useState, useCallback, useEffect } from "react";
import { View, Pressable, StyleSheet, Dimensions, Alert, ActionSheetIOS, Platform, Modal, TouchableWithoutFeedback } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Post } from "@/context/DataContext";
import { sendClickEvent } from "@/services/referral";
import { promptForReportReason } from "@/utils/moderationActions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_MEDIA_HEIGHT = SCREEN_WIDTH * 0.85;

interface ProFeedCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
  onSave: (post: Post) => void;
  onRate?: (post: Post) => void;
  onAuthorPress: (post: Post) => void;
  onActionPress: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string, reason: string) => void;
  onBlock?: (authorId: string) => void;
  onEdit?: (postId: string) => void;
  isSaved: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  isVisible?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

function CardVideoMedia({
  videoUrl,
  isVisible = true,
  muted = false,
  onToggleMute,
}: {
  videoUrl: string;
  isVisible?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}) {
  console.log("VIDEO_URL [Pro]:", videoUrl);

  const [isPlaying, setIsPlaying] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = muted;
    if (isVisible) {
      p.play();
      setIsPlaying(true);
    }
  });

  // Keep mute state in sync whenever the shared toggle changes.
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  // Control playback based on visibility.
  useEffect(() => {
    if (isVisible) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  }, [isVisible, player]);

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  return (
    <Pressable onPress={togglePlayback} style={styles.mediaContainer}>
      <VideoView
        player={player}
        style={styles.media}
        contentFit="cover"
        nativeControls={false}
      />
      {!isPlaying && (
        <View style={styles.playOverlay}>
          <Feather name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
        </View>
      )}
      <Pressable
        onPress={onToggleMute}
        style={styles.muteButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name={muted ? "volume-x" : "volume-2"} size={20} color="#FFFFFF" />
      </Pressable>
    </Pressable>
  );
}

export function ProFeedCard({
  post,
  onLike,
  onComment,
  onSave,
  onRate,
  onAuthorPress,
  onActionPress,
  onDelete,
  onReport,
  onBlock,
  onEdit,
  isSaved,
  currentUserId,
  isAdmin = false,
  isVisible = true,
  muted = false,
  onToggleMute,
}: ProFeedCardProps) {
  const { theme } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const hasVideo = post.videoUrl && post.videoUrl.length > 0;
  const hasCommerce = post.serviceId || post.productId;
  
  const isOwner = currentUserId && (post.userId === currentUserId || post.authorId === currentUserId);
  const canDelete = isOwner || isAdmin;

  const authorId = post.userId || post.authorId || "";
  const authorName = post.displayName || post.authorName || "User";

  const handleMenuPress = () => {
    if (Platform.OS === "ios") {
      const options = canDelete
        ? ["Edit Caption", "Delete Post", "Cancel"]
        : ["Report Post", `Block ${authorName}`, "Cancel"];
      const destructiveIndex = canDelete ? 1 : 1;
      const cancelIndex = canDelete ? 2 : 2;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: destructiveIndex,
          cancelButtonIndex: cancelIndex,
        },
        (buttonIndex) => {
          if (canDelete && buttonIndex === 0) {
            onEdit?.(post.id);
          } else if (canDelete && buttonIndex === 1 && onDelete) {
            Alert.alert(
              "Delete Post",
              "Are you sure you want to delete this post? This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => onDelete(post.id)
                }
              ]
            );
          } else if (!canDelete && buttonIndex === 0) {
            showReportDialog();
          } else if (!canDelete && buttonIndex === 1 && onBlock) {
            onBlock(authorId);
          }
        }
      );
    } else {
      setMenuVisible(true);
    }
  };

  const showReportDialog = () => {
    promptForReportReason((reason) => {
      if (onReport) onReport(post.id, reason);
    });
  };

  const handleAndroidMenuAction = (action: "edit" | "delete" | "report" | "block") => {
    setMenuVisible(false);
    if (action === "edit") {
      onEdit?.(post.id);
    } else if (action === "delete" && onDelete) {
      Alert.alert(
        "Delete Post",
        "Are you sure you want to delete this post? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDelete(post.id)
          }
        ]
      );
    } else if (action === "report") {
      showReportDialog();
    } else if (action === "block" && onBlock) {
      onBlock(authorId);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card ?? '#0F0E12' }]}>
      <Pressable onPress={() => onAuthorPress(post)} style={styles.header}>
        {post.authorAvatar && post.authorAvatar.startsWith("http") ? (
          <Image
            source={{ uri: post.authorAvatar }}
            style={styles.avatar}
            contentFit="cover"
            onError={() => {}}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { backgroundColor: theme.primary },
            ]}
          >
            <ThemedText style={styles.avatarInitial}>
              {(post.displayName || post.authorName || "?").charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={styles.headerInfo}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.authorName}>
              {post.displayName || post.authorName}
            </ThemedText>
            {post.type !== "user" && (
              <View style={[styles.badge, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.brandGold }]}>
                <ThemedText style={[styles.badgeText, { color: theme.brandGold }]}>
                  {post.type === "photographer" ? "Photographer" : "Business"}
                </ThemedText>
              </View>
            )}
            {hasCommerce && (
              <View style={styles.ratingInline}>
                <Feather name="star" size={12} color="#FFD700" />
                <ThemedText style={[styles.ratingText, { color: theme.textSecondary }]}>
                  {((post as any).author?.rating ?? post.rating ?? 0).toFixed(1)}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
        <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
          {formatTimestamp(post.createdAt)}
        </ThemedText>
        <Pressable
          onPress={handleMenuPress}
          style={({ pressed }) => [styles.menuButton, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="more-vertical" size={20} color={theme.textSecondary} />
        </Pressable>
      </Pressable>

      {Platform.OS !== "ios" && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.menuContainer, { backgroundColor: theme.card }]}>
                {canDelete ? (
                  <>
                    <Pressable
                      onPress={() => handleAndroidMenuAction("edit")}
                      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Feather name="edit-2" size={18} color={theme.text} />
                      <ThemedText style={styles.menuItemText}>
                        Edit Caption
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => handleAndroidMenuAction("delete")}
                      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Feather name="trash-2" size={18} color="#FF3B30" />
                      <ThemedText style={[styles.menuItemText, { color: "#FF3B30" }]}>
                        Delete Post
                      </ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={() => handleAndroidMenuAction("report")}
                      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Feather name="flag" size={18} color={theme.text} />
                      <ThemedText style={styles.menuItemText}>Report Post</ThemedText>
                    </Pressable>
                    {onBlock && (
                      <Pressable
                        onPress={() => handleAndroidMenuAction("block")}
                        style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Feather name="slash" size={18} color="#FF3B30" />
                        <ThemedText style={[styles.menuItemText, { color: "#FF3B30" }]}>
                          Block {authorName}
                        </ThemedText>
                      </Pressable>
                    )}
                  </>
                )}
                <Pressable
                  onPress={() => setMenuVisible(false)}
                  style={({ pressed }) => [styles.menuItem, styles.menuItemCancel, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <ThemedText style={[styles.menuItemText, { color: theme.textSecondary }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      <View style={styles.mediaContainer}>
        {hasVideo ? (
          <CardVideoMedia
            videoUrl={post.videoUrl!}
            isVisible={isVisible}
            muted={muted}
            onToggleMute={onToggleMute}
          />
        ) : (
          <Image
            source={{ uri: post.image }}
            style={styles.media}
            contentFit="cover"
            transition={200}
          />
        )}
        {hasCommerce && (
          <Pressable
            onPress={() => {
              if (post.influencerReferralCode) {
                sendClickEvent(post.influencerReferralCode, post.id);
              }
              onActionPress(post);
            }}
            style={[styles.commercePill, { backgroundColor: theme.brandPrimary }]}
          >
            <Feather
              name={post.productId ? "shopping-bag" : "calendar"}
              size={14}
              color="#000000"
            />
            <ThemedText style={styles.commercePillText}>
              {post.productId ? "Buy Now" : "Book Now"}
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <Pressable
            onPress={() => onLike(post.id)}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather
              name="heart"
              size={22}
              color={post.isLiked ? "#FF3B30" : theme.text}
            />
          </Pressable>
          <Pressable
            onPress={() => onComment(post)}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="message-circle" size={22} color={theme.text} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="send" size={22} color={theme.text} />
          </Pressable>
          {onRate && hasCommerce && (
            <Pressable
              onPress={() => onRate(post)}
              style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="star" size={22} color="#FFD700" />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => onSave(post)}
          style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather
            name="bookmark"
            size={22}
            color={isSaved ? theme.brandGold : theme.text}
          />
        </Pressable>
      </View>

      <View style={styles.content}>
        <ThemedText style={styles.likesCount}>{post.likes} likes</ThemedText>
        {post.caption ? (
          <ThemedText style={styles.caption} numberOfLines={2}>
            <ThemedText style={styles.captionAuthor}>
              {post.displayName || post.authorName}{" "}
            </ThemedText>
            {post.caption}
          </ThemedText>
        ) : null}
        {(post.commentCount ?? post.comments.length) > 0 && (
          <Pressable onPress={() => onComment(post)}>
            <ThemedText style={[styles.viewComments, { color: theme.textSecondary }]}>
              View all {post.commentCount ?? post.comments.length} comments
            </ThemedText>
          </Pressable>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "bold",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#000000",
  },
  ratingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: 4,
  },
  ratingText: {
    fontSize: 12,
  },
  timestamp: {
    fontSize: 12,
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: CARD_MEDIA_HEIGHT,
    position: "relative",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  muteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  actionsLeft: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  actionButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  captionAuthor: {
    fontWeight: "600",
  },
  viewComments: {
    fontSize: 14,
    marginTop: 4,
  },
  commercePill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  commercePillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  menuButton: {
    marginLeft: Spacing.sm,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    width: 250,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: 16,
  },
  menuItemCancel: {
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
    justifyContent: "center",
  },
});

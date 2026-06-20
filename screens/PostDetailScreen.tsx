import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";

import apiClient, { ApiPost } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
// TEMP PREVIEW — replaced in 5b
import ProfilePagerCard from "@/components/ProfilePagerCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PostDetailRouteProp = RouteProp<RootStackParamList, "PostDetail">;
type PostDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

function DetailVideoMedia({
  videoUrl,
  aspectRatio,
}: {
  videoUrl: string;
  aspectRatio: number;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

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
    <Pressable
      onPress={togglePlayback}
      style={[styles.mediaContainer, { width: SCREEN_WIDTH, aspectRatio }]}
    >
      <VideoView
        player={player}
        style={styles.media}
        contentFit="contain"
        nativeControls={false}
      />
      {!isPlaying && (
        <View style={styles.playOverlay}>
          <Feather name="play-circle" size={56} color="rgba(255,255,255,0.85)" />
        </View>
      )}
    </Pressable>
  );
}

export default function PostDetailScreen() {
  const navigation = useNavigation<PostDetailNavigationProp>();
  const route = useRoute<PostDetailRouteProp>();
  const { postId } = route.params;
  const { theme } = useTheme();
  const { user, isAuthenticated, getToken } = useAuth();

  const [post, setPost] = useState<ApiPost | null>(null);
  const [author, setAuthor] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const [deleteBusy, setDeleteBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  // TEMP PREVIEW — replaced in 5b
  const [isSaved, setIsSaved] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = isAuthenticated ? await getToken() : undefined;
        const { post: fetchedPost } = await apiClient.getPost(postId, token || undefined);
        if (cancelled) return;

        setPost(fetchedPost);
        setLikesCount(fetchedPost.likesCount || 0);

        const authorId = fetchedPost.authorId || fetchedPost.userId;
        if (authorId) {
          apiClient
            .getPublicUser(authorId)
            .then(({ user: publicUser }) => {
              if (!cancelled) setAuthor(publicUser);
            })
            .catch(() => {
              if (!cancelled) setAuthor(null);
            });
        }
      } catch (err) {
        console.error("Failed to load post:", err);
        if (!cancelled) setError("This post could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [postId, isAuthenticated, getToken]);

  const handleLikeToggle = useCallback(async () => {
    if (!post || likeBusy) return;

    if (!isAuthenticated) {
      Alert.alert("Sign In Required", "Please sign in to like posts.");
      return;
    }

    const wasLiked = isLiked;
    const previousLikesCount = likesCount;

    setLikeBusy(true);
    setIsLiked(!wasLiked);
    setLikesCount(wasLiked ? Math.max(0, previousLikesCount - 1) : previousLikesCount + 1);

    try {
      const token = await getToken();
      if (!token) {
        setIsLiked(wasLiked);
        setLikesCount(previousLikesCount);
        Alert.alert("Sign In Required", "Please sign in to like posts.");
        return;
      }
      if (wasLiked) {
        await apiClient.unlikePost(token, post.id);
      } else {
        await apiClient.likePost(token, post.id);
      }
    } catch (err) {
      console.error("Failed to like/unlike post:", err);
      setIsLiked(wasLiked);
      setLikesCount(previousLikesCount);
      Alert.alert("Unable to update like", "Please try again.");
    } finally {
      setLikeBusy(false);
    }
  }, [post, isLiked, likesCount, likeBusy, isAuthenticated, getToken]);

  const isOwner = !!user && !!post && user.id === (post.authorId || post.userId);

  const handleDelete = useCallback(() => {
    if (!post) return;
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleteBusy(true);
            try {
              const token = await getToken();
              if (!token) {
                Alert.alert("Sign In Required", "Please sign in to delete posts.");
                return;
              }
              await apiClient.deletePost(token, post.id);
              navigation.goBack();
            } catch (err) {
              console.error("Failed to delete post:", err);
              Alert.alert("Unable to delete post", "Please try again.");
            } finally {
              setDeleteBusy(false);
            }
          },
        },
      ],
    );
  }, [post, getToken, navigation]);

  const handleStartEdit = useCallback(() => {
    if (!post) return;
    setEditedCaption(post.content || "");
    setIsEditing(true);
  }, [post]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!post || saveBusy) return;

    setSaveBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign In Required", "Please sign in to edit posts.");
        return;
      }
      const { post: updatedPost } = await apiClient.updatePostCaption(token, post.id, editedCaption);
      setPost(updatedPost);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update post caption:", err);
      Alert.alert("Unable to save changes", "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  }, [post, editedCaption, saveBusy, getToken]);

  const handleSheetEdit = useCallback(() => {
    setSheetVisible(false);
    handleStartEdit();
  }, [handleStartEdit]);

  const handleSheetDelete = useCallback(() => {
    setSheetVisible(false);
    handleDelete();
  }, [handleDelete]);

  const mediaUrl = post?.videoUrl || post?.mediaUrl || post?.imageUrl;
  const isVideo = post?.mediaType === "video" && !!post?.videoUrl;
  const aspectRatio = post?.aspectRatio && post.aspectRatio > 0 ? post.aspectRatio : 1;
  const authorName = author?.name || "Outsyde User";
  const authorAvatar = author?.avatarUrl || author?.profileImageUrl;
  const authorBadge = author?.isPhotographer
    ? "Photographer"
    : author?.isVendor
      ? "Business"
      : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          hitSlop={16}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      {/* TEMP PREVIEW — replaced in 5b. Original render restored/replaced there.
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGold ?? theme.text} />
        </View>
      ) : error || !post ? (
        <View style={styles.centered}>
          <ThemedText style={{ color: theme.textSecondary }}>
            {error || "Post not found."}
          </ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {mediaUrl ? (
            isVideo ? (
              <DetailVideoMedia videoUrl={mediaUrl} aspectRatio={aspectRatio} />
            ) : (
              <Image
                source={{ uri: mediaUrl }}
                style={[styles.mediaContainer, { width: SCREEN_WIDTH, aspectRatio }]}
                contentFit="contain"
              />
            )
          ) : null}

          <View style={styles.body}>
            <View style={styles.authorRow}>
              {authorAvatar ? (
                <Image source={{ uri: authorAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.brandGold ?? theme.primary }]}>
                  <ThemedText style={styles.avatarInitial}>
                    {authorName.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View style={styles.authorInfo}>
                <ThemedText style={styles.authorName}>{authorName}</ThemedText>
                {authorBadge ? (
                  <ThemedText style={[styles.authorBadge, { color: theme.textSecondary }]}>
                    {authorBadge}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleLikeToggle}
                style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather
                  name="heart"
                  size={24}
                  color={isLiked ? "#FF3B30" : theme.text}
                />
              </Pressable>
              <View style={styles.actionButton}>
                <Feather name="message-circle" size={24} color={theme.text} />
              </View>
              {isOwner ? (
                <Pressable
                  onPress={() => setSheetVisible(true)}
                  style={({ pressed }) => [styles.moreButton, { opacity: pressed ? 0.7 : 1 }]}
                  disabled={deleteBusy}
                >
                  <Feather name="more-horizontal" size={24} color={theme.text} />
                </Pressable>
              ) : null}
            </View>

            <ThemedText style={styles.likesCount}>{likesCount} likes</ThemedText>

            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  value={editedCaption}
                  onChangeText={setEditedCaption}
                  multiline
                  maxLength={2000}
                  style={[styles.editInput, { color: theme.text, borderColor: theme.border ?? theme.textSecondary }]}
                  placeholder="Write a caption..."
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                />
                <View style={styles.editActionsRow}>
                  <Pressable
                    onPress={handleCancelEdit}
                    style={styles.editActionButton}
                    disabled={saveBusy}
                  >
                    <ThemedText style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveEdit}
                    style={styles.editActionButton}
                    disabled={saveBusy}
                  >
                    <ThemedText style={{ color: theme.brandGold ?? theme.primary, fontWeight: "600" }}>
                      {saveBusy ? "Saving..." : "Save"}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : post.content ? (
              <ThemedText style={styles.caption}>
                <ThemedText style={styles.captionAuthor}>{authorName} </ThemedText>
                {post.content}
              </ThemedText>
            ) : null}

            {post.commentsCount > 0 ? (
              <ThemedText style={[styles.viewComments, { color: theme.textSecondary }]}>
                {post.commentsCount} comment{post.commentsCount === 1 ? "" : "s"}
              </ThemedText>
            ) : null}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={sheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSheetVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheetPanel, { backgroundColor: theme.card ?? theme.backgroundRoot }]}>
                <View style={styles.sheetGrabber} />
                <Pressable
                  onPress={handleSheetEdit}
                  style={({ pressed }) => [styles.sheetItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="edit-2" size={18} color={theme.text} />
                  <ThemedText style={styles.sheetItemText}>Edit Caption</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSheetDelete}
                  style={({ pressed }) => [styles.sheetItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="trash-2" size={18} color="#FF3B30" />
                  <ThemedText style={[styles.sheetItemText, { color: "#FF3B30" }]}>
                    Delete Post
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setSheetVisible(false)}
                  style={({ pressed }) => [styles.sheetItem, styles.sheetItemCancel, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <ThemedText style={[styles.sheetItemText, { color: theme.textSecondary }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      */}

      {/* TEMP PREVIEW — replaced in 5b */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGold ?? theme.text} />
        </View>
      ) : error || !post ? (
        <View style={styles.centered}>
          <ThemedText style={{ color: theme.textSecondary }}>
            {error || "Post not found."}
          </ThemedText>
        </View>
      ) : (
        <ProfilePagerCard
          post={post}
          author={
            author
              ? {
                  name: authorName,
                  avatarUrl: authorAvatar,
                  username: author?.username,
                }
              : null
          }
          isOwner={isOwner}
          isActive
          isLiked={isLiked}
          likesCount={likesCount}
          isSaved={isSaved}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onLike={handleLikeToggle}
          onComment={() => {}}
          onSave={(_postId, currentlySaved) => setIsSaved(!currentlySaved)}
          onActionPress={() => {}}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  closeButton: {
    padding: 4,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  mediaContainer: {
    backgroundColor: "#000000",
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
  body: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  authorInfo: {
    marginLeft: Spacing.sm,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "600",
  },
  authorBadge: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    padding: 4,
  },
  moreButton: {
    marginLeft: "auto",
    padding: 4,
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
  editContainer: {
    marginTop: Spacing.xs,
  },
  editInput: {
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
  },
  editActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  editActionButton: {
    padding: 4,
  },
  captionAuthor: {
    fontWeight: "600",
  },
  viewComments: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
    backgroundColor: "rgba(128, 128, 128, 0.4)",
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
    borderTopColor: "rgba(128, 128, 128, 0.2)",
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
  },
});

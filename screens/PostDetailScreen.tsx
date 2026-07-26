import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import apiClient, { ApiPost } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useData, Post, PostType } from "@/context/DataContext";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { ProFeedCard } from "@/components/ProFeedCard";
import PulseVideoCard, { PULSE_CARD_HEIGHT } from "@/components/PulseVideoCard";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type PostDetailRouteProp = RouteProp<RootStackParamList, "PostDetail">;
type PostDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 80,
  minimumViewTime: 100,
};

function convertApiPost(apiPost: ApiPost, author: Record<string, any>): Post {
  const displayName = author.name || author.username || "Unknown";
  const authorAvatar = author.avatarUrl || author.profileImageUrl || "";
  const userId = author.userId || author.id;
  const username = author.username;

  let postType: PostType = "user";
  if (author.isPhotographer) {
    postType = "photographer";
  } else if (author.isVendor) {
    postType = "vendor";
  }

  const providerId =
    apiPost.providerId || apiPost.taggedPhotographerId || apiPost.taggedBusinessId;

  const layout = apiPost.displayLayout || apiPost.feedSurface;
  const isVideoPost = layout === "pulse";

  return {
    id: apiPost.id,
    type: postType,
    userId,
    username,
    displayName,
    authorAvatar,
    authorId: userId,
    authorName: displayName,
    subscriptionTier: undefined,
    rating: 0,
    reviewCount: 0,
    image: apiPost.imageUrl || (isVideoPost ? "" : apiPost.mediaUrl) || (apiPost.images && apiPost.images[0]) || "",
    videoUrl: isVideoPost ? (apiPost.videoUrl || apiPost.mediaUrl) : undefined,
    displayLayout: (apiPost.displayLayout || apiPost.feedSurface) as ("pro" | "pulse" | undefined),
    caption: apiPost.content || "",
    likes: (apiPost as any).likeCount ?? (apiPost as any).likesCount ?? 0,
    isLiked: (apiPost as any).isLiked ?? false,
    comments: [],
    commentCount: (apiPost as any).commentCount ?? (apiPost as any).commentsCount ?? 0,
    createdAt: apiPost.createdAt,
    serviceId: apiPost.photographerServiceId || apiPost.serviceId,
    productId: apiPost.productId,
    providerId,
    photographerId: postType === "photographer" ? (providerId || userId) : undefined,
    photographerName: postType === "photographer" ? displayName : undefined,
  };
}

export default function PostDetailScreen() {
  const navigation = useNavigation<PostDetailNavigationProp>();
  const route = useRoute<PostDetailRouteProp>();
  const { userId, initialPostId } = route.params;
  const { theme } = useTheme();
  const { user, getToken } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getPhotographer } = useData();
  const insets = useSafeAreaInsets();
  const NAV_BAR_HEIGHT = insets.top + 52;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [profileName, setProfileName] = useState("");

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedCaption, setEditedCaption] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const initialIndexRef = useRef(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ posts: apiPosts }, { user: author }] = await Promise.all([
          apiClient.getProfilePosts(userId),
          apiClient.getPublicUser(userId),
        ]);
        if (cancelled) return;

        setProfileName(author.name || author.username || "");

        const converted = apiPosts.map((p) => convertApiPost(p, author));
        setPosts(converted);

        const startIndex = converted.findIndex((p) => p.id === initialPostId);
        initialIndexRef.current = startIndex >= 0 ? startIndex : 0;
        setActiveIndex(initialIndexRef.current);
      } catch (err) {
        console.error("Failed to load profile posts:", err);
        if (!cancelled) setError("These posts could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, initialPostId]);

  const handleLike = useCallback(
    async (postId: string) => {
      const current = posts.find((p) => p.id === postId);
      const wasLiked = current?.isLiked ?? false;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !wasLiked, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
            : p
        )
      );

      try {
        const token = await getToken();
        if (!token) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? { ...p, isLiked: wasLiked, likes: wasLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
                : p
            )
          );
          Alert.alert("Sign In Required", "Please sign in to like posts.");
          return;
        }
        if (wasLiked) {
          await apiClient.unlikePost(token, postId);
        } else {
          await apiClient.likePost(token, postId);
        }
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, isLiked: wasLiked, likes: wasLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
              : p
          )
        );
      }
    },
    [posts, getToken]
  );

  const handleSave = useCallback(
    (post: Post) => {
      const favoriteType = post.type === "vendor" ? "product" : "photographer";
      toggleFavorite({
        id: post.id,
        type: favoriteType,
        name: post.type === "vendor" && (post as any).productName ? (post as any).productName : post.authorName,
        image: post.image,
        subtitle:
          post.type === "vendor"
            ? `$${(post as any).productPrice?.toFixed(2)}`
            : post.caption?.substring(0, 50),
      });
    },
    [toggleFavorite]
  );

  const handleComment = useCallback((_post: Post) => {
    // No-op for this build — full comments modal is a follow-up.
  }, []);

  const handleAuthorPress = useCallback(
    (post: Post) => {
      const vendorId = post.providerId || post.userId;
      if (!vendorId) return;
      navigation.navigate("VendorDetail", { vendorId });
    },
    [navigation]
  );

  const handleActionPress = useCallback(
    (post: Post) => {
      if (post.serviceId) {
        const photographerId = post.photographerId || post.providerId || post.userId;
        const photographer = getPhotographer(photographerId);
        navigation.navigate("Booking", {
          photographer: photographer || undefined,
          photographerId,
          preselectedServiceId: post.serviceId,
        });
      } else if (post.productId) {
        const businessId = post.providerId || post.userId;
        navigation.navigate("VendorDetail", {
          vendorId: businessId,
          initialTab: "products",
          productId: post.productId,
        });
      }
    },
    [navigation, getPhotographer]
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert("Error", "You must be logged in to delete posts.");
          return;
        }
        await apiClient.deletePost(token, postId);
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } catch (err) {
        console.error("Failed to delete post:", err);
        Alert.alert("Unable to delete post", "Please try again.");
      }
    },
    [getToken]
  );

  const handleEdit = useCallback(
    (postId: string) => {
      const target = posts.find((p) => p.id === postId);
      setEditedCaption(target?.caption || "");
      setEditingPostId(postId);
    },
    [posts]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingPostId(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPostId || saveBusy) return;
    setSaveBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign In Required", "Please sign in to edit posts.");
        return;
      }
      const { post: updatedPost } = await apiClient.updatePostCaption(token, editingPostId, editedCaption);
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPostId ? { ...p, caption: updatedPost.content || "" } : p))
      );
      setEditingPostId(null);
    } catch (err) {
      console.error("Failed to update post caption:", err);
      Alert.alert("Unable to save changes", "Please try again.");
    } finally {
      setSaveBusy(false);
    }
  }, [editingPostId, editedCaption, saveBusy, getToken]);

  const handleReport = useCallback(
    async (postId: string, reason: string) => {
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert("Sign In Required", "Please sign in to report posts.");
          return;
        }
        await apiClient.reportPost(token, postId, reason);
        Alert.alert("Reported", "Thanks — our team will review this post.");
      } catch (err) {
        console.error("Failed to report post:", err);
        Alert.alert("Unable to report post", "Please try again.");
      }
    },
    [getToken]
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: PULSE_CARD_HEIGHT,
      offset: PULSE_CARD_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const isVendor = item.type === "vendor";
      const isSaved = isFavorite(item.id, isVendor ? "product" : "photographer");
      const isVideo = item.displayLayout === "pulse";

      return isVideo ? (
        <View style={{ height: PULSE_CARD_HEIGHT }}>
          <PulseVideoCard
            post={item}
            isActive={index === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            isLiked={item.isLiked}
            isSaved={isSaved}
            onLike={handleLike}
            onComment={handleComment}
            onBookmark={handleSave}
            onAuthorPress={handleAuthorPress}
            onActionPress={handleActionPress}
            onEngagement={() => {}}
          />
        </View>
      ) : (
  <View style={{ height: PULSE_CARD_HEIGHT, backgroundColor: "#000" }}>
    <ProFeedCard
            post={item}
            isVisible={index === activeIndex}
            isSaved={isSaved}
            onLike={handleLike}
            onComment={handleComment}
            onSave={handleSave}
            onAuthorPress={handleAuthorPress}
            onActionPress={handleActionPress}
            onDelete={handleDelete}
            onReport={handleReport}
            onEdit={handleEdit}
            currentUserId={user?.id}
            isAdmin={(user as any)?.isAdmin}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        </View>
      );
    },
    [
      activeIndex,
      muted,
      isFavorite,
      handleLike,
      handleComment,
      handleSave,
      handleAuthorPress,
      handleActionPress,
      handleDelete,
      handleReport,
      handleEdit,
      user,
      NAV_BAR_HEIGHT,
    ]
  );

  const activePost = posts[activeIndex];
  const showCommentBar = !!activePost && activePost.displayLayout !== "pulse";

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.brandGold ?? theme.text} />
        </View>
      ) : error || posts.length === 0 ? (
        <View style={styles.centered}>
          <ThemedText style={{ color: theme.textSecondary }}>
            {error || "No posts found."}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => `post-detail-${item.id}`}
          pagingEnabled
          horizontal={false}
          snapToInterval={PULSE_CARD_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialIndexRef.current}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          windowSize={5}
          maxToRenderPerBatch={3}
          removeClippedSubviews
        />
      )}

      <View style={[styles.navBar, { paddingTop: insets.top, height: NAV_BAR_HEIGHT, backgroundColor: theme.backgroundRoot ?? "#080C08" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.navBackButton} hitSlop={16}>
          <Feather name="chevron-left" size={26} color="#FFFFFF" />
        </Pressable>
        <View style={styles.navTitleBlock}>
          <ThemedText style={styles.navTitle}>Posts</ThemedText>
          {profileName ? (
            <ThemedText style={styles.navSubtitle}>{profileName}</ThemedText>
          ) : null}
        </View>
        <View style={styles.navSpacer} />
      </View>

      {showCommentBar && (
        <View style={[styles.commentBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          {user?.avatar || user?.profileImageUrl ? (
            <Image
              source={{ uri: user?.avatar || user?.profileImageUrl }}
              style={styles.commentAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
              <ThemedText style={styles.commentAvatarInitial}>
                {(user?.displayName || user?.username || "?").charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <Pressable
            style={styles.commentInputPlaceholder}
            onPress={() => activePost && handleComment(activePost)}
          >
            <ThemedText style={styles.commentInputText}>Add a comment…</ThemedText>
          </Pressable>
        </View>
      )}

      <Modal
        visible={editingPostId !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <TouchableWithoutFeedback onPress={handleCancelEdit}>
          <View style={styles.editOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.editPanel, { backgroundColor: theme.card ?? theme.backgroundRoot }]}>
                <ThemedText style={styles.editTitle}>Edit Caption</ThemedText>
                <ScreenKeyboardAwareScrollView
                  contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
                  keyboardShouldPersistTaps="handled"
                >
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
                  <Pressable onPress={handleCancelEdit} style={styles.editActionButton} disabled={saveBusy}>
                    <ThemedText style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable onPress={handleSaveEdit} style={styles.editActionButton} disabled={saveBusy}>
                    <ThemedText style={{ color: theme.brandGold ?? theme.primary, fontWeight: "600" }}>
                      {saveBusy ? "Saving..." : "Save"}
                    </ThemedText>
                  </Pressable>
                </View>
                </ScreenKeyboardAwareScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  navBackButton: {
    width: 36,
    padding: 4,
  },
  navTitleBlock: {
    flex: 1,
    alignItems: "center",
  },
  navTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  navSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  navSpacer: {
    width: 36,
  },
  commentBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: "rgba(8,12,8,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  commentAvatarPlaceholder: {
    backgroundColor: "#D4A84B",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitial: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "bold",
  },
  commentInputPlaceholder: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  commentInputText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  editPanel: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
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
});

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  Dimensions,
  Alert,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useData, Post } from "@/context/DataContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import api, { ApiPost, PulseEngagement } from "@/services/api";
import { feedEvents } from "@/services/feedEvents";
import PulseVideoCard, { PULSE_CARD_HEIGHT, PulseEngagementEvent } from "@/components/PulseVideoCard";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Must be defined outside component to prevent "Changing viewabilityConfig on the fly" error
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 80,
  minimumViewTime: 100,
};

function convertApiPost(apiPost: ApiPost): Post {
  const displayName =
    (apiPost.author as any)?.displayName || apiPost.author?.name || "Unknown";
  const authorAvatar =
    (apiPost.author as any)?.profilePhotoUrl || apiPost.author?.profileImageUrl || "";
  const userId = apiPost.userId || (apiPost.author as any)?.userId || apiPost.author?.id;
  const username = apiPost.author?.username;
  const authorRole = (apiPost.author as any)?.role;

  let postType: Post["type"] = "user";
  if (apiPost.authorType === "photographer" || authorRole === "photographer") {
    postType = "photographer";
  } else if (
    apiPost.authorType === "vendor" ||
    apiPost.authorType === "business" ||
    authorRole === "vendor" ||
    authorRole === "business"
  ) {
    postType = "vendor";
  }

  const providerId =
    apiPost.providerId ||
    apiPost.author?.photographerId ||
    apiPost.author?.businessId ||
    apiPost.taggedPhotographerId ||
    apiPost.taggedBusinessId;

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
    rating: (apiPost.author as any)?.rating || 0,
    reviewCount: (apiPost.author as any)?.reviewCount || 0,
    image: apiPost.imageUrl || (apiPost.images && apiPost.images[0]) || "",
    videoUrl: apiPost.videoUrl || apiPost.mediaUrl,
    caption: apiPost.content || "",
    likes: (apiPost as any).likeCount ?? (apiPost as any).likesCount ?? 0,
    isLiked: false,
    comments: [],
    commentCount: (apiPost as any).commentCount ?? (apiPost as any).commentsCount ?? 0,
    createdAt: apiPost.createdAt,
    serviceId: apiPost.photographerServiceId || apiPost.serviceId,
    productId: apiPost.productId,
    providerId,
    photographerId: apiPost.authorType === "photographer" ? userId : undefined,
    photographerName: apiPost.authorType === "photographer" ? displayName : undefined,
  };
}

function formatRelativeTime(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "1d";
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function PulseFeedScreenV2() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getPhotographer } = useData();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getToken } = useAuth();

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Active video index — drives single-video playback
  const [activeIndex, setActiveIndex] = useState(0);

  // Shared mute state — one toggle for the entire Pulse feed, default UNMUTED
  const [muted, setMuted] = useState(false);

  // Comments modal state
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const listRef = useRef<FlatList>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setLoading(true);
        setCursor(undefined);
      } else {
        setLoadingMore(true);
      }

      const token = await getToken();
      const response = await api.getPulseFeed(
        { limit: 20, cursor: refresh ? undefined : cursor },
        token || undefined
      );

      if (response.posts && Array.isArray(response.posts)) {
        const converted = response.posts.map(convertApiPost);
        setPosts((prev) => (refresh ? converted : [...prev, ...converted]));
        setHasMore(response.hasMore);
        setCursor(response.nextCursor);
      }
    } catch (err) {
      console.error("[PulseFeedV2] Fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [getToken, cursor]);

  useEffect(() => {
    fetchPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when a new Pulse post is published
  useEffect(() => {
    const unsub = feedEvents.subscribe((feedType) => {
      if (feedType === "pulse") fetchPosts(true);
    });
    return unsub;
  }, [fetchPosts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(true);
  }, [fetchPosts]);

  const handleEndReached = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPosts(false);
    }
  }, [loadingMore, hasMore, fetchPosts]);

  // ─── Viewability — single active index ─────────────────────────────────────
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  // ─── Engagement tracking ────────────────────────────────────────────────────
  const handleEngagement = useCallback(
    async (postId: string, e: PulseEngagementEvent) => {
      try {
        const token = await getToken();
        if (token) {
          const payload: PulseEngagement = {
            postId,
            watchTimeMs: e.watchTimeMs,
            videoDurationMs: e.videoDurationMs,
            isRewatch: e.isRewatch,
          };
          console.log('[Engagement] POST', payload);
          await api.trackPulseEngagement(token, payload);
        }
      } catch {
        // Non-critical — silent fail
      }
    },
    [getToken]
  );

  // ─── Like (optimistic update with rollback) ─────────────────────────────────
  const handleLike = useCallback(
    async (postId: string) => {
      const wasLiked = likedIds.has(postId);

      // Optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.delete(postId) : next.add(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
            : p
        )
      );

      try {
        const token = await getToken();
        if (token) {
          if (wasLiked) {
            await api.unlikePost(token, postId);
          } else {
            await api.likePost(token, postId);
          }
        }
      } catch {
        // Rollback
        setLikedIds((prev) => {
          const next = new Set(prev);
          wasLiked ? next.add(postId) : next.delete(postId);
          return next;
        });
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likes: wasLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
              : p
          )
        );
      }
    },
    [likedIds, getToken]
  );

  // ─── Bookmark ───────────────────────────────────────────────────────────────
  const handleBookmark = useCallback((post: Post) => {
    const isVendor = post.type === "vendor";
    toggleFavorite({
      id: post.id,
      type: isVendor ? "product" : "photographer",
      name:
        isVendor && (post as any).productName
          ? (post as any).productName
          : post.authorName,
      image: post.image,
      subtitle: isVendor
        ? `$${(post as any).productPrice?.toFixed(2)}`
        : post.caption?.substring(0, 50),
    });
  }, [toggleFavorite]);

  // ─── Comments ───────────────────────────────────────────────────────────────
  const handleCloseComments = useCallback(() => {
    setCommentsVisible(false);
    setModalComments([]);
  }, []);

  const handleComment = useCallback(async (post: Post) => {
    setSelectedPost(post);
    setCommentsVisible(true);
    setCommentsLoading(true);
    try {
      const res = await api.getPostComments(post.id);
      const fetched = res.comments || [];
      console.log('[Comments] fetched', fetched.length, 'for', post.id);
      setModalComments(fetched);
    } catch {
      setModalComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!selectedPost || !commentText.trim()) return;
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign In Required", "Please sign in to comment on posts.");
        return;
      }
      await api.addPostComment(token, selectedPost.id, commentText.trim());
      setCommentText("");
      // Refetch for correctness
      const res = await api.getPostComments(selectedPost.id);
      setModalComments(res.comments || []);
      // Optimistically bump count in feed list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id
            ? { ...p, commentCount: (p.commentCount ?? 0) + 1 }
            : p
        )
      );
    } catch (err) {
      console.error("[PulseFeedV2] Comment error:", err);
      Alert.alert("Error", "Failed to post comment. Please try again.");
    }
  }, [selectedPost, commentText, getToken]);

  // ─── Navigation ─────────────────────────────────────────────────────────────
  const handleAuthorPress = useCallback((post: Post) => {
    const vendorId = post.providerId || post.userId;
    if (!vendorId) {
      console.warn('[AuthorTap] no id available for post', post.id);
      return;
    }
    console.log('[AuthorTap] → VendorDetail vendorId:', vendorId);
    navigation.navigate("VendorDetail", { vendorId });
  }, [navigation]);

  const handleActionPress = useCallback((post: Post) => {
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
  }, [navigation, getPhotographer]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const isVendor = item.type === "vendor";
      const isSaved = isFavorite(item.id, isVendor ? "product" : "photographer");

      return (
        <PulseVideoCard
          post={item}
          isActive={index === activeIndex}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          isLiked={likedIds.has(item.id)}
          isSaved={isSaved}
          onLike={handleLike}
          onComment={handleComment}
          onBookmark={handleBookmark}
          onAuthorPress={handleAuthorPress}
          onActionPress={handleActionPress}
          onEngagement={handleEngagement}
        />
      );
    },
    [
      activeIndex,
      muted,
      likedIds,
      isFavorite,
      handleLike,
      handleComment,
      handleBookmark,
      handleAuthorPress,
      handleActionPress,
      handleEngagement,
    ]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: PULSE_CARD_HEIGHT,
      offset: PULSE_CARD_HEIGHT * index,
      index,
    }),
    []
  );

  // Loading state
  if (loading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md, color: "#FFFFFF" }}>
          Loading Pulse...
        </ThemedText>
      </View>
    );
  }

  // Empty state
  if (!loading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <Feather name="video" size={56} color="rgba(255,255,255,0.45)" />
        <ThemedText type="h3" style={{ marginTop: Spacing.lg, color: "#FFFFFF" }}>
          No Pulse content yet
        </ThemedText>
        <ThemedText
          type="body"
          style={{ marginTop: Spacing.sm, color: "rgba(255,255,255,0.65)", textAlign: "center" }}
        >
          Be the first to share a video!
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => `pulse-v2-${item.id}`}
        pagingEnabled
        horizontal={false}
        snapToInterval={PULSE_CARD_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={["#FFFFFF"]}
          />
        }
        style={styles.list}
        windowSize={5}
        maxToRenderPerBatch={3}
        removeClippedSubviews
        ListFooterComponent={
          loadingMore ? (
            <View style={[styles.footer, { height: PULSE_CARD_HEIGHT }]}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : null
        }
      />

      {/* Comments modal */}
      <Modal
        visible={commentsVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseComments}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCloseComments}
          />
          <View style={[styles.commentsSheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h4">Comments</ThemedText>
              <Pressable onPress={handleCloseComments}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {commentsLoading ? (
              <View style={styles.listArea}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : (
              <FlatList
                data={modalComments}
                keyExtractor={(c, i) => c.id ?? String(i)}
                style={styles.commentList}
                contentContainerStyle={styles.commentListContent}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <ThemedText style={{ color: theme.textSecondary }}>
                      No comments yet. Be the first!
                    </ThemedText>
                  </View>
                }
                renderItem={({ item: c }) => {
                  const author = c.author || {};
                  const displayName =
                    c.user?.name ||
                    c.user?.username ||
                    (c.user?.firstName
                      ? (c.user.firstName + (c.user.lastName ? ' ' + c.user.lastName : '')).trim()
                      : undefined) ||
                    c.userName || c.username || author.displayName || author.username || author.name || "User";
                  const avatarUri =
                    c.userAvatar || author.profilePhotoUrl || author.profileImageUrl || c.user?.profileImageUrl || "";
                  const body = c.text || c.content || "";
                  const timestamp = formatRelativeTime(c.createdAt || "");
                  return (
                    <View style={styles.commentRow}>
                      {avatarUri ? (
                        <Image
                          source={{ uri: avatarUri }}
                          style={styles.commentAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.commentAvatarPlaceholder}>
                          <ThemedText style={styles.commentAvatarInitial}>
                            {displayName.charAt(0).toUpperCase()}
                          </ThemedText>
                        </View>
                      )}
                      <View style={styles.commentRight}>
                        <View style={styles.commentMeta}>
                          <ThemedText style={styles.commentAuthorText}>{displayName}</ThemedText>
                          {timestamp ? (
                            <ThemedText style={styles.commentTimestamp}>{timestamp}</ThemedText>
                          ) : null}
                        </View>
                        <ThemedText style={styles.commentBodyText}>{body}</ThemedText>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={[styles.commentInput, { borderTopColor: theme.border }]}>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: theme.backgroundSecondary, color: theme.text },
                  ]}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  onSubmitEditing={handleSubmitComment}
                  returnKeyType="send"
                />
                <Pressable
                  onPress={handleSubmitComment}
                  style={[styles.sendBtn, { backgroundColor: theme.primary }]}
                >
                  <Feather name="send" size={18} color="#000000" />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  list: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    paddingHorizontal: Spacing.xl,
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Comments modal
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  commentsSheet: {
    height: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#999",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  listArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  commentList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  commentListContent: {
    flexGrow: 1,
  },
  emptyComments: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  commentRow: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "flex-start",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitial: {
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
  },
  commentRight: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  commentAuthorText: {
    fontSize: 13,
    fontWeight: "700",
  },
  commentTimestamp: {
    fontSize: 11,
    color: "#999",
    marginLeft: 6,
  },
  commentBodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: 9999,
    marginRight: Spacing.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

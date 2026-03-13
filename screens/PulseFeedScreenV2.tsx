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
  const userId = apiPost.userId || (apiPost.author as any)?.userId || apiPost.author?.id || apiPost.id;
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
    likes: apiPost.likesCount || 0,
    isLiked: false,
    comments: [],
    createdAt: apiPost.createdAt,
    serviceId: apiPost.photographerServiceId || apiPost.serviceId,
    productId: apiPost.productId,
    providerId,
    photographerId: apiPost.authorType === "photographer" ? userId : undefined,
    photographerName: apiPost.authorType === "photographer" ? displayName : undefined,
  };
}

export default function PulseFeedScreenV2() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { addComment, getPhotographer } = useData();
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

  // Comments modal state
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");

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
          await api.trackPulseEngagement(token, {
            postId,
            watchTimeSeconds: e.watchTimeSeconds,
            completionRate: e.completionRate,
            isRewatch: e.isRewatch,
          } as PulseEngagement);
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
  const handleComment = useCallback((post: Post) => {
    setSelectedPost(post);
    setCommentsVisible(true);
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!selectedPost || !commentText.trim()) return;
    try {
      await addComment(selectedPost.id, commentText.trim());
      setCommentText("");
    } catch (err) {
      console.error("[PulseFeedV2] Comment error:", err);
    }
  }, [selectedPost, commentText, addComment]);

  // ─── Navigation ─────────────────────────────────────────────────────────────
  const handleAuthorPress = useCallback((post: Post) => {
    const userType =
      post.type === "photographer" ? "photographer" : post.type === "vendor" ? "business" : "consumer";
    navigation.navigate("Profile", {
      userId: post.userId,
      profileId: post.providerId,
      userType,
      displayName: post.displayName || post.authorName,
      avatar: post.authorAvatar,
    });
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
        onRefresh={handleRefresh}
        refreshing={refreshing}
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
        onRequestClose={() => setCommentsVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCommentsVisible(false)}
          />
          <View style={[styles.commentsSheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h4">Comments</ThemedText>
              <Pressable onPress={() => setCommentsVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <FlatList
              data={selectedPost?.comments || []}
              keyExtractor={(c) => c.id}
              style={styles.commentList}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <ThemedText style={{ color: theme.textSecondary }}>
                    No comments yet. Be the first!
                  </ThemedText>
                </View>
              }
              renderItem={({ item: c }) => (
                <View style={styles.commentRow}>
                  <Image
                    source={{ uri: c.userAvatar }}
                    style={styles.commentAvatar}
                    contentFit="cover"
                  />
                  <ThemedText style={styles.commentText}>
                    <ThemedText style={{ fontWeight: "700" }}>{c.userName} </ThemedText>
                    {c.text}
                  </ThemedText>
                </View>
              )}
            />

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
          </View>
        </KeyboardAvoidingView>
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.72,
    paddingBottom: Spacing.xl,
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
  commentList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  emptyComments: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
  },
  commentRow: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    alignItems: "flex-start",
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: Spacing.sm,
  },
  commentText: {
    flex: 1,
    lineHeight: 20,
  },
  commentInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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

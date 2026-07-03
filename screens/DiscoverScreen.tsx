import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  TextInput,
  Dimensions,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useData, Post, PostType } from "@/context/DataContext";
import { useRatingEligibility } from "@/hooks/useRatingEligibility";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import api, { ApiPost } from "@/services/api";
import { FeedToggle, FeedMode } from "@/components/FeedToggle";
import { ProFeedCard } from "@/components/ProFeedCard";
import { feedEvents } from "@/services/feedEvents";
import PulseFeedScreenV2 from "@/screens/PulseFeedScreenV2";
import { resolvePostMedia } from "@/utils/resolvePostMedia";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PRO_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};

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

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { getPhotographer } = useData();
  const { checkEligibility } = useRatingEligibility();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user, getToken } = useAuth();

  const [feedMode, setFeedMode] = useState<FeedMode>("pro");
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Comments modal (Pro feed)
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Feed toggle / swipe
  const handleModeChange = useCallback((mode: FeedMode) => setFeedMode(mode), []);

  const swipeToToggle = useCallback(
    (direction: "left" | "right") => {
      if (direction === "left" && feedMode === "pro") setFeedMode("pulse");
      else if (direction === "right" && feedMode === "pulse") setFeedMode("pro");
    },
    [feedMode]
  );

  // ─── Convert API post ─────────────────────────────────────────────────────
  const convertApiPostToPost = useCallback((apiPost: ApiPost): Post => {
    const displayName =
      (apiPost.author as any)?.displayName || apiPost.author?.name || "Unknown";
    const authorAvatar =
      (apiPost.author as any)?.profilePhotoUrl || apiPost.author?.profileImageUrl || "";
    const userId =
      apiPost.userId || (apiPost.author as any)?.userId || apiPost.author?.id;
    const username = apiPost.author?.username;
    const authorRole = (apiPost.author as any)?.role;

    let postType: PostType = "user";
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

    const media = resolvePostMedia(apiPost);

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
      image: media.imageUrl,
      videoUrl: media.videoUrl ?? undefined,
      caption: apiPost.content || "",
      likes: (apiPost as any).likeCount ?? (apiPost as any).likesCount ?? 0,
      isLiked: (apiPost as any).isLiked ?? false,
      comments: [],
      commentCount: (apiPost as any).commentCount ?? (apiPost as any).commentsCount ?? 0,
      createdAt: apiPost.createdAt,
      serviceId: apiPost.photographerServiceId || apiPost.serviceId,
      productId: apiPost.productId,
      providerId,
      photographerId: apiPost.authorType === "photographer" ? userId : undefined,
      photographerName: apiPost.authorType === "photographer" ? displayName : undefined,
    };
  }, []);

  // ─── Silent location helper ────────────────────────────────────────────────
  const getLocationParams = useCallback(async (): Promise<{
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
  }> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      const city = await AsyncStorage.getItem("@outsyde_onboarding_city");
      const state = await AsyncStorage.getItem("@outsyde_onboarding_state");
      if (city) {
        return { city, state: state ?? undefined };
      }
    } catch {}
    return {};
  }, []);

  // ─── Pro feed fetch ───────────────────────────────────────────────────────
  const fetchProFeed = useCallback(async () => {
    try {
      setFeedLoading(true);
      const [token, locationParams] = await Promise.all([getToken(), getLocationParams()]);
      const response = await api.getFeed(
        { limit: 50, ...locationParams },
        token || undefined
      );
      if (response.posts && Array.isArray(response.posts)) {
        setFeedPosts(response.posts.map(convertApiPostToPost));
      }
    } catch (err) {
      console.error("[DiscoverScreen] Failed to fetch Pro feed:", err);
    } finally {
      setFeedLoading(false);
    }
  }, [getToken, getLocationParams, convertApiPostToPost]);

  // Fetch Pro feed on mount
  useEffect(() => {
    fetchProFeed();
  }, [fetchProFeed]);

  // Feed refresh events (Pro only — Pulse is handled inside PulseFeedScreenV2)
  useEffect(() => {
    const unsub = feedEvents.subscribe((feedType) => {
      if (feedType === "pro") fetchProFeed();
    });
    return unsub;
  }, [fetchProFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProFeed();
    setRefreshing(false);
  }, [fetchProFeed]);

  // ─── Pro feed sorting ─────────────────────────────────────────────────────
  const proFeedPosts = useMemo(() => {
    return [...feedPosts].sort((a, b) => {
      const order: Record<string, number> = { photographer: 1, vendor: 2, user: 3 };
      const aR = order[a.type] || 3;
      const bR = order[b.type] || 3;
      if (aR !== bR) return aR - bR;
      const aDiff = (b.rating || 0) - (a.rating || 0);
      if (aDiff !== 0) return aDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [feedPosts]);

  // ─── Pro scroll state ─────────────────────────────────────────────────────
  const proScrollOffset = useRef(0);
  const proListRef = useRef<FlatList>(null);
  const [visibleProIndices, setVisibleProIndices] = useState<Set<number>>(new Set([0, 1]));

  // Shared mute state — one toggle for the entire Pro feed, default UNMUTED
  const [proMuted, setProMuted] = useState(false);

  const onProViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const s = new Set<number>();
      viewableItems.forEach((i) => { if (i.index !== null) s.add(i.index); });
      setVisibleProIndices(s);
    }
  ).current;

  const handleProScroll = useCallback((event: any) => {
    proScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  // Restore Pro scroll position when switching back to Pro
  useEffect(() => {
    if (feedMode === "pro" && proListRef.current) {
      setTimeout(() => {
        proListRef.current?.scrollToOffset({ offset: proScrollOffset.current, animated: false });
      }, 50);
    }
  }, [feedMode]);

  // ─── Navigation handlers ──────────────────────────────────────────────────
  const handleAuthorPress = (post: Post) => {
    const vendorId = post.providerId || post.userId;
    if (!vendorId) {
      console.warn('[AuthorTap] no id available for post', post.id);
      return;
    }
    console.log('[AuthorTap] → VendorDetail vendorId:', vendorId);
    navigation.navigate("VendorDetail", { vendorId });
  };

  const handleActionPress = (post: Post) => {
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
  };

  const handleLike = useCallback(
    async (postId: string) => {
      const currentPost = feedPosts.find((p) => p.id === postId);
      const wasLiked = currentPost?.isLiked ?? false;

      console.log('[ProLike] postId:', postId, 'wasLiked:', wasLiked);

      // Optimistic update against feedPosts
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !wasLiked, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
            : p
        )
      );

      try {
        const token = await getToken();
        if (!token) {
          setFeedPosts((prev) =>
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
          await api.unlikePost(token, postId);
        } else {
          await api.likePost(token, postId);
        }
      } catch {
        // Roll back on network/server error
        setFeedPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, isLiked: wasLiked, likes: wasLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
              : p
          )
        );
      }
    },
    [feedPosts, getToken]
  );

  const handleSavePost = (post: Post) => {
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
  };

  const handleCloseComments = () => {
    setCommentsModalVisible(false);
    setModalComments([]);
  };

  const openCommentsModal = async (post: Post) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
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
  };

  const handleSubmitComment = async () => {
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
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id
            ? { ...p, commentCount: (p.commentCount ?? 0) + 1 }
            : p
        )
      );
    } catch (err) {
      console.error("Error submitting comment:", err);
      Alert.alert("Error", "Failed to post comment. Please try again.");
    }
  };

  const handleRatePress = (post: Post) => {
    const eligibility = checkEligibility(post);
    if (!eligibility.canRate) {
      Alert.alert("Rating Not Available", eligibility.reason, [{ text: "OK" }]);
      return;
    }
    const authorType = post.type === "vendor" ? "vendor" : "photographer";
    Alert.alert(
      `Rate ${post.authorName}`,
      `How would you rate this ${authorType}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "1", onPress: () => console.log("Rated 1 star") },
        { text: "2", onPress: () => console.log("Rated 2 stars") },
        { text: "3", onPress: () => console.log("Rated 3 stars") },
        { text: "4", onPress: () => console.log("Rated 4 stars") },
        { text: "5", onPress: () => console.log("Rated 5 stars") },
      ]
    );
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const token = await getToken();
      if (!token) { Alert.alert("Error", "You must be logged in to delete posts."); return; }
      await api.deletePost(token, postId);
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
      Alert.alert("Success", "Post deleted successfully.");
    } catch (err) {
      console.error("Error deleting post:", err);
      Alert.alert("Error", "Failed to delete post. Please try again.");
    }
  };

  const handleReportPost = async (postId: string, reason: string) => {
    try {
      const token = await getToken();
      if (!token) { Alert.alert("Error", "You must be logged in to report posts."); return; }
      await api.reportPost(token, postId, reason);
      Alert.alert("Report Submitted", "Thank you for reporting. Our team will review this content.");
    } catch (err) {
      console.error("Error reporting post:", err);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  // ─── Pro feed render item ──────────────────────────────────────────────────
  const renderProFeedItem = ({ item: post, index }: { item: Post; index: number }) => {
    const isVendor = post.type === "vendor";
    const isSaved = isFavorite(post.id, isVendor ? "product" : "photographer");
    const isVisible = visibleProIndices.has(index);
    return (
      <ProFeedCard
        post={post}
        onLike={handleLike}
        onComment={openCommentsModal}
        onSave={handleSavePost}
        onRate={handleRatePress}
        onAuthorPress={handleAuthorPress}
        onActionPress={handleActionPress}
        onDelete={handleDeletePost}
        onReport={handleReportPost}
        isSaved={isSaved}
        currentUserId={user?.id}
        isAdmin={user?.isAdmin}
        isVisible={isVisible}
        muted={proMuted}
        onToggleMute={() => setProMuted((m) => !m)}
      />
    );
  };

  // Swipe gesture
  const horizontalSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationX < -50) runOnJS(swipeToToggle)("left");
      else if (event.translationX > 50) runOnJS(swipeToToggle)("right");
    });

  // ─── Loading / empty states (Pro feed) ───────────────────────────────────
  if (feedLoading && feedPosts.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Loading feed...
        </ThemedText>
      </View>
    );
  }

  if (feedPosts.length === 0 && feedMode === "pro") {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="image" size={64} color={theme.textSecondary} />
        <ThemedText type="h3" style={{ marginTop: Spacing.lg, color: theme.text }}>
          No posts yet
        </ThemedText>
        <ThemedText
          type="body"
          style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center" }}
        >
          Follow photographers and vendors to see their content here
        </ThemedText>
        <Pressable
          onPress={() => navigation.getParent()?.navigate("SearchTab")}
          style={[styles.exploreButton, { backgroundColor: theme.primary }]}
        >
          <ThemedText style={{ color: "#000000", fontWeight: "600" }}>Explore</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: feedMode === "pulse" ? "#000000" : theme.backgroundRoot }]}>
      {feedMode === "pro" ? (
        <View style={{ paddingTop: headerHeight }}>
          <FeedToggle mode={feedMode} onModeChange={handleModeChange} />
        </View>
      ) : null}

      <GestureDetector gesture={horizontalSwipe}>
        <View style={styles.feedPage}>
          {feedMode === "pro" ? (
            <FlatList
              key="pro-feed-list"
              ref={proListRef}
              data={proFeedPosts}
              renderItem={renderProFeedItem}
              keyExtractor={(item) => `pro-${item.id}`}
              showsVerticalScrollIndicator={false}
              onScroll={handleProScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.primary}
                />
              }
              contentContainerStyle={styles.proFeedContent}
              onViewableItemsChanged={onProViewableItemsChanged}
              viewabilityConfig={PRO_VIEWABILITY_CONFIG}
            />
          ) : (
            <PulseFeedScreenV2 />
          )}
        </View>
      </GestureDetector>

      {feedMode === "pulse" ? (
        <View style={[styles.pulseToggleOverlay, { top: headerHeight }]} pointerEvents="box-none">
          <FeedToggle mode={feedMode} onModeChange={handleModeChange} />
        </View>
      ) : null}

      {/* Comments modal — Pro feed */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseComments}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleCloseComments}
          />
          <View style={[styles.commentsModal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
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
                keyExtractor={(item, i) => item.id ?? String(i)}
                style={styles.commentsList}
                contentContainerStyle={styles.commentListContent}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>
                      No comments yet. Be the first!
                    </ThemedText>
                  </View>
                }
                renderItem={({ item: comment }) => {
                  const author = comment.author || {};
                  const displayName =
                    comment.user?.name ||
                    comment.user?.username ||
                    (comment.user?.firstName
                      ? (comment.user.firstName + (comment.user.lastName ? ' ' + comment.user.lastName : '')).trim()
                      : undefined) ||
                    comment.userName || comment.username || author.displayName || author.username || author.name || "User";
                  const avatarUri =
                    comment.userAvatar || author.profilePhotoUrl || author.profileImageUrl || comment.user?.profileImageUrl || "";
                  const body = comment.text || comment.content || "";
                  const timestamp = formatRelativeTime(comment.createdAt || "");
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
                      <View style={styles.commentContent}>
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
              <View style={[styles.commentInputRow, { borderTopColor: theme.border }]}>
                <TextInput
                  style={[
                    styles.commentInput,
                    { backgroundColor: theme.backgroundSecondary, color: theme.text },
                  ]}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  onSubmitEditing={handleSubmitComment}
                />
                <Pressable
                  onPress={handleSubmitComment}
                  style={[styles.sendButton, { backgroundColor: theme.primary }]}
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
  container: {
    flex: 1,
  },
  feedPage: {
    flex: 1,
  },
  pulseToggleOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
  },
  proFeedContent: {
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  exploreButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 9999,
  },

  // Comments modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  commentsModal: {
    height: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#999",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  listArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  commentsList: {
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
  commentContent: {
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
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: 9999,
    marginRight: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

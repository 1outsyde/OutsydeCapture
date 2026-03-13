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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PRO_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { likePost, addComment, getPhotographer } = useData();
  const { checkEligibility } = useRatingEligibility();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user, getToken } = useAuth();

  const [feedMode, setFeedMode] = useState<FeedMode>("pro");
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Comments modal (Pro feed)
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");

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
      apiPost.userId || (apiPost.author as any)?.userId || apiPost.author?.id || apiPost.id;
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
  }, []);

  // ─── Pro feed fetch ───────────────────────────────────────────────────────
  const fetchProFeed = useCallback(async () => {
    try {
      setFeedLoading(true);
      const token = await getToken();
      const response = await api.getFeed(
        {
          limit: 50,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
        },
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
  }, [getToken, userLocation, convertApiPostToPost]);

  // Location
  useEffect(() => {
    const req = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {}
    };
    req();
  }, []);

  // Fetch Pro feed when location available
  useEffect(() => {
    fetchProFeed();
  }, [userLocation]);

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
    const userType =
      post.type === "photographer" ? "photographer" : post.type === "vendor" ? "business" : "consumer";
    navigation.navigate("Profile", {
      userId: post.userId,
      profileId: post.providerId,
      userType,
      displayName: post.displayName || post.authorName,
      avatar: post.authorAvatar,
    });
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

  const handleLike = (postId: string) => likePost(postId);

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

  const openCommentsModal = (post: Post) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
  };

  const handleSubmitComment = async () => {
    if (selectedPost && commentText.trim()) {
      try {
        await addComment(selectedPost.id, commentText);
        setCommentText("");
      } catch (err) {
        console.error("Error submitting comment:", err);
      }
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
      <FeedToggle mode={feedMode} onModeChange={handleModeChange} />

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

      {/* Comments modal — Pro feed */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setCommentsModalVisible(false)}
          />
          <View style={[styles.commentsModal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Comments</ThemedText>
              <Pressable onPress={() => setCommentsModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <FlatList
              data={selectedPost?.comments || []}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    No comments yet. Be the first!
                  </ThemedText>
                </View>
              }
              renderItem={({ item: comment }) => (
                <View style={styles.commentRow}>
                  <Image
                    source={{ uri: comment.userAvatar }}
                    style={styles.commentAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.commentContent}>
                    <ThemedText type="body">
                      <ThemedText style={{ fontWeight: "600" }}>{comment.userName} </ThemedText>
                      {comment.text}
                    </ThemedText>
                  </View>
                </View>
              )}
            />

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
          </View>
        </KeyboardAvoidingView>
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.7,
    paddingBottom: Spacing.xl,
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
  commentsList: {
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
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: Spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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

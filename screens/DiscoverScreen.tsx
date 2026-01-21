import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, SubscriptionTiers } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useData, Post, PostType } from "@/context/DataContext";
import { useRatingEligibility } from "@/hooks/useRatingEligibility";
import { useFavorites } from "@/context/FavoritesContext";
import { useHealthCheck } from "@/context/HealthCheckContext";
import { useAuth } from "@/context/AuthContext";
import api, { ApiPost } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { photographers, businesses, likePost, addComment, getPhotographer } = useData();
  const { checkEligibility } = useRatingEligibility();
  const { isFavorite, toggleFavorite, favorites } = useFavorites();
  const { isLoading: healthLoading, data: healthData, error: healthError, refetch: refetchHealth } = useHealthCheck();
  const { user, getToken } = useAuth();
  
  const isAdmin = user?.email?.toLowerCase() === "info@goutsyde.com" || user?.email?.toLowerCase() === "jamesmeyers2304@gmail.com";

  // Algorithmic feed state - fetched from backend
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Convert API posts to local Post format
  const convertApiPostToPost = useCallback((apiPost: ApiPost): Post => {
    const displayName = apiPost.author?.name || apiPost.user?.name || "Unknown";
    const authorAvatar = apiPost.author?.profileImageUrl || apiPost.user?.profileImageUrl || "";
    const userId = apiPost.userId || apiPost.author?.id || apiPost.user?.id || apiPost.id;
    const username = apiPost.author?.username || apiPost.user?.username;
    
    // Determine post type
    let postType: PostType = "user";
    if (apiPost.authorType === "photographer") {
      postType = "photographer";
    } else if (apiPost.authorType === "vendor" || apiPost.authorType === "business") {
      postType = "vendor";
    }
    
    // Determine provider ID for commerce context
    const providerId = apiPost.providerId || 
      apiPost.author?.photographerId || 
      apiPost.author?.businessId ||
      apiPost.taggedPhotographerId ||
      apiPost.taggedBusinessId;
    
    return {
      id: apiPost.id,
      type: postType,
      // Canonical identity (userId is source of truth)
      userId: userId,
      username: username,
      displayName: displayName,
      authorAvatar: authorAvatar,
      // Legacy fields for backwards compatibility
      authorId: userId,
      authorName: displayName,
      subscriptionTier: undefined,
      rating: 0,
      reviewCount: 0,
      image: apiPost.imageUrl || (apiPost.images && apiPost.images[0]) || "",
      caption: apiPost.content || "",
      likes: apiPost.likesCount || 0,
      isLiked: false,
      comments: [],
      createdAt: apiPost.createdAt,
      // Optional commerce context
      serviceId: apiPost.serviceId,
      productId: apiPost.productId,
      providerId: providerId,
      // Backwards compatibility
      photographerId: apiPost.authorType === "photographer" ? userId : undefined,
      photographerName: apiPost.authorType === "photographer" ? displayName : undefined,
    };
  }, []);

  // Fetch algorithmic feed from backend
  const fetchAlgorithmicFeed = useCallback(async () => {
    try {
      setFeedLoading(true);
      const token = await getToken();
      
      const response = await api.getFeed({
        limit: 50,
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
      }, token || undefined);
      
      if (response.posts && Array.isArray(response.posts)) {
        const convertedPosts = response.posts.map(convertApiPostToPost);
        setFeedPosts(convertedPosts);
      }
    } catch (error) {
      console.error("[DiscoverScreen] Failed to fetch algorithmic feed:", error);
    } finally {
      setFeedLoading(false);
    }
  }, [getToken, userLocation, convertApiPostToPost]);

  // Get user location for location-based ranking (optional)
  useEffect(() => {
    const requestLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        // Location not available - feed will still work without it
        console.log("[DiscoverScreen] Location not available");
      }
    };
    requestLocation();
  }, []);

  // Fetch feed when location is available or on mount
  useEffect(() => {
    fetchAlgorithmicFeed();
  }, [userLocation]);

  // Use algorithmic feed posts
  const personalizedPosts = feedPosts;
  const isLoading = feedLoading;

  const [refreshing, setRefreshing] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlgorithmicFeed();
    setRefreshing(false);
  }, [fetchAlgorithmicFeed]);

  const handleAuthorPress = (post: Post) => {
    // Navigate to public profile based on userId (source of truth for identity)
    // Future: use username for /profile/:username routes when available
    if (post.type === "photographer") {
      const photographerId = post.photographerId || post.providerId;
      if (photographerId) {
        const photographer = getPhotographer(photographerId);
        if (photographer) {
          navigation.navigate("PhotographerDetail", { photographer });
        } else {
          // Fallback to vendor detail if no photographer found
          navigation.navigate("VendorDetail", { vendorId: post.userId });
        }
      }
    } else if (post.type === "vendor") {
      navigation.navigate("VendorDetail", { vendorId: post.userId });
    } else {
      // Regular user posts - navigate to a user profile (future implementation)
      // For now, we can show an alert or do nothing
      console.log("User profile navigation for userId:", post.userId);
    }
  };

  const handleActionPress = (post: Post) => {
    // Direct navigation to booking/purchase - skip profile pages
    if (post.type === "photographer") {
      // Navigate directly to BookingScreen for photographers
      const photographerId = post.photographerId || post.providerId;
      if (photographerId) {
        const photographer = getPhotographer(photographerId);
        if (photographer) {
          navigation.navigate("Booking", { 
            photographer,
            preselectedServiceId: post.serviceId 
          });
        } else {
          // Fallback to profile if photographer not found locally
          navigation.navigate("VendorDetail", { vendorId: post.userId });
        }
      }
    } else if (post.type === "vendor") {
      // Navigate directly to VendorDetail products tab for vendors with products
      navigation.navigate("VendorDetail", { 
        vendorId: post.providerId || post.userId,
        initialTab: post.productId ? "products" : undefined,
        productId: post.productId
      });
    }
  };

  const handleLike = (postId: string) => {
    likePost(postId);
  };

  const handleSavePost = (post: Post) => {
    const favoriteType = post.type === "vendor" ? "product" : "photographer";
    toggleFavorite({
      id: post.id,
      type: favoriteType,
      name: post.type === "vendor" && post.productName ? post.productName : post.authorName,
      image: post.image,
      subtitle: post.type === "vendor" ? `$${post.productPrice?.toFixed(2)}` : post.caption?.substring(0, 50),
    });
  };

  const handleComment = (postId: string) => {
    const text = commentText[postId];
    if (text?.trim()) {
      addComment(postId, text);
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => (prev === postId ? null : postId));
  };

  const handleRatePress = (post: Post) => {
    const eligibility = checkEligibility(post);
    
    if (!eligibility.canRate) {
      Alert.alert(
        "Rating Not Available",
        eligibility.reason,
        [{ text: "OK", style: "default" }]
      );
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  if (isLoading && feedPosts.length === 0) {
    return (
      <ScreenScrollView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Loading feed...
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  const renderPost = (post: Post) => {
    const tierConfig = post.subscriptionTier
      ? SubscriptionTiers[post.subscriptionTier as keyof typeof SubscriptionTiers]
      : null;
    const isVendor = post.type === "vendor";

    return (
      <View key={post.id} style={[styles.postCard, { backgroundColor: theme.card }]}>
        {/* Post Header */}
        <Pressable
          onPress={() => handleAuthorPress(post)}
          style={styles.postHeader}
        >
          <Image source={{ uri: post.authorAvatar }} style={styles.avatar} contentFit="cover" />
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <ThemedText type="h4">{post.authorName}</ThemedText>
              {tierConfig ? (
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Feather name={isVendor ? "shopping-bag" : "award"} size={10} color="#000000" />
                  <ThemedText type="small" style={styles.tierBadgeText}>
                    {tierConfig.label}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.subtitleRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {isVendor ? "Vendor" : "Photographer"}
              </ThemedText>
              <View style={styles.ratingBadge}>
                <Feather name="star" size={12} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, marginLeft: 2 }}>
                  {post.rating.toFixed(1)}
                </ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatTimeAgo(post.createdAt)}
              </ThemedText>
            </View>
          </View>
        </Pressable>

        {/* Post Image */}
        <Image source={{ uri: post.image }} style={styles.postImage} contentFit="cover" />

        {/* Product Info (for vendors) */}
        {isVendor && post.productName ? (
          <View style={[styles.productInfo, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.productDetails}>
              <ThemedText type="h4">{post.productName}</ThemedText>
              <ThemedText type="h3" style={{ color: theme.primary }}>
                ${post.productPrice?.toFixed(2)}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <Pressable
            onPress={() => handleLike(post.id)}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather
              name="heart"
              size={24}
              color={post.isLiked ? "#FF3B30" : theme.text}
            />
            <ThemedText type="body" style={styles.actionText}>
              {post.likes}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => toggleComments(post.id)}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="message-circle" size={24} color={theme.text} />
            <ThemedText type="body" style={styles.actionText}>
              {post.comments.length}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => handleRatePress(post)}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="star" size={24} color={theme.text} />
            <ThemedText type="body" style={styles.actionText}>
              {post.rating.toFixed(1)}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => handleSavePost(post)}
            style={({ pressed }) => [styles.actionButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather
              name="bookmark"
              size={24}
              color={isFavorite(post.id, post.type === "vendor" ? "product" : "photographer") ? theme.primary : theme.text}
            />
          </Pressable>

          <Pressable
            onPress={() => handleActionPress(post)}
            style={({ pressed }) => [styles.actionButton, styles.bookButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name={isVendor ? "shopping-bag" : "calendar"} size={16} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}>
              {isVendor ? "Buy Now" : "Book"}
            </ThemedText>
          </Pressable>
        </View>

        {/* Caption */}
        <View style={styles.captionContainer}>
          <ThemedText type="body">
            <ThemedText type="h4">{post.authorName} </ThemedText>
            {post.caption}
          </ThemedText>
        </View>

        {/* Comments Section */}
        {expandedComments === post.id ? (
          <View style={styles.commentsSection}>
            {post.comments.length > 0 ? (
              post.comments.map((comment) => (
                <View key={comment.id} style={styles.commentRow}>
                  <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatar} contentFit="cover" />
                  <View style={styles.commentContent}>
                    <ThemedText type="body">
                      <ThemedText type="h4">{comment.userName} </ThemedText>
                      {comment.text}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {formatTimeAgo(comment.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.md }}>
                No comments yet. Be the first!
              </ThemedText>
            )}

            {/* Add Comment Input */}
            <View style={[styles.commentInputRow, { borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={theme.textSecondary}
                value={commentText[post.id] || ""}
                onChangeText={(text) => setCommentText((prev) => ({ ...prev, [post.id]: text }))}
                onSubmitEditing={() => handleComment(post.id)}
              />
              <Pressable
                onPress={() => handleComment(post.id)}
                style={({ pressed }) => [styles.sendButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="send" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : post.comments.length > 0 ? (
          <Pressable onPress={() => toggleComments(post.id)} style={styles.viewCommentsButton}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              View all {post.comments.length} comments
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Backend Health Check Banner - Admin Only */}
        {isAdmin ? (
          <View style={[styles.healthBanner, { 
            backgroundColor: healthLoading 
              ? theme.backgroundSecondary 
              : healthError 
                ? "#FFE5E5" 
                : "#E8F5E9" 
          }]}>
            {healthLoading ? (
              <View style={styles.healthRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                  Connecting to backend...
                </ThemedText>
              </View>
            ) : healthError ? (
              <View style={styles.healthContent}>
                <View style={styles.healthRow}>
                  <Feather name="alert-circle" size={16} color="#D32F2F" />
                  <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: "#D32F2F", fontWeight: "600" }}>
                    Backend Connection Failed
                  </ThemedText>
                </View>
                <ThemedText type="small" style={{ color: "#D32F2F", marginTop: 4 }}>
                  {healthError}
                </ThemedText>
                <Pressable onPress={refetchHealth} style={styles.retryButton}>
                  <ThemedText type="small" style={{ color: "#D32F2F", fontWeight: "600" }}>
                    Tap to retry
                  </ThemedText>
                </Pressable>
              </View>
            ) : healthData ? (
              <View style={styles.healthContent}>
                <View style={styles.healthRow}>
                  <Feather name="check-circle" size={16} color="#2E7D32" />
                  <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: "#2E7D32", fontWeight: "600" }}>
                    Backend Connected
                  </ThemedText>
                </View>
                <View style={styles.healthDetails}>
                  <View style={styles.healthItem}>
                    <ThemedText type="small" style={{ color: "#666" }}>Status:</ThemedText>
                    <ThemedText type="small" style={{ color: "#2E7D32", fontWeight: "500", marginLeft: 4 }}>
                      {healthData.status}
                    </ThemedText>
                  </View>
                  <View style={styles.healthItem}>
                    <ThemedText type="small" style={{ color: "#666" }}>Service:</ThemedText>
                    <ThemedText type="small" style={{ color: "#2E7D32", fontWeight: "500", marginLeft: 4 }}>
                      {healthData.service}
                    </ThemedText>
                  </View>
                  <View style={styles.healthItem}>
                    <ThemedText type="small" style={{ color: "#666" }}>Environment:</ThemedText>
                    <ThemedText type="small" style={{ color: "#2E7D32", fontWeight: "500", marginLeft: 4 }}>
                      {healthData.environment}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {personalizedPosts.map(renderPost)}

        {/* Browse Photographers CTA */}
        <View style={[styles.browseCTA, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
            Looking to book?
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Browse our talented photographers and vendors
          </ThemedText>
          <Pressable
            onPress={() => navigation.getParent()?.navigate("SearchTab")}
            style={({ pressed }) => [
              styles.browseButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="search" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
              Browse All
            </ThemedText>
          </Pressable>
        </View>
      </ScreenScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  healthBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  healthContent: {
    flex: 1,
  },
  healthDetails: {
    marginTop: Spacing.sm,
    gap: 4,
  },
  healthItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  retryButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  postCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xxs,
  },
  tierBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "600",
  },
  postImage: {
    width: "100%",
    aspectRatio: 1,
  },
  productInfo: {
    padding: Spacing.md,
    marginHorizontal: 0,
  },
  productDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionText: {
    marginLeft: Spacing.xs,
  },
  bookButton: {
    marginLeft: "auto",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  captionContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  commentsSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  commentRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: Spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  viewCommentsButton: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  browseCTA: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});

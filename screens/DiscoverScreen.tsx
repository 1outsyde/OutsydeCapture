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
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Separate component for video playback (allows hook usage)
function PostVideoMedia({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// Image aspect ratio types for smart rendering
type ImageAspectType = "portrait" | "landscape" | "square";

// Component for image posts with aspect-aware rendering
function PostImageMedia({ 
  imageUrl, 
  onAspectDetected 
}: { 
  imageUrl: string; 
  onAspectDetected?: (aspect: ImageAspectType) => void;
}) {
  const [aspectType, setAspectType] = useState<ImageAspectType>("portrait");
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = useCallback((event: any) => {
    const { width, height } = event.source || {};
    if (width && height) {
      const ratio = width / height;
      let newAspect: ImageAspectType;
      if (ratio > 1.2) {
        newAspect = "landscape";
      } else if (ratio < 0.8) {
        newAspect = "portrait";
      } else {
        newAspect = "square";
      }
      setAspectType(newAspect);
      onAspectDetected?.(newAspect);
    }
    setImageLoaded(true);
  }, [onAspectDetected]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Blurred background for landscape/square images - fills empty space */}
      {(aspectType === "landscape" || aspectType === "square") && (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={30}
        />
      )}
      {/* Dark overlay on blurred background */}
      {(aspectType === "landscape" || aspectType === "square") && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]} />
      )}
      {/* Main image - always contain mode for images, never crop */}
      <Image
        source={{ uri: imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        onLoad={handleImageLoad}
        transition={200}
      />
    </View>
  );
}

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
  
  // Comments modal state
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");

  // Handle feed mode change from toggle or swipe
  const handleModeChange = useCallback((mode: FeedMode) => {
    setFeedMode(mode);
  }, []);

  // Swipe gesture to toggle between feeds
  const swipeToToggle = useCallback((direction: "left" | "right") => {
    if (direction === "left" && feedMode === "pro") {
      setFeedMode("pulse");
    } else if (direction === "right" && feedMode === "pulse") {
      setFeedMode("pro");
    }
  }, [feedMode]);

  // Convert API posts to local Post format
  const convertApiPostToPost = useCallback((apiPost: ApiPost): Post => {
    const displayName = 
      (apiPost.author as any)?.displayName ||
      apiPost.author?.name ||
      "Unknown";
    
    const authorAvatar = 
      (apiPost.author as any)?.profilePhotoUrl ||
      apiPost.author?.profileImageUrl || 
      "";
    
    const userId = apiPost.userId || (apiPost.author as any)?.userId || apiPost.author?.id || apiPost.id;
    const username = apiPost.author?.username;
    
    const authorRole = (apiPost.author as any)?.role;
    let postType: PostType = "user";
    if (apiPost.authorType === "photographer" || authorRole === "photographer") {
      postType = "photographer";
    } else if (apiPost.authorType === "vendor" || apiPost.authorType === "business" || authorRole === "vendor" || authorRole === "business") {
      postType = "vendor";
    }
    
    const providerId = apiPost.providerId || 
      apiPost.author?.photographerId || 
      apiPost.author?.businessId ||
      apiPost.taggedPhotographerId ||
      apiPost.taggedBusinessId;
    
    return {
      id: apiPost.id,
      type: postType,
      userId: userId,
      username: username,
      displayName: displayName,
      authorAvatar: authorAvatar,
      authorId: userId,
      authorName: displayName,
      subscriptionTier: undefined,
      rating: (apiPost.author as any)?.rating || 0,
      reviewCount: (apiPost.author as any)?.reviewCount || 0,
      image: apiPost.imageUrl || (apiPost.images && apiPost.images[0]) || "",
      videoUrl: apiPost.videoUrl,
      caption: apiPost.content || "",
      likes: apiPost.likesCount || 0,
      isLiked: false,
      comments: [],
      createdAt: apiPost.createdAt,
      serviceId: apiPost.photographerServiceId || apiPost.serviceId,
      productId: apiPost.productId,
      providerId: providerId,
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

  // Get user location for location-based ranking
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
        console.log("[DiscoverScreen] Location not available");
      }
    };
    requestLocation();
  }, []);

  // Fetch feed when location is available or on mount
  useEffect(() => {
    fetchAlgorithmicFeed();
  }, [userLocation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlgorithmicFeed();
    setRefreshing(false);
  }, [fetchAlgorithmicFeed]);

  // Feed-specific sorting
  const proFeedPosts = useMemo(() => {
    return [...feedPosts].sort((a, b) => {
      const roleOrder: Record<string, number> = { 
        photographer: 1, 
        vendor: 2, 
        user: 3 
      };
      const aRole = roleOrder[a.type] || 3;
      const bRole = roleOrder[b.type] || 3;
      if (aRole !== bRole) return aRole - bRole;
      
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      if (bRating !== aRating) return bRating - aRating;
      
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
  }, [feedPosts]);

  const pulseFeedPosts = useMemo(() => {
    return [...feedPosts].sort((a, b) => {
      const aHasVerticalVideo = a.videoUrl ? 1 : 0;
      const bHasVerticalVideo = b.videoUrl ? 1 : 0;
      if (bHasVerticalVideo !== aHasVerticalVideo) return bHasVerticalVideo - aHasVerticalVideo;
      
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      if (bDate !== aDate) return bDate - aDate;
      
      const aEngagement = (a.likes || 0) + (a.comments?.length || 0);
      const bEngagement = (b.likes || 0) + (b.comments?.length || 0);
      return bEngagement - aEngagement;
    });
  }, [feedPosts]);

  // Scroll position refs for each feed
  const proScrollOffset = useRef(0);
  const pulseScrollOffset = useRef(0);
  const proListRef = useRef<FlatList>(null);
  const pulseListRef = useRef<FlatList>(null);

  // Save scroll position when switching feeds
  const handleProScroll = useCallback((event: any) => {
    proScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const handlePulseScroll = useCallback((event: any) => {
    pulseScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  // Restore scroll position when switching back
  useEffect(() => {
    if (feedMode === "pro" && proListRef.current) {
      setTimeout(() => {
        proListRef.current?.scrollToOffset({ offset: proScrollOffset.current, animated: false });
      }, 50);
    } else if (feedMode === "pulse" && pulseListRef.current) {
      setTimeout(() => {
        pulseListRef.current?.scrollToOffset({ offset: pulseScrollOffset.current, animated: false });
      }, 50);
    }
  }, [feedMode]);

  // Navigation handlers
  const handleAuthorPress = (post: Post) => {
    const userType = post.type === "photographer" ? "photographer" 
                   : post.type === "vendor" ? "business" 
                   : "consumer";
    
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
        photographerId: photographerId,
        preselectedServiceId: post.serviceId 
      });
    } else if (post.productId) {
      const businessId = post.providerId || post.userId;
      navigation.navigate("VendorDetail", { 
        vendorId: businessId,
        initialTab: "products",
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

  const openCommentsModal = (post: Post) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
  };

  const handleSubmitComment = async () => {
    if (selectedPost && commentText.trim()) {
      try {
        await addComment(selectedPost.id, commentText);
        setCommentText("");
      } catch (error) {
        console.error("Error submitting comment:", error);
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
      if (!token) {
        Alert.alert("Error", "You must be logged in to delete posts.");
        return;
      }
      await api.deletePost(token, postId);
      setFeedPosts((prev: Post[]) => prev.filter((p: Post) => p.id !== postId));
      Alert.alert("Success", "Post deleted successfully.");
    } catch (error) {
      console.error("Error deleting post:", error);
      Alert.alert("Error", "Failed to delete post. Please try again.");
    }
  };

  const handleReportPost = async (postId: string, reason: string) => {
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Error", "You must be logged in to report posts.");
        return;
      }
      await api.reportPost(token, postId, reason);
      Alert.alert("Report Submitted", "Thank you for reporting. Our team will review this content.");
    } catch (error) {
      console.error("Error reporting post:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  // Calculate post height (full screen minus tab bar)
  const TAB_BAR_HEIGHT = 80;
  const POST_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

  // Full-screen post component
  const renderFullScreenPost = ({ item: post, index }: { item: Post; index: number }) => {
    const isVendor = post.type === "vendor";
    const isSaved = isFavorite(post.id, isVendor ? "product" : "photographer");
    const hasCommerce = post.serviceId || post.productId;

    const hasVideo = !!post.videoUrl;

    return (
      <View style={[styles.postContainer, { height: POST_HEIGHT, backgroundColor: "#000000" }]}>
        {/* Full-screen media background - Video or Image */}
        {/* Videos: cover mode (full-screen native feel) */}
        {/* Images: contain mode with aspect-aware background (never crop) */}
        {hasVideo ? (
          <PostVideoMedia videoUrl={post.videoUrl!} />
        ) : (
          <PostImageMedia imageUrl={post.image} />
        )}

        {/* Bottom gradient for text legibility */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
          style={styles.bottomGradient}
        />

        {/* Right-side vertical action bar */}
        <View style={[styles.actionBar, { bottom: insets.bottom + 100 }]}>
          {/* Like */}
          <Pressable
            onPress={() => handleLike(post.id)}
            style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.actionIconContainer}>
              <Feather
                name="heart"
                size={28}
                color={post.isLiked ? "#FF3B30" : "#FFFFFF"}
              />
            </View>
            <ThemedText style={styles.actionCount}>{post.likes}</ThemedText>
          </Pressable>

          {/* Comment */}
          <Pressable
            onPress={() => openCommentsModal(post)}
            style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.actionIconContainer}>
              <Feather name="message-circle" size={28} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.actionCount}>{post.comments.length}</ThemedText>
          </Pressable>

          {/* Rating */}
          <Pressable
            onPress={() => handleRatePress(post)}
            style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.actionIconContainer}>
              <Feather name="star" size={28} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.actionCount}>{post.rating.toFixed(1)}</ThemedText>
          </Pressable>

          {/* Save/Bookmark */}
          <Pressable
            onPress={() => handleSavePost(post)}
            style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.actionIconContainer}>
              <Feather
                name="bookmark"
                size={28}
                color={isSaved ? theme.primary : "#FFFFFF"}
              />
            </View>
          </Pressable>
        </View>

        {/* Bottom-left author info and caption */}
        <View style={[styles.authorSection, { bottom: insets.bottom + 20 }]}>
          {/* Author row */}
          <Pressable
            onPress={() => handleAuthorPress(post)}
            style={styles.authorRow}
          >
            {post.authorAvatar && post.authorAvatar.startsWith("http") ? (
              <Image
                source={{ uri: post.authorAvatar }}
                style={styles.authorAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.authorAvatar, styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.avatarInitial}>
                  {(post.displayName || post.authorName || "?").charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.authorInfo}>
              <ThemedText style={styles.displayName}>
                {post.displayName || post.authorName}
              </ThemedText>
              {post.username ? (
                <ThemedText style={styles.username}>@{post.username}</ThemedText>
              ) : null}
            </View>
          </Pressable>

          {/* Caption */}
          {post.caption ? (
            <ThemedText style={styles.caption} numberOfLines={3}>
              {post.caption}
            </ThemedText>
          ) : null}

          {/* Commerce CTA */}
          {hasCommerce ? (
            <Pressable
              onPress={() => handleActionPress(post)}
              style={({ pressed }) => [
                styles.commerceCTA,
                { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Feather
                name={post.productId ? "shopping-bag" : "calendar"}
                size={18}
                color="#000000"
              />
              <ThemedText style={styles.commerceCTAText}>
                {post.productId ? "Buy Now" : "Book Now"}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  // Loading state
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

  // Empty state
  if (feedPosts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="image" size={64} color={theme.textSecondary} />
        <ThemedText type="h3" style={{ marginTop: Spacing.lg, color: theme.text }}>
          No posts yet
        </ThemedText>
        <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center" }}>
          Follow photographers and vendors to see their content here
        </ThemedText>
        <Pressable
          onPress={() => navigation.getParent()?.navigate("SearchTab")}
          style={[styles.exploreButton, { backgroundColor: theme.primary }]}
        >
          <ThemedText style={{ color: "#000000", fontWeight: "600" }}>
            Explore
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  // Render Pro feed item (card-based)
  const renderProFeedItem = ({ item: post }: { item: Post }) => {
    const isVendor = post.type === "vendor";
    const isSaved = isFavorite(post.id, isVendor ? "product" : "photographer");

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
      />
    );
  };

  // Create horizontal swipe gesture for feed toggle
  const horizontalSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationX < -50) {
        runOnJS(swipeToToggle)("left");
      } else if (event.translationX > 50) {
        runOnJS(swipeToToggle)("right");
      }
    });

  return (
    <View style={[styles.container, { backgroundColor: feedMode === "pulse" ? "#000000" : theme.backgroundRoot }]}>
      <FeedToggle mode={feedMode} onModeChange={handleModeChange} />
      
      <GestureDetector gesture={horizontalSwipe}>
        <View style={styles.feedPage}>
          {feedMode === "pro" ? (
            <FlatList
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
            />
          ) : (
            <FlatList
              ref={pulseListRef}
              data={pulseFeedPosts}
              renderItem={renderFullScreenPost}
              keyExtractor={(item) => `pulse-${item.id}`}
              pagingEnabled
              snapToInterval={POST_HEIGHT}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              onScroll={handlePulseScroll}
              scrollEventThrottle={16}
              onRefresh={onRefresh}
              refreshing={refreshing}
              getItemLayout={(data, index) => ({
                length: POST_HEIGHT,
                offset: POST_HEIGHT * index,
                index,
              })}
            />
          )}
        </View>
      </GestureDetector>

      {/* Comments Modal */}
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

            {/* Comments list */}
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

            {/* Comment input */}
            <View style={[styles.commentInputRow, { borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
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
    borderRadius: BorderRadius.full,
  },
  postContainer: {
    width: SCREEN_WIDTH,
    position: "relative",
  },
  fullScreenMedia: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
  },

  // Right-side action bar
  actionBar: {
    position: "absolute",
    right: Spacing.md,
    alignItems: "center",
    gap: Spacing.lg,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  // Bottom-left author section
  authorSection: {
    position: "absolute",
    left: Spacing.md,
    right: 80,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "bold",
  },
  authorInfo: {
    marginLeft: Spacing.sm,
  },
  displayName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  username: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  caption: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },

  // Commerce CTA
  commerceCTA: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  commerceCTAText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },

  // Comments Modal
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
    borderRadius: BorderRadius.full,
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

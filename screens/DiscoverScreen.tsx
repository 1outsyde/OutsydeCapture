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
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useData, Post, PostType } from "@/context/DataContext";
import { useRatingEligibility } from "@/hooks/useRatingEligibility";
import { useSavedPosts } from "@/context/SavedPostsContext";
import { useAuth } from "@/context/AuthContext";
import api, { ApiPost } from "@/services/api";
import { FeedToggle, FeedMode } from "@/components/FeedToggle";
import { nextFeedMode, FEED_MODES } from "@/utils/feedModes";
import type { DiscoverStackParamList } from "@/navigation/types";
import EventsTab from "@/screens/EventsTab";
import { EventFeedCard } from "@/components/events/EventFeedCard";
import { getEventCoords } from "@/utils/eventLocation";
import { feedEventsQuery, isFeedEventItem, mixEventsIntoFeed, type EventCard, type FeedEventItem } from "@/utils/eventsLogic";
import { ProFeedCard } from "@/components/ProFeedCard";
import { FeedSwipeGestureContext } from "@/components/PostMediaCarousel";
import { RatingBottomSheet } from "@/components/ratings";
import type { RatingCheckResponse, RatingTargetType } from "@/types/ratings";
import { feedEvents } from "@/services/feedEvents";
import PulseFeedScreenV2 from "@/screens/PulseFeedScreenV2";
import { resolvePostMedia } from "@/utils/resolvePostMedia";
import StoryRing from "@/components/StoryRing";
import StoriesBar from "@/components/StoriesBar";
import FinishSetupCard from "@/components/FinishSetupCard";

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
  const { isSaved: isPostSaved, toggleSave } = useSavedPosts();
  const { user, getToken, isAuthenticated } = useAuth();

  const [feedMode, setFeedMode] = useState<FeedMode>("pro");
  // An announcement push can open a tab here ({ mode: "events", _ts }). Without params nothing changes.
  const route = useRoute<RouteProp<DiscoverStackParamList, "Discover">>();
  const openMode = route.params?.mode;
  const openTs = route.params?._ts;
  useEffect(() => {
    if (openMode && FEED_MODES.some((m) => m.mode === openMode))
      // Follows a navigation param (a push tap), not React state, so there is no render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeedMode(openMode);
  }, [openMode, openTs]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  // Events shown as cards inside the Pro feed (never sent to /api/feed; a failure leaves the feed as it was).
  const [feedEventsList, setFeedEventsList] = useState<EventCard[]>([]);
  // Following tab: newest posts from accounts the viewer follows (GET /api/feed?scope=following).
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [followingRefreshing, setFollowingRefreshing] = useState(false);
  const [followingError, setFollowingError] = useState(false);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [followingLoadingMore, setFollowingLoadingMore] = useState(false);
  const followingNextOffset = useRef(0);
  // Ignore answers from an older Following request (quick tab switches, refresh + paging).
  const followingSeq = useRef(0);
  // getToken is a new function on every auth render; read it through a ref so the Following
  // fetch effect only runs when the tab opens, not on every auth update.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [refreshing, setRefreshing] = useState(false);

  const storiesBarHeight = useSharedValue(96);

  const storiesBarAnimatedStyle = useAnimatedStyle(() => ({
    height: storiesBarHeight.value,
    overflow: "hidden",
  }));

  const handleStoriesVisibilityChange = (visible: boolean) => {
    storiesBarHeight.value = withTiming(visible ? 96 : 0, { duration: 250 });
  };

  // Comments modal (Pro feed)
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");
  const [ratingPost, setRatingPost] = useState<Post | null>(null);
  const [ratingCheckResult, setRatingCheckResult] = useState<RatingCheckResponse | null>(null);
  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Feed toggle / swipe
  const handleModeChange = useCallback((mode: FeedMode) => setFeedMode(mode), []);

  const swipeToToggle = useCallback(
    (direction: "left" | "right") => {
      // Order on screen: EVENTS | FOLLOWING | PRO | PULSE (utils/feedModes)
      setFeedMode(nextFeedMode(feedMode, direction));
    },
    [feedMode]
  );

  // ─── Convert API post ─────────────────────────────────────────────────────
  const convertApiPostToPost = useCallback((apiPost: ApiPost): Post => {
    const displayName =
      apiPost.author?.displayName || apiPost.author?.name || "Unknown";
    const authorAvatar =
      apiPost.author?.profilePhotoUrl || apiPost.author?.profileImageUrl || "";
    const userId =
      apiPost.userId || apiPost.author?.userId || apiPost.author?.id;
    const username = apiPost.author?.username;
    const authorRole = apiPost.author?.role;

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
      mediaImages: media.images.length > 1 ? media.images : undefined,
      videoUrl: media.videoUrl ?? undefined,
      caption: apiPost.content || "",
      likes: (apiPost as any).likeCount ?? (apiPost as any).likesCount ?? 0,
      isLiked: (apiPost as any).isLiked ?? false,
      authorIsFollowed: apiPost.authorIsFollowed === true,
      comments: [],
      commentCount: (apiPost as any).commentCount ?? (apiPost as any).commentsCount ?? 0,
      createdAt: apiPost.createdAt,
      serviceId: apiPost.photographerServiceId || apiPost.serviceId,
      productId: apiPost.productId,
      providerId,
      // Resolve businessId from the richest available source:
      //   1. product.businessId or service.businessId (linked commerce item)
      //   2. providerId when the author is a vendor (backend sets this to authorBusinessId)
      //   3. taggedBusinessId (explicit tag on the post)
      //   4. author.businessId (legacy author field)
      businessId:
        apiPost.product?.businessId ||
        apiPost.service?.businessId ||
        ((apiPost.authorType === "vendor" || apiPost.authorType === "business") ? providerId : undefined) ||
        apiPost.taggedBusinessId ||
        apiPost.author?.businessId ||
        undefined,
      photographerId: apiPost.authorType === "photographer" ? (providerId || userId) : undefined,
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

  // ─── Following feed fetch ─────────────────────────────────────────────────
  const FOLLOWING_PAGE = 30;
  const fetchFollowingFeed = useCallback(async (more = false) => {
    const seq = ++followingSeq.current;
    const offset = more ? followingNextOffset.current : 0;
    try {
      if (more) setFollowingLoadingMore(true);
      else setFollowingLoading(true);
      setFollowingError(false);
      const token = await getTokenRef.current();
      if (seq !== followingSeq.current) return;
      if (!token) {
        setFollowingPosts([]);
        setFollowingHasMore(false);
        return;
      }
      const response = await api.getFeed({ limit: FOLLOWING_PAGE, scope: "following", offset }, token);
      if (seq !== followingSeq.current) return;
      const page = Array.isArray(response.posts) ? response.posts.map(convertApiPostToPost) : [];
      setFollowingPosts((prev) => {
        if (!more) return page;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.filter((p) => !seen.has(p.id))];
      });
      followingNextOffset.current = response.data?.nextOffset ?? offset + page.length;
      setFollowingHasMore(response.data?.hasMore === true);
    } catch (err) {
      if (seq !== followingSeq.current) return;
      console.error("[DiscoverScreen] Failed to fetch Following feed:", err);
      if (!more) setFollowingError(true);
    } finally {
      if (seq === followingSeq.current) {
        setFollowingLoading(false);
        setFollowingLoadingMore(false);
        setFollowingLoaded(true);
      }
    }
  }, [convertApiPostToPost]);

  const onFollowingEndReached = useCallback(() => {
    if (!followingHasMore || followingLoading || followingLoadingMore) return;
    fetchFollowingFeed(true);
  }, [followingHasMore, followingLoading, followingLoadingMore, fetchFollowingFeed]);

  // Refetch every time the Following tab opens, so follows/unfollows made elsewhere show up.
  useEffect(() => {
    if (feedMode === "following") fetchFollowingFeed();
  }, [feedMode, fetchFollowingFeed]);

  const onFollowingRefresh = useCallback(async () => {
    setFollowingRefreshing(true);
    await fetchFollowingFeed();
    setFollowingRefreshing(false);
  }, [fetchFollowingFeed]);

  // Like / comment / delete / block changes apply to both lists (a post can be in both).
  const updateAllPosts = useCallback((fn: (prev: Post[]) => Post[]) => {
    setFeedPosts(fn);
    setFollowingPosts(fn);
  }, []);

  // Feed refresh events (Pro only — Pulse is handled inside PulseFeedScreenV2)
  useEffect(() => {
    const unsub = feedEvents.subscribe((feedType) => {
      if (feedType === "pro") fetchProFeed();
    });
    return unsub;
  }, [fetchProFeed]);

  // ─── Events for the Pro feed ──────────────────────────────────────────────
  const fetchFeedEvents = useCallback(async () => {
    try {
      // Never prompts: nearest events only when location is already allowed.
      const [{ coords }, token] = await Promise.all([getEventCoords(), getTokenRef.current().catch(() => null)]);
      const res = await api.listEvents(feedEventsQuery(new Date(), coords), token);
      setFeedEventsList(res.events);
    } catch (err) {
      console.warn("[DiscoverScreen] Events for the Pro feed did not load:", err);
      setFeedEventsList([]);
    }
  }, []);

  useEffect(() => {
    fetchFeedEvents();
  }, [fetchFeedEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProFeed(), fetchFeedEvents()]);
    setRefreshing(false);
  }, [fetchProFeed, fetchFeedEvents]);

  // ─── Pro feed sorting ─────────────────────────────────────────────────────
  const proFeedPosts = useMemo(() => {
    return [...feedPosts].sort((a, b) => {
      // Your own posts first (the backend pins them), then accounts you follow, then the existing order.
      const rank = (p: Post) => (user?.id && (p.userId || p.authorId) === user.id ? 0 : p.authorIsFollowed ? 1 : 2);
      const aF = rank(a);
      const bF = rank(b);
      if (aF !== bF) return aF - bF;
      const order: Record<string, number> = { photographer: 1, vendor: 2, user: 3 };
      const aR = order[a.type] || 3;
      const bR = order[b.type] || 3;
      if (aR !== bR) return aR - bR;
      const aDiff = (b.rating || 0) - (a.rating || 0);
      if (aDiff !== 0) return aDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [feedPosts, user?.id]);

  // ─── Pro scroll state ─────────────────────────────────────────────────────
  const proScrollOffset = useRef(0);
  // What the Pro list renders: posts with at most one event card per 8 posts. Every lookup by post id
  // (likes, saves, comments) still reads feedPosts / proFeedPosts, never this list.
  const proFeedItems = useMemo(() => mixEventsIntoFeed(proFeedPosts, feedEventsList), [proFeedPosts, feedEventsList]);

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
      // Read the state from the list on screen (the two lists can differ after a refetch).
      const onScreen = feedMode === "following" ? followingPosts : feedPosts;
      const currentPost =
        onScreen.find((p) => p.id === postId) ??
        feedPosts.find((p) => p.id === postId) ??
        followingPosts.find((p) => p.id === postId);
      const wasLiked = currentPost?.isLiked ?? false;

      console.log('[ProLike] postId:', postId, 'wasLiked:', wasLiked);

      // Optimistic update against feedPosts
      updateAllPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: !wasLiked, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
            : p
        )
      );

      try {
        const token = await getToken();
        if (!token) {
          updateAllPosts((prev) =>
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
        updateAllPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, isLiked: wasLiked, likes: wasLiked ? p.likes + 1 : Math.max(0, p.likes - 1) }
              : p
          )
        );
      }
    },
    [feedMode, feedPosts, followingPosts, getToken, updateAllPosts]
  );

  const handleSavePost = (post: Post) => {
    // Saved to the account (backend), not the phone. See SavedPostsContext.
    toggleSave(post.id);
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
      updateAllPosts((prev) =>
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

  const handleRatePress = async (post: Post) => {
    if (!isAuthenticated) {
      Alert.alert("Sign in required", "Please sign in to leave a rating.");
      return;
    }
    const targetType: RatingTargetType =
      post.type === "vendor" ? "business" : "photographer";
    const targetId = post.businessId || post.providerId || post.authorId || "";
    if (!targetId) {
      Alert.alert("Rating Not Available", "Unable to identify this provider.");
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const checkResult = await api.checkRating(token, targetType, targetId);
      setRatingCheckResult(checkResult);
      setRatingPost(post);
      if (checkResult.canRate) {
        setRatingSheetVisible(true);
      } else if (checkResult.existingRating) {
        Alert.alert("Already rated", `You've already rated ${post.authorName}.`);
      } else {
        const eligibility = checkEligibility(post);
        Alert.alert("Rating Not Available", eligibility.reason || "Complete a booking to rate this provider.");
      }
    } catch {
      Alert.alert("Error", "Failed to check rating eligibility. Please try again.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const token = await getToken();
      if (!token) { Alert.alert("Error", "You must be logged in to delete posts."); return; }
      await api.deletePost(token, postId);
      updateAllPosts((prev) => prev.filter((p) => p.id !== postId));
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

  const handleBlockAuthor = async (authorId: string) => {
    try {
      const token = await getToken();
      if (!token) { Alert.alert("Error", "You must be logged in to block users."); return; }
      await api.blockUser(token, authorId);
      updateAllPosts((prev) => prev.filter((p) => (p.userId || p.authorId) !== authorId));
      Alert.alert("Blocked", "You will no longer see content from this user.");
    } catch (err) {
      console.error("Error blocking user:", err);
      Alert.alert("Error", "Failed to block user. Please try again.");
    }
  };

  // ─── Pro feed render item ──────────────────────────────────────────────────
  const renderProFeedItem = ({ item, index }: { item: Post | FeedEventItem; index: number }) => {
    if (isFeedEventItem(item)) {
      return <EventFeedCard event={item.event} onPress={() => navigation.navigate("EventDetail", { slug: item.event.slug })} />;
    }
    const post = item;
    const isSaved = isPostSaved(post.id);
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
        onBlock={handleBlockAuthor}
        isSaved={isSaved}
        currentUserId={user?.id}
        isAdmin={user?.isAdmin}
        isVisible={isVisible}
        muted={proMuted}
        onToggleMute={() => setProMuted((m) => !m)}
      />
    );
  };

  // Swipe gesture (memoized so multi-photo carousels can reference a stable gesture to block)
  const horizontalSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-10, 10])
        .onEnd((event) => {
          if (event.translationX < -50) runOnJS(swipeToToggle)("left");
          else if (event.translationX > 50) runOnJS(swipeToToggle)("right");
        }),
    [swipeToToggle]
  );

  // ─── Loading / empty states (Pro feed) ───────────────────────────────────
  if (feedLoading && feedPosts.length === 0 && feedMode === "pro") {
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
        {/* Keep the toggle so Following and Pulse stay reachable when Pro is empty. */}
        <View style={[styles.emptyToggle, { top: headerHeight }]}>
          <FeedToggle mode={feedMode} onModeChange={handleModeChange} />
        </View>
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
      {feedMode !== "pulse" ? (
        <View style={{ paddingTop: headerHeight }}>
          <FeedToggle mode={feedMode} onModeChange={handleModeChange} />
        </View>
      ) : null}

      <FeedSwipeGestureContext.Provider value={horizontalSwipe}>
      <GestureDetector gesture={horizontalSwipe}>
        <View style={styles.feedPage}>
          {feedMode === "pro" ? (
            <FlatList
              key="pro-feed-list"
              ref={proListRef}
              data={proFeedItems}
              renderItem={renderProFeedItem}
              keyExtractor={(item) => (isFeedEventItem(item) ? `event-${item.event.id}` : `pro-${item.id}`)}
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
              ListHeaderComponent={
                <>
                  <FinishSetupCard />
                  <Animated.View style={storiesBarAnimatedStyle}>
                    <StoriesBar onVisibilityChange={handleStoriesVisibilityChange} />
                  </Animated.View>
                </>
              }
            />
          ) : feedMode === "following" ? (
            <FlatList
              key="following-feed-list"
              data={followingPosts}
              renderItem={renderProFeedItem}
              keyExtractor={(item) => `following-${item.id}`}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={followingRefreshing}
                  onRefresh={onFollowingRefresh}
                  tintColor={theme.primary}
                />
              }
              contentContainerStyle={[styles.proFeedContent, followingPosts.length === 0 && { flexGrow: 1 }]}
              onViewableItemsChanged={onProViewableItemsChanged}
              viewabilityConfig={PRO_VIEWABILITY_CONFIG}
              onEndReached={onFollowingEndReached}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                followingLoadingMore ? (
                  <ActivityIndicator style={{ margin: Spacing.lg }} color={theme.primary} />
                ) : null
              }
              ListEmptyComponent={
                followingError ? (
                  <View style={styles.followingEmpty}>
                    <Feather name="alert-circle" size={48} color={theme.textSecondary} />
                    <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center" }}>
                      These posts could not be loaded.
                    </ThemedText>
                    <Pressable
                      onPress={() => fetchFollowingFeed()}
                      style={[styles.exploreButton, { backgroundColor: theme.primary }]}
                    >
                      <ThemedText style={{ color: "#000000", fontWeight: "600" }}>Try again</ThemedText>
                    </Pressable>
                  </View>
                ) : (followingLoading && !followingLoaded) ? (
                  <View style={styles.followingEmpty}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                ) : (
                  <View style={styles.followingEmpty}>
                    <Feather name="users" size={56} color={theme.textSecondary} />
                    <ThemedText type="h3" style={{ marginTop: Spacing.lg, color: theme.text, textAlign: "center" }}>
                      {isAuthenticated ? "Nothing here yet" : "See posts from people you follow"}
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center" }}
                    >
                      {isAuthenticated
                        ? "Follow businesses, photographers and friends to see their newest posts here."
                        : "Sign in and follow accounts to see their newest posts here."}
                    </ThemedText>
                    <Pressable
                      onPress={() => navigation.getParent()?.navigate("SearchTab")}
                      style={[styles.exploreButton, { backgroundColor: theme.primary }]}
                    >
                      <ThemedText style={{ color: "#000000", fontWeight: "600" }}>Find people to follow</ThemedText>
                    </Pressable>
                  </View>
                )
              }
            />
          ) : feedMode === "events" ? (
            <EventsTab />
          ) : (
            <PulseFeedScreenV2 />
          )}
        </View>
      </GestureDetector>
      </FeedSwipeGestureContext.Provider>

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
                    comment.userName || comment.username || author.displayName || author.username || author.name || "User";
                  const avatarUri =
                    comment.userAvatar || author.profilePhotoUrl || author.profileImageUrl || comment.user?.profileImageUrl || "";
                  const body = comment.text || comment.content || "";
                  const timestamp = formatRelativeTime(comment.createdAt || "");
                  return (
                    <View style={styles.commentRow}>
                      <StoryRing
                        userId={comment.userId || comment.user?.id || ""}
                        size={36}
                        isOwnProfile={(comment.userId || comment.user?.id) === user?.id}
                        onAddStory={() => {}}
                        onViewStory={(stories) =>
                          navigation.navigate("StoryViewer", {
                            userId: comment.userId || comment.user?.id || "",
                            stories,
                            authorName: displayName,
                            authorAvatarUrl: avatarUri,
                          })
                        }
                      >
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
                      </StoryRing>
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

      {ratingPost && (
        <RatingBottomSheet
          visible={ratingSheetVisible}
          onClose={() => {
            setRatingSheetVisible(false);
            setRatingPost(null);
            setRatingCheckResult(null);
          }}
          onSubmit={async (rating, purchaseId, purchaseType) => {
            const token = await getToken();
            if (!token) throw new Error("Not authenticated");
            const purchases = ratingCheckResult?.purchases ?? [];
            const purchase = purchases.find(p => p.purchaseId === purchaseId) ?? purchases[0];
            if (!purchase) return;
            await api.submitRating(token, purchase.targetType, purchase.targetId, rating, purchaseId, purchaseType);
            setRatingSheetVisible(false);
            setRatingPost(null);
            setRatingCheckResult(null);
          }}
          targetType={ratingPost.type === "vendor" ? "business" : "photographer"}
          targetId={ratingPost.businessId || ratingPost.providerId || ratingPost.authorId || ""}
          targetName={ratingPost.authorName || ""}
          purchases={ratingCheckResult?.purchases ?? []}
          existingRating={ratingCheckResult?.existingRating?.rating ?? null}
        />
      )}
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
  emptyToggle: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  followingEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["3xl"],
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
    ...StyleSheet.absoluteFill,
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
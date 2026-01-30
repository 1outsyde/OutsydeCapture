import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { ApiPost } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "ProfileFeed">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const POST_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2;

const GOLD_DOT_COLOR = "#FFD700";
const PULSE_DOT_COLOR = "#FF69B4";

export default function ProfileFeedScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();

  const { profileId, profileName, intent } = route.params;

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const dotColor = intent === "pro" ? GOLD_DOT_COLOR : PULSE_DOT_COLOR;
  const intentLabel = intent === "pro" ? "Pro" : "Pulse";

  const fetchPosts = useCallback(async (pageNum: number, refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const response = await api.getProfilePosts(profileId, {
        intent,
        page: pageNum,
        limit: 20,
      });

      const newPosts = response.posts || [];

      if (refresh || pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length >= 20);
      setPage(pageNum);
    } catch (error) {
      console.warn("[ProfileFeedScreen] Failed to fetch posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId, intent]);

  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  const handleRefresh = () => {
    fetchPosts(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchPosts(page + 1);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `0:${secs.toString().padStart(2, "0")}`;
  };

  const renderPost = ({ item }: { item: ApiPost }) => {
    const imageUri = item.imageUrl || (item.images && item.images[0]) || "";

    return (
      <Pressable style={styles.postCard}>
        <Image
          source={{ uri: imageUri }}
          style={styles.postImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.postOverlay}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="heart" size={14} color="#fff" />
            <ThemedText type="small" style={styles.likeCount}>
              {item.likesCount || 0}
            </ThemedText>
          </View>
          {intent === "pro" && (
            <View style={[styles.badge, { backgroundColor: "rgba(255,215,0,0.8)" }]}>
              <Feather name="camera" size={12} color="#fff" />
            </View>
          )}
          {intent === "pulse" && item.mediaType === "video" && item.mediaDuration && (
            <View style={styles.durationBadge}>
              <ThemedText type="small" style={{ color: "#fff", fontSize: 10 }}>
                {formatDuration(item.mediaDuration)}
              </ThemedText>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerInfo}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <ThemedText type="h3" style={{ marginLeft: Spacing.xs }}>
          {intentLabel} Posts
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
        {posts.length} {posts.length === 1 ? "post" : "posts"}
      </ThemedText>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather 
        name={intent === "pro" ? "camera" : "zap"} 
        size={48} 
        color={theme.textSecondary} 
      />
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
        No {intentLabel.toLowerCase()} posts yet
      </ThemedText>
    </View>
  );

  if (loading && posts.length === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4" style={{ flex: 1, textAlign: "center" }}>
            {profileName || "Profile"}'s {intentLabel}
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={dotColor} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4" style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
          {profileName || "Profile"}'s {intentLabel}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={dotColor}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  postCard: {
    width: POST_CARD_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  postOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  likeCount: {
    color: "#fff",
    marginLeft: 4,
    textShadowColor: "#000",
    textShadowRadius: 2,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
});

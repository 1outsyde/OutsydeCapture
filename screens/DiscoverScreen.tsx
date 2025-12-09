import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, SubscriptionTiers } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useData, Post } from "@/context/DataContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { posts, photographers, isLoading, likePost, addComment, getPhotographer } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handlePhotographerPress = (photographerId: string) => {
    const photographer = getPhotographer(photographerId);
    if (photographer) {
      navigation.navigate("PhotographerDetail", { photographer });
    }
  };

  const handleLike = (postId: string) => {
    likePost(postId);
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

  if (isLoading && posts.length === 0) {
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

    return (
      <View key={post.id} style={[styles.postCard, { backgroundColor: theme.card }]}>
        {/* Post Header */}
        <Pressable
          onPress={() => handlePhotographerPress(post.photographerId)}
          style={styles.postHeader}
        >
          <Image source={{ uri: post.photographerAvatar }} style={styles.avatar} contentFit="cover" />
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <ThemedText type="h4">{post.photographerName}</ThemedText>
              {tierConfig ? (
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Feather name="award" size={10} color="#000000" />
                  <ThemedText type="small" style={styles.tierBadgeText}>
                    {tierConfig.label}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatTimeAgo(post.createdAt)}
            </ThemedText>
          </View>
        </Pressable>

        {/* Post Image */}
        <Image source={{ uri: post.image }} style={styles.postImage} contentFit="cover" />

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
            onPress={() => handlePhotographerPress(post.photographerId)}
            style={({ pressed }) => [styles.actionButton, styles.bookButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="calendar" size={16} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}>
              Book
            </ThemedText>
          </Pressable>
        </View>

        {/* Caption */}
        <View style={styles.captionContainer}>
          <ThemedText type="body">
            <ThemedText type="h4">{post.photographerName} </ThemedText>
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
        {posts.map(renderPost)}

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

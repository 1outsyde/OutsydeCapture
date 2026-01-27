import React, { useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useMessaging, Conversation } from "@/context/MessagingContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatRelativeTime(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) {
    return "now";
  } else if (diffMins < 60) {
    return `${diffMins}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays === 1) {
    return "1d";
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w`;
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function ConversationItem({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const { theme } = useTheme();
  const hasUnread = conversation.unreadCount > 0;
  const unreadCount = conversation.unreadCount || 0;

  const relativeTime = conversation.lastMessageAt 
    ? formatRelativeTime(conversation.lastMessageAt) 
    : null;

  let messagePreview: string;
  if (hasUnread && unreadCount > 1) {
    messagePreview = `${unreadCount}+ new messages`;
  } else if (hasUnread && unreadCount === 1) {
    messagePreview = conversation.lastMessage || "New message";
  } else if (conversation.lastMessage) {
    messagePreview = conversation.lastMessage;
  } else {
    messagePreview = "Tap to message";
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
      ]}
    >
      <View style={styles.avatarContainer}>
        {conversation.participantAvatar ? (
          <Image
            source={{ uri: conversation.participantAvatar }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather 
              name={conversation.participantType === "business" ? "briefcase" : "user"} 
              size={24} 
              color={theme.textSecondary} 
            />
          </View>
        )}
      </View>
      <View style={styles.conversationContent}>
        <ThemedText
          type="body"
          numberOfLines={1}
          style={[styles.participantName, hasUnread && { fontWeight: "600" }]}
        >
          {conversation.participantName}
        </ThemedText>
        <View style={styles.messageRow}>
          <ThemedText
            type="caption"
            numberOfLines={1}
            style={[
              styles.lastMessage,
              { color: hasUnread ? theme.text : theme.textSecondary },
              hasUnread && { fontWeight: "500" },
            ]}
          >
            {messagePreview}
          </ThemedText>
          {relativeTime ? (
            <ThemedText
              type="caption"
              style={[styles.timestamp, { color: theme.textSecondary }]}
            >
              {` · ${relativeTime}`}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.rightSection}>
        {hasUnread ? (
          <View style={[styles.unreadIndicator, { backgroundColor: "#3797F0" }]} />
        ) : null}
        <Feather name="camera" size={24} color={theme.textSecondary} style={styles.cameraIcon} />
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const { theme } = useTheme();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="message-circle" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Messages Yet
      </ThemedText>
      <ThemedText type="body" style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        When you connect with photographers or businesses, you can message them here.
      </ThemedText>
    </View>
  );
}

function SignInPrompt() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="lock" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>
        Sign In to Message
      </ThemedText>
      <ThemedText type="body" style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Sign in to view your conversations and message others.
      </ThemedText>
      <Pressable
        onPress={() => navigation.navigate("Auth", { returnTo: "messages" })}
        style={({ pressed }) => [
          styles.signInButton,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <ThemedText type="button" style={{ color: "#FFFFFF" }}>
          Sign In
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function MessagesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { conversations, isLoading, refreshConversations } = useMessaging();

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshConversations();
      }
    }, [user, refreshConversations])
  );

  const sortedConversations = [...conversations].sort(
    (a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    }
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <SignInPrompt />
      </ThemedView>
    );
  }

  if (isLoading && conversations.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ScreenFlatList
      data={sortedConversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ConversationItem
          conversation={item}
          onPress={() => navigation.navigate("Chat", { 
            conversationId: item.id,
            participantId: item.participantId,
            participantName: item.participantName,
            participantAvatar: item.participantAvatar,
            participantType: item.participantType,
          })}
        />
      )}
      ListEmptyComponent={<EmptyState />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshConversations}
          tintColor={theme.primary}
        />
      }
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.border }]} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 72,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  participantName: {
    marginBottom: 2,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    flexShrink: 1,
  },
  timestamp: {
    flexShrink: 0,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  cameraIcon: {
    opacity: 0.6,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyDescription: {
    textAlign: "center",
    lineHeight: 22,
  },
  signInButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});

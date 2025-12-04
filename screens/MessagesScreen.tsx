import React from "react";
import { StyleSheet, View, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useMessaging } from "@/context/MessagingContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Conversation } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function ConversationItem({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const theme = useTheme();
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationItem,
        { backgroundColor: pressed ? theme.backgroundElevated : theme.backgroundDefault },
      ]}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: conversation.photographerAvatar }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
        {hasUnread ? (
          <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
        ) : null}
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <ThemedText
            type={hasUnread ? "defaultBold" : "default"}
            numberOfLines={1}
            style={styles.photographerName}
          >
            {conversation.photographerName}
          </ThemedText>
          {conversation.lastMessage ? (
            <ThemedText type="caption" style={{ color: hasUnread ? theme.primary : theme.textSecondary }}>
              {formatMessageTime(conversation.lastMessage.timestamp)}
            </ThemedText>
          ) : null}
        </View>
        {conversation.lastMessage ? (
          <ThemedText
            type={hasUnread ? "defaultBold" : "body"}
            numberOfLines={2}
            style={[
              styles.lastMessage,
              { color: hasUnread ? theme.textPrimary : theme.textSecondary },
            ]}
          >
            {conversation.lastMessage.senderId === conversation.clientId ? "You: " : ""}
            {conversation.lastMessage.content}
          </ThemedText>
        ) : (
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Start a conversation
          </ThemedText>
        )}
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

function EmptyState() {
  const theme = useTheme();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElevated }]}>
        <Feather name="message-circle" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Messages Yet
      </ThemedText>
      <ThemedText type="body" style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        When you book a session with a photographer, you can message them here to discuss details.
      </ThemedText>
    </View>
  );
}

function SignInPrompt() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElevated }]}>
        <Feather name="lock" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>
        Sign In to Message
      </ThemedText>
      <ThemedText type="body" style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Sign in to view your conversations and message photographers.
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
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { conversations, isLoading, refreshConversations } = useMessaging();

  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <SignInPrompt />
      </ThemedView>
    );
  }

  if (isLoading) {
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
          onPress={() => navigation.navigate("Conversation", { conversationId: item.id })}
        />
      )}
      ListEmptyComponent={<EmptyState />}
      contentContainerStyle={styles.listContent}
      refreshing={isLoading}
      onRefresh={refreshConversations}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.divider }]} />
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
    paddingVertical: Spacing.md,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  photographerName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  lastMessage: {
    lineHeight: 20,
  },
  separator: {
    height: 1,
    marginLeft: 84,
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

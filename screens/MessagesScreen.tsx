import React, { useCallback, useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
  Keyboard,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useMessaging, Conversation } from "@/context/MessagingContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { UnifiedSearchItem } from "@/services/api";

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

function ConversationItem({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
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
    messagePreview = "";
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
      ]}
    >
      {conversation.participantAvatar ? (
        <Image
          source={{ uri: conversation.participantAvatar }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="h4" style={{ color: theme.textSecondary }}>
            {conversation.participantName?.charAt(0)?.toUpperCase() || "?"}
          </ThemedText>
        </View>
      )}
      <View style={styles.conversationContent}>
        <View style={styles.nameRow}>
          <ThemedText
            type="body"
            numberOfLines={1}
            style={[styles.participantName, { fontWeight: hasUnread ? "700" : "600" }]}
          >
            {conversation.participantName}
          </ThemedText>
          {relativeTime && (
            <ThemedText
              type="caption"
              style={[styles.timestamp, { color: theme.textSecondary }]}
            >
              {relativeTime}
            </ThemedText>
          )}
        </View>
        <ThemedText
          type="caption"
          numberOfLines={1}
          style={[
            styles.previewText,
            { color: hasUnread ? theme.text : theme.textSecondary },
            hasUnread && { fontWeight: "500" },
          ]}
        >
          {messagePreview}
        </ThemedText>
      </View>
      {hasUnread && (
        <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
          <ThemedText type="small" style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </ThemedText>
        </View>
      )}
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
      <ThemedText
        type="body"
        style={[styles.emptyDescription, { color: theme.textSecondary }]}
      >
        Tap the + button to start a new conversation
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
      <ThemedText
        type="body"
        style={[styles.emptyDescription, { color: theme.textSecondary }]}
      >
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

interface SearchResult {
  id: string;
  userId?: string;
  name: string;
  username?: string;
  avatar?: string;
  type: string;
}

function NewMessageModal({
  visible,
  onClose,
  onSelectUser,
  currentUserId,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (user: SearchResult) => void;
  currentUserId: string;
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const searchQuery = query.startsWith("@") ? query.slice(1) : query;
        const response = await api.unifiedSearch({ q: searchQuery, scope: "all" });

        const mapped: SearchResult[] = response.results
          .filter((item: UnifiedSearchItem) => {
            const userId = item.userId || item.id;
            return userId !== currentUserId;
          })
          .map((item: UnifiedSearchItem) => ({
            id: item.id,
            userId: item.userId || item.id,
            name: item.displayName || item.name || item.title || "Unknown",
            username: item.username,
            avatar: item.imageUrl || item.avatar,
            type: item.type,
          }));

        setResults(mapped);
      } catch (error) {
        console.warn("[NewMessageModal] Search failed:", error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, currentUserId]);

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      onPress={() => onSelectUser(item)}
      style={({ pressed }) => [
        styles.searchResultItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
      ]}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.searchAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.searchAvatar, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {item.name?.charAt(0)?.toUpperCase() || "?"}
          </ThemedText>
        </View>
      )}
      <View style={styles.searchResultContent}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>
          {item.name}
        </ThemedText>
        {item.username && (
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            @{item.username}
          </ThemedText>
        )}
      </View>
      <View style={[styles.typeBadge, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
          {item.type}
        </ThemedText>
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View
        style={[
          styles.modalContainer,
          { backgroundColor: theme.backgroundDefault, paddingTop: insets.top },
        ]}
      >
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={16}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4" style={{ flex: 1, textAlign: "center" }}>
            New Message
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.searchContainer, { backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7" }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by @username or name"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={12}>
              <Feather name="x-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {searching ? (
          <View style={styles.searchLoading}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderSearchResult}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom }}
          />
        ) : query.length >= 2 ? (
          <View style={styles.noResults}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No users found
            </ThemedText>
          </View>
        ) : (
          <View style={styles.searchHint}>
            <Feather name="at-sign" size={32} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}
            >
              Search for users by their @username or display name
            </ThemedText>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function MessagesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversations, isLoading, refreshConversations, createOrGetConversation } = useMessaging();
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshConversations();
      }
    }, [user, refreshConversations])
  );

  const sortedConversations = [...conversations].sort((a, b) => {
    const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return dateB - dateA;
  });

  const handleSelectUser = async (selectedUser: SearchResult) => {
    if (!user || creating) return;

    setCreating(true);
    Keyboard.dismiss();

    try {
      const participantId = selectedUser.userId || selectedUser.id;
      const participantType = selectedUser.type === "business" ? "business" : "photographer";

      const conversation = await createOrGetConversation({
        participantId,
        participantType,
        participantName: selectedUser.name,
      });

      setShowNewMessage(false);

      if (conversation) {
        navigation.navigate("Chat", {
          conversationId: conversation.id,
          participantId,
          participantName: selectedUser.name,
          participantAvatar: selectedUser.avatar,
          participantType,
        });
      }
    } catch (error) {
      console.warn("[MessagesScreen] Failed to create conversation:", error);
    } finally {
      setCreating(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <ThemedText type="h2">Messages</ThemedText>
      <Pressable
        onPress={() => setShowNewMessage(true)}
        style={({ pressed }) => [
          styles.newMessageButton,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="plus" size={20} color="#fff" />
      </Pressable>
    </View>
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        {renderHeader()}
        <SignInPrompt />
      </ThemedView>
    );
  }

  if (isLoading && conversations.length === 0) {
    return (
      <ThemedView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  if (sortedConversations.length === 0) {
    return (
      <ThemedView style={styles.container}>
        {renderHeader()}
        <EmptyState />
        <NewMessageModal
          visible={showNewMessage}
          onClose={() => setShowNewMessage(false)}
          onSelectUser={handleSelectUser}
          currentUserId={user.id}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {renderHeader()}
      <ScreenFlatList
        data={sortedConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() =>
              navigation.navigate("Chat", {
                conversationId: item.id,
                participantId: item.participantId,
                participantName: item.participantName,
                participantAvatar: item.participantAvatar,
                participantType: item.participantType,
              })
            }
          />
        )}
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
      <NewMessageModal
        visible={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        onSelectUser={handleSelectUser}
        currentUserId={user.id}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  newMessageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  participantName: {
    fontSize: 16,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: Spacing.sm,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  searchLoading: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  noResults: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  searchHint: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  searchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
});

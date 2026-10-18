import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
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
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import StoryRing from "@/components/StoryRing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useMessaging, Conversation } from "@/context/MessagingContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, {
  UnifiedSearchItem,
  ApiMessageRecipient,
  ApiMessageSearchResult,
} from "@/services/api";

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

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "1d";
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const AVATAR_SIZE = 52;
// StoryRing wraps the avatar in (3 + 2) * 2 = 10 extra pixels, ring or not.
const AVATAR_OUTER = AVATAR_SIZE + 10;
const ROW_INSET = Spacing.lg;
const TEXT_GAP = Spacing.md;
const PHOTO_PREVIEW = /^Sent (a photo|\d+ photos)$/;

const TYPE_LABEL: Record<string, string> = {
  business: "Business",
  photographer: "Photographer",
  consumer: "Customer",
};

function initialsFor(name?: string): string {
  const words = (name || "")
    .replace(/^@/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0][0];
  return letters.toUpperCase();
}

function norm(s?: string | null) {
  return (s || "").toLowerCase().replace(/^@+/, "").trim();
}

function InitialsAvatar({ name, size }: { name?: string; size: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        styles.center,
        { backgroundColor: theme.brandPrimary },
      ]}
    >
      <ThemedText
        style={{
          color: theme.brandGold,
          fontWeight: "700",
          fontSize: Math.round(size * 0.36),
        }}
      >
        {initialsFor(name)}
      </ThemedText>
    </View>
  );
}

function SmallAvatar({
  uri,
  name,
  size = 44,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
}) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.brandSurface,
        }}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return <InitialsAvatar name={name} size={size} />;
}

function TypeChip({ type }: { type?: string }) {
  const { theme } = useTheme();
  const label = type ? TYPE_LABEL[type] : null;
  if (!label) return null;
  const isBiz = type === "business";
  return (
    <View
      style={[
        styles.chip,
        { borderColor: isBiz ? theme.brandGoldDim : theme.brandSurfaceBorder },
      ]}
    >
      <ThemedText
        style={[
          styles.chipText,
          { color: isBiz ? theme.brandGold : theme.brandTextDim },
        ]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

/** Text with the matched part in gold (search results). */
function Highlighted({
  text,
  query,
  style,
  color,
  numberOfLines = 1,
}: {
  text: string;
  query: string;
  style?: any;
  color: string;
  numberOfLines?: number;
}) {
  const { theme } = useTheme();
  const q = norm(query);
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0)
    return (
      <ThemedText style={[style, { color }]} numberOfLines={numberOfLines}>
        {text}
      </ThemedText>
    );
  return (
    <ThemedText style={[style, { color }]} numberOfLines={numberOfLines}>
      {text.slice(0, i)}
      <ThemedText
        style={[style, { color: theme.brandGold, fontWeight: "700" }]}
      >
        {text.slice(i, i + q.length)}
      </ThemedText>
      {text.slice(i + q.length)}
    </ThemedText>
  );
}

function ConversationItem({
  conversation,
  onPress,
  query = "",
}: {
  conversation: Conversation;
  onPress: () => void;
  query?: string;
}) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const hasUnread = conversation.unreadCount > 0;
  const unreadCount = conversation.unreadCount || 0;
  const [avatarFailed, setAvatarFailed] = useState(false);

  const relativeTime = conversation.lastMessageAt
    ? formatRelativeTime(conversation.lastMessageAt)
    : null;

  let messagePreview: string;
  if (hasUnread && unreadCount > 1) {
    messagePreview = `${unreadCount} new messages`;
  } else if (conversation.lastMessage) {
    messagePreview = conversation.lastMessage;
  } else if (hasUnread) {
    messagePreview = "New message";
  } else {
    messagePreview = "No messages yet";
  }
  const isEmptyPreview = !conversation.lastMessage && !hasUnread;
  const isPhoto = PHOTO_PREVIEW.test(messagePreview);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${conversation.participantName}. ${hasUnread ? `${unreadCount} unread. ` : ""}${messagePreview}`}
      style={({ pressed }) => [
        styles.conversationItem,
        { backgroundColor: pressed ? theme.brandSurface : "transparent" },
      ]}
    >
      <StoryRing
        userId={conversation.participantId}
        size={AVATAR_SIZE}
        isOwnProfile={false}
        onAddStory={() => {}}
        onViewStory={(stories) =>
          navigation.navigate("StoryViewer", {
            userId: conversation.participantId,
            stories,
            authorName: conversation.participantName,
            authorAvatarUrl: conversation.participantAvatar,
          })
        }
      >
        {conversation.participantAvatar && !avatarFailed ? (
          <Image
            source={{ uri: conversation.participantAvatar }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <InitialsAvatar
            name={conversation.participantName}
            size={AVATAR_SIZE}
          />
        )}
      </StoryRing>
      <View style={styles.conversationContent}>
        <View style={styles.nameRow}>
          <Highlighted
            text={conversation.participantName}
            query={query}
            color={theme.brandCream}
            style={[
              styles.participantName,
              { fontWeight: hasUnread ? "700" : "600" },
            ]}
          />
          {relativeTime && (
            <ThemedText
              style={[
                styles.timestamp,
                { color: hasUnread ? theme.brandGold : theme.brandTextDim },
              ]}
            >
              {relativeTime}
            </ThemedText>
          )}
        </View>
        <View style={styles.previewRow}>
          {isPhoto ? (
            <Feather
              name="image"
              size={13}
              color={hasUnread ? theme.brandCream : theme.brandTextDim}
              style={{ marginRight: 5 }}
            />
          ) : null}
          <ThemedText
            numberOfLines={1}
            style={[
              styles.previewText,
              { color: hasUnread ? theme.brandCream : theme.brandTextDim },
              hasUnread && { fontWeight: "600" },
              isEmptyPreview && { fontStyle: "italic" },
            ]}
          >
            {messagePreview}
          </ThemedText>
        </View>
      </View>
      {hasUnread && (
        <View
          style={[styles.unreadBadge, { backgroundColor: theme.brandGold }]}
        >
          <ThemedText style={styles.unreadText}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: theme.brandSurface,
            borderColor: theme.brandSurfaceBorder,
          },
        ]}
      >
        <Feather name="message-circle" size={40} color={theme.brandGold} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.brandCream }]}>
        No messages yet
      </ThemedText>
      <ThemedText
        style={[styles.emptyDescription, { color: theme.brandTextDim }]}
      >
        Message a business about a booking, or a photographer about a shoot. You
        can send photos too.
      </ThemedText>
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.goldButton,
          { backgroundColor: theme.brandGold, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="edit-3" size={16} color="#0A0A0A" />
        <ThemedText style={styles.goldButtonText}>
          Start a conversation
        </ThemedText>
      </Pressable>
    </View>
  );
}

function SignInPrompt() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: theme.brandSurface,
            borderColor: theme.brandSurfaceBorder,
          },
        ]}
      >
        <Feather name="lock" size={40} color={theme.brandGold} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.brandCream }]}>
        Sign in to message
      </ThemedText>
      <ThemedText
        style={[styles.emptyDescription, { color: theme.brandTextDim }]}
      >
        Sign in to view your conversations and message businesses and
        photographers.
      </ThemedText>
      <Pressable
        onPress={() => navigation.navigate("Auth", { returnTo: "messages" })}
        style={({ pressed }) => [
          styles.goldButton,
          { backgroundColor: theme.brandGold, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <ThemedText style={styles.goldButtonText}>Sign in</ThemedText>
      </Pressable>
    </View>
  );
}

// ── New message ──────────────────────────────────────────────────────────

type Recipient = {
  key: string;
  participantId: string;
  participantType: "user" | "business" | "photographer";
  name: string;
  username?: string | null;
  avatar?: string | null;
  type?: string;
  conversationId?: string | null;
};

function fromApiRecipient(r: ApiMessageRecipient): Recipient {
  return {
    key: r.userId,
    participantId: r.participantId,
    participantType: "user",
    name: r.publicName,
    username: r.username,
    avatar: r.avatarUrl,
    type: r.type,
    conversationId: r.conversationId,
  };
}

/** Backends before #322 have no recipients route: old search, businesses + photographers only. */
async function legacyRecipientSearch(
  q: string,
  currentUserId: string,
): Promise<Recipient[]> {
  const response = await api.unifiedSearch({ q, scope: "all" });
  return response.results
    .filter(
      (item: UnifiedSearchItem) =>
        item.type === "business" || item.type === "photographer",
    )
    .filter(
      (item: UnifiedSearchItem) =>
        (item.providerUserId || item.userId || item.id) !== currentUserId,
    )
    .map((item: UnifiedSearchItem) => ({
      key: `${item.type}-${item.id}`,
      participantId: item.id,
      participantType: item.type === "business" ? "business" : "photographer",
      name: item.displayName || item.name || item.title || "Unknown",
      username: item.username,
      avatar: (item as any).avatarUrl || item.imageUrl || item.avatar,
      type: item.type,
    }));
}

function RecipientRow({
  item,
  query,
  onPress,
}: {
  item: Recipient;
  query: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Message ${item.name}`}
      style={({ pressed }) => [
        styles.searchResultItem,
        { backgroundColor: pressed ? theme.brandSurface : "transparent" },
      ]}
    >
      <SmallAvatar uri={item.avatar} name={item.name} />
      <View style={styles.searchResultContent}>
        <Highlighted
          text={item.name}
          query={query}
          color={theme.brandCream}
          style={styles.resultName}
        />
        {item.username ? (
          <ThemedText
            style={[styles.resultSub, { color: theme.brandTextDim }]}
            numberOfLines={1}
          >
            @{item.username}
          </ThemedText>
        ) : null}
      </View>
      <TypeChip type={item.type} />
    </Pressable>
  );
}

function NewMessageModal({
  visible,
  onClose,
  onSelect,
  currentUserId,
  recent,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (r: Recipient) => void;
  currentUserId: string;
  recent: Conversation[];
  busy: boolean;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setFailed(false);
    }
  }, [visible]);

  useEffect(() => {
    const q = query.trim().replace(/^@+/, "");
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const token = await getToken();
        let list: Recipient[];
        try {
          list = (await api.searchMessageRecipients(q, token)).map(
            fromApiRecipient,
          );
        } catch (e: any) {
          if (e?.status === 404)
            list = await legacyRecipientSearch(q, currentUserId);
          else throw e;
        }
        if (!cancelled) {
          setResults(list);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, currentUserId, getToken]);

  const q = query.trim().replace(/^@+/, "");
  const recentRows: Recipient[] = recent.slice(0, 8).map((c) => ({
    key: `recent-${c.id}`,
    participantId: c.participantId,
    participantType: "user",
    name: c.participantName,
    username: c.username,
    avatar: c.participantAvatar,
    type: c.participantType,
    conversationId: c.id,
  }));

  let body: React.ReactNode;
  if (q.length < 2) {
    body =
      recentRows.length > 0 ? (
        <FlatList
          data={recentRows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <ThemedText
              style={[styles.sectionLabel, { color: theme.brandTextDim }]}
            >
              Recent
            </ThemedText>
          }
          renderItem={({ item }) => (
            <RecipientRow item={item} query="" onPress={() => onSelect(item)} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
        />
      ) : (
        <View style={styles.searchHint}>
          <View
            style={[
              styles.hintIcon,
              {
                backgroundColor: theme.brandSurface,
                borderColor: theme.brandSurfaceBorder,
              },
            ]}
          >
            <Feather name="search" size={26} color={theme.brandGold} />
          </View>
          <ThemedText style={[styles.hintTitle, { color: theme.brandCream }]}>
            Find someone to message
          </ThemedText>
          <ThemedText style={[styles.hintBody, { color: theme.brandTextDim }]}>
            Search businesses, photographers and people by name or @username.
          </ThemedText>
        </View>
      );
  } else if (searching && results.length === 0) {
    body = (
      <View style={styles.searchLoading}>
        <ActivityIndicator size="small" color={theme.brandGold} />
      </View>
    );
  } else if (results.length > 0) {
    body = (
      <FlatList
        data={results}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <RecipientRow item={item} query={q} onPress={() => onSelect(item)} />
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
      />
    );
  } else {
    body = (
      <View style={styles.searchHint}>
        <ThemedText style={[styles.hintTitle, { color: theme.brandCream }]}>
          {failed
            ? "Search isn't working right now"
            : `No one found for "${q}"`}
        </ThemedText>
        <ThemedText style={[styles.hintBody, { color: theme.brandTextDim }]}>
          {failed
            ? "Check your connection and try again."
            : "Check the spelling, or try their @username."}
        </ThemedText>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalContainer,
          {
            backgroundColor: theme.brandBg,
            paddingTop: Platform.OS === "ios" ? Spacing.sm : insets.top,
          },
        ]}
      >
        <View
          style={[
            styles.grabber,
            { backgroundColor: theme.brandSurfaceBorder },
          ]}
        />
        <View style={styles.modalHeader}>
          <Pressable
            onPress={onClose}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <ThemedText style={{ color: theme.brandTextDim, fontSize: 16 }}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.modalTitle, { color: theme.brandCream }]}>
            New message
          </ThemedText>
          <View style={{ width: 52, alignItems: "flex-end" }}>
            {busy ? (
              <ActivityIndicator size="small" color={theme.brandGold} />
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.searchField,
            {
              backgroundColor: theme.brandSurface,
              borderColor: theme.brandSurfaceBorder,
              marginHorizontal: Spacing.lg,
            },
          ]}
        >
          <Feather name="search" size={17} color={theme.brandTextDim} />
          <TextInput
            style={[styles.searchInput, { color: theme.brandCream }]}
            placeholder="Search names or @username"
            placeholderTextColor={theme.brandTextDim}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search people to message"
          />
          {searching && results.length > 0 ? (
            <ActivityIndicator size="small" color={theme.brandTextDim} />
          ) : null}
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={12}
              accessibilityLabel="Clear search"
            >
              <Feather name="x-circle" size={17} color={theme.brandTextDim} />
            </Pressable>
          )}
        </View>
        {body}
      </View>
    </Modal>
  );
}

// ── Inbox ────────────────────────────────────────────────────────────────

type SearchRow =
  | { kind: "label"; key: string; label: string }
  | { kind: "convo"; key: string; convo: Conversation }
  | { kind: "message"; key: string; hit: ApiMessageSearchResult }
  | { kind: "person"; key: string; person: Recipient };

export default function MessagesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken } = useAuth();
  const {
    conversations,
    isLoading,
    refreshConversations,
    createOrGetConversation,
  } = useMessaging();
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [messageHits, setMessageHits] = useState<ApiMessageSearchResult[]>([]);
  const [peopleHits, setPeopleHits] = useState<Recipient[]>([]);
  const [searchingServer, setSearchingServer] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) refreshConversations();
    }, [user, refreshConversations]),
  );

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return dateB - dateA;
      }),
    [conversations],
  );

  const q = query.trim().replace(/^@+/, "");
  const searching = q.length > 0;

  // Server search: message text in your chats + people you haven't messaged yet.
  useEffect(() => {
    if (q.length < 2) {
      setMessageHits([]);
      setPeopleHits([]);
      setSearchingServer(false);
      return;
    }
    let cancelled = false;
    setSearchingServer(true);
    const t = setTimeout(async () => {
      const token = await getToken();
      const [msgs, people] = await Promise.all([
        api
          .searchMyMessages(q, token)
          .catch(() => [] as ApiMessageSearchResult[]),
        api
          .searchMessageRecipients(q, token)
          .catch(() => [] as ApiMessageRecipient[]),
      ]);
      if (cancelled) return;
      setMessageHits(msgs);
      setPeopleHits(
        people
          .filter((p) => !p.conversationId)
          .slice(0, 5)
          .map(fromApiRecipient),
      );
      setSearchingServer(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, getToken]);

  const openChat = useCallback(
    (c: Conversation) =>
      navigation.navigate("Chat", {
        conversationId: c.id,
        participantId: c.participantId,
        participantName: c.participantName,
        participantAvatar: c.participantAvatar,
        participantType: c.participantType,
        businessId: c.businessId,
        photographerId: c.photographerId,
      }),
    [navigation],
  );

  const handleSelect = async (r: Recipient) => {
    if (!user || creating) return;
    Keyboard.dismiss();
    if (r.conversationId) {
      setShowNewMessage(false);
      const existing = conversations.find((c) => c.id === r.conversationId);
      if (existing) openChat(existing);
      else
        navigation.navigate("Chat", {
          conversationId: r.conversationId,
          participantName: r.name,
          participantAvatar: r.avatar || undefined,
        });
      return;
    }
    setCreating(true);
    try {
      const conversation = await createOrGetConversation({
        participantId: r.participantId,
        participantType: r.participantType,
        participantName: r.name,
      });
      setShowNewMessage(false);
      if (conversation) {
        openChat({
          ...conversation,
          participantName: conversation.participantName || r.name,
          participantAvatar:
            conversation.participantAvatar || r.avatar || undefined,
        });
      }
    } catch (error) {
      console.warn("[MessagesScreen] Failed to create conversation:", error);
    } finally {
      setCreating(false);
    }
  };

  const searchRows: SearchRow[] = useMemo(() => {
    if (!searching) return [];
    const nq = norm(q);
    const convoMatches = sortedConversations.filter(
      (c) =>
        norm(c.participantName).includes(nq) || norm(c.username).includes(nq),
    );
    const rows: SearchRow[] = [];
    if (convoMatches.length) {
      rows.push({ kind: "label", key: "l-chats", label: "Chats" });
      convoMatches.forEach((c) =>
        rows.push({ kind: "convo", key: `c-${c.id}`, convo: c }),
      );
    }
    if (messageHits.length) {
      rows.push({ kind: "label", key: "l-msgs", label: "Messages" });
      messageHits.forEach((h) =>
        rows.push({ kind: "message", key: `m-${h.messageId}`, hit: h }),
      );
    }
    if (peopleHits.length) {
      rows.push({ kind: "label", key: "l-people", label: "Start a new chat" });
      peopleHits.forEach((p) =>
        rows.push({ kind: "person", key: `p-${p.key}`, person: p }),
      );
    }
    return rows;
  }, [searching, q, sortedConversations, messageHits, peopleHits]);

  const renderSearchRow = ({ item }: { item: SearchRow }) => {
    if (item.kind === "label") {
      return (
        <ThemedText
          style={[styles.sectionLabel, { color: theme.brandTextDim }]}
        >
          {item.label}
        </ThemedText>
      );
    }
    if (item.kind === "convo") {
      return (
        <ConversationItem
          conversation={item.convo}
          query={q}
          onPress={() => openChat(item.convo)}
        />
      );
    }
    if (item.kind === "person") {
      return (
        <RecipientRow
          item={item.person}
          query={q}
          onPress={() => handleSelect(item.person)}
        />
      );
    }
    const h = item.hit;
    const convo = conversations.find((c) => c.id === h.conversationId);
    return (
      <Pressable
        onPress={() =>
          convo
            ? openChat(convo)
            : navigation.navigate("Chat", {
                conversationId: h.conversationId,
                participantId: h.otherParticipant.id,
                participantName: h.otherParticipant.publicName,
                participantAvatar: h.otherParticipant.avatarUrl || undefined,
                participantType: h.otherParticipant.type,
              })
        }
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.searchResultItem,
          { backgroundColor: pressed ? theme.brandSurface : "transparent" },
        ]}
      >
        <SmallAvatar
          uri={h.otherParticipant.avatarUrl}
          name={h.otherParticipant.publicName}
        />
        <View style={styles.searchResultContent}>
          <View style={styles.nameRow}>
            <ThemedText
              style={[styles.resultName, { color: theme.brandCream, flex: 1 }]}
              numberOfLines={1}
            >
              {h.otherParticipant.publicName}
            </ThemedText>
            <ThemedText
              style={[styles.timestamp, { color: theme.brandTextDim }]}
            >
              {formatRelativeTime(h.createdAt)}
            </ThemedText>
          </View>
          <Highlighted
            text={`${h.fromMe ? "You: " : ""}${h.snippet}`}
            query={q}
            color={theme.brandTextDim}
            style={styles.previewText}
            numberOfLines={2}
          />
        </View>
      </Pressable>
    );
  };

  const header = (
    <View style={styles.header}>
      <View
        style={[
          styles.searchField,
          {
            backgroundColor: theme.brandSurface,
            borderColor: theme.brandSurfaceBorder,
            flex: 1,
          },
        ]}
      >
        <Feather name="search" size={17} color={theme.brandTextDim} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages"
          placeholderTextColor={theme.brandTextDim}
          style={[styles.searchInput, { color: theme.brandCream }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search messages"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery("")}
            hitSlop={12}
            accessibilityLabel="Clear search"
          >
            <Feather name="x-circle" size={17} color={theme.brandTextDim} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => setShowNewMessage(true)}
        accessibilityRole="button"
        accessibilityLabel="New message"
        hitSlop={6}
        style={({ pressed }) => [
          styles.composeButton,
          { backgroundColor: theme.brandGold, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="edit-3" size={18} color="#0A0A0A" />
      </Pressable>
    </View>
  );

  const modal = (
    <NewMessageModal
      visible={showNewMessage}
      onClose={() => setShowNewMessage(false)}
      onSelect={handleSelect}
      currentUserId={user?.id || ""}
      recent={sortedConversations}
      busy={creating}
    />
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
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandGold} />
        </View>
      </ThemedView>
    );
  }

  if (searching) {
    return (
      <ThemedView style={styles.container}>
        {header}
        <FlatList
          data={searchRows}
          keyExtractor={(r) => r.key}
          renderItem={renderSearchRow}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: Spacing["3xl"] }}
          ListEmptyComponent={
            searchingServer || q.length < 2 ? (
              <View style={styles.searchLoading}>
                {q.length >= 2 ? (
                  <ActivityIndicator size="small" color={theme.brandGold} />
                ) : (
                  <ThemedText
                    style={[styles.hintBody, { color: theme.brandTextDim }]}
                  >
                    Keep typing to search messages
                  </ThemedText>
                )}
              </View>
            ) : (
              <View style={styles.searchHint}>
                <ThemedText
                  style={[styles.hintTitle, { color: theme.brandCream }]}
                >
                  {`No results for "${q}"`}
                </ThemedText>
                <ThemedText
                  style={[styles.hintBody, { color: theme.brandTextDim }]}
                >
                  Try a name, an @username, or a word from a message.
                </ThemedText>
              </View>
            )
          }
        />
        {modal}
      </ThemedView>
    );
  }

  if (sortedConversations.length === 0) {
    return (
      <ThemedView style={styles.container}>
        {header}
        <EmptyState onStart={() => setShowNewMessage(true)} />
        {modal}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {header}
      <ScreenFlatList
        data={sortedConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => openChat(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshConversations}
            tintColor={theme.brandGold}
          />
        }
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.separator,
              { backgroundColor: theme.brandSurfaceBorder },
            ]}
          />
        )}
      />
      {modal}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: ROW_INSET,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  composeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { flexGrow: 1, paddingHorizontal: 0, paddingTop: Spacing.xs },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ROW_INSET,
    paddingVertical: Spacing.sm + 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  conversationContent: { flex: 1, marginLeft: TEXT_GAP },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  participantName: { fontSize: 16, flex: 1 },
  timestamp: {
    fontSize: 12,
    marginLeft: Spacing.sm,
    fontVariant: ["tabular-nums"],
  },
  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  previewText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  unreadText: {
    color: "#0A0A0A",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_INSET + AVATAR_OUTER + TEXT_GAP,
    marginRight: ROW_INSET,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyDescription: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  goldButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  goldButtonText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
  modalContainer: { flex: 1 },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: ROW_INSET,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  searchLoading: { padding: Spacing.xl, alignItems: "center" },
  searchHint: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["3xl"],
  },
  hintIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  hintTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  hintBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: Spacing.xs,
    maxWidth: 280,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ROW_INSET,
    paddingVertical: 10,
  },
  searchResultContent: { flex: 1, marginLeft: Spacing.md },
  resultName: { fontSize: 16, fontWeight: "600" },
  resultSub: { fontSize: 13, marginTop: 1 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginLeft: Spacing.sm,
  },
  chipText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});

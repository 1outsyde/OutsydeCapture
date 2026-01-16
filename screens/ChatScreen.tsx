import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { ApiMessage, ApiError } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Chat">;

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMessageDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }
}

interface MessageBubbleProps {
  message: ApiMessage;
  isOwnMessage: boolean;
}

function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
        {
          backgroundColor: isOwnMessage ? theme.primary : theme.backgroundDefault,
        },
      ]}
    >
      <ThemedText
        type="body"
        style={[
          styles.messageText,
          { color: isOwnMessage ? "#FFFFFF" : theme.text },
        ]}
      >
        {message.content}
      </ThemedText>
      <ThemedText
        type="small"
        style={[
          styles.messageTime,
          { color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.textSecondary },
        ]}
      >
        {formatMessageTime(message.createdAt)}
      </ThemedText>
    </View>
  );
}

function DateSeparator({ date }: { date: string }) {
  const { theme } = useTheme();

  return (
    <View style={styles.dateSeparator}>
      <View style={[styles.dateLine, { backgroundColor: theme.textSecondary }]} />
      <ThemedText type="small" style={[styles.dateText, { color: theme.textSecondary }]}>
        {date}
      </ThemedText>
      <View style={[styles.dateLine, { backgroundColor: theme.textSecondary }]} />
    </View>
  );
}

export default function ChatScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { conversationId, participantName, participantAvatar } = route.params;
  const insets = useSafeAreaInsets();
  const { user, getToken } = useAuth();

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          {participantAvatar ? (
            <Image
              source={{ uri: participantAvatar }}
              style={styles.headerAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="user" size={16} color={theme.textSecondary} />
            </View>
          )}
          <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
            {participantName}
          </ThemedText>
        </View>
      ),
    });
  }, [participantName, participantAvatar, theme]);

  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const authToken = await getToken();
      const fetchedMessages = await api.getMessages(conversationId, authToken);
      setMessages(fetchedMessages);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 404) {
        setMessages([]);
      } else {
        setError(apiError.message || "Failed to load messages");
      }
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, getToken]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isLoading]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const messageContent = inputText.trim();
    setInputText("");

    const optimisticMessage: ApiMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: user?.id || "current-user",
      content: messageContent,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const authToken = await getToken();
      const sentMessage = await api.sendMessage(conversationId, messageContent, authToken);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticMessage.id ? sentMessage : msg))
      );
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      setInputText(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const groupedMessages: { date: string; messages: ApiMessage[] }[] = [];
  let currentDate = "";

  messages.forEach((message) => {
    const messageDate = formatMessageDate(message.createdAt);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({ date: messageDate, messages: [message] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  const renderItem = ({ item }: { item: { date: string; messages: ApiMessage[] } }) => (
    <View>
      <DateSeparator date={item.date} />
      {item.messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwnMessage={message.senderId === user?.id || message.senderId === "current-user"}
        />
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Loading messages...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centeredContainer}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            {error}
          </ThemedText>
          <Pressable
            onPress={fetchMessages}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          keyExtractor={(item) => item.date}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
                Start your conversation with {participantName}
              </ThemedText>
            </View>
          }
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundDefault,
              paddingBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundDefault }]}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.textInput, { color: theme.text }]}
              multiline
              maxLength={1000}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? theme.primary : theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather
                name="send"
                size={20}
                color={inputText.trim() ? "#FFFFFF" : theme.textSecondary}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  emptyList: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginVertical: Spacing.xs,
  },
  ownMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: BorderRadius.xs,
  },
  otherMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: BorderRadius.xs,
  },
  messageText: {
    lineHeight: 22,
  },
  messageTime: {
    alignSelf: "flex-end",
    marginTop: Spacing.xs,
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dateLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  dateText: {
    marginHorizontal: Spacing.md,
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});

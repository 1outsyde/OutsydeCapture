import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface MessagingContextType {
  conversations: Conversation[];
  getMessages: (conversationId: string) => Message[];
  sendMessage: (conversationId: string, participantId: string, participantName: string, participantAvatar: string, text: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  totalUnreadCount: number;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

const getConversationsKey = (userId: string) => `@outsyde_conversations_${userId}`;
const getMessagesKey = (userId: string, conversationId: string) => `@outsyde_messages_${userId}_${conversationId}`;

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    if (isAuthenticated && user) {
      loadConversations();
    } else {
      setConversations([]);
      setMessagesCache({});
    }
  }, [isAuthenticated, user]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const stored = await AsyncStorage.getItem(getConversationsKey(user.id));
      if (stored) setConversations(JSON.parse(stored));
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const getMessages = (conversationId: string): Message[] => {
    return messagesCache[conversationId] || [];
  };

  const loadMessages = async (conversationId: string): Promise<Message[]> => {
    if (!user) return [];
    try {
      const stored = await AsyncStorage.getItem(getMessagesKey(user.id, conversationId));
      const messages = stored ? JSON.parse(stored) : [];
      setMessagesCache((prev) => ({ ...prev, [conversationId]: messages }));
      return messages;
    } catch (err) {
      console.error("Failed to load messages:", err);
      return [];
    }
  };

  const sendMessage = async (
    conversationId: string,
    participantId: string,
    participantName: string,
    participantAvatar: string,
    text: string
  ) => {
    if (!user) return;

    const newMessage: Message = {
      id: "msg_" + Date.now(),
      senderId: user.id,
      receiverId: participantId,
      text,
      timestamp: new Date().toISOString(),
      read: true,
    };

    const existingMessages = await loadMessages(conversationId);
    const updatedMessages = [...existingMessages, newMessage];
    await AsyncStorage.setItem(getMessagesKey(user.id, conversationId), JSON.stringify(updatedMessages));
    setMessagesCache((prev) => ({ ...prev, [conversationId]: updatedMessages }));

    const existingConversation = conversations.find((c) => c.id === conversationId);
    let updatedConversations: Conversation[];

    if (existingConversation) {
      updatedConversations = conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: text, lastMessageTime: newMessage.timestamp }
          : c
      );
    } else {
      const newConversation: Conversation = {
        id: conversationId,
        participantId,
        participantName,
        participantAvatar,
        lastMessage: text,
        lastMessageTime: newMessage.timestamp,
        unreadCount: 0,
      };
      updatedConversations = [newConversation, ...conversations];
    }

    await AsyncStorage.setItem(getConversationsKey(user.id), JSON.stringify(updatedConversations));
    setConversations(updatedConversations);
  };

  const markConversationAsRead = async (conversationId: string) => {
    if (!user) return;
    const updated = conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    );
    await AsyncStorage.setItem(getConversationsKey(user.id), JSON.stringify(updated));
    setConversations(updated);
  };

  const totalUnreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        getMessages,
        sendMessage,
        markConversationAsRead,
        totalUnreadCount,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error("useMessaging must be used within a MessagingProvider");
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import api, { ApiConversation, ApiMessage, CreateConversationRequest } from "@/services/api";

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantType: "business" | "photographer";
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface MessagingContextType {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refreshConversations: () => Promise<void>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  sendMessage: (conversationId: string, content: string) => Promise<Message | null>;
  createOrGetConversation: (data: CreateConversationRequest) => Promise<Conversation | null>;
  markConversationAsRead: (conversationId: string) => void;
  totalUnreadCount: number;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

function mapApiConversation(conv: ApiConversation): Conversation {
  return {
    id: conv.id,
    participantId: conv.participantId,
    participantName: conv.participantName,
    participantAvatar: conv.participantAvatar,
    participantType: conv.participantType,
    lastMessage: conv.lastMessage,
    lastMessageAt: conv.lastMessageAt,
    unreadCount: conv.unreadCount || 0,
  };
}

function mapApiMessage(msg: ApiMessage): Message {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
  };
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setConversations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const apiConversations = await api.getConversations(token);
      // Ensure apiConversations is an array before mapping
      if (Array.isArray(apiConversations)) {
        setConversations(apiConversations.map(mapApiConversation));
      } else {
        setConversations([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch conversations:", err);
      if (err?.status === 404 || err?.status === 401) {
        setConversations([]);
      } else {
        setError(err?.message || "Failed to load conversations");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, getToken]);

  useEffect(() => {
    if (isAuthenticated && user) {
      refreshConversations();
    } else {
      setConversations([]);
    }
  }, [isAuthenticated, user]);

  const getMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    try {
      const token = await getToken();
      const apiMessages = await api.getMessages(conversationId, token);
      return apiMessages.map(mapApiMessage);
    } catch (err: any) {
      console.error("Failed to fetch messages:", err);
      if (err?.status === 404) {
        return [];
      }
      throw err;
    }
  }, [getToken]);

  const sendMessage = useCallback(async (conversationId: string, content: string): Promise<Message | null> => {
    try {
      const token = await getToken();
      const apiMessage = await api.sendMessage(conversationId, content, token);
      
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId
          ? { ...conv, lastMessage: content, lastMessageAt: apiMessage.createdAt }
          : conv
      ));
      
      return mapApiMessage(apiMessage);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      return null;
    }
  }, [getToken]);

  const createOrGetConversation = useCallback(async (data: CreateConversationRequest): Promise<Conversation | null> => {
    try {
      const token = await getToken();
      const apiConversation = await api.createOrGetConversation(data, token);
      const conversation = mapApiConversation(apiConversation);
      
      setConversations(prev => {
        const exists = prev.find(c => c.id === conversation.id);
        if (exists) {
          return prev;
        }
        return [conversation, ...prev];
      });
      
      return conversation;
    } catch (err: any) {
      console.error("Failed to create/get conversation:", err);
      return null;
    }
  }, [getToken]);

  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
    ));
  }, []);

  const totalUnreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        isLoading,
        error,
        refreshConversations,
        getMessages,
        sendMessage,
        createOrGetConversation,
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

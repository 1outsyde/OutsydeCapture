import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { AppState, AppStateStatus } from "react-native";
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
  const appState = useRef(AppState.currentState);

  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated || !user) {
      console.log("[MessagingContext] Not authenticated, clearing conversations");
      setConversations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      console.log("[MessagingContext] Fetching conversations with token:", token ? "present" : "missing");
      
      const response = await api.getConversations(token);
      
      // TEMP DEBUG - log raw response
      console.log("[MessagingContext] Raw API response:", JSON.stringify(response, null, 2));
      
      // Normalize response - handle both array and wrapped object shapes
      let apiConversations: any[] = [];
      if (Array.isArray(response)) {
        apiConversations = response;
      } else if (response && typeof response === 'object' && 'conversations' in response) {
        apiConversations = (response as any).conversations || [];
      }
      
      console.log("[MessagingContext] Normalized conversations count:", apiConversations.length);
      if (apiConversations.length > 0) {
        console.log("[MessagingContext] First raw conversation:", JSON.stringify(apiConversations[0], null, 2));
      }
      
      // Map using otherParticipant ONLY (correct backend schema)
      const mapped = apiConversations.map((conv: any) => {
        const otherP = conv.otherParticipant || {};
        const mapped = {
          id: conv.id,
          participantId: otherP.id || "",
          participantName: otherP.displayName || otherP.name || otherP.username || "Unknown",
          participantAvatar: otherP.profileImageUrl || otherP.avatar || undefined,
          participantType: (otherP.type as "business" | "photographer") || "photographer",
          lastMessage: conv.lastMessagePreview || conv.lastMessage || "",
          lastMessageAt: conv.lastMessageAt || conv.updatedAt || conv.createdAt || "",
          unreadCount: conv.unreadCount || 0,
        };
        return mapped;
      });
      
      console.log("[MessagingContext] Mapped conversations count:", mapped.length);
      if (mapped.length > 0) {
        console.log("[MessagingContext] First mapped conversation:", JSON.stringify(mapped[0], null, 2));
      }
      
      setConversations(mapped);
    } catch (err: any) {
      console.error("[MessagingContext] FETCH ERROR:", err);
      console.error("[MessagingContext] Error details:", {
        message: err?.message,
        status: err?.status,
        response: err?.response,
        stack: err?.stack,
      });
      if (err?.status === 404 || err?.status === 401) {
        setConversations([]);
      } else {
        setError(err?.message || "Failed to load conversations");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, getToken]);

  // Fetch on initial mount and when auth state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      refreshConversations();
    } else {
      setConversations([]);
    }
  }, [isAuthenticated, user, refreshConversations]);

  // Fetch on app resume (background -> foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isAuthenticated &&
        user
      ) {
        refreshConversations();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, user, refreshConversations]);

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
      
      // Immediately add to local state for instant UI feedback
      setConversations(prev => {
        const exists = prev.find(c => c.id === conversation.id);
        if (exists) {
          return prev;
        }
        return [conversation, ...prev];
      });
      
      // Also trigger a full refresh to sync with server
      // This ensures the Messages tab always reflects the true server state
      refreshConversations();
      
      return conversation;
    } catch (err: any) {
      console.error("Failed to create/get conversation:", err);
      return null;
    }
  }, [getToken, refreshConversations]);

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

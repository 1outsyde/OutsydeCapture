import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import api, { ApiConversation, ApiMessage, CreateConversationRequest } from "@/services/api";
import { onMessagePush } from "@/services/messagePush";

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantType: "business" | "photographer" | "consumer";
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  username?: string | null;
  /** Business / photographer profile ids for "View profile" (backend #300). */
  businessId?: string | null;
  photographerId?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  /** Real text ('' for a photo only message). Falls back to content on older backends. */
  text: string;
  mediaItems: string[];
  createdAt: string;
}

interface MessagingContextType {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refreshConversations: () => Promise<void>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  sendMessage: (conversationId: string, content: string, mediaItems?: string[]) => Promise<Message | null>;
  createOrGetConversation: (data: CreateConversationRequest) => Promise<Conversation | null>;
  markConversationAsRead: (conversationId: string) => void;
  noteMessageSent: (conversationId: string, preview: string, at?: string) => void;
  totalUnreadCount: number;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

// POST /api/conversations returns { conversation, otherParticipant }, not a flat conversation.
// Reading conv.id off that shape gave an undefined id, so "+ New message" opened a broken chat.
function mapApiConversation(raw: ApiConversation | any): Conversation {
  const conv: any = raw?.conversation ? { ...raw.conversation, otherParticipant: raw.otherParticipant } : raw;
  const otherP: any = conv?.otherParticipant || {};
  return {
    id: conv.id,
    participantId: otherP.id || conv.participantId || "",
    participantName: otherP.publicName || otherP.displayName || otherP.name || conv.participantName || "Unknown",
    participantAvatar: otherP.avatarUrl || otherP.avatar || otherP.profileImageUrl || conv.participantAvatar || undefined,
    participantType: (otherP.type as Conversation["participantType"]) || conv.participantType || "consumer",
    lastMessage: conv.lastMessagePreview || conv.lastMessage,
    lastMessageAt: conv.lastMessageAt,
    unreadCount: conv.unreadCount || 0,
    username: otherP.username ?? null,
    businessId: otherP.businessId ?? null,
    photographerId: otherP.photographerId ?? null,
  };
}

export function mapApiMessage(msg: ApiMessage): Message {
  const mediaItems = Array.isArray(msg.mediaItems) ? msg.mediaItems : [];
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    // Older backends have no `text`; their `content` is always the real text.
    text: typeof msg.text === "string" ? msg.text : msg.content || "",
    mediaItems,
    createdAt: msg.createdAt,
  };
}

/** Inbox preview for a message we just sent (matches the backend's wording). */
export function previewFor(text: string, mediaItems: string[] = []): string {
  const t = (text || "").trim();
  if (t) return t;
  if (mediaItems.length === 1) return "Sent a photo";
  if (mediaItems.length > 1) return `Sent ${mediaItems.length} photos`;
  return "";
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setConversations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await api.getConversations(token);

      // Normalize response - handle both array and wrapped object shapes
      let apiConversations: any[] = [];
      if (Array.isArray(response)) {
        apiConversations = response;
      } else if (response && typeof response === 'object' && 'conversations' in response) {
        apiConversations = (response as any).conversations || [];
      }

      // publicName/avatarUrl = business name + logo for vendors (backend #300); older backends fall back
      const mapped: Conversation[] = apiConversations.map((conv: any) => {
        const otherP = conv.otherParticipant || {};
        return {
          id: conv.id,
          participantId: otherP.id || "",
          participantName: otherP.publicName || otherP.displayName || otherP.name || otherP.username || "Unknown",
          participantAvatar: otherP.avatarUrl || otherP.avatar || otherP.profileImageUrl || undefined,
          participantType: (otherP.type as "business" | "photographer" | "consumer") || "consumer",
          lastMessage: conv.lastMessagePreview || conv.lastMessage || "",
          lastMessageAt: conv.lastMessageAt || conv.updatedAt || conv.createdAt || "",
          unreadCount: conv.unreadCount || 0,
          username: otherP.username ?? null,
          businessId: otherP.businessId ?? null,
          photographerId: otherP.photographerId ?? null,
        };
      });

      setConversations(mapped);
    } catch (err: any) {
      console.warn("[MessagingContext] Failed to load conversations:", err?.status, err?.message);
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
      const response: any = await api.getMessages(conversationId, token);
      const apiMessages: ApiMessage[] = Array.isArray(response) ? response : response?.messages || [];
      return apiMessages.map(mapApiMessage);
    } catch (err: any) {
      console.error("Failed to fetch messages:", err);
      if (err?.status === 404) {
        return [];
      }
      throw err;
    }
  }, [getToken]);

  // Called by ChatScreen after its own send so the inbox row updates without a reload.
  const noteMessageSent = useCallback((conversationId: string, preview: string, at?: string) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, lastMessage: preview, lastMessageAt: at || new Date().toISOString() }
        : conv
    ));
  }, []);

  const sendMessage = useCallback(async (conversationId: string, content: string, mediaItems: string[] = []): Promise<Message | null> => {
    try {
      const token = await getToken();
      const apiMessage = await api.sendMessage(conversationId, content, token, mediaItems);
      noteMessageSent(conversationId, previewFor(content, mediaItems), apiMessage.createdAt);
      return mapApiMessage(apiMessage);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      return null;
    }
  }, [getToken, noteMessageSent]);

  // A message push arrived (app open): refresh the inbox + unread badge.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    return onMessagePush(() => {
      refreshConversations();
    });
  }, [isAuthenticated, user, refreshConversations]);

  const createOrGetConversation = useCallback(async (data: CreateConversationRequest): Promise<Conversation | null> => {
    try {
      const token = await getToken();
      const apiConversation = await api.createOrGetConversation(data, token);
      const conversation = mapApiConversation(apiConversation);
      if (!conversation.id) {
        console.warn("[MessagingContext] createOrGetConversation: no conversation id in response");
        return null;
      }
      
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
    // Runs on every chat poll: keep the same array when nothing changes (no re-render).
    setConversations(prev =>
      prev.some(conv => conv.id === conversationId && conv.unreadCount > 0)
        ? prev.map(conv => conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv)
        : prev
    );
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
        noteMessageSent,
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

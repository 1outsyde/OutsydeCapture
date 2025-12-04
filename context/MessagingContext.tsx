import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Message, Conversation, Photographer } from "@/types";
import { useAuth } from "./AuthContext";

interface MessagingContextType {
  conversations: Conversation[];
  isLoading: boolean;
  getConversation: (id: string) => Conversation | undefined;
  getConversationWithPhotographer: (photographerId: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  sendMessage: (conversationId: string, content: string) => Promise<Message>;
  startConversation: (photographer: Photographer, sessionId?: string) => Promise<Conversation>;
  markAsRead: (conversationId: string) => Promise<void>;
  getTotalUnreadCount: () => number;
  refreshConversations: () => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

const CONVERSATIONS_STORAGE_KEY = "@outsyde_conversations";
const MESSAGES_STORAGE_KEY = "@outsyde_messages";

const SAMPLE_MESSAGES: { [conversationId: string]: Message[] } = {};

function generateMockConversations(userId: string, userName: string): Conversation[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  return [
    {
      id: "conv_1",
      participantIds: [userId, "p2"],
      photographerId: "p2",
      photographerName: "Marcus Chen",
      photographerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      clientId: userId,
      clientName: userName,
      sessionId: "mock_session_1",
      lastMessage: {
        id: "msg_1_3",
        conversationId: "conv_1",
        senderId: "p2",
        senderName: "Marcus Chen",
        content: "Your edited photos are ready! Check the gallery in your session details.",
        timestamp: yesterday.toISOString(),
        isRead: false,
      },
      unreadCount: 1,
      createdAt: lastWeek.toISOString(),
      updatedAt: yesterday.toISOString(),
    },
    {
      id: "conv_2",
      participantIds: [userId, "p1"],
      photographerId: "p1",
      photographerName: "Sarah Mitchell",
      photographerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      clientId: userId,
      clientName: userName,
      sessionId: "mock_session_2",
      lastMessage: {
        id: "msg_2_2",
        conversationId: "conv_2",
        senderId: userId,
        senderName: userName,
        content: "Thank you so much! The photos turned out amazing.",
        timestamp: lastWeek.toISOString(),
        isRead: true,
      },
      unreadCount: 0,
      createdAt: lastWeek.toISOString(),
      updatedAt: lastWeek.toISOString(),
    },
  ];
}

function generateMockMessages(userId: string, userName: string): { [conversationId: string]: Message[] } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  return {
    conv_1: [
      {
        id: "msg_1_1",
        conversationId: "conv_1",
        senderId: userId,
        senderName: userName,
        content: "Hi Marcus! Looking forward to our session at Griffith Observatory.",
        timestamp: twoDaysAgo.toISOString(),
        isRead: true,
      },
      {
        id: "msg_1_2",
        conversationId: "conv_1",
        senderId: "p2",
        senderName: "Marcus Chen",
        content: "Hello! I'm excited too. The golden hour light there is incredible. I'll bring my 85mm lens for those stunning city backdrop shots.",
        timestamp: twoDaysAgo.toISOString(),
        isRead: true,
      },
      {
        id: "msg_1_3",
        conversationId: "conv_1",
        senderId: "p2",
        senderName: "Marcus Chen",
        content: "Your edited photos are ready! Check the gallery in your session details.",
        timestamp: yesterday.toISOString(),
        isRead: false,
      },
    ],
    conv_2: [
      {
        id: "msg_2_1",
        conversationId: "conv_2",
        senderId: "p1",
        senderName: "Sarah Mitchell",
        content: "Thank you for choosing me for your portrait session! I've uploaded all the edited photos to your gallery.",
        timestamp: lastWeek.toISOString(),
        isRead: true,
      },
      {
        id: "msg_2_2",
        conversationId: "conv_2",
        senderId: userId,
        senderName: userName,
        content: "Thank you so much! The photos turned out amazing.",
        timestamp: lastWeek.toISOString(),
        isRead: true,
      },
    ],
  };
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setConversations([]);
      setMessages({});
      setIsLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const storedConvs = await AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      const storedMsgs = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
      
      let userConversations: Conversation[] = [];
      let userMessages: { [conversationId: string]: Message[] } = {};
      
      if (storedConvs) {
        const allConvs: Conversation[] = JSON.parse(storedConvs);
        userConversations = allConvs.filter(c => c.clientId === user.id);
      }
      
      if (storedMsgs) {
        userMessages = JSON.parse(storedMsgs);
      }
      
      const mockConversations = generateMockConversations(user.id, user.name);
      const mockMessages = generateMockMessages(user.id, user.name);
      
      const existingConvIds = userConversations.map(c => c.id);
      const newMockConvs = mockConversations.filter(c => !existingConvIds.includes(c.id));
      
      const combinedConversations = [...userConversations, ...newMockConvs];
      const combinedMessages = { ...mockMessages, ...userMessages };
      
      setConversations(combinedConversations);
      setMessages(combinedMessages);
    } catch (error) {
      console.error("Failed to load messaging data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConversations = async () => {
    await loadData();
  };

  const getConversation = (id: string) => {
    return conversations.find(c => c.id === id);
  };

  const getConversationWithPhotographer = (photographerId: string) => {
    return conversations.find(c => c.photographerId === photographerId);
  };

  const getMessages = (conversationId: string) => {
    return messages[conversationId] || [];
  };

  const sendMessage = async (conversationId: string, content: string): Promise<Message> => {
    if (!user) throw new Error("User not authenticated");

    const newMessage: Message = {
      id: "msg_" + Date.now(),
      conversationId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
    };

    const conversationMessages = messages[conversationId] || [];
    const updatedMessages = {
      ...messages,
      [conversationId]: [...conversationMessages, newMessage],
    };
    setMessages(updatedMessages);

    const updatedConversations = conversations.map(c =>
      c.id === conversationId
        ? { ...c, lastMessage: newMessage, updatedAt: newMessage.timestamp }
        : c
    );
    setConversations(updatedConversations);

    await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updatedMessages));
    await AsyncStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(updatedConversations));

    setTimeout(() => {
      simulatePhotographerReply(conversationId, content);
    }, 2000 + Math.random() * 3000);

    return newMessage;
  };

  const simulatePhotographerReply = async (conversationId: string, userMessage: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    const replies = [
      "Thanks for your message! I'll get back to you shortly.",
      "Great question! Let me check on that for you.",
      "Absolutely! I can definitely accommodate that.",
      "That sounds perfect. Looking forward to working with you!",
      "Thanks for reaching out! I'm available to discuss this further.",
    ];

    const reply: Message = {
      id: "msg_" + Date.now(),
      conversationId,
      senderId: conversation.photographerId,
      senderName: conversation.photographerName,
      senderAvatar: conversation.photographerAvatar,
      content: replies[Math.floor(Math.random() * replies.length)],
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), reply],
    }));

    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, lastMessage: reply, unreadCount: c.unreadCount + 1, updatedAt: reply.timestamp }
          : c
      )
    );
  };

  const startConversation = async (photographer: Photographer, sessionId?: string): Promise<Conversation> => {
    if (!user) throw new Error("User not authenticated");

    const existing = conversations.find(c => c.photographerId === photographer.id);
    if (existing) return existing;

    const newConversation: Conversation = {
      id: "conv_" + Date.now(),
      participantIds: [user.id, photographer.id],
      photographerId: photographer.id,
      photographerName: photographer.name,
      photographerAvatar: photographer.avatar,
      clientId: user.id,
      clientName: user.name,
      sessionId,
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedConversations = [...conversations, newConversation];
    setConversations(updatedConversations);

    await AsyncStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(updatedConversations));

    return newConversation;
  };

  const markAsRead = async (conversationId: string) => {
    const conversationMessages = messages[conversationId] || [];
    const updatedMessages = conversationMessages.map(m => ({ ...m, isRead: true }));
    
    setMessages(prev => ({
      ...prev,
      [conversationId]: updatedMessages,
    }));

    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );

    await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify({
      ...messages,
      [conversationId]: updatedMessages,
    }));
    await AsyncStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(
      conversations.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
    ));
  };

  const getTotalUnreadCount = () => {
    return conversations.reduce((total, c) => total + c.unreadCount, 0);
  };

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        isLoading,
        getConversation,
        getConversationWithPhotographer,
        getMessages,
        sendMessage,
        startConversation,
        markAsRead,
        getTotalUnreadCount,
        refreshConversations,
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

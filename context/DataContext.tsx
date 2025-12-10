import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { fetchPhotographers } from "@/api/photographers";

export type PhotographyCategory = "portrait" | "wedding" | "events" | "product" | "nature" | "fashion";

export interface Photographer {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  specialty: PhotographyCategory;
  location: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  bio: string;
  portfolio: string[];
  availability: string[];
  featured?: boolean;
  subscriptionTier?: "basic" | "pro" | "premium";
  isApproved?: boolean;
}

export interface Session {
  id: string;
  photographerId: string;
  photographerName: string;
  photographerAvatar: string;
  date: string;
  time: string;
  location: string;
  sessionType: string;
  status: "upcoming" | "completed" | "cancelled";
  price: number;
  notes?: string;
  photos?: string[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

export type PostType = "photographer" | "vendor";

export interface Post {
  id: string;
  type: PostType;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  rating: number;
  reviewCount: number;
  image: string;
  caption: string;
  likes: number;
  isLiked: boolean;
  comments: Comment[];
  createdAt: string;
  // Vendor-specific fields
  productName?: string;
  productPrice?: number;
  // For backwards compatibility
  photographerId?: string;
  photographerName?: string;
  photographerAvatar?: string;
}

interface DataContextType {
  photographers: Photographer[];
  sessions: Session[];
  posts: Post[];
  isLoading: boolean;
  error: string | null;
  refreshPhotographers: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  addSession: (session: Omit<Session, "id">) => Promise<Session>;
  getPhotographer: (id: string) => Photographer | undefined;
  getUpcomingSessions: () => Session[];
  getPastSessions: () => Session[];
  likePost: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MOCK_PHOTOGRAPHERS: Photographer[] = [
  {
    id: "p1",
    name: "Sarah Mitchell",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    specialty: "portrait",
    location: "New York, NY",
    rating: 4.9,
    reviewCount: 127,
    priceRange: "$150-300/hr",
    bio: "Award-winning portrait photographer with 10+ years of experience capturing authentic moments and emotions.",
    portfolio: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800",
    ],
    availability: ["2025-01-15", "2025-01-16", "2025-01-17", "2025-01-20"],
    featured: true,
    subscriptionTier: "premium",
    isApproved: true,
  },
  {
    id: "p2",
    name: "James Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    specialty: "wedding",
    location: "Los Angeles, CA",
    rating: 4.8,
    reviewCount: 89,
    priceRange: "$200-500/hr",
    bio: "Specializing in capturing the magic of your special day with a blend of candid and artistic styles.",
    portfolio: [
      "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800",
      "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800",
    ],
    availability: ["2025-01-18", "2025-01-19", "2025-01-22", "2025-01-25"],
    featured: true,
    subscriptionTier: "pro",
    isApproved: true,
  },
  {
    id: "p3",
    name: "Emma Rodriguez",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
    specialty: "events",
    location: "Chicago, IL",
    rating: 4.7,
    reviewCount: 64,
    priceRange: "$100-250/hr",
    bio: "Corporate and social event photographer bringing energy and professionalism to every occasion.",
    portfolio: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800",
      "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800",
    ],
    availability: ["2025-01-14", "2025-01-15", "2025-01-21"],
    subscriptionTier: "basic",
    isApproved: true,
  },
  {
    id: "p4",
    name: "Marcus Johnson",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
    specialty: "product",
    location: "Miami, FL",
    rating: 4.9,
    reviewCount: 156,
    priceRange: "$175-400/hr",
    bio: "E-commerce and product photography specialist helping brands shine with stunning visuals.",
    portfolio: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
      "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    ],
    availability: ["2025-01-16", "2025-01-17", "2025-01-23", "2025-01-24"],
    featured: true,
    subscriptionTier: "premium",
    isApproved: true,
  },
  {
    id: "p5",
    name: "Olivia Park",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
    specialty: "fashion",
    location: "San Francisco, CA",
    rating: 4.8,
    reviewCount: 98,
    priceRange: "$250-600/hr",
    bio: "Fashion and editorial photographer working with top brands and magazines worldwide.",
    portfolio: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800",
    ],
    availability: ["2025-01-19", "2025-01-20", "2025-01-26"],
    subscriptionTier: "pro",
    isApproved: true,
  },
];

const getSessionsKey = (userId: string) => `@outsyde_sessions_${userId}`;

const MOCK_POSTS: Post[] = [
  {
    id: "post1",
    type: "photographer",
    authorId: "p1",
    authorName: "Sarah Mitchell",
    authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    photographerId: "p1",
    photographerName: "Sarah Mitchell",
    photographerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    subscriptionTier: "premium",
    rating: 4.9,
    reviewCount: 127,
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800",
    caption: "Just wrapped up an amazing portrait session in Central Park! The golden hour light was absolutely perfect today.",
    likes: 47,
    isLiked: false,
    comments: [
      { id: "c1", userId: "u1", userName: "Emily Rose", userAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100", text: "Stunning work as always!", createdAt: "2025-01-10T14:30:00Z" },
      { id: "c2", userId: "u2", userName: "Mike Chen", userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", text: "Love the lighting!", createdAt: "2025-01-10T15:00:00Z" },
    ],
    createdAt: "2025-01-10T12:00:00Z",
  },
  {
    id: "post6",
    type: "vendor",
    authorId: "v1",
    authorName: "PrintMaster Studio",
    authorAvatar: "https://images.unsplash.com/photo-1560264280-88b68371db39?w=200",
    subscriptionTier: "premium",
    rating: 4.8,
    reviewCount: 342,
    image: "https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=800",
    caption: "New arrival! Premium gallery-quality canvas prints now available. Perfect for showcasing your favorite photos.",
    productName: "Gallery Canvas Print 24x36",
    productPrice: 149.99,
    likes: 78,
    isLiked: false,
    comments: [
      { id: "c6", userId: "u6", userName: "Photo Lover", userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", text: "Just ordered one, can't wait!", createdAt: "2025-01-10T11:00:00Z" },
    ],
    createdAt: "2025-01-10T10:00:00Z",
  },
  {
    id: "post2",
    type: "photographer",
    authorId: "p2",
    authorName: "James Chen",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    photographerId: "p2",
    photographerName: "James Chen",
    photographerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    subscriptionTier: "pro",
    rating: 4.8,
    reviewCount: 89,
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
    caption: "Behind the scenes from Saturday's wedding. Such an emotional and beautiful ceremony!",
    likes: 89,
    isLiked: false,
    comments: [
      { id: "c3", userId: "u3", userName: "Lisa Wang", userAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100", text: "This is gorgeous!", createdAt: "2025-01-09T18:00:00Z" },
    ],
    createdAt: "2025-01-09T16:00:00Z",
  },
  {
    id: "post7",
    type: "vendor",
    authorId: "v2",
    authorName: "MemoryBook Co",
    authorAvatar: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=200",
    subscriptionTier: "pro",
    rating: 4.7,
    reviewCount: 218,
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800",
    caption: "Create lasting memories with our handcrafted leather photo albums. Each page tells a story.",
    productName: "Leather Photo Album - 50 Pages",
    productPrice: 89.99,
    likes: 112,
    isLiked: false,
    comments: [],
    createdAt: "2025-01-09T14:00:00Z",
  },
  {
    id: "post3",
    type: "photographer",
    authorId: "p4",
    authorName: "Marcus Johnson",
    authorAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
    photographerId: "p4",
    photographerName: "Marcus Johnson",
    photographerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
    subscriptionTier: "premium",
    rating: 4.9,
    reviewCount: 156,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
    caption: "New product shoot for a luxury watch brand. Clean, minimal, timeless.",
    likes: 156,
    isLiked: false,
    comments: [],
    createdAt: "2025-01-08T10:00:00Z",
  },
  {
    id: "post8",
    type: "vendor",
    authorId: "v3",
    authorName: "LensCraft Gear",
    authorAvatar: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200",
    subscriptionTier: "basic",
    rating: 4.5,
    reviewCount: 87,
    image: "https://images.unsplash.com/photo-1606986628253-e0f5f7e6c1fa?w=800",
    caption: "Professional camera straps designed for comfort during long shoots. Free shipping this week!",
    productName: "Pro Camera Strap - Leather",
    productPrice: 45.00,
    likes: 34,
    isLiked: false,
    comments: [
      { id: "c7", userId: "u7", userName: "Photographer Mike", userAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100", text: "Best strap I've ever used!", createdAt: "2025-01-08T08:00:00Z" },
    ],
    createdAt: "2025-01-08T06:00:00Z",
  },
  {
    id: "post4",
    type: "photographer",
    authorId: "p5",
    authorName: "Olivia Park",
    authorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
    photographerId: "p5",
    photographerName: "Olivia Park",
    photographerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
    subscriptionTier: "pro",
    rating: 4.8,
    reviewCount: 98,
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800",
    caption: "Editorial shoot for Vogue Italia. Dreams do come true!",
    likes: 234,
    isLiked: false,
    comments: [
      { id: "c4", userId: "u4", userName: "Alex Kim", userAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100", text: "Congratulations! Well deserved!", createdAt: "2025-01-07T20:00:00Z" },
      { id: "c5", userId: "u5", userName: "Jordan Lee", userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", text: "Incredible achievement!", createdAt: "2025-01-07T21:00:00Z" },
    ],
    createdAt: "2025-01-07T14:00:00Z",
  },
  {
    id: "post9",
    type: "vendor",
    authorId: "v4",
    authorName: "FrameArt Gallery",
    authorAvatar: "https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=200",
    subscriptionTier: "premium",
    rating: 4.9,
    reviewCount: 176,
    image: "https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?w=800",
    caption: "Handmade wooden frames crafted from sustainable oak. Display your art with elegance.",
    productName: "Oak Wood Frame Set (3 pieces)",
    productPrice: 129.00,
    likes: 67,
    isLiked: false,
    comments: [],
    createdAt: "2025-01-07T10:00:00Z",
  },
  {
    id: "post5",
    type: "photographer",
    authorId: "p3",
    authorName: "Emma Rodriguez",
    authorAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
    photographerId: "p3",
    photographerName: "Emma Rodriguez",
    photographerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
    subscriptionTier: "basic",
    rating: 4.7,
    reviewCount: 64,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
    caption: "Corporate event photography at its finest. Over 500 guests and every moment captured!",
    likes: 42,
    isLiked: false,
    comments: [],
    createdAt: "2025-01-06T09:00:00Z",
  },
  {
    id: "post10",
    type: "vendor",
    authorId: "v5",
    authorName: "PhotoGear Pro",
    authorAvatar: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=200",
    subscriptionTier: "pro",
    rating: 4.6,
    reviewCount: 203,
    image: "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=800",
    caption: "Portable LED ring light - perfect for portraits and video calls. Battery powered for on-the-go!",
    productName: "Portable LED Ring Light 18\"",
    productPrice: 79.99,
    likes: 91,
    isLiked: false,
    comments: [
      { id: "c8", userId: "u8", userName: "Content Creator", userAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100", text: "This changed my content game!", createdAt: "2025-01-06T07:00:00Z" },
    ],
    createdAt: "2025-01-06T05:00:00Z",
  },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [photographers, setPhotographers] = useState<Photographer[]>(MOCK_PHOTOGRAPHERS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPhotographers(MOCK_PHOTOGRAPHERS);
      setSessions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [photographerRes, storedSessions] = await Promise.all([
        fetchPhotographers().catch(() => ({ photographers: [] })),
        AsyncStorage.getItem(getSessionsKey(user.id)),
      ]);

      const apiPhotographers = photographerRes?.photographers || photographerRes || [];
      if (Array.isArray(apiPhotographers) && apiPhotographers.length > 0) {
        setPhotographers(apiPhotographers);
      } else {
        setPhotographers(MOCK_PHOTOGRAPHERS);
      }

      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data");
      setPhotographers(MOCK_PHOTOGRAPHERS);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshPhotographers = async () => {
    try {
      const res = await fetchPhotographers();
      const apiPhotographers = res?.photographers || res || [];
      if (Array.isArray(apiPhotographers) && apiPhotographers.length > 0) {
        setPhotographers(apiPhotographers);
      }
    } catch (err) {
      console.error("Failed to refresh photographers:", err);
    }
  };

  const refreshSessions = async () => {
    if (!user) return;
    try {
      const stored = await AsyncStorage.getItem(getSessionsKey(user.id));
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to refresh sessions:", err);
    }
  };

  const addSession = async (sessionData: Omit<Session, "id">): Promise<Session> => {
    if (!user) throw new Error("Must be logged in to book sessions");

    const newSession: Session = {
      ...sessionData,
      id: "session_" + Date.now(),
    };

    const updatedSessions = [...sessions, newSession];
    await AsyncStorage.setItem(getSessionsKey(user.id), JSON.stringify(updatedSessions));
    setSessions(updatedSessions);
    return newSession;
  };

  const getPhotographer = (id: string) => photographers.find((p) => p.id === id);

  const getUpcomingSessions = () =>
    sessions.filter((s) => s.status === "upcoming").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getPastSessions = () =>
    sessions.filter((s) => s.status === "completed" || s.status === "cancelled").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const likePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
          : post
      )
    );
  };

  const addComment = (postId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      userId: user?.id || "guest",
      userName: user?.name || "Guest User",
      userAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, comments: [...post.comments, newComment] } : post
      )
    );
  };

  return (
    <DataContext.Provider
      value={{
        photographers,
        sessions,
        posts,
        isLoading,
        error,
        refreshPhotographers,
        refreshSessions,
        addSession,
        getPhotographer,
        getUpcomingSessions,
        getPastSessions,
        likePost,
        addComment,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

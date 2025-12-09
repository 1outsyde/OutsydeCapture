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

interface DataContextType {
  photographers: Photographer[];
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  refreshPhotographers: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  addSession: (session: Omit<Session, "id">) => Promise<Session>;
  getPhotographer: (id: string) => Photographer | undefined;
  getUpcomingSessions: () => Session[];
  getPastSessions: () => Session[];
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

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [photographers, setPhotographers] = useState<Photographer[]>(MOCK_PHOTOGRAPHERS);
  const [sessions, setSessions] = useState<Session[]>([]);
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

  return (
    <DataContext.Provider
      value={{
        photographers,
        sessions,
        isLoading,
        error,
        refreshPhotographers,
        refreshSessions,
        addSession,
        getPhotographer,
        getUpcomingSessions,
        getPastSessions,
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

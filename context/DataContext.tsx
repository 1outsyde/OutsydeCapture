import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Photographer, Session, PhotographyCategory, BookingFormData, SessionPhoto } from "@/types";
import { useAuth } from "./AuthContext";

interface DataContextType {
  photographers: Photographer[];
  sessions: Session[];
  isLoading: boolean;
  refreshPhotographers: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  getPhotographer: (id: string) => Photographer | undefined;
  createSession: (booking: BookingFormData, photographer: Photographer, timeSlot: { startTime: string; endTime: string }) => Promise<Session>;
  cancelSession: (sessionId: string) => Promise<void>;
  getUpcomingSessions: () => Session[];
  getPastSessions: () => Session[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const SESSIONS_STORAGE_KEY = "@outsyde_sessions";

const SAMPLE_PHOTOS: SessionPhoto[] = [
  {
    id: "photo_1",
    url: "https://images.unsplash.com/photo-1529636798458-92182e662485?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1529636798458-92182e662485?w=400",
    caption: "Golden hour portrait",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_2",
    url: "https://images.unsplash.com/photo-1516641051054-9df6a1aad654?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1516641051054-9df6a1aad654?w=400",
    caption: "Natural lighting",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_3",
    url: "https://images.unsplash.com/photo-1511551203524-9a24350a5771?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1511551203524-9a24350a5771?w=400",
    caption: "Candid moment",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_4",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    caption: "Close-up shot",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_5",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_6",
    url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400",
    caption: "Urban backdrop",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_7",
    url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400",
    caption: "Final edited shot",
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "photo_8",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200",
    thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    caption: "Professional headshot",
    uploadedAt: new Date().toISOString(),
  },
];

function generateMockPastSessions(userId: string, userName: string): Session[] {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);
  const pastDateStr = pastDate.toISOString().split("T")[0];
  
  const pastDate2 = new Date();
  pastDate2.setDate(pastDate2.getDate() - 21);
  const pastDate2Str = pastDate2.toISOString().split("T")[0];

  return [
    {
      id: "mock_session_1",
      photographerId: "p2",
      photographerName: "Marcus Chen",
      photographerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      clientId: userId,
      clientName: userName,
      date: pastDateStr,
      startTime: "10:00",
      endTime: "11:00",
      location: "Griffith Observatory, Los Angeles",
      sessionType: "portrait",
      notes: "Outdoor portrait session with city views",
      status: "completed",
      totalPrice: 300,
      createdAt: pastDate.toISOString(),
      photos: SAMPLE_PHOTOS.slice(0, 8),
    },
    {
      id: "mock_session_2",
      photographerId: "p1",
      photographerName: "Sarah Mitchell",
      photographerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      clientId: userId,
      clientName: userName,
      date: pastDate2Str,
      startTime: "14:00",
      endTime: "15:00",
      location: "Golden Gate Park, San Francisco",
      sessionType: "portrait",
      status: "completed",
      totalPrice: 500,
      createdAt: pastDate2.toISOString(),
      photos: SAMPLE_PHOTOS.slice(2, 6),
    },
  ];
}

const MOCK_PHOTOGRAPHERS: Photographer[] = [
  {
    id: "p1",
    name: "Sarah Mitchell",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
    specialty: "wedding",
    rating: 4.9,
    reviewCount: 127,
    priceRange: "$$$",
    location: "San Francisco, CA",
    bio: "Award-winning wedding photographer with 10+ years of experience capturing your special moments.",
    portfolio: [
      "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800",
      "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800",
    ],
    availability: generateAvailability(),
    featured: true,
  },
  {
    id: "p2",
    name: "Marcus Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
    specialty: "portrait",
    rating: 4.8,
    reviewCount: 89,
    priceRange: "$$",
    location: "Los Angeles, CA",
    bio: "Creative portrait photographer specializing in natural light and candid moments.",
    portfolio: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800",
    ],
    availability: generateAvailability(),
    featured: true,
  },
  {
    id: "p3",
    name: "Elena Rodriguez",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
    specialty: "events",
    rating: 4.7,
    reviewCount: 156,
    priceRange: "$$",
    location: "Miami, FL",
    bio: "Dynamic event photographer bringing energy and creativity to every occasion.",
    portfolio: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800",
    ],
    availability: generateAvailability(),
    featured: false,
  },
  {
    id: "p4",
    name: "James Walker",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
    specialty: "product",
    rating: 4.9,
    reviewCount: 203,
    priceRange: "$$$",
    location: "New York, NY",
    bio: "Commercial product photographer with expertise in e-commerce and brand photography.",
    portfolio: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    ],
    availability: generateAvailability(),
    featured: true,
  },
  {
    id: "p5",
    name: "Lily Thompson",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    specialty: "nature",
    rating: 4.8,
    reviewCount: 78,
    priceRange: "$$$$",
    location: "Denver, CO",
    bio: "Nature and landscape photographer capturing the beauty of the outdoors.",
    portfolio: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
    ],
    availability: generateAvailability(),
    featured: false,
  },
  {
    id: "p6",
    name: "David Kim",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
    specialty: "fashion",
    rating: 4.6,
    reviewCount: 112,
    priceRange: "$$$$",
    location: "Seattle, WA",
    bio: "High-fashion photographer with editorial experience for major publications.",
    portfolio: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800",
    ],
    availability: generateAvailability(),
    featured: false,
  },
  {
    id: "p7",
    name: "Amanda Foster",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400",
    specialty: "wedding",
    rating: 4.7,
    reviewCount: 94,
    priceRange: "$$",
    location: "Chicago, IL",
    bio: "Romantic wedding photographer focused on timeless, elegant imagery.",
    portfolio: [
      "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800",
      "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=800",
      "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800",
    ],
    availability: generateAvailability(),
    featured: false,
  },
  {
    id: "p8",
    name: "Robert Hayes",
    avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400",
    specialty: "portrait",
    rating: 4.5,
    reviewCount: 67,
    priceRange: "$",
    location: "Austin, TX",
    bio: "Affordable portrait photography for families, graduates, and professionals.",
    portfolio: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800",
    ],
    availability: generateAvailability(),
    featured: false,
  },
];

function generateAvailability() {
  const availability = [];
  const today = new Date();
  
  for (let i = 1; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    if (Math.random() > 0.3) {
      const timeSlots = [];
      const hours = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];
      
      for (const hour of hours) {
        if (Math.random() > 0.4) {
          const [h, m] = hour.split(":").map(Number);
          const endHour = h + 1;
          timeSlots.push({
            id: `slot_${date.toISOString().split("T")[0]}_${hour}`,
            startTime: hour,
            endTime: `${endHour.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
            available: true,
          });
        }
      }
      
      if (timeSlots.length > 0) {
        availability.push({
          date: date.toISOString().split("T")[0],
          timeSlots,
        });
      }
    }
  }
  
  return availability;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [photographers] = useState<Photographer[]>(MOCK_PHOTOGRAPHERS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSessions();
    } else {
      setSessions([]);
      setIsLoading(false);
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      let userSessions: Session[] = [];
      
      if (stored) {
        const allSessions: Session[] = JSON.parse(stored);
        userSessions = allSessions.filter(s => s.clientId === user.id);
      }
      
      const mockPastSessions = generateMockPastSessions(user.id, user.name);
      const existingMockIds = userSessions.map(s => s.id);
      const newMockSessions = mockPastSessions.filter(s => !existingMockIds.includes(s.id));
      
      const combinedSessions = [...userSessions, ...newMockSessions];
      setSessions(combinedSessions);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPhotographers = async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  const refreshSessions = async () => {
    await loadSessions();
  };

  const getPhotographer = (id: string) => {
    return photographers.find(p => p.id === id);
  };

  const createSession = async (
    booking: BookingFormData,
    photographer: Photographer,
    timeSlot: { startTime: string; endTime: string }
  ): Promise<Session> => {
    if (!user) throw new Error("User not authenticated");

    const newSession: Session = {
      id: "session_" + Date.now(),
      photographerId: photographer.id,
      photographerName: photographer.name,
      photographerAvatar: photographer.avatar,
      clientId: user.id,
      clientName: user.name,
      date: booking.date,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      location: booking.location,
      sessionType: booking.sessionType,
      notes: booking.notes,
      status: "confirmed",
      totalPrice: getPriceForRange(photographer.priceRange),
      createdAt: new Date().toISOString(),
    };

    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);

    const stored = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
    const allSessions: Session[] = stored ? JSON.parse(stored) : [];
    allSessions.push(newSession);
    await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(allSessions));

    return newSession;
  };

  const cancelSession = async (sessionId: string) => {
    const updatedSessions = sessions.map(s =>
      s.id === sessionId ? { ...s, status: "cancelled" as const } : s
    );
    setSessions(updatedSessions);

    const stored = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
    if (stored) {
      const allSessions: Session[] = JSON.parse(stored);
      const updated = allSessions.map(s =>
        s.id === sessionId ? { ...s, status: "cancelled" as const } : s
      );
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const getUpcomingSessions = () => {
    const now = new Date();
    return sessions
      .filter(s => {
        const sessionDate = new Date(s.date + "T" + s.startTime);
        return sessionDate >= now && s.status !== "cancelled";
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getPastSessions = () => {
    const now = new Date();
    return sessions
      .filter(s => {
        const sessionDate = new Date(s.date + "T" + s.endTime);
        return sessionDate < now || s.status === "cancelled";
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <DataContext.Provider
      value={{
        photographers,
        sessions,
        isLoading,
        refreshPhotographers,
        refreshSessions,
        getPhotographer,
        createSession,
        cancelSession,
        getUpcomingSessions,
        getPastSessions,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

function getPriceForRange(range: string): number {
  switch (range) {
    case "$": return 150;
    case "$$": return 300;
    case "$$$": return 500;
    case "$$$$": return 800;
    default: return 250;
  }
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

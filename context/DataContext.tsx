import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { useAuth } from "./AuthContext";
import { fetchPhotographers } from "@/api/photographers";
import api from "@/services/api";

export type PhotographyCategory = "portrait" | "wedding" | "events" | "product" | "nature" | "fashion";

export type BusinessType = "food" | "fashion" | "services" | "beauty" | "art" | "health" | "events" | "retail" | "professional";

export interface Business {
  id: string;
  name: string;
  avatar: string;
  type: BusinessType;
  category: string;
  city: string;
  state: string;
  rating: number;
  priceRange: string;
  description: string;
  featured?: boolean;
  subscriptionTier?: "basic" | "pro" | "premium";
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  food: "Food & Dining",
  fashion: "Fashion & Apparel",
  services: "Home Services",
  beauty: "Beauty & Hair",
  art: "Art & Design",
  health: "Health & Wellness",
  events: "Events & Entertainment",
  retail: "Retail & Shopping",
  professional: "Professional Services",
};

export const BUSINESS_TYPE_ICONS: Record<BusinessType, string> = {
  food: "coffee",
  fashion: "shopping-bag",
  services: "briefcase",
  beauty: "scissors",
  art: "edit-3",
  health: "heart",
  events: "calendar",
  retail: "shopping-cart",
  professional: "user",
};

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
  endTime?: string;
  location: string;
  sessionType: string;
  status: "upcoming" | "completed" | "cancelled";
  price: number;
  notes?: string;
  photos?: string[];
  calendarEventId?: string;
  calendarSynced?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

export type PostType = "photographer" | "vendor" | "user";

export interface Post {
  id: string;
  type: PostType;
  // Canonical identity fields (userId is source of truth)
  userId: string;
  username?: string;
  displayName: string;
  authorAvatar: string;
  // Legacy field - use userId instead
  authorId: string;
  authorName: string;
  // Post content
  subscriptionTier?: "basic" | "pro" | "premium";
  rating: number;
  reviewCount: number;
  image: string;
  videoUrl?: string;
  caption: string;
  likes: number;
  isLiked: boolean;
  comments: Comment[];
  createdAt: string;
  // Optional commerce context
  serviceId?: string;
  productId?: string;
  providerId?: string;
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
  businesses: Business[];
  isLoading: boolean;
  error: string | null;
  refreshPhotographers: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  addSession: (session: Omit<Session, "id">) => Promise<Session>;
  getPhotographer: (id: string) => Photographer | undefined;
  getUpcomingSessions: () => Session[];
  getPastSessions: () => Session[];
  hasCompletedSessionWith: (photographerId: string, photographerName?: string) => boolean;
  likePost: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
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
    userId: "user_p1",
    username: "sarahmitchell",
    displayName: "Sarah Mitchell",
    authorId: "p1",
    authorName: "Sarah Mitchell",
    authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    photographerId: "p1",
    photographerName: "Sarah Mitchell",
    photographerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
    providerId: "p1",
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
    userId: "user_v1",
    username: "printmasterstudio",
    displayName: "PrintMaster Studio",
    authorId: "v1",
    authorName: "PrintMaster Studio",
    authorAvatar: "https://images.unsplash.com/photo-1560264280-88b68371db39?w=200",
    providerId: "v1",
    productId: "prod_canvas_print",
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
    userId: "user_p2",
    username: "jameschen",
    displayName: "James Chen",
    authorId: "p2",
    authorName: "James Chen",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    photographerId: "p2",
    photographerName: "James Chen",
    photographerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    providerId: "p2",
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
    userId: "user_v2",
    username: "memorybookco",
    displayName: "MemoryBook Co",
    authorId: "v2",
    authorName: "MemoryBook Co",
    authorAvatar: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=200",
    providerId: "v2",
    productId: "prod_leather_album",
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
    userId: "user_p4",
    username: "marcusjohnson",
    displayName: "Marcus Johnson",
    authorId: "p4",
    authorName: "Marcus Johnson",
    authorAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
    photographerId: "p4",
    photographerName: "Marcus Johnson",
    photographerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
    providerId: "p4",
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
    userId: "user_v3",
    username: "lenscraftgear",
    displayName: "LensCraft Gear",
    authorId: "v3",
    authorName: "LensCraft Gear",
    authorAvatar: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200",
    providerId: "v3",
    productId: "prod_camera_strap",
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
    userId: "user_p5",
    username: "oliviapark",
    displayName: "Olivia Park",
    authorId: "p5",
    authorName: "Olivia Park",
    authorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
    photographerId: "p5",
    photographerName: "Olivia Park",
    photographerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
    providerId: "p5",
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
    userId: "user_v4",
    username: "frameartgallery",
    displayName: "FrameArt Gallery",
    authorId: "v4",
    authorName: "FrameArt Gallery",
    authorAvatar: "https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=200",
    providerId: "v4",
    productId: "prod_oak_frame",
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
    userId: "user_p3",
    username: "emmarodriguez",
    displayName: "Emma Rodriguez",
    authorId: "p3",
    authorName: "Emma Rodriguez",
    authorAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
    photographerId: "p3",
    photographerName: "Emma Rodriguez",
    photographerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200",
    providerId: "p3",
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
    userId: "user_v5",
    username: "photogearpro",
    displayName: "PhotoGear Pro",
    authorId: "v5",
    authorName: "PhotoGear Pro",
    authorAvatar: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=200",
    providerId: "v5",
    productId: "prod_ring_light",
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

const MOCK_BUSINESSES: Business[] = [
  // Food & Dining
  {
    id: "b7",
    name: "The Golden Fork",
    avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200",
    type: "food",
    category: "Fine Dining",
    city: "New York",
    state: "NY",
    rating: 4.8,
    priceRange: "$$$$",
    description: "Upscale American cuisine with a modern twist in Manhattan.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b8",
    name: "Bella Italia Trattoria",
    avatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200",
    type: "food",
    category: "Italian",
    city: "Chicago",
    state: "IL",
    rating: 4.6,
    priceRange: "$$$",
    description: "Authentic Italian dishes made with family recipes since 1985.",
    subscriptionTier: "pro",
  },
  {
    id: "b9",
    name: "Sakura Sushi House",
    avatar: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200",
    type: "food",
    category: "Japanese",
    city: "San Francisco",
    state: "CA",
    rating: 4.9,
    priceRange: "$$$",
    description: "Fresh sushi and traditional Japanese cuisine in the heart of SF.",
    subscriptionTier: "premium",
  },
  {
    id: "b10",
    name: "Sunrise Cafe",
    avatar: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200",
    type: "food",
    category: "Cafe",
    city: "Seattle",
    state: "WA",
    rating: 4.5,
    priceRange: "$$",
    description: "Cozy cafe with artisan coffee and fresh pastries.",
    subscriptionTier: "basic",
  },
  // Fashion & Clothes
  {
    id: "b11",
    name: "Luxe Boutique",
    avatar: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200",
    type: "fashion",
    category: "Designer",
    city: "New York",
    state: "NY",
    rating: 4.8,
    priceRange: "$$$$",
    description: "Curated designer fashion and accessories for the discerning shopper.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b12",
    name: "Urban Threads",
    avatar: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=200",
    type: "fashion",
    category: "Streetwear",
    city: "Los Angeles",
    state: "CA",
    rating: 4.6,
    priceRange: "$$",
    description: "Trendy streetwear and urban fashion for the modern youth.",
    subscriptionTier: "pro",
  },
  {
    id: "b13",
    name: "Vintage Finds",
    avatar: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200",
    type: "fashion",
    category: "Vintage",
    city: "Austin",
    state: "TX",
    rating: 4.7,
    priceRange: "$$",
    description: "Unique vintage clothing and accessories from the 60s to 90s.",
    subscriptionTier: "basic",
  },
  {
    id: "b14",
    name: "Bridal Dreams",
    avatar: "https://images.unsplash.com/photo-1519741497674-611481863552?w=200",
    type: "fashion",
    category: "Bridal",
    city: "Miami",
    state: "FL",
    rating: 4.9,
    priceRange: "$$$",
    description: "Exquisite wedding gowns and bridal accessories.",
    subscriptionTier: "premium",
  },
  // Local Services
  {
    id: "b15",
    name: "Elite Event Planning",
    avatar: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200",
    type: "services",
    category: "Event Planning",
    city: "New York",
    state: "NY",
    rating: 4.8,
    priceRange: "$$$",
    description: "Full-service event planning for weddings, corporate, and private events.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b16",
    name: "Green Thumb Florists",
    avatar: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=200",
    type: "services",
    category: "Florist",
    city: "Portland",
    state: "OR",
    rating: 4.7,
    priceRange: "$$",
    description: "Beautiful floral arrangements for all occasions.",
    subscriptionTier: "pro",
  },
  {
    id: "b17",
    name: "Melody Music DJ",
    avatar: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=200",
    type: "services",
    category: "DJ & Music",
    city: "Las Vegas",
    state: "NV",
    rating: 4.9,
    priceRange: "$$",
    description: "Professional DJ services for weddings, parties, and corporate events.",
    subscriptionTier: "pro",
  },
  {
    id: "b18",
    name: "Perfect Prints",
    avatar: "https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=200",
    type: "services",
    category: "Printing",
    city: "Denver",
    state: "CO",
    rating: 4.6,
    priceRange: "$$",
    description: "High-quality photo printing, canvas, and custom framing.",
    subscriptionTier: "basic",
  },
  {
    id: "b19",
    name: "Atlanta Event Planners",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200",
    type: "events",
    category: "Event Planning",
    city: "Atlanta",
    state: "GA",
    rating: 4.8,
    priceRange: "$500-2000",
    description: "Premier event planning in Atlanta covering weddings, corporate, and social events.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b20",
    name: "Southern Soul Kitchen",
    avatar: "https://images.unsplash.com/photo-1544025162-d76694265947?w=200",
    type: "food",
    category: "Southern Cuisine",
    city: "Atlanta",
    state: "GA",
    rating: 4.7,
    priceRange: "$$$",
    description: "Authentic Southern comfort food with a modern twist.",
    subscriptionTier: "pro",
  },
  {
    id: "b21",
    name: "Atlanta Video Productions",
    avatar: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=200",
    type: "professional",
    category: "Video Production",
    city: "Atlanta",
    state: "GA",
    rating: 4.9,
    priceRange: "$2500-8000",
    description: "Professional music video and commercial production in Atlanta.",
    subscriptionTier: "premium",
  },
  {
    id: "b22",
    name: "Richmond Art Gallery",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200",
    type: "art",
    category: "Art Gallery",
    city: "Richmond",
    state: "VA",
    rating: 4.7,
    priceRange: "$$",
    description: "Contemporary art gallery featuring local Virginia artists.",
    subscriptionTier: "pro",
  },
  {
    id: "b23",
    name: "Virginia Belle Boutique",
    avatar: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=200",
    type: "fashion",
    category: "Boutique",
    city: "Richmond",
    state: "VA",
    rating: 4.6,
    priceRange: "$$",
    description: "Curated Southern fashion and accessories for every occasion.",
    subscriptionTier: "basic",
  },
  {
    id: "b24",
    name: "Capital City Catering",
    avatar: "https://images.unsplash.com/photo-1555244162-803834f70033?w=200",
    type: "services",
    category: "Catering",
    city: "Richmond",
    state: "VA",
    rating: 4.8,
    priceRange: "$$$",
    description: "Full-service catering for weddings, corporate events, and private parties.",
    subscriptionTier: "pro",
  },
  {
    id: "b25",
    name: "Houston Design Studio",
    avatar: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=200",
    type: "professional",
    category: "Design Studio",
    city: "Houston",
    state: "TX",
    rating: 4.8,
    priceRange: "$200-450/hr",
    description: "Full-service design studio serving Houston businesses.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b26",
    name: "Space City Eats",
    avatar: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200",
    type: "food",
    category: "Tex-Mex",
    city: "Houston",
    state: "TX",
    rating: 4.7,
    priceRange: "$$",
    description: "Authentic Tex-Mex cuisine with fresh ingredients and bold flavors.",
    subscriptionTier: "pro",
  },
  {
    id: "b27",
    name: "Houston Style Co",
    avatar: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200",
    type: "fashion",
    category: "Urban Fashion",
    city: "Houston",
    state: "TX",
    rating: 4.6,
    priceRange: "$$$",
    description: "Contemporary urban fashion and streetwear for the modern Texan.",
    subscriptionTier: "basic",
  },
  // Beauty & Hair
  {
    id: "b28",
    name: "Glamour Hair Studio",
    avatar: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200",
    type: "beauty",
    category: "Hair Salon",
    city: "New York",
    state: "NY",
    rating: 4.9,
    priceRange: "$$$",
    description: "Award-winning hair stylists specializing in cuts, color, and styling.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b29",
    name: "The Barber Shop",
    avatar: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200",
    type: "beauty",
    category: "Barber",
    city: "Atlanta",
    state: "GA",
    rating: 4.8,
    priceRange: "$$",
    description: "Classic barbershop with modern cuts and traditional hot towel shaves.",
    subscriptionTier: "pro",
  },
  {
    id: "b30",
    name: "Nails by Nina",
    avatar: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=200",
    type: "beauty",
    category: "Nail Salon",
    city: "Miami",
    state: "FL",
    rating: 4.7,
    priceRange: "$$",
    description: "Luxury nail care, manicures, pedicures, and nail art designs.",
    subscriptionTier: "pro",
  },
  {
    id: "b31",
    name: "Glow Makeup Artistry",
    avatar: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=200",
    type: "beauty",
    category: "Makeup Artist",
    city: "Los Angeles",
    state: "CA",
    rating: 4.9,
    priceRange: "$$$",
    description: "Professional makeup for weddings, events, photoshoots, and film.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b32",
    name: "Braids & Beyond",
    avatar: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200",
    type: "beauty",
    category: "Braiding",
    city: "Houston",
    state: "TX",
    rating: 4.8,
    priceRange: "$$",
    description: "Expert braiding, locs, twists, and natural hair styling.",
    subscriptionTier: "pro",
  },
  {
    id: "b33",
    name: "Serenity Spa & Wellness",
    avatar: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200",
    type: "beauty",
    category: "Spa",
    city: "Chicago",
    state: "IL",
    rating: 4.8,
    priceRange: "$$$$",
    description: "Full-service spa with massages, facials, and body treatments.",
    subscriptionTier: "premium",
  },
  // Art & Design
  {
    id: "b34",
    name: "Canvas & Color Studio",
    avatar: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=200",
    type: "art",
    category: "Painter",
    city: "New York",
    state: "NY",
    rating: 4.9,
    priceRange: "$$$",
    description: "Custom portrait paintings and commissioned artwork for homes and businesses.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b35",
    name: "Urban Murals Co",
    avatar: "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=200",
    type: "art",
    category: "Muralist",
    city: "Atlanta",
    state: "GA",
    rating: 4.8,
    priceRange: "$$$$",
    description: "Large-scale mural art for businesses, homes, and public spaces.",
    subscriptionTier: "pro",
  },
  {
    id: "b36",
    name: "Digital Dreams Design",
    avatar: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200",
    type: "art",
    category: "Graphic Designer",
    city: "Los Angeles",
    state: "CA",
    rating: 4.7,
    priceRange: "$$",
    description: "Logo design, branding, and digital illustration for businesses.",
    subscriptionTier: "pro",
  },
  {
    id: "b37",
    name: "Ink Masters Tattoo",
    avatar: "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=200",
    type: "art",
    category: "Tattoo Artist",
    city: "Miami",
    state: "FL",
    rating: 4.9,
    priceRange: "$$$",
    description: "Custom tattoo designs from traditional to contemporary styles.",
    featured: true,
    subscriptionTier: "premium",
  },
  {
    id: "b38",
    name: "Pottery Lane",
    avatar: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=200",
    type: "art",
    category: "Ceramics",
    city: "Richmond",
    state: "VA",
    rating: 4.6,
    priceRange: "$$",
    description: "Handcrafted pottery, ceramics classes, and custom pieces.",
    subscriptionTier: "basic",
  },
  {
    id: "b39",
    name: "Sculpture Works",
    avatar: "https://images.unsplash.com/photo-1544531586-fde5298cdd40?w=200",
    type: "art",
    category: "Sculptor",
    city: "Chicago",
    state: "IL",
    rating: 4.8,
    priceRange: "$$$$",
    description: "Custom metal and stone sculptures for gardens and interiors.",
    subscriptionTier: "pro",
  },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getToken } = useAuth();
  const isGuest = user?.isGuest ?? false;
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === "info@goutsyde.com" || 
                  user?.email?.toLowerCase() === "jamesmeyers2304@gmail.com";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!isAuthenticated || !user) {
      if (isAdmin) {
        setPhotographers(MOCK_PHOTOGRAPHERS);
        setPosts(MOCK_POSTS);
        setBusinesses(MOCK_BUSINESSES);
      } else {
        setPhotographers([]);
        setPosts([]);
        setBusinesses([]);
      }
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      const [photographerRes, storedSessions] = await Promise.all([
        fetchPhotographers().catch(() => ({ photographers: [] })),
        AsyncStorage.getItem(getSessionsKey(user.id)),
      ]);

      const apiPhotographers = photographerRes?.photographers || photographerRes || [];
      if (Array.isArray(apiPhotographers) && apiPhotographers.length > 0) {
        setPhotographers(apiPhotographers);
      } else if (isAdmin) {
        setPhotographers(MOCK_PHOTOGRAPHERS);
      } else {
        setPhotographers([]);
      }

      if (isAdmin) {
        setPosts(MOCK_POSTS);
        setBusinesses(MOCK_BUSINESSES);
      } else {
        setPosts([]);
        setBusinesses([]);
      }

      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      } else {
        const mockCompletedSessions: Session[] = [
          {
            id: "demo_session_1",
            photographerId: "p1",
            photographerName: "Sarah Mitchell",
            photographerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
            date: "2024-12-15",
            time: "10:00 AM",
            location: "Central Park, New York",
            sessionType: "Portrait Session",
            status: "completed",
            price: 200,
            photos: [],
          },
          {
            id: "demo_session_2",
            photographerId: "p2",
            photographerName: "James Chen",
            photographerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
            date: "2024-12-10",
            time: "2:00 PM",
            location: "Malibu Beach, CA",
            sessionType: "Wedding Photos",
            status: "completed",
            price: 350,
            photos: [],
          },
        ];
        setSessions(mockCompletedSessions);
        await AsyncStorage.setItem(getSessionsKey(user.id), JSON.stringify(mockCompletedSessions));
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data");
      if (isAdmin) {
        setPhotographers(MOCK_PHOTOGRAPHERS);
        setPosts(MOCK_POSTS);
        setBusinesses(MOCK_BUSINESSES);
      } else {
        setPhotographers([]);
        setPosts([]);
        setBusinesses([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, isAdmin]);

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

  const hasCompletedSessionWith = useCallback((photographerId: string, photographerName?: string): boolean => {
    return sessions.some((session) => {
      if (session.status !== "completed") return false;
      if (session.photographerId === photographerId) return true;
      if (photographerName && session.photographerName.toLowerCase().includes(photographerName.toLowerCase())) return true;
      return false;
    });
  }, [sessions]);

  const likePost = useCallback(async (postId: string) => {
    // Check if user is authenticated
    if (!user || isGuest) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to like posts.",
        [{ text: "OK" }]
      );
      return;
    }

    // Find current post state
    const currentPost = posts.find(p => p.id === postId);
    if (!currentPost) return;

    const wasLiked = currentPost.isLiked;

    // Optimistically update UI
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
          : post
      )
    );

    try {
      const token = await getToken();
      if (!token) {
        // Revert if no token
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, isLiked: wasLiked, likes: wasLiked ? post.likes + 1 : post.likes - 1 }
              : post
          )
        );
        Alert.alert("Sign In Required", "Please sign in to like posts.");
        return;
      }

      if (wasLiked) {
        await api.unlikePost(token, postId);
      } else {
        await api.likePost(token, postId);
      }
    } catch (error: any) {
      console.error("Failed to like/unlike post:", error);
      // Revert on error
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, isLiked: wasLiked, likes: wasLiked ? post.likes + 1 : post.likes - 1 }
            : post
        )
      );
      Alert.alert("Error", "Failed to update like. Please try again.");
    }
  }, [user, isGuest, posts, getToken]);

  const addComment = useCallback(async (postId: string, text: string) => {
    if (!text.trim()) return;

    // Check if user is authenticated
    if (!user || isGuest) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to comment on posts.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign In Required", "Please sign in to comment on posts.");
        return;
      }

      // Call backend API to add comment
      const response = await api.addPostComment(token, postId, text.trim());
      
      // Create comment from response or build locally
      const newComment: Comment = {
        id: response.comment?.id || `comment_${Date.now()}`,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`.trim() || user.email || "User",
        userAvatar: user.profileImageUrl || user.avatar || "",
        text: text.trim(),
        createdAt: response.comment?.createdAt || new Date().toISOString(),
      };

      // Update local state with new comment
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, comments: [...post.comments, newComment] } : post
        )
      );
    } catch (error: any) {
      console.error("Failed to add comment:", error);
      Alert.alert("Error", "Failed to post comment. Please try again.");
    }
  }, [user, isGuest, getToken]);

  return (
    <DataContext.Provider
      value={{
        photographers,
        sessions,
        posts,
        businesses,
        isLoading,
        error,
        refreshPhotographers,
        refreshSessions,
        addSession,
        getPhotographer,
        getUpcomingSessions,
        getPastSessions,
        hasCompletedSessionWith,
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

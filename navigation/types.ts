import { NavigatorScreenParams } from "@react-navigation/native";
import { Photographer, PhotographyCategory } from "@/context/DataContext";

export interface BusinessProfileData {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  city: string;
  state: string;
  rating: number;
  priceRange: string;
  category: string;
  description: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  resultType: "business" | "photographer" | "product" | "service";
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  reviewCount?: number;
  coverImage?: string;
  brandColors?: string;
}

export interface PhotographerProfileData {
  id: string;
  userId?: string; // The actual user ID for messaging/conversations
  name: string;
  username?: string;
  avatar: string;
  city: string;
  state: string;
  rating: number;
  priceRange: string;
  specialty: string;
  description: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  reviewCount?: number;
  coverImage?: string;
  yearsOfExperience?: number;
  portfolio?: string[];
  specialties?: string[];
  brandColors?: string;
  stripeOnboardingComplete?: boolean; // Whether photographer can accept bookings
}

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Auth: { returnTo?: string };
  ConsumerSignup: undefined;
  BusinessSignup: undefined;
  PhotographerSignup: undefined;
  BusinessOnboarding: undefined;
  PhotographerOnboarding: undefined;
  SelectPhotographer: undefined;
  PhotographerDetail: { photographer: Photographer };
  Booking: { photographer?: Photographer; photographerId?: string; preselectedServiceId?: string };
  VendorDetail: { vendorId: string; initialTab?: "products" | "services" | "reviews"; productId?: string };
  BusinessProfile: { business: BusinessProfileData };
  PhotographerProfile: { photographer: PhotographerProfileData };
  Profile: { 
    userId: string; 
    profileId?: string;
    userType?: "photographer" | "business" | "consumer";
    displayName?: string;
    avatar?: string;
  };
  SessionDetail: { sessionId: string };
  PhotoGallery: { sessionId: string; initialIndex?: number };
  Conversation: { conversationId: string };
  Chat: {
    conversationId: string;
    participantId: string;
    participantName: string;
    participantAvatar?: string;
    participantType: "business" | "photographer";
  };
  CartOrders: undefined;
  Favorites: undefined;
  Payment: {
    sessionId: string;
    amount: number;
    photographerName: string;
    sessionDate: string;
  };
  AdminDashboard: undefined;
  AdminUserDetail: { userId: string };
  AdminBusinessReview: { businessId: string };
  PhotographerDashboard: undefined;
  BusinessDashboard: undefined;
  InfluencerApplication: undefined;
  ProfileCompletionGate: { dashboardType: "photographer" | "business" };
  StorefrontEditor: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  Notifications: undefined;
  ProfileFeed: {
    profileId: string;
    profileName?: string;
    intent: "pro" | "pulse";
  };
};

export type MainTabParamList = {
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  SearchTab: undefined;
  SessionsTab: undefined;
  MessagesTab: undefined;
  AccountTab: NavigatorScreenParams<AccountStackParamList>;
};

export type DiscoverStackParamList = {
  Discover: undefined;
};

export type AccountStackParamList = {
  Account: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
  OutsydePoints: undefined;
};

export type BookingStackParamList = {
  SelectDate: { photographer: Photographer };
  SelectTime: { photographer: Photographer; date: string };
  BookingDetails: {
    photographer: Photographer;
    date: string;
    timeSlotId: string;
    startTime: string;
    endTime: string;
  };
  ReviewConfirm: {
    photographer: Photographer;
    date: string;
    timeSlotId: string;
    startTime: string;
    endTime: string;
    location: string;
    sessionType: PhotographyCategory;
    notes: string;
  };
};

import { NavigatorScreenParams } from "@react-navigation/native";
import { Photographer, PhotographyCategory } from "@/context/DataContext";
import { GoogleProfile } from "@/context/AuthContext";
import { BusinessAppointment, ConsumerOrderItem } from "@/services/api";


export type RootStackParamList = {
  Onboarding: { startAtSlide?: number; googleProfile?: GoogleProfile } | undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Auth: { returnTo?: string };
  ConsumerSignup: { prefillName?: string; prefillEmail?: string; socialProvider?: string; prefillAvatar?: string; isGoogleSignup?: boolean; googleProfile?: GoogleProfile } | undefined;
  BusinessSignup: { prefillName?: string; prefillEmail?: string; socialProvider?: string; prefillAvatar?: string; isGoogleSignup?: boolean; googleProfile?: GoogleProfile } | undefined;
  PhotographerSignup: { prefillName?: string; prefillEmail?: string; socialProvider?: string; prefillAvatar?: string; isGoogleSignup?: boolean; googleProfile?: GoogleProfile } | undefined;
  BusinessOnboarding: undefined;
  PhotographerOnboarding: undefined;
  SelectPhotographer: undefined;
  PhotographerDetail: { photographer: Photographer };
  Booking: { photographer?: Photographer; photographerId?: string; preselectedServiceId?: string };
  VendorDetail: { vendorId: string; initialTab?: "products" | "services" | "reviews"; productId?: string };
  StaffWorkProfile: { businessId: string; staffId: string };
  PostDetail: { userId: string; initialPostId: string };
  UserProfile: { userId: string; userType?: "business" | "photographer" | "consumer" };
  SessionDetail: { sessionId: string };
  AppointmentDetail: { appointment: BusinessAppointment };
  PhotoGallery: { sessionId: string; initialIndex?: number };
  Conversation: { conversationId: string };
  Chat: {
    conversationId: string;
    participantId: string;
    participantName: string;
    participantAvatar?: string;
    participantType: "business" | "photographer" | "consumer";
  };
  CartOrders: { openTab?: "cart" | "bookings" | "orders"; _ts?: number } | undefined;
  CartCheckout: undefined;
  ProductDetail: {
    id: string;
    businessId: string;
    name: string;
    description?: string | null;
    priceCents: number;
    imageUrl?: string | null;
    inventory?: number | null;
  };
  ProductOrderDetail: {
    orderId: string;
    vendorName: string;
    status: string;
    items: ConsumerOrderItem[];
    totalAmount: number;
    grossChargeAmount?: number | null;
    shippingAddress?: string | null;
    createdAt: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    estimatedDelivery?: string | null;
    shipmentStatus?: string | null;
  };
  OrderSuccess: {
    vendorName?: string;
    itemCount: number;
    totalCharged: number;
    pointsEarned: number;
    orderId?: string;
  };
  Favorites: undefined;
  AdminDashboard: undefined;
  AdminUserDetail: { userId: string };
  AdminBusinessReview: { businessId: string };
  PhotographerDashboard: { openModal?: "profile" } | undefined;
  BusinessDashboard: undefined;
  DashboardOrdersScreen: undefined;
  DashboardBookingsScreen: undefined;
  DashboardCalendarScreen: undefined;
  DashboardCreditsScreen: undefined;
  DashboardAnalytics: undefined;
  StaffDashboard: undefined;
  EditStaffProfile: undefined;
  InfluencerApplication: undefined;
  InfluencerDashboard: undefined;
  InfluencerOnboarding: undefined;
  ProfileCompletionGate: { dashboardType: "photographer" | "business" };
  StorefrontEditor: undefined;
  SubscriptionPlan: undefined;
  StaffManagement: undefined;
  ShootBooking: { businessId: string; creditBalance: number };
  StaffOnboarding: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string; email: string };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  BlockedUsers: undefined;
  Notifications: undefined;
  ProfileFeed: {
    profileId: string;
    profileName?: string;
    layout: "pro" | "pulse";
  };
  Sessions: undefined;
  CreatePost: undefined;
};

export type MainTabParamList = {
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  SearchTab: undefined;
  CreateTab: undefined;
  InboxTab: undefined;
  AccountTab: NavigatorScreenParams<AccountStackParamList>;
};

export type DiscoverStackParamList = {
  Discover: undefined;
};

export type AccountStackParamList = {
  Account: { userId?: string; userType?: "business" | "photographer" | "consumer" } | undefined;
  EditProfile: undefined;
  Settings: undefined;
  AddressForm: { mode: "shipping" | "billing" };
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

import { NavigatorScreenParams } from "@react-navigation/native";
import { Photographer, PhotographyCategory } from "@/context/DataContext";
import { BusinessAppointment, ConsumerOrderItem } from "@/services/api";
import { Story } from "@/components/StoryRing";
import type { FeedMode } from "@/utils/feedModes";

// Sections of the in-app admin (screens/AdminDashboardScreen.tsx).
export type AdminSection = "users" | "businesses" | "photographers" | "payments" | "messages" | "influencers";

export type RootStackParamList = {
  Onboarding: { startAtSlide?: number } | undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Auth: { returnTo?: string };
  ConsumerSignup: { prefillName?: string; prefillEmail?: string; prefillAvatar?: string } | undefined;
  BusinessSignup: { prefillName?: string; prefillEmail?: string; prefillAvatar?: string } | undefined;
  PhotographerSignup: { prefillName?: string; prefillEmail?: string; prefillAvatar?: string } | undefined;
  BusinessOnboarding: undefined;
  PhotographerOnboarding: undefined;
  SelectPhotographer: undefined;
  PhotographerDetail: { photographer: Photographer };
  Booking: { photographer?: Photographer; photographerId?: string; preselectedServiceId?: string };
  /** Full screen booking for a business, staff member or photographer profile (booking redesign step 1, 2026-11-05). */
  BookService: {
    providerId: string;
    providerType: "photographer" | "business";
    providerName: string;
    providerAddress?: string | null;
    providerCity?: string | null;
    providerState?: string | null;
    providerShowAddress?: boolean;
    providerVendorTerms?: string | null;
    staffMemberId?: string | null;
    accentColor?: string;
    preselectedServiceId?: string;
  };
  VendorDetail: {
    vendorId: string;
    initialTab?: "products" | "services" | "reviews";
    productId?: string;
    /** Quotes step 6d-2b (call 9): open on this service (its booking, or its request form when contact for pricing). */
    serviceId?: string;
  };
  StaffWorkProfile: { businessId: string; staffId: string };
  PostDetail: { userId: string; initialPostId: string };
  /** Event page (GET /api/events/slug/:slug). */
  EventDetail: { slug: string };
  FollowList: {
    /** User, business or photographer id of the profile whose lists to show. */
    profileId: string;
    initialTab?: "followers" | "following";
    title?: string;
    followerCount?: number;
    followingCount?: number;
  };
  UserProfile: { userId: string; userType?: "business" | "photographer" | "consumer" };
  SessionDetail: { sessionId: string };
  AppointmentDetail: { appointment: BusinessAppointment };
  PhotoGallery: { sessionId: string; initialIndex?: number };
  Conversation: { conversationId: string };
  Chat: {
    conversationId: string;
    // Optional so a push tap can open a chat by id alone; ChatScreen fills them from the inbox.
    participantId?: string;
    participantName?: string;
    participantAvatar?: string;
    participantType?: "business" | "photographer" | "consumer";
    /** Business / photographer profile ids for "View profile" (backend #300 otherParticipant). */
    businessId?: string | null;
    photographerId?: string | null;
  };
  /** One quote and its booking (Quotes step 6c-1). start: the chat card's step, run once (utils/quoteLogic Start). */
  Quote: { quoteId: string; start?: string };
  /** Quotes step 6d-2b: the owner's Requests list. */
  BusinessRequests: undefined;
  /** Quotes step 6d-2b: owner (every quote) or staff (the quotes they sent, for the business the app picked). */
  BusinessQuotes: { mode: "owner" | "staff"; businessId?: string };
  /** Quotes step 6d-1: Create a quote in a chat (or from a request card), or Edit one (quoteId). */
  QuoteCompose: {
    conversationId: string;
    businessId?: string;
    quoteId?: string;
    requestId?: string;
    serviceId?: string;
    serviceName?: string;
    preferredDate?: string;
  };
  CartOrders: { openTab?: "cart" | "bookings" | "orders" | "tickets" | "quotes"; _ts?: number } | undefined;
  /** Request a quote on a contact for pricing service (Quotes step 6c-2b). */
  RequestQuote: { serviceId: string; serviceName?: string; businessId?: string; businessName?: string };
  /** One event's tickets with QR codes (from GET /api/events/me/tickets). */
  TicketDetail: { eventId: string };
  /** Host: create (no id) or edit an event (p4-host). */
  EventEditor: { eventId?: string } | undefined;
  /** Host: drafts, upcoming, past and cancelled events you host. */
  YourEvents: undefined;
  /** Host: one event's sales, guests, orders and cancel. */
  ManageEvent: { eventId: string };
  /** Host: one event's door team with invites (p4-scanner, canvas 38). */
  DoorTeam: { eventId: string };
  /** An Event team invite for any role (step 9c-1, mockup E), from its push, its Activity item or Event team. Name kept for old pushes. */
  DoorInvite: { inviteId: string };
  /** Event team (step 9c-1, mockup D): my invites and the events I host or work (Account menu). Name kept for old pushes. */
  DoorEvents: undefined;
  /** My page for one event I'm on the team for (step 9c-1, mockup C): roles, times, link, messages, pay, Leave. */
  MyTeam: { eventId: string };
  /** The door scanner for one event (canvas 14 and 15). */
  DoorScanner: { eventId: string };
  CartCheckout: undefined;
  CheckoutScreen: {
    mode: "cart" | "buyNow";
    buyNowItem?: {
      productId: string;
      name: string;
      priceCents: number;
      quantity: number;
      vendorId: string;
      imageUrl?: string;
      variantId?: string;
      variantLabel?: string;
      /** Picked add-ons (products with add-on groups only); priceCents already includes them. */
      addons?: import("@/components/products/productAddonLogic").CartAddon[];
      addonsLabel?: string;
    };
  };
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
    orderNumber?: number;
    vendorName: string;
    businessId?: string;
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
  // section: open straight to one admin section (e.g. a business_pending notification). No param = Admin home.
  AdminDashboard: { section?: AdminSection } | undefined;
  AdminUserDetail: { userId: string };
  AdminBusinessReview: { businessId: string };
  AdminPhotographerDetail: { photographerId: string };
  AdminInfluencerDetail: { applicationId: string };
  PhotographerDashboard: { openModal?: "profile" } | undefined;
  BusinessDashboard: undefined;
  BusinessBillingAddress: undefined;
  DashboardOrdersScreen: undefined;
  DashboardBookingsScreen: undefined;
  DashboardCalendarScreen: undefined;
  StaffCalendarScreen: undefined;
  PhotographerCalendarScreen: undefined;
  PhotographerBookingsScreen: undefined;
  DashboardCreditsScreen: undefined;
  DashboardAnalytics: undefined;
  StaffDashboard: undefined;
  EditStaffProfile: undefined;
  InfluencerApplication: undefined;
  InfluencerDashboard: undefined;
  InfluencerReferral: undefined;
  InfluencerAnalytics: undefined;
  InfluencerOnboarding: undefined;
  ProfileCompletionGate: { dashboardType: "photographer" | "business" };
  StorefrontEditor: undefined;
  SubscriptionPlan: undefined;
  StaffManagement: undefined;
  ShootBooking: { businessId: string; creditBalance: number };
  StaffOnboarding: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string; email: string };
  /** Finish an account that has no password yet (login hand-off, signup, goutsyde.com/claim links). */
  ClaimAccount: { email?: string; token?: string; codeSent?: boolean } | undefined;
  /** Setup checklist: plan, payouts, username (same list as goutsyde.com/finish). */
  FinishSetup: undefined;
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
  StoryViewer: {
    userId: string;
    stories: Story[];
    initialIndex?: number;
    authorName?: string;
    authorAvatarUrl?: string;
    onStoryDeleted?: (deletedId: string) => void;
  };
  StoryInsights: { userId: string };
  SupportContact: undefined;
  RateReview: {
    targetType: 'business' | 'photographer';
    targetId: string;
    vendorName?: string;
    bookingId?: string;
    bookingType?: string;
  };
};

export type MainTabParamList = {
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  SearchTab: undefined;
  CreateTab: undefined;
  InboxTab: undefined;
  AccountTab: NavigatorScreenParams<AccountStackParamList>;
};

export type DiscoverStackParamList = {
  /** mode opens that Discover tab (an announcement push to Events sends "events"); _ts makes a repeat tap count. */
  Discover: { mode?: FeedMode; _ts?: number } | undefined;
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

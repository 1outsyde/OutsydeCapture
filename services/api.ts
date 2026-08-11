import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearAuthStorage,
} from "@/utils/tokenStorage";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/client";
import { resolvePostMedia } from "@/utils/resolvePostMedia";

export const API_BASE_URL = "https://outsyde-backend.onrender.com";

// ─── Token refresh queue ─────────────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

async function runRefresh(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearAuthStorage();
    throw new Error("Refresh failed");
  }
  const data = await res.json();
  await storeTokens(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  environment: string;
}

export interface ApiError {
  message: string;
  status?: number;
  validationErrors?: string[];
  body?: Record<string, any>;
}

export interface ApiBusiness {
  id: string;
  name: string;
  avatar?: string;
  image?: string;
  type?: string;
  category?: string;
  city?: string;
  state?: string;
  rating?: number;
  priceRange?: string;
  description?: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  ownerId?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  stripeOnboardingComplete?: boolean;
}

export interface ApiBusinessDetail {
  id: string;
  name: string;
  avatar?: string;
  coverImage?: string;
  type?: string;
  category?: string;
  city?: string;
  state?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  description?: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  brandColors?: string;
  isMultiStaff?: boolean;
}

export interface ApiBusinessStaffMember {
  id: string;
  displayName: string;
  // Optional: not yet guaranteed on the wire everywhere — backend rollout in
  // progress. Fall back to deriving a handle from displayName when absent.
  username?: string | null;
  bio?: string;
  profileImageUrl?: string;
  specialties?: string[];
  serviceIds?: string[];
  rating?: number;
  reviewCount?: number;
}

// The real staff_members row shape returned by GET /api/staff/me (server/storage.ts StaffMember).
export interface StaffMemberProfile {
  id: string;
  businessId: string;
  businessName?: string;
  userId?: string;
  displayName: string;
  bio?: string | null;
  profileImageUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  serviceIds?: string[];
  specialties?: string[] | null;
  role: string;
  status: string;
  rating?: number;
  reviewCount?: number;
  stripeAccountId?: string | null;
  stripeOnboardingComplete: boolean;
  stripeOnboardingUrl?: string | null;
}

// Raw appointments row (no client/service name join server-side today —
// resolve serviceName client-side against the business's services list).
export interface StaffBooking {
  id: string;
  businessId: string;
  clientId: string;
  serviceId: string;
  staffMemberId?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  appointmentEndTime?: string | null;
  durationMinutes?: number | null;
  totalPrice: number;
  staffPayout?: number | null;
  status: string;
  createdAt?: string;
}

export interface StaffAvailabilitySlot {
  id: string;
  staffMemberId: string;
  businessId: string;
  date: string;
  startTime: string;
  endTime: string;
  slotType: "available" | "blocked" | "booked" | "break" | string;
  title?: string | null;
  notes?: string | null;
  appointmentId?: string | null;
}

export interface ApiConversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantType: "business" | "photographer";
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  otherParticipant?: {
    id: string;
    profileImageUrl?: string | null;
    avatar?: string | null;
  };
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ApiPost {
  id: string;
  userId?: string;
  authorId?: string;
  authorType?: string;
  postType?: string;
  postIntent?: "pro" | "pulse";
  displayLayout?: "pro" | "pulse";
  feedSurface?: "pro" | "pulse"; // Added: explicit feed routing
  mediaType?: "image" | "video";
  mediaDuration?: number;
  thumbnailUrl?: string; // Added: video thumbnail
  content?: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  mediaUrl?: string; // Added: alternative field name from backend (snake_case → camelCase)
  taggedBusinessId?: string;
  taggedPhotographerId?: string;
  aspectRatio?: number;
  likesCount: number;
  commentsCount: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  // Optional commerce context
  serviceId?: string;
  photographerServiceId?: string;
  productId?: string;
  providerId?: string;
  user?: {
    id: string;
    name: string;
    username?: string;
    profileImageUrl?: string;
  };
  author?: {
    id: string;
    name: string;
    username?: string;
    profilePhotoUrl?: string | null;
    profileImageUrl?: string | null;
    businessId?: string;
    photographerId?: string;
    displayName?: string;
    role?: string;
    userId?: string;
  };
  taggedBusiness?: {
    id: string;
    name: string;
  };
  taggedPhotographer?: {
    id: string;
    displayName: string;
  };
}

export interface CreateConversationRequest {
  participantId: string;
  participantType: "business" | "photographer";
  participantName: string;
  participantAvatar?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface CreateBusinessRequest {
  name: string;
  category: string;
  city: string;
  state: string;
  description: string;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  coverImage?: string;
}

export interface CreatePhotographerRequest {
  name: string;
  specialty: string;
  city: string;
  state: string;
  priceRange: string;
  description: string;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  coverImage?: string;
  portfolio?: string[];
}

// VendorBooker Photographer Profile (matches /api/photographers/me)
export interface VendorBookerPhotographer {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  portfolioUrl?: string | null;
  hourlyRate: number; // stored in cents
  specialties?: string[] | null;
  coverImage?: string | null;
  logoImage?: string | null;
  brandColors?: string | null;
  hoursOfOperation?: string | null;
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

// VendorBooker Business Profile (matches /api/vendor/my-business)
export interface VendorBookerBusiness {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description?: string | null;
  tagline?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  hasProducts: boolean;
  hasServices: boolean;
  coverImage?: string | null;
  coverMediaType?: "image" | "video" | null;
  logoImage?: string | null;
  brandColors?: string | null;
  hoursOfOperation?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  knownFor?: string[] | string | null;
  socialMedia?: Record<string, string> | string | null;
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean | null;
  approvalStatus?: "pending" | "approved" | "rejected" | null;
  approvalNotes?: string | null;
  subscriptionActive?: boolean | null;
  subscriptionStatus?: string | null;
  subscriptionTier?: string | null;
  hasActiveSubscription?: boolean | null;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// Photographer onboarding data (for creating/updating profile)
export interface PhotographerOnboardingData {
  displayName: string;
  bio?: string;
  city?: string;
  state?: string;
  portfolioUrl?: string;
  hourlyRate: number; // in cents
  specialties?: string[];
  willTravel?: boolean;
  additionalServices?: string[];
  brandColors?: string; // JSON string with { primary: "#hex" }
  isProfileComplete?: boolean;
}

// Hours of operation for a single day
export interface DayHoursData {
  open: string;
  close: string;
  closed: boolean;
}

// Hours of operation for the week
export interface HoursOfOperationData {
  monday?: DayHoursData;
  tuesday?: DayHoursData;
  wednesday?: DayHoursData;
  thursday?: DayHoursData;
  friday?: DayHoursData;
  saturday?: DayHoursData;
  sunday?: DayHoursData;
}

// Business onboarding data (for creating/updating profile)
export interface BusinessOnboardingData {
  name?: string;
  category?: string;
  description?: string;
  tagline?: string;
  city?: string;
  state?: string;
  hasProducts?: boolean;
  hasServices?: boolean;
  yearsInBusiness?: number;
  numberOfEmployees?: number;
  businessStructure?: string; // LLC, Sole Proprietor, Corporation, etc.
  hasPhysicalLocation?: boolean;
  showAddress?: boolean;
  defaultServiceLocationType?: string;
  isOnlineOnly?: boolean;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  hoursOfOperation?: HoursOfOperationData;
  brandColors?: string; // JSON string with { primary: "#hex" }
  coverImage?: string;
  coverMediaType?: "image" | "video";
  logoImage?: string;
}

// Stripe onboarding status
export interface StripeOnboardingStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

// Photographer service from VendorBooker
export interface VendorBookerPhotographerService {
  id: string;
  photographerId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  priceCents?: number | null;
  isContactForPricing: boolean;
  estimatedDurationMinutes?: number | null;
  pricingModel?: string | null;
  hourlyRateCents?: number | null;
  packageHours?: number | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  serviceLocationType?: 'business' | 'alternate' | 'customer' | 'virtual';
  alternateAddress?: string | null;
  alternateCity?: string | null;
  alternateState?: string | null;
  alternateZipCode?: string | null;
  virtualLink?: string | null;
  fullRefundWindow?: '1_week' | '48_hours' | '24_hours' | '1_hour' | 'never';
  hasPartialRefund?: boolean;
  partialRefundWindow?: '1_week' | '48_hours' | '24_hours' | '1_hour' | 'never' | null;
  partialRefundPercentage?: number | null;
  hasCancellationFee?: boolean;
  cancellationFeeType?: 'flat' | 'percentage' | null;
  cancellationFeeAmount?: number | null;
}

// Photographer availability slot
export interface VendorBookerAvailabilitySlot {
  id: string;
  photographerId: string;
  dayOfWeek?: number | null;
  date?: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  createdAt?: string;
}

// Blocked date for photographers
export interface BlockedDate {
  id?: string;
  photographerId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  reason?: string;
  createdAt?: string;
}

// Weekly availability slot (recurring pattern)
export interface WeeklyAvailabilitySlot {
  id?: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  isActive: boolean;
}

// Availability block (manual time-off)
export interface AvailabilityBlock {
  id: string;
  startDate: string;  // ISO date or datetime
  endDate: string;    // ISO date or datetime
  isFullDay: boolean;
  reason?: string;
  createdAt?: string;
}

// The block write endpoints respond with { block: {...} } rather than the bare
// row. Accepts either shape and returns the inner object. Throws on anything
// else: callers persist the returned .id and later pass it to deleteBlock, so
// handing back an id-less object would silently make the block undeletable.
function unwrapBlockResponse(
  response: { block?: AvailabilityBlock } | AvailabilityBlock | null | undefined,
  action: "create" | "update"
): AvailabilityBlock {
  const block = (response as any)?.block ?? response;
  if (!block || typeof block !== "object" || typeof (block as any).id !== "string") {
    throw {
      message: `The server response to the block ${action} was not in the expected shape.`,
    } as ApiError;
  }
  return block as AvailabilityBlock;
}

// Product/Service status type
// - draft: Not visible to customers, editable
// - live: Visible and purchasable/bookable (requires Stripe + subscription + approval)
// - paused: Auto-set when subscription lapses, not visible, editable
// - archived: Hidden, read-only
export type ItemStatus = "draft" | "live" | "paused" | "archived";

// VendorBooker Product (from /api/vendor/products)
export interface VendorProduct {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  imageUrl?: string | null;
  inventory?: number | null;
  status: ItemStatus;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// VendorBooker Service (from /api/vendor/services)
export interface VendorService {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  durationMinutes?: number | null;
  status: ItemStatus;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// Create/Update Product Request
export interface VendorProductInput {
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  inventory?: number;
  status?: ItemStatus;
}

// Create/Update Service Request
export interface VendorServiceInput {
  name: string;
  description?: string;
  priceCents: number;
  durationMinutes?: number;
  status?: ItemStatus;
  fullRefundWindow?: '1_week' | '48_hours' | '24_hours' | '1_hour' | 'never';
  hasPartialRefund?: boolean;
  partialRefundWindow?: '1_week' | '48_hours' | '24_hours' | '1_hour' | 'never' | null;
  partialRefundPercentage?: number | null;
  hasCancellationFee?: boolean;
  cancellationFeeType?: 'flat' | 'percentage' | null;
  cancellationFeeAmount?: number | null;
  serviceLocationType?: 'business' | 'alternate' | 'customer' | 'virtual';
  alternateAddress?: string | null;
  alternateCity?: string | null;
  alternateState?: string | null;
  alternateZipCode?: string | null;
  virtualLink?: string | null;
}

export interface StaffServiceInput {
  name: string;
  description?: string | null;
  category?: string | null;
  pricingModel?: "package" | "hourly";
  priceCents: number;
  durationMinutes: number;
  packageHours?: number;
  serviceLocationType?: "business" | "alternate" | "customer" | "virtual";
  alternateAddress?: string | null;
  alternateCity?: string | null;
  alternateState?: string | null;
  alternateZipCode?: string | null;
  virtualLink?: string | null;
  fullRefundWindow?: "1_week" | "48_hours" | "24_hours" | "1_hour" | "never";
  hasPartialRefund?: boolean;
  partialRefundWindow?: "1_week" | "48_hours" | "24_hours" | "1_hour" | "never" | null;
  partialRefundPercentage?: number | null;
  hasCancellationFee?: boolean;
  cancellationFeeType?: "flat" | "percentage" | null;
  cancellationFeeAmount?: number | null;
}

export interface AdminStats {
  users: number;
  businesses: number;
  photographers: number;
  orders: number;
  bookings: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatar?: string;
  accountType: "consumer" | "business" | "photographer";
  createdAt: string;
  status: "active" | "suspended";
}

export interface AdminBusiness {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  email?: string;
  phone?: string;
  status?: "pending" | "approved" | "rejected";
  approvalStatus?: "pending" | "approved" | "rejected";
  createdAt: string;
  earnings?: number;
}

export interface AdminBusinessDetailOwner {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  phone?: string;
}

export interface AdminBusinessDetail {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  address?: string;
  zipCode?: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  bio?: string;
  services?: string[];
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  linkedin?: string;
  coverImage?: string;
  logo?: string;
  images?: string[];
  documents?: string[];
  status: "pending" | "approved" | "rejected";
  approvalStatus?: "pending" | "approved" | "rejected";
  isLive?: boolean;
  isSearchable?: boolean;
  subscriptionActive?: boolean;
  subscriptionTier?: string;
  stripeOnboardingComplete?: boolean;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  owner?: AdminBusinessDetailOwner;
  products?: any[];
  staff?: any[];
  productCount?: number;
  serviceCount?: number;
  staffCount?: number;
  createdAt: string;
  updatedAt?: string;
  priceRange?: string;
  businessHours?: Record<string, { open: string; close: string; closed?: boolean }>;
}

export interface AdminPhotographer {
  id: string;
  name?: string;
  displayName?: string;
  specialty?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  earnings?: number;
}

export interface AdminInfluencer {
  id: string;
  name: string;
  email?: string;
  instagram?: string;
  followers?: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  userId: string;
  userName: string;
  businessId: string;
  businessName: string;
  amount: number;
  status: "pending" | "completed" | "canceled" | "refunded";
  createdAt: string;
}

export interface AdminBooking {
  id: string;
  userId: string;
  userName: string;
  photographerId: string;
  photographerName: string;
  date: string;
  amount: number;
  status: "pending" | "confirmed" | "completed" | "canceled";
  createdAt: string;
}

export interface AdminRefund {
  id: string;
  orderId?: string;
  bookingId?: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AdminConversation {
  id: string;
  participants: { id: string; name: string; avatar?: string }[];
  lastMessage?: string;
  lastMessageAt?: string;
  messageCount: number;
}

export interface PaymentStats {
  totalOrders: number;
  orderRevenue: number;
  totalBookings: number;
  pendingRefunds: number;
}

export interface ApiPhotographer {
  id: string;
  name: string;
  displayName?: string;
  avatar?: string;
  image?: string;
  logoImage?: string;
  coverImage?: string;
  location?: string;
  city?: string;
  state?: string;
  rating?: number;
  specialty?: string;
  priceRange?: string;
  description?: string;
  bio?: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  userId?: string;
  ownerId?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  stripeOnboardingComplete?: boolean;
}

export interface PhotographerDashboardStats {
  earnings: number;
  // upcomingBookings counts only bookings dated today or later that are still
  // going to happen; totalBookings counts every booking that was not cancelled
  // or declined, regardless of date. They are different questions — see the
  // derivation in screens/PhotographerDashboardScreen.tsx.
  upcomingBookings: number;
  totalBookings?: number;
  unreadMessages: number;
  rating: number;
  reviewCount: number;
  profileViews: number;
  completedShoots: number;
}

export interface PhotographerDashboardProfile {
  id: string;
  name: string;
  avatar?: string;
  hourlyRate: number;
  bio?: string;
  city?: string;
  state?: string;
  portfolioUrl?: string;
  specialties: string[];
  stripeConnected: boolean;
  profileTheme?: string; // Brand color primary
  autoAcceptBookings?: boolean; // Auto-accept new bookings without manual approval
}

export interface ProviderSettings {
  autoAcceptBookings: boolean;
}

export interface PhotographerBooking {
  id: string;
  clientName: string;
  clientAvatar?: string;
  date: string;
  time: string;
  sessionType: string;
  location?: string;
  // Matches BusinessBooking["status"] character for character — two providers,
  // one vocabulary. Source of truth is BOOKING_STATES in shared/schema.ts:123-133;
  // `draft` and `pending_payment` are deliberately omitted here because neither
  // reaches a provider-facing list (draft is a pre-payment slot lock,
  // pending_payment is transient), which is also why BusinessBooking omits them.
  status: "pending" | "pending_provider" | "confirmed" | "completed" | "canceled" | "no_show" | "declined" | "expired";
  amount: number;
  // Vendor-facing fee breakdown (backend-calculated; optional until backend exposes them)
  subtotalAmount?: number;
  bookingFeeAmount?: number;
  influencerCommissionAmount?: number;
  vendorNetAmount?: number;
  isInfluencerAttributed?: boolean;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface BookingDraft {
  id: string;
  photographerId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "held" | "expired" | "confirmed";
  expiresAt: string;
  totalAmount: number;
  feeBreakdown?: FeeBreakdown;
}

export interface PhotographerService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive: boolean;
  status?: string;
  pricingModel?: string;
  category?: string;
  rating?: number | null;
  reviewCount?: number | null;
  durationMinutes?: number | null;
}

export interface PhotographerHours {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
}

export interface BillingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface BusinessDashboardStats {
  earnings: number;
  upcomingOrders: number;
  upcomingBookings: number;
  unreadMessages: number;
  rating: number;
  reviewCount: number;
  profileViews: number;
}

export interface BusinessDashboardProfile {
  id: string;
  name: string;
  avatar?: string;
  category: string;
  bio?: string;
  city?: string;
  state?: string;
  website?: string;
  stripeConnected: boolean;
  businessType: "service" | "product" | "both";
  brandColor?: string;
  autoAcceptBookings?: boolean; // Auto-accept new bookings without manual approval
  subscriptionStatus?: string;
  subscriptionTier?: string;
  hasActiveSubscription?: boolean;
  isMultiStaff?: boolean;
}

export interface BusinessOrder {
  id: string;
  customerName: string;
  customerAvatar?: string;
  orderDate: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "canceled";
  // Vendor-facing fee breakdown (backend-calculated; optional until backend exposes them)
  subtotalAmount?: number;
  platformFeeAmount?: number;
  influencerCommissionAmount?: number;
  vendorNetAmount?: number;
  isInfluencerAttributed?: boolean;
  attributedInfluencerId?: string;
  // JSON-encoded {line1, city, state, zipCode} — parse before rendering; null for pre-fix orders
  shippingAddress?: string | null;
  shipment?: {
    id: string;
    carrier: string;
    trackingNumber: string;
    status: string;
    shippedAt?: string;
    deliveredAt?: string;
  } | null;
}

export interface BusinessBooking {
  id: string;
  customerName: string;
  customerAvatar?: string;
  date: string;
  time: string;
  serviceName: string;
  status: "pending" | "pending_provider" | "confirmed" | "completed" | "canceled" | "no_show" | "declined" | "expired";
  amount: number;
  // Vendor-facing fee breakdown (backend-calculated; optional until backend exposes them)
  subtotalAmount?: number;
  bookingFeeAmount?: number;
  influencerCommissionAmount?: number;
  vendorNetAmount?: number;
  isInfluencerAttributed?: boolean;
  attributedInfluencerId?: string;
}

export interface BusinessProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  inventory: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface BusinessService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive: boolean;
}

export interface ApiPhotographerDetail {
  id: string;
  userId?: string;
  name: string;
  avatar?: string;
  coverImage?: string;
  city?: string;
  state?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  specialty?: string;
  specialties?: string[];
  priceRange?: string;
  description?: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  yearsOfExperience?: number;
  portfolio?: string[];
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  brandColors?: string;
  stripeOnboardingComplete?: boolean; // Whether photographer can accept bookings
  studioAddress?: string | null;
  vendorTermsAndConditions?: string | null;
  autoAcceptBookings?: boolean;
  displayName?: string;
  logoImage?: string;
}

export interface SearchResponse {
  businesses: ApiBusiness[];
  photographers: ApiPhotographer[];
  staff?: ApiBusinessStaffMember[];
}

export interface SearchParams {
  query?: string;
  city?: string;
  category?: string;
}

export interface UnifiedSearchParams {
  q?: string;
  city?: string;
  category?: string;
  lat?: number;
  lng?: number;
  personalized?: boolean;
  scope?: "all" | "consumers" | "businesses" | "photographers" | "products" | "services";
  viewerUserId?: string;
}

export interface UnifiedSearchItem {
  id: string;
  userId?: string;
  providerUserId?: string;
  type: "business" | "photographer" | "product" | "service" | "consumer" | "staff";
  name?: string;
  title?: string;
  subtitle?: string;
  username?: string;
  displayName?: string;
  description?: string;
  category?: string;
  city?: string;
  state?: string;
  rating?: number;
  ratingAvg?: number;
  reviewCount?: number;
  ratingCount?: number;
  priceRange?: string;
  avatar?: string;
  avatarUrl?: string;
  imageUrl?: string;
  profileImage?: string;
  logoImage?: string;
  profileImageUrl?: string;
  coverImage?: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  hourlyRate?: number;
  specialties?: string[];
  preferenceScore?: number;
  baseScore?: number;
  personalizationScore?: number;
  distance?: number;
  isInfluencer?: boolean;
  influencerStatus?: string;
  providerId?: string;
  providerName?: string;
  providerType?: "photographer" | "business";
  businessId?: string;
  businessName?: string;
  price?: number;
  productImage?: string;
  // vendor_products.is_featured / vendor_services.is_featured
  is_featured?: boolean;
}

export interface UnifiedSearchResponse {
  results: UnifiedSearchItem[];
  total: number;
  personalized: boolean;
}

export type SearchResultType = "business" | "photographer" | "product" | "service" | "consumer" | "staff";

export interface MobileLoginRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface MobileLoginResponse {
  accessToken?: string; // JWT access token (1 hour expiry)
  refreshToken?: string; // JWT refresh token (7 day expiry)
  user: {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImageUrl?: string;
    isVendor?: boolean;
    isPhotographer?: boolean;
    isInfluencer?: boolean;
    isAdmin?: boolean;
    isOAuthUser?: boolean;
    role?: "consumer" | "business" | "photographer";
    approvalStatus?: "pending" | "approved" | "rejected";
    isProfileComplete?: boolean;
    avatar?: string;
    dateOfBirth?: string;
    city?: string;
    state?: string;
    businessName?: string;
    businessCategory?: string;
    businessDescription?: string;
    displayName?: string;
    bio?: string;
    hourlyRate?: number;
    portfolioUrl?: string;
    specialties?: string[];
  };
  photographer?: {
    id: string;
    userId: string;
    displayName?: string;
    bio?: string;
    city?: string;
    state?: string;
    portfolioUrl?: string;
    hourlyRate?: number;
    rating?: number;
    reviewCount?: number;
    stripeAccountId?: string;
    stripeOnboardingComplete?: boolean;
    specialties?: string[];
    coverImage?: string;
    logoImage?: string;
  };
  vendor?: {
    id: string;
    userId: string;
    businessName?: string;
    businessCategory?: string;
    description?: string;
  };
}

export interface MobileSignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "consumer" | "business" | "photographer";
  phone?: string;
  dateOfBirth?: string;
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  logoImage?: string | null;
  city?: string;
  state?: string;
  address?: string;
  streetAddress?: string;
  aptUnit?: string | null;
  zipCode?: string;
  country?: string;
  billingSameAsHome?: boolean;
  billingAddress?: string;
  billingStreet?: string;
  billingAptUnit?: string | null;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
  billingZip?: string;
  isStartup?: boolean;
  isMultiStaff?: boolean;
  yearsInBusiness?: string;
  employeeCount?: string;
  businessType?: string;
  hasPhysicalLocation?: boolean;
  websiteUrl?: string;
  socialMedia?: string;
  username?: string;
  gender?: string;
  ethnicity?: string;
  shoppingFrequency?: string;
  selectedIndustries?: string[];
  industryNiches?: Record<string, string[]>;
  industryValues?: Record<string, string[]>;
}

export interface MobileSignupResponse {
  accessToken: string;
  user: MobileLoginResponse["user"];
}

// Role-specific signup request types (matches backend validation)
export interface CustomerSignupRequest {
  email: string;
  password: string;
  name: string; // Backend requires 'name', not firstName/lastName
  phone?: string;
  address?: string;
  aptUnit?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  username?: string;
  dateOfBirth?: string;
  gender?: string;
  ethnicity?: string;
  shoppingFrequency?: string;
  selectedIndustries?: string[];
  industryNiches?: Record<string, string[]>;
  industryValues?: Record<string, string[]>;
  billingSameAsHome?: boolean;
  billingStreet?: string;
  billingAptUnit?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
}

export interface VendorSignupRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  businessName: string;
  businessCategory: string;
  businessDescription?: string;
  offerType: "products" | "services" | "both";
  isStartup?: boolean;
  isMultiStaff?: boolean;
  yearsInBusiness?: string;
  employeeCount?: string;
  businessType?: string;
  hasPhysicalLocation?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
  websiteUrl?: string;
  socialMedia?: string;
  logoImage?: string | null;
  acceptedSubscription: boolean;
  username?: string;
}

export interface PhotographerSignupRequest {
  email: string;
  password: string;
  name: string;
  displayName: string;
  city: string;
  state: string;
  hourlyRate: number;
  portfolioUrl: string;
  username?: string;
}

// Session signup response (just confirms account created, no JWT yet)
export interface SessionSignupResponse {
  success?: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface UnifiedSearchResult {
  id: string;
  userId?: string;
  name: string;
  displayName?: string;
  username?: string;
  avatar: string;
  coverImage?: string;
  city: string;
  state: string;
  rating: number;
  priceRange: string;
  category: string;
  description: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  resultType: SearchResultType;
  originalType?: string;
  isInfluencer?: boolean;
  influencerStatus?: string;
  providerId?: string;
  providerName?: string;
  providerType?: "photographer" | "business";
  businessId?: string;
  businessName?: string;
  price?: number;
  priceFormatted?: string;
  productImage?: string;
  isFeatured?: boolean;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit & { timeout?: number }): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Merge headers properly - ensure Content-Type is always set
    const mergedHeaders: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
    
    // Log the final request for debugging
    console.log(`[API] ${options?.method || 'GET'} ${url}`, options?.body ? `Body: ${options.body}` : '');
    
    // Set up timeout with AbortController (default 30s, longer for signup/auth)
    const timeoutMs = options?.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options, // Spread options first
        credentials: 'include', // Required for session-based auth with cookies
        headers: mergedHeaders, // Then override with merged headers
        signal: controller.signal,
      });

      // DIAGNOSTIC: Log response status and CORS headers for auth debugging
      if (__DEV__) {
        const corsHeaders = {
          'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        };
        console.log(`[API] Response ${response.status} ${url}`, corsHeaders);
        
        // Extra logging for 401 errors
        if (response.status === 401) {
          console.warn(`[API] 401 UNAUTHORIZED on ${endpoint} - Check: 1) Session expired? 2) CORS blocking cookies? 3) Cookie not set on login?`);
        }
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let validationErrors: string[] = [];
        let errorBody: Record<string, any> | undefined;
        try {
          errorBody = await response.json();
          if (errorBody?.message) {
            errorMessage = errorBody.message;
          } else if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
          if (errorBody?.errors && Array.isArray(errorBody.errors)) {
            validationErrors = errorBody.errors;
            errorMessage = validationErrors.join(", ");
          }
          if (response.status !== 404) {
            console.error("API Error Response:", JSON.stringify(errorBody, null, 2));
          }
        } catch (parseError) {
          // Could not parse error body, use default message
        }

        // ── TOKEN_EXPIRED interceptor ──────────────────────────────────────
        const isExpired =
          response.status === 401 &&
          errorBody?.error === "TOKEN_EXPIRED" &&
          !endpoint.includes("/api/auth/refresh");

        if (isExpired) {
          if (_isRefreshing) {
            // Another refresh is in-flight — queue and wait for it
            const newToken = await new Promise<string>((resolve, reject) => {
              _refreshQueue.push({ resolve, reject });
            });
            const retryHeaders: HeadersInit = { ...mergedHeaders, Authorization: `Bearer ${newToken}` };
            const retryRes = await fetch(url, { ...options, credentials: "include", headers: retryHeaders });
            if (!retryRes.ok) throw { message: "Retry after refresh failed", status: retryRes.status } as ApiError;
            return retryRes.json() as T;
          }

          _isRefreshing = true;
          try {
            const newToken = await runRefresh();
            _refreshQueue.forEach((p) => p.resolve(newToken));
            _refreshQueue = [];
            const retryHeaders: HeadersInit = { ...mergedHeaders, Authorization: `Bearer ${newToken}` };
            const retryRes = await fetch(url, { ...options, credentials: "include", headers: retryHeaders });
            if (!retryRes.ok) throw { message: "Retry after refresh failed", status: retryRes.status } as ApiError;
            return retryRes.json() as T;
          } catch (refreshErr) {
            _refreshQueue.forEach((p) => p.reject(refreshErr));
            _refreshQueue = [];
            throw refreshErr;
          } finally {
            _isRefreshing = false;
          }
        }

        throw {
          message: errorMessage,
          status: response.status,
          validationErrors,
          body: errorBody,
        } as ApiError;
      }

      return await response.json();
    } catch (error) {
      if ((error as ApiError).status) {
        throw error;
      }
      // Handle abort/timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          message: "Request timed out. Please try again.",
        } as ApiError;
      }
      throw {
        message: error instanceof Error ? error.message : "Network error",
      } as ApiError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    // Health check doesn't need credentials - avoid CORS issues with wildcard origin
    const url = `${this.baseUrl}/health`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  async mobileLogin(data: MobileLoginRequest): Promise<MobileLoginResponse> {
    return this.request<MobileLoginResponse>("/api/auth/mobile/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async mobileGoogleLogin(idToken: string): Promise<MobileLoginResponse> {
    return this.request<MobileLoginResponse>("/api/auth/mobile/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  }

  async mobileSignup(data: MobileSignupRequest): Promise<MobileSignupResponse> {
    return this.request<MobileSignupResponse>("/api/auth/mobile/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Role-specific signup endpoints (creates account with session auth)
  async customerSignup(data: CustomerSignupRequest): Promise<SessionSignupResponse> {
    return this.request<SessionSignupResponse>("/api/auth/customer/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async vendorSignup(data: VendorSignupRequest): Promise<SessionSignupResponse> {
    return this.request<SessionSignupResponse>("/api/auth/vendor/signup", {
      method: "POST",
      body: JSON.stringify(data),
      timeout: 60000, // 60 second timeout for signup (backend can be slow)
    });
  }

  async notifyAdminOfBusinessApplication(businessId: string, authToken?: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      
      console.log("[API] Notifying admin of new business application:", businessId);
      return await this.request<{ success: boolean; message: string }>("/api/admin/notifications/business-application", {
        method: "POST",
        body: JSON.stringify({ businessId }),
        headers,
        timeout: 15000, // 15 second timeout for notification
      });
    } catch (error) {
      console.warn("[API] Failed to notify admin of business application:", error);
      return { success: false, message: "Notification failed but signup succeeded" };
    }
  }

  async photographerSignup(data: PhotographerSignupRequest): Promise<SessionSignupResponse> {
    return this.request<SessionSignupResponse>("/api/auth/photographer/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request<unknown>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async sendPasswordResetCode(email: string): Promise<{ success: boolean; message: string }> {
    return this.request("/api/auth/forgot-password/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<{ success: boolean; resetToken: string }> {
    return this.request("/api/auth/forgot-password/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  }

  async resetPassword(token: string, email: string, newPassword: string): Promise<void> {
    const payload = { resetToken: token, email, newPassword };
    console.error("[api.resetPassword] token:", token ? `${token.slice(0, 8)}... (len=${token.length})` : "EMPTY");
    console.error("[api.resetPassword] email:", email || "EMPTY");
    console.error("[api.resetPassword] body JSON:", JSON.stringify({ resetToken: token || "(EMPTY)", email: email || "(EMPTY)", newPassword: "***" }));
    const bodyStr = JSON.stringify(payload);
    console.error("[api.resetPassword] sending bodyStr:", bodyStr.replace(newPassword, "***"));
    const res = await fetch(`${this.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });
    console.error("[api.resetPassword] response status:", res.status);
    if (!res.ok) {
      let body: any = {};
      try { body = await res.json(); } catch {}
      console.error("[api.resetPassword] error body:", JSON.stringify(body));
      throw { message: body?.message || `HTTP ${res.status}`, status: res.status, body };
    }
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.request<{ accessToken: string; refreshToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logoutWithToken(refreshToken: string): Promise<void> {
    await this.request<unknown>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      // Non-critical: fire-and-forget
    });
  }

  async appleSignIn(params: {
    identityToken: string;
    fullName?: string | null;
    email?: string | null;
    nonce?: string;
  }): Promise<
    | { isNewUser: true; requiresUsername: boolean; appleId: string; email: string; fullName?: string }
    | { isNewUser: false; user: Record<string, any>; accessToken: string; refreshToken: string }
  > {
    return this.request("/api/auth/oauth/apple", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async appleCompleteSignup(params: {
    appleId: string;
    email: string;
    fullName?: string;
    username: string;
    password: string;
    role?: string;
  }): Promise<{ user: Record<string, any>; accessToken: string; refreshToken: string }> {
    return this.request("/api/auth/oauth/apple/complete-signup", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Combined signup + login for mobile (role-specific signup then JWT login)
  async roleBasedSignupAndLogin(
    data: MobileSignupRequest & {
      displayName?: string;
      hourlyRate?: number;
      portfolioUrl?: string;
      offerType?: "products" | "services" | "both";
    }
  ): Promise<MobileLoginResponse> {
    // Step 1: Call role-specific signup endpoint to create account
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    
    if (data.role === "consumer") {
      const signupData = data as any;
      const customerPayload: CustomerSignupRequest = {
        email: data.email,
        password: data.password,
        name: fullName,
        phone: data.phone,
        city: data.city,
        state: data.state,
        username: data.username,
        gender: data.gender,
        selectedIndustries: data.selectedIndustries,
        industryNiches: data.industryNiches,
        industryValues: data.industryValues,
        dateOfBirth: signupData.dateOfBirth,
        shoppingFrequency: signupData.shoppingFrequency,
        ethnicity: signupData.ethnicity,
      };
      console.log("[Signup] Customer payload:", JSON.stringify(customerPayload, null, 2));
      await this.customerSignup(customerPayload);
    } else if (data.role === "business") {
      const vendorPayload: VendorSignupRequest = {
        email: data.email,
        password: data.password,
        name: fullName,
        phone: data.phone,
        businessName: data.businessName || fullName,
        businessCategory: data.businessCategory || "General",
        businessDescription: data.businessDescription,
        offerType: data.offerType || "both",
        isStartup: data.isStartup,
        isMultiStaff: data.isMultiStaff,
        yearsInBusiness: data.yearsInBusiness,
        employeeCount: data.employeeCount,
        businessType: data.businessType,
        hasPhysicalLocation: data.hasPhysicalLocation,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingZipCode: data.billingZipCode,
        websiteUrl: data.websiteUrl,
        socialMedia: data.socialMedia,
        logoImage: data.logoImage || undefined,
        acceptedSubscription: true,
        username: data.username,
      };
      console.log("[Signup] Vendor payload:", JSON.stringify(vendorPayload, null, 2));
      await this.vendorSignup(vendorPayload);
      
      // Login to get JWT (backend already notifies admins during signup)
      console.log("[Signup] Business created, logging in to get JWT...");
      const loginResponse = await this.mobileLogin({
        email: data.email,
        password: data.password,
      });
      
      return loginResponse;
    } else if (data.role === "photographer") {
      // Ensure hourlyRate is a valid positive number
      const rawHourlyRate = data.hourlyRate;
      let hourlyRate: number;
      if (typeof rawHourlyRate === "number" && !isNaN(rawHourlyRate) && rawHourlyRate > 0) {
        hourlyRate = rawHourlyRate;
      } else {
        // Fallback to a default rate if invalid
        console.warn("[Signup] Invalid hourlyRate received:", rawHourlyRate, "- defaulting to 5000 (50/hr)");
        hourlyRate = 5000; // $50/hr in cents as fallback
      }
      
      // Handle portfolioUrl - use valid URL or placeholder
      let portfolioUrl: string;
      if (data.portfolioUrl && data.portfolioUrl.trim().length > 0) {
        // Ensure it has a protocol
        const url = data.portfolioUrl.trim();
        portfolioUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
      } else {
        // Backend might require a valid URL - use a placeholder
        portfolioUrl = "https://outsyde.app";
      }
      
      const photographerPayload = {
        email: data.email,
        password: data.password,
        name: fullName,
        displayName: data.displayName || fullName,
        city: data.city || "Unknown",
        state: data.state || "NA",
        hourlyRate,
        portfolioUrl,
        username: data.username,
      };
      console.log("[Signup] Photographer payload:", JSON.stringify(photographerPayload, null, 2));
      await this.photographerSignup(photographerPayload);
    }

    // Step 2: Now login to get JWT token
    console.log("[Signup] Account created, logging in to get JWT...");
    const loginResponse = await this.mobileLogin({
      email: data.email,
      password: data.password,
    });

    return loginResponse;
  }

  async search(params?: SearchParams): Promise<SearchResponse> {
    const queryString = new URLSearchParams();
    if (params?.query) queryString.append("q", params.query);
    if (params?.city) queryString.append("city", params.city);
    if (params?.category) queryString.append("category", params.category);
    
    const endpoint = `/api/search${queryString.toString() ? `?${queryString.toString()}` : ""}`;
    return this.request<SearchResponse>(endpoint);
  }

  async unifiedSearch(params?: UnifiedSearchParams, authToken?: string | null, isAdmin: boolean = false): Promise<UnifiedSearchResponse> {
    console.log("[API] Using /api/search for unified search, isAdmin:", isAdmin, "scope:", params?.scope);
    
    const queryString = new URLSearchParams();
    if (params?.q) queryString.append("q", params.q);
    if (params?.city) queryString.append("city", params.city);
    if (params?.category) queryString.append("category", params.category);
    if (params?.scope) queryString.append("scope", params.scope);
    if (params?.viewerUserId) queryString.append("viewerUserId", params.viewerUserId);
    if (params?.personalized) queryString.append("personalized", "true");
    
    const endpoint = `/api/search${queryString.toString() ? `?${queryString.toString()}` : ""}`;
    
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      
      const response = await this.request<{
        results: UnifiedSearchItem[];
        total: number;
        personalized?: boolean;
      }>(endpoint, { headers });
      
      console.log("[API] Unified search results:", response.total, "items");
      
      return {
        results: response.results || [],
        total: response.total || 0,
        personalized: response.personalized || false,
      };
    } catch (error) {
      console.log("[API] Unified search endpoint failed, falling back to legacy search");
      const fallbackResponse = await this.search({
        query: params?.q,
        city: params?.city,
        category: params?.category,
      });
      const normalizedResults = this.normalizeSearchResults(fallbackResponse, isAdmin);
      console.log("[API] Fallback results:", normalizedResults.length, "from legacy search");
      return {
        results: normalizedResults.map(r => ({
          id: r.id,
          type: r.resultType,
          name: r.name,
          description: r.description,
          category: r.category,
          city: r.city,
          state: r.state,
          rating: r.rating,
          priceRange: r.priceRange,
          avatar: r.avatar,
          subscriptionTier: r.subscriptionTier,
        })),
        total: normalizedResults.length,
        personalized: false,
      };
    }
  }

  normalizeUnifiedResults(response: UnifiedSearchResponse): UnifiedSearchResult[] {
    // Helper to validate image URLs (filter out local file paths)
    const isValidImageUrl = (url?: string): string => {
      if (!url) return "";
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
      return "";
    };

    return response.results.map(item => {
      // Backend returns: title, imageUrl, subtitle, providerUserId, ratingAvg, ratingCount, baseScore
      // Map these to our normalized fields
      
      // Get valid avatar URL - check imageUrl first (actual backend field), then fallbacks
      const avatarUrl = 
        isValidImageUrl(item.imageUrl) ||
        isValidImageUrl(item.profileImage) || 
        isValidImageUrl(item.avatarUrl) || 
        isValidImageUrl(item.avatar) || 
        isValidImageUrl(item.logoImage) || 
        isValidImageUrl(item.profileImageUrl) || 
        "";
      const coverUrl = isValidImageUrl(item.coverImage) || "";

      // Resolve display name - title is the primary field from backend
      const resolvedDisplayName = 
        item.title ||
        item.displayName || 
        item.name ||
        null;
      
      const resolvedUsername = item.username || null;
      
      // Parse city/state from subtitle if not provided separately
      let resolvedCity = item.city;
      let resolvedState = item.state;
      if (!resolvedCity && item.subtitle) {
        const parts = item.subtitle.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          resolvedCity = parts[0];
          resolvedState = parts[1];
        } else if (parts.length === 1) {
          resolvedCity = parts[0];
        }
      }
      
      // Final name resolution
      const resolvedName = resolvedDisplayName || (resolvedUsername ? `@${resolvedUsername}` : null) || "Unknown";

      return {
        id: item.id,
        userId: item.userId || item.providerUserId,
        name: resolvedName,
        displayName: resolvedDisplayName || undefined,
        username: resolvedUsername || undefined,
        avatar: avatarUrl || "https://via.placeholder.com/100",
        coverImage: coverUrl,
        city: resolvedCity || "Unknown",
        state: resolvedState || "",
        rating: item.rating || item.ratingAvg || 0,
        priceRange: item.priceRange ||
          (item.hourlyRate ? `$${(item.hourlyRate / 100).toFixed(0)}/hr` : "") ||
          (item.price ? `$${(item.price / 100).toFixed(2).replace(/\.00$/, "")}` : ""),
        category: item.category || item.type,
        description: item.description || "",
        subscriptionTier: item.subscriptionTier,
        resultType: item.type,
        originalType: item.type,
        isInfluencer: item.isInfluencer,
        influencerStatus: item.influencerStatus,
        providerId: item.providerId || item.id,
        providerName: item.providerName || resolvedDisplayName || undefined,
        providerType: item.providerType,
        businessId: item.businessId,
        businessName: item.businessName,
        price: item.price,
        priceFormatted: item.price
          ? `$${(item.price / 100).toFixed(2).replace(/\.00$/, "")}`
          : undefined,
        productImage: isValidImageUrl(item.productImage) || undefined,
        isFeatured: item.is_featured ?? false,
      };
    });
  }

  async getPhotographer(id: string): Promise<ApiPhotographerDetail> {
    const response = await this.request<{ success: boolean; photographer: ApiPhotographerDetail }>(`/api/photographers/${id}`);
    return response.photographer;
  }

  async getBusiness(id: string): Promise<ApiBusinessDetail> {
    const response = await this.request<{ success?: boolean; business?: ApiBusinessDetail } & ApiBusinessDetail>(`/api/businesses/${id}`);
    // Handle both wrapped {business: {...}} and direct {...} response formats
    return response.business || response;
  }

  async getBusinessPublicProducts(businessId: string): Promise<{ products: VendorProduct[] }> {
    return this.request<{ products: VendorProduct[] }>(`/api/businesses/${businessId}/products`);
  }

  async getBusinessPublicServices(businessId: string): Promise<{ services: VendorService[] }> {
    return this.request<{ services: VendorService[] }>(`/api/businesses/${businessId}/services`);
  }

  async getStaffPublicServices(businessId: string, staffId: string): Promise<{ services: BookingService[] }> {
    const response = await this.request<{ services: Array<BookingService & { price?: number }> }>(
      `/api/businesses/${businessId}/staff/${staffId}/services`
    );
    return {
      services: (response.services || []).map(s => ({ ...s, priceCents: s.price ?? s.priceCents ?? 0 })),
    };
  }

  async getBusinessPublicStaff(businessId: string): Promise<{ staff: ApiBusinessStaffMember[] }> {
    return this.request<{ staff: ApiBusinessStaffMember[] }>(`/api/businesses/${businessId}/staff`);
  }

  async getConversations(authToken?: string | null): Promise<ApiConversation[]> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    const response = await this.request<ApiConversation[] | { conversations: ApiConversation[] }>("/api/conversations", {
      headers,
    });
    
    // Normalize response - handle both array and wrapped object
    if (Array.isArray(response)) {
      return response;
    } else if (response && 'conversations' in response) {
      return response.conversations || [];
    }
    return [];
  }

  async createOrGetConversation(data: CreateConversationRequest, authToken?: string | null): Promise<ApiConversation> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return this.request<ApiConversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify(data),
      headers,
    });
  }

  async getMessages(conversationId: string, authToken?: string | null): Promise<ApiMessage[]> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return this.request<ApiMessage[]>(`/api/conversations/${conversationId}/messages`, {
      headers,
    });
  }

  async sendMessage(conversationId: string, content: string, authToken?: string | null): Promise<ApiMessage> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return this.request<ApiMessage>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
      headers,
    });
  }

  async createBusiness(data: CreateBusinessRequest, authToken: string): Promise<ApiBusinessDetail> {
    return this.request<ApiBusinessDetail>("/api/businesses", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Authorization": `Bearer ${authToken}`,
      },
    });
  }

  async createPhotographer(data: CreatePhotographerRequest, authToken: string): Promise<ApiPhotographerDetail> {
    return this.request<ApiPhotographerDetail>("/api/photographers", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Authorization": `Bearer ${authToken}`,
      },
    });
  }

  async getAdminStats(authToken: string): Promise<AdminStats> {
    return this.request<AdminStats>("/api/admin/stats", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminUsers(authToken: string, search?: string): Promise<AdminUser[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const response = await this.request<AdminUser[] | { users?: any[] }>(`/api/admin/users${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    const users = Array.isArray(response) ? response : response?.users || [];
    return users.map((user: any) => ({
      id: user.id,
      name:
        user.name ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.email ||
        "Unknown User",
      email: user.email || "",
      username: user.username,
      avatar: user.avatar || user.profileImageUrl,
      accountType: user.isPhotographer
        ? "photographer"
        : user.isVendor
          ? "business"
          : "consumer",
      createdAt: user.createdAt || new Date().toISOString(),
      status: user.status === "suspended" ? "suspended" : "active",
    }));
  }

  async getAdminBusinesses(authToken: string, status?: string, search?: string): Promise<AdminBusiness[]> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await this.request<{ businesses: AdminBusiness[] } | AdminBusiness[]>(`/api/admin/businesses${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    let businesses: AdminBusiness[];
    if (Array.isArray(response)) {
      businesses = response;
    } else {
      businesses = response.businesses || [];
    }
    console.log(`[API] getAdminBusinesses - Fetched ${businesses.length} businesses. Sample IDs:`, businesses.slice(0, 3).map(b => ({ id: b.id, name: b.name })));
    return businesses;
  }

  async getAdminPhotographers(authToken: string, search?: string): Promise<AdminPhotographer[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.request<AdminPhotographer[]>(`/api/admin/photographers${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminInfluencers(authToken: string, status?: string): Promise<AdminInfluencer[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await this.request<{ applications: any[] }>(`/api/admin/influencers${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    const applications: any[] = response?.applications ?? [];
    return applications.map((app: any) => ({
      id: app.id,
      name: app.user?.name ?? app.userName ?? "",
      email: app.user?.email ?? app.userEmail,
      instagram: app.instagramUrl,
      followers: app.followerCount,
      status: app.status,
      createdAt: app.createdAt,
    }));
  }

  async getPaymentStats(authToken: string): Promise<PaymentStats> {
    return this.request<PaymentStats>("/api/admin/payments/stats", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminOrders(authToken: string): Promise<AdminOrder[]> {
    return this.request<AdminOrder[]>("/api/admin/orders", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminBookings(authToken: string): Promise<AdminBooking[]> {
    return this.request<AdminBooking[]>("/api/admin/bookings", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminRefunds(authToken: string): Promise<AdminRefund[]> {
    return this.request<AdminRefund[]>("/api/admin/refunds", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminConversations(authToken: string): Promise<AdminConversation[]> {
    return this.request<AdminConversation[]>("/api/admin/conversations", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async approveApplication(authToken: string, type: "business" | "influencer", id: string, notes?: string): Promise<{ success: boolean; business?: AdminBusinessDetail }> {
    const endpoint = type === "business"
      ? `/api/admin/businesses/${id}/approve`
      : `/api/admin/influencer-applications/${id}/approve`;
    console.log(`[API] approveApplication - Type: ${type}, ID: ${id}, Full URL: ${this.baseUrl}${endpoint}`);
    return this.request<{ success: boolean; business?: AdminBusinessDetail }>(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ notes }),
    });
  }

  async rejectApplication(authToken: string, type: "business" | "influencer", id: string, reason: string): Promise<{ success: boolean; business?: AdminBusinessDetail }> {
    const endpoint = type === "business"
      ? `/api/admin/businesses/${id}/reject`
      : `/api/admin/influencer-applications/${id}/reject`;
    console.log(`[API] rejectApplication - Type: ${type}, ID: ${id}, Full URL: ${this.baseUrl}${endpoint}`);
    return this.request<{ success: boolean; business?: AdminBusinessDetail }>(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ reason }),
    });
  }

  async getAdminApplications(authToken: string, status?: "pending" | "approved" | "rejected"): Promise<{ applications: AdminBusiness[] }> {
    const query = status ? `?status=${status}` : "";
    return this.request<{ applications: AdminBusiness[] }>(`/api/admin/applications${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminUserDetail(authToken: string, userId: string): Promise<{
    user: AdminUser;
    orders: AdminOrder[];
    bookings: AdminBooking[];
    conversations: AdminConversation[];
    earnings: number;
  }> {
    const response = await this.request<any>(`/api/admin/users/${userId}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    const user = response?.user || {};
    const accountType: AdminUser["accountType"] = user.isPhotographer
      ? "photographer"
      : user.isVendor
        ? "business"
        : "consumer";
    const status: AdminUser["status"] =
      user.status === "suspended" ||
      user.status === "disabled" ||
      user.isActive === false ||
      user.is_active === false
        ? "suspended"
        : "active";
    return {
      user: {
        id: user.id,
        name:
          user.name ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.email ||
          "Unknown User",
        email: user.email || "",
        username: user.username,
        avatar: user.avatar || user.profileImageUrl,
        accountType,
        createdAt: user.createdAt || new Date().toISOString(),
        status,
      },
      orders: response?.orders || [],
      bookings: response?.bookings || [],
      conversations: response?.conversations || [],
      earnings: typeof response?.earnings === "number" ? response.earnings : 0,
    };
  }

  async disableAdminUser(authToken: string, userId: string): Promise<{ success: boolean; user?: unknown }> {
    return this.request<{ success: boolean; user?: unknown }>(`/api/admin/users/${userId}/disable`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async enableAdminUser(authToken: string, userId: string): Promise<{ success: boolean; user?: unknown }> {
    return this.request<{ success: boolean; user?: unknown }>(`/api/admin/users/${userId}/enable`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminBusinessDetail(authToken: string, businessId: string): Promise<AdminBusinessDetail> {
    console.log(`[API] getAdminBusinessDetail - ID: ${businessId}, Full URL: ${this.baseUrl}/api/admin/businesses/${businessId}`);
    return this.request<AdminBusinessDetail>(`/api/admin/businesses/${businessId}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getPhotographerDashboard(authToken: string): Promise<{
    stats: PhotographerDashboardStats;
    profile: PhotographerDashboardProfile;
    billingAddress?: BillingAddress;
  }> {
    return this.request("/api/photographer/dashboard", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getPhotographerBookings(authToken: string, status?: string): Promise<PhotographerBooking[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<PhotographerBooking[]>(`/api/photographer/bookings${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getPhotographerServices(authToken: string): Promise<PhotographerService[]> {
    return this.request<PhotographerService[]>("/api/photographer/services", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updatePhotographerService(authToken: string, serviceId: string, data: Partial<PhotographerService>): Promise<PhotographerService> {
    return this.request<PhotographerService>(`/api/photographer/services/${serviceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async createPhotographerService(authToken: string, data: Omit<PhotographerService, "id">): Promise<PhotographerService> {
    return this.request<PhotographerService>("/api/photographer/services", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getPhotographerHours(authToken: string): Promise<PhotographerHours[]> {
    return this.request<PhotographerHours[]>("/api/photographer/hours", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updatePhotographerHours(authToken: string, hours: PhotographerHours[]): Promise<void> {
    await this.request<void>("/api/photographer/hours", {
      method: "PUT",
      body: JSON.stringify({ hours }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updatePhotographerProfile(authToken: string, data: Partial<PhotographerDashboardProfile>): Promise<PhotographerDashboardProfile> {
    return this.request<PhotographerDashboardProfile>("/api/photographers/me", {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updatePhotographerBillingAddress(authToken: string, address: BillingAddress): Promise<void> {
    await this.request<void>("/api/photographer/billing-address", {
      method: "PUT",
      body: JSON.stringify(address),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async connectStripe(authToken: string, type: "photographer" | "business"): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/api/${type}/connect-stripe`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/stripe/connect/complete - Verify Stripe Connect account and flip stripe_onboarding_complete
  async completeStripeConnect(authToken: string): Promise<{ complete: boolean; message?: string }> {
    console.log("[DeepLink] Calling /api/stripe/connect/complete");
    return this.request<{ complete: boolean; message?: string }>("/api/stripe/connect/complete", {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // ==========================================
  // VendorBooker Photographer Endpoints
  // ==========================================

  // GET /api/photographers/me - Get current photographer profile
  async getPhotographerMe(authToken: string): Promise<VendorBookerPhotographer> {
    return this.request<VendorBookerPhotographer>("/api/photographers/me", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/photographers/me - Update photographer profile
  // Backend accepts: displayName, bio, city, state, portfolioUrl, hourlyRate (in dollars), 
  // specialties (array), coverImage, logoImage, brandColors
  // Backend uses !== undefined checks, so we pass through values as-is
  async updatePhotographerMe(authToken: string, data: Record<string, any>): Promise<{ photographer: VendorBookerPhotographer }> {
    console.log("[API] updatePhotographerMe payload:", JSON.stringify(data, null, 2));
    
    // Pass through the data directly - caller is responsible for only sending changed fields
    // Backend will reject if no valid fields are provided
    if (!data || Object.keys(data).length === 0) {
      console.warn("[API] updatePhotographerMe: Empty payload");
      throw { message: "No changes to save.", status: 400 };
    }
    
    return this.request<{ photographer: VendorBookerPhotographer }>("/api/photographers/me", {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/users/me - Update current user profile (for consumers/influencers)
  async updateUserMe(authToken: string, data: { 
    profileImageUrl?: string | null; 
    coverMediaUrl?: string | null; 
    coverMediaType?: "image" | "video" | null;
    displayName?: string;
    username?: string;
    bio?: string;
    city?: string;
    state?: string;
  }): Promise<{ success: boolean; user?: any; message?: string }> {
    console.log("[API] updateUserMe payload:", JSON.stringify(data, null, 2));
    
    // Filter out undefined/null values to only send actual changes
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
    );
    
    if (!filteredData || Object.keys(filteredData).length === 0) {
      console.warn("[API] updateUserMe: Empty payload after filtering");
      throw { message: "No changes to save.", status: 400 };
    }
    
    console.log("[API] updateUserMe filtered payload:", JSON.stringify(filteredData, null, 2));
    
    return this.request<{ success: boolean; user?: any; message?: string }>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(filteredData),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/users/identity - Update username and/or display name
  async updateUserIdentity(authToken: string, data: { 
    username?: string; 
    displayName?: string;
  }): Promise<{ success: boolean; user?: any; message?: string }> {
    console.log("[API] updateUserIdentity payload:", JSON.stringify(data, null, 2));
    
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== null && value !== "")
    );
    
    if (!filteredData || Object.keys(filteredData).length === 0) {
      console.warn("[API] updateUserIdentity: Empty payload after filtering");
      throw { message: "No changes to save.", status: 400 };
    }
    
    return this.request<{ success: boolean; user?: any; message?: string }>("/api/users/identity", {
      method: "PATCH",
      body: JSON.stringify(filteredData),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/users/identity/status - Get cooldown status for username/display name changes
  async getUserIdentityStatus(authToken: string): Promise<{ 
    usernameCooldownDays?: number; 
    displayNameCooldownDays?: number;
    canChangeUsername: boolean;
    canChangeDisplayName: boolean;
  }> {
    return this.request<{ 
      usernameCooldownDays?: number; 
      displayNameCooldownDays?: number;
      canChangeUsername: boolean;
      canChangeDisplayName: boolean;
    }>("/api/users/identity/status", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/users/check-username - Check if a username is available
  async checkUsernameAvailable(username: string): Promise<{ available: boolean }> {
    return this.request<{ available: boolean }>(
      `/api/users/check-username?username=${encodeURIComponent(username)}`
    );
  }

  // GET /api/users/:id - Get public user profile by id
  async getPublicUser(userId: string): Promise<{ user: Record<string, any> }> {
    return this.request<{ user: Record<string, any> }>(`/api/users/${userId}`);
  }

  // GET /api/photographers/me/stripe-status - Get Stripe onboarding status
  async getPhotographerStripeStatus(authToken: string): Promise<StripeOnboardingStatus> {
    return this.request<StripeOnboardingStatus>("/api/photographers/me/stripe-status", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/photographers/me/stripe-onboarding - Start Stripe onboarding
  async startPhotographerStripeOnboarding(authToken: string, returnUrl?: string): Promise<{ url: string }> {
    const body: Record<string, string> = {};
    if (returnUrl) {
      body.returnUrl = returnUrl;
      body.refreshUrl = returnUrl;
    }
    return this.request<{ url: string }>("/api/photographers/me/stripe-onboarding", {
      method: "POST",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getPhotographerStripeDashboardLink(authToken: string): Promise<{ url: string }> {
    return this.request<{ url: string }>("/api/photographers/me/stripe-dashboard-link", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/photographers/me/services - Get photographer's services
  async getPhotographerMeServices(authToken: string): Promise<{ services: VendorBookerPhotographerService[] }> {
    return this.request<{ services: VendorBookerPhotographerService[] }>("/api/photographers/me/services", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/photographers/:id/services - Get public services for a photographer
  async getPhotographerPublicServices(photographerId: string): Promise<VendorBookerPhotographerService[]> {
    return this.request<VendorBookerPhotographerService[]>(`/api/photographers/${photographerId}/services`);
  }

  // GET /api/photographers/:id/availability - Get public availability for a photographer
  async getPhotographerPublicAvailability(photographerId: string): Promise<{ availability: VendorBookerAvailabilitySlot[] }> {
    return this.request<{ availability: VendorBookerAvailabilitySlot[] }>(`/api/photographers/${photographerId}/availability`);
  }

  // GET /api/photographers/:id/blocked-dates - Get public blocked dates for a photographer
  async getPhotographerPublicBlockedDates(photographerId: string): Promise<{ blockedDates: BlockedDate[] }> {
    return this.request<{ blockedDates: BlockedDate[] }>(`/api/photographers/${photographerId}/blocked-dates`);
  }

  // POST /api/photographers/me/services - Create a new service
  async createPhotographerMeService(authToken: string, data: Partial<VendorBookerPhotographerService>): Promise<{ service: VendorBookerPhotographerService }> {
    return this.request<{ service: VendorBookerPhotographerService }>("/api/photographers/me/services", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/photographers/me/services/:id - Update a service
  async updatePhotographerMeService(authToken: string, serviceId: string, data: Partial<VendorBookerPhotographerService>): Promise<{ service: VendorBookerPhotographerService }> {
    return this.request<{ service: VendorBookerPhotographerService }>(`/api/photographers/me/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // DELETE /api/photographers/me/services/:id - Delete a service
  async deletePhotographerMeService(authToken: string, serviceId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/photographers/me/services/${serviceId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/photographers/me/services/:id/go-live - Publish a service (creates Stripe product)
  async goLivePhotographerService(authToken: string, serviceId: string): Promise<{ service: VendorBookerPhotographerService }> {
    return this.request<{ service: VendorBookerPhotographerService }>(`/api/photographers/me/services/${serviceId}/go-live`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/photographers/me/services/:id/archive - Archive a service
  async archivePhotographerService(authToken: string, serviceId: string): Promise<{ service: VendorBookerPhotographerService }> {
    return this.request<{ service: VendorBookerPhotographerService }>(`/api/photographers/me/services/${serviceId}/archive`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/photographers/me/availability - Get weekly schedule and travel settings
  async getPhotographerMeAvailability(authToken: string): Promise<{
    hoursOfOperation: Record<string, { open: boolean; start?: string; end?: string }>;
    travel_buffer_minutes: number;
    service_radius_miles: number;
    service_locations: Array<{ name: string; address: string }>;
    blackoutDates: Array<{ id: number; date: string; reason?: string }>;
  }> {
    return this.request<{
      hoursOfOperation: Record<string, { open: boolean; start?: string; end?: string }>;
      travel_buffer_minutes: number;
      service_radius_miles: number;
      service_locations: Array<{ name: string; address: string }>;
      blackoutDates: Array<{ id: number; date: string; reason?: string }>;
    }>("/api/photographers/me/availability", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PUT /api/photographers/me/availability - Update base hours and travel buffer settings
  async updatePhotographerMeAvailability(
    authToken: string,
    data: {
      hoursOfOperation?: Record<string, { open: boolean; start?: string; end?: string }>;
      travel_buffer_minutes?: number;
      service_radius_miles?: number;
      service_locations?: Array<{ name: string; address: string }>;
    }
  ): Promise<{
    hoursOfOperation: Record<string, { open: boolean; start?: string; end?: string }>;
    travel_buffer_minutes: number;
    service_radius_miles: number;
    service_locations: Array<{ name: string; address: string }>;
  }> {
    return this.request<{
      hoursOfOperation: Record<string, { open: boolean; start?: string; end?: string }>;
      travel_buffer_minutes: number;
      service_radius_miles: number;
      service_locations: Array<{ name: string; address: string }>;
    }>("/api/photographers/me/availability", {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/photographers/me/availability/blackout-dates - Add blackout date
  async addPhotographerBlackoutDate(
    authToken: string,
    data: { date: string; reason?: string }
  ): Promise<{ blackoutDate: { id: number; date: string; reason?: string } }> {
    return this.request<{ blackoutDate: { id: number; date: string; reason?: string } }>(
      "/api/photographers/me/availability/blackout-dates",
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Authorization": `Bearer ${authToken}` },
      }
    );
  }

  // DELETE /api/photographers/me/availability/blackout-dates/:id - Remove blackout date
  async removePhotographerBlackoutDate(authToken: string, blackoutDateId: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/api/photographers/me/availability/blackout-dates/${blackoutDateId}`,
      {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authToken}` },
      }
    );
  }

  // GET /api/photographers/me/bookings - Get booking records
  async getPhotographerMeBookings(authToken: string): Promise<{ bookings: PhotographerBooking[] }> {
    return this.request<{ bookings: PhotographerBooking[] }>("/api/photographers/me/bookings", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/photographers/me/blocked-dates - Get blocked dates (legacy, now uses blackout-dates)
  async getPhotographerBlockedDates(authToken: string): Promise<{ blockedDates: BlockedDate[] }> {
    try {
      const result = await this.getPhotographerMeAvailability(authToken);
      const blockedDates: BlockedDate[] = (result.blackoutDates || []).map((bd) => ({
        id: bd.id.toString(),
        date: bd.date,
        isFullDay: true,
        reason: bd.reason,
      }));
      return { blockedDates };
    } catch {
      return { blockedDates: [] };
    }
  }

  // PUT /api/photographers/me/blocked-dates - Update blocked dates (legacy adapter)
  async updatePhotographerBlockedDates(authToken: string, blockedDates: BlockedDate[]): Promise<{ blockedDates: BlockedDate[] }> {
    console.warn("[API] updatePhotographerBlockedDates is deprecated - use addPhotographerBlackoutDate/removePhotographerBlackoutDate");
    return { blockedDates };
  }

  // ==========================================
  // VendorBooker Business/Vendor Endpoints
  // ==========================================

  // GET /api/vendor/my-business - Get current business profile
  async getVendorMyBusiness(authToken: string): Promise<{ business: VendorBookerBusiness }> {
    return this.request<{ business: VendorBookerBusiness }>("/api/vendor/my-business", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/business/stats - Summary stats for the authenticated business owner
  async getBusinessStats(authToken: string): Promise<{
    stats: {
      orderCount: number;
      bookingCount: number;
      monthlyRevenueCents: number;
      reviewCount: number;
      averageRating: number;
    };
  }> {
    return this.request<{
      stats: {
        orderCount: number;
        bookingCount: number;
        monthlyRevenueCents: number;
        reviewCount: number;
        averageRating: number;
      };
    }>("/api/business/stats", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/vendor/my-business - Update business profile
  async updateVendorMyBusiness(authToken: string, data: Partial<BusinessOnboardingData>): Promise<{ business: VendorBookerBusiness }> {
    console.log("[API] updateVendorMyBusiness RAW input:", JSON.stringify(data, null, 2));
    
    // Build defensive payload - strip only undefined values
    const cleanPayload: Record<string, any> = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    console.log("[API] updateVendorMyBusiness CLEAN payload:", JSON.stringify(cleanPayload, null, 2));
    
    // Don't send empty payloads
    if (Object.keys(cleanPayload).length === 0) {
      console.warn("[API] updateVendorMyBusiness: No valid fields to update after filtering");
      throw { message: "No changes to save. Please modify at least one field.", status: 400 };
    }
    
    return this.request<{ business: VendorBookerBusiness }>("/api/vendor/my-business", {
      method: "PATCH",
      body: JSON.stringify(cleanPayload),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/stripe-onboarding/create-link - Start Stripe onboarding for vendor
  async startVendorStripeOnboarding(authToken: string, returnUrl?: string): Promise<{ url: string }> {
    const body: Record<string, string> = {};
    if (returnUrl) {
      body.returnUrl = returnUrl;
      body.refreshUrl = returnUrl;
    }
    return this.request<{ url: string }>("/api/vendor/stripe-onboarding/create-link", {
      method: "POST",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/vendor/stripe-onboarding/status - Get vendor Stripe status
  async getVendorStripeStatus(authToken: string): Promise<StripeOnboardingStatus & { hasStripeAccount: boolean; onboardingComplete: boolean }> {
    return this.request<StripeOnboardingStatus & { hasStripeAccount: boolean; onboardingComplete: boolean }>("/api/vendor/stripe-onboarding/status", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getVendorStripeDashboardLink(authToken: string): Promise<{ url: string }> {
    return this.request<{ url: string }>("/api/vendor/stripe-dashboard-link", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/vendor/customers - Get orders and booking records
  async getVendorCustomers(authToken: string): Promise<{ records: BusinessOrder[] }> {
    return this.request<{ records: BusinessOrder[] }>("/api/vendor/customers", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/vendor/staff - Get staff members
  async getVendorStaff(authToken: string): Promise<{ staff: any[] }> {
    return this.request<{ staff: any[] }>("/api/vendor/staff", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/staff/invites - Send a staff invite by email
  async createStaffInvite(
    authToken: string,
    data: { email: string; role?: "staff" | "manager"; phone?: string },
  ): Promise<{ invite: any; sent: boolean; seatWarning: string | null }> {
    return this.request<{ invite: any; sent: boolean; seatWarning: string | null }>("/api/vendor/staff/invites", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/vendor/staff/invites - List invites for the authenticated business
  async getStaffInvites(authToken: string): Promise<{ invites: any[] }> {
    return this.request<{ invites: any[] }>("/api/vendor/staff/invites", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/vendor/staff/seat-status - Get current seat usage for the authenticated business
  async getStaffSeatStatus(
    authToken: string,
  ): Promise<{ activeCount: number; pendingCount: number; usedSeats: number; maxStaff: number | null; tierName: string }> {
    return this.request<{ activeCount: number; pendingCount: number; usedSeats: number; maxStaff: number | null; tierName: string }>(
      "/api/vendor/staff/seat-status",
      {
        headers: { "Authorization": `Bearer ${authToken}` },
      },
    );
  }

  // DELETE /api/vendor/staff/:staffId - Archive (soft-delete) a staff member. Re-inviting the
  // same email later reactivates this row server-side rather than creating a new one.
  async deleteStaffMember(authToken: string, staffId: string): Promise<{ staff?: any; message: string }> {
    return this.request<{ staff?: any; message: string }>(`/api/vendor/staff/${staffId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // DELETE /api/vendor/staff/invites/:inviteId - Revoke a pending staff invite.
  async deleteStaffInvite(authToken: string, inviteId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/vendor/staff/invites/${inviteId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/staff/me - Get the staff profile for the authenticated user (404 = not a staff member).
  // businessId disambiguates for a user staffing 2+ businesses (see resolveStaffProfile in
  // AuthContext) — omit only when the caller knows the user has exactly one staff membership.
  // Full shape of the real staff_members row the backend returns (server/storage.ts StaffMember) —
  // wider than the original narrow inline type, needed for the Staff Dashboard build.
  async getStaffMe(authToken: string, businessId?: string): Promise<{ staff: StaffMemberProfile }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ staff: StaffMemberProfile }>(`/api/staff/me${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/staff/me - Update the authenticated staff member's own profile.
  async updateStaffMe(token: string, payload: Record<string, any>) {
    return this.request('/api/staff/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  }

  // GET /api/staff/my-bookings - Appointments assigned to the authenticated staff member.
  // businessId disambiguates for a user staffing 2+ businesses (same contract as getStaffMe).
  async getStaffMyBookings(authToken: string, businessId?: string): Promise<{ bookings: StaffBooking[] }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ bookings: StaffBooking[] }>(`/api/staff/my-bookings${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/staff/my-availability - The staff member's own availability/blocked slots.
  async getStaffMyAvailability(
    authToken: string,
    startDate?: string,
    endDate?: string,
    businessId?: string,
  ): Promise<{ availability: StaffAvailabilitySlot[] }> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (businessId) params.set("businessId", businessId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ availability: StaffAvailabilitySlot[] }>(`/api/staff/my-availability${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/staff/my-availability - Create an "available" or "blocked" slot for a specific date.
  async createStaffAvailability(
    authToken: string,
    data: { date: string; startTime: string; endTime: string; slotType?: "available" | "blocked"; businessId?: string },
  ): Promise<{ availability: StaffAvailabilitySlot }> {
    return this.request<{ availability: StaffAvailabilitySlot }>("/api/staff/my-availability", {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(data),
    });
  }

  // DELETE /api/staff/my-availability/:id - Remove one of the staff member's own slots.
  async deleteStaffAvailability(authToken: string, id: string, businessId?: string): Promise<{ success: boolean }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ success: boolean }>(`/api/staff/my-availability/${id}${query}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/staff/my-earnings - Total/this-month/pending payout summary for the staff member.
  async getStaffMyEarnings(
    authToken: string,
    businessId?: string,
  ): Promise<{ total: number; thisMonth: number; pending: number }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ total: number; thisMonth: number; pending: number }>(`/api/staff/my-earnings${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/staff/my-services - The staff member's own assigned services, already filtered
  // server-side (live + assigned to this staff member) — no isBusinessVisibleToPublic gate,
  // so this works even if the business hasn't finished onboarding (unlike getBusinessPublicServices).
  async getStaffMyServices(authToken: string, businessId?: string): Promise<{ services: VendorService[] }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ services: VendorService[] }>(`/api/staff/my-services${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/staff/services - Create a new staff-owned service (always starts as draft)
  async createStaffService(authToken: string, data: StaffServiceInput, businessId?: string): Promise<{ service: VendorService }> {
    return this.request<{ service: VendorService }>("/api/staff/services", {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(businessId ? { ...data, businessId } : data),
    });
  }

  // PATCH /api/staff/services/:id - Update an existing staff-owned service
  async updateStaffService(authToken: string, serviceId: string, data: Partial<StaffServiceInput>, businessId?: string): Promise<{ service: VendorService }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ service: VendorService }>(`/api/staff/services/${serviceId}${query}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(data),
    });
  }

  // DELETE /api/staff/services/:id - Delete a staff-owned service
  async deleteStaffService(authToken: string, serviceId: string, businessId?: string): Promise<void> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    await this.request<void>(`/api/staff/services/${serviceId}${query}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/staff/services/:id/go-live - Publish a staff-owned service
  async goLiveStaffService(authToken: string, serviceId: string, businessId?: string): Promise<{ service: VendorService }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ service: VendorService }>(`/api/staff/services/${serviceId}/go-live${query}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/staff/services/:id/archive - Archive a staff-owned service
  async archiveStaffService(authToken: string, serviceId: string, businessId?: string): Promise<{ service: VendorService }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ service: VendorService }>(`/api/staff/services/${serviceId}/archive${query}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/staff/me/weekly-availability — Fetch the staff member's recurring weekly schedule
  async getStaffWeeklyAvailability(
    authToken: string,
    businessId?: string,
  ): Promise<{ availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> }> {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    return this.request<{ availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> }>(
      `/api/staff/me/weekly-availability${query}`,
      { headers: { "Authorization": `Bearer ${authToken}` } },
    );
  }

  // PUT /api/staff/me/weekly-availability — Replace the staff member's recurring weekly schedule
  async setStaffWeeklyAvailability(
    authToken: string,
    businessId: string,
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>,
  ): Promise<{ availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> }> {
    return this.request<{ availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> }>(
      `/api/staff/me/weekly-availability?businessId=${encodeURIComponent(businessId)}`,
      {
        method: "PUT",
        headers: { "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ slots }),
      },
    );
  }

  // POST /api/staff/stripe-onboarding/create-link - Start Stripe payout onboarding for a staff member
  async startStaffStripeOnboarding(authToken: string, businessId?: string): Promise<{ url: string }> {
    return this.request<{ url: string }>("/api/staff/stripe-onboarding/create-link", {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: businessId ? JSON.stringify({ businessId }) : undefined,
    });
  }

  // ==========================================
  // VendorBooker Products CRUD
  // ==========================================

  // GET /api/vendor/products - Get all products
  async getVendorProducts(authToken: string): Promise<{ products: VendorProduct[] }> {
    return this.request<{ products: VendorProduct[] }>("/api/vendor/products", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/products - Create a new product
  async createVendorProduct(authToken: string, data: VendorProductInput): Promise<{ product: VendorProduct }> {
    const { priceCents, ...rest } = data;
    const payload = { ...rest, price: priceCents };
    delete payload.status;
    console.log("[createVendorProduct] raw form data:", JSON.stringify(data));
    console.log("[createVendorProduct] final payload:", JSON.stringify(payload));
    console.log("[createVendorProduct] typeof payload.price:", typeof payload.price);
    return this.request<{ product: VendorProduct }>("/api/vendor/products", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/products/:id/go-live - Publish a product (creates Stripe product)
  async goLiveVendorProduct(authToken: string, productId: string): Promise<{ product: VendorProduct; message?: string }> {
    return this.request<{ product: VendorProduct; message?: string }>(`/api/vendor/products/${productId}/go-live`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/vendor/products/:id - Update a product
  async updateVendorProduct(authToken: string, productId: string, data: Partial<VendorProductInput>): Promise<{ product: VendorProduct }> {
    const { priceCents, ...rest } = data;
    const priceField: { price: number } | Record<string, never> = priceCents !== undefined ? { price: priceCents } : {};
    const payload = { ...rest, ...priceField };
    delete payload.status;
    console.log("[updateVendorProduct] raw form data:", JSON.stringify(data));
    console.log("[updateVendorProduct] final payload:", JSON.stringify(payload));
    console.log("[updateVendorProduct] typeof payload.price:", priceCents !== undefined ? typeof priceCents : "undefined");
    return this.request<{ product: VendorProduct }>(`/api/vendor/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // DELETE /api/vendor/products/:id - Delete a product
  async deleteVendorProduct(authToken: string, productId: string): Promise<void> {
    await this.request<void>(`/api/vendor/products/${productId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // ==========================================
  // VendorBooker Services CRUD
  // ==========================================

  // GET /api/vendor/services - Get all services
  async getVendorServices(authToken: string): Promise<{ services: VendorService[] }> {
    return this.request<{ services: VendorService[] }>("/api/vendor/services", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/services - Create a new service
  async createVendorService(authToken: string, data: VendorServiceInput): Promise<{ service: VendorService }> {
    const { priceCents, ...rest } = data;
    const payload = { ...rest, price: priceCents };
    delete payload.status; // backend create schema does not accept `status`
    return this.request<{ service: VendorService }>("/api/vendor/services", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/services/:id/go-live - Publish a service (creates Stripe product)
  async goLiveVendorService(authToken: string, serviceId: string): Promise<{ service: VendorService; message?: string }> {
    return this.request<{ service: VendorService; message?: string }>(`/api/vendor/services/${serviceId}/go-live`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/vendor/services/:id - Update a service
  async updateVendorService(authToken: string, serviceId: string, data: Partial<VendorServiceInput>): Promise<{ service: VendorService }> {
    const { priceCents, ...rest } = data;
    const priceField: { price: number } | Record<string, never> = priceCents !== undefined ? { price: priceCents } : {};
    const payload = { ...rest, ...priceField };
    delete payload.status;
    return this.request<{ service: VendorService }>(`/api/vendor/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/vendor/services/:id/apply-cancellation-policy-to-all
  async applyCancellationPolicyToAll(authToken: string, serviceId: string): Promise<{ success: boolean; updatedCount: number }> {
    return this.request<{ success: boolean; updatedCount: number }>(
      `/api/vendor/services/${serviceId}/apply-cancellation-policy-to-all`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}` },
      },
    );
  }

  // DELETE /api/vendor/services/:id - Delete a service
  async deleteVendorService(authToken: string, serviceId: string): Promise<void> {
    await this.request<void>(`/api/vendor/services/${serviceId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessDashboard(authToken: string): Promise<{
    stats: BusinessDashboardStats;
    profile: BusinessDashboardProfile;
    billingAddress?: BillingAddress;
  }> {
    return this.request("/api/business/dashboard", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessOrders(authToken: string, status?: string): Promise<{ orders: BusinessOrder[] }> {
    const query = status ? `?status=${status}` : "";
    return this.request<{ orders: BusinessOrder[] }>(`/api/business/orders${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessBookings(authToken: string, status?: string): Promise<{ bookings: BusinessBooking[] }> {
    const query = status ? `?status=${status}` : "";
    return this.request<{ bookings: BusinessBooking[] }>(`/api/business/bookings${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessProducts(authToken: string): Promise<{ products: BusinessProduct[] }> {
    return this.request<{ products: BusinessProduct[] }>("/api/business/products", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateBusinessProduct(authToken: string, productId: string, data: Partial<BusinessProduct>): Promise<BusinessProduct> {
    return this.request<BusinessProduct>(`/api/business/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async createBusinessProduct(authToken: string, data: Omit<BusinessProduct, "id">): Promise<BusinessProduct> {
    return this.request<BusinessProduct>("/api/business/products", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessServices(authToken: string): Promise<{ services: BusinessService[] }> {
    return this.request<{ services: BusinessService[] }>("/api/business/services", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateBusinessService(authToken: string, serviceId: string, data: Partial<BusinessService>): Promise<BusinessService> {
    return this.request<BusinessService>(`/api/business/services/${serviceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async createBusinessService(authToken: string, data: Omit<BusinessService, "id">): Promise<BusinessService> {
    return this.request<BusinessService>("/api/business/services", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateBusinessProfile(authToken: string, data: Partial<BusinessDashboardProfile>): Promise<BusinessDashboardProfile> {
    return this.request<BusinessDashboardProfile>("/api/business/profile", {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateBusinessBillingAddress(authToken: string, address: BillingAddress): Promise<void> {
    await this.request<void>("/api/business/billing-address", {
      method: "PUT",
      body: JSON.stringify(address),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateBookingStatus(authToken: string, type: "photographer" | "business", bookingId: string, status: string): Promise<void> {
    await this.request<void>(`/api/${type}/bookings/${bookingId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateOrderStatus(
    authToken: string,
    orderId: string,
    status: string,
    shipment?: { trackingNumber: string; carrier: string }
  ): Promise<void> {
    await this.request<void>(`/api/business/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...shipment }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async updateShipmentStatus(
    authToken: string,
    shipmentId: string,
    status: string
  ): Promise<void> {
    await this.request<void>(`/api/shipments/${shipmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async confirmDelivery(authToken: string, orderId: string): Promise<void> {
    await this.request<void>(`/api/orders/${orderId}/confirm-delivery`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Accept a pending booking
  async acceptBooking(
    authToken: string, 
    type: "photographer" | "business", 
    bookingId: string
  ): Promise<{ success: boolean; booking?: PhotographerBooking | BusinessBooking }> {
    const endpoint = type === "photographer" 
      ? `/api/bookings/photographer/${bookingId}/accept`
      : `/api/bookings/appointments/${bookingId}/accept`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Decline a pending booking (triggers refund/void)
  async declineBooking(
    authToken: string, 
    type: "photographer" | "business", 
    bookingId: string,
    reason?: string
  ): Promise<{ success: boolean; refunded?: boolean }> {
    const endpoint = type === "photographer" 
      ? `/api/bookings/photographer/${bookingId}/decline`
      : `/api/bookings/appointments/${bookingId}/decline`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ reason }),
    });
  }

  // Issue refund for a confirmed booking
  async issueRefund(
    authToken: string, 
    type: "photographer" | "business", 
    bookingId: string,
    amount?: number // Optional partial refund amount, full refund if not provided
  ): Promise<{ success: boolean; refundedAmount?: number; message?: string }> {
    const endpoint = type === "photographer" 
      ? `/api/bookings/photographer/${bookingId}/refund`
      : `/api/bookings/appointments/${bookingId}/refund`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ amount }),
    });
  }

  // Consumer-initiated cancel — applies the service's cancellation policy
  async cancelAppointment(
    authToken: string,
    appointmentId: string
  ): Promise<{
    success: boolean;
    refundTier: string;
    refundAmountCents: number;
    feeAmountCents: number;
    feeCharged: boolean;
    feeNeedsManualCollection: boolean;
  }> {
    return this.request(`/api/bookings/appointments/${appointmentId}/cancel`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Consumer-initiated cancel for a photographer shoot booking
  async cancelShootBooking(
    authToken: string,
    bookingId: string
  ): Promise<{
    success: boolean;
    refundTier: string;
    refundAmountCents: number;
    feeAmountCents: number;
    feeCharged: boolean;
    feeNeedsManualCollection: boolean;
  }> {
    return this.request(`/api/bookings/shoot/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Read-only preview of what would happen if the consumer cancels right now.
  // No side effects — safe to call repeatedly or without following up with a real cancel.
  async getAppointmentCancelPreview(
    authToken: string,
    appointmentId: string
  ): Promise<
    | { cancellable: true; refundTier: "full" | "partial" | "none"; refundAmountCents: number; feeAmountCents: number; feeWouldBeCharged: boolean; feeNeedsManualCollection: boolean; subtotalCents: number; grossChargeAmountCents: number }
    | { cancellable: false; reason: string; currentStatus: string }
  > {
    return this.request(`/api/bookings/appointments/${appointmentId}/cancel-preview`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getShootCancelPreview(
    authToken: string,
    bookingId: string
  ): Promise<
    | { cancellable: true; refundTier: "full" | "partial" | "none"; refundAmountCents: number; feeAmountCents: number; feeWouldBeCharged: boolean; feeNeedsManualCollection: boolean; subtotalCents: number; grossChargeAmountCents: number }
    | { cancellable: false; reason: string; currentStatus: string }
  > {
    return this.request(`/api/bookings/shoot/${bookingId}/cancel-preview`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Cancel a confirmed appointment as no-show without issuing a refund
  async cancelBookingNoRefund(
    authToken: string,
    appointmentId: string,
    reason?: string
  ): Promise<{ success: boolean; appointment?: any }> {
    return this.request(`/api/bookings/appointments/${appointmentId}/cancel-no-refund`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ reason }),
    });
  }

  // Create payment intent for service booking (returns clientSecret for PaymentSheet)
  async createBookingPaymentIntent(
    authToken: string,
    type: "photographer" | "business",
    bookingId: string
  ): Promise<{ clientSecret: string; paymentIntentId: string; captureMethod: "automatic" | "manual" }> {
    const endpoint = type === "photographer"
      ? `/api/bookings/photographer/${bookingId}/create-payment-intent`
      : `/api/bookings/appointments/${bookingId}/create-payment-intent`;
    return this.request(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Update provider settings (auto-accept, etc.)
  async updateProviderSettings(
    authToken: string,
    type: "photographer" | "business",
    settings: Partial<ProviderSettings>
  ): Promise<{ success: boolean; settings: ProviderSettings }> {
    return this.request(`/api/${type}/settings`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(settings),
    });
  }

  async updateBusinessSettings(
    authToken: string,
    settings: { autoAcceptBookings: boolean }
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/business/settings", {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(settings),
    });
  }

  async updatePhotographerSettings(
    authToken: string,
    settings: { autoAcceptBookings: boolean }
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/photographers/me/settings", {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(settings),
    });
  }

  // Get provider settings
  async getProviderSettings(
    authToken: string,
    type: "photographer" | "business"
  ): Promise<ProviderSettings> {
    return this.request<ProviderSettings>(`/api/${type}/settings`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Weekly availability endpoints
  async getWeeklyAvailability(
    authToken: string,
    type: "photographer" | "business"
  ): Promise<WeeklyAvailabilitySlot[]> {
    const endpoint = type === "photographer"
      ? "/api/photographers/me/weekly-availability"
      : "/api/businesses/me/weekly-availability";
    const response = await this.request<{ availability: WeeklyAvailabilitySlot[], autoAcceptBookings?: boolean } | WeeklyAvailabilitySlot[]>(endpoint, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    // Backend may return { availability: [...] } or array directly - handle both
    if (Array.isArray(response)) {
      return response;
    }
    return response.availability || [];
  }

  // The endpoint returns { availability: [...] }, not a bare array. This method
  // flattens that envelope so the declared return type is true — do not
  // "simplify" it back to a bare request<WeeklyAvailabilitySlot[]> call.
  async updateWeeklyAvailability(
    authToken: string,
    type: "photographer" | "business",
    availability: WeeklyAvailabilitySlot[]
  ): Promise<WeeklyAvailabilitySlot[]> {
    const endpoint = type === "photographer"
      ? "/api/photographers/me/weekly-availability"
      : "/api/businesses/me/weekly-availability";
    const response = await this.request<{ availability?: WeeklyAvailabilitySlot[] } | WeeklyAvailabilitySlot[] | null>(endpoint, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ slots: availability }),
    });
    if (Array.isArray(response)) {
      return response;
    }
    return response?.availability ?? [];
  }

  // Blocked dates/times endpoints
  //
  // The endpoint returns { blocks: [...] }, not a bare array. This method
  // flattens that envelope so the declared return type is true — do not
  // "simplify" it back to a bare request<AvailabilityBlock[]> call.
  async getBlocks(
    authToken: string,
    type: "photographer" | "business"
  ): Promise<AvailabilityBlock[]> {
    const endpoint = type === "photographer"
      ? "/api/photographers/me/blocks"
      : "/api/businesses/me/blocks";
    const response = await this.request<{ blocks?: AvailabilityBlock[] } | AvailabilityBlock[] | null>(endpoint, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    if (Array.isArray(response)) {
      return response;
    }
    return response?.blocks ?? [];
  }

  // The endpoint returns { block: {...} }, not a bare object. This method
  // flattens that envelope so the declared return type is true — do not
  // "simplify" it back to a bare request<AvailabilityBlock> call.
  // Callers store the returned .id and pass it to deleteBlock, so an id-less
  // object silently makes the block undeletable; an unrecognised shape throws
  // rather than returning one.
  async createBlock(
    authToken: string,
    type: "photographer" | "business",
    block: Omit<AvailabilityBlock, "id">
  ): Promise<AvailabilityBlock> {
    const endpoint = type === "photographer"
      ? "/api/photographers/me/blocks"
      : "/api/businesses/me/blocks";
    const response = await this.request<{ block?: AvailabilityBlock } | AvailabilityBlock | null>(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(block),
    });
    return unwrapBlockResponse(response, "create");
  }

  // The endpoint returns { block: {...} }, not a bare object. This method
  // flattens that envelope so the declared return type is true — do not
  // "simplify" it back to a bare request<AvailabilityBlock> call.
  // Callers store the returned .id and pass it to deleteBlock, so an id-less
  // object silently makes the block undeletable; an unrecognised shape throws
  // rather than returning one.
  async updateBlock(
    authToken: string,
    type: "photographer" | "business",
    blockId: string,
    updates: Partial<AvailabilityBlock>
  ): Promise<AvailabilityBlock> {
    const endpoint = type === "photographer"
      ? "/api/photographers/me/blocks"
      : "/api/businesses/me/blocks";
    const response = await this.request<{ block?: AvailabilityBlock } | AvailabilityBlock | null>(endpoint, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ id: blockId, ...updates }),
    });
    return unwrapBlockResponse(response, "update");
  }

  async deleteBlock(
    authToken: string,
    type: "photographer" | "business",
    blockId: string
  ): Promise<{ success: boolean }> {
    const endpoint = type === "photographer"
      ? "/api/photographers/me/blocks"
      : "/api/businesses/me/blocks";
    return this.request<{ success: boolean }>(endpoint, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ id: blockId }),
    });
  }

  async notifyAdminBusinessApplication(data: {
    businessName: string;
    businessCategory: string;
    ownerName: string;
    ownerEmail: string;
    city: string;
    state: string;
  }): Promise<{ success: boolean }> {
    try {
      return await this.request<{ success: boolean }>("/api/admin/notifications/business-application", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      return { success: false };
    }
  }

  normalizeSearchResults(response: SearchResponse, isAdmin: boolean = false): UnifiedSearchResult[] {
    const results: UnifiedSearchResult[] = [];

    const isDemoOwner = (ownerId?: string) => {
      if (!ownerId) return false;
      return ownerId.startsWith("demo-") || ownerId.includes("demo");
    };

    const isVisibleToUsers = (entity: { ownerId?: string; userId?: string; approvalStatus?: string; stripeOnboardingComplete?: boolean }) => {
      if (isAdmin) return true;
      const ownerField = entity.ownerId || entity.userId;
      if (isDemoOwner(ownerField)) return false;
      if (entity.approvalStatus && entity.approvalStatus !== "approved") return false;
      if (entity.stripeOnboardingComplete === false) return false;
      return true;
    };

    if (response.businesses && Array.isArray(response.businesses)) {
      response.businesses.forEach(b => {
        if (!isVisibleToUsers(b)) return;

        const category = (b.category || b.type || "business").toLowerCase();
        let resultType: SearchResultType = "business";
        
        if (category.includes("product") || category.includes("shop") || category.includes("store")) {
          resultType = "product";
        } else if (category.includes("service") || category.includes("salon") || category.includes("spa")) {
          resultType = "service";
        }

        results.push({
          id: b.id,
          name: b.name || "Unknown Business",
          avatar: b.avatar || b.image || "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400",
          city: b.city || "Unknown",
          state: b.state || "",
          rating: b.rating || 0,
          priceRange: b.priceRange || "$",
          category: b.category || "General",
          description: b.description || "",
          subscriptionTier: b.subscriptionTier,
          resultType,
          originalType: b.type,
        });
      });
    }

    if (response.photographers && Array.isArray(response.photographers)) {
      response.photographers.forEach(p => {
        if (!isVisibleToUsers(p)) return;

        // Check for separate city/state fields first, then fall back to parsing location string
        let city = p.city || "";
        let state = p.state || "";
        if (!city && p.location) {
          const locationParts = p.location.split(",").map(s => s.trim());
          city = locationParts[0] || "";
          state = locationParts[1] || "";
        }

        // Helper to validate image URLs (filter out local file paths)
        const isValidImageUrl = (url?: string): string => {
          if (!url) return "";
          if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
          }
          return "";
        };

        // Check multiple field names for avatar: logoImage, avatar, image
        const avatarUrl = isValidImageUrl(p.logoImage) || isValidImageUrl(p.avatar) || isValidImageUrl(p.image) || "";
        const coverUrl = isValidImageUrl(p.coverImage) || "";
        
        // Check multiple field names for name: displayName, name
        const displayName = p.displayName || p.name || "Unknown Photographer";
        
        // Check multiple field names for description: bio, description
        const description = p.bio || p.description || "";
        
        results.push({
          id: p.id,
          userId: p.userId,
          name: displayName,
          avatar: avatarUrl || "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=400",
          coverImage: coverUrl,
          city: city || "Unknown",
          state: state,
          rating: p.rating || 0,
          priceRange: p.priceRange || "$$",
          category: p.specialty || "Photography",
          description: description,
          subscriptionTier: p.subscriptionTier,
          resultType: "photographer",
        });
      });
    }

    if (response.staff && Array.isArray(response.staff)) {
      response.staff.forEach(s => {
        results.push({
          id: s.id,
          name: s.displayName || "Team Member",
          avatar: s.profileImageUrl || "",
          city: "Unknown",
          state: "",
          rating: s.rating || 0,
          priceRange: "",
          category: s.specialties?.[0] || "Staff",
          description: s.bio || "",
          resultType: "staff",
        });
      });
    }

    return results;
  }

  // Follow/Unfollow API
  async followUser(targetUserId: string, targetType: "user" | "photographer" | "business"): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/follows", {
      method: "POST",
      body: JSON.stringify({ targetUserId, targetType }),
    });
  }

  async unfollowUser(targetUserId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/follows/${targetUserId}`, {
      method: "DELETE",
    });
  }

  async checkFollowStatus(targetUserId: string): Promise<{ isFollowing: boolean }> {
    try {
      return await this.request<{ isFollowing: boolean }>(`/api/follows/check/${targetUserId}`);
    } catch {
      return { isFollowing: false };
    }
  }

  async getFollowNotifications(): Promise<Array<{
    id: string;
    type: "follow";
    followerId: string;
    followerName: string;
    followerAvatar?: string;
    createdAt: string;
  }>> {
    try {
      return await this.request<Array<{
        id: string;
        type: "follow";
        followerId: string;
        followerName: string;
        followerAvatar?: string;
        createdAt: string;
      }>>("/api/notifications/follows");
    } catch {
      return [];
    }
  }

  async getUserNotifications(authToken: string): Promise<{
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      referenceType?: string;
      referenceId?: string;
      metadata?: Record<string, any>;
      createdAt: string;
    }>;
    unreadCount: number;
  }> {
    try {
      return await this.request<{
        notifications: Array<{
          id: string;
          type: string;
          title: string;
          message: string;
          isRead: boolean;
          referenceType?: string;
          referenceId?: string;
          metadata?: Record<string, any>;
          createdAt: string;
        }>;
        unreadCount: number;
      }>("/api/notifications", {
        headers: { "Authorization": `Bearer ${authToken}` },
      });
    } catch {
      return { notifications: [], unreadCount: 0 };
    }
  }

  async getNotifications(authToken: string): Promise<Array<{
    id: string;
    type: string;
    title?: string;
    body?: string;
    message?: string;
    businessId?: string;
    businessName?: string;
    createdAt: string;
    read?: boolean;
  }>> {
    try {
      return await this.request<Array<{
        id: string;
        type: string;
        title?: string;
        body?: string;
        message?: string;
        businessId?: string;
        businessName?: string;
        createdAt: string;
        read?: boolean;
      }>>("/api/notifications", {
        headers: { "Authorization": `Bearer ${authToken}` },
      });
    } catch {
      return [];
    }
  }

  // ==========================================
  // Posts/Feed API
  // ==========================================

  // POST /api/feed - Create a new post (auth required)
  // Supports both legacy format (imageUrl/videoUrl) and new media object format
  async createPost(authToken: string, data: {
    content?: string;
    imageUrl?: string;
    images?: string[];
    videoUrl?: string;
    // New media object format for direct-to-Cloudinary uploads
    media?: {
      url: string;
      type: "image" | "video";
      thumbnailUrl?: string;
      duration?: number;
      width?: number;
      height?: number;
    };
    mediaType?: "image" | "video";
    thumbnailUrl?: string;
    mediaDuration?: number;
    taggedBusinessId?: string;
    taggedPhotographerId?: string;
    photographerServiceId?: string;
    productId?: string;
    serviceId?: string;
    displayLayout?: "pro" | "pulse";
    feedSurface?: "pro" | "pulse";
  }): Promise<{ post: ApiPost }> {
    // DEBUG: Log exactly what we're sending to the backend
    console.log("[API.createPost] ===== SENDING TO BACKEND =====");
    console.log("[API.createPost] videoUrl:", data.videoUrl);
    console.log("[API.createPost] thumbnailUrl:", data.thumbnailUrl);
    console.log("[API.createPost] mediaType:", data.mediaType);
    console.log("[API.createPost] feedSurface:", data.feedSurface);
    console.log("[API.createPost] displayLayout:", data.displayLayout);
    console.log("[API.createPost] Full data:", JSON.stringify(data, null, 2));
    
    const response = await this.request<{ post: ApiPost }>("/api/feed", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    
    // DEBUG: Log what the backend returned
    console.log("[API.createPost] ===== BACKEND RESPONSE =====");
    console.log("[API.createPost] post.id:", response.post?.id);
    console.log("[API.createPost] post.videoUrl:", response.post?.videoUrl);
    console.log("[API.createPost] post.imageUrl:", response.post?.imageUrl);
    console.log("[API.createPost] post.thumbnailUrl:", (response.post as any)?.thumbnailUrl);
    console.log("[API.createPost] post.feedSurface:", (response.post as any)?.feedSurface);
    console.log("[API.createPost] post.displayLayout:", response.post?.displayLayout);
    console.log("[API.createPost] Full response:", JSON.stringify(response, null, 2));
    
    return response;
  }

  // GET /api/feed - Get algorithmic feed posts (ranked by engagement, recency, location, user preferences)
  async getFeed(params?: {
    page?: number;
    limit?: number;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
  }, authToken?: string): Promise<{ posts: ApiPost[] }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.latitude) queryParams.append("latitude", params.latitude.toString());
    if (params?.longitude) queryParams.append("longitude", params.longitude.toString());
    if (params?.city) queryParams.append("city", params.city);
    if (params?.state) queryParams.append("state", params.state);
    const queryString = queryParams.toString();
    const url = queryString ? `/api/feed?${queryString}` : "/api/feed";
    
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    return this.request<{ posts: ApiPost[] }>(url, { headers });
  }

  // GET /api/feed/:postId - Get a single post by id (public)
  async getPost(postId: string, authToken?: string): Promise<{ post: ApiPost }> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return this.request<{ post: ApiPost }>(`/api/feed/${postId}`, { headers });
  }

  // DELETE /api/feed/:postId - Delete own post
  async deletePost(authToken: string, postId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/feed/${postId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/feed/:postId - Update own post's caption
  async updatePostCaption(authToken: string, postId: string, content: string): Promise<{ post: ApiPost }> {
    return this.request<{ post: ApiPost }>(`/api/feed/${postId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ content }),
    });
  }

  // POST /api/feed/:postId/like - Like a post
  async likePost(authToken: string, postId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/feed/${postId}/like`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // DELETE /api/feed/:postId/like - Unlike a post
  async unlikePost(authToken: string, postId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/feed/${postId}/like`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/feed/:postId/report - Report a post for admin review
  async reportPost(
    authToken: string, 
    postId: string, 
    reason: string
  ): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/feed/${postId}/report`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ reason }),
    });
  }

  // POST /api/users/:userId/block - Block a user
  async blockUser(
    authToken: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; block: { id: string; blockerId: string; blockedId: string; reason: string | null; createdAt: string } }> {
    return this.request(`/api/users/${userId}/block`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ reason }),
    });
  }

  // DELETE /api/users/:userId/block - Unblock a user
  async unblockUser(
    authToken: string,
    userId: string
  ): Promise<{ success: boolean }> {
    return this.request(`/api/users/${userId}/block`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/users/blocked - Get list of blocked users
  async getBlockedUsers(
    authToken: string
  ): Promise<{ blockedUsers: Array<{ id: string; blockerId: string; blockedId: string; reason: string | null; createdAt: string }> }> {
    return this.request(`/api/users/blocked`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/moderation/flag - Report a user
  async reportUser(
    authToken: string,
    targetId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/moderation/flag`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ targetType: "user", targetId, reason }),
    });
  }

  // POST /api/messages/:messageId/report - Report a chat message
  async reportMessage(
    authToken: string,
    messageId: string,
    reason: string
  ): Promise<{ success: boolean; report: { id: string; reporterId: string; messageId: string; reason: string; createdAt: string } }> {
    return this.request(`/api/messages/${messageId}/report`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ reason }),
    });
  }

  // GET /api/feed/:postId/comments - Get comments on a post
  async getPostComments(postId: string): Promise<{ comments: any[] }> {
    return this.request<{ comments: any[] }>(`/api/feed/${postId}/comments`);
  }

  // POST /api/feed/:postId/comments - Add comment to a post
  async addPostComment(authToken: string, postId: string, content: string): Promise<{ comment: any }> {
    return this.request<{ comment: any }>(`/api/feed/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // ==========================================
  // Pulse Feed API (TikTok-style Discovery)
  // ==========================================

  // GET /api/pulse/feed - Get TikTok-style ranked Pulse feed
  async getPulseFeed(params?: {
    limit?: number;
    cursor?: string;
  }, authToken?: string): Promise<PulseFeedResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.cursor) queryParams.append("cursor", params.cursor);
    const queryString = queryParams.toString();
    const url = queryString ? `/api/pulse/feed?${queryString}` : "/api/pulse/feed";
    
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const response = await this.request<PulseFeedResponse>(url, { headers });

    // CHANGE 1 — diagnostic: log raw body before any key extraction
    console.log('[API.getPulseFeed] RAW BODY:', JSON.stringify(response, null, 2));

    // CHANGE 2 — unwrap the success/data envelope when present, then extract
    const raw = response as any;
    const container: any = (raw && raw.data && typeof raw.data === 'object')
      ? raw.data
      : raw;

    // Resilient array extraction: check keys in priority order against container
    let postsArray: ApiPost[] = [];
    let matchedKeyName = 'none';
    if (Array.isArray(container.videos)) {
      postsArray = container.videos;
      matchedKeyName = 'videos';
    } else if (Array.isArray(container.posts)) {
      postsArray = container.posts;
      matchedKeyName = 'posts';
    } else if (Array.isArray(container.feed)) {
      postsArray = container.feed;
      matchedKeyName = 'feed';
    } else if (Array.isArray(container)) {
      postsArray = container;
      matchedKeyName = 'data (bare array)';
    }
    console.log('[API.getPulseFeed] matched key:', matchedKeyName, 'count:', postsArray.length);

    // Pull pagination fields from the same container level as the posts array
    const hasMore: boolean = container.hasMore ?? false;
    const nextCursor: string | undefined =
      container.nextCursor ?? container.nextOffset ?? undefined;

    // DEBUG: Log Pulse feed response
    console.log("[API.getPulseFeed] ===== PULSE FEED RESPONSE =====");
    console.log("[API.getPulseFeed] Total posts:", postsArray.length);
    if (postsArray.length > 0) {
      postsArray.slice(0, 3).forEach((post, i) => {
        console.log(`[API.getPulseFeed] Post ${i}: id=${post.id}, videoUrl=${post.videoUrl}, feedSurface=${(post as any).feedSurface}`);
      });
    } else {
      console.log("[API.getPulseFeed] No posts returned from /api/pulse/feed");
    }

    return { posts: postsArray, hasMore, nextCursor };
  }

  // POST /api/pulse/engagement - Track engagement signals for Pulse ranking
  async trackPulseEngagement(
    authToken: string,
    engagement: PulseEngagement
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/pulse/engagement", {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(engagement),
    });
  }

  async getInfluencerStats(authToken: string): Promise<InfluencerStats> {
    return this.request<InfluencerStats>("/api/influencer/me/stats", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  // Composes the influencer performance stats from the two endpoints that exist.
  // There is no single influencer performance endpoint — getInfluencerStats above
  // is referral-only (clicks, commission, tier) and has none of these metrics.
  //
  // Both fetches fail soft: a dashboard showing 0 followers is better than a
  // dashboard that errors out because one of two calls failed.
  async getInfluencerDashboard(
    userId: string,
    params?: { postLimit?: number }
  ): Promise<InfluencerDashboard> {
    const postLimit = params?.postLimit ?? 60;

    const [userResult, postsResult] = await Promise.all([
      this.getPublicUser(userId).catch(() => null),
      this.getProfilePosts(userId, { limit: postLimit }).catch(() => ({ posts: [] as ApiPost[] })),
    ]);

    const posts = postsResult?.posts ?? [];
    const followers = userResult?.user?.followerCount ?? 0;

    const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount ?? 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.commentsCount ?? 0), 0);

    // Follower-based engagement rate. The conventional definition divides by
    // reach or impressions, but ApiPost exposes neither, so this divides by
    // followers × posts. Guard the denominator — a brand new influencer has
    // zero posts AND zero followers, which would otherwise produce NaN.
    const denominator = posts.length * followers;
    const engagementRate =
      denominator > 0 ? ((totalLikes + totalComments) / denominator) * 100 : 0;

    const recentActivity: InfluencerActivityItem[] = [...posts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((post) => {
        const media = resolvePostMedia(post);
        return {
          postId: post.id,
          createdAt: post.createdAt,
          caption: post.content?.trim() || "",
          thumbnailUrl: media.imageUrl || undefined,
          mediaType: media.type,
          likesCount: post.likesCount ?? 0,
          commentsCount: post.commentsCount ?? 0,
        };
      });

    return {
      followers,
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      engagementRate,
      recentActivity,
      // getProfilePosts returns no total count, so a full page back means there
      // are probably more posts than we counted. Let the screen say "60+".
      postCountCapped: posts.length >= postLimit,
    };
  }

  async trackInfluencerClick(referralCode: string, postId?: string): Promise<void> {
    try {
      await this.request<{ success: boolean }>("/api/influencer/click", {
        method: "POST",
        body: JSON.stringify({ ref: referralCode, postId }),
      });
    } catch {
    }
  }

  async sendInfluencerReferralEvent(
    authToken: string,
    eventType: "signup" | "first_purchase" | "repeat_purchase",
    ref: string,
    extras?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.request<{ success: boolean }>("/api/influencer/event", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ ref, eventType, ...extras }),
      });
    } catch {
    }
  }

  // GET /api/profiles/:profileId/posts - Get posts for a specific profile
  // Note: Pro/Pulse is a display layout decision, not a backend filter
  async getProfilePosts(profileId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{ posts: ApiPost[] }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    const queryString = queryParams.toString();
    const url = queryString 
      ? `/api/profiles/${profileId}/posts?${queryString}` 
      : `/api/profiles/${profileId}/posts`;
    
    const response = await this.request<{ posts: ApiPost[] }>(url);
    
    // DEBUG: Log profile posts response
    console.log("[API.getProfilePosts] ===== PROFILE POSTS RESPONSE =====");
    console.log("[API.getProfilePosts] profileId:", profileId);
    console.log("[API.getProfilePosts] Total posts:", response.posts?.length || 0);
    if (response.posts?.length > 0) {
      response.posts.forEach((post, i) => {
        console.log(`[API.getProfilePosts] Post ${i}: id=${post.id}, videoUrl=${post.videoUrl?.substring(0, 50)}, displayLayout=${post.displayLayout}, feedSurface=${(post as any).feedSurface}`);
      });
    }
    
    return response;
  }

  // ==========================================
  // Backend-Driven Booking Slots API
  // ==========================================

  async getPhotographerAvailableSlots(
    photographerId: string,
    date: string,
    serviceId?: string
  ): Promise<{ slots: AvailableSlot[]; date: string }> {
    const params = new URLSearchParams({ date });
    if (serviceId) params.append("serviceId", serviceId);
    return this.request<{ slots: AvailableSlot[]; date: string }>(
      `/api/photographers/${photographerId}/slots?${params.toString()}`
    );
  }

  async getPhotographerAvailableDates(
    photographerId: string,
    startDate: string,
    endDate: string
  ): Promise<{ dates: string[] }> {
    const params = new URLSearchParams({ startDate, endDate });
    // Use the backend availability endpoint that checks for existing bookings
    const response = await this.request<{
      availableDates?: string[];
      dates?: string[];
    }>(
      `/api/availability/photographer/${photographerId}?${params.toString()}`
    );
    return { dates: response.availableDates || response.dates || [] };
  }

  async createBookingDraft(
    authToken: string,
    data: {
      photographerId: string;
      serviceId: string;
      date: string;
      startTime: string;
      endTime?: string;
      location?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    draftId: string;
    expiresAt: string;
    slot: {
      date: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
    };
    service: {
      id: string;
      name: string;
      priceCents: number;
      description?: string;
    };
    pricing: {
      totalCents: number;
      platformFeeCents: number;
      vendorNetCents: number;
    };
    feeBreakdown?: FeeBreakdown;
  }> {
    return this.request<{
      success: boolean;
      draftId: string;
      expiresAt: string;
      slot: {
        date: string;
        startTime: string;
        endTime: string;
        durationMinutes: number;
      };
      service: {
        id: string;
        name: string;
        priceCents: number;
        description?: string;
      };
      pricing: {
        totalCents: number;
        platformFeeCents: number;
        vendorNetCents: number;
      };
      feeBreakdown?: FeeBreakdown;
    }>("/api/bookings/photographer/draft", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async cancelBookingDraft(authToken: string, draftId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/bookings/draft/${draftId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async initiateBookingPayment(
    authToken: string,
    draftId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    return this.request<{ checkoutUrl: string; sessionId: string }>(
      `/api/bookings/shoot/${draftId}/initiate-payment`,
      {
        method: "POST",
        body: JSON.stringify({ successUrl, cancelUrl }),
        headers: { "Authorization": `Bearer ${authToken}` },
      }
    );
  }

  async confirmBookingDraft(
    authToken: string,
    draftId: string,
    paymentMethodId?: string
  ): Promise<{ booking: PhotographerBooking; paymentIntentClientSecret?: string }> {
    return this.request<{ booking: PhotographerBooking; paymentIntentClientSecret?: string }>(
      `/api/bookings/photographer/${draftId}/confirm-payment`,
      {
        method: "POST",
        body: JSON.stringify({ paymentMethodId }),
        headers: { "Authorization": `Bearer ${authToken}` },
      }
    );
  }

  async getBookingDraft(authToken: string, draftId: string): Promise<{ draft: BookingDraft }> {
    return this.request<{ draft: BookingDraft }>(`/api/bookings/draft/${draftId}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // Availability Calendar endpoints
  async getAvailabilityCalendar(
    providerId: string,
    providerType: "photographer" | "business",
    year: number,
    month: number, // 1-12
    serviceDurationMinutes?: number,
    staffMemberId?: string
  ): Promise<AvailabilityCalendarResponse> {
    // Backend returns { days: [{ date, hasAvailability, totalSlots }] }
    // Frontend expects { days: [{ date, status, slotsAvailable, slotsTotal }] }
    const params = new URLSearchParams({
      providerType,
      providerId,
      year: year.toString(),
      month: month.toString(),
      ...(serviceDurationMinutes ? { serviceDurationMinutes: serviceDurationMinutes.toString() } : {}),
      ...(staffMemberId ? { staffMemberId } : {}),
    });
    const rawResponse = await this.request<{ days: Array<{ date: string; hasAvailability: boolean; totalSlots?: number }> }>(
      `/api/availability/calendar?${params.toString()}`
    );
    
    // Transform backend format to frontend format
    const transformedDays: AvailabilityCalendarDay[] = (rawResponse.days || []).map(day => ({
      date: day.date,
      status: day.hasAvailability ? "available" : "unavailable",
      slotsTotal: day.totalSlots || 0,
      slotsAvailable: day.hasAvailability ? (day.totalSlots || 0) : 0,
    }));
    
    return {
      month: `${year}-${String(month).padStart(2, "0")}`,
      days: transformedDays,
    };
  }

  async getAvailabilitySlots(
    providerId: string,
    providerType: "photographer" | "business",
    date: string, // Format: YYYY-MM-DD
    serviceDurationMinutes: number = 60, // Default to 60 minutes if not provided
    staffMemberId?: string
  ): Promise<AvailabilitySlotResponse> {
    // Backend returns { date, slots: [{ startTime, endTime, available }], totalAvailable }
    // Frontend expects { date, slots: [{ id, startTime, endTime, status }] }
    const slotsParams = new URLSearchParams({
      providerId,
      providerType,
      date,
      serviceDurationMinutes: serviceDurationMinutes.toString(),
      ...(staffMemberId ? { staffMemberId } : {}),
    });
    const rawResponse = await this.request<{
      date: string;
      slots: Array<{ startTime: string; endTime: string; available: boolean }>;
      totalAvailable?: number;
    }>(
      `/api/availability/slots?${slotsParams.toString()}`
    );
    
    // Transform backend format to frontend format
    const transformedSlots: AvailabilitySlot[] = (rawResponse.slots || []).map((slot, index) => ({
      id: `${date}-${slot.startTime}-${index}`,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.available ? "available" : "booked" as const,
    }));
    
    return {
      date: rawResponse.date,
      slots: transformedSlots,
    };
  }

  // Booking Flow endpoints
  async getProviderServices(
    providerId: string,
    providerType: "photographer" | "business"
  ): Promise<BookingService[]> {
    const endpoint = providerType === "photographer"
      ? `/api/photographers/${providerId}/services`
      : `/api/businesses/${providerId}/services`;
    const response = await this.request<{ services: Array<BookingService & { price?: number }> }>(endpoint);
    return (response.services || []).map(s => ({ ...s, priceCents: s.price ?? s.priceCents ?? 0 }));
  }

  async validateBookingSlot(
    authToken: string,
    data: {
      providerId: string;
      providerType: "photographer" | "business";
      serviceId: string;
      date: string;
      startTime: string;
      staffMemberId?: string;
    }
  ): Promise<BookingValidationResponse> {
    return this.request<BookingValidationResponse>("/api/booking/validate", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async createBookingHold(
    authToken: string,
    data: {
      providerId: string;
      providerType: "photographer" | "business";
      serviceId: string;
      date: string;
      startTime: string;
    }
  ): Promise<BookingHoldResponse> {
    return this.request<BookingHoldResponse>("/api/booking/hold", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async confirmBooking(
    authToken: string,
    holdId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<BookingConfirmResponse> {
    return this.request<BookingConfirmResponse>("/api/booking/confirm", {
      method: "POST",
      body: JSON.stringify({ holdId, successUrl, cancelUrl }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async createHoldPaymentIntent(
    holdId: string,
    customerAddress?: {
      customerServiceAddress?: string;
      customerServiceCity?: string;
      customerServiceState?: string;
      customerServiceZipCode?: string;
    }
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    appointmentId: string;
    captureMethod: "automatic" | "manual";
    requiresApproval?: boolean;
    status?: string;
    feeBreakdown?: {
      subtotal: number;
      consumerFee: number;
      bookingFee: number;
      vendorNet: number;
      grossCharge: number;
    };
  }> {
    return this.request(`/api/booking/${holdId}/create-payment-intent`, {
      method: "POST",
      body: JSON.stringify(customerAddress ?? {}),
    });
  }

  private normalizeVendorEligibility(response: any): VendorEligibility {
    const payload =
      response?.eligibility ??
      response?.data?.eligibility ??
      response?.data ??
      response;

    return {
      requiresApproval: Boolean(payload?.requiresApproval),
      requiresPlanSelection: Boolean(payload?.requiresPlanSelection),
      requiresOnboarding: Boolean(payload?.requiresOnboarding),
      requiresSubscription: Boolean(payload?.requiresSubscription),
      canPublishProducts: Boolean(payload?.canPublishProducts),
      canPublishServices: Boolean(payload?.canPublishServices),
      ...(typeof payload?.currentStep === "string" ? { currentStep: payload.currentStep } : {}),
      ...(typeof payload?.subscriptionStatus === "string" ? { subscriptionStatus: payload.subscriptionStatus } : {}),
      ...(typeof payload?.hasActiveSubscription === "boolean"
        ? { hasActiveSubscription: payload.hasActiveSubscription }
        : {}),
      ...(payload?.subscriptionTier !== undefined ? { subscriptionTier: payload.subscriptionTier } : {}),
    };
  }

  async getVendorEligibility(authToken: string): Promise<VendorEligibility> {
    const endpoint = "/api/vendor/eligibility";
    const response = await this.request<any>(endpoint, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
    console.log("ELIGIBILITY RESPONSE:", JSON.stringify(response, null, 2));
    return this.normalizeVendorEligibility(response);
  }

  async getSubscriptionTiers(authToken: string): Promise<{ tiers: SubscriptionTier[] }> {
    // Subscription tiers are often a public endpoint. We try three strategies in order:
    // 1. With Bearer token (works for JWT-based auth)
    // 2. Cookie-only (works for session-based auth — credentials: include is always set)
    // 3. Completely public (no auth, no cookies)
    // This handles the case where the stored token is "session_userId" (not a real JWT).
    const isLikelyJwt = authToken && authToken.startsWith("ey");
    
    try {
      // Strategy 1: with Bearer token (only if it looks like a real JWT)
      if (isLikelyJwt) {
        const res = await this.request<any>("/api/subscription-tiers", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const tiers = res?.tiers ?? res?.data ?? [];
        console.log(`[API] getSubscriptionTiers (JWT strategy) → ${tiers.length} tiers`);
        return { tiers };
      }
    } catch (e: any) {
      console.warn(`[API] getSubscriptionTiers JWT strategy failed (${e?.status ?? "?"}): ${e?.message ?? e}`);
    }
    
    try {
      // Strategy 2: session cookies only (no Authorization header)
      const res = await this.request<any>("/api/subscription-tiers");
      const tiers = res?.tiers ?? res?.data ?? [];
      console.log(`[API] getSubscriptionTiers (cookie strategy) → ${tiers.length} tiers`);
      return { tiers };
    } catch (e: any) {
      console.warn(`[API] getSubscriptionTiers cookie strategy failed (${e?.status ?? "?"}): ${e?.message ?? e}`);
      // Re-throw so the caller can show the actual error
      throw e;
    }
  }

  async getCurrentSubscription(authToken: string): Promise<{
    hasSubscription: boolean;
    subscription: CurrentSubscription | null;
  }> {
    return this.request<{ hasSubscription: boolean; subscription: CurrentSubscription | null }>(
      "/api/vendor/subscription",
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  }

  async syncVendorSubscription(authToken: string): Promise<{
    synced: boolean;
    previousStatus?: string;
    currentStatus?: string;
    error?: string;
  }> {
    return this.request("/api/vendor/subscription/sync", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  async createBillingPortalSession(
    authToken: string,
    returnUrl: string
  ): Promise<{ portalUrl: string }> {
    return this.request<{ portalUrl: string }>("/api/stripe/billing-portal", {
      method: "POST",
      body: JSON.stringify({ returnUrl }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async createTierSubscriptionCheckout(
    authToken: string,
    tierId: string,
    returnUrl?: string
  ): Promise<{
    url?: string;
    clientSecret?: string;
    customerId?: string;
    ephemeralKey?: string;
  }> {
    return this.request<{
      url?: string;
      clientSecret?: string;
      customerId?: string;
      ephemeralKey?: string;
    }>("/api/stripe/checkout/tier-subscription", {
      method: "POST",
      body: JSON.stringify({ tierId, ...(returnUrl ? { returnUrl } : {}) }),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // ==========================================
  // Production Shoot Credits
  // ==========================================

  async getBusinessProductionCredits(
    authToken: string,
    businessId: string
  ): Promise<ProductionCreditData> {
    return this.request<ProductionCreditData>(
      `/api/business/${businessId}/production-credits`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  }

  async bookProductionShoot(
    authToken: string,
    payload: {
      businessId: string;
      shootType: string;
      location: string;
      creditsToUse: number;
      pricingOption: "full" | "1credit" | "2credits" | "free";
    }
  ): Promise<{ success: boolean; newBalance: number; booking: any }> {
    return this.request<{ success: boolean; newBalance: number; booking: any }>(
      "/api/production/book",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
  }

  async bulkCancelByDate(
    token: string,
    date: string,
    startTime?: string,
    endTime?: string,
    reason?: string
  ): Promise<{
    success: boolean;
    cancelledCount: number;
    refundedCount: number;
    failedRefunds: string[];
    date: string;
  }> {
    return this.request<{
      success: boolean;
      cancelledCount: number;
      refundedCount: number;
      failedRefunds: string[];
      date: string;
    }>("/api/vendor/bookings/bulk-cancel-by-date", {
      method: "POST",
      body: JSON.stringify({ date, startTime, endTime, reason }),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // GET /api/users/:id — public user profile (consumers / any registered user)
  async getPublicUser(userId: string): Promise<{
    user: {
      id: string;
      userId?: string;
      name?: string;
      username?: string;
      profileImageUrl?: string;
      avatarUrl?: string;
      coverMediaUrl?: string;
      coverMediaType?: "image" | "video";
      city?: string;
      state?: string;
      isVendor?: boolean;
      isPhotographer?: boolean;
      isInfluencer?: boolean;
      followerCount?: number;
      followingCount?: number;
    };
  }> {
    return this.request<{
      user: {
        id: string;
        userId?: string;
        name?: string;
        username?: string;
        profileImageUrl?: string;
        avatarUrl?: string;
        coverMediaUrl?: string;
        coverMediaType?: "image" | "video";
        city?: string;
        state?: string;
        isVendor?: boolean;
        isPhotographer?: boolean;
        isInfluencer?: boolean;
        followerCount?: number;
        followingCount?: number;
      };
    }>(`/api/users/${userId}`);
  }

  // ==========================================
  // Stories API
  // ==========================================

  async createStory(authToken: string, data: {
    mediaUrl: string;
    mediaType: "image" | "video";
    thumbnailUrl?: string;
    muxAssetId?: string;
    caption?: string;
  }): Promise<{ story: any }> {
    return this.request<{ story: any }>("/api/stories", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getStoriesByUser(userId: string, authToken?: string): Promise<any[]> {
    return this.request<any[]>(`/api/stories/${userId}`, {
      headers: authToken ? { "Authorization": `Bearer ${authToken}` } : {},
    });
  }

  async deleteStory(storyId: string, authToken: string): Promise<void> {
    return this.request<void>(`/api/stories/${storyId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async recordView(storyId: string, authToken?: string): Promise<void> {
    return this.request<void>(`/api/stories/${storyId}/view`, {
      method: "POST",
      headers: authToken ? { "Authorization": `Bearer ${authToken}` } : {},
    });
  }

  // ==========================================
  // Reviews API
  // ==========================================

  // GET /api/reviews/reviewable - List bookings eligible for review
  async getReviewableBookings(token: string): Promise<{
    orders: any[];
    appointments: any[];
    shootBookings: any[];
  }> {
    return this.request(`/api/reviews/reviewable`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
  }

  // POST /api/reviews - Submit a review for a completed booking
  async submitReview(
    token: string,
    payload: {
      targetType: string;
      targetId: string;
      bookingType: string;
      bookingId: string;
      rating: number;
      title?: string;
      comment?: string;
    }
  ): Promise<{ review: any }> {
    return this.request<{ review: any }>(`/api/reviews`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  }

  // GET /api/reviews/:targetType/:targetId - Fetch reviews for a vendor
  async getReviewsByTarget(
    targetType: string,
    targetId: string
  ): Promise<{ reviews: any[] }> {
    return this.request<{ reviews: any[] }>(`/api/reviews/${targetType}/${targetId}`);
  }

  // GET /api/reviews/can-review/:bookingType/:bookingId
  async canReviewBooking(
    token: string,
    bookingType: string,
    bookingId: string
  ): Promise<{ canReview: boolean; alreadyReviewed: boolean }> {
    return this.request<{ canReview: boolean; alreadyReviewed: boolean }>(
      `/api/reviews/can-review/${bookingType}/${bookingId}`,
      {
        headers: { "Authorization": `Bearer ${token}` },
      }
    );
  }
}

// Availability Calendar types
export interface AvailabilityCalendarDay {
  date: string; // YYYY-MM-DD
  status: "available" | "partial" | "unavailable";
  slotsAvailable?: number;
  slotsTotal?: number;
}

export interface AvailabilityCalendarResponse {
  month: string;
  days: AvailabilityCalendarDay[];
}

export interface AvailabilitySlot {
  id: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: "available" | "held" | "booked";
  holdExpiresAt?: string; // ISO timestamp for held slots
}

export interface AvailabilitySlotResponse {
  date: string;
  slots: AvailabilitySlot[];
}

// Booking Flow types
export interface BookingService {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  status?: "live" | "active" | "draft" | "archived";
  serviceLocationType?: 'business' | 'alternate' | 'customer' | 'virtual';
  alternateAddress?: string | null;
  alternateCity?: string | null;
  alternateState?: string | null;
  alternateZipCode?: string | null;
  virtualLink?: string | null;
  fullRefundWindow?: string | null;
  hasPartialRefund?: boolean | null;
  partialRefundWindow?: string | null;
  partialRefundPercentage?: number | null;
  hasCancellationFee?: boolean | null;
  cancellationFeeType?: string | null;
  cancellationFeeAmount?: number | null;
}

export interface BookingValidationResponse {
  valid: boolean;
  reason?: string;
  endTime?: string;
}

export interface FeeBreakdown {
  subtotalAmount: number;
  consumerServiceFeeAmount: number;
  bookingFeeAmount: number;
  vendorNetAmount: number;
  grossChargeAmount: number;
  taxAmount: number;
  outsydeGrossRevenueAmount: number;
  feeModelVersion: string;
}

export interface BookingHoldResponse {
  success: boolean;
  holdId: string;
  expiresAt: string;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  };
  slot: {
    date: string;
    startTime: string;
    endTime: string;
  };
  feeBreakdown?: FeeBreakdown;
}

export interface BookingConfirmResponse {
  success: boolean;
  checkoutUrl: string;
  sessionId: string;
}

export interface PulseEngagement {
  postId: string;
  watchTimeMs: number;
  videoDurationMs: number;
  isRewatch?: boolean;
}

export interface PulseFeedResponse {
  posts: ApiPost[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface InfluencerStats {
  referralCode: string;
  referralLink: string;
  totalClicks: number;
  totalDownloads: number;
  totalSignups: number;
  totalPurchases: number;
  pointsBalance: number;
  totalCommissionCents: number;
  tier: "Bronze" | "Silver" | "Gold" | "Elite";
  conversionRate: number;
  // Commission breakdown by status (backend-calculated; optional until backend exposes them)
  pendingCommissionCents?: number;
  approvedCommissionCents?: number;
  transferredCommissionCents?: number;
}

// One entry in the influencer dashboard's recent activity feed. Derived from the
// influencer's own posts — this is "my posts and how they did", not an event
// stream of who liked what. A true event feed would need the notifications API.
export interface InfluencerActivityItem {
  postId: string;
  createdAt: string;
  caption: string;
  thumbnailUrl?: string;
  mediaType: "image" | "video";
  likesCount: number;
  commentsCount: number;
}

export interface InfluencerDashboard {
  followers: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  /** Percentage, follower-based — see getInfluencerDashboard for the formula. */
  engagementRate: number;
  recentActivity: InfluencerActivityItem[];
  /** True when totalPosts hit the fetch limit and the real count may be higher. */
  postCountCapped: boolean;
}

export const api = new ApiService();
export default api;

// ==========================================
// Production Shoot Credits
// ==========================================

export interface ProductionCreditHistory {
  id: string;
  date: string;
  shootType: string;
  location?: string;
  creditsUsed: number;
  pricePaidCents: number;
}

export interface ProductionCreditData {
  balance: number;
  history: ProductionCreditHistory[];
}

// ==========================================
// Vendor Eligibility + Subscription Tiers
// ==========================================

export interface VendorEligibility {
  requiresApproval: boolean;
  requiresPlanSelection: boolean;
  requiresOnboarding: boolean;
  requiresSubscription: boolean;
  canPublishProducts: boolean;
  canPublishServices: boolean;
  currentStep?: string;
  subscriptionStatus?: string;
  hasActiveSubscription?: boolean;
  subscriptionTier?: string | null;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  displayName?: string;
  price?: number;
  priceInCents?: number;
  priceLabel?: string;
  description?: string;
  features?: string[];
  interval?: string;
  badge?: string;
  stripePriceId?: string | null;
}

export interface CurrentSubscription {
  id: string;
  tierId: string;
  tierName: string;
  tierDisplayName: string;
  priceInCents: number;
  status: string;
}

export function canChangeUsername(user: { username_updated_at?: string | null }): boolean {
  if (!user.username_updated_at) return true;
  const daysSinceUpdate =
    (Date.now() - new Date(user.username_updated_at).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate >= 14;
}

export interface BusinessAppointment {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentEndTime: string | null;
  totalPrice: number;
  status: string;
  businessId: string;
  serviceId: string;
  staffMemberId: string | null;
  businessName: string | null;
  businessLogoImage: string | null;
  businessCity: string | null;
  businessState: string | null;
  businessAddress: string | null;
  serviceName: string | null;
  serviceDurationMinutes: number | null;
  staffDisplayName: string | null;
  staffProfileImageUrl: string | null;
  businessHasPhysicalLocation?: boolean | null;
  serviceFullRefundWindow?: string | null;
  serviceHasPartialRefund?: boolean | null;
  servicePartialRefundWindow?: string | null;
  servicePartialRefundPercentage?: number | null;
  serviceHasCancellationFee?: boolean | null;
  serviceCancellationFeeType?: string | null;
  serviceCancellationFeeAmount?: number | null;
}

export async function getMyAppointments(token: string): Promise<BusinessAppointment[]> {
  const response: any = await apiGet("/api/my-appointments", token);
  return Array.isArray(response?.appointments) ? response.appointments : [];
}

export async function getMyShootBookings(token: string): Promise<any[]> {
  const response: any = await apiGet("/api/my-shoot-bookings", token);
  return Array.isArray(response?.sessions) ? response.sessions : [];
}

// ==========================================
// Saved Payment Methods
// ==========================================

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface SavedAddress {
  id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
}

export interface SavedAddressInput {
  label?: string;
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

export async function getPaymentMethods(token: string): Promise<{ paymentMethods: SavedCard[]; defaultPaymentMethodId: string | null }> {
  const response: any = await apiGet("/api/me/payment-methods", token);
  const raw = Array.isArray(response?.paymentMethods) ? response.paymentMethods : [];
  const defaultId: string | null = response?.defaultPaymentMethodId ?? null;
  const cards: SavedCard[] = raw.map((pm: any) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "????",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    isDefault: pm.id === defaultId,
  }));
  return { paymentMethods: cards, defaultPaymentMethodId: defaultId };
}

export async function createSetupIntent(token: string): Promise<{ clientSecret: string }> {
  return apiPost("/api/me/payment-methods/setup-intent", undefined, token) as Promise<{ clientSecret: string }>;
}

export async function deletePaymentMethod(token: string, paymentMethodId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/me/payment-methods/${paymentMethodId}`, token) as Promise<{ success: boolean }>;
}

export async function setDefaultPaymentMethod(token: string, paymentMethodId: string): Promise<{ success: boolean }> {
  return apiPatch("/api/me/payment-methods/default", { paymentMethodId }, token) as Promise<{ success: boolean }>;
}

// ==========================================
// Saved Addresses
// ==========================================

export async function getSavedAddresses(token: string): Promise<{ addresses: SavedAddress[] }> {
  return apiGet("/api/me/addresses", token) as Promise<{ addresses: SavedAddress[] }>;
}

export async function createSavedAddress(token: string, data: SavedAddressInput): Promise<{ address: SavedAddress }> {
  return apiPost("/api/me/addresses", data, token) as Promise<{ address: SavedAddress }>;
}

export async function updateSavedAddress(
  token: string,
  id: string,
  data: Partial<SavedAddressInput>
): Promise<{ address: SavedAddress }> {
  const response = await fetch(`${API_BASE_URL}/api/me/addresses/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API Error ${response.status}: ${text || response.statusText}`);
  }
  return response.json();
}

// ==========================================
// Consumer Orders
// ==========================================

export interface ConsumerOrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

export interface ConsumerOrder {
  id: string;
  vendorName: string;
  businessId: string;
  status: "pending" | "paid" | "shipped" | "delivered" | "canceled";
  items: ConsumerOrderItem[];
  itemCount: number;
  totalAmount: number;
  grossChargeAmount?: number | null;
  shippingAddress?: string | null;
  createdAt: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: string | null;
  shipmentStatus?: string | null;
}

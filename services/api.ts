const API_BASE_URL = "https://outsyde-backend.onrender.com";

export interface HealthCheckResponse {
  status: string;
  service: string;
  environment: string;
}

export interface ApiError {
  message: string;
  status?: number;
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
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
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
  hasProducts: boolean;
  hasServices: boolean;
  coverImage?: string | null;
  logoImage?: string | null;
  brandColors?: string | null;
  hoursOfOperation?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean | null;
  approvalStatus?: "pending" | "approved" | "rejected" | null;
  approvalNotes?: string | null;
  subscriptionActive?: boolean | null;
  subscriptionStatus?: string | null;
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
  isOnlineOnly?: boolean;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  hoursOfOperation?: HoursOfOperationData;
  brandColors?: string; // JSON string with { primary: "#hex" }
  coverImage?: string;
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
  accountType: "consumer" | "business";
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
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  earnings?: number;
}

export interface AdminPhotographer {
  id: string;
  name: string;
  specialty: string;
  city: string;
  state: string;
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
  status: "pending" | "completed" | "cancelled" | "refunded";
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
  status: "pending" | "confirmed" | "completed" | "cancelled";
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
  avatar?: string;
  image?: string;
  location?: string;
  rating?: number;
  specialty?: string;
  priceRange?: string;
  description?: string;
  subscriptionTier?: "basic" | "pro" | "premium";
}

export interface PhotographerDashboardStats {
  earnings: number;
  upcomingBookings: number;
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
}

export interface PhotographerBooking {
  id: string;
  clientName: string;
  clientAvatar?: string;
  date: string;
  time: string;
  sessionType: string;
  location?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  amount: number;
}

export interface PhotographerService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive: boolean;
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
}

export interface BusinessOrder {
  id: string;
  customerName: string;
  customerAvatar?: string;
  orderDate: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
}

export interface BusinessBooking {
  id: string;
  customerName: string;
  customerAvatar?: string;
  date: string;
  time: string;
  serviceName: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  amount: number;
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
}

export interface SearchResponse {
  businesses: ApiBusiness[];
  photographers: ApiPhotographer[];
}

export interface SearchParams {
  query?: string;
  city?: string;
  category?: string;
}

export type SearchResultType = "business" | "photographer" | "product" | "service";

export interface MobileLoginRequest {
  email: string;
  password: string;
}

export interface MobileLoginResponse {
  accessToken?: string; // Optional - backend uses session cookies, not JWT
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
  city?: string;
  state?: string;
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
}

export interface VendorSignupRequest {
  email: string;
  password: string;
  name: string;
  businessName: string;
  businessCategory: string;
  offerType: "products" | "services" | "both";
  acceptedSubscription: boolean;
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
  name: string;
  avatar: string;
  city: string;
  state: string;
  rating: number;
  priceRange: string;
  category: string;
  description: string;
  subscriptionTier?: "basic" | "pro" | "premium";
  resultType: SearchResultType;
  originalType?: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        credentials: 'include', // Required for session-based auth with cookies
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // Try to parse error response body for validation messages
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let validationErrors: string[] = [];
        try {
          const errorBody = await response.json();
          if (errorBody.message) {
            errorMessage = errorBody.message;
          }
          if (errorBody.errors && Array.isArray(errorBody.errors)) {
            validationErrors = errorBody.errors;
            errorMessage = validationErrors.join(", ");
          }
          console.error("API Error Response:", JSON.stringify(errorBody, null, 2));
        } catch (parseError) {
          // Could not parse error body, use default message
        }
        throw {
          message: errorMessage,
          status: response.status,
          validationErrors,
        } as ApiError;
      }

      return await response.json();
    } catch (error) {
      if ((error as ApiError).status) {
        throw error;
      }
      throw {
        message: error instanceof Error ? error.message : "Network error",
      } as ApiError;
    }
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>("/health");
  }

  async mobileLogin(data: MobileLoginRequest): Promise<MobileLoginResponse> {
    return this.request<MobileLoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
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
    });
  }

  async photographerSignup(data: PhotographerSignupRequest): Promise<SessionSignupResponse> {
    return this.request<SessionSignupResponse>("/api/auth/photographer/signup", {
      method: "POST",
      body: JSON.stringify(data),
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
      const customerPayload = {
        email: data.email,
        password: data.password,
        name: fullName,
      };
      console.log("[Signup] Customer payload:", JSON.stringify(customerPayload, null, 2));
      await this.customerSignup(customerPayload);
    } else if (data.role === "business") {
      const vendorPayload = {
        email: data.email,
        password: data.password,
        name: fullName,
        businessName: data.businessName || fullName,
        businessCategory: data.businessCategory || "General",
        offerType: data.offerType || "both",
        acceptedSubscription: true,
      };
      console.log("[Signup] Vendor payload:", JSON.stringify(vendorPayload, null, 2));
      await this.vendorSignup(vendorPayload);
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
      };
      console.log("[Signup] Photographer payload:", JSON.stringify(photographerPayload, null, 2));
      await this.photographerSignup(photographerPayload);
    }

    // Step 2: Now login to get JWT token
    console.log("[Signup] Account created, logging in to get JWT...");
    return this.mobileLogin({
      email: data.email,
      password: data.password,
    });
  }

  async search(params?: SearchParams): Promise<SearchResponse> {
    const queryString = new URLSearchParams();
    if (params?.query) queryString.append("query", params.query);
    if (params?.city) queryString.append("city", params.city);
    if (params?.category) queryString.append("category", params.category);
    
    const endpoint = `/api/search${queryString.toString() ? `?${queryString.toString()}` : ""}`;
    return this.request<SearchResponse>(endpoint);
  }

  async getPhotographer(id: string): Promise<ApiPhotographerDetail> {
    return this.request<ApiPhotographerDetail>(`/api/photographers/${id}`);
  }

  async getBusiness(id: string): Promise<ApiBusinessDetail> {
    return this.request<ApiBusinessDetail>(`/api/businesses/${id}`);
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
    return this.request<AdminUser[]>(`/api/admin/users${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminBusinesses(authToken: string, status?: string, search?: string): Promise<AdminBusiness[]> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<AdminBusiness[]>(`/api/admin/businesses${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminPhotographers(authToken: string, search?: string): Promise<AdminPhotographer[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.request<AdminPhotographer[]>(`/api/admin/photographers${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getAdminInfluencers(authToken: string, status?: string): Promise<AdminInfluencer[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<AdminInfluencer[]>(`/api/admin/influencers${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
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

  async approveApplication(authToken: string, type: "business" | "influencer", id: string): Promise<void> {
    await this.request<void>(`/api/admin/${type}s/${id}/approve`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async rejectApplication(authToken: string, type: "business" | "influencer", id: string): Promise<void> {
    await this.request<void>(`/api/admin/${type}s/${id}/reject`, {
      method: "POST",
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
    return this.request(`/api/admin/users/${userId}`, {
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
    return this.request<PhotographerDashboardProfile>("/api/photographer/profile", {
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
  async updatePhotographerMe(authToken: string, data: Partial<PhotographerOnboardingData>): Promise<{ photographer: VendorBookerPhotographer }> {
    console.log("[API] updatePhotographerMe RAW input:", JSON.stringify(data, null, 2));
    
    // Build defensive payload - only include non-empty, valid values
    // Use field names the backend expects (based on VendorBooker API)
    const cleanPayload: Record<string, any> = {};
    
    // displayName -> name (backend field name)
    if (data.displayName && data.displayName.trim()) {
      cleanPayload.name = data.displayName.trim();
    }
    if (data.bio && data.bio.trim()) {
      cleanPayload.bio = data.bio.trim();
    }
    if (data.city && data.city.trim()) {
      cleanPayload.city = data.city.trim();
    }
    if (data.state && data.state.trim()) {
      cleanPayload.state = data.state.trim();
    }
    if (data.hourlyRate && data.hourlyRate > 0) {
      cleanPayload.hourlyRate = data.hourlyRate;
    }
    if (data.portfolioUrl && data.portfolioUrl.trim()) {
      cleanPayload.portfolioUrl = data.portfolioUrl.trim();
    }
    if (data.specialties && data.specialties.length > 0) {
      cleanPayload.specialties = data.specialties;
    }
    if (data.brandColors) {
      cleanPayload.brandColors = data.brandColors;
    }
    if (typeof data.willTravel === 'boolean') {
      cleanPayload.willTravel = data.willTravel;
    }
    if (typeof data.isProfileComplete === 'boolean') {
      cleanPayload.isProfileComplete = data.isProfileComplete;
    }
    
    console.log("[API] updatePhotographerMe CLEAN payload:", JSON.stringify(cleanPayload, null, 2));
    
    // Don't send empty payloads
    if (Object.keys(cleanPayload).length === 0) {
      console.warn("[API] updatePhotographerMe: No valid fields to update after filtering");
      throw { message: "No changes to save. Please modify at least one field.", status: 400 };
    }
    
    return this.request<{ photographer: VendorBookerPhotographer }>("/api/photographers/me", {
      method: "PATCH",
      body: JSON.stringify(cleanPayload),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
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

  // GET /api/photographers/me/services - Get photographer's services
  async getPhotographerMeServices(authToken: string): Promise<{ services: VendorBookerPhotographerService[] }> {
    return this.request<{ services: VendorBookerPhotographerService[] }>("/api/photographers/me/services", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // POST /api/photographers/me/services - Create a new service
  async createPhotographerMeService(authToken: string, data: Partial<VendorBookerPhotographerService>): Promise<{ service: VendorBookerPhotographerService }> {
    return this.request<{ service: VendorBookerPhotographerService }>("/api/photographers/me/services", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/photographers/me/availability - Get availability slots
  async getPhotographerMeAvailability(authToken: string): Promise<{ availability: VendorBookerAvailabilitySlot[] }> {
    return this.request<{ availability: VendorBookerAvailabilitySlot[] }>("/api/photographers/me/availability", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // GET /api/photographers/me/bookings - Get booking records
  async getPhotographerMeBookings(authToken: string): Promise<{ bookings: PhotographerBooking[] }> {
    return this.request<{ bookings: PhotographerBooking[] }>("/api/photographers/me/bookings", {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
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

  // PATCH /api/vendor/my-business - Update business profile
  async updateVendorMyBusiness(authToken: string, data: Partial<BusinessOnboardingData>): Promise<{ business: VendorBookerBusiness }> {
    console.log("[API] updateVendorMyBusiness RAW input:", JSON.stringify(data, null, 2));
    
    // Build defensive payload - filter out empty/null/undefined values
    const cleanPayload: Record<string, any> = {};
    
    // Only include fields with valid non-empty values
    if (data.name && data.name.trim()) {
      cleanPayload.name = data.name.trim();
    }
    if (data.category && data.category.trim()) {
      cleanPayload.category = data.category.trim();
    }
    if (data.description && data.description.trim()) {
      cleanPayload.description = data.description.trim();
    }
    if (data.tagline && data.tagline.trim()) {
      cleanPayload.tagline = data.tagline.trim();
    }
    if (data.city && data.city.trim()) {
      cleanPayload.city = data.city.trim();
    }
    if (data.state && data.state.trim()) {
      cleanPayload.state = data.state.trim();
    }
    if (data.address && data.address.trim()) {
      cleanPayload.address = data.address.trim();
    }
    if (data.contactEmail && data.contactEmail.trim()) {
      cleanPayload.contactEmail = data.contactEmail.trim();
    }
    if (data.contactPhone && data.contactPhone.trim()) {
      cleanPayload.contactPhone = data.contactPhone.trim();
    }
    if (data.websiteUrl && data.websiteUrl.trim()) {
      cleanPayload.websiteUrl = data.websiteUrl.trim();
    }
    if (typeof data.hasProducts === 'boolean') {
      cleanPayload.hasProducts = data.hasProducts;
    }
    if (typeof data.hasServices === 'boolean') {
      cleanPayload.hasServices = data.hasServices;
    }
    if (typeof data.hasPhysicalLocation === 'boolean') {
      cleanPayload.hasPhysicalLocation = data.hasPhysicalLocation;
    }
    if (typeof data.isOnlineOnly === 'boolean') {
      cleanPayload.isOnlineOnly = data.isOnlineOnly;
    }
    if (data.yearsInBusiness && data.yearsInBusiness > 0) {
      cleanPayload.yearsInBusiness = data.yearsInBusiness;
    }
    if (data.numberOfEmployees && data.numberOfEmployees > 0) {
      cleanPayload.numberOfEmployees = data.numberOfEmployees;
    }
    if (data.businessStructure && data.businessStructure.trim()) {
      cleanPayload.businessStructure = data.businessStructure.trim();
    }
    if (data.hoursOfOperation && Object.keys(data.hoursOfOperation).length > 0) {
      cleanPayload.hoursOfOperation = data.hoursOfOperation;
    }
    if (data.brandColors && data.brandColors.trim()) {
      cleanPayload.brandColors = data.brandColors.trim();
    }
    if (data.coverImage && data.coverImage.trim()) {
      cleanPayload.coverImage = data.coverImage.trim();
    }
    if (data.logoImage && data.logoImage.trim()) {
      cleanPayload.logoImage = data.logoImage.trim();
    }
    
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
    return this.request<{ product: VendorProduct }>("/api/vendor/products", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/vendor/products/:id - Update a product
  async updateVendorProduct(authToken: string, productId: string, data: Partial<VendorProductInput>): Promise<{ product: VendorProduct }> {
    return this.request<{ product: VendorProduct }>(`/api/vendor/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
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
    return this.request<{ service: VendorService }>("/api/vendor/services", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  // PATCH /api/vendor/services/:id - Update a service
  async updateVendorService(authToken: string, serviceId: string, data: Partial<VendorServiceInput>): Promise<{ service: VendorService }> {
    return this.request<{ service: VendorService }>(`/api/vendor/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Authorization": `Bearer ${authToken}` },
    });
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

  async getBusinessOrders(authToken: string, status?: string): Promise<BusinessOrder[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<BusinessOrder[]>(`/api/business/orders${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessBookings(authToken: string, status?: string): Promise<BusinessBooking[]> {
    const query = status ? `?status=${status}` : "";
    return this.request<BusinessBooking[]>(`/api/business/bookings${query}`, {
      headers: { "Authorization": `Bearer ${authToken}` },
    });
  }

  async getBusinessProducts(authToken: string): Promise<BusinessProduct[]> {
    return this.request<BusinessProduct[]>("/api/business/products", {
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

  async getBusinessServices(authToken: string): Promise<BusinessService[]> {
    return this.request<BusinessService[]>("/api/business/services", {
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

  async updateOrderStatus(authToken: string, orderId: string, status: string): Promise<void> {
    await this.request<void>(`/api/business/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
      headers: { "Authorization": `Bearer ${authToken}` },
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

  normalizeSearchResults(response: SearchResponse): UnifiedSearchResult[] {
    const results: UnifiedSearchResult[] = [];

    if (response.businesses && Array.isArray(response.businesses)) {
      response.businesses.forEach(b => {
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
        const locationParts = (p.location || "Unknown, Unknown").split(",").map(s => s.trim());
        
        results.push({
          id: p.id,
          name: p.name || "Unknown Photographer",
          avatar: p.avatar || p.image || "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=400",
          city: locationParts[0] || "Unknown",
          state: locationParts[1] || "",
          rating: p.rating || 0,
          priceRange: p.priceRange || "$$",
          category: p.specialty || "Photography",
          description: p.description || "",
          subscriptionTier: p.subscriptionTier,
          resultType: "photographer",
        });
      });
    }

    return results;
  }
}

export const api = new ApiService();
export default api;

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
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
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

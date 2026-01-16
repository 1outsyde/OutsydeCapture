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

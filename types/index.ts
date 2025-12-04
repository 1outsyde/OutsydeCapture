export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  isPhotographer: boolean;
  createdAt: string;
}

export interface Photographer {
  id: string;
  name: string;
  avatar: string;
  specialty: PhotographyCategory;
  rating: number;
  reviewCount: number;
  priceRange: PriceRange;
  location: string;
  bio: string;
  portfolio: string[];
  availability: AvailabilitySlot[];
  featured: boolean;
}

export type PhotographyCategory = 
  | "wedding"
  | "portrait"
  | "events"
  | "product"
  | "nature"
  | "fashion";

export type PriceRange = "$" | "$$" | "$$$" | "$$$$";

export interface AvailabilitySlot {
  date: string;
  timeSlots: TimeSlot[];
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface Session {
  id: string;
  photographerId: string;
  photographerName: string;
  photographerAvatar: string;
  clientId: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  sessionType: PhotographyCategory;
  notes?: string;
  status: SessionStatus;
  totalPrice: number;
  createdAt: string;
}

export type SessionStatus = 
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface BookingFormData {
  photographerId: string;
  date: string;
  timeSlotId: string;
  location: string;
  sessionType: PhotographyCategory;
  notes: string;
}

export const CATEGORY_LABELS: Record<PhotographyCategory, string> = {
  wedding: "Wedding",
  portrait: "Portrait",
  events: "Events",
  product: "Product",
  nature: "Nature",
  fashion: "Fashion",
};

export const CATEGORY_ICONS: Record<PhotographyCategory, string> = {
  wedding: "heart",
  portrait: "user",
  events: "calendar",
  product: "box",
  nature: "sun",
  fashion: "star",
};

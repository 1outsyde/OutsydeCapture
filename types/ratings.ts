export type RatingTargetType =
  | 'business'
  | 'photographer'
  | 'product'
  | 'service';

export type PurchaseType = 'order' | 'appointment' | 'shoot_booking';

export interface PurchaseItem {
  purchaseId: string;
  purchaseType: PurchaseType;
  targetId: string;
  targetType: 'business' | 'photographer';
  label: string;
  date: string;
}

export interface RatingCheckResponse {
  canRate: boolean;
  purchases: PurchaseItem[];
  existingRating: {
    id: string;
    rating: number;
    purchaseId: string | null;
    purchaseType: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface Rating {
  id: string;
  userId: string;
  targetType: RatingTargetType;
  targetId: string;
  rating: number;
  purchaseId: string | null;
  purchaseType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingsResponse {
  count: number;
  average: number;
  distribution: {
    10: number;
    20: number;
    30: number;
    40: number;
    50: number;
  };
  userRating: Rating | null;
}

export function ratingToDisplay(stored: number): number {
  return stored / 10;
}

export function displayToRating(display: number): number {
  return Math.round(display * 10);
}

export function ratingToStars(stored: number): number {
  return Math.round(stored / 5) / 2;
}

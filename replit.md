# Outsyde - Social Marketplace App

## Overview
Outsyde is a social marketplace app connecting clients with service providers and vendors (photographers, stylists, artists, restaurants). It enables users to browse feeds, book services, purchase products, and interact. The platform aims to empower local businesses and enhance user discovery across iOS, Android, and web.

## User Preferences
I prefer clear, concise communication. When making changes, please explain the reasoning and potential impact. I prefer an iterative development approach, focusing on one feature or fix at a time. Do not make changes to folder `types/` or file `App.tsx` without explicit instruction.

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Gold/yellow variations, white/black backgrounds, success green.
- **Branding**: Y logo, iOS 26 Liquid Glass inspiration with transparent headers and blur effects.
- **Tier Colors**: Gold (Premium), Silver (Pro), Bronze (Basic) badges for businesses.
- **Reusable Components**: `ThemedText`, `ThemedView`, `Button`, `Card`, `HeaderTitle`, `HoursEditor`.
- **Safe Area Handling**: Custom wrappers for tab screens, manual insets for modals.

### Technical Implementations
- **Authentication**: Session-based auth with VendorBooker backend via cookies (`connect.sid`). Three signup roles: Consumer (auto-approved), Business (manual approval), Photographer (auto-approved). Role is set at signup only.
  - **Signup Endpoints (Role-Specific)**: 
    - `POST /api/auth/customer/signup` - Required: `{ email, password, name }`
    - `POST /api/auth/vendor/signup` - Required: `{ email, password, name, businessName, businessCategory, offerType, acceptedSubscription }`
    - `POST /api/auth/photographer/signup` - Required: `{ email, password, name, displayName, city, state, hourlyRate, portfolioUrl }`
  - **Login Endpoint**: `POST /api/auth/login` - Returns `{ user, photographer?, vendor? }` with session cookie
  - **User Role Extraction**: Determined from backend flags (`isPhotographer`, `isVendor`), not a `role` field
  - **Photographer Data**: Returned in separate `photographer` object in login response
  - **Mobile Signup Flow**: Call role-specific signup → immediately call /api/auth/login → for web cookies handle auth automatically
  - **Token Storage**: AsyncStorage key `@outsyde_token` stores session indicator (`session_${userId}`)
  - **Protected Requests**: Cookies handle auth for web; credentials: 'include' on fetch requests
  - **401 Handling**: Logout immediately (no retries)
- **Role-Based Access**: Dashboards (Photographer, Business) are accessible immediately upon signup without requiring profile completion or re-entry of data. Admin dashboard is accessible to specific admin emails with comprehensive user, business, payment, message, and influencer management.
  - **Canonical Flow**: Signup saves all profile data → Dashboard reads existing data (never auto-updates) → Optional Edit Profile for explicit changes
  - **Dashboard Behavior**: Read-only on mount, no auto-PATCH calls, handles 404 gracefully using AuthContext user data
- **Stripe Booking Restriction**: Users cannot book photographers who haven't completed Stripe onboarding (`stripeOnboardingComplete: false`). The dashboard remains accessible, but the booking flow is blocked with a user-friendly alert. Stripe only gates bookings/payouts, never dashboard access.
- **Navigation**: Expo SDK 54, React Navigation 7 (Root, MainTab, Stack Navigators).
- **Data Management**: Context APIs for Auth, Data, Orders, Loyalty, Notifications, Payments, Messages, and Favorites.
- **Core Features**: Personalized content feed, category/location-based search, 4-step booking flow, in-app messaging, payment processing, loyalty program, rating system, and favorites.
- **Onboarding**: 4-screen welcome flow.
- **Profile Screens**: Dedicated premium modal screens for Business and Photographer profiles, featuring hero sections, portfolios, and contact details. Supports custom brand color theming for public profiles.
- **Admin Dashboard**: Comprehensive interface for user, business, photographer, payment, message, and influencer management. Includes real-time notifications for new business applications.
- **Provider Dashboards (Photographer & Business)**: Dedicated dashboards for managing earnings, bookings/orders, services/products, availability, and profile information. Both integrate with Stripe Connect.
- **Storefront Editor**: Full-featured customization for businesses, including branding (cover, logo, colors), profile details, business hours, and product/service management. Products/services have statuses (draft, live, paused, archived) with specific publishing gates (admin approval, Stripe setup, active subscription).
- **Image Handling**: Reusable `ImageUploader` component with camera/library options and aspect ratio support.
- **Backend Enforcement**: Critical logic (publishing validation, subscription lapse auto-pause) is enforced server-side.

### System Design Choices
- **Cross-Platform**: Expo/React Native for iOS, Android, and web.
- **Security**: User-scoped keys for AsyncStorage, scoped payment methods.
- **Backend Integration**: API service layer (`/services/api.ts`) with VendorBooker backend, including a `HealthCheckContext`.
- **Technologies**: `expo-image`, `expo-image-picker`, `expo-notifications`, `react-native-reanimated`.

## External Dependencies
- **Expo SDK 54**: Core framework.
- **React Navigation 7**: Navigation.
- **AsyncStorage**: Client-side persistence.
- **expo-image**: Image optimization.
- **expo-image-picker**: Image uploads.
- **expo-notifications**: Push notifications.
- **react-native-reanimated**: Animations.
- **Outsyde Backend API**: `https://outsyde-backend.onrender.com`.
- **Stripe-like Payment Gateway**: For payment processing.
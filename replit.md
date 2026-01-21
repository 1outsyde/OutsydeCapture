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
- **Reusable Components**: `ThemedText`, `ThemedView`, `Button`, `Card`, `HeaderTitle`, `HoursEditor`, `DateBlocker`.
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
  - **Stripe Deep Link Return**: Uses `outsyde://stripe-return` as the return URL for Stripe onboarding. Dashboard screens listen for this deep link and auto-refresh Stripe status when user returns from onboarding flow.
- **Deep Linking**: App scheme is `outsyde://`. Configured in `app.json` with `scheme: "outsyde"`. Currently handles `stripe-return` path for Stripe onboarding callbacks.
- **Navigation**: Expo SDK 54, React Navigation 7 (Root, MainTab, Stack Navigators).
  - **Account Tab Pattern**: Follows Instagram/Twitter pattern - Account tab shows user's own public profile (self-view). Hamburger menu in header opens PersonalSettingsMenu action sheet with Dashboard, Edit Profile, Storefront Editor, Stripe settings, and Logout options.
  - **Guest Mode Restrictions**: Guest users (`isGuest: true`) see a limited profile view without hamburger menu, points card, or Quick Actions.
  - **Dashboard Presentation**: Dashboard and editor screens use card presentation with slide-from-right animation and proper back navigation to Account/Profile.
- **Data Management**: Context APIs for Auth, Data, Orders, Loyalty, Notifications, Payments, Messages, and Favorites.
- **Core Features**: Algorithmic content feed, category/location-based search, backend-driven booking flow, in-app messaging, payment processing, loyalty program, rating system, and favorites.
- **Algorithmic Feed (Instagram/TikTok-style)**: Backend-driven feed ranking at `GET /api/feed`:
  - **All Posts Visible**: Shows posts from all vendors, not just followed accounts
  - **Ranking Factors**: Recency (72-hour decay), engagement (likes/comments), product/service boost, user industry preferences, location proximity (10/25/50/100 mile tiers)
  - **Location-Based**: Requests user location permission for proximity ranking
  - **Personalized**: Authenticated users get industry-preference and location-based personalization
  - **Anonymous Support**: Works without login using engagement and recency only
- **Universal Notification Bell**: Available on Home screen header for all authenticated users (not just admins), with unread count badge.
- **Booking System (Backend-Driven)**: Zero client-side availability computation. Backend is single source of truth.
  - **Flow**: Service → Date → Slot → Review/Confirm → Payment
  - **Step Gates**: Each step is disabled until previous step is complete
  - **Slot Holding**: Selecting a time slot creates a draft reservation with 10-minute hold timer
  - **Countdown Timer**: Review step shows live countdown; confirm disabled when expired
  - **Auto-Cleanup**: Draft cancelled on navigation away or expiration
  - **API Endpoints**:
    - `GET /api/photographers/:id/available-dates` - Backend-computed available dates
    - `GET /api/photographers/:id/slots?date=YYYY-MM-DD` - Backend-computed available slots
    - `POST /api/bookings/draft` - Create held slot reservation
    - `DELETE /api/bookings/draft/:id` - Release held slot
    - `POST /api/bookings/draft/:id/confirm` - Finalize booking with payment
- **Onboarding**: 4-screen welcome flow.
- **Profile Screens**: Instagram/Shopify-style public profiles with:
  - **Hero Section**: Full-width banner with LinearGradient overlay, overlapping circular avatar
  - **Profile Identity**: Name, bio tagline, location, hourly rate, specialty pills with brand color accent
  - **Availability Strip**: Tappable gold bar showing "Available Today: 10AM - 6PM" (photographers/businesses)
  - **Tab Navigation**: Large tabs with icons - Media/Book/Availability/Reviews (photographers), Products/Services/Availability/Reviews (businesses)
  - **Tab Content**: Media gallery grid, booking cards with pricing, availability calendar, reviews list
  - **Browse Portfolio**: Horizontal scrolling category cards with ratings
  - **For You Section**: Featured packages, quick availability widget, reviews snippet
  - **Owner Controls**: Edit Profile button for owners; Follow/Share/Book buttons for visitors
  - **Guest Restrictions**: Limited view without hamburger menu or edit actions
- **Admin Dashboard**: Comprehensive interface for user, business, photographer, payment, message, and influencer management. Includes real-time notifications for new business applications.
- **Provider Dashboards (Photographer & Business)**: Dedicated dashboards for managing earnings, bookings/orders, services/products, availability, and profile information. Both integrate with Stripe Connect.
- **Photographer Service Management**: Complete CRUD for photography services via dashboard:
  - **ServiceEditorModal Component**: Form modal with name, description, category, pricing model (package/hourly), price, duration fields
  - **Service Status Flow**: draft → active (via Go Live) → archived. Status badges: orange (draft), green (active), gray (archived)
  - **Publishing Gates**: Go Live requires Stripe connected, creates Stripe product for payment processing
  - **API Endpoints**: `GET/POST /api/photographers/me/services`, `PATCH/DELETE /api/photographers/me/services/:id`, `POST .../go-live`, `POST .../archive`
- **Photographer Availability System**: 3-tier Calendly/HoneyBook-style availability management:
  - **Base Availability (HoursEditor)**: Weekly recurring working hours that act as constraints. Stored as `VendorBookerAvailabilitySlot` with `dayOfWeek`, `startTime`, `endTime`, `isRecurring`.
  - **Blocked Dates (DateBlocker)**: Calendar-based UI for one-off overrides (vacations, external shoots, personal time). Uses `BlockedDate` with `date`, `isFullDay`, `startTime`, `endTime`, `reason`. Quick block options for Today/Tomorrow/Weekend/Week. Supports both full-day blocks and hourly blocks (specific time ranges) for flexible scheduling.
  - **Computed Slots**: Public profile Availability tab shows 7-day calendar view with real-time computation: base hours minus blocked dates = available slots. Green checkmarks for available, red X for blocked, gray for unavailable.
  - **API Endpoints**: `GET/PUT /api/photographers/me/availability`, `GET/PUT /api/photographers/me/blocked-dates`.
- **Storefront Editor**: Full-featured customization for businesses, including branding (cover, logo, colors), profile details, business hours, and product/service management. Products/services have statuses (draft, live, paused, archived) with specific publishing gates (admin approval, Stripe setup, active subscription).
- **Image Handling**: Reusable `ImageUploader` component with camera/library options and aspect ratio support.
- **Cloudinary Image Upload**: Profile photos and banner images are uploaded to Cloudinary (unsigned upload preset) and saved to the backend. Flow: Pick image → Upload to Cloudinary → Save URL to profile via API.
  - **Cloud Name**: `doraffjvp`
  - **Upload Preset**: `outsyde_unsigned`
  - **Utility**: `services/cloudinary.ts` - `uploadImageToCloudinary(uri, folder)`
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
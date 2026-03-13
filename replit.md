# Outsyde - Social Marketplace App

## Overview
Outsyde is a social marketplace app designed to connect clients with service providers and vendors such as photographers, stylists, artists, and restaurants. The platform's primary purpose is to facilitate browsing feeds, booking services, purchasing products, and user interaction. It aims to empower local businesses and enhance user discovery across iOS, Android, and web platforms, providing a comprehensive ecosystem for service and product exchange.

## User Preferences
I prefer clear, concise communication. When making changes, please explain the reasoning and potential impact. I prefer an iterative development approach, focusing on one feature or fix at a time. Do not make changes to folder `types/` or file `App.tsx` without explicit instruction.

## System Architecture

### UI/UX Decisions
The application features a modern UI with a color scheme centered around gold/yellow variations, complemented by white/black backgrounds and success green. Branding includes a "Y" logo and an iOS 26 Liquid Glass-inspired design with transparent headers and blur effects. Businesses are visually distinguished by Gold (Premium), Silver (Pro), and Bronze (Basic) tier badges. The UI is built using reusable components like `ThemedText`, `ThemedView`, `Button`, `Card`, `HeaderTitle`, `HoursEditor`, and `DateBlocker`, with custom wrappers for safe area handling.

### Technical Implementations
- **Authentication**: Session-based authentication with the VendorBooker backend using cookies. It supports three signup roles: Consumer (auto-approved), Business (manual approval), and Photographer (auto-approved), with roles set exclusively at signup. User roles are determined by backend flags (`isPhotographer`, `isVendor`).
- **Role-Based Access**: Dashboards for Photographers and Businesses are immediately accessible upon signup. An Admin dashboard provides comprehensive management capabilities.
- **Stripe Integration**: Booking photographers is restricted until Stripe onboarding is complete, with deep linking (`outsyde://stripe-return`) for seamless return after onboarding.
- **Deep Linking**: Uses `outsyde://` scheme for internal navigation and external callbacks.
- **Navigation**: Built with Expo SDK 54 and React Navigation 7, featuring Root, MainTab, and Stack Navigators. The Account tab follows a social media pattern, displaying the user's public profile, with a hamburger menu for settings and dashboard access.
- **Data Management**: Utilizes Context APIs for managing Auth, Data, Orders, Loyalty, Notifications, Payments, Messages, and Favorites.
- **Core Features**: Includes an algorithmic content feed, category/location-based search, a backend-driven booking flow, in-app messaging, payment processing, a loyalty program, rating system, and favorites.
- **Dual-Feed Architecture**: The home screen supports two distinct feed modes with separate backend endpoints:
  - **Pro Feed** (`GET /api/feed`): Business-focused, location-aware algorithmic feed. Ranks by provider type, ratings, recency, and location proximity. Optimized for discovery of services and products.
  - **Pulse Feed** (`GET /api/pulse/feed`): TikTok-style discovery feed. Full-screen vertical video with single-video-at-a-time playback, tap-to-pause, optimistic like toggles, and cursor pagination. Implemented as `screens/PulseFeedScreenV2.tsx` + `components/PulseVideoCard.tsx`. Self-contained: owns its own data fetching, comments modal, engagement tracking, and feedEvents subscription.
  - **Engagement Tracking** (`POST /api/pulse/engagement`): Pulse feed tracks video watch time, completion rate, and rewatch signals for ranking algorithm.
  - **PulseVideoCard layout**: Right engagement stack (absolute right:16 bottom:160), bottom-left author/caption block (absolute left:16 bottom:100), bottom-right sound label (absolute right:16 bottom:80). Tap active card to pause/resume.
- **Universal Notification Bell**: Located on the Home screen header for all authenticated users, displaying an unread count.
- **Post Commerce Navigation**: Commerce-enabled posts allow direct booking or purchasing via "Book" or "Buy Now" buttons, linking directly to booking screens or product pages.
- **Booking System**: A backend-driven system handles service booking, date/slot selection, review, and payment via Stripe PaymentSheet. It includes draft reservation holding with a 10-minute timer and auto-acceptance options based on provider settings.
- **Onboarding**: A 4-screen welcome flow for new users. Slide 4 is a role selection screen (Consumer / Business / Photographer). Selected role saved to AsyncStorage under `@outsyde_user_type`. On "Get Started", the stack resets to `[Main, <RoleSignup>]` so after signup `goBack()` lands on Main. Onboarding is registered inside the Stack.Navigator with `initialRouteName` driven by the async `checkOnboardingComplete()` check. `gestureEnabled: false` prevents swiping back into onboarding after it completes.
- **Profile Screens**: Instagram/Shopify-style public profiles with hero sections, identity details, availability strips, and tabbed navigation for media, bookings, availability, and reviews.
- **Admin Dashboard**: Provides a comprehensive interface for managing users, businesses, payments, messages, and influencers.
- **Provider Dashboards**: Dedicated dashboards for Photographers and Businesses to manage earnings, bookings, services/products, availability, and profile information, integrating with Stripe Connect.
- **Photographer Service Management**: CRUD operations for photography services via a dashboard, including status management (draft, live, archived) and publishing gates.
- **Post Display Layout System (Pro/Pulse)**: Posts have a `displayLayout` field that controls how they appear on profiles. This is a presentation choice made during post creation, NOT derived from postIntent:
  - **Pro**: Square grid cards (140x140), gold dot indicator, storefront-style presentation
  - **Pulse**: Vertical cards (120x180), pink dot indicator, immersive feed-style presentation
  - **Create Post Flow**: After selecting media, users must choose Pro or Pulse format before sharing
  - **Featured Tab**: Renders two distinct horizontal-scroll rows (Pro row, Pulse row), hiding empty rows
  - **ProfileFeedScreen**: Receives `{ profileId, layout }` and filters posts client-side by displayLayout

### Booking Flow Implementation (CRITICAL - DO NOT CHANGE WITHOUT EXPLICIT INSTRUCTION)

#### Service Status Values
- **`draft`**: Service is created but not visible to clients. Shows "Go Live" button in dashboard.
- **`live`**: Service is published, visible to clients, and bookable. Has Stripe product/price created.
- **`archived`**: Service is hidden from clients but data is preserved. Shows in dashboard with Archive badge.

#### Go Live Flow (Dashboard → Backend → Stripe)
1. **Pre-check**: Verify provider has completed Stripe Connect onboarding (`profile.stripeConnected`)
2. **API Call**: `POST /api/photographers/me/services/:id/go-live`
3. **Backend creates**: Stripe Product + Stripe Price linked to provider's Connect account
4. **Response includes**: `stripeConnectedProductId`, `stripeConnectedPriceId`, `status: "live"`
5. **UI updates**: Loading spinner during publish, success alert, refresh dashboard
6. **Error handling**: If Stripe onboarding incomplete, show "Finish Stripe Setup" CTA

#### Service Filtering Rules
- **Dashboard** (`PhotographerDashboardScreen.tsx`): Shows ALL services (draft, live, archived) with status badges
- **Public Profile** (`ProfileScreen.tsx`): Filters to `status === "live" || status === "active"` only
- **BookingFlow** (`components/BookingFlow.tsx`): Filters to `status === "live" || status === "active"` only
- **Type Definition** (`BookingService` in `services/api.ts`): `status?: "live" | "active" | "draft" | "archived"`

#### API Endpoints for Photographer Services
- `GET /api/photographers/me/services` - List all services for dashboard
- `POST /api/photographers/me/services` - Create new service (draft)
- `PATCH /api/photographers/me/services/:id` - Update service details
- `POST /api/photographers/me/services/:id/go-live` - Publish service (creates Stripe product)
- `POST /api/photographers/me/services/:id/archive` - Archive service
- `GET /api/photographers/:id/services` - Public endpoint for live services only

#### Dashboard UI States
- **Draft service**: Shows "Go Live" button (green) if Stripe connected, else "Finish Stripe Setup" (purple)
- **Live service**: Shows "Archive" button (gray)
- **Publishing**: Shows loading spinner on "Go Live" button, button disabled
- **Error**: Alert with specific message; Stripe errors show "Finish Stripe Setup" CTA

#### Booking Hold & Confirmation (FINALIZED - 100% CORRECT)
- **Hold Creation**: `POST /api/booking/hold` with `{ providerId, providerType, serviceId, date, startTime }`
- **Hold Response Handling**: Backend may not return full `service` and `slot` objects; UI uses safe fallbacks:
  - Service name: `hold?.service?.name || selectedService?.name`
  - Duration: `hold?.service?.durationMinutes || selectedService?.durationMinutes`
  - Date: `hold?.slot?.date || selectedDate`
  - Time: `hold?.slot?.startTime/endTime || selectedSlot?.startTime/endTime`
  - Price: `hold?.service?.priceCents || selectedService?.priceCents`
- **Confirm Step**: Displays hold timer, service details, and "Pay Now" button
- **Calendar Integration**: Days show available/unavailable based on weekly availability; time slots filtered by service duration
- **Photographer Availability System**: A 3-tier system for managing availability:
  - **Weekly Availability**: Recurring working hours via `GET/PUT /api/photographers/me/weekly-availability`
  - **Blocked Time Ranges**: Manual blocks via `GET/POST/PATCH/DELETE /api/photographers/me/blocks`
  - **ProviderCalendar Component**: Visual calendar in dashboards showing bookings, blocked dates, and weekly availability with 3-month lookahead
  - Same endpoints exist for businesses via `/api/businesses/me/...`
- **Storefront Editor**: A full-featured editor for businesses to customize branding, profile details, hours, and manage products/services.
- **Image Handling**: Reusable `ImageUploader` component with camera/library options and aspect ratio support.
- **Cloudinary Media Upload**: Images and videos are uploaded to Cloudinary (unsigned preset `outsyde_unsigned`, cloud name `doraffjvp`) with URLs saved to the backend.
- **Backend Enforcement**: Critical logic, such as publishing validation and subscription lapse handling, is enforced server-side.
- **Push Notifications**: Implemented using `expo-notifications` and `expo-device` for booking confirmations, reminders, and badge count synchronization.
- **Influencer Tracking System**: Full frontend implementation for influencer referral and performance tracking:
  - **Referral Capture** (`services/referral.ts`): Captures `?ref=code` from deep links on app open via `Linking.getInitialURL()` and `Linking.addEventListener`. Stores in AsyncStorage and passes with signup/purchase events.
  - **Influencer Dashboard** (`screens/InfluencerDashboardScreen.tsx`): Shows unique referral link (with copy), total clicks/downloads/sign-ups/purchases, points balance, commission earned, current tier (Bronze/Silver/Gold/Elite) with badge, and progress bar to next tier. Auto-refreshes every 30s.
  - **Influencer Onboarding** (`screens/InfluencerOnboardingScreen.tsx`): Welcome flow for newly approved influencers showing referral link, per-platform placement instructions (Instagram, TikTok, YouTube, Twitter), commission structure, and tier thresholds.
  - **CTA Click Tracking**: ProFeedCard's Book/Buy buttons call `sendClickEvent()` in real time when post has `influencerReferralCode` field, before navigating.
  - **Settings Menu**: Approved influencers (`isInfluencer && influencerStatus === "approved"`) see "Influencer Dashboard" in settings; others see "Apply as Influencer".
  - **API Endpoints**: `GET /api/influencer/me/stats`, `POST /api/influencer/click`, `POST /api/influencer/event` (all ready for backend integration).
  - **Tier System**: Bronze (0-1%), Silver (1-3%), Gold (3-6%), Elite (6%+) based on conversion rate.

### System Design Choices
The application is built using Expo/React Native for cross-platform compatibility (iOS, Android, web). Security measures include user-scoped keys for AsyncStorage and scoped payment methods. Backend integration is managed through an API service layer (`/services/api.ts`) connecting to the VendorBooker backend, incorporating a `HealthCheckContext`. Key technologies include `expo-image`, `expo-image-picker`, `expo-notifications`, and `react-native-reanimated`.

## External Dependencies
- **Expo SDK 54**: Core framework for development.
- **React Navigation 7**: Handles all in-app navigation.
- **AsyncStorage**: For client-side data persistence.
- **expo-image**: Optimizes image loading and display.
- **expo-image-picker**: Manages image and video selection from device.
- **expo-notifications**: Facilitates push notification features.
- **expo-device**: Used for device-specific functionality, particularly for push notifications.
- **react-native-reanimated**: Powers animations and gestures.
- **Outsyde Backend API**: `https://outsyde-backend.onrender.com` serves as the primary backend.
- **Stripe-like Payment Gateway**: Integrated for secure payment processing.
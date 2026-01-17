# Outsyde - Social Marketplace App

## Overview
Outsyde is a social marketplace app designed to connect clients with various service providers and vendors, including photographers, hair stylists, artists, and restaurants. Users can browse a mixed feed of posts, book services, purchase products, interact via likes and comments, and communicate through in-app messaging. The project aims to create a vibrant platform for local businesses to showcase their work and for users to discover and engage with them across iOS, Android, and web platforms.

## User Preferences
I prefer clear, concise communication. When making changes, please explain the reasoning and potential impact. I prefer an iterative development approach, focusing on one feature or fix at a time. Do not make changes to folder `types/` or file `App.tsx` without explicit instruction.

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Primary gold/yellow (#D4A84B light, #E5C77A dark), white/black backgrounds, success green (#34C759).
- **Branding**: Y logo in app header.
- **Design Inspiration**: iOS 26 Liquid Glass with transparent headers and blur effects.
- **Tier Colors**: Premium (gold), Pro (silver), Basic (bronze) badges for businesses.
- **Components**: Reusable `ThemedText`, `ThemedView`, `Button`, `Card`, `HeaderTitle`, `HoursEditor` (day-by-day availability editor).
- **Safe Area Handling**: Custom `ScreenScrollView`, `ScreenFlatList`, `ScreenKeyboardAwareScrollView` for tab screens; manual `useSafeAreaInsets()` for modal screens.

### Technical Implementations
- **Authentication**: SSO (Apple/Google) and guest login. Three signup roles: Consumer (auto-approved), Business (manual approval 24-48h), Photographer (auto-approved). Role is set exclusively at signup - no post-signup role changes. Influencer is an additive status for consumers, not a separate role.
- **Role-Based Dashboard Access**: Dashboards are post-onboarding tools only accessible when profile is complete. Photographer Dashboard visible only to photographers with complete profiles. Business Dashboard visible only to approved businesses with complete profiles. Consumers see "Apply as Influencer" option. ProfileCompletionGateScreen shows required setup steps for incomplete profiles.
- **Navigation**: Expo SDK 54, React Navigation 7 with Root, MainTab, and Stack Navigators.
- **Data Management**: Context APIs for Auth, Data, Orders, Loyalty, Notifications, Payments, Messages, and Favorites.
- **Content Feed**: Personalized mixed feed (photographer/vendor posts) prioritizing favorites, local content, and premium tiers. Instagram-style posts with likes and comments.
- **Search & Discovery**: Filter by category (Photography, Food & Dining, Beauty & Hair, Art & Design, etc.), explore by city with preset location tabs, type-aware results, and debounced search.
- **Booking Flow**: 4-step process (date, time, details, review) with confirmation.
- **Sessions/Orders**: View upcoming/past sessions with galleries; "Orders In Progress" for vendor products.
- **Messaging**: In-app chat functionality.
- **Payments**: User-scoped payment methods and processing.
- **Loyalty Program**: Outsyde Points system for user engagement.
- **Rating System**: Eligibility check for reviews based on completed sessions/delivered orders.
- **Favorites**: User-specific saved items (photographers, businesses, products) with persistence.
- **Onboarding**: 4-screen welcome flow for first-time users.
- **Profile Screens**: Dedicated premium modal screens for Business and Photographer profiles, displaying hero sections, actions, about info, portfolios, and contact details. Hybrid data fetching for optimal UX.
- **Admin Dashboard**: Comprehensive admin interface accessible from Account screen (for admin users). Features 6 tabs:
  - **Users**: Search by username/name/email, view user details with orders/bookings/conversations/earnings
  - **Businesses**: Status filters (Pending/Approved/Rejected/All), approve/reject applications, search, earnings tracking
  - **Photographers**: Search and list view with earnings tracking (auto-approved accounts)
  - **Payments**: Sub-tabs for Orders, Bookings, Refunds with revenue stats overview
  - **Messages**: All platform conversations with preview and participant info
  - **Influencers**: Status filters and approve/reject workflow for influencer applications
- **Admin Access**: Admin dashboard is accessible via Account screen for users with emails: info@goutsyde.com or Jamesmeyers2304@gmail.com
- **Backend Health Check**: Only visible to admin users on the home/discover screen
- **Photographer Dashboard**: Provider dashboard for photographers accessible from Account screen. Features:
  - Stats row: Earnings, Upcoming Bookings, Unread Messages, Rating
  - Profile overview with avatar, name, hourly rate, portfolio link
  - Profile views and completed shoots stats
  - Billing address management
  - Tabs: Bookings (accept/decline), Services, Hours (availability), Storefront (coming soon), Profile (edit name, rate, bio, location, portfolio, specialties)
  - Stripe Connect integration banner for payment setup
- **Business Dashboard**: Provider dashboard for businesses accessible from Account screen. Features:
  - Stats row: Earnings, Orders/Bookings (adaptive based on business type), Unread Messages, Rating
  - Profile overview with avatar, business name, category, website link
  - Profile views stats
  - Billing address management
  - Tabs adapt based on businessType (product/service/both):
    - Product-based: Orders, Products, Storefront, Profile
    - Service-based: Bookings, Services, Hours, Storefront, Profile
    - Both: Orders, Bookings, Products, Services, Hours, Storefront, Profile
  - Order management (process, ship) and booking management (accept/decline)
  - Stripe Connect integration banner for payment setup
- **Storefront Editor**: Full-featured storefront customization accessible from Business Dashboard. Features 5 tabs:
  - **Branding**: Cover image upload, logo upload, brand color picker (8 presets: Golden Yellow, Rose Pink, Ocean Blue, Forest Green, Royal Purple, Sunset Orange, Teal, Slate Gray)
  - **Profile**: Business name, tagline, description, category, specialty badges (8 options: Fast Service, Premium Quality, Eco-Friendly, Local Favorite, Award Winning, Family Owned, Best Price, Custom Orders), contact info (email, phone, website), location (address, city, state)
  - **Hours**: Day-by-day business hours editor using HoursEditor component
  - **Products**: Product cards with status badges (draft/live/archived), add/edit/delete modal forms with image upload, name, description, price, and status
  - **Services**: Service cards with duration and price, add/edit/delete modal forms with name, description, duration (30-180 mins), and price
- **ImageUploader Component**: Reusable image picker with camera/library options, aspect ratio support (cover 16:9, square 1:1), placeholder states, and delete functionality

### VendorBooker Backend Integration
- **Backend URL**: `https://outsyde-backend.onrender.com` (VendorBooker)
- **Photographer Endpoints**: 
  - `GET /api/photographers/me` - Fetch photographer profile
  - `PATCH /api/photographers/me` - Update photographer profile
  - `POST /api/photographers/me/stripe-onboarding` - Start Stripe Connect onboarding
  - `GET /api/photographers/me/services` - Fetch photographer services
  - `GET /api/photographers/me/availability` - Fetch availability schedule
  - `GET /api/photographers/me/bookings` - Fetch photographer bookings
- **Business Endpoints**:
  - `GET /api/vendor/my-business` - Fetch business profile
  - `PATCH /api/vendor/my-business` - Update business profile (includes hoursOfOperation)
  - `POST /api/vendor/my-business/stripe-onboarding` - Start Stripe Connect onboarding
  - `GET/POST/PATCH/DELETE /api/vendor/products` - Product CRUD
  - `GET/POST/PATCH/DELETE /api/vendor/services` - Service CRUD
- **Photographer Onboarding Fields**: displayName, bio, city, state, hourlyRate (in cents), specialties array, portfolioUrl, coverImage, logoImage, brandColors
- **Business Onboarding Fields**: name, category, description, tagline, city, state, hasProducts, hasServices, yearsInBusiness, numberOfEmployees, businessStructure, hasPhysicalLocation, address, contactEmail, contactPhone, websiteUrl
- **Stripe Integration**: Both roles require Stripe Connect onboarding for payment processing via stripe-onboarding endpoints
- **Profile Completion**: Backend confirms `stripeOnboardingComplete` to indicate full profile completion
- **Approval Status**: Backend field `approvalStatus` (pending/approved/rejected) controls storefront visibility. Banner displays current status in StorefrontEditor.
- **Item Status Values**: Products and services support 4 status values:
  - `draft` - Not visible to customers, editable by owner
  - `live` - Visible and purchasable/bookable (requires all publishing gates)
  - `paused` - Auto-set when subscription lapses; not visible, still editable
  - `archived` - Hidden, read-only
- **Publishing Gates (Frontend)**: Products/services can only be set to "live" when:
  1. `approvalStatus === 'approved'` (storefront approved by admin)
  2. `stripeOnboardingComplete === true` (Stripe Connect setup complete)
  3. `subscriptionActive === true` (active subscription)
  Draft creation/editing is always allowed without restrictions.

### Backend Enforcement Requirements (For API Team)
The following logic MUST be enforced server-side (UI checks are advisory only):

**1. Publishing Validation (on product/service create/update)**
```javascript
// Reject status='live' unless all conditions met
if (requestBody.status === 'live') {
  const business = await getBusiness(userId);
  if (!business.stripeOnboardingComplete || 
      !business.subscriptionActive || 
      business.approvalStatus !== 'approved') {
    return res.status(403).json({ 
      error: 'Publishing requires approval, Stripe setup, and active subscription' 
    });
  }
}
```

**2. Subscription Lapse Auto-Pause (when subscription becomes inactive)**
```javascript
// When subscription.status changes to inactive/canceled:
await Product.updateMany(
  { businessId, status: 'live' },
  { status: 'paused' }
);
await Service.updateMany(
  { businessId, status: 'live' },
  { status: 'paused' }
);
```

**3. Paused Item Behavior**
- Paused items are NOT visible to customers in search/browse
- Paused items are NOT purchasable/bookable
- Paused items remain editable by the business owner
- When subscription is reactivated, paused items do NOT auto-republish (owner must manually set to live)

### System Design Choices
- **Cross-Platform**: Built with Expo/React Native for iOS, Android, and web.
- **Security**: User-scoped keys for AsyncStorage persistence; payment methods and transactions scoped per user ID.
- **Backend Integration**: API service layer (`/services/api.ts`) with VendorBooker backend. Includes `HealthCheckContext` for monitoring backend status.
- **Image Handling**: `expo-image` for optimized images, `expo-image-picker` for uploads.
- **Notifications**: `expo-notifications` for push notifications.
- **Animations**: `react-native-reanimated`.

## External Dependencies
- **Expo SDK 54**: Core framework for React Native development.
- **React Navigation 7**: For app navigation structure.
- **AsyncStorage**: For client-side data persistence.
- **expo-image**: Image optimization and display.
- **expo-image-picker**: Accessing device camera and photo library.
- **expo-notifications**: Handling push notifications.
- **react-native-reanimated**: For declarative animations.
- **Outsyde Backend API**: `https://outsyde-backend.onrender.com` for all data operations, search, and business logic.
- **Stripe-like Payment Gateway (mocked)**: For payment processing.
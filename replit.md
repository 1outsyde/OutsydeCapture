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
- **Components**: Reusable `ThemedText`, `ThemedView`, `Button`, `Card`, `HeaderTitle`.
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
- **Admin Access**: Users with "admin" in their email or email "admin@outsyde.com" can access the dashboard via Account > Admin Dashboard
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

### System Design Choices
- **Cross-Platform**: Built with Expo/React Native for iOS, Android, and web.
- **Security**: User-scoped keys for AsyncStorage persistence; payment methods and transactions scoped per user ID.
- **Backend Integration**: API service layer (`/services/api.ts`) with `https://outsyde-backend.onrender.com`. Includes `HealthCheckContext` for monitoring backend status.
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
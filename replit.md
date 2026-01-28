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
- **Algorithmic Feed**: A backend-driven feed (`GET /api/feed`) ranks content based on recency, engagement, product/service boosts, user preferences, and location proximity. It supports both authenticated and anonymous users.
- **Universal Notification Bell**: Located on the Home screen header for all authenticated users, displaying an unread count.
- **Post Commerce Navigation**: Commerce-enabled posts allow direct booking or purchasing via "Book" or "Buy Now" buttons, linking directly to booking screens or product pages.
- **Booking System**: A backend-driven system handles service booking, date/slot selection, review, and payment via Stripe PaymentSheet. It includes draft reservation holding with a 10-minute timer and auto-acceptance options based on provider settings.
- **Onboarding**: A 4-screen welcome flow for new users.
- **Profile Screens**: Instagram/Shopify-style public profiles with hero sections, identity details, availability strips, and tabbed navigation for media, bookings, availability, and reviews.
- **Admin Dashboard**: Provides a comprehensive interface for managing users, businesses, payments, messages, and influencers.
- **Provider Dashboards**: Dedicated dashboards for Photographers and Businesses to manage earnings, bookings, services/products, availability, and profile information, integrating with Stripe Connect.
- **Photographer Service Management**: CRUD operations for photography services via a dashboard, including status management (draft, active, archived) and publishing gates.
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
# Outsyde - Photography Booking App

## Overview
Outsyde is a mobile app where clients can browse and book photographers, view upcoming sessions, manage their account, communicate with photographers, and process payments. Built with Expo/React Native for iOS, Android, and web platforms.

## Project Structure
```
├── App.tsx                    # Root component with providers
├── app.json                   # Expo configuration
├── context/
│   ├── AuthContext.tsx        # Authentication (SSO + guest login)
│   ├── DataContext.tsx        # Photographers and sessions data
│   ├── NotificationContext.tsx # Push notifications system
│   ├── PaymentContext.tsx     # Payment processing (per-user scoped)
│   └── MessagesContext.tsx    # In-app messaging
├── navigation/
│   ├── types.ts              # Navigation type definitions
│   ├── RootNavigator.tsx     # Root stack (Main + modals)
│   ├── MainTabNavigator.tsx  # Bottom tab navigation
│   ├── DiscoverStackNavigator.tsx
│   └── AccountStackNavigator.tsx
├── screens/
│   ├── DiscoverScreen.tsx    # Browse photographers
│   ├── SearchScreen.tsx      # Search with filters
│   ├── SessionsScreen.tsx    # View bookings
│   ├── SessionDetailScreen.tsx # Session details + gallery
│   ├── AccountScreen.tsx     # Profile management
│   ├── AuthScreen.tsx        # Login/signup + guest
│   ├── PhotographerDetailScreen.tsx
│   ├── BookingScreen.tsx     # 4-step booking flow with modal
│   ├── NotificationsScreen.tsx # Notification settings & history
│   ├── PaymentScreen.tsx     # Payment methods & processing
│   ├── MessagesScreen.tsx    # Conversation list
│   └── ConversationScreen.tsx # Individual chat
├── components/
│   ├── Button.tsx            # Primary button component
│   ├── ThemedText.tsx        # Themed text with typography
│   ├── ThemedView.tsx        # Themed view component
│   ├── HeaderTitle.tsx       # Custom header with logo
│   ├── Card.tsx              # Reusable card component
│   ├── ErrorBoundary.tsx     # Error boundary wrapper
│   ├── ErrorFallback.tsx     # Error UI component
│   ├── ScreenScrollView.tsx  # Safe area scroll view
│   ├── ScreenFlatList.tsx    # Safe area flat list
│   └── ScreenKeyboardAwareScrollView.tsx
├── constants/
│   └── theme.ts              # Colors, spacing, typography
├── hooks/
│   ├── useTheme.ts           # Theme hook
│   ├── useColorScheme.ts     # Color scheme detection
│   └── useScreenInsets.ts    # Safe area insets
└── types/
    └── index.ts              # TypeScript types
```

## Key Features
- **Discover**: Browse featured photographers with horizontal carousel
- **Search**: Filter by category, price range, location
- **Booking**: 4-step flow (date → time → details → review) with confirmation modal
- **Sessions**: View upcoming/past sessions with countdown and photo galleries
- **Messaging**: In-app chat with photographers
- **Notifications**: Push notification settings and history
- **Payments**: Add cards, process payments (mock Stripe-like flow)
- **Account**: Profile editing, settings, guest login, logout

## Design System
- **Primary**: Deep blue (#1A2B4A)
- **Secondary**: Warm gold (#D4A574)
- **Accent**: Soft coral (#FF8A80)
- **Success**: Green (#4CAF50)
- **iOS 26 Liquid Glass**: Transparent headers, blur effects

## Tech Stack
- Expo SDK 54
- React Navigation 7
- AsyncStorage for persistence (user-scoped keys for security)
- expo-image for optimized images
- expo-notifications for push notifications
- react-native-reanimated for animations

## Security Notes
- Payment methods and transactions are scoped per user ID
- Authentication supports SSO (Apple/Google) and guest mode
- All persistent data uses user-specific AsyncStorage keys

## Running the App
```bash
npm run dev
```
- Scan QR code with Expo Go (iOS/Android)
- Web version at http://localhost:8081

## Recent Changes
- Added push notifications system with booking confirmations
- Added payment processing with user-scoped storage
- Added in-app messaging between clients and photographers
- Added photo galleries for completed sessions
- Added guest login for testing
- Fixed booking confirmation modal for web compatibility
- Implemented cross-platform alert handling

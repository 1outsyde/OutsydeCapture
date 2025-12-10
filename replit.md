# Outsyde - Photography & Vendor Marketplace App

## Overview
Outsyde is a social photography and vendor marketplace app where clients browse a mixed feed of photographer and vendor/store posts, interact via likes/comments, book photography sessions, purchase products from vendors, and communicate through in-app messaging. Built with Expo/React Native for iOS, Android, and web platforms.

## Project Structure
```
├── App.tsx                    # Root component with providers
├── app.json                   # Expo configuration
├── context/
│   ├── AuthContext.tsx        # Authentication (SSO + guest login)
│   ├── DataContext.tsx        # Photographers, sessions, posts data
│   ├── OrdersContext.tsx      # Orders management with rating eligibility
│   ├── LoyaltyContext.tsx     # Outsyde Points loyalty system
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
│   ├── useScreenInsets.ts    # Safe area insets
│   └── useRatingEligibility.ts # Rating verification hook
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
- **Primary**: Gold/Yellow (#D4A84B light, #E5C77A dark)
- **Background**: White (light mode), Black (dark mode)
- **Success**: Green (#34C759)
- **Tier Colors**: Premium (#FFD700 gold), Pro (#C0C0C0 silver), Basic (#CD7F32 bronze)
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

## Subscription Tiers
Photographers and vendors can subscribe to one of three tiers:
- **Basic**: $20/mo (bronze badge)
- **Pro**: $30/mo (silver badge)
- **Premium**: $40/mo (gold badge)

Tier badges are displayed on photographer cards in the Discover screen.

## Safe Area Patterns
- **Tab screens**: Use `ScreenScrollView`, `ScreenFlatList`, or `ScreenKeyboardAwareScrollView` - these use `useScreenInsets()` which requires being inside a tab navigator
- **Modal screens**: Use regular `ScrollView` with manual `useSafeAreaInsets()` - modals are outside the tab navigator so `useBottomTabBarHeight()` will crash
- DataContext Session uses `time` field (not startTime/endTime), status: "upcoming" | "completed" | "cancelled"

## Recent Changes
- Mixed feed now supports both photographer AND vendor/store posts:
  - Photographer posts: show "Photographer" label, "Book" button for booking sessions
  - Vendor posts: show "Vendor" label, product info (name + price), "Add to Cart" button
  - Post interface updated with `type: "photographer" | "vendor"` and author fields
- Cart/Orders updated with diverse vendor products:
  - PrintMaster Studio, MemoryBook Co, LensCraft Gear, PhotoGear Pro
  - Products include: canvas prints, photo albums, camera straps, ring lights
- Orders In Progress section shows orders from various vendors
- Merged vendors functionality into existing tabs:
  - Shopping bag icon in Home header opens Cart/Orders modal
  - Sessions/Upcoming tab shows "Orders In Progress" section
  - Streamlined to 5 bottom tabs: Home, Search, Upcoming, Messages, Account
- Implemented Instagram-style feed with post cards, images, captions, likes, and comments
- Added subscription tier badges (Premium/Pro/Basic) with different icons for vendors vs photographers
- Updated theme to gold/yellow color scheme with white/black backgrounds
- Added Y logo branding to app header (only icon, no text)
- Added push notifications, payment processing, and in-app messaging
- Added photo galleries for completed sessions
- Added guest login for testing
- Fixed booking confirmation modal for web compatibility
- Implemented cross-platform alert handling
- Added Outsyde Points loyalty system:
  - Points earned for bookings (50), purchases (10 per $1), reviews (25), referrals (100)
  - Points card in Account tab, detail screen with history and ways to earn
- Added rating verification system:
  - Only users with completed sessions can rate photographers
  - Only users with delivered orders can rate vendors
  - Uses useRatingEligibility hook combining DataContext and OrdersContext
  - Shows friendly message when user is not eligible to rate
- Expanded Search screen to support multiple business types:
  - Photography, Cinematography, Food & Dining, Fashion & Clothes, Local Services
  - City-based search (type any city name to filter)
  - Category filter chips for each business type
  - Type-aware result cards showing business type icon and category
  - Business data model with city/state, rating, priceRange, and subscription tier
- Hidden review count from all rating displays (only shows star rating now)

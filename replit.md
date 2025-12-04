# Outsyde - Photography Booking App

## Overview
Outsyde is a mobile app where clients can browse and book photographers, view upcoming sessions, and manage their account. Built with Expo/React Native for iOS, Android, and web platforms.

## Project Structure
```
├── App.tsx                    # Root component with providers
├── app.json                   # Expo configuration
├── context/
│   ├── AuthContext.tsx        # Authentication state management
│   └── DataContext.tsx        # Photographers and sessions data
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
│   ├── AccountScreen.tsx     # Profile management
│   ├── AuthScreen.tsx        # Login/signup
│   ├── PhotographerDetailScreen.tsx
│   ├── BookingScreen.tsx     # 4-step booking flow
│   └── SessionDetailScreen.tsx
├── components/
│   ├── Button.tsx            # Primary button component
│   ├── ThemedText.tsx        # Themed text with typography
│   ├── ThemedView.tsx        # Themed view component
│   ├── HeaderTitle.tsx       # Custom header with logo
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
- **Booking**: 4-step flow (date → time → details → review)
- **Sessions**: View upcoming/past sessions with countdown
- **Account**: Profile editing, settings, logout

## Design System
- **Primary**: Deep blue (#1A2B4A)
- **Secondary**: Warm gold (#D4A574)
- **Accent**: Soft coral (#FF8A80)
- **iOS 26 Liquid Glass**: Transparent headers, blur effects

## Tech Stack
- Expo SDK 54
- React Navigation 7
- AsyncStorage for persistence
- expo-image for optimized images
- react-native-reanimated for animations

## Running the App
```bash
npm run dev
```
- Scan QR code with Expo Go (iOS/Android)
- Web version at http://localhost:8081

## Recent Changes
- Initial MVP build with full booking flow
- Mock authentication system
- Sample photographer data
- Session management with local storage

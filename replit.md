# Outsyde - Social Marketplace App

## Overview
Outsyde is a social marketplace app where clients browse a mixed feed of posts from various businesses - photographers, vendors, hair stylists, artists, restaurants, and more. Users can book services, purchase products, interact via likes/comments, and communicate through in-app messaging. Built with Expo/React Native for iOS, Android, and web platforms.

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
│   ├── MessagesContext.tsx    # In-app messaging
│   └── FavoritesContext.tsx   # Saved items (photographers, businesses, products)
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
│   ├── ConversationScreen.tsx # Individual chat
│   ├── FavoritesScreen.tsx   # View saved items
│   └── OnboardingScreen.tsx  # First-time user welcome flow
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
- **Discover**: Personalized feed showing favorites first, then nearby cities, bookmark posts to save
- **Search**: Filter by category, explore by city (preset location tabs), bookmark businesses to save
- **Booking**: 4-step flow (date → time → details → review) with confirmation modal
- **Sessions**: View upcoming/past sessions with countdown and photo galleries
- **Messaging**: In-app chat with photographers
- **Notifications**: Push notification settings and history
- **Payments**: Add cards, process payments (mock Stripe-like flow)
- **Account**: Profile editing, settings, guest login, logout
- **Favorites**: View all saved photographers, businesses, and products
- **Onboarding**: 4-screen welcome flow shown once for first-time users
- **Portfolio Upload**: Photographers can add photos from camera/gallery using expo-image-picker

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
- expo-image-picker for photo uploads from camera/gallery
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
- Enhanced sign-up and login process with extended user profile:
  - Account type selection: Consumer (auto-approved) vs Business (requires manual approval)
  - Required fields: First Name, Last Name, Phone Number, Email, Date of Birth, Password
  - Business accounts also require: Business Name, Business Category
  - Phone number auto-formats to (555) 123-4567
  - Date of birth auto-formats to MM/DD/YYYY
  - Business accounts see "Pending Approval" screen after signup with 24-48 hour review notice
  - Login flow checks approval status: pending businesses shown approval screen, rejected accounts get error message
  - User model updated: firstName, lastName, phone, dateOfBirth, accountType, approvalStatus
  - Login returns structured result (success, isPending, isRejected) for proper flow control
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
- Expanded Search screen to support 7 diverse business types:
  - Photography, Cinematography, Food & Dining, Fashion & Clothes, Local Services, Beauty & Hair, Art & Design
  - City-based search (type any city name to filter)
  - Category filter chips for each business type
  - Type-aware result cards showing business type icon and category
  - Business data model with city/state, rating, priceRange, and subscription tier
- Added Beauty & Hair businesses:
  - Hair salons (Glamour Hair Studio)
  - Barber shops (The Barber Shop)
  - Nail salons (Nails by Nina)
  - Makeup artists (Glow Makeup Artistry)
  - Braiding specialists (Braids & Beyond)
  - Spas (Serenity Spa & Wellness)
- Added Art & Design businesses:
  - Painters (Canvas & Color Studio)
  - Muralists (Urban Murals Co)
  - Graphic designers (Digital Dreams Design)
  - Tattoo artists (Ink Masters Tattoo)
  - Ceramics/Pottery (Pottery Lane)
  - Sculptors (Sculpture Works)
- Added "Explore by City" location tabs to Search screen:
  - Preset cities: New York, Miami, Atlanta, Richmond VA, Los Angeles, Chicago, Houston, California
  - One-tap filtering to discover what each city has to offer for travelers
  - Location-aware empty states and results header (e.g., "3 Results in Atlanta")
  - Added businesses for Atlanta (Peachtree Photography, Southern Soul Kitchen, Atlanta Film Works)
  - Added businesses for Richmond VA (Richmond Portrait Studio, Virginia Belle Boutique, Capital City Catering)
  - Added businesses for Houston (Houston Lens Masters, Space City Eats, Houston Style Co)
- Hidden review count from all rating displays (only shows star rating now)
- Added Favorites/Saved Items system:
  - FavoritesContext with AsyncStorage persistence (user-scoped)
  - Bookmark icons on feed posts (DiscoverScreen) and business cards (SearchScreen)
  - Bookmark icon on PhotographerDetailScreen header
  - FavoritesScreen accessible from Account menu with count badge
  - Three types: photographers, businesses, products
- Added Onboarding flow:
  - OnboardingScreen with 4 swipeable welcome screens
  - Skip button and pagination dots
  - AsyncStorage flag to show only on first launch
  - RootNavigator checks onboarding status before showing main app
- Enhanced PhotographerDetailScreen:
  - Portfolio gallery grid with all photos
  - Image upload buttons (camera + gallery) using expo-image-picker
  - Message button in footer to start conversation
  - Bookmark button to save photographer
  - Web platform shows "Run in Expo Go" message for native features
- Personalized homepage feed (DiscoverScreen):
  - Posts from favorite photographers/vendors appear first
  - Then posts from cities matching user's saved favorites
  - Premium/Pro tier content prioritized next
  - Recent posts shown last
  - Integrates with FavoritesContext for dynamic personalization
- Backend Integration Setup:
  - API service layer in /services/api.ts with base URL https://outsyde-backend.onrender.com
  - HealthCheckContext for monitoring backend connection status
  - Health check banner on DiscoverScreen showing:
    - Loading state while connecting
    - Success state with status, service, and environment from backend /health endpoint
    - Error state with retry button if connection fails
- Real Search API Integration:
  - SearchScreen now fetches from /api/search endpoint with optional query params
  - API returns { businesses: [], photographers: [] }
  - Results normalized into unified array with resultType field (business, photographer, product, service)
  - Filter tabs: All, Businesses, Photographers, Products, Services with live counts
  - Client-side tab filtering without refetching
  - Debounced search (300ms) for better performance
  - Loading states and error handling with retry button
  - Preserved card design: image, name, city/state, rating, price range, category
- BusinessProfileScreen:
  - Premium modal screen with hero section (cover image, avatar, name, category, location, rating)
  - Action buttons: Message, Book/View Services, Visit Website (hides if missing)
  - About section with business description
  - Info section with address, phone, email, website, social media links
  - Graceful handling of missing fields (sections hidden when data is null)
  - Navigation from SearchScreen on card tap with full business data passed
  - Dark-mode-first design consistent with app styling

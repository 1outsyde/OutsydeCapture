# Outsyde Design Guidelines

## Architecture Decisions

### Authentication
**Required** - The app involves user accounts, session booking, and backend API integration.

**Implementation:**
- SSO-first approach: Apple Sign-In (iOS), Google Sign-In (cross-platform)
- Mock authentication in prototype using local state
- Login/signup screens include:
  - SSO buttons with provider branding
  - Privacy policy & Terms of Service links (placeholder URLs)
- Account screen includes:
  - Profile photo upload
  - Contact information fields
  - Log out (with confirmation alert)
  - Settings > Account > Delete Account (double confirmation required)

### Navigation
**Tab Bar Navigation** - The app has 3 distinct feature areas:

**Tab Structure (5 tabs):**
1. **Discover** (Browse photographers) - Left
2. **Search** (Photographer search & filters) - Left-center
3. **Book** (Core action - floating action button) - Center
4. **Sessions** (Upcoming sessions) - Right-center
5. **Account** (Profile & settings) - Right

**Modal Screens:**
- Photographer detail view (full-screen modal from Discover)
- Booking flow (modal stack from Book button)
- Session detail (modal from Sessions list)

## Screen Specifications

### 1. Discover Screen
**Purpose:** Browse featured and recommended photographers

**Layout:**
- **Header:** Transparent, fixed at top
  - Title: "Outsyde"
  - Right button: Filter icon
- **Content:** Scrollable vertical list
  - Hero section: Featured photographer carousel (horizontal scroll)
  - Category chips (horizontal scroll)
  - Photographer grid cards (2 columns)
- **Safe Area Insets:**
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Horizontal scrolling carousel
- Category filter chips
- Photographer cards (image, name, specialty, rating, price range)

### 2. Search Screen
**Purpose:** Search photographers by name, specialty, location

**Layout:**
- **Header:** Non-transparent
  - Search bar integrated into header
  - Cancel button (right)
- **Content:** Scrollable list
  - Recent searches (if applicable)
  - Filter controls (location, specialty, price)
  - Results list (photographer cards)
- **Safe Area Insets:**
  - Top: Spacing.xl (header is non-transparent)
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Search bar with auto-suggestions
- Filter chips (multi-select)
- Empty state illustration when no results

### 3. Booking Flow (Modal)
**Purpose:** Select photographer, date/time, and confirm booking

**Screens in Stack:**
- **Select Date:** Calendar view with photographer availability
- **Select Time:** Time slot picker (available slots highlighted)
- **Booking Details:** Form with location, session type, notes
- **Review & Confirm:** Summary with total cost

**Layout (Booking Details):**
- **Header:** Standard modal header
  - Left: Back/Cancel
  - Title: "Booking Details"
  - Right: None
- **Content:** Scrollable form
  - Form fields below fold
  - Submit button: Fixed at bottom of form (not in header)
- **Safe Area Insets:**
  - Top: Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

### 4. Sessions Screen
**Purpose:** View upcoming and past photography sessions

**Layout:**
- **Header:** Transparent
  - Title: "My Sessions"
  - Right button: Filter (Upcoming/Past)
- **Content:** Scrollable list
  - Upcoming sessions (chronological)
  - Countdown timer on next session
  - Past sessions (collapsible section)
- **Safe Area Insets:**
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Session cards (date, time, photographer, location, status)
- Countdown widget for next session
- Empty state for no sessions

### 5. Account Screen
**Purpose:** Manage profile, preferences, app settings

**Layout:**
- **Header:** Transparent
  - Title: "Account"
  - Right button: Edit
- **Content:** Scrollable
  - Profile section (avatar, name, email)
  - Preferences (notifications, location access)
  - Settings link
  - Log out button
- **Safe Area Insets:**
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Avatar upload/edit
- Text input fields
- Toggle switches
- Destructive action buttons

### 6. Photographer Dashboard (for photographers)
**Purpose:** View bookings, manage availability, client list

**Layout:**
- **Header:** Transparent
  - Title: "Dashboard"
  - Right button: Availability settings
- **Content:** Scrollable
  - Earnings summary card
  - Calendar view (monthly)
  - Client bookings list
- **Safe Area Insets:**
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Calendar component with booking indicators
- Client cards
- Statistics widgets

## Design System

### Color Palette
**Primary:** Deep blue (#1A2B4A) - Trust, professionalism
**Secondary:** Warm gold (#D4A574) - Premium, creativity
**Accent:** Soft coral (#FF8A80) - Call-to-action, highlights
**Neutrals:**
- Background: #FFFFFF
- Surface: #F8F9FA
- Border: #E1E4E8
- Text Primary: #1A1A1A
- Text Secondary: #6B7280

**Status Colors:**
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444
- Info: #3B82F6

### Typography
- **Headers:** SF Pro Display (iOS) / Roboto (Android)
  - H1: 34pt, Bold
  - H2: 28pt, Semibold
  - H3: 22pt, Semibold
- **Body:** SF Pro Text (iOS) / Roboto (Android)
  - Body Large: 17pt, Regular
  - Body: 15pt, Regular
  - Caption: 13pt, Regular
- **Buttons:** 16pt, Semibold

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px
- 3xl: 48px

## Visual Design

### Interaction Feedback
- All touchable elements have 0.7 opacity when pressed
- Primary buttons: scale to 0.98 on press
- Card taps: subtle highlight overlay (#000000 at 5% opacity)

### Floating Action Button (Book)
**Specifications:**
- Size: 56x56px circle
- Background: Accent color (#FF8A80)
- Icon: Camera (Feather icon)
- Shadow:
  - shadowOffset: {width: 0, height: 2}
  - shadowOpacity: 0.10
  - shadowRadius: 2
- Position: Center of tab bar, elevated 8px above bar

### Photography Assets
**Required Custom Assets:**
1. **Photographer profile placeholders** (8 variations)
   - Professional portrait style
   - Neutral backgrounds
   - Diverse representation
   - Aspect ratio: 4:3
2. **Category icons** (6 categories)
   - Wedding, Portrait, Events, Product, Nature, Fashion
   - Minimalist line art style
   - Monochrome (use primary color)
3. **Empty state illustrations** (3 variations)
   - No photographers found
   - No upcoming sessions
   - Photography-themed, friendly aesthetic

### Image Treatment
- All photographer images: Subtle gradient overlay (bottom 30%, black 0.3 opacity) for text legibility
- Card images: 8px border radius
- Avatar images: Circular crop
- Session photos: 12px border radius with 1px border (#E1E4E8)

### Accessibility
- Minimum touch target: 44x44px
- Color contrast: WCAG AA compliant (4.5:1 for text)
- Form labels: Always visible, not placeholder-only
- Error states: Icon + text + color (not color alone)
- VoiceOver/TalkBack labels on all interactive elements
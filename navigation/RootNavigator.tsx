import React, { useState, useEffect, useRef } from "react";
import { Pressable, Platform } from "react-native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import SelectPhotographerScreen from "@/screens/SelectPhotographerScreen";
import PhotographerDetailScreen from "@/screens/PhotographerDetailScreen";
import BookingScreen from "@/screens/BookingScreen";
import BookServiceScreen from "@/screens/BookServiceScreen";
import SessionDetailScreen from "@/screens/SessionDetailScreen";
import PhotoGalleryScreen from "@/screens/PhotoGalleryScreen";
import ConversationScreen from "@/screens/ConversationScreen";
import ChatScreen from "@/screens/ChatScreen";
import VendorDetailScreen from "@/screens/VendorDetailScreen";
import StaffWorkProfileScreen from "@/screens/StaffWorkProfileScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import EventDetailScreen from "@/screens/EventDetailScreen";
import TicketDetailScreen from "@/screens/TicketDetailScreen";
import EventEditorScreen from "@/screens/host/EventEditorScreen";
import YourEventsScreen from "@/screens/host/YourEventsScreen";
import ManageEventScreen from "@/screens/host/ManageEventScreen";
import DoorTeamScreen from "@/screens/host/DoorTeamScreen";
import DoorScannerScreen from "@/screens/host/DoorScannerScreen";
import DoorInviteScreen from "@/screens/DoorInviteScreen";
import DoorEventsScreen from "@/screens/DoorEventsScreen";
import MyTeamScreen from "@/screens/MyTeamScreen";
import AccountScreen from "@/screens/AccountScreen";
import CartOrdersScreen from "@/screens/CartOrdersScreen";
import CartCheckoutScreen from "@/screens/CartCheckoutScreen";
import CheckoutScreen from "@/screens/CheckoutScreen";
import ProductDetailScreen from "@/screens/ProductDetailScreen";
import ProductOrderDetailScreen from "@/screens/ProductOrderDetailScreen";
import OrderSuccessScreen from "@/screens/OrderSuccessScreen";
import FavoritesScreen from "@/screens/FavoritesScreen";
import BusinessOnboardingScreen from "@/screens/BusinessOnboardingScreen";
import PhotographerOnboardingScreen from "@/screens/PhotographerOnboardingScreen";
import ConsumerSignupScreen from "@/screens/ConsumerSignupScreen";
import BusinessSignupScreen from "@/screens/BusinessSignupScreen";
import PhotographerSignupScreen from "@/screens/PhotographerSignupScreen";
import OnboardingScreen, { checkOnboardingComplete } from "@/screens/OnboardingScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import AdminUserDetailScreen from "@/screens/AdminUserDetailScreen";
import AdminBusinessReviewScreen from "@/screens/AdminBusinessReviewScreen";
import AdminPhotographerDetailScreen from "@/screens/AdminPhotographerDetailScreen";
import AdminInfluencerDetailScreen from "@/screens/AdminInfluencerDetailScreen";
import AdminRefundRequestScreen from "@/screens/AdminRefundRequestScreen";
import AdminVendorPlanScreen from "@/screens/AdminVendorPlanScreen";
import AdminPushScreen from "@/screens/AdminPushScreen";
import AdminEmailsScreen from "@/screens/AdminEmailsScreen";
import AdminSetupEmailsScreen from "@/screens/AdminSetupEmailsScreen";
import AdminReferralsScreen from "@/screens/AdminReferralsScreen";
import PhotographerDashboardScreen from "@/screens/PhotographerDashboardScreen";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import BusinessBillingAddressScreen from "@/screens/BusinessBillingAddressScreen";
import StaffDashboardScreen from "@/screens/StaffDashboardScreen";
import EditStaffProfileScreen from "@/screens/EditStaffProfileScreen";
import InfluencerApplicationScreen from "@/screens/InfluencerApplicationScreen";
import InfluencerDashboardScreen from "@/screens/InfluencerDashboardScreen";
import InfluencerReferralScreen from "@/screens/InfluencerReferralScreen";
import InfluencerAnalyticsScreen from "@/screens/InfluencerAnalyticsScreen";
import InfluencerOnboardingScreen from "@/screens/InfluencerOnboardingScreen";
import ProfileCompletionGateScreen from "@/screens/ProfileCompletionGateScreen";
import StorefrontEditorScreen from "@/screens/StorefrontEditorScreen";
import PhotographerManageBusinessScreen from "@/screens/PhotographerManageBusinessScreen";
import SubscriptionPlanScreen from "@/screens/SubscriptionPlanScreen";
import StaffManagementScreen from "@/screens/StaffManagementScreen";
import ShootBookingScreen from "@/screens/ShootBookingScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import BlockedUsersScreen from "@/screens/BlockedUsersScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import QuoteScreen from "@/screens/QuoteScreen";
import RequestQuoteScreen from "@/screens/RequestQuoteScreen";
import QuoteComposeScreen from "@/screens/QuoteComposeScreen";
import BusinessRequestsScreen from "@/screens/BusinessRequestsScreen";
import BusinessQuotesScreen from "@/screens/BusinessQuotesScreen";
import QuoteLinkScreen from "@/screens/QuoteLinkScreen";
import ProfileFeedScreen from "@/screens/ProfileFeedScreen";
import SessionsScreen from "@/screens/SessionsScreen";
import AppointmentDetailScreen from "@/screens/AppointmentDetailScreen";
import CreatePostScreen from "@/screens/CreatePostScreen";
import StoryViewerScreen from "@/screens/StoryViewerScreen";
import StoryInsightsScreen from "@/screens/StoryInsightsScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import ClaimAccountScreen from "@/screens/ClaimAccountScreen";
import FinishSetupScreen from "@/screens/FinishSetupScreen";
import RateReviewScreen from "@/screens/RateReviewScreen";
import StaffOnboardingStatusScreen from "@/screens/StaffOnboardingStatusScreen";
import SupportContactScreen from "@/screens/SupportContactScreen";

import DashboardOrdersScreen from "@/screens/DashboardOrdersScreen";
import DashboardBookingsScreen from "@/screens/DashboardBookingsScreen";
import DashboardCalendarScreen from "@/screens/DashboardCalendarScreen";
import StaffCalendarScreen from "@/screens/StaffCalendarScreen";
import PhotographerCalendarScreen from "@/screens/PhotographerCalendarScreen";
import PhotographerBookingsScreen from "@/screens/PhotographerBookingsScreen";
import DashboardCreditsScreen from "@/screens/DashboardCreditsScreen";
import DashboardAnalyticsScreen from "@/screens/DashboardAnalyticsScreen";
import FollowListScreen from "@/screens/FollowListScreen";
import { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/hooks/useTheme";
import {
  aboveModalOptions,
  isAboveModal,
  profilePresentationFor,
} from "@/utils/profilePresentation";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Profiles push full screen from the right (left-edge swipe back). If a modal
// is lower on the stack, a push would land under it on iOS, so they open as a
// full screen modal on top instead. See utils/profilePresentation.ts.
const profileOptions =
  (extra: NativeStackNavigationOptions = {}) =>
  ({
    navigation,
    route,
  }: {
    navigation: { getState: () => { routes: { key: string; name: string }[] } };
    route: { key: string };
  }): NativeStackNavigationOptions => {
    const routes = navigation.getState()?.routes ?? [];
    const index = routes.findIndex((r) => r.key === route.key);
    const mode = profilePresentationFor(
      routes.map((r) => r.name),
      index,
    );
    return mode === "fullScreenModal"
      ? {
          ...extra,
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }
      : {
          ...extra,
          presentation: "card",
          animation: "slide_from_right",
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
        };
  };

export default function RootNavigator() {
  const { theme } = useTheme();
  const aboveModalByKey = useRef(new Map<string, boolean>());

  // Every non-modal route: unchanged when opened from the tabs. With a modal
  // lower on the stack, a push would land under it on iOS, so it opens as a
  // full screen modal on top, with a back arrow if it uses the native header.
  // See utils/profilePresentation.ts.
  const stackAware =
    (base: NativeStackNavigationOptions = {}) =>
    ({
      navigation,
      route,
    }: {
      navigation: {
        getState: () => { routes: { key: string; name: string }[] };
        goBack: () => void;
      };
      route: { key: string };
    }): NativeStackNavigationOptions => {
      const routes = navigation.getState()?.routes ?? [];
      const index = routes.findIndex((r) => r.key === route.key);
      // Decided once per screen: a mounted screen must never switch between
      // push and modal (react-native-screens can drop it). Chat's getId can
      // move an existing Chat to the top; it keeps how it first opened.
      let aboveModal = aboveModalByKey.current.get(route.key);
      if (aboveModal === undefined) {
        aboveModal = isAboveModal(
          routes.map((r) => r.name),
          index,
        );
        aboveModalByKey.current.set(route.key, aboveModal);
      }
      if (aboveModalByKey.current.size > 200) {
        const live = new Set(routes.map((r) => r.key));
        for (const k of aboveModalByKey.current.keys()) {
          if (!live.has(k)) aboveModalByKey.current.delete(k);
        }
      }
      return aboveModalOptions(
        base,
        aboveModal,
        () => (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        ),
      ) as NativeStackNavigationOptions;
    };

  const [initialRoute, setInitialRoute] = useState<"Onboarding" | "Main" | null>(null);

  useEffect(() => {
    checkOnboardingComplete().then((complete) => {
      setInitialRoute(complete ? "Main" : "Onboarding");
    });
  }, []);

  if (initialRoute === null) {
    return null; // Splash while checking AsyncStorage
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundRoot },
      }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="Main" component={MainTabNavigator} />

      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Sign In",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="ConsumerSignup"
        component={ConsumerSignupScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Create Account",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="BusinessSignup"
        component={BusinessSignupScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Business Signup",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="PhotographerSignup"
        component={PhotographerSignupScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Photographer Signup",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="SelectPhotographer"
        component={SelectPhotographerScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Select Photographer",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="PhotographerDetail"
        component={PhotographerDetailScreen}
        options={profileOptions()}
      />

      <Stack.Screen
        name="BookService"
        component={BookServiceScreen}
        options={({ navigation, route }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: route.params?.providerName || "Book",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close booking"
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={({ navigation, route }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          // Step 5: the photographer's name (BookingScreen sets it once loaded), with Close.
          headerTitle:
            (route.params?.photographer as { displayName?: string; name?: string } | undefined)?.displayName ||
            route.params?.photographer?.name ||
            "Book",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close booking"
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="VendorDetail"
        component={VendorDetailScreen}
        options={profileOptions()}
      />

      <Stack.Screen
        name="StaffWorkProfile"
        component={StaffWorkProfileScreen}
        options={profileOptions({ headerShown: false })}
      />

     <Stack.Screen
  name="PostDetail"
  component={PostDetailScreen}
  options={{
    presentation: "fullScreenModal",
    animation: "slide_from_bottom",
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
  }}
/>

      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="TicketDetail"
        component={TicketDetailScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="EventEditor"
        component={EventEditorScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_bottom",
          // A swipe would drop unsaved details: leave with Close or Back.
          gestureEnabled: false,
        })}
      />

      <Stack.Screen
        name="YourEvents"
        component={YourEventsScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="ManageEvent"
        component={ManageEventScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="DoorTeam"
        component={DoorTeamScreen}
        options={stackAware({ headerShown: false, animation: "slide_from_right", gestureEnabled: true })}
      />

      <Stack.Screen
        name="DoorEvents"
        component={DoorEventsScreen}
        options={stackAware({ headerShown: false, animation: "slide_from_right", gestureEnabled: true })}
      />

      <Stack.Screen
        name="DoorInvite"
        component={DoorInviteScreen}
        options={stackAware({ headerShown: false, animation: "slide_from_bottom", gestureEnabled: true })}
      />

      <Stack.Screen
        name="MyTeam"
        component={MyTeamScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="DoorScanner"
        component={DoorScannerScreen}
        options={stackAware({ headerShown: false, animation: "slide_from_bottom", gestureEnabled: false })}
      />

      <Stack.Screen
        name="FollowList"
        component={FollowListScreen}
        options={profileOptions({ headerShown: false })}
      />

      <Stack.Screen
        name="UserProfile"
        component={AccountScreen}
        options={profileOptions()}
      />

      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Session Details",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="AppointmentDetail"
        component={AppointmentDetailScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Appointment Details",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGalleryScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "fade",
          headerShown: true,
          headerTitle: "",
          headerTransparent: true,
          headerTintColor: "#FFFFFF",
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Conversation",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="RequestQuote"
        component={RequestQuoteScreen}
        options={stackAware({ headerShown: false, animation: "slide_from_right", gestureEnabled: true })}
      />

      <Stack.Screen
        name="Quote"
        component={QuoteScreen}
        options={stackAware({ headerShown: false, animation: "slide_from_right", gestureEnabled: true })}
      />

      <Stack.Screen
        name="QuoteCompose"
        component={QuoteComposeScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_bottom",
          gestureEnabled: false,
        })}
      />

      <Stack.Screen
        name="BusinessRequests"
        component={BusinessRequestsScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="BusinessQuotes"
        component={BusinessQuotesScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="QuoteLink"
        component={QuoteLinkScreen}
        options={stackAware({
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        })}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        // One screen per conversation: opening chat B (e.g. from a push) while chat A is open
        // pushes a new screen instead of swapping A's params, so A's draft/photos never go to B.
        getId={({ params }) => params?.conversationId}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Chat",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="CartOrders"
        component={CartOrdersScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Cart & Orders",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="CartCheckout"
        component={CartCheckoutScreen}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />

      <Stack.Screen
        name="CheckoutScreen"
        component={CheckoutScreen}
        options={stackAware({ headerShown: false })}
      />

      <Stack.Screen
        name="OrderSuccess"
        component={OrderSuccessScreen}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />

      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Saved",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="BusinessOnboarding"
        component={BusinessOnboardingScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Complete Profile",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="PhotographerOnboarding"
        component={PhotographerOnboardingScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Complete Profile",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Admin Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "User Details",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminBusinessReview"
        component={AdminBusinessReviewScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Review Business",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminPhotographerDetail"
        component={AdminPhotographerDetailScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Photographer",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminInfluencerDetail"
        component={AdminInfluencerDetailScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Influencer",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminRefundRequest"
        component={AdminRefundRequestScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Report",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminVendorPlan"
        component={AdminVendorPlanScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Plan",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminPush"
        component={AdminPushScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Push",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminEmails"
        component={AdminEmailsScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Emails",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminSetupEmails"
        component={AdminSetupEmailsScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Account setup",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={{ paddingHorizontal: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="AdminReferrals"
        component={AdminReferralsScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Referrals",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={16}
              style={{ paddingHorizontal: 8 }}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ),
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="PhotographerDashboard"
        component={PhotographerDashboardScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="PhotographerManageBusiness"
        component={PhotographerManageBusinessScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          // The screen draws its own header (same as StorefrontEditor).
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="BusinessDashboard"
        component={BusinessDashboardScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          // The screen draws its own header with a back arrow (2026-10-28: this
          // was true, which stacked a second header above it).
          headerShown: false,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />
      <Stack.Screen
        name="DashboardOrdersScreen"
        component={DashboardOrdersScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="BusinessBillingAddress"
        component={BusinessBillingAddressScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="DashboardBookingsScreen"
        component={DashboardBookingsScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="DashboardCalendarScreen"
        component={DashboardCalendarScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="StaffCalendarScreen"
        component={StaffCalendarScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="PhotographerCalendarScreen"
        component={PhotographerCalendarScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="PhotographerBookingsScreen"
        component={PhotographerBookingsScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="DashboardCreditsScreen"
        component={DashboardCreditsScreen}
        options={stackAware({ headerShown: false })}
      />
      <Stack.Screen
        name="DashboardAnalytics"
        component={DashboardAnalyticsScreen}
        options={stackAware({ headerShown: false })}
      />

      <Stack.Screen
        name="StaffDashboard"
        component={StaffDashboardScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="EditStaffProfile"
        component={EditStaffProfileScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="InfluencerApplication"
        component={InfluencerApplicationScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Apply as Influencer",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="InfluencerDashboard"
        component={InfluencerDashboardScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="InfluencerReferral"
        component={InfluencerReferralScreen}
        options={stackAware({
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="InfluencerAnalytics"
        component={InfluencerAnalyticsScreen}
        options={stackAware({
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="InfluencerOnboarding"
        component={InfluencerOnboardingScreen}
        options={stackAware({
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="ProfileCompletionGate"
        component={ProfileCompletionGateScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Complete Your Profile",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="StorefrontEditor"
        component={StorefrontEditorScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          // The screen draws its own header with a back arrow (2026-10-28: this
          // was true, which stacked a second header above it).
          headerShown: false,
          headerTitle: "Edit Storefront",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="SubscriptionPlan"
        component={SubscriptionPlanScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Subscription Plan",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="StaffManagement"
        component={StaffManagementScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Staff & Invites",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="ShootBooking"
        component={ShootBookingScreen}
        options={stackAware({ headerShown: false, presentation: "card", animation: "slide_from_right" })}
      />

      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Terms of Service",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Privacy Policy",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="SupportContact"
        component={SupportContactScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Blocked Users",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        })}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Notifications",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="ProfileFeed"
        component={ProfileFeedScreen}
        options={stackAware({
          presentation: "card",
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          // Full screen (not a sheet). Same presentation CartCheckout and
          // OrderSuccess already use; opened from VendorDetail and
          // the Search tab, closed by the in-screen back arrow (goBack).
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ProductOrderDetail"
        component={ProductOrderDetailScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Sessions"
        component={SessionsScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Upcoming",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerLeft: () => null,
          headerRight: () => (
            <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "fade",
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="StoryInsights"
        component={StoryInsightsScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />

      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={stackAware({ headerShown: false, presentation: "card", animation: "slide_from_right" })}
      />

      <Stack.Screen
        name="ClaimAccount"
        component={ClaimAccountScreen}
        options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />

      <Stack.Screen
        name="FinishSetup"
        component={FinishSetupScreen}
        options={stackAware({ headerShown: false, presentation: "card", animation: "slide_from_right" })}
      />

      <Stack.Screen
        name="StaffOnboarding"
        component={StaffOnboardingStatusScreen}
        options={stackAware({
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Staff Setup",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          gestureEnabled: false,
        })}
      />

      <Stack.Screen
        name="RateReview"
        component={RateReviewScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}

import React, { useState, useEffect } from "react";
import { Pressable, Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import SelectPhotographerScreen from "@/screens/SelectPhotographerScreen";
import PhotographerDetailScreen from "@/screens/PhotographerDetailScreen";
import BookingScreen from "@/screens/BookingScreen";
import SessionDetailScreen from "@/screens/SessionDetailScreen";
import PhotoGalleryScreen from "@/screens/PhotoGalleryScreen";
import ConversationScreen from "@/screens/ConversationScreen";
import ChatScreen from "@/screens/ChatScreen";
import VendorDetailScreen from "@/screens/VendorDetailScreen";
import StaffWorkProfileScreen from "@/screens/StaffWorkProfileScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import AccountScreen from "@/screens/AccountScreen";
import CartOrdersScreen from "@/screens/CartOrdersScreen";
import CartCheckoutScreen from "@/screens/CartCheckoutScreen";
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
import PhotographerDashboardScreen from "@/screens/PhotographerDashboardScreen";
import BusinessDashboardScreen from "@/screens/BusinessDashboardScreen";
import StaffDashboardScreen from "@/screens/StaffDashboardScreen";
import EditStaffProfileScreen from "@/screens/EditStaffProfileScreen";
import InfluencerApplicationScreen from "@/screens/InfluencerApplicationScreen";
import InfluencerDashboardScreen from "@/screens/InfluencerDashboardScreen";
import InfluencerOnboardingScreen from "@/screens/InfluencerOnboardingScreen";
import ProfileCompletionGateScreen from "@/screens/ProfileCompletionGateScreen";
import StorefrontEditorScreen from "@/screens/StorefrontEditorScreen";
import SubscriptionPlanScreen from "@/screens/SubscriptionPlanScreen";
import StaffManagementScreen from "@/screens/StaffManagementScreen";
import ShootBookingScreen from "@/screens/ShootBookingScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import BlockedUsersScreen from "@/screens/BlockedUsersScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import ProfileFeedScreen from "@/screens/ProfileFeedScreen";
import SessionsScreen from "@/screens/SessionsScreen";
import AppointmentDetailScreen from "@/screens/AppointmentDetailScreen";
import CreatePostScreen from "@/screens/CreatePostScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import StaffOnboardingStatusScreen from "@/screens/StaffOnboardingStatusScreen";

import DashboardOrdersScreen from "@/screens/DashboardOrdersScreen";
import DashboardBookingsScreen from "@/screens/DashboardBookingsScreen";
import DashboardCalendarScreen from "@/screens/DashboardCalendarScreen";
import DashboardCreditsScreen from "@/screens/DashboardCreditsScreen";
import { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/hooks/useTheme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { theme } = useTheme();
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
          presentation: "modal",
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
          presentation: "modal",
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
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />

      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={({ navigation }) => ({
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Book Session",
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
        name="VendorDetail"
        component={VendorDetailScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />

      <Stack.Screen
        name="StaffWorkProfile"
        component={StaffWorkProfileScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          headerShown: false,
        }}
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
        name="UserProfile"
        component={AccountScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />

      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={({ navigation }) => ({
          presentation: "modal",
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
          presentation: "modal",
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
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Conversation",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Chat",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="CartOrders"
        component={CartOrdersScreen}
        options={({ navigation }) => ({
          presentation: "modal",
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
        name="OrderSuccess"
        component={OrderSuccessScreen}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />

      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={({ navigation }) => ({
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Favorites",
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
        name="PhotographerDashboard"
        component={PhotographerDashboardScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="BusinessDashboard"
        component={BusinessDashboardScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="DashboardOrdersScreen"
        component={DashboardOrdersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DashboardBookingsScreen"
        component={DashboardBookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DashboardCalendarScreen"
        component={DashboardCalendarScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DashboardCreditsScreen"
        component={DashboardCreditsScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="StaffDashboard"
        component={StaffDashboardScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Dashboard",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="EditStaffProfile"
        component={EditStaffProfileScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="InfluencerApplication"
        component={InfluencerApplicationScreen}
        options={({ navigation }) => ({
          presentation: "modal",
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
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="InfluencerOnboarding"
        component={InfluencerOnboardingScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ProfileCompletionGate"
        component={ProfileCompletionGateScreen}
        options={({ navigation }) => ({
          presentation: "modal",
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
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Edit Storefront",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="SubscriptionPlan"
        component={SubscriptionPlanScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Subscription Plan",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="StaffManagement"
        component={StaffManagementScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Staff & Invites",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="ShootBooking"
        component={ShootBookingScreen}
        options={{ headerShown: false, presentation: "card", animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Terms of Service",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Privacy Policy",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Blocked Users",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={({ navigation }) => ({
          presentation: "modal",
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
        options={{
          presentation: "card",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          presentation: "modal",
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
          presentation: "modal",
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
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />

      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ headerShown: false, presentation: "card", animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="StaffOnboarding"
        component={StaffOnboardingStatusScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "Staff Setup",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

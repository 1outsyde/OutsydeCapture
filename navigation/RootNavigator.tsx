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
import PaymentScreen from "@/screens/PaymentScreen";
import VendorDetailScreen from "@/screens/VendorDetailScreen";
import BusinessProfileScreen from "@/screens/BusinessProfileScreen";
import PhotographerProfileScreen from "@/screens/PhotographerProfileScreen";
import CartOrdersScreen from "@/screens/CartOrdersScreen";
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
import InfluencerApplicationScreen from "@/screens/InfluencerApplicationScreen";
import InfluencerDashboardScreen from "@/screens/InfluencerDashboardScreen";
import InfluencerOnboardingScreen from "@/screens/InfluencerOnboardingScreen";
import ProfileCompletionGateScreen from "@/screens/ProfileCompletionGateScreen";
import StorefrontEditorScreen from "@/screens/StorefrontEditorScreen";
import SubscriptionPlanScreen from "@/screens/SubscriptionPlanScreen";
import ShootBookingScreen from "@/screens/ShootBookingScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import ProfileFeedScreen from "@/screens/ProfileFeedScreen";

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
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={({ navigation }) => ({
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Business Profile",
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
        name="PhotographerProfile"
        component={PhotographerProfileScreen}
        options={({ navigation }) => ({
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Photographer Profile",
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
        name="Profile"
        component={ProfileScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: false,
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
        name="Payment"
        component={PaymentScreen}
        options={({ navigation }) => ({
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Payment",
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
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "User Details",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="AdminBusinessReview"
        component={AdminBusinessReviewScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Review Business",
          headerTitleAlign: "center",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
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
    </Stack.Navigator>
  );
}

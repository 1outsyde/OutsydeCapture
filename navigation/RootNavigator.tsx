import React, { useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

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
import OnboardingScreen, { checkOnboardingComplete } from "@/screens/OnboardingScreen";

import { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/hooks/useTheme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { theme } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboardingComplete().then((complete) => {
      setShowOnboarding(!complete);
    });
  }, []);

  if (showOnboarding === null) {
    return null;
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundRoot },
      }}
    >
      <Stack.Screen name="Main" component={MainTabNavigator} />

      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="SelectPhotographer"
        component={SelectPhotographerScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="PhotographerDetail"
        component={PhotographerDetailScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="VendorDetail"
        component={VendorDetailScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="PhotographerProfile"
        component={PhotographerProfileScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGalleryScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />

      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          presentation: "card",
          animation: "slide_from_right",
          headerShown: true,
          headerTitle: "",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />

      <Stack.Screen
        name="CartOrders"
        component={CartOrdersScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: true,
          headerTitle: "Cart & Orders",
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.backgroundRoot },
        }}
      />

      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack.Navigator>
  );
}

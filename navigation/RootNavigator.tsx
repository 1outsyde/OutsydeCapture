import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import SelectPhotographerScreen from "@/screens/SelectPhotographerScreen";
import PhotographerDetailScreen from "@/screens/PhotographerDetailScreen";
import BookingScreen from "@/screens/BookingScreen";
import SessionDetailScreen from "@/screens/SessionDetailScreen";
import PhotoGalleryScreen from "@/screens/PhotoGalleryScreen";
import ConversationScreen from "@/screens/ConversationScreen";
import PaymentScreen from "@/screens/PaymentScreen";
import VendorDetailScreen from "@/screens/VendorDetailScreen";

import { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/hooks/useTheme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { theme } = useTheme();

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
        name="Payment"
        component={PaymentScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack.Navigator>
  );
}

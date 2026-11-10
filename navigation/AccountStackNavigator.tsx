import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AccountScreen from "@/screens/AccountScreen";
import ConsumerEditProfileScreen from "@/screens/ConsumerEditProfileScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import OutsydePointsScreen from "@/screens/OutsydePointsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ChangeEmailScreen from "@/screens/ChangeEmailScreen";
import AddressFormScreen from "@/components/settings/AddressFormScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { AccountStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<AccountStackParamList>();

export default function AccountStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={ConsumerEditProfileScreen}
        options={{
          title: "Edit Profile",
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={({ navigation }) => ({
          title: "Notifications",
          headerStyle: { backgroundColor: theme.brandScreen },
          // Activity redesign step 2: settings live on their own (root) screen.
          headerRight: () => (
            <Pressable
              onPress={() =>
                (navigation.navigate as (name: string) => void)(
                  "NotificationSettings",
                )
              }
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Notification settings"
            >
              <Ionicons name="settings" size={22} color={theme.text} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="OutsydePoints"
        component={OutsydePointsScreen}
        options={{
          title: "Outsyde Points",
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="ChangeEmail"
        component={ChangeEmailScreen}
        options={{
          title: "Change Email",
        }}
      />
      <Stack.Screen
        name="AddressForm"
        component={AddressFormScreen}
        options={({ route }) => ({
          title:
            route.params.mode === "shipping"
              ? "Shipping Address"
              : "Billing Address",
        })}
      />
    </Stack.Navigator>
  );
}

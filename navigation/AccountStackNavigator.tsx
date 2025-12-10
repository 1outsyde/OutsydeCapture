import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AccountScreen from "@/screens/AccountScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import OutsydePointsScreen from "@/screens/OutsydePointsScreen";
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
          title: "Account",
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: "Notifications",
        }}
      />
      <Stack.Screen
        name="OutsydePoints"
        component={OutsydePointsScreen}
        options={{
          title: "Outsyde Points",
        }}
      />
    </Stack.Navigator>
  );
}

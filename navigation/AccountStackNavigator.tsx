import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AccountScreen from "@/screens/AccountScreen";
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
    </Stack.Navigator>
  );
}

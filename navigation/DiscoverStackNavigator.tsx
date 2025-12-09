import React from "react";
import { Pressable } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import DiscoverScreen from "@/screens/DiscoverScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { DiscoverStackParamList, RootStackParamList } from "@/navigation/types";
import { Spacing } from "@/constants/theme";

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

function CartButton() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <Pressable
      onPress={() => navigation.navigate("CartOrders")}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        padding: Spacing.sm,
      })}
    >
      <Feather name="shopping-bag" size={22} color={theme.text} />
    </Pressable>
  );
}

export default function DiscoverStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <CartButton />,
        }}
      />
    </Stack.Navigator>
  );
}

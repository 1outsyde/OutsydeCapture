import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import DiscoverScreen from "@/screens/DiscoverScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { DiscoverStackParamList, RootStackParamList } from "@/navigation/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useCart } from "@/context/CartContext";

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

function UpcomingChip() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <Pressable
      onPress={() => navigation.navigate("Sessions")}
      style={({ pressed }) => [
        styles.upcomingChip,
        {
          backgroundColor: theme.brandSurface,
          borderColor: theme.brandSurfaceBorder,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather name="calendar" size={14} color={theme.brandGold} />
      {/* TODO: activity badge (red dot) once a backend "new upcoming activity" signal exists */}
    </Pressable>
  );
}

function HeaderRightButtons() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { itemCount } = useCart();

  return (
    <View style={styles.headerRightContainer}>
      <UpcomingChip />
      {/* Bell/Notifications relocated to the bottom-nav Inbox tab (Commit 3) */}
      <Pressable
        onPress={() => navigation.navigate("CartOrders")}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          padding: Spacing.sm,
        })}
      >
        <View>
          <Feather name="shopping-bag" size={22} color={theme.brandGold} />
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {itemCount > 99 ? "99+" : String(itemCount)}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
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
          title: "",
          headerBackTitle: "",
          headerLeft: () => <HeaderTitle />,
          headerTitle: () => null,
          headerRight: () => <HeaderRightButtons />,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  upcomingChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E53E3E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
});

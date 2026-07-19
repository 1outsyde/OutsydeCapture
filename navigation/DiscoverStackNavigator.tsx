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
import { useData } from "@/context/DataContext";

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

function HeaderRightButtons() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { itemCount } = useCart();
  const { getUpcomingSessions } = useData();

  const upcomingCount = getUpcomingSessions().length;
  const totalBadge = itemCount + upcomingCount;

  return (
    <Pressable
      onPress={() => navigation.navigate("CartOrders")}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        padding: Spacing.sm,
      })}
    >
      <View>
        <Feather name="shopping-bag" size={22} color={theme.brandGold} />
        {totalBadge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {totalBadge > 99 ? "99+" : String(totalBadge)}
            </Text>
          </View>
        )}
      </View>
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
  badge: {
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
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
});
import React from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import DiscoverScreen from "@/screens/DiscoverScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { DiscoverStackParamList, RootStackParamList } from "@/navigation/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

function BookSessionButton() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <Pressable
      onPress={() => navigation.navigate("SelectPhotographer")}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        padding: Spacing.sm,
      })}
    >
      <Feather name="camera" size={22} color={theme.text} />
    </Pressable>
  );
}

function HeaderRightButtons() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const isAdmin = user?.isAdmin;

  return (
    <View style={styles.headerRightContainer}>
      {isAdmin ? (
        <Pressable
          onPress={() => {
            console.log("[Header] Bell icon pressed, navigating to Notifications");
            navigation.navigate("Notifications");
          }}
          hitSlop={16}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            padding: Spacing.sm,
            position: "relative",
          })}
        >
          <Feather name="bell" size={22} color={theme.text} />
          {unreadCount > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.error },
                { pointerEvents: "none" },
              ]}
            >
              <ThemedText
                type="caption"
                style={styles.badgeText}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => navigation.navigate("CartOrders")}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          padding: Spacing.sm,
        })}
      >
        <Feather name="shopping-bag" size={22} color={theme.text} />
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
          headerTitle: () => <HeaderTitle />,
          headerLeft: () => <BookSessionButton />,
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
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: BorderRadius.round,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});

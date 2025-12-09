import React from "react";
import { StyleSheet, Pressable, View, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DiscoverStackNavigator from "@/navigation/DiscoverStackNavigator";
import SearchScreen from "@/screens/SearchScreen";
import SessionsScreen from "@/screens/SessionsScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import AccountStackNavigator from "@/navigation/AccountStackNavigator";
import VendorsScreen from "@/screens/VendorsScreen";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, Shadows } from "@/constants/theme";

// 🔥 If MessagingContext doesn't exist yet, use a placeholder until we build real chat
const useMessaging = () => ({
  getTotalUnreadCount: () => 0,
});

import { MainTabParamList, RootStackParamList } from "@/navigation/types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 83;

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { getTotalUnreadCount } = useMessaging();

  const handleBookPress = () => {
    navigation.navigate("SelectPhotographer");
  };

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="DiscoverTab"
        screenOptions={{
          tabBarActiveTintColor: theme.tabIconSelected,
          tabBarInactiveTintColor: theme.tabIconDefault,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
            }),
            borderTopWidth: 0,
            elevation: 0,
            height: TAB_BAR_HEIGHT + insets.bottom / 2,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
        }}
      >
        {/* HOME */}
        <Tab.Screen
          name="DiscoverTab"
          component={DiscoverStackNavigator}
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />

        {/* SEARCH */}
        <Tab.Screen
          name="SearchTab"
          component={SearchScreen}
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <Feather name="search" size={size} color={color} />
            ),
          }}
        />

        {/* ⭐ NEW: VENDORS */}
        <Tab.Screen
          name="VendorsTab"
          component={VendorsScreen}
          options={{
            title: "Vendors",
            tabBarIcon: ({ color, size }) => (
              <Feather name="shopping-bag" size={size} color={color} />
            ),
          }}
        />

        {/* SESSIONS / ORDERS */}
        <Tab.Screen
          name="SessionsTab"
          component={SessionsScreen}
          options={{
            title: "Upcoming",
            tabBarIcon: ({ color, size }) => (
              <Feather name="calendar" size={size} color={color} />
            ),
          }}
        />

        {/* MESSAGES */}
        <Tab.Screen
          name="MessagesTab"
          component={MessagesScreen}
          options={{
            title: "Messages",
            tabBarIcon: ({ color, size }) => (
              <Feather name="message-circle" size={size} color={color} />
            ),
            tabBarBadge: getTotalUnreadCount() > 0 ? getTotalUnreadCount() : undefined,
          }}
        />

        {/* ACCOUNT */}
        <Tab.Screen
          name="AccountTab"
          component={AccountStackNavigator}
          options={{
            title: "Account",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* FLOATING “BOOK NOW” BUTTON */}
      <View
        style={[
          styles.fabContainer,
          {
            bottom: TAB_BAR_HEIGHT + Spacing.sm + insets.bottom / 2,
          },
        ]}
      >
        <Pressable
          onPress={handleBookPress}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.accent,
              transform: [{ scale: pressed ? 0.92 : 1 }],
              opacity: pressed ? 0.9 : 1,
            },
            Shadows.fab,
          ]}
        >
          <Feather name="camera" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fabContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  fab: {
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

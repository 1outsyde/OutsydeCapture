import React, { useEffect } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";

import DiscoverStackNavigator from "@/navigation/DiscoverStackNavigator";
import SearchScreen from "@/screens/SearchScreen";
import SessionsScreen from "@/screens/SessionsScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import AccountStackNavigator from "@/navigation/AccountStackNavigator";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useMessaging } from "@/context/MessagingContext";
import { MainTabParamList } from "@/navigation/types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 83;

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { totalUnreadCount } = useMessaging();
  const { user, pendingResetParams, clearPendingResetParams, pendingStripeReturn, clearPendingStripeReturn } = useAuth();
  const navigation = useNavigation<any>();
  const isGuest = user?.isGuest || !user;

  // Handle password reset deep link for authenticated users
  useEffect(() => {
    if (pendingResetParams) {
      clearPendingResetParams();
      navigation.navigate("ResetPassword", pendingResetParams);
    }
  }, [pendingResetParams]);

  // Handle Stripe Connect return deep links (outsyde://stripe-return?status=...&type=...)
  useEffect(() => {
    if (!pendingStripeReturn) return;
    const { status, type } = pendingStripeReturn;
    clearPendingStripeReturn();

    console.log("[DeepLink] Parsed params:", { status, type });

    // Guard: require authentication before routing to dashboards
    if (!user || user.isGuest) {
      console.log("[DeepLink] Not authenticated — routing to Auth");
      navigation.navigate("Auth");
      return;
    }

    const dashboardMap: Record<string, string> = {
      photographer: "PhotographerDashboard",
      vendor: "BusinessDashboard",
      business: "BusinessDashboard",
      influencer: "InfluencerDashboard",
    };

    const targetScreen = dashboardMap[type];

    if (!targetScreen) {
      console.warn("[DeepLink] Unexpected type param:", type, "— routing to Main");
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }));
      return;
    }

    console.log("[DeepLink] Routing to:", targetScreen, "(status:", status, ")");

    // Reset stack so back-button doesn't return to Stripe browser session
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: "Main" }, { name: targetScreen }],
      })
    );
  }, [pendingStripeReturn]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
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
            tabBarBadge: totalUnreadCount > 0 ? totalUnreadCount : undefined,
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
          listeners={{
            tabPress: (e) => {
              if (isGuest) {
                e.preventDefault();
                navigation.dispatch(
                  CommonActions.navigate({ name: "Auth" })
                );
              }
            },
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

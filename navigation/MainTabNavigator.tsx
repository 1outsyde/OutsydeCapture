import React, { useEffect } from "react";
import { StyleSheet, View, Platform, Alert, Pressable } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { api } from "@/services/api";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";

import DiscoverStackNavigator from "@/navigation/DiscoverStackNavigator";
import SearchScreen from "@/screens/SearchScreen";
import InboxScreen from "@/screens/InboxScreen";
import AccountStackNavigator from "@/navigation/AccountStackNavigator";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useMessaging } from "@/context/MessagingContext";
import { useNotifications } from "@/context/NotificationContext";
import { MainTabParamList } from "@/navigation/types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_HEIGHT = 83;

function EmptyScreen() {
  return null;
}

function CreateTabButton(props: BottomTabBarButtonProps) {
  const { theme } = useTheme();
  const { onPress } = props;

  return (
    <Pressable
      onPress={onPress}
      style={styles.createButtonWrapper}
      hitSlop={8}
    >
      <View style={[styles.createButton, { backgroundColor: theme.brandPrimary }]}>
        <Feather name="plus" size={24} color={theme.brandPrimaryText} />
      </View>
    </Pressable>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { totalUnreadCount } = useMessaging();
  const { unreadCount } = useNotifications();
  console.log("[NOTIF-DEBUG] MainTabNavigator sees unreadCount =", unreadCount, "| totalUnreadCount =", totalUnreadCount);
  const combinedUnread = (unreadCount || 0) + (totalUnreadCount || 0);
  const { user, pendingResetParams, clearPendingResetParams, pendingStripeReturn, clearPendingStripeReturn, getToken } = useAuth();
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

    const targetScreen = dashboardMap[type] ?? "Main";

    if (!dashboardMap[type]) {
      console.warn("[DeepLink] Unexpected type param:", type, "— routing to Main");
    }

    const resetToTarget = () => {
      console.log("[DeepLink] Routing to:", targetScreen, "(status:", status, ")");
      if (targetScreen === "Main") {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }));
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [{ name: "Main" }, { name: targetScreen }],
          })
        );
      }
    };

    if (status === "success") {
      // Call backend to flip stripe_onboarding_complete flag
      const handleSuccess = async () => {
        try {
          const token = await getToken();
          if (token) {
            const result = await api.completeStripeConnect(token);
            console.log("[DeepLink] Completion result:", result);
          }
        } catch (err) {
          console.warn("[DeepLink] stripe/connect/complete call failed (non-critical):", err);
        }
        resetToTarget();
        Alert.alert(
          "Stripe Setup Complete",
          "Your Stripe account is ready! You can now accept bookings.",
          [{ text: "Got it" }]
        );
      };
      handleSuccess();
    } else if (status === "refresh") {
      // Stripe link expired — route to dashboard so user can retry from the Stripe CTA
      console.log("[DeepLink] Stripe link expired — routing to dashboard to retry");
      resetToTarget();
      Alert.alert(
        "Stripe Setup Incomplete",
        "Your Stripe onboarding link expired. Tap 'Complete Stripe Setup' on your dashboard to get a fresh link.",
        [{ text: "OK" }]
      );
    } else if (status === "cancel") {
      // User cancelled — their account still exists, just payout setup is pending
      console.log("[DeepLink] Stripe setup cancelled — routing to dashboard");
      resetToTarget();
      Alert.alert(
        "Stripe Setup Skipped",
        "You can complete Stripe setup later from your dashboard. Your account has been created.",
        [{ text: "OK" }]
      );
    } else {
      // Unexpected status — route to dashboard silently
      console.warn("[DeepLink] Unexpected status param:", status);
      resetToTarget();
    }
  }, [pendingStripeReturn]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Tab.Navigator
        initialRouteName="DiscoverTab"
        screenOptions={{
          tabBarActiveTintColor: theme.brandGold,
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

        {/* CREATE (+) */}
        <Tab.Screen
          name="CreateTab"
          component={EmptyScreen}
          options={{
            title: "",
            tabBarButton: (props) => <CreateTabButton {...props} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate("CreatePost");
            },
          }}
        />

        {/* INBOX */}
        <Tab.Screen
          name="InboxTab"
          component={InboxScreen}
          options={{
            title: "Inbox",
            tabBarIcon: ({ color, size }) => (
              <Feather name="message-circle" size={size} color={color} />
            ),
            tabBarBadge: combinedUnread > 0 ? combinedUnread : undefined,
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
  createButtonWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

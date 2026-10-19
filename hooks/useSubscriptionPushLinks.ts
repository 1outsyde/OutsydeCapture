// useSubscriptionPushLinks: a tapped subscription push (backend subscriptions/notices.ts sends
// data { type: "subscription_<event>", screen: "subscription" }: payment late, confirm payment,
// listings pause soon, paused, plan ended, back live) opens the plan screen for the business owner.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to useBookingPushLinks. Waits for the stored sign-in.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { isSubscriptionPush } from "@/utils/subscriptionState";

export function useSubscriptionPushLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (
        !isSubscriptionPush(
          response.notification?.request?.content?.data as any,
        )
      )
        return;
      const key = response.notification.request.identifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      setPending(true);
    };
    Notifications.getLastNotificationResponseAsync()
      .then(onPush)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(onPush);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pending || isLoading) return;
    setPending(false);
    if (!user || user.isGuest) {
      navigation.navigate("Auth", {});
      return;
    }
    if (user.role === "business") navigation.navigate("SubscriptionPlan");
  }, [pending, isLoading, user, navigation]);
}

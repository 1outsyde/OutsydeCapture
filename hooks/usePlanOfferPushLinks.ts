// usePlanOfferPushLinks: a tapped plan offer push (backend planOffers.ts sends
// data { type: "plan_offer", offerId, screen: "plan_offer" }) opens the offer popup on the main tabs.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to useSubscriptionPushLinks. Waits for the stored sign in.
// The type never starts with "subscription_", so useSubscriptionPushLinks ignores it (and this hook
// ignores every other type).

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { isPlanOfferPush } from "@/utils/planOffer";
import { openPlanOffer } from "@/utils/planOfferNav";

export function usePlanOfferPushLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (
        !isPlanOfferPush(response.notification?.request?.content?.data as any)
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
    openPlanOffer(navigation, user);
  }, [pending, isLoading, user, navigation]);
}

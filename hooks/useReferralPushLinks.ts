// useReferralPushLinks: a tapped friend referral reward push (backend loyaltyLedger.ts sends
// data { type: "referral_reward", referenceId }) opens the Points screen. So does a business referral
// push (type "business_referral_reward"), where the $25 card shows the payout.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to usePlanOfferPushLinks. Waits for the stored sign in.
// Ignores every other type, and the other push hooks ignore this one.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import {
  isReferralRewardPush,
  openPointsFromReward,
} from "@/utils/friendReferral";

export function useReferralPushLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (
        !isReferralRewardPush(
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
    openPointsFromReward(navigation, user);
  }, [pending, isLoading, user, navigation]);
}

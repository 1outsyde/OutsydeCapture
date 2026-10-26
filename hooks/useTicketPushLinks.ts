// useTicketPushLinks: a tapped address reveal push (backend server/events/addressReveal.ts, data
// { type: "address_reveal", eventId }) opens the Tickets tab of Cart & activity, where the address now shows.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to the other push link hooks. Ignores every other type, and the
// other push hooks ignore this one. Waits for the stored sign-in.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { ticketPushTarget } from "@/utils/ticketCheckoutLogic";

export function useTicketPushLinks() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (!ticketPushTarget(response.notification?.request?.content?.data as any)) return;
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
    if (!user || (user as { isGuest?: boolean }).isGuest) {
      navigation.navigate("Auth", {});
      return;
    }
    navigation.navigate("CartOrders", { openTab: "tickets", _ts: Date.now() });
  }, [pending, isLoading, user, navigation]);
}

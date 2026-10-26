// useTicketPushLinks: a tapped ticket push opens the right screen (utils/ticketCheckoutLogic.ts ticketPushTarget):
//  - address reveal (backend server/events/addressReveal.ts) → the Tickets tab of Cart & activity, where the address now shows;
//  - guest event reminder, the day before or 2 hours before (backend server/events/eventReminders.ts) → that event's ticket;
//  - host event reminder, the day before → the host's manage screen for that event.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to the other push link hooks. Ignores every other type, and the
// other push hooks ignore these. Waits for the stored sign-in; signed out goes to sign in first.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { ticketPushTarget, type TicketPushTarget } from "@/utils/ticketCheckoutLogic";

export function useTicketPushLinks() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState<TicketPushTarget | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const target = ticketPushTarget(response.notification?.request?.content?.data as any);
      if (!target) return;
      const key = response.notification.request.identifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      setPending(target);
    };
    Notifications.getLastNotificationResponseAsync()
      .then(onPush)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(onPush);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pending || isLoading) return;
    const target = pending;
    setPending(null);
    if (!user || (user as { isGuest?: boolean }).isGuest) {
      navigation.navigate("Auth", {});
      return;
    }
    if (target.screen === "ticket" && target.eventId) {
      navigation.navigate("TicketDetail", { eventId: target.eventId });
      return;
    }
    if (target.screen === "manage" && target.eventId) {
      navigation.navigate("ManageEvent", { eventId: target.eventId });
      return;
    }
    navigation.navigate("CartOrders", { openTab: "tickets", _ts: Date.now() });
  }, [pending, isLoading, user, navigation]);
}

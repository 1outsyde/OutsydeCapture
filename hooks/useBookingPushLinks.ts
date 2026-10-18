// useBookingPushLinks: a tapped booking request push (data.type booking_request, booking_request_sent,
// booking_request_reminder or booking_expired, backend manualRequests.ts) opens the bookings list.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to useMessagePushLinks. Waits for the stored sign-in.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import {
  bookingPushTarget,
  openBookingPushTarget,
  type BookingPushTarget,
} from "@/services/bookingPush";

export function useBookingPushLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState<BookingPushTarget | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const target = bookingPushTarget(
        response.notification?.request?.content?.data as any,
      );
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
    openBookingPushTarget(navigation, user, target);
  }, [pending, isLoading, user, navigation]);
}

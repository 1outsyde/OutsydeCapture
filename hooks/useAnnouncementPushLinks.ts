// useAnnouncementPushLinks: a tapped admin announcement push (backend server/push/pushBroadcasts.ts sends
// data { type: "announcement", sendId, screen, url? }) opens the screen Legend picked on goutsyde.com,
// or Activity when this account can't open it (utils/announcementPush.ts).
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to useReferralPushLinks. Waits for the stored sign in.
// Ignores every other type, and the other push hooks ignore this one.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { isAnnouncementPush } from "@/utils/announcementPush";
import { openAnnouncement } from "@/services/announcementPush";

type Pending = { screen?: unknown; url?: unknown };

export function useAnnouncementPushLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState<Pending | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification?.request?.content?.data as
        | { type?: unknown; screen?: unknown; url?: unknown }
        | undefined;
      if (!isAnnouncementPush(data)) return;
      const key = response.notification.request.identifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      setPending({ screen: data?.screen, url: data?.url });
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
    // Clears the one tap just handled (set by the push listener above), so it runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(null);
    openAnnouncement(navigation, user, target);
  }, [pending, isLoading, user, navigation]);
}

// useMessagePushLinks — a tapped message push (data.type "new_message", backend #321) opens that chat.
// Works when the app was in the background (listener) and when the tap launched it (last response).
// Mounted once in MainTabNavigator next to useAccountSetupLinks. Waits for the stored sign-in.

import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { messagePushConversationId } from "@/services/messagePush";

export function useMessagePushLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = messagePushConversationId(
        response.notification?.request?.content?.data as any,
      );
      if (!id) return;
      const key = response.notification.request.identifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      // So a later remount (e.g. after signing in again) doesn't reopen this chat.
      try {
        Notifications.clearLastNotificationResponse();
      } catch {}
      setPending(id);
    };
    Notifications.getLastNotificationResponseAsync()
      .then(onPush)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(onPush);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pending || isLoading) return;
    const conversationId = pending;
    setPending(null);
    if (!user || user.isGuest) {
      navigation.navigate("Auth", {});
      return;
    }
    navigation.navigate("Chat", { conversationId });
  }, [pending, isLoading, user, navigation]);
}

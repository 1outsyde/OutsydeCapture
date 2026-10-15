// useAccountSetupLinks — opens the account-setup screens from outside the app:
//   • goutsyde.com/claim?token&email links (reminder emails, iOS universal links) → ClaimAccount
//   • goutsyde.com/finish links → FinishSetup (signed in) or Auth (signed out)
//   • a reminder push tapped (data.type "account_setup", sent by backend reminders.ts) → same as /finish
// Mounted once in MainTabNavigator. Links that arrive before the stored sign-in has loaded wait for it,
// so a signed-in person is never sent to the login screen by mistake.

import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import {
  parseAccountSetupLink,
  type AccountSetupLink,
} from "@/utils/accountSetup";

function isAccountSetupPush(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  const data = response?.notification?.request?.content?.data as
    | { type?: unknown }
    | undefined;
  return data?.type === "account_setup";
}

export function useAccountSetupLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoading } = useAuth();
  const [pending, setPending] = useState<AccountSetupLink | null>(null);
  const handledPushIds = useRef(new Set<string>());

  // Collect links and push taps.
  useEffect(() => {
    const onUrl = (url: string | null) => {
      if (!url) return;
      const link = parseAccountSetupLink(url);
      if (link) setPending(link);
    };
    const onPush = (response: Notifications.NotificationResponse | null) => {
      if (!response || !isAccountSetupPush(response)) return;
      const id = response.notification.request.identifier;
      if (handledPushIds.current.has(id)) return;
      handledPushIds.current.add(id);
      setPending({ kind: "finish" });
    };

    Linking.getInitialURL()
      .then(onUrl)
      .catch(() => {});
    const linkSub = Linking.addEventListener("url", ({ url }) => onUrl(url));
    Notifications.getLastNotificationResponseAsync()
      .then(onPush)
      .catch(() => {});
    const pushSub =
      Notifications.addNotificationResponseReceivedListener(onPush);
    return () => {
      linkSub.remove();
      pushSub.remove();
    };
  }, []);

  // Act once the stored sign-in has loaded.
  useEffect(() => {
    if (!pending || isLoading) return;
    const link = pending;
    setPending(null);
    const signedIn = !!user && !user.isGuest;
    if (link.kind === "claim") {
      navigation.navigate("ClaimAccount", {
        email: link.email,
        token: link.token,
      });
    } else if (signedIn) {
      navigation.navigate("FinishSetup");
    } else {
      navigation.navigate("Auth", {});
    }
  }, [pending, isLoading, user, navigation]);
}

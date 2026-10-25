// Opens what a tapped admin announcement points at (utils/announcementPush.ts decides where).
// Used by hooks/useAnnouncementPushLinks.ts (push taps) and NotificationsScreen (Activity rows).

import * as WebBrowser from "expo-web-browser";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import { announcementTarget } from "@/utils/announcementPush";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MinimalUser =
  | { role?: string | null; isGuest?: boolean | null }
  | null
  | undefined;

export function openAnnouncement(
  navigation: Nav,
  user: MinimalUser,
  data: { screen?: unknown; url?: unknown } | null | undefined,
): void {
  const t = announcementTarget(data, user);
  if (t.kind === "auth") {
    navigation.navigate("Auth", {});
    return;
  }
  if (t.kind === "browser") {
    WebBrowser.openBrowserAsync(t.url).catch(() =>
      navigation.navigate("Notifications"),
    );
    return;
  }
  // The name and params come from the checked map in utils/announcementPush.ts.
  (
    navigation.navigate as (
      name: string,
      params?: object,
      options?: { pop?: boolean },
    ) => void
  )(t.name, t.params, t.pop ? { pop: true } : undefined);
}

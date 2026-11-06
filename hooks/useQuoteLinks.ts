// useQuoteLinks: goutsyde.com/q/<code> links (quote emails and texts, iOS universal links, Android app links) open
// the quote link screen (Quotes step 6b). Mounted once in MainTabNavigator, next to useAccountSetupLinks. Links that
// arrive before the stored sign-in has loaded wait for it (the screen itself waits too).
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { parseQuoteLink } from "@/utils/quoteLinks";

export function useQuoteLinks() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isLoading } = useAuth();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onUrl = (url: string | null | undefined) => {
      const code = parseQuoteLink(url);
      if (code) setPending(code);
    };
    Linking.getInitialURL()
      .then(onUrl)
      .catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => onUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pending || isLoading) return;
    const code = pending;
    // Next tick: navigation from an effect, after this render.
    const t = setTimeout(() => {
      setPending(null);
      navigation.navigate("QuoteLink", { code });
    }, 0);
    return () => clearTimeout(t);
  }, [pending, isLoading, navigation]);
}

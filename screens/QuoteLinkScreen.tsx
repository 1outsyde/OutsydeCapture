// A goutsyde.com/q/<code> link opened in the app (Quotes step 6b, calls 2 and 3). Signed in: straight to the quote
// screen (customer, business or admin). Signed out: the preview (business, title, date, total) with Sign in, and it
// opens the quote after sign in (Auth goes back here and this screen reads the link again). Another account or a bad
// link: a message, plus View on the web in the in-app browser (never back into the app). Copy: commas and periods only.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  Centered,
  ErrorText,
  Hint,
  HostHeader,
  OutlineButton,
  PrimaryButton,
} from "@/components/host/hostUi";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError } from "@/services/api";
import { money, whenLine } from "@/utils/quoteLogic";
import {
  QUOTE_LINK_COPY,
  quoteLinkOutcome,
  quoteWebUrl,
  type QuoteLinkOutcome,
} from "@/utils/quoteLinks";
import OutsydeLoader from "@/components/OutsydeLoader";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function QuoteLinkScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { code } =
    useRoute<RouteProp<RootStackParamList, "QuoteLink">>().params;
  const { user, isLoading, getToken } = useAuth();
  const [outcome, setOutcome] = useState<QuoteLinkOutcome | null>(null);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);
  const signedIn = !!user && !user.isGuest;

  const load = useCallback(async () => {
    setOutcome(null);
    let token: string | null = null;
    try {
      token = signedIn ? await tokenRef.current() : null;
    } catch {
      token = null;
    }
    let result: QuoteLinkOutcome;
    try {
      const body = await api.getQuoteLink(code, token ?? undefined);
      result = quoteLinkOutcome({ status: 200, body });
    } catch (err) {
      const e = err as ApiError;
      result = quoteLinkOutcome({
        status: e?.status ?? 0,
        body: e?.body ?? null,
      });
    }
    if (result.kind === "open") {
      navigation.replace("Quote", { quoteId: result.quoteId });
      return;
    }
    setOutcome(result);
  }, [code, signedIn, navigation]);

  // Read the link once the stored sign-in has loaded, and again when coming back from Sign in.
  useFocusEffect(
    useCallback(() => {
      if (isLoading) return;
      load();
    }, [isLoading, load]),
  );

  const openWeb = () => {
    WebBrowser.openBrowserAsync(quoteWebUrl(code)).catch(() => {});
  };
  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };

  if (!outcome) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <HostHeader title="Quote" left={back} />
        <Centered>
          <OutsydeLoader />
        </Centered>
      </ThemedView>
    );
  }

  const p = outcome.kind === "preview" ? (outcome.preview as any) : null;
  const biz = p?.business ?? null;

  return (
    <ThemedView style={{ flex: 1 }}>
      <HostHeader title="Quote" sub={biz?.name ?? undefined} left={back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {p ? (
          <>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.brandBgElevated,
                  borderColor: theme.brandSurfaceBorder,
                },
              ]}
            >
              {biz?.logoImage ? (
                <Image
                  source={{ uri: biz.logoImage }}
                  style={styles.logo}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {biz?.name ? (
                <ThemedText style={[styles.biz, { color: theme.brandGold }]}>
                  {biz.name}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.title, { color: theme.brandCream }]}>
                {p.title}
              </ThemedText>
              <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
                {whenLine({
                  kind: p.kind,
                  jobDate: p.jobDate ?? null,
                  startTime: p.startTime ?? null,
                  durationMinutes: p.durationMinutes ?? null,
                  dueDate: p.dueDate ?? null,
                })}
              </ThemedText>
              {typeof p.totalCents === "number" ? (
                <ThemedText
                  style={[styles.amount, { color: theme.brandCream }]}
                >
                  {money(p.totalCents)}
                </ThemedText>
              ) : null}
            </View>
            <Hint>{QUOTE_LINK_COPY.signIn}</Hint>
            <PrimaryButton
              label="Sign in"
              onPress={() => navigation.navigate("Auth", {})}
            />
            <OutlineButton label="View on the web" onPress={openWeb} />
          </>
        ) : (
          <>
            <ErrorText>
              {outcome.kind === "other-account"
                ? QUOTE_LINK_COPY.otherAccount
                : outcome.kind === "not-found"
                  ? QUOTE_LINK_COPY.notFound
                  : QUOTE_LINK_COPY.error}
            </ErrorText>
            {outcome.kind === "error" ? (
              <PrimaryButton label="Try again" onPress={load} />
            ) : null}
            {outcome.kind !== "not-found" ? (
              <OutlineButton label="View on the web" onPress={openWeb} />
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  logo: { width: 48, height: 48, borderRadius: 12 },
  biz: { fontSize: 13, fontWeight: "800" },
  title: { fontSize: 18, fontWeight: "700" },
  dim: { fontSize: 13, lineHeight: 19 },
  amount: { fontSize: 16, fontWeight: "700" },
});

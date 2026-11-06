// Quotes tab in Cart & activity (Quotes step 6c-2b, call 6): the customer's quotes and requests, newest first, with
// Needs you from the pop-up's list. A quote opens the quote screen; a request opens its chat with the business.
// refreshKey changes on pull to refresh.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { BorderRadius, Spacing } from "@/constants/theme";
import { quotesTabRows, type TabRow } from "@/utils/requestLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyQuotesList({ refreshKey }: { refreshKey: number }) {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { getToken, isAuthenticated, user } = useAuth();
  const signedIn = isAuthenticated && !user?.isGuest;
  const [rows, setRows] = useState<TabRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!signedIn) return;
    const mine = ++seq.current;
    try {
      const token = await getToken();
      if (!token) {
        if (mine === seq.current) setFailed(true);
        return;
      }
      const [quotes, requests, actions] = await Promise.all([
        api.getMyQuotes(token),
        api.getMyRequests(token),
        api.getQuoteActions(token).catch(() => []),
      ]);
      if (mine !== seq.current) return;
      setRows(quotesTabRows(quotes as any, requests, actions));
      setFailed(false);
    } catch {
      if (mine === seq.current) setFailed(true);
    }
  }, [signedIn, getToken]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(load, 0);
      return () => clearTimeout(t);
    }, [load]),
  );
  useEffect(() => {
    if (refreshKey > 0) {
      const t = setTimeout(load, 0);
      return () => clearTimeout(t);
    }
  }, [refreshKey, load]);

  const dim = { color: theme.brandTextDim };
  if (!signedIn)
    return (
      <ThemedText style={[styles.empty, dim]}>
        Sign in to see your quotes and requests.
      </ThemedText>
    );
  if (failed && !rows)
    return (
      <ThemedText style={[styles.empty, dim]}>
        {"We couldn't load your quotes. Pull down to try again."}
      </ThemedText>
    );
  if (!rows)
    return (
      <ActivityIndicator
        color={theme.brandGold}
        style={{ marginTop: Spacing.xl }}
      />
    );
  if (!rows.length) {
    return (
      <ThemedText style={[styles.empty, dim]}>
        No quotes yet. When a business sends you one, or you ask for a quote, it
        shows here.
      </ThemedText>
    );
  }
  return (
    <View style={{ gap: Spacing.sm }}>
      {rows.map((r) => (
        <Pressable
          key={r.key}
          onPress={() => {
            if (r.kind === "quote")
              navigation.navigate("Quote", { quoteId: r.id });
            else if (r.conversationId)
              navigation.navigate("Chat", { conversationId: r.conversationId });
          }}
          disabled={r.kind === "request" && !r.conversationId}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}, ${r.chip}`}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.brandSurface,
              borderColor: theme.brandSurfaceBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.top}>
            <ThemedText
              style={[styles.title, { color: theme.brandCream }]}
              numberOfLines={1}
            >
              {r.title}
            </ThemedText>
            <ThemedText
              style={[
                styles.chip,
                {
                  color: r.needsYou ? "#0B0B0B" : theme.brandGold,
                  backgroundColor: r.needsYou ? theme.brandGold : "transparent",
                  borderColor: theme.brandGold,
                },
              ]}
            >
              {r.chip}
            </ThemedText>
          </View>
          {r.sub ? (
            <ThemedText style={[styles.sub, dim]} numberOfLines={1}>
              {r.sub}
            </ThemedText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    textAlign: "center",
    marginTop: Spacing.xl,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  row: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  title: { fontSize: 15, fontWeight: "700", flex: 1 },
  chip: {
    fontSize: 11,
    fontWeight: "800",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  sub: { fontSize: 13 },
});

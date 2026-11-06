// The Quotes list (Quotes step 6d-2b, calls 4 and 5). Owners: every quote of the business (GET /api/vendor/quotes).
// Staff: only the quotes they sent (GET /api/staff/quotes, backend #418). Open and All, newest first, chips from the
// quote status and the booking status. Tap a quote to open the quote screen with the 6d-1 business buttons.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  Centered,
  Chip,
  ErrorText,
  Hint,
  HostHeader,
} from "@/components/host/hostUi";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError, type QuoteWire } from "@/services/api";
import { errorMessage } from "@/utils/quoteLogic";
import {
  quoteIsOpen,
  quoteListChip,
  quoteListLine,
} from "@/utils/businessQuotesLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BusinessQuotesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { mode, businessId } =
    useRoute<RouteProp<RootStackParamList, "BusinessQuotes">>().params;
  const { getToken } = useAuth();
  const [rows, setRows] = useState<QuoteWire[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"open" | "all">("open");
  const [refreshing, setRefreshing] = useState(false);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const load = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      if (!token) {
        setError("Sign in again to see your quotes.");
        return;
      }
      setRows(
        mode === "staff"
          ? await api.getStaffQuotes(token, businessId)
          : await api.getVendorQuotes(token),
      );
      setError("");
    } catch (err) {
      setError(errorMessage(err as ApiError));
    }
  }, [mode, businessId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = useMemo(
    () => (rows ?? []).filter((q) => tab === "all" || quoteIsOpen(q)),
    [rows, tab],
  );
  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <HostHeader
        title={mode === "staff" ? "My quotes" : "Quotes"}
        left={back}
      />
      {rows === null && !error ? (
        <Centered>
          <ActivityIndicator color={theme.brandGold} />
        </Centered>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.brandGold}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: Spacing.sm }}>
              <View style={styles.tabs}>
                <Chip
                  label="Open"
                  on={tab === "open"}
                  onPress={() => setTab("open")}
                />
                <Chip
                  label="All"
                  on={tab === "all"}
                  onPress={() => setTab("all")}
                />
              </View>
              {error ? <ErrorText>{error}</ErrorText> : null}
            </View>
          }
          ListEmptyComponent={
            rows ? (
              <Hint>
                {tab === "open"
                  ? "No open quotes. Send one from a chat with the + button."
                  : "No quotes yet. Send one from a chat with the + button."}
              </Hint>
            ) : undefined
          }
          renderItem={({ item: q }) => (
            <Pressable
              onPress={() => navigation.navigate("Quote", { quoteId: q.id })}
              accessibilityRole="button"
              accessibilityLabel={`${q.title}, ${quoteListChip(q)}, ${quoteListLine(q)}`}
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: theme.brandSurfaceBorder,
                  backgroundColor: theme.brandBgElevated,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText
                  style={[styles.title, { color: theme.brandCream }]}
                  numberOfLines={2}
                >
                  {q.title}
                </ThemedText>
                <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
                  {quoteListLine(q)}
                </ThemedText>
              </View>
              <ThemedText
                style={[
                  styles.pill,
                  { color: theme.brandGold, borderColor: theme.brandGold },
                ]}
              >
                {quoteListChip(q)}
              </ThemedText>
              <Feather
                name="chevron-right"
                size={18}
                color={theme.brandTextDim}
              />
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing["3xl"] },
  tabs: { flexDirection: "row", gap: Spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md - 2,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 56,
  },
  title: { fontSize: 16, fontWeight: "700" },
  dim: { fontSize: 13, lineHeight: 18 },
  pill: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
});

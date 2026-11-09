// The owner's Requests list (Quotes step 6d-2b, call 3). Open and All, newest first. Each request: Send a quote
// (prefilled, as from the chat's request card), Open chat, and Close request. Quoted and booked are set by the backend.
// Owner only (GET /api/vendor/estimate-requests). Copy: commas and periods only.
// Request forms F2b: side photographer = the photographer's own requests (GET /api/photographers/me/requests), with
// no Send a quote (photographer quotes are a later project); every row opens the Request screen with its answers.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  Centered,
  Chip,
  ErrorText,
  Hint,
  HostHeader,
  OutlineButton,
  PrimaryButton,
  TextButton,
} from "@/components/host/hostUi";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError, type VendorRequest } from "@/services/api";
import { errorMessage } from "@/utils/quoteLogic";
import {
  requestChip,
  requestIsOpen,
  requestLine,
} from "@/utils/businessQuotesLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BusinessRequestsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const side =
    useRoute<RouteProp<RootStackParamList, "BusinessRequests">>().params
      ?.side ?? "business";
  const { getToken } = useAuth();
  const [rows, setRows] = useState<VendorRequest[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"open" | "all">("open");
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const load = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      if (!token) {
        setError("Sign in again to see your requests.");
        return;
      }
      setRows(
        side === "photographer"
          ? await api.getPhotographerRequests(token)
          : await api.getVendorRequests(token),
      );
      setError("");
    } catch (err) {
      setError(errorMessage(err as ApiError));
    }
  }, [side]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = useMemo(
    () => (rows ?? []).filter((r) => tab === "all" || requestIsOpen(r.status)),
    [rows, tab],
  );

  const close = (r: VendorRequest) =>
    Alert.alert(
      "Close this request?",
      "It moves to All. The customer isn't told.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Close request",
          style: "destructive",
          onPress: async () => {
            if (closing) return;
            setClosing(r.id);
            try {
              const token = await tokenRef.current();
              if (!token) return;
              const updated = await api.closeVendorRequest(token, r.id, side);
              setRows((all) =>
                (all ?? []).map((x) =>
                  x.id === r.id ? { ...x, ...updated } : x,
                ),
              );
            } catch (err) {
              setError(errorMessage(err as ApiError));
            } finally {
              setClosing(null);
            }
          },
        },
      ],
    );

  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <HostHeader title="Requests" left={back} />
      {rows === null && !error ? (
        <Centered>
          <ActivityIndicator color={theme.brandGold} />
        </Centered>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
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
                  ? "No open requests. When a customer sends a request form, it shows up here and in your chat."
                  : "No requests yet. Customers send a request form from a contact for pricing service."}
              </Hint>
            ) : undefined
          }
          renderItem={({ item: r }) => {
            const answers = Array.isArray(r.answers) ? r.answers.length : 0;
            const open = requestIsOpen(r.status);
            return (
              <View
                style={[
                  styles.card,
                  {
                    borderColor: theme.brandSurfaceBorder,
                    backgroundColor: theme.brandBgElevated,
                  },
                ]}
              >
                <View style={styles.top}>
                  <ThemedText
                    style={[styles.title, { color: theme.brandCream }]}
                    numberOfLines={2}
                  >
                    {r.serviceName || "Request"}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.pill,
                      { color: theme.brandGold, borderColor: theme.brandGold },
                    ]}
                  >
                    {requestChip(r.status)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
                  {requestLine(r)}
                </ThemedText>
                {/* F2b (call 11): the request with every answer, the photos and the phone. */}
                <TextButton
                  gold
                  label={
                    answers
                      ? `View ${answers} ${answers === 1 ? "answer" : "answers"}`
                      : "View request"
                  }
                  onPress={() =>
                    navigation.navigate("RequestDetail", { requestId: r.id })
                  }
                />
                {r.conversationId ? (
                  <View style={styles.pair}>
                    {open && side === "business" ? (
                      <PrimaryButton
                        style={{ flex: 1 }}
                        label="Send a quote"
                        onPress={() =>
                          navigation.navigate("QuoteCompose", {
                            conversationId: r.conversationId!,
                            requestId: r.id,
                            serviceId: r.serviceId ?? undefined,
                            serviceName: r.serviceName ?? undefined,
                            preferredDate: r.preferredDate ?? undefined,
                          })
                        }
                      />
                    ) : null}
                    <OutlineButton
                      style={{ flex: 1 }}
                      label="Open chat"
                      onPress={() =>
                        navigation.navigate("Chat", {
                          conversationId: r.conversationId!,
                        })
                      }
                    />
                  </View>
                ) : (
                  <Hint>
                    {"This request has no chat, so it can't be answered here."}
                  </Hint>
                )}
                {open ? (
                  <TextButton
                    label={closing === r.id ? "Closing" : "Close request"}
                    disabled={!!closing}
                    onPress={() => close(r)}
                  />
                ) : null}
              </View>
            );
          }}
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
    gap: 6,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  title: { fontSize: 16, fontWeight: "700", flex: 1 },
  dim: { fontSize: 13, lineHeight: 18 },
  pair: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
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

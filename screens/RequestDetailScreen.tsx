// One request with every answer (Request forms F2b, call 11, Legend 2026-11-09). For the business owner or the
// photographer it was sent to: GET /api/requests/:id answers them with the phone and every answer (anyone else 404).
// Opened from the Requests list and from the request card in the chat. Open chat, Call, Close. Copy: commas and
// periods only, never the fee rate.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
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
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import PhotoViewer from "@/components/messaging/PhotoViewer";
import {
  Centered,
  ErrorText,
  HostHeader,
  OutlineButton,
  PrimaryButton,
  TextButton,
} from "@/components/host/hostUi";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError, type RequestDetail } from "@/services/api";
import { errorMessage } from "@/utils/quoteLogic";
import {
  phoneLink,
  requestAnswerRows,
  requestChip,
  requestIsOpen,
  requestLine,
} from "@/utils/businessQuotesLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RequestDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { requestId } =
    useRoute<RouteProp<RootStackParamList, "RequestDetail">>().params;
  const { getToken } = useAuth();
  const [r, setR] = useState<RequestDetail | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [viewer, setViewer] = useState<{
    urls: string[];
    index: number;
  } | null>(null);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const load = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      if (!token) {
        setError("Sign in again to see this request.");
        return;
      }
      setR(await api.getRequestDetail(token, requestId));
      setError("");
    } catch (err) {
      const e = err as ApiError;
      setError(
        e?.status === 404
          ? "This request isn't available. Only the business or photographer it was sent to can open it."
          : errorMessage(e),
      );
    }
  }, [requestId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };

  if (!r) {
    return (
      <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
        <HostHeader title="Request" left={back} />
        <Centered>
          {error ? (
            <ErrorText>{error}</ErrorText>
          ) : (
            <ActivityIndicator color={theme.brandGold} />
          )}
        </Centered>
      </ThemedView>
    );
  }

  const rows = requestAnswerRows(r.answers);
  const open = requestIsOpen(r.status);
  const tel = phoneLink(r.customerPhone);
  const side = r.photographerId ? "photographer" : "business";
  const close = () =>
    Alert.alert(
      "Close this request?",
      "It moves to All in your Requests. The customer isn't told.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Close request",
          style: "destructive",
          onPress: async () => {
            if (closing) return;
            setClosing(true);
            try {
              const token = await tokenRef.current();
              if (!token) return;
              const updated = await api.closeVendorRequest(token, r.id, side);
              setR((cur) => (cur ? { ...cur, status: updated.status } : cur));
            } catch (err) {
              setError(errorMessage(err as ApiError));
            } finally {
              setClosing(false);
            }
          },
        },
      ],
    );

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
      <HostHeader
        title="Request"
        sub={(r.customerName ?? "").trim() || undefined}
        left={back}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: theme.brandPrimary }]}>
          <ThemedText
            style={[
              styles.pill,
              { color: theme.brandGold, borderColor: theme.brandGold },
            ]}
          >
            {requestChip(r.status)}
          </ThemedText>
          <ThemedText
            style={[styles.title, { color: theme.brandPrimaryText }]}
            accessibilityRole="header"
          >
            {r.serviceName || "Request"}
          </ThemedText>
          <ThemedText style={{ color: theme.brandPrimaryText, fontSize: 14 }}>
            {requestLine(r)}
          </ThemedText>
        </View>

        <QuoteCard title="Their answers">
          {rows.length === 0 ? (
            <ThemedText style={{ color: theme.brandTextDim, fontSize: 14 }}>
              No questions were asked, only their contact details.
            </ThemedText>
          ) : (
            rows.map((a, i) => (
              <View key={`${i}-${a.label}`} style={styles.answer}>
                <ThemedText style={[styles.q, { color: theme.brandTextDim }]}>
                  {a.label}
                </ThemedText>
                {a.kind === "text" ? (
                  <ThemedText
                    style={[styles.a, { color: theme.brandCream }]}
                    selectable
                  >
                    {a.text}
                  </ThemedText>
                ) : (
                  <View style={styles.photos}>
                    {a.urls.map((u, j) => (
                      <Pressable
                        key={u}
                        onPress={() => setViewer({ urls: a.urls, index: j })}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`${a.label}, photo ${j + 1} of ${a.urls.length}`}
                      >
                        <Image
                          source={{ uri: u }}
                          style={[
                            styles.thumb,
                            { borderColor: theme.brandSurfaceBorder },
                          ]}
                          contentFit="cover"
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </QuoteCard>

        <QuoteCard title="How to reach them">
          {r.customerPhone ? (
            <View style={styles.reach}>
              <ThemedText
                style={[styles.a, { color: theme.brandCream, flex: 1 }]}
                selectable
              >
                {r.customerPhone}
              </ThemedText>
              {tel ? (
                <TextButton
                  gold
                  label="Call"
                  onPress={() => Linking.openURL(tel).catch(() => undefined)}
                />
              ) : null}
            </View>
          ) : null}
          {r.customerEmail ? (
            <ThemedText
              style={[styles.a, { color: theme.brandCream }]}
              selectable
            >
              {r.customerEmail}
            </ThemedText>
          ) : null}
        </QuoteCard>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {r.conversationId ? (
          <PrimaryButton
            label="Open chat"
            onPress={() =>
              navigation.navigate("Chat", { conversationId: r.conversationId! })
            }
          />
        ) : null}
        {open ? (
          <OutlineButton
            label={closing ? "Closing" : "Close request"}
            disabled={closing}
            onPress={close}
          />
        ) : null}
      </ScrollView>
      <PhotoViewer
        visible={!!viewer}
        urls={viewer?.urls ?? []}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  hero: { borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  title: { fontSize: 20, fontWeight: "800" },
  pill: {
    alignSelf: "flex-start",
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
  answer: { gap: 4, paddingVertical: 4 },
  q: { fontSize: 13 },
  a: { fontSize: 15, lineHeight: 21 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reach: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
});

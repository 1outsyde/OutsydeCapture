/**
 * A business's request forms (request forms step F1, Nov 2026). Owner only (GET /api/vendor/request-forms).
 * The base form first (or a card to start one, call 7: three ready questions), then saved forms, then New form.
 * Each opens RequestFormEditor. Opened from the storefront editor hub, What you sell, Request forms.
 * Copy: commas and periods only.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

import { ThemedView } from "@/components/ThemedView";
import {
  Centered,
  ErrorText,
  Hint,
  HostHeader,
  OutlineButton,
  PrimaryButton,
} from "@/components/host/hostUi";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError, type VendorRequestForm } from "@/services/api";
import { errorMessage } from "@/utils/quoteLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const countLine = (n: number) =>
  n === 0 ? "No questions yet" : `${n} question${n === 1 ? "" : "s"}`;

export default function RequestFormsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  // F2b: the photographer's own library (default business, as in F1).
  const side =
    useRoute<RouteProp<RootStackParamList, "RequestForms">>().params?.side ??
    "business";
  const { getToken } = useAuth();
  const [forms, setForms] = useState<VendorRequestForm[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const load = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      if (!token) {
        setError("Sign in again to see your forms.");
        return;
      }
      const res = await api.getRequestFormLibrary(token, side);
      setForms(res.forms);
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

  const base = forms?.find((f) => f.isBase) ?? null;
  const saved = (forms ?? []).filter((f) => !f.isBase);
  const back = {
    icon: "chevron-left" as const,
    label: "Back",
    onPress: () => navigation.goBack(),
  };

  const row = (f: VendorRequestForm, first: boolean) => (
    <Pressable
      key={f.id}
      onPress={() =>
        navigation.navigate("RequestFormEditor", { formId: f.id, side })
      }
      accessibilityRole="button"
      accessibilityLabel={`${f.name}, ${countLine(f.questions.length)}`}
      style={({ pressed }) => [
        styles.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.brandSurfaceBorder,
        },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[styles.rowTitle, { color: theme.brandCream }]}
          numberOfLines={2}
        >
          {f.name}
        </Text>
        <Text style={[styles.rowSub, { color: theme.brandTextDim }]}>
          {countLine(f.questions.length)}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.brandTextDim} />
    </Pressable>
  );

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
      <HostHeader title="Request forms" left={back} />
      {forms === null && !error ? (
        <Centered>
          <ActivityIndicator color={theme.brandGold} />
        </Centered>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
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
        >
          <View style={[styles.intro, { backgroundColor: theme.brandPrimary }]}>
            <Text
              style={[styles.introTitle, { color: theme.brandPrimaryText }]}
              accessibilityRole="header"
            >
              Questions customers answer
            </Text>
            <Text style={[styles.introText, { color: theme.brandPrimaryText }]}>
              When a service is set to Contact for pricing, customers fill out
              its form to ask for a quote. Their answers come to your Requests.
            </Text>
          </View>

          {error ? <ErrorText>{error}</ErrorText> : null}

          {forms !== null ? (
            <>
              <QuoteCard title="Base form">
                {base ? (
                  <>
                    {row(base, true)}
                    <Hint>
                      Services can use it as is, or put it before their own
                      questions.
                    </Hint>
                  </>
                ) : (
                  <>
                    <Hint>
                      One form for all your Contact for pricing services. It
                      starts with three questions you can change.
                    </Hint>
                    <PrimaryButton
                      label="Make a base form"
                      onPress={() =>
                        navigation.navigate("RequestFormEditor", {
                          makeBase: true,
                          side,
                        })
                      }
                    />
                  </>
                )}
              </QuoteCard>

              <QuoteCard title="Saved forms">
                {saved.length === 0 ? (
                  <Hint>
                    Forms for one kind of job, like a wedding or a custom order.
                    A service can use one in place of the base form.
                  </Hint>
                ) : (
                  saved.map((f, i) => row(f, i === 0))
                )}
                <OutlineButton
                  label="New form"
                  onPress={() =>
                    navigation.navigate("RequestFormEditor", { side })
                  }
                />
              </QuoteCard>

              <Hint style={{ paddingHorizontal: 4 }}>
                {
                  "Pick a form for each service in Services, under Contact for pricing."
                }
              </Hint>
            </>
          ) : null}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing["3xl"] },
  intro: { borderRadius: 18, padding: Spacing.md, paddingVertical: 18, gap: 6 },
  introTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  introText: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 12,
    minHeight: 48,
  },
  rowTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  rowSub: { fontSize: 12.5 },
});

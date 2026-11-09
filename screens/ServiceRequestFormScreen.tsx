/**
 * Which form customers fill out for one Contact for pricing service (request forms step F1, call 6). Owner only.
 * Three plain choices: Base form, A saved form, or Just this service (its own questions, with a switch to put the
 * base form's questions first). Saves PUT /api/vendor/services/:id/request-form. Shows what customers will be asked.
 * Opened from the service editor, under Contact for pricing, once the service is saved with it on.
 * Copy: commas and periods only.
 */
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
  Keyboard,
  Pressable,
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

import { ThemedView } from "@/components/ThemedView";
import {
  Centered,
  ErrorText,
  Hint,
  HostHeader,
  PrimaryButton,
  RadioRow,
  Switch,
  TextButton,
} from "@/components/host/hostUi";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { QuestionListEditor } from "@/components/requestForms/QuestionListEditor";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError, type VendorRequestForm } from "@/services/api";
import { errorMessage } from "@/utils/quoteLogic";
import type { RequestQuestion } from "@/utils/requestLogic";
import {
  choiceOf,
  formProblems,
  questionSummary,
  serviceChoiceProblem,
  settingsFor,
  toDraft,
  toWire,
  type DraftQuestion,
  type ServiceFormChoice,
} from "@/utils/requestFormEditor";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "ServiceRequestForm">;

export default function ServiceRequestFormScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const serviceId = params.serviceId;
  const { getToken } = useAuth();
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const [forms, setForms] = useState<VendorRequestForm[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unset, setUnset] = useState(false);
  const [choice, setChoice] = useState<ServiceFormChoice>("base");
  const [formId, setFormId] = useState<string | null>(null);
  const [withBase, setWithBase] = useState(false);
  const [own, setOwn] = useState<DraftQuestion[]>([]);
  const [savedSnap, setSavedSnap] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showProblems, setShowProblems] = useState(false);

  const base = forms?.find((f) => f.isBase) ?? null;
  const saved = useMemo(() => (forms ?? []).filter((f) => !f.isBase), [forms]);

  // The library again on every visit (a base form made in Request forms shows up); the service once.
  const loadLibrary = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      if (!token) return;
      const lib = await api.getRequestFormLibrary(token);
      setForms(lib.forms);
    } catch (err) {
      setError(errorMessage(err as ApiError));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadLibrary();
    }, [loadLibrary]),
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await tokenRef.current();
        if (!token) {
          setError("Sign in again to edit this form.");
          return;
        }
        const [lib, svc] = await Promise.all([
          api.getRequestFormLibrary(token),
          api.getServiceRequestFormSettings(token, serviceId),
        ]);
        if (!alive) return;
        const hasBase = lib.forms.some((f) => f.isBase);
        const s = svc.settings;
        const c = choiceOf(s, hasBase);
        const drafts = s.questions.map(toDraft);
        setForms(lib.forms);
        setUnset(!s.formId && !s.useBase && s.questions.length === 0);
        setChoice(c.choice);
        setFormId(s.formId);
        setWithBase(c.withBase);
        setOwn(drafts);
        setSavedSnap(
          JSON.stringify(
            settingsFor(c.choice, {
              formId: s.formId,
              withBase: c.withBase,
              own: drafts.map(toWire),
            }),
          ),
        );
        setLoaded(true);
      } catch (err) {
        if (alive) setError(errorMessage(err as ApiError));
      }
    })();
    return () => {
      alive = false;
    };
  }, [serviceId]);

  const ownWire = own.map(toWire);
  const settings = settingsFor(choice, { formId, withBase, own: ownWire });
  const snap = JSON.stringify(settings);
  // A service with nothing set reads as the base form, but customers see no questions until it's saved.
  const dirty =
    loaded && (snap !== savedSnap || (unset && choice === "base" && !!base));

  /** What customers will answer with this choice. */
  const preview: RequestQuestion[] = useMemo(() => {
    if (choice === "saved")
      return saved.find((f) => f.id === formId)?.questions ?? [];
    if (choice === "base") return base?.questions ?? [];
    return [...(withBase ? (base?.questions ?? []) : []), ...ownWire];
    // ownWire is derived from own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, formId, saved, base, withBase, own]);

  const ownProblems = useMemo(
    () => (choice === "own" ? formProblems(null, own) : []),
    [choice, own],
  );
  const problemKeys = useMemo(
    () =>
      new Set(
        showProblems
          ? ownProblems.map((p) => p.key).filter((k): k is string => !!k)
          : [],
      ),
    [ownProblems, showProblems],
  );

  const leave = () => {
    if (!dirty || busy) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      "Leave without saving?",
      "This service keeps the form it had.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ],
    );
  };

  const save = async () => {
    Keyboard.dismiss();
    if (busy) return;
    const first =
      ownProblems[0]?.message ??
      serviceChoiceProblem(choice, {
        formId,
        hasBase: !!base,
        withBase,
        own,
        baseQuestions: (base?.questions ?? []).map(toDraft),
      });
    if (first) {
      setShowProblems(true);
      setError(first + ".");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = await tokenRef.current();
      if (!token) {
        setError("Sign in again to save.");
        return;
      }
      await api.setServiceRequestForm(token, serviceId, settings);
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err as ApiError));
    } finally {
      setBusy(false);
    }
  };

  const pick = (c: ServiceFormChoice) => {
    setChoice(c);
    setError("");
    if (c === "saved" && !formId && saved.length === 1) setFormId(saved[0].id);
  };

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
      <HostHeader
        title="Request form"
        sub={params.serviceName}
        left={{ icon: "x", label: "Cancel", onPress: leave }}
        right={
          <Pressable
            onPress={Keyboard.dismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Hide keyboard"
          >
            <Text
              style={{
                color: theme.brandGold,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Done
            </Text>
          </Pressable>
        }
      />
      {!loaded ? (
        <Centered>
          {error ? (
            <ErrorText>{error}</ErrorText>
          ) : (
            <ActivityIndicator color={theme.brandGold} />
          )}
        </Centered>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {unset ? (
            <View
              style={[styles.intro, { backgroundColor: theme.brandPrimary }]}
            >
              <Text
                style={[styles.introText, { color: theme.brandPrimaryText }]}
              >
                Right now this service asks customers no questions, only how to
                reach them. Pick a form and save.
              </Text>
            </View>
          ) : null}

          <QuoteCard title="Customers fill out">
            <RadioRow
              label="Your base form"
              sub={
                base
                  ? `${base.questions.length} question${base.questions.length === 1 ? "" : "s"}, shared by your services.`
                  : "You don't have a base form yet."
              }
              on={choice === "base"}
              disabled={!base}
              onPress={() => pick("base")}
            />
            <RadioRow
              label="A saved form"
              sub={
                saved.length
                  ? "A form from your library, used on its own."
                  : "You don't have saved forms yet."
              }
              on={choice === "saved"}
              disabled={saved.length === 0}
              onPress={() => pick("saved")}
            />
            <RadioRow
              label="Just this service"
              sub="Questions only this service asks."
              on={choice === "own"}
              onPress={() => pick("own")}
            />
            <TextButton
              label="Manage request forms"
              gold
              onPress={() => navigation.navigate("RequestForms")}
            />
          </QuoteCard>

          {choice === "saved" ? (
            <QuoteCard title="Which form">
              {saved.map((f) => (
                <RadioRow
                  key={f.id}
                  label={f.name}
                  sub={`${f.questions.length} question${f.questions.length === 1 ? "" : "s"}`}
                  on={formId === f.id}
                  onPress={() => {
                    setFormId(f.id);
                    setError("");
                  }}
                />
              ))}
            </QuoteCard>
          ) : null}

          {choice === "own" ? (
            <QuoteCard title="This service's questions">
              {base ? (
                <Switch
                  label="Start with the base form"
                  sub={
                    withBase
                      ? "Base form questions come first, then these."
                      : "Only the questions below."
                  }
                  on={withBase}
                  onPress={() => {
                    setWithBase((w) => !w);
                    setError("");
                  }}
                />
              ) : null}
              <QuestionListEditor
                questions={own}
                onChange={(next) => {
                  setOwn(next);
                  setError("");
                }}
                disabled={busy}
                problemKeys={problemKeys}
                emptyText={
                  withBase
                    ? "No extra questions. Customers answer the base form."
                    : undefined
                }
              />
            </QuoteCard>
          ) : null}

          <QuoteCard title="What customers answer">
            {preview.length === 0 ? (
              <Hint>No questions. Customers only share how to reach them.</Hint>
            ) : (
              preview.map((q, i) => (
                <View key={`${q.id ?? "n"}-${i}`} style={styles.previewRow}>
                  <Text
                    style={[styles.previewNum, { color: theme.brandTextDim }]}
                  >
                    {i + 1}
                  </Text>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      style={[styles.previewTitle, { color: theme.brandCream }]}
                    >
                      {q.label}
                    </Text>
                    <Text
                      style={[styles.previewSub, { color: theme.brandTextDim }]}
                    >
                      {questionSummary(q)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </QuoteCard>

          {error ? <ErrorText>{error}</ErrorText> : null}
          <PrimaryButton
            label="Save"
            busy={busy}
            disabled={busy}
            onPress={save}
          />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing["3xl"] },
  intro: { borderRadius: 18, padding: Spacing.md, gap: 6 },
  introText: { fontSize: 14, lineHeight: 20 },
  previewRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  previewNum: { fontSize: 13, fontWeight: "700", width: 18, paddingTop: 1 },
  previewTitle: { fontSize: 14.5, fontWeight: "600", lineHeight: 20 },
  previewSub: { fontSize: 12.5 },
});

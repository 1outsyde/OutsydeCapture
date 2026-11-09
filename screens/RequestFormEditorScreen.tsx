/**
 * One request form, for the business to name and edit (request forms step F1, Nov 2026). Owner only.
 *   - { formId }: edit a form from the library (PATCH). A saved form can be removed (never the base form, and not
 *     while a service uses it: the backend lists those services).
 *   - { makeBase: true }: a first base form, starting with three ready questions (call 7).
 *   - {}: a new saved form.
 * Leaving with changes asks first. Copy: commas and periods only.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedView } from "@/components/ThemedView";
import {
  Centered,
  ErrorText,
  Field,
  Hint,
  HostHeader,
  OutlineButton,
  PrimaryButton,
} from "@/components/host/hostUi";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { QuestionListEditor } from "@/components/requestForms/QuestionListEditor";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/types";
import api, { type ApiError } from "@/services/api";
import { errorMessage } from "@/utils/quoteLogic";
import {
  FORM_MAX_NAME,
  formProblems,
  starterQuestions,
  toDraft,
  toWire,
  type DraftQuestion,
} from "@/utils/requestFormEditor";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "RequestFormEditor">;

/** The backend's message, plus the services it names (FORM_IN_USE, TOO_MANY_QUESTIONS). */
function saveError(err: ApiError): string {
  const msg = errorMessage(err);
  const list = err?.body?.services;
  if (Array.isArray(list) && list.length > 0) {
    const names = list
      .map((s: { name?: string }) => s?.name)
      .filter(Boolean)
      .slice(0, 6)
      .join(", ");
    return names ? `${msg} ${names}.` : msg;
  }
  return msg;
}

export default function RequestFormEditorScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const formId = params?.formId ?? null;
  const makeBase = !formId && params?.makeBase === true;
  const { getToken } = useAuth();
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  const [loaded, setLoaded] = useState(!formId);
  const [isBase, setIsBase] = useState(makeBase);
  const [name, setName] = useState(makeBase ? "Base form" : "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    makeBase ? starterQuestions() : [],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  // What was last saved (or the starting point), to know when there are changes to lose.
  const [savedSnap, setSavedSnap] = useState<string>(() =>
    formId ? "" : JSON.stringify({ name: makeBase ? "Base form" : "", q: [] }),
  );
  const snap = JSON.stringify({ name: name.trim(), q: questions.map(toWire) });
  const dirty = loaded && snap !== savedSnap;

  useEffect(() => {
    if (!formId) return;
    let alive = true;
    (async () => {
      try {
        const token = await tokenRef.current();
        if (!token) {
          setError("Sign in again to edit this form.");
          return;
        }
        const res = await api.getRequestFormLibrary(token);
        const f = res.forms.find((x) => x.id === formId);
        if (!alive) return;
        if (!f) {
          setError("This form was removed.");
          return;
        }
        const drafts = f.questions.map(toDraft);
        setIsBase(f.isBase);
        setName(f.name);
        setQuestions(drafts);
        setSavedSnap(
          JSON.stringify({ name: f.name.trim(), q: drafts.map(toWire) }),
        );
        setLoaded(true);
      } catch (err) {
        if (alive) setError(errorMessage(err as ApiError));
      }
    })();
    return () => {
      alive = false;
    };
  }, [formId]);

  const problems = useMemo(
    () => formProblems(name, questions),
    [name, questions],
  );
  const problemKeys = useMemo(
    () =>
      new Set(
        showProblems
          ? problems.map((p) => p.key).filter((k): k is string => !!k)
          : [],
      ),
    [problems, showProblems],
  );

  const leave = () => {
    if (!dirty || busy) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      "Leave without saving?",
      "Your changes to this form will be lost.",
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
    if (problems.length > 0) {
      setShowProblems(true);
      setError(problems[0].message + ".");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const token = await tokenRef.current();
      if (!token) {
        setError("Sign in again to save this form.");
        return;
      }
      const body = {
        name: name.trim().replace(/\s+/g, " "),
        questions: questions.map(toWire),
      };
      if (formId) await api.updateRequestForm(token, formId, body);
      else await api.createRequestForm(token, { ...body, isBase: makeBase });
      navigation.goBack();
    } catch (err) {
      setError(saveError(err as ApiError));
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!formId || isBase || busy) return;
    Alert.alert("Remove this form?", "Services can't use it after this.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove form",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          setError("");
          try {
            const token = await tokenRef.current();
            if (!token) return;
            await api.deleteRequestForm(token, formId);
            navigation.goBack();
          } catch (err) {
            setError(saveError(err as ApiError));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const title = formId
    ? isBase
      ? "Base form"
      : "Edit form"
    : makeBase
      ? "New base form"
      : "New form";

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.brandBg }}>
      <HostHeader
        title={title}
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
          {makeBase ? (
            <View
              style={[styles.intro, { backgroundColor: theme.brandPrimary }]}
            >
              <Text
                style={[styles.introText, { color: theme.brandPrimaryText }]}
              >
                Here are three questions to start. Change them, remove them, or
                add your own.
              </Text>
            </View>
          ) : null}

          <QuoteCard>
            <Field
              label="FORM NAME"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError("");
              }}
              maxLength={FORM_MAX_NAME}
              placeholder="Wedding hair, Custom cake"
              style={{
                backgroundColor: theme.brandBg,
                borderColor: theme.brandSurfaceBorder,
              }}
            />
            <Hint>Only you see the name.</Hint>
          </QuoteCard>

          <QuoteCard title="Questions">
            <Hint>
              Customers answer these, then add their phone number. They answer
              in the order shown.
            </Hint>
            <QuestionListEditor
              questions={questions}
              onChange={(next) => {
                setQuestions(next);
                setError("");
              }}
              disabled={!!busy}
              problemKeys={problemKeys}
            />
          </QuoteCard>

          {error ? <ErrorText>{error}</ErrorText> : null}
          <PrimaryButton
            label={formId ? "Save form" : "Create form"}
            busy={busy === "save"}
            disabled={!!busy}
            onPress={save}
          />
          {formId && !isBase ? (
            <OutlineButton
              label={busy === "delete" ? "Removing" : "Remove form"}
              danger
              disabled={!!busy}
              onPress={remove}
            />
          ) : null}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing["3xl"] },
  intro: { borderRadius: 18, padding: Spacing.md, gap: 6 },
  introText: { fontSize: 14, lineHeight: 20 },
});

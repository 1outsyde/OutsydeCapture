/**
 * The questions of a request form, for a business to edit (request forms step F1). Used by the form editor
 * (a form in the library) and by a service's own questions. Rules live in utils/requestFormEditor.ts.
 *
 * A list of question cards (move up, move down, edit, remove), + Add a question (pick a type), and a full page
 * to write one question: the question, an optional help line, Required, choices (one per line, pick several),
 * or how many photos. Cancel at the top left, Done at the top right (hides the keyboard), Save at the bottom.
 */
import React, { useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { FullScreenSheet } from "@/components/FullScreenSheet";
import {
  Field,
  Hint,
  Label,
  PrimaryButton,
  Switch,
  TextButton,
} from "@/components/host/hostUi";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import {
  FORM_MAX_QUESTIONS,
  MAX_HELP,
  MAX_LABEL,
  MAX_OPTION,
  MAX_OPTIONS,
  MAX_PHOTOS_PER_QUESTION,
  QUESTION_TYPES,
  blankQuestion,
  cleanOptions,
  moveQuestion,
  questionProblem,
  questionSummary,
  toWire,
  type DraftQuestion,
  type QuestionType,
} from "@/utils/requestFormEditor";

export function QuestionListEditor({
  questions,
  onChange,
  disabled,
  problemKeys,
  emptyText,
}: {
  questions: DraftQuestion[];
  onChange: (next: DraftQuestion[]) => void;
  disabled?: boolean;
  /** Questions with a problem, outlined in red. */
  problemKeys?: Set<string>;
  emptyText?: string;
}) {
  const { theme } = useTheme();
  const [typePicker, setTypePicker] = useState(false);
  const [editing, setEditing] = useState<{
    q: DraftQuestion;
    isNew: boolean;
  } | null>(null);
  const full = questions.length >= FORM_MAX_QUESTIONS;

  const remove = (q: DraftQuestion) => {
    Alert.alert("Remove this question?", q.label.trim() || "This question", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => onChange(questions.filter((x) => x.key !== q.key)),
      },
    ]);
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      {questions.length === 0 ? (
        <Hint>
          {emptyText ??
            "No questions yet. Customers will only be asked for their phone number."}
        </Hint>
      ) : null}
      {questions.map((q, i) => {
        const bad = problemKeys?.has(q.key);
        return (
          <View
            key={q.key}
            style={[
              styles.row,
              {
                backgroundColor: theme.brandBgElevated,
                borderColor: bad ? theme.brandError : theme.brandSurfaceBorder,
              },
            ]}
          >
            <Pressable
              style={{ flex: 1, gap: 2 }}
              onPress={() => setEditing({ q, isNew: false })}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Edit question ${i + 1}, ${q.label || "no question yet"}`}
            >
              <Text
                style={[styles.rowTitle, { color: theme.brandCream }]}
                numberOfLines={2}
              >
                {q.label.trim() || "Write the question"}
              </Text>
              <Text
                style={[styles.rowSub, { color: theme.brandTextDim }]}
                numberOfLines={1}
              >
                {questionSummary(toWire(q))}
              </Text>
            </Pressable>
            <View style={styles.rowTools}>
              <IconBtn
                icon="arrow-up"
                label={`Move question ${i + 1} up`}
                disabled={disabled || i === 0}
                onPress={() => onChange(moveQuestion(questions, i, -1))}
              />
              <IconBtn
                icon="arrow-down"
                label={`Move question ${i + 1} down`}
                disabled={disabled || i === questions.length - 1}
                onPress={() => onChange(moveQuestion(questions, i, 1))}
              />
              <IconBtn
                icon="trash-2"
                label={`Remove question ${i + 1}`}
                disabled={disabled}
                onPress={() => remove(q)}
                danger
              />
            </View>
          </View>
        );
      })}

      <Pressable
        onPress={() => setTypePicker((o) => !o)}
        disabled={disabled || full}
        accessibilityRole="button"
        accessibilityLabel="Add a question"
        style={({ pressed }) => [
          styles.add,
          {
            borderColor: theme.brandSurfaceBorder,
            opacity: disabled || full ? 0.45 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="plus" size={18} color={theme.brandGold} />
        <Text style={[styles.addText, { color: theme.brandGold }]}>
          Add a question
        </Text>
      </Pressable>
      {full ? (
        <Hint>{`A form can have up to ${FORM_MAX_QUESTIONS} questions.`}</Hint>
      ) : null}

      {/* Answer types inline, not in a sheet: on iOS a sheet opened as another closes can fail to show. */}
      {typePicker ? (
        <View
          style={[
            styles.types,
            {
              backgroundColor: theme.brandBg,
              borderColor: theme.brandSurfaceBorder,
            },
          ]}
        >
          <Hint>What kind of answer do you want?</Hint>
          {QUESTION_TYPES.map((t) => (
            <Pressable
              key={t.type}
              onPress={() => {
                setTypePicker(false);
                setEditing({ q: blankQuestion(t.type), isNew: true });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}. ${t.sub}`}
              style={({ pressed }) => [
                styles.typeRow,
                {
                  borderTopColor: theme.brandSurfaceBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowTitle, { color: theme.brandCream }]}>
                  {t.label}
                </Text>
                <Text style={[styles.rowSub, { color: theme.brandTextDim }]}>
                  {t.sub}
                </Text>
              </View>
              <Feather name="plus" size={16} color={theme.brandGold} />
            </Pressable>
          ))}
          <TextButton
            label="Cancel"
            center
            onPress={() => setTypePicker(false)}
          />
        </View>
      ) : null}

      {editing ? (
        <QuestionSheet
          key={editing.q.key}
          initial={editing.q}
          isNew={editing.isNew}
          position={
            editing.isNew
              ? questions.length + 1
              : questions.findIndex((x) => x.key === editing.q.key) + 1
          }
          onClose={() => setEditing(null)}
          onSave={(q) => {
            onChange(
              editing.isNew
                ? [...questions, q]
                : questions.map((x) => (x.key === q.key ? q : x)),
            );
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Feather
        name={icon}
        size={17}
        color={danger ? theme.brandError : theme.brandCream}
      />
    </Pressable>
  );
}

/** One question, on its own page. */
function QuestionSheet({
  initial,
  isNew,
  position,
  onClose,
  onSave,
}: {
  initial: DraftQuestion;
  isNew: boolean;
  position: number;
  onClose: () => void;
  onSave: (q: DraftQuestion) => void;
}) {
  const { theme } = useTheme();
  const [q, setQ] = useState<DraftQuestion>(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const set = <K extends keyof DraftQuestion>(k: K, v: DraftQuestion[K]) => {
    setQ((cur) => ({ ...cur, [k]: v }));
    setProblem(null);
  };
  const typeName =
    QUESTION_TYPES.find((t) => t.type === q.type)?.label ?? "Question";
  const optionsText = q.options.join("\n");

  const save = () => {
    const cleaned: DraftQuestion =
      q.type === "choice" ? { ...q, options: cleanOptions(q.options) } : q;
    const p = questionProblem(cleaned, position);
    if (p) {
      setProblem(p.replace(/^Question \d+ /, "This question "));
      return;
    }
    onSave(cleaned);
  };

  return (
    <FullScreenSheet
      visible
      onClose={onClose}
      title={isNew ? `New ${typeName.toLowerCase()}` : typeName}
      closeLabel="cancel"
      backgroundColor={theme.brandBg}
      tintColor={theme.brandCream}
      borderColor={theme.brandSurfaceBorder}
      right={
        <Pressable
          onPress={Keyboard.dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hide keyboard"
        >
          <Text
            style={{ color: theme.brandGold, fontSize: 15, fontWeight: "600" }}
          >
            Done
          </Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <QuoteCard>
          <Field
            label="THE QUESTION"
            value={q.label}
            onChangeText={(v) => set("label", v)}
            maxLength={MAX_LABEL}
            placeholder={placeholderFor(q.type)}
            style={inputStyle(theme)}
          />
          <Field
            label="HELP LINE (OPTIONAL)"
            value={q.help}
            onChangeText={(v) => set("help", v)}
            maxLength={MAX_HELP}
            placeholder="Shown in small text under the question"
            style={inputStyle(theme)}
          />
          <Switch
            label="Required"
            sub={
              q.required
                ? "Customers must answer before sending."
                : "Customers can skip it."
            }
            on={q.required}
            onPress={() => set("required", !q.required)}
          />
        </QuoteCard>

        {q.type === "choice" ? (
          <QuoteCard title="Choices">
            <Label>ONE CHOICE PER LINE</Label>
            <TextInput
              value={optionsText}
              onChangeText={(v) => set("options", v.split("\n"))}
              multiline
              placeholder={"Shoulder length\nMid back\nWaist length"}
              placeholderTextColor={theme.brandTextDim}
              accessibilityLabel="Choices, one per line"
              style={[
                inputStyle(theme),
                styles.optionsInput,
                { color: theme.brandCream },
              ]}
            />
            <Hint>{`2 to ${MAX_OPTIONS} choices, each up to ${MAX_OPTION} characters.`}</Hint>
            <Switch
              label="Customers can pick more than one"
              on={q.multiple}
              onPress={() => set("multiple", !q.multiple)}
            />
          </QuoteCard>
        ) : null}

        {q.type === "photos" ? (
          <QuoteCard title="How many photos">
            <View style={styles.counter}>
              <IconBtn
                icon="minus"
                label="One fewer photo"
                disabled={q.maxPhotos <= 1}
                onPress={() => set("maxPhotos", Math.max(1, q.maxPhotos - 1))}
              />
              <Text
                style={[styles.counterText, { color: theme.brandCream }]}
                accessibilityLiveRegion="polite"
              >
                {`Up to ${q.maxPhotos}`}
              </Text>
              <IconBtn
                icon="plus"
                label="One more photo"
                disabled={q.maxPhotos >= MAX_PHOTOS_PER_QUESTION}
                onPress={() =>
                  set(
                    "maxPhotos",
                    Math.min(MAX_PHOTOS_PER_QUESTION, q.maxPhotos + 1),
                  )
                }
              />
            </View>
            <Hint>A request holds up to 10 photos in all.</Hint>
          </QuoteCard>
        ) : null}

        {problem ? (
          <Text
            style={[styles.problem, { color: theme.brandError }]}
            accessibilityRole="alert"
          >
            {problem}
          </Text>
        ) : null}
        <PrimaryButton
          label={isNew ? "Add question" : "Save question"}
          onPress={save}
        />
        <TextButton label="Cancel" onPress={onClose} center />
      </ScrollView>
    </FullScreenSheet>
  );
}

function placeholderFor(t: QuestionType): string {
  switch (t) {
    case "short_text":
      return "What color do you want?";
    case "long_text":
      return "Describe the style you want";
    case "choice":
      return "What length?";
    case "date":
      return "When do you need it by?";
    case "photos":
      return "Inspiration photos";
  }
}

function inputStyle(theme: { brandBg: string; brandSurfaceBorder: string }) {
  return {
    backgroundColor: theme.brandBg,
    borderColor: theme.brandSurfaceBorder,
  };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 6,
  },
  rowTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  rowSub: { fontSize: 12.5 },
  rowTools: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addText: { fontSize: 15, fontWeight: "700" },
  types: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 4,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 10,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetBody: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  optionsInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  counter: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  counterText: {
    fontSize: 17,
    fontWeight: "700",
    minWidth: 70,
    textAlign: "center",
  },
  problem: { fontSize: 14, lineHeight: 20 },
});

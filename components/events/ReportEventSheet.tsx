import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/services/api";
import { EVENT_GOLD } from "@/components/events/eventColors";
import {
  REPORT_COPY,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  reportBody,
  reportErrorCopy,
  reportFormError,
  type ReportReasonId,
} from "@/utils/reportEventLogic";

/**
 * p5-safety A2: Report this event. Six reasons, a note (needed for Something else, up to 500), Send.
 * Same words and rules as goutsyde.com. Works the same on iPhone and Android (no Alert.prompt).
 */
export default function ReportEventSheet(props: {
  visible: boolean;
  eventId: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  /** Done tapped after the thanks line (shown in the sheet, not an Alert over a closing Modal). */
  onSent: () => void;
  /** Token missing or expired (401): the screen sends them to sign in. */
  onNeedSignIn: () => void;
}) {
  const { visible, eventId, getToken, onClose, onSent, onNeedSignIn } = props;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReasonId | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const busyRef = useRef(false);

  // A fresh form each time the sheet opens: cleared whenever it closes.
  const reset = () => {
    setReason(null);
    setNote("");
    setErr("");
    setSent(false);
  };

  const close = () => {
    if (busyRef.current) return;
    reset();
    onClose();
  };

  const send = async () => {
    if (busyRef.current) return;
    const problem = reportFormError(reason, note);
    if (problem || !reason) {
      setErr(problem ?? REPORT_COPY.pick);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setErr("");
    try {
      const token = await getToken();
      if (!token) {
        reset();
        onNeedSignIn();
        return;
      }
      await api.reportEvent(eventId, reportBody(reason, note), token);
      setSent(true);
    } catch (e: any) {
      if (e?.status === 401) {
        reset();
        onNeedSignIn();
      } else setErr(reportErrorCopy(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const other = reason === "other";
  const count = note.trim().length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android apps run edge to edge (the window no longer resizes for the keyboard): shrink the view instead.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Close"
            accessibilityRole="button"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.card,
                paddingBottom: insets.bottom + 20,
              },
            ]}
            testID="report-sheet"
          >
            <View style={styles.head}>
              <ThemedText
                style={[styles.title, { color: theme.text }]}
                accessibilityRole="header"
              >
                {REPORT_COPY.title}
              </ThemedText>
              <Pressable
                onPress={close}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 10 }}
              style={{ flexShrink: 1 }}
            >
              {sent ? (
                <View
                  style={{ gap: 14, paddingBottom: 4 }}
                  testID="report-sent"
                >
                  <ThemedText
                    style={[styles.sub, { color: theme.text, fontSize: 15 }]}
                    accessibilityRole="alert"
                  >
                    {REPORT_COPY.thanks}
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      reset();
                      onSent();
                    }}
                    accessibilityRole="button"
                    testID="report-done"
                    style={[styles.cta, { backgroundColor: EVENT_GOLD }]}
                  >
                    <ThemedText style={styles.ctaText}>Done</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ThemedText
                    style={[styles.sub, { color: theme.textSecondary }]}
                  >
                    {REPORT_COPY.sub}
                  </ThemedText>
                  <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
                    {REPORT_REASONS.map((r) => {
                      const on = reason === r.id;
                      return (
                        <Pressable
                          key={r.id}
                          onPress={() => {
                            setReason(r.id);
                            setErr("");
                          }}
                          disabled={busy}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on, disabled: busy }}
                          accessibilityLabel={r.label}
                          testID={`report-reason-${r.id}`}
                          style={[
                            styles.option,
                            {
                              borderColor: on ? EVENT_GOLD : theme.border,
                              backgroundColor: on
                                ? "rgba(232,185,48,0.10)"
                                : "transparent",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.radio,
                              {
                                borderColor: on
                                  ? EVENT_GOLD
                                  : theme.textSecondary,
                              },
                            ]}
                          >
                            {on ? <View style={styles.radioDot} /> : null}
                          </View>
                          <ThemedText
                            style={[styles.optionText, { color: theme.text }]}
                          >
                            {r.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <ThemedText
                    style={[styles.label, { color: theme.textSecondary }]}
                  >
                    {(other
                      ? REPORT_COPY.noteLabelOther
                      : REPORT_COPY.noteLabel
                    ).toUpperCase()}
                  </ThemedText>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    editable={!busy}
                    multiline
                    maxLength={REPORT_NOTE_MAX}
                    accessibilityLabel={
                      other ? REPORT_COPY.noteLabelOther : REPORT_COPY.noteLabel
                    }
                    testID="report-note"
                    style={[
                      styles.note,
                      { color: theme.text, borderColor: theme.border },
                    ]}
                    textAlignVertical="top"
                  />
                  <ThemedText
                    style={[styles.count, { color: theme.textSecondary }]}
                  >
                    {count} / {REPORT_NOTE_MAX}
                  </ThemedText>
                  {err ? (
                    <ThemedText
                      style={[styles.err, { color: theme.error }]}
                      accessibilityRole="alert"
                      testID="report-error"
                    >
                      {err}
                    </ThemedText>
                  ) : null}
                  <Pressable
                    onPress={send}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ busy, disabled: busy }}
                    testID="report-send"
                    style={[
                      styles.cta,
                      { backgroundColor: EVENT_GOLD, opacity: busy ? 0.7 : 1 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#0B0B0B" />
                    ) : (
                      <ThemedText style={styles.ctaText}>
                        {REPORT_COPY.send}
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
    maxHeight: "92%",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "800" },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sub: { fontSize: 13, lineHeight: 19 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: EVENT_GOLD,
  },
  optionText: { fontSize: 15, flex: 1 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: 6 },
  note: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  count: { fontSize: 12, textAlign: "right", marginTop: -4 },
  err: { fontSize: 14 },
  cta: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  ctaText: { color: "#0B0B0B", fontSize: 16, fontWeight: "700" },
});

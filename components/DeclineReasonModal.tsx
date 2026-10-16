import React, { useEffect, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

/**
 * Optional-reason prompt for declining a booking.
 * Android only: iOS keeps the native Alert.prompt (Alert.prompt does nothing on Android).
 */
interface DeclineReasonModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

export default function DeclineReasonModal({
  visible,
  onCancel,
  onSubmit,
}: DeclineReasonModalProps) {
  const { theme } = useTheme();
  const [reason, setReason] = useState("");

  // Start empty every time it opens, like Alert.prompt.
  useEffect(() => {
    if (visible) setReason("");
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable
            style={[styles.modal, { backgroundColor: theme.card }]}
            onPress={() => {}}
          >
            <View style={styles.header}>
              <ThemedText style={styles.title}>Decline Booking</ThemedText>
              <Pressable
                onPress={onCancel}
                style={styles.closeButton}
                hitSlop={8}
              >
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText
              style={[styles.message, { color: theme.textSecondary }]}
            >
              Optional: add a reason for the customer (e.g. unavailable, fully
              booked).
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              multiline
              maxLength={500}
            />
            <View style={styles.actions}>
              <Pressable
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={onCancel}
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, { backgroundColor: theme.error }]}
                onPress={() => onSubmit(reason)}
              >
                <ThemedText style={styles.confirmButtonText}>
                  Decline
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  message: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  input: {
    minHeight: 80,
    maxHeight: 160,
    fontSize: 15,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    textAlignVertical: "top",
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

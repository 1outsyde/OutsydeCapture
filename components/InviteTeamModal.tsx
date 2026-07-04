import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/services/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteTeamModalProps {
  visible: boolean;
  onClose: () => void;
  onInviteSent: () => void;
  brandColor?: string;
}

export default function InviteTeamModal({
  visible,
  onClose,
  onInviteSent,
  brandColor = "#D4A84B",
}: InviteTeamModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the modal opens
  useEffect(() => {
    if (visible) {
      setEmail("");
      setRole("staff");
      setPhone("");
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setSubmitting(true);
      const token = await getToken();
      if (!token) {
        setError("Not authenticated. Please log in and try again.");
        return;
      }

      const payload: { email: string; role: "staff" | "manager"; phone?: string } = {
        email: trimmedEmail,
        role,
      };
      const trimmedPhone = phone.trim();
      if (trimmedPhone) {
        payload.phone = trimmedPhone;
      }

      await apiClient.createStaffInvite(token, payload);

      onClose();
      onInviteSent();
      Alert.alert("Invite sent", `An invite has been sent to ${trimmedEmail}.`);
    } catch (err: any) {
      // Surface the API's specific error message (e.g. duplicate invite)
      const message =
        err?.message ||
        (typeof err?.error === "string" ? err.error : null) ||
        "Failed to send invite. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.background,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>
              Invite Team Member
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Email */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>
                Email address *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: error && !email.trim() ? "#FF4444" : theme.border,
                  },
                ]}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                placeholder="teammate@example.com"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>

            {/* Role toggle */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Role</Text>
              <View style={styles.roleRow}>
                {(["staff", "manager"] as const).map((r) => {
                  const active = role === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      disabled={submitting}
                      style={[
                        styles.roleButton,
                        {
                          borderColor: active ? brandColor : theme.border,
                          backgroundColor: active
                            ? `${brandColor}22`
                            : theme.card,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          { color: active ? brandColor : theme.textSecondary },
                        ]}
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Phone (optional) */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>
                Phone{" "}
                <Text style={{ color: theme.textSecondary, fontWeight: "400" }}>
                  (optional)
                </Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 000 0000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                editable={!submitting}
              />
            </View>

            {/* Inline error */}
            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#FF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={[
                styles.cancelButton,
                { borderColor: theme.border },
                submitting && styles.buttonDisabled,
              ]}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.sendButton,
                { backgroundColor: brandColor },
                submitting && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.sendButtonText}>Send Invite</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    flex: 1,
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,68,68,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#FF4444",
    fontSize: 13,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  sendButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

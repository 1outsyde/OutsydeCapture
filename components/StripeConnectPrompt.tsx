import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";

const STRIPE_RETURN_URL = "outsyde://stripe-return";

// "Remind me later" lasts until the next cold launch: module state, deliberately not persisted.
let snoozedUntilRelaunch = false;
export function isStripePromptSnoozed(): boolean {
  return snoozedUntilRelaunch;
}

interface StripeConnectPromptProps {
  visible: boolean;
  onSnooze: () => void;
}

export function StripeConnectPrompt({
  visible,
  onSnooze,
}: StripeConnectPromptProps) {
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again and retry.");
      const { url } = await api.startVendorStripeOnboarding(
        token,
        STRIPE_RETURN_URL,
      );
      if (!url) throw new Error("Stripe did not return a setup link.");
      await Linking.openURL(url);
    } catch (err: any) {
      setError(
        err?.message || "Could not start Stripe setup. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    snoozedUntilRelaunch = true;
    setError(null);
    onSnooze();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundRoot,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text }]}
          >
            Set up Stripe Connect so you get paid
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Connect Stripe so payments from your bookings and orders reach your
            bank account.
          </Text>
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Already finished? Stripe may still be verifying your account.
          </Text>

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set up Stripe"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={handleSetup}
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.primary, opacity: busy ? 0.7 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>Set up Stripe</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remind me later"
            disabled={busy}
            onPress={handleLater}
            style={styles.secondaryBtn}
          >
            <Text
              style={[styles.secondaryBtnText, { color: theme.textSecondary }]}
            >
              Remind me later
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 10 },
  note: { fontSize: 13, lineHeight: 18, textAlign: "center", marginBottom: 20 },
  error: {
    color: "#E5484D",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
  secondaryBtn: { alignItems: "center", marginTop: 14, paddingVertical: 12 },
  secondaryBtnText: { fontSize: 14, fontWeight: "600" },
});

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import api from "@/services/api";

const SUCCESS_COLOR = "#34C759";
const STRIPE_RETURN_URL = "outsyde://stripe-return";

export default function StaffOnboardingStatusScreen() {
  const { theme } = useTheme();
  const { user, getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const isOnboardingComplete = user?.staffStripeOnboardingComplete === true;

  const handleCompleteStripeSetup = async () => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Not authenticated. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      const { url } = await api.startStaffStripeOnboarding(token);
      if (url) {
        Linking.openURL(url);
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to start Stripe setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {isOnboardingComplete ? (
          /* ─── Complete state ─────────────────────────────────────────── */
          <>
            <View style={[styles.iconCircle, { backgroundColor: SUCCESS_COLOR + "20" }]}>
              <Feather name="check-circle" size={48} color={SUCCESS_COLOR} />
            </View>

            <ThemedText type="h3" style={styles.title}>
              You're all set up
            </ThemedText>

            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Your Stripe payout account is connected and ready to receive payments.
            </ThemedText>

            {(user?.staffBusinessName) ? (
              <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Feather name="briefcase" size={18} color={theme.textSecondary} />
                  <View style={styles.infoText}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Business
                    </ThemedText>
                    <ThemedText type="body">{user.staffBusinessName}</ThemedText>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.infoRow}>
                  <Feather name="user" size={18} color={theme.textSecondary} />
                  <View style={styles.infoText}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Role
                    </ThemedText>
                    <ThemedText type="body">Staff Member</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          /* ─── Incomplete state ───────────────────────────────────────── */
          <>
            <View style={[styles.iconCircle, { backgroundColor: theme.brandGold + "20" }]}>
              <Feather name="credit-card" size={48} color={theme.brandGold ?? "#D4A84B"} />
            </View>

            <ThemedText type="h3" style={styles.title}>
              Finish setting up payouts
            </ThemedText>

            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Finish setting up payouts to get paid for your work. Connect your Stripe account to
              receive payments directly to your bank.
            </ThemedText>

            <View style={[styles.stripeCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="zap" size={20} color={theme.brandGold ?? "#D4A84B"} />
              <ThemedText type="caption" style={[styles.stripeCardText, { color: theme.textSecondary }]}>
                Stripe is used to securely process your payouts. Setup takes about 5 minutes.
              </ThemedText>
            </View>

            <View style={styles.buttonContainer}>
              {loading ? (
                <ActivityIndicator size="large" color={theme.brandGold ?? "#D4A84B"} />
              ) : (
                <Button onPress={handleCompleteStripeSetup}>
                  Complete Stripe Setup
                </Button>
              )}
            </View>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerSpacer: {
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  infoCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
  },
  stripeCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  stripeCardText: {
    flex: 1,
    lineHeight: 18,
  },
  buttonContainer: {
    width: "100%",
    marginTop: Spacing.sm,
  },
});

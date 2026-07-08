import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, CommonActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import api from "@/services/api";

const SUCCESS_COLOR = "#34C759";

export default function StaffOnboardingStatusScreen() {
  const { theme } = useTheme();
  const { user, getToken, updateProfile, pendingStripeReturn, clearPendingStripeReturn } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  // Local state for onboarding status — seeded from cached auth value, then refreshed
  // on every focus via useFocusEffect (see Bug 2 fix below).
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(
    user?.staffStripeOnboardingComplete === true
  );

  // Keep a stable ref to updateProfile so the useCallback in useFocusEffect can hold
  // empty deps ([]) while still always calling the latest version of the function.
  // (updateProfile closes over `user` from its render, so its reference changes on every
  // render; capturing it in a ref prevents the useFocusEffect from re-running when user
  // state updates mid-flow.)
  const updateProfileRef = useRef(updateProfile);
  useEffect(() => {
    updateProfileRef.current = updateProfile;
  }, [updateProfile]);

  // ── Bug 2 fix ───────────────────────────────────────────────────────────────
  // loadStoredAuth does NOT re-call GET /api/staff/me on session restore — it spreads
  // only username/displayName/avatar/profileImageUrl/coverMedia from /api/auth/me,
  // so staffStripeOnboardingComplete stays stale after a JS reload or DB change.
  // Refetch on every screen focus so the UI always shows current data.
  //
  // Ordering matters: await updateProfile BEFORE setOnboardingComplete so that
  // user.staffStripeOnboardingComplete in auth context is updated before the re-render
  // that makes the "Continue to App" button visible. This closes the race window where
  // the user could tap Continue while the auth context still held the stale false value,
  // which would cause MainTabNavigator's redirect gate to fire and bounce them back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const fetchStatus = async () => {
        try {
          const token = await getToken();
          if (!token || cancelled) return;

          const businessIdParam = user?.staffBusinessId
            ? `?businessId=${encodeURIComponent(user.staffBusinessId)}`
            : "";
          const res = await fetch(`https://outsyde-backend.onrender.com/api/staff/me${businessIdParam}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
          });

          if (!res.ok || cancelled) return;

          const json = await res.json();
          const s = json.staff || json;
          const fresh = s.stripeOnboardingComplete === true;

          // Update auth context FIRST (synchronous setUser fires after awaited AsyncStorage.setItem),
          // then update local state — ensures the gate in MainTabNavigator sees the correct
          // value before the button is visible.
          await updateProfileRef.current({
            staffStripeOnboardingComplete: fresh,
            staffStripeOnboardingUrl: s.stripeOnboardingUrl,
          });

          if (!cancelled) {
            setOnboardingComplete(fresh);
            console.log("[StaffOnboarding] Fresh status on focus:", fresh);
          }
        } catch (err) {
          console.warn("[StaffOnboarding] Status fetch failed (non-critical):", err);
        }
      };

      fetchStatus();
      return () => {
        cancelled = true;
      };
    }, []) // getToken reads SecureStore/AsyncStorage (not React state) — semantically stable.
           // updateProfileRef.current always points to the latest updateProfile via the ref.
  );

  // Consume outsyde://stripe-return?status=...&type=staff deep links.
  // MainTabNavigator is not mounted for staff users (reset removes it from the stack),
  // so this screen is the correct owner of the type=staff Stripe return.
  useEffect(() => {
    if (!pendingStripeReturn || pendingStripeReturn.type !== "staff") return;
    clearPendingStripeReturn();

    const refreshStaffStatus = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const businessIdParam = user?.staffBusinessId
          ? `?businessId=${encodeURIComponent(user.staffBusinessId)}`
          : "";
        const res = await fetch(`https://outsyde-backend.onrender.com/api/staff/me${businessIdParam}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          const s = json.staff || json;
          const fresh = s.stripeOnboardingComplete === true;
          await updateProfile({
            staffStripeOnboardingComplete: fresh,
            staffStripeOnboardingUrl: s.stripeOnboardingUrl,
          });
          setOnboardingComplete(fresh);
          console.log("[StaffOnboarding] Stripe return — status refreshed:", fresh);
        }
      } catch (err) {
        console.warn("[StaffOnboarding] Stripe return refresh failed (non-critical):", err);
      }
    };

    refreshStaffStatus();
  }, [pendingStripeReturn]);

  // ── Bug 1 fix ───────────────────────────────────────────────────────────────
  // This is a user-triggered button press, NOT a useEffect or anything automatic.
  // Navigates staff with complete onboarding to the standard consumer tab bar.
  // Safe from bounce: MainTabNavigator's redirect gate is conditioned on
  // staffStripeOnboardingComplete !== true, which is now true (set above before
  // this button became visible).
  const handleContinueToApp = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }],
      })
    );
  };

  const handleCompleteStripeSetup = async () => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Not authenticated. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      const { url } = await api.startStaffStripeOnboarding(token, user?.staffBusinessId);
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
        {onboardingComplete ? (
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

            {user?.staffBusinessName ? (
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

            <View style={styles.buttonContainer}>
              <Button onPress={handleContinueToApp}>
                Continue to App
              </Button>
            </View>
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

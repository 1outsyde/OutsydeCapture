import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { VendorEligibility, SubscriptionTier } from "@/services/api";

const STRIPE_RETURN_URL = "outsyde://stripe-return";

interface Props {
  eligibility: VendorEligibility | null;
  onRefreshEligibility: () => Promise<void>;
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <View
      style={[
        dotStyles.dot,
        done && dotStyles.done,
        active && dotStyles.active,
      ]}
    >
      {done ? (
        <Feather name="check" size={10} color="#fff" />
      ) : null}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  done: { backgroundColor: "#22c55e" },
  active: { backgroundColor: "#eab308" },
});

export default function BusinessEligibilityGate({ eligibility, onRefreshEligibility }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isVisible = Boolean(
    eligibility &&
    (eligibility.requiresApproval ||
      eligibility.requiresPlanSelection ||
      eligibility.requiresOnboarding ||
      eligibility.requiresSubscription)
  );

  const currentStep = (): "approval" | "plan" | "onboarding" | "subscription" | null => {
    if (!eligibility) return null;
    if (eligibility.requiresApproval) return "approval";
    if (eligibility.requiresPlanSelection) return "plan";
    if (eligibility.requiresOnboarding) return "onboarding";
    if (eligibility.requiresSubscription) return "subscription";
    return null;
  };

  const step = currentStep();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshEligibility();
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshEligibility]);

  useEffect(() => {
    if (step !== "plan" || tiers.length > 0) return;
    let cancelled = false;
    (async () => {
      setTiersLoading(true);
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const { tiers: t } = await api.getSubscriptionTiers(token);
        if (!cancelled) setTiers(t || []);
      } catch (err) {
        console.warn("[EligibilityGate] Failed to fetch tiers:", err);
      } finally {
        if (!cancelled) setTiersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step]);

  useEffect(() => {
    if (!isVisible) return;
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        await handleRefresh();
      }
      appStateRef.current = nextState;
    });
    const linkSub = Linking.addEventListener("url", async (event) => {
      if (event.url.includes("stripe-return") || event.url.includes("checkout")) {
        await handleRefresh();
      }
    });
    return () => {
      sub.remove();
      linkSub.remove();
    };
  }, [isVisible, handleRefresh]);

  const handleStartStripeOnboarding = async () => {
    const token = await getToken();
    if (!token) return;
    setActionLoading(true);
    try {
      const { url } = await api.startVendorStripeOnboarding(token, STRIPE_RETURN_URL);
      if (url) {
        await Linking.openURL(url);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start Stripe setup. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartSubscriptionCheckout = async () => {
    if (!selectedTierId) {
      Alert.alert("Select a Plan", "Please select a plan before continuing.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setActionLoading(true);
    try {
      const { checkoutUrl } = await api.createTierSubscriptionCheckout(token, selectedTierId, STRIPE_RETURN_URL);
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start subscription. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const stepOrder: Array<"approval" | "plan" | "onboarding" | "subscription"> = [
    "approval",
    "plan",
    "onboarding",
    "subscription",
  ];
  const stepLabels: Record<string, string> = {
    approval: "Approval",
    plan: "Choose Plan",
    onboarding: "Stripe Setup",
    subscription: "Activate",
  };

  const getStepIndex = (s: string) => stepOrder.indexOf(s as any);
  const activeIndex = step ? getStepIndex(step) : -1;

  if (!isVisible || !step) return null;

  const s = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      paddingTop: insets.top + 16,
      paddingHorizontal: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    logo: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.primary,
      letterSpacing: 1,
      marginBottom: 4,
    },
    headerSub: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    stepBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: theme.border,
      marginHorizontal: 4,
    },
    stepLineDone: {
      backgroundColor: "#22c55e",
    },
    stepLabelRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    stepLabelCell: {
      flex: 1,
      alignItems: "center",
    },
    stepLabel: {
      fontSize: 10,
      color: theme.textSecondary,
      textAlign: "center",
    },
    stepLabelActive: {
      color: theme.primary,
      fontWeight: "600",
    },
    body: {
      flex: 1,
    },
    card: {
      margin: 24,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 24,
    },
    stepTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 12,
    },
    stepDesc: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 24,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 15,
      paddingHorizontal: 24,
      gap: 8,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    secondaryBtn: {
      alignItems: "center",
      marginTop: 14,
      paddingVertical: 12,
    },
    secondaryBtnText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    pendingIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "#fef3c7",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    tierCard: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 12,
    },
    tierCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + "12",
    },
    tierName: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.text,
    },
    tierPrice: {
      fontSize: 15,
      color: theme.primary,
      fontWeight: "600",
      marginTop: 2,
    },
    tierDesc: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 6,
    },
    tierFeature: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
    tierFeatureText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    refreshBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      marginHorizontal: 24,
    },
    refreshBtnText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
  });

  const renderStepBar = () => (
    <>
      <View style={s.stepBar}>
        {stepOrder.map((st, idx) => {
          const done = idx < activeIndex;
          const active = idx === activeIndex;
          return (
            <React.Fragment key={st}>
              <StepDot done={done} active={active} />
              {idx < stepOrder.length - 1 && (
                <View style={[s.stepLine, done && s.stepLineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <View style={s.stepLabelRow}>
        {stepOrder.map((st, idx) => (
          <View key={st} style={s.stepLabelCell}>
            <Text style={[s.stepLabel, idx === activeIndex && s.stepLabelActive]}>
              {stepLabels[st]}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderApprovalStep = () => (
    <View style={s.card}>
      <View style={s.pendingIcon}>
        <Feather name="clock" size={30} color="#d97706" />
      </View>
      <Text style={s.stepTitle}>Application Under Review</Text>
      <Text style={s.stepDesc}>
        Your business account is currently being reviewed by our team.
        {"\n\n"}
        You will be notified by email once approved. After approval, you can select your plan and start publishing your products and services.
      </Text>
      <Pressable style={s.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <>
            <Feather name="refresh-cw" size={14} color={theme.textSecondary} />
            <Text style={s.refreshBtnText}>Check approval status</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderPlanStep = () => (
    <View style={s.card}>
      <Text style={s.stepTitle}>Choose Your Plan</Text>
      <Text style={s.stepDesc}>
        Select the subscription plan that best fits your business. You can upgrade or change plans later.
      </Text>
      {tiersLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
      ) : tiers.length === 0 ? (
        <Text style={{ color: theme.textSecondary, marginBottom: 24 }}>
          No plans available. Please try refreshing.
        </Text>
      ) : (
        tiers.map((tier) => (
          <Pressable
            key={tier.id}
            style={[s.tierCard, selectedTierId === tier.id && s.tierCardSelected]}
            onPress={() => setSelectedTierId(tier.id)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={s.tierName}>{tier.name}</Text>
              {selectedTierId === tier.id && (
                <Feather name="check-circle" size={18} color={theme.primary} />
              )}
            </View>
            <Text style={s.tierPrice}>
              {tier.priceLabel || (typeof tier.price === "number" ? `$${(tier.price / 100).toFixed(2)}/${tier.interval || "mo"}` : String(tier.price))}
            </Text>
            {tier.description ? (
              <Text style={s.tierDesc}>{tier.description}</Text>
            ) : null}
            {(tier.features || []).map((f, i) => (
              <View key={i} style={s.tierFeature}>
                <Feather name="check" size={12} color="#22c55e" />
                <Text style={s.tierFeatureText}>{f}</Text>
              </View>
            ))}
          </Pressable>
        ))
      )}
      <Pressable
        style={[s.primaryBtn, !selectedTierId && { opacity: 0.5 }]}
        onPress={handleStartStripeOnboarding}
        disabled={!selectedTierId || actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Text style={s.primaryBtnText}>Continue to Payment Setup</Text>
            <Feather name="arrow-right" size={18} color="#000" />
          </>
        )}
      </Pressable>
    </View>
  );

  const renderOnboardingStep = () => (
    <View style={s.card}>
      <View style={s.pendingIcon}>
        <Feather name="credit-card" size={30} color="#d97706" />
      </View>
      <Text style={s.stepTitle}>Set Up Payments</Text>
      <Text style={s.stepDesc}>
        Connect your Stripe account to receive payments from customers. This lets Outsyde route purchases and bookings directly to you.
        {"\n\n"}
        You will be redirected to Stripe to complete the setup. Return to the app when done.
      </Text>
      <Pressable
        style={s.primaryBtn}
        onPress={handleStartStripeOnboarding}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Feather name="external-link" size={16} color="#000" />
            <Text style={s.primaryBtnText}>Connect with Stripe</Text>
          </>
        )}
      </Pressable>
      <Pressable style={s.secondaryBtn} onPress={handleRefresh} disabled={refreshing}>
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <Text style={s.secondaryBtnText}>I already connected — check status</Text>
        )}
      </Pressable>
    </View>
  );

  const renderSubscriptionStep = () => (
    <View style={s.card}>
      <View style={s.pendingIcon}>
        <Feather name="zap" size={30} color="#d97706" />
      </View>
      <Text style={s.stepTitle}>Activate Your Subscription</Text>
      <Text style={s.stepDesc}>
        Complete your subscription payment to unlock publishing. You will be taken to a secure Stripe checkout. Return to the app once payment is confirmed.
      </Text>
      {!selectedTierId ? (
        <>
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }}>
            Please select a plan to continue:
          </Text>
          {tiersLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginBottom: 16 }} />
          ) : (
            tiers.map((tier) => (
              <Pressable
                key={tier.id}
                style={[s.tierCard, selectedTierId === tier.id && s.tierCardSelected]}
                onPress={() => setSelectedTierId(tier.id)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={s.tierName}>{tier.name}</Text>
                  {selectedTierId === tier.id && <Feather name="check-circle" size={18} color={theme.primary} />}
                </View>
                <Text style={s.tierPrice}>
                  {tier.priceLabel || (typeof tier.price === "number" ? `$${(tier.price / 100).toFixed(2)}/${tier.interval || "mo"}` : String(tier.price))}
                </Text>
              </Pressable>
            ))
          )}
        </>
      ) : null}
      <Pressable
        style={[s.primaryBtn, !selectedTierId && { opacity: 0.5 }]}
        onPress={handleStartSubscriptionCheckout}
        disabled={!selectedTierId || actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Feather name="zap" size={16} color="#000" />
            <Text style={s.primaryBtnText}>Activate Subscription</Text>
          </>
        )}
      </Pressable>
      <Pressable style={s.secondaryBtn} onPress={handleRefresh} disabled={refreshing}>
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <Text style={s.secondaryBtnText}>I already paid — check status</Text>
        )}
      </Pressable>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case "approval": return renderApprovalStep();
      case "plan": return renderPlanStep();
      case "onboarding": return renderOnboardingStep();
      case "subscription": return renderSubscriptionStep();
      default: return null;
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen">
      <View style={s.overlay}>
        <View style={s.header}>
          <Text style={s.logo}>OUTSYDE</Text>
          <Text style={s.headerSub}>Business Setup</Text>
        </View>
        {renderStepBar()}
        <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {renderStep()}
        </ScrollView>
      </View>
    </Modal>
  );
}

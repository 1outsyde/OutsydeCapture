import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { SubscriptionTier, VendorEligibility } from "@/services/api";

const STRIPE_RETURN_URL = "outsyde://stripe-return";

const FALLBACK_TIERS: SubscriptionTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 2900,
    priceLabel: "$29/mo",
    description: "Perfect for new businesses getting started.",
    features: ["Up to 10 products", "Basic analytics", "Customer messaging", "Standard support"],
    interval: "mo",
    badge: "",
  },
  {
    id: "pro",
    name: "Pro",
    price: 7900,
    priceLabel: "$79/mo",
    description: "For growing businesses that need more power.",
    features: ["Unlimited products", "Advanced analytics", "Priority support", "Featured placement", "Custom branding"],
    interval: "mo",
    badge: "Most Popular",
  },
  {
    id: "elite",
    name: "Elite",
    price: 19900,
    priceLabel: "$199/mo",
    description: "Full-featured for established businesses.",
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "API access",
      "Custom integrations",
      "White-glove onboarding",
    ],
    interval: "mo",
    badge: "Best Value",
  },
];

export default function SubscriptionPlanScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [eligibility, setEligibility] = useState<VendorEligibility | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [currentTierName, setCurrentTierName] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isMonetizationError = (err: any): boolean =>
    err?.body?.error === "Monetization not enabled" ||
    (typeof err?.message === "string" &&
      err.message.toLowerCase().includes("monetization"));

  const isActive = eligibility
    ? eligibility.canPublishProducts || eligibility.canPublishServices
    : subscriptionStatus === "active";

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const [tiersRes, eligibilityRes, bizRes] = await Promise.allSettled([
        api.getSubscriptionTiers(token),
        api.getVendorEligibility(token),
        api.getVendorMyBusiness(token),
      ]);

      if (tiersRes.status === "fulfilled" && tiersRes.value.tiers?.length > 0) {
        setTiers(tiersRes.value.tiers);
      } else {
        setTiers(FALLBACK_TIERS);
      }

      if (eligibilityRes.status === "fulfilled") {
        setEligibility(eligibilityRes.value);
      }

      if (bizRes.status === "fulfilled") {
        const biz = bizRes.value.business as any;
        setSubscriptionStatus(biz?.subscriptionStatus || null);
        setCurrentTierName(biz?.subscriptionTier || null);
      }
    } catch (err) {
      setTiers(FALLBACK_TIERS);
    } finally {
      setTiersLoading(false);
    }
  }, [getToken]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        await handleRefresh();
      }
      appStateRef.current = next;
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
  }, [handleRefresh]);

  const handleSubscribe = async () => {
    if (!selectedTierId) {
      Alert.alert("Select a Plan", "Please select a subscription plan to continue.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setSubscribeError(null);
    setActionLoading(true);
    try {
      const { checkoutUrl } = await api.createTierSubscriptionCheckout(token, selectedTierId, STRIPE_RETURN_URL);
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      }
    } catch (err: any) {
      if (isMonetizationError(err)) {
        setSubscribeError("monetization");
      } else {
        setSubscribeError(err.message || "Failed to start checkout. Please try again.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    const token = await getToken();
    if (!token) return;
    setPortalLoading(true);
    try {
      const { portalUrl } = await api.createBillingPortalSession(token, STRIPE_RETURN_URL);
      if (portalUrl) {
        await Linking.openURL(portalUrl);
      }
    } catch (err: any) {
      Alert.alert("Billing Portal Unavailable", "Please contact support to manage your subscription.");
    } finally {
      setPortalLoading(false);
    }
  };

  const formatTierPrice = (tier: SubscriptionTier) => {
    if (tier.priceLabel) return tier.priceLabel;
    if (typeof tier.price === "number") {
      return `$${(tier.price / 100).toFixed(0)}/${tier.interval || "mo"}`;
    }
    return String(tier.price);
  };

  const statusColor = () => {
    if (!subscriptionStatus || subscriptionStatus === "none" || subscriptionStatus === "canceled") return theme.error;
    if (subscriptionStatus === "past_due") return "#FF9500";
    if (subscriptionStatus === "active") return "#22c55e";
    return theme.textSecondary;
  };

  const statusLabel = () => {
    if (!subscriptionStatus || subscriptionStatus === "none") return "No active plan";
    if (subscriptionStatus === "canceled") return "Canceled";
    if (subscriptionStatus === "past_due") return "Payment past due";
    if (subscriptionStatus === "active") return "Active";
    return subscriptionStatus;
  };

  const renderCurrentPlanBanner = () => {
    if (!isActive) return null;
    return (
      <View style={[styles.currentPlanBanner, { backgroundColor: "#22c55e18", borderColor: "#22c55e40" }]}>
        <View style={styles.currentPlanRow}>
          <Feather name="check-circle" size={20} color="#22c55e" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[styles.currentPlanTitle, { color: theme.text }]}>
              {currentTierName ? `${currentTierName} Plan` : "Subscription Active"}
            </Text>
            <Text style={[styles.currentPlanStatus, { color: "#22c55e" }]}>
              {statusLabel()}
            </Text>
          </View>
        </View>
        <Pressable
          style={[styles.manageBtn, { borderColor: theme.border }]}
          onPress={handleManageBilling}
          disabled={portalLoading}
        >
          {portalLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Feather name="external-link" size={14} color={theme.primary} />
              <Text style={[styles.manageBtnText, { color: theme.primary }]}>Manage Billing</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  const renderPastDueBanner = () => {
    if (subscriptionStatus !== "past_due") return null;
    return (
      <View style={[styles.warningBanner, { backgroundColor: "#FF950018", borderColor: "#FF950040" }]}>
        <Feather name="alert-triangle" size={18} color="#FF9500" />
        <Text style={[styles.warningText, { color: "#FF9500" }]}>
          Your payment is past due. Update your billing to restore publishing access.
        </Text>
      </View>
    );
  };

  const renderNoSubscriptionBanner = () => {
    if (isActive) return null;
    return (
      <View style={[styles.warningBanner, { backgroundColor: `${theme.error}18`, borderColor: `${theme.error}40` }]}>
        <Feather name="lock" size={18} color={theme.error} />
        <Text style={[styles.warningText, { color: theme.error }]}>
          Publishing products and services requires an active subscription. Choose a plan below.
        </Text>
      </View>
    );
  };

  const renderSubscribeError = () => {
    if (!subscribeError) return null;

    if (subscribeError === "monetization") {
      return (
        <View style={[styles.errorBanner, { backgroundColor: "#7c3aed18", borderColor: "#7c3aed50" }]}>
          <Feather name="alert-circle" size={18} color="#7c3aed" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.errorBannerTitle, { color: "#7c3aed" }]}>
              Monetization Not Yet Enabled
            </Text>
            <Text style={[styles.errorBannerBody, { color: theme.textSecondary }]}>
              Your account has been approved but monetization has not been activated yet. This is typically enabled by the Outsyde team after your storefront is reviewed.
            </Text>
            <Text style={[styles.errorBannerBody, { color: theme.textSecondary, marginTop: 6 }]}>
              Please contact support at{" "}
              <Text
                style={{ color: "#7c3aed", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("mailto:support@outsyde.com")}
              >
                support@outsyde.com
              </Text>{" "}
              to enable monetization for your account.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.errorBanner, { backgroundColor: `${theme.error}18`, borderColor: `${theme.error}40` }]}>
        <Feather name="alert-circle" size={18} color={theme.error} />
        <Text style={[styles.errorBannerBody, { color: theme.error, marginLeft: 10, flex: 1 }]}>
          {subscribeError}
        </Text>
      </View>
    );
  };

  const renderTierCard = (tier: SubscriptionTier) => {
    const isSelected = selectedTierId === tier.id;
    const isPopular = tier.badge === "Most Popular";
    const isBestValue = tier.badge === "Best Value";
    return (
      <Pressable
        key={tier.id}
        style={[
          styles.tierCard,
          { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: theme.card },
          isSelected && { backgroundColor: theme.primary + "10" },
        ]}
        onPress={() => {
          if (!isActive) {
            setSelectedTierId(tier.id);
            setSubscribeError(null);
          }
        }}
        disabled={isActive}
      >
        {tier.badge ? (
          <View style={[
            styles.tierBadge,
            { backgroundColor: isPopular ? theme.primary : (isBestValue ? "#7c3aed" : theme.primary) },
          ]}>
            <Text style={styles.tierBadgeText}>{tier.badge}</Text>
          </View>
        ) : null}
        <View style={styles.tierHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tierName, { color: theme.text }]}>{tier.name}</Text>
            <Text style={[styles.tierPrice, { color: theme.primary }]}>{formatTierPrice(tier)}</Text>
          </View>
          {isSelected ? (
            <Feather name="check-circle" size={22} color={theme.primary} />
          ) : isActive && currentTierName?.toLowerCase() === tier.name.toLowerCase() ? (
            <View style={[styles.currentBadge, { backgroundColor: "#22c55e20" }]}>
              <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>Current</Text>
            </View>
          ) : null}
        </View>
        {tier.description ? (
          <Text style={[styles.tierDesc, { color: theme.textSecondary }]}>{tier.description}</Text>
        ) : null}
        {(tier.features || []).map((f, i) => (
          <View key={i} style={styles.tierFeatureRow}>
            <Feather name="check" size={13} color="#22c55e" />
            <Text style={[styles.tierFeatureText, { color: theme.textSecondary }]}>{f}</Text>
          </View>
        ))}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.text }]}>Subscription Plan</Text>
        <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
          Choose a plan to publish your products and services. You can upgrade or change plans at any time.
        </Text>

        {renderCurrentPlanBanner()}
        {renderPastDueBanner()}
        {renderNoSubscriptionBanner()}

        <View style={styles.tiersContainer}>
          {tiersLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
          ) : (
            tiers.map(renderTierCard)
          )}
        </View>

        {renderSubscribeError()}

        {!isActive && !tiersLoading ? (
          <Pressable
            style={[
              styles.subscribeBtn,
              { backgroundColor: selectedTierId ? theme.primary : theme.border },
            ]}
            onPress={handleSubscribe}
            disabled={!selectedTierId || actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="zap" size={18} color={selectedTierId ? "#000" : theme.textSecondary} />
                <Text style={[styles.subscribeBtnText, { color: selectedTierId ? "#000" : theme.textSecondary }]}>
                  {selectedTierId ? "Subscribe Now" : "Select a Plan"}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {isActive ? (
          <View style={styles.manageSection}>
            <Pressable
              style={[styles.manageBillingBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <>
                  <Feather name="credit-card" size={18} color={theme.primary} />
                  <Text style={[styles.manageBillingBtnText, { color: theme.primary }]}>
                    Manage Billing
                  </Text>
                  <Feather name="external-link" size={14} color={theme.primary} />
                </>
              )}
            </Pressable>
            <Text style={[styles.manageHint, { color: theme.textSecondary }]}>
              Update payment method, download invoices, or cancel your plan.
            </Text>
          </View>
        ) : null}

        {refreshing ? (
          <View style={styles.refreshRow}>
            <ActivityIndicator size="small" color={theme.textSecondary} />
            <Text style={[styles.refreshText, { color: theme.textSecondary }]}>Checking status...</Text>
          </View>
        ) : (
          <Pressable style={styles.refreshRow} onPress={handleRefresh}>
            <Feather name="refresh-cw" size={14} color={theme.textSecondary} />
            <Text style={[styles.refreshText, { color: theme.textSecondary }]}>Refresh status</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  currentPlanBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  currentPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  currentPlanTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  currentPlanStatus: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorBannerBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  tiersContainer: {
    gap: 14,
    marginBottom: 20,
  },
  tierCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 18,
    position: "relative",
    overflow: "hidden",
  },
  tierBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tierName: {
    fontSize: 19,
    fontWeight: "800",
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tierDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tierFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  tierFeatureText: {
    fontSize: 13,
    flex: 1,
  },
  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  subscribeBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
  manageSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  manageBillingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  manageBillingBtnText: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  manageHint: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  refreshText: {
    fontSize: 13,
  },
});

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
import api, { CurrentSubscription, SubscriptionTier, VendorEligibility } from "@/services/api";
import TierCardList from "@/components/TierCardList";

const STRIPE_RETURN_URL = "outsyde://stripe-return";

const FALLBACK_TIERS: SubscriptionTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 2999,
    priceLabel: "$29.99/mo",
    description: "Perfect for new businesses ready to start selling.",
    features: [
      "Product & service listings",
      "Basic analytics",
      "Customer messaging",
      "Standard discovery",
    ],
    interval: "mo",
    badge: "",
  },
  {
    id: "growth",
    name: "Growth",
    price: 5999,
    priceLabel: "$59.99/mo",
    description: "For businesses ready to grow with real tools.",
    features: [
      "Everything in Starter",
      "Advanced analytics",
      "1 complimentary Unranked influencer per month",
      "Shoot credits (1 credit/month)",
    ],
    interval: "mo",
    badge: "Most Popular",
  },
  {
    id: "pro",
    name: "Pro",
    price: 9999,
    priceLabel: "$99.99/mo",
    description: "For established businesses that want maximum impact.",
    features: [
      "Everything in Growth",
      "1 Silver or 2 Bronze tier influencers per month",
      "Shoot credits (2 credits/month)",
      "Authority badge",
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
  const [tiersFetchError, setTiersFetchError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasSubscribingRef = useRef(false);
  const prevSubscriptionRef = useRef<CurrentSubscription | null>(null);

  const isMonetizationError = (err: any): boolean =>
    err?.body?.error === "Monetization not enabled" ||
    (typeof err?.message === "string" &&
      err.message.toLowerCase().includes("monetization"));

  const isActive = eligibility
    ? eligibility.canPublishProducts || eligibility.canPublishServices
    : subscriptionStatus === "active";

  const fetchData = useCallback(async () => {
    setTiersFetchError(null);
    const token = await getToken();
    if (!token) {
      console.warn("[SubscriptionPlan] No auth token — cannot fetch subscription data");
      setTiers(FALLBACK_TIERS);
      setTiersLoading(false);
      return;
    }
    try {
      const [tiersRes, eligibilityRes, bizRes, currentSubRes] = await Promise.allSettled([
        api.getSubscriptionTiers(token),
        api.getVendorEligibility(token),
        api.getVendorMyBusiness(token),
        api.getCurrentSubscription(token),
      ]);

      if (tiersRes.status === "fulfilled") {
        const fetchedTiers = tiersRes.value.tiers;
        if (fetchedTiers?.length > 0) {
          console.log("[SubscriptionPlan] Tiers loaded from backend:", fetchedTiers.length, "tiers");
          setTiers(fetchedTiers);
        } else {
          console.warn("[SubscriptionPlan] Backend returned empty tiers array — using fallback");
          setTiers(FALLBACK_TIERS);
        }
      } else {
        const err = tiersRes.reason as any;
        const status = err?.status ?? "network/timeout";
        const msg = err?.message ?? String(err);
        console.error(`[SubscriptionPlan] GET /api/subscription-tiers FAILED — status: ${status} — ${msg}`);
        setTiersFetchError(`${status}: ${msg}`);
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

      // Subscription success detection: if we were in a subscribe flow and the
      // subscription tier changed (or appeared for the first time), show success.
      if (currentSubRes.status === "fulfilled") {
        const newSub = currentSubRes.value.subscription;
        const prev = prevSubscriptionRef.current;
        if (wasSubscribingRef.current && newSub) {
          if (!prev || prev.tierId !== newSub.tierId) {
            setSubscribeSuccess(true);
          }
        }
        prevSubscriptionRef.current = newSub;
        setCurrentSubscription(newSub);
        wasSubscribingRef.current = false;
      } else {
        console.warn("[SubscriptionPlan] GET /api/subscription/current failed:", currentSubRes.reason);
      }
    } catch (err) {
      console.error("[SubscriptionPlan] Unexpected error in fetchData:", err);
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

  const toErrorString = (err: any): string => {
    if (!err) return "An error occurred. Please try again.";
    if (typeof err === "string") return err;
    const msg = err?.message;
    if (typeof msg === "string") return msg;
    if (typeof msg === "object" && msg !== null) {
      return msg.message || msg.error || msg.detail || JSON.stringify(msg);
    }
    return err?.error || "An error occurred. Please try again.";
  };

  const handleSubscribe = async () => {
    if (!selectedTierId) {
      Alert.alert("Select a Plan", "Please select a subscription plan to continue.");
      return;
    }
    const selectedTier = tiers.find(t => t.id === selectedTierId);
    if (!selectedTier) {
      setSubscribeError("Selected plan not found. Please refresh and try again.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setSubscribeError(null);
    setActionLoading(true);
    wasSubscribingRef.current = true;
    try {
      const response = await api.createTierSubscriptionCheckout(token, selectedTier.id, STRIPE_RETURN_URL);
      if (response.url) {
        await Linking.openURL(response.url);
      } else {
        setSubscribeError("Payment setup failed. Please try again.");
      }
    } catch (err: any) {
      wasSubscribingRef.current = false;
      if (isMonetizationError(err)) {
        setSubscribeError("monetization");
      } else {
        setSubscribeError(toErrorString(err));
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

    const errText = typeof subscribeError === "string"
      ? subscribeError
      : (subscribeError as any)?.message || JSON.stringify(subscribeError);
    return (
      <View style={[styles.errorBanner, { backgroundColor: `${theme.error}18`, borderColor: `${theme.error}40` }]}>
        <Feather name="alert-circle" size={18} color={theme.error} />
        <Text style={[styles.errorBannerBody, { color: theme.error, marginLeft: 10, flex: 1 }]}>
          {errText}
        </Text>
      </View>
    );
  };

  if (subscribeSuccess && currentSubscription) {
    const displayName = currentSubscription.tierDisplayName || currentSubscription.tierName;
    return (
      <View style={[styles.container, styles.successContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.successCard, { backgroundColor: theme.card, borderColor: "#22c55e40" }]}>
          <Feather name="check-circle" size={72} color="#22c55e" />
          <Text style={[styles.successTitle, { color: theme.text }]}>You're All Set!</Text>
          <Text style={[styles.successSubtitle, { color: theme.primary }]}>
            {displayName} subscription is now active.
          </Text>
          <Text style={[styles.successDescription, { color: theme.textSecondary }]}>
            You can now publish products and services on Outsyde.
          </Text>
          <Pressable
            style={[styles.successBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSubscribeSuccess(false);
              navigation.goBack();
            }}
          >
            <Text style={styles.successBtnText}>Go to Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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

        {tiersLoading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
        ) : (
          <TierCardList
            tiers={tiers}
            selectedTierId={selectedTierId}
            onSelectTier={(tierId) => {
              setSelectedTierId(tierId);
              setSubscribeError(null);
            }}
            currentSubscriptionTierId={currentSubscription?.tierId}
          />
        )}

        {__DEV__ && tiersFetchError ? (
          <View style={[styles.errorBanner, { backgroundColor: "#3a1a00", borderColor: "#c0391b" }]}>
            <Feather name="alert-circle" size={14} color="#e74c3c" />
            <Text style={[styles.errorBannerBody, { color: "#e74c3c", fontSize: 11, marginLeft: 6 }]}>
              [DEV] GET /api/subscription-tiers failed: {tiersFetchError}
            </Text>
          </View>
        ) : null}

        {renderSubscribeError()}

        {!tiersLoading ? (() => {
          const isSwitching = !!currentSubscription && !!selectedTierId && currentSubscription.tierId !== selectedTierId;
          const isCurrentSelected = !!currentSubscription && currentSubscription.tierId === selectedTierId;
          const canSubmit = !!selectedTierId && !isCurrentSelected;
          const btnLabel = isSwitching
            ? "Switch Plan"
            : selectedTierId ? "Subscribe Now" : "Select a Plan";
          return (
            <View>
              {isSwitching ? (
                <Text style={[styles.switchWarning, { color: "#f59e0b" }]}>
                  This will cancel your current {currentSubscription!.tierDisplayName || currentSubscription!.tierName} plan
                </Text>
              ) : null}
              <Pressable
                style={[
                  styles.subscribeBtn,
                  { backgroundColor: canSubmit ? theme.primary : theme.border },
                ]}
                onPress={handleSubscribe}
                disabled={!canSubmit || actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Feather name="zap" size={18} color={canSubmit ? "#000" : theme.textSecondary} />
                    <Text style={[styles.subscribeBtnText, { color: canSubmit ? "#000" : theme.textSecondary }]}>
                      {btnLabel}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          );
        })() : null}

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
  switchWarning: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "500",
  },
  successContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 32,
    alignItems: "center",
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  successDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
  },
  successBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  successBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
});

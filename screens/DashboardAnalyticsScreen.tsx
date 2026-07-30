import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";
import api, { API_BASE_URL } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

const COLORS = {
  black: "#000000",
  gold: "#C9933A",
  cream: "#F5F0E6",
  surface: "#111111",
  surfaceAlt: "#1A1A1A",
  locked: "#2A2A2A",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
  emerald: "#1A3C34",
};

type TierName = "starter" | "growth" | "pro";

interface SubscriptionFeatures {
  tier: {
    name: TierName;
    display_name: string;
    price_in_cents: number;
    max_staff: number | null;
  };
  features: string[];
  benefits: {
    benefit_type: string;
    benefit_name: string;
    description: string;
    is_unlimited: boolean;
    included_quantity: number | null;
  }[];
}

type BusinessStats = {
  orderCount: number;
  bookingCount: number;
  monthlyRevenueCents: number;
  reviewCount: number;
  averageRating: number;
};

interface DailyDay {
  date: string;
  label: string;
  revenue_cents: number;
  order_count: number;
  booking_count: number;
}

interface AudienceData {
  total_customers: number;
  gender: Record<string, number>;
  age_ranges: Record<string, number>;
  shopping_frequency: Record<string, number>;
  top_industries: string[];
  top_locations: {
    city: string;
    state: string | null;
    zip_code: string | null;
    customer_count: number;
  }[];
}

interface PhotographerMatch {
  photographer_id: string;
  name: string;
  username: string | null;
  profile_image_url: string | null;
  specialty: string | null;
  rating: number;
  review_count: number;
  match_percent: number;
}

const TIER_ORDER: Record<TierName, number> = { starter: 0, growth: 1, pro: 2 };
const isUnlocked = (current: TierName, required: TierName): boolean =>
  TIER_ORDER[current] >= TIER_ORDER[required];

function LockedCard({
  title,
  upgradeLabel,
  onUpgrade,
}: {
  title: string;
  upgradeLabel: string;
  onUpgrade: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: "#2A2A2A",
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: "rgba(201,147,58,0.3)",
        alignItems: "center",
      }}
    >
      <Feather name="lock" size={24} color={COLORS.gold} />
      <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: "bold", marginTop: 12 }}>
        {title}
      </Text>
      <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 6 }}>
        Available on {upgradeLabel}
      </Text>
      <Pressable
        style={{
          backgroundColor: COLORS.gold,
          borderRadius: 8,
          paddingHorizontal: 20,
          paddingVertical: 10,
          marginTop: 16,
        }}
        onPress={onUpgrade}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Upgrade Plan</Text>
      </Pressable>
    </View>
  );
}

function BarChart({
  data,
  labels,
  color,
}: {
  data: number[];
  labels: string[];
  color: string;
}) {
  const maxValue = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 4 }}>
      {data.map((value, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center" }}>
          <View
            style={{
              backgroundColor: color,
              borderRadius: 4,
              width: "80%",
              height: Math.max(16, (value / maxValue) * 100),
            }}
          />
          <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 4, textAlign: "center" }}>
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function DashboardAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken } = useAuth();

  const [subscription, setSubscription] = useState<SubscriptionFeatures | null>(null);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyDay[] | null>(null);
  const [audienceData, setAudienceData] = useState<AudienceData | null>(null);
  const [matchData, setMatchData] = useState<PhotographerMatch[] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No token");
      const [subRes, statsResult, dailyRes, audienceRes, matchRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/vendor/subscription/features`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.getBusinessStats(token),
        fetch(`${API_BASE_URL}/api/vendor/analytics/daily`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/vendor/analytics/audience`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/vendor/analytics/photographer-match`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!subRes.ok) throw new Error("subscription fetch failed");
      const subData: SubscriptionFeatures = await subRes.json();
      setSubscription(subData);
      setStats(statsResult.stats);
      if (dailyRes.ok) {
        const d = await dailyRes.json();
        setDailyData(d.days ?? []);
      }
      if (audienceRes.ok) {
        const a = await audienceRes.json();
        setAudienceData(a);
      }
      if (matchRes.ok) {
        const m = await matchRes.json();
        setMatchData(m.matches ?? []);
      }
    } catch (_err) {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(fetchData);

  const tier: TierName = subscription?.tier.name ?? "starter";

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: COLORS.black }]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: COLORS.black }]}>
        <Text style={{ color: COLORS.textMuted, marginBottom: 16 }}>{error}</Text>
        <Pressable onPress={fetchData}>
          <Text style={{ color: COLORS.gold }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }


  const tips = [
    "Post on weekends — your audience is 40% more active Sat–Sun",
    "Add 3+ product photos to increase conversion by 2×",
    "Vendors with Authority Badge see 28% more profile visits",
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.black }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: COLORS.black,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 20,
            fontWeight: "bold",
            color: COLORS.textPrimary,
          }}
        >
          Analytics
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.gold,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: COLORS.gold, fontSize: 12, fontWeight: "600" }}>
            {subscription?.tier.display_name ?? "—"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* 1. OVERVIEW */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OVERVIEW</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <View style={[styles.statCard, { flexBasis: "48%" }]}>
                <Text style={styles.statValue}>
                  ${((stats?.monthlyRevenueCents ?? 0) / 100).toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
              <View style={[styles.statCard, { flexBasis: "48%" }]}>
                <Text style={styles.statValue}>{stats?.orderCount ?? 0}</Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
              <View style={[styles.statCard, { flexBasis: "48%" }]}>
                <Text style={styles.statValue}>{stats?.bookingCount ?? 0}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={[styles.statCard, { flexBasis: "48%" }]}>
                <Text style={styles.statValue}>
                  {stats?.averageRating != null ? `${stats.averageRating.toFixed(1)} ★` : "— ★"}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </View>

          {/* 2. PERFORMANCE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PERFORMANCE</Text>
            {isUnlocked(tier, "growth") ? (
              <>
                <Text
                  style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: "bold", marginBottom: 12 }}
                >
                  Revenue Trend
                </Text>
                <BarChart
                  data={(dailyData ?? []).map((d: DailyDay) => d.revenue_cents)}
                  labels={(dailyData ?? []).map((d: DailyDay) => d.label)}
                  color={COLORS.gold}
                />
                <Text
                  style={{ color: COLORS.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 8 }}
                >
                  Last 7 days · revenue (cents)
                </Text>
              </>
            ) : (
              <LockedCard
                title="Charts & Trends"
                upgradeLabel="Growth Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 3. YOUR AUDIENCE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR AUDIENCE</Text>
            {isUnlocked(tier, "growth") ? (
              <>
                <Text
                  style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: "bold", marginBottom: 14 }}
                >
                  Age Breakdown
                </Text>
                {(() => {
                  const ageRanges: Record<string, number> = audienceData?.age_ranges ?? {};
                  const total = Object.values(ageRanges).reduce((s: number, v: number) => s + v, 0) || 1;
                  return Object.entries(ageRanges)
                    .filter(([key]) => key !== "unknown")
                    .map(([label, count]: [string, number]) => {
                      const pct = Math.round((count / total) * 100);
                      return (
                        <View
                          key={label}
                          style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
                        >
                          <Text style={{ width: 44, fontSize: 12, color: COLORS.textMuted }}>{label}</Text>
                          <View
                            style={{
                              flex: 1,
                              height: 8,
                              backgroundColor: COLORS.surfaceAlt,
                              borderRadius: 4,
                              marginHorizontal: 10,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                backgroundColor: COLORS.gold,
                                borderRadius: 4,
                              }}
                            />
                          </View>
                          <Text
                            style={{ width: 32, fontSize: 12, color: COLORS.textMuted, textAlign: "right" }}
                          >
                            {pct}%
                          </Text>
                        </View>
                      );
                    });
                })()}
                <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 8 }}>
                  Based on customer activity · updates as data grows
                </Text>
              </>
            ) : (
              <LockedCard
                title="Audience Demographics"
                upgradeLabel="Growth Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 4. PHOTOGRAPHER MATCH */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PHOTOGRAPHER MATCH</Text>
            {isUnlocked(tier, "growth") ? (
              <>
                {(matchData ?? []).map((p: PhotographerMatch) => {
                  const initials = p.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <View
                      key={p.photographer_id}
                      style={{
                        backgroundColor: COLORS.surfaceAlt,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: COLORS.emerald,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 14, color: COLORS.gold, fontWeight: "700" }}>
                          {initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: "bold" }}>
                          {p.name}
                        </Text>
                        <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
                          {p.specialty ?? "Photographer"}{p.rating ? ` · ★ ${p.rating.toFixed(1)}` : ""}
                        </Text>
                      </View>
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: COLORS.gold,
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ color: COLORS.gold, fontSize: 11 }}>{p.match_percent}% match</Text>
                      </View>
                    </View>
                  );
                })}
                <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>
                  Live matches based on audience overlap · coming soon
                </Text>
              </>
            ) : (
              <LockedCard
                title="Influencer Match"
                upgradeLabel="Growth Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* CUSTOMER LOCATIONS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CUSTOMER LOCATIONS</Text>
            {isUnlocked(tier, "pro") ? (
              <View>
                <Text
                  style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: "bold", marginBottom: 14 }}
                >
                  Where Your Customers Are
                </Text>
                {audienceData?.top_locations && audienceData.top_locations.length > 0 ? (
                  <>
                    {audienceData.top_locations.map((loc: { city: string; state: string | null; zip_code: string | null; customer_count: number }, i: number) => {
                      const maxCount = audienceData.top_locations[0].customer_count;
                      const pct = Math.round((loc.customer_count / maxCount) * 100);
                      return (
                        <View key={i} style={{ marginBottom: 12 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <Text style={{ color: COLORS.textPrimary, fontSize: 13 }}>
                              {loc.city}
                              {loc.state ? `, ${loc.state}` : ""}
                              {loc.zip_code ? ` ${loc.zip_code}` : ""}
                            </Text>
                            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                              {loc.customer_count} customer{loc.customer_count !== 1 ? "s" : ""}
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 8,
                              backgroundColor: COLORS.surfaceAlt,
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                backgroundColor: COLORS.gold,
                                borderRadius: 4,
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                    <Text
                      style={{ color: COLORS.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 8 }}
                    >
                      Based on customer billing addresses
                    </Text>
                  </>
                ) : (
                  <View style={{ backgroundColor: COLORS.surfaceAlt, borderRadius: 12, padding: 14 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
                      No location data yet — builds as customers order
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <LockedCard
                title="Customer Locations"
                upgradeLabel="Pro Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 5. MARKETING INTELLIGENCE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MARKETING INTELLIGENCE</Text>
            {isUnlocked(tier, "pro") ? (
              <>
                {tips.map((tip, i) => (
                  <View key={i} style={styles.tipCard}>
                    <Feather name="zap" size={14} color={COLORS.gold} style={{ marginRight: 10 }} />
                    <Text style={{ color: COLORS.cream, fontSize: 13, flex: 1 }}>{tip}</Text>
                  </View>
                ))}
              </>
            ) : (
              <LockedCard
                title="Marketing Tips"
                upgradeLabel="Pro Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 6. AUTHORITY */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AUTHORITY</Text>
            {isUnlocked(tier, "pro") ? (
              <View
                style={{
                  backgroundColor: "rgba(201,147,58,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(201,147,58,0.4)",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Feather name="award" size={28} color={COLORS.gold} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: "bold" }}>
                    Authority Badge
                  </Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 3 }}>
                    Verified on your storefront
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: "#1A3C34",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: "#4CAF50", fontSize: 12, fontWeight: "600" }}>Active</Text>
                </View>
              </View>
            ) : (
              <LockedCard
                title="Authority Badge"
                upgradeLabel="Pro Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: COLORS.gold,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 14,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  tipCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    flexDirection: "row",
    alignItems: "center",
  },
});

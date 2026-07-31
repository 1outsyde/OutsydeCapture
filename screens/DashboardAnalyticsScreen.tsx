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

interface BookingHealth {
  conversion_rate: number;
  cancellation_rate: number;
  calendar_utilization: number;
  booked_count: number;
  available_hours: number;
}

interface RevenueByService {
  service: string;
  booking_count: number;
  revenue_cents: number;
}

interface PeakTimesData {
  heatmap: { day_of_week: number; time_slot: string; booking_count: number }[];
  busiest_day: string | null;
  busiest_window: string | null;
  most_open_day: string | null;
}

interface ForecastData {
  forecast_low: number;
  forecast_high: number;
  projected_month: number;
  confidence: string;
  historical: { month: string; revenue_cents: number }[];
  mtd_cents: number;
}

interface YoyMonth {
  month: string;
  label: string;
  revenue_cents: number;
  yoy_revenue_cents: number | null;
  yoy_delta: number | null;
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
  const [bookingHealth, setBookingHealth] = useState<BookingHealth | null>(null);
  const [revenueByService, setRevenueByService] = useState<RevenueByService[] | null>(null);
  const [peakTimes, setPeakTimes] = useState<PeakTimesData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [yoy, setYoy] = useState<YoyMonth[] | null>(null);
  const [performancePeriod, setPerformancePeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [weeklyData, setWeeklyData] = useState<DailyDay[] | null>(null);
  const [monthlyData, setMonthlyData] = useState<DailyDay[] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No token");
      const h = { headers: { Authorization: `Bearer ${token}` } };
      const [subRes, statsResult, dailyRes, audienceRes, matchRes, healthRes, svcRes, peakRes, forecastRes, yoyRes, weeklyRes, monthlyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/vendor/subscription/features`, h),
        api.getBusinessStats(token),
        fetch(`${API_BASE_URL}/api/vendor/analytics/daily`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/audience`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/photographer-match`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/booking-health`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/revenue-by-service`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/peak-times`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/revenue-forecast`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/year-over-year`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/weekly`, h),
        fetch(`${API_BASE_URL}/api/vendor/analytics/monthly`, h),
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
      if (healthRes.ok) {
        setBookingHealth(await healthRes.json());
      }
      if (svcRes.ok) {
        const s = await svcRes.json();
        setRevenueByService(s.services ?? []);
      }
      if (peakRes.ok) {
        setPeakTimes(await peakRes.json());
      }
      if (forecastRes.ok) {
        setForecast(await forecastRes.json());
      }
      if (yoyRes.ok) {
        const y = await yoyRes.json();
        setYoy(y.months ?? []);
      }
      if (weeklyRes.ok) { const w = await weeklyRes.json(); setWeeklyData(w.days ?? []); }
      if (monthlyRes.ok) { const mo = await monthlyRes.json(); setMonthlyData(mo.days ?? []); }
    } catch (_err) {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

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
          {/* 1. AUTHORITY */}
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

          {/* 2. OVERVIEW */}
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
            <Text style={styles.sectionLabel}>PERFORMANCE <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: '400', letterSpacing: 0 }}>Growth</Text></Text>
            {isUnlocked(tier, 'growth') ? (
              <View style={styles.statCard}>
                {/* Revenue value + delta row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View>
                    <Text style={[styles.statValue, { fontSize: 28 }]}>
                      {performancePeriod === 'daily'
                        ? `$${(((dailyData ?? []).slice(-1)[0]?.revenue_cents ?? 0) / 100).toFixed(0)}`
                        : performancePeriod === 'weekly'
                        ? `$${((weeklyData ?? []).reduce((s: number, d: DailyDay) => s + d.revenue_cents, 0) / 100).toFixed(0)}`
                        : `$${((monthlyData ?? []).slice(-1)[0]?.revenue_cents ?? 0 / 100).toFixed(0)}`}
                    </Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 }}>
                      {performancePeriod === 'daily' ? "TODAY'S REVENUE" : performancePeriod === 'weekly' ? "THIS WEEK'S REVENUE" : "MONTHLY REVENUE"}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(52,199,89,0.14)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: '#34C759', fontSize: 12, fontWeight: '700' }}>▲ 18%</Text>
                  </View>
                </View>

                {/* Toggle pills */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                  {(['daily', 'weekly', 'monthly'] as const).map(p => (
                    <Pressable
                      key={p}
                      onPress={() => setPerformancePeriod(p)}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16,
                        borderWidth: 1,
                        borderColor: performancePeriod === p ? COLORS.gold : 'transparent',
                        backgroundColor: performancePeriod === p ? 'rgba(201,147,58,0.12)' : 'transparent',
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: '700',
                        color: performancePeriod === p ? COLORS.gold : COLORS.textMuted,
                        textTransform: 'capitalize'
                      }}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Bar chart */}
                <BarChart
                  data={
                    performancePeriod === 'daily'
                      ? (dailyData ?? []).map((d: DailyDay) => d.revenue_cents)
                      : performancePeriod === 'weekly'
                      ? (weeklyData ?? []).map((d: DailyDay) => d.revenue_cents)
                      : (monthlyData ?? []).map((d: DailyDay) => d.revenue_cents)
                  }
                  labels={
                    performancePeriod === 'daily'
                      ? (dailyData ?? []).map((d: DailyDay) => d.label)
                      : performancePeriod === 'weekly'
                      ? (weeklyData ?? []).map((d: DailyDay) => d.label)
                      : (monthlyData ?? []).map((d: DailyDay) => d.label)
                  }
                  color={COLORS.gold}
                />
                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 8, textAlign: 'center' }}>
                  {performancePeriod === 'daily' ? 'Today vs. yesterday' : performancePeriod === 'weekly' ? 'This week vs. last week' : 'This month vs. last month'}
                </Text>
              </View>
            ) : (
              <LockedCard title="Charts & Trends" upgradeLabel="Growth Plan" onUpgrade={() => navigation.navigate('SubscriptionPlan')} />
            )}
          </View>

          {/* 3. BOOKING HEALTH */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BOOKING HEALTH</Text>
            {isUnlocked(tier, "growth") ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={[styles.statCard, { flexBasis: "48%", borderLeftWidth: 3, borderLeftColor: "#4CAF50" }]}>
                  <Text style={styles.statValue}>{bookingHealth?.conversion_rate ?? 0}%</Text>
                  <Text style={styles.statLabel}>Conversion Rate</Text>
                </View>
                <View style={[styles.statCard, { flexBasis: "48%", borderLeftWidth: 3, borderLeftColor: "#FF5252" }]}>
                  <Text style={styles.statValue}>{bookingHealth?.cancellation_rate ?? 0}%</Text>
                  <Text style={styles.statLabel}>Cancellation Rate</Text>
                </View>
                <View style={[styles.statCard, { flex: 1, borderLeftWidth: 3, borderLeftColor: COLORS.gold }]}>
                  <Text style={styles.statValue}>{bookingHealth?.calendar_utilization ?? 0}%</Text>
                  <Text style={styles.statLabel}>Calendar Utilization This Week</Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>
                    {bookingHealth?.booked_count ?? 0} booked · {bookingHealth?.available_hours ?? 0}h available
                  </Text>
                </View>
              </View>
            ) : (
              <LockedCard
                title="Booking Health Metrics"
                upgradeLabel="Growth Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 4. YOUR AUDIENCE */}
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

          {/* 7. REVENUE BY SERVICE */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REVENUE BY SERVICE</Text>
            {isUnlocked(tier, "growth") ? (
              <>
                <Text style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: "bold", marginBottom: 14 }}>
                  This Month
                </Text>
                {(revenueByService ?? []).length === 0 ? (
                  <View style={{ backgroundColor: COLORS.surfaceAlt, borderRadius: 12, padding: 14 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>No service revenue this month yet</Text>
                  </View>
                ) : (
                  (revenueByService ?? []).map((svc: RevenueByService, i: number) => {
                    const maxCents = revenueByService![0].revenue_cents || 1;
                    const pct = Math.round((svc.revenue_cents / maxCents) * 100);
                    return (
                      <View key={i} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ color: COLORS.textPrimary, fontSize: 13, flex: 1 }} numberOfLines={1}>
                            {svc.service}
                          </Text>
                          <Text style={{ color: COLORS.gold, fontSize: 13, fontWeight: "bold" }}>
                            ${(svc.revenue_cents / 100).toFixed(0)}
                          </Text>
                        </View>
                        <View
                          style={{ height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: "hidden" }}
                        >
                          <View
                            style={{ width: `${pct}%`, height: "100%", backgroundColor: COLORS.gold, borderRadius: 3 }}
                          />
                        </View>
                        <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                          {svc.booking_count} booking{svc.booking_count !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              <LockedCard
                title="Revenue by Service"
                upgradeLabel="Growth Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 8. PEAK BOOKING TIMES */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PEAK BOOKING TIMES</Text>
            {isUnlocked(tier, "pro") ? (
              peakTimes && peakTimes.heatmap.length > 0 ? (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "Busiest Day", value: peakTimes.busiest_day ?? "—" },
                      {
                        label: "Busiest Window",
                        value: peakTimes.busiest_window
                          ? peakTimes.busiest_window.charAt(0).toUpperCase() + peakTimes.busiest_window.slice(1)
                          : "—",
                      },
                      { label: "Most Open Day", value: peakTimes.most_open_day ?? "—" },
                    ].map((item) => (
                      <View key={item.label} style={[styles.statCard, { flexBasis: "31%" }]}>
                        <Text style={[styles.statValue, { fontSize: 16 }]}>{item.value}</Text>
                        <Text style={styles.statLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 8 }}>
                    Booking activity by day & time (last 90 days)
                  </Text>
                  {["morning", "afternoon", "evening", "night"].map((slot) => {
                    const maxCount = Math.max(...peakTimes.heatmap.map((h: { day_of_week: number; time_slot: string; booking_count: number }) => h.booking_count), 1);
                    return (
                      <View key={slot} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ color: COLORS.textMuted, fontSize: 10, width: 62 }}>
                          {slot.charAt(0).toUpperCase() + slot.slice(1)}
                        </Text>
                        {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                          const cell = peakTimes.heatmap.find(
                            (hm: { day_of_week: number; time_slot: string; booking_count: number }) =>
                              hm.day_of_week === dow && hm.time_slot === slot
                          );
                          const count = cell?.booking_count ?? 0;
                          const opacity = 0.1 + (count / maxCount) * 0.9;
                          return (
                            <View
                              key={dow}
                              style={{
                                flex: 1,
                                height: 28,
                                backgroundColor: `rgba(201,147,58,${opacity.toFixed(2)})`,
                                borderRadius: 4,
                                marginHorizontal: 2,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {count > 0 && (
                                <Text style={{ fontSize: 9, color: "#FFF" }}>{count}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: "row", marginTop: 4 }}>
                    <View style={{ width: 62 }} />
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <Text
                        key={i}
                        style={{ flex: 1, textAlign: "center", color: COLORS.textMuted, fontSize: 10 }}
                      >
                        {d}
                      </Text>
                    ))}
                  </View>
                </>
              ) : (
                <View style={{ backgroundColor: COLORS.surfaceAlt, borderRadius: 12, padding: 14 }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>No booking data yet</Text>
                </View>
              )
            ) : (
              <LockedCard
                title="Peak Booking Times"
                upgradeLabel="Pro Plan"
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

          {/* 10. REVENUE FORECAST */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REVENUE FORECAST</Text>
            {isUnlocked(tier, "pro") ? (
              forecast ? (
                <>
                  <View
                    style={{
                      backgroundColor: COLORS.surfaceAlt,
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 4 }}>
                      Projected This Month
                    </Text>
                    <Text style={{ color: COLORS.textPrimary, fontSize: 28, fontWeight: "bold" }}>
                      ${(forecast.projected_month / 100).toFixed(0)}
                    </Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                      Range: ${(forecast.forecast_low / 100).toFixed(0)} – ${(forecast.forecast_high / 100).toFixed(0)}
                      {" · "}
                      {forecast.confidence} confidence
                    </Text>
                  </View>
                  {forecast.historical.length > 0 && (
                    <>
                      <Text
                        style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 10 }}
                      >
                        Recent History
                      </Text>
                      {forecast.historical.map((hm: { month: string; revenue_cents: number }) => (
                        <View
                          key={hm.month}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: COLORS.surfaceAlt,
                          }}
                        >
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{hm.month}</Text>
                          <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: "600" }}>
                            ${(hm.revenue_cents / 100).toFixed(0)}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <View style={{ backgroundColor: COLORS.surfaceAlt, borderRadius: 12, padding: 14 }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
                    Not enough data for forecast yet
                  </Text>
                </View>
              )
            ) : (
              <LockedCard
                title="Revenue Forecast"
                upgradeLabel="Pro Plan"
                onUpgrade={() => navigation.navigate("SubscriptionPlan")}
              />
            )}
          </View>

          {/* 11. YEAR-OVER-YEAR */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YEAR-OVER-YEAR</Text>
            {isUnlocked(tier, "pro") ? (
              <>
                {(yoy ?? []).length === 0 ? (
                  <View style={{ backgroundColor: COLORS.surfaceAlt, borderRadius: 12, padding: 14 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
                      No booking history for comparison yet
                    </Text>
                  </View>
                ) : (
                  (yoy ?? []).map((m: YoyMonth) => (
                    <View
                      key={m.month}
                      style={{
                        backgroundColor: COLORS.surfaceAlt,
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: "bold" }}>
                          {m.label}
                        </Text>
                        <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: "bold" }}>
                          ${(m.revenue_cents / 100).toFixed(0)}
                        </Text>
                      </View>
                      {m.yoy_delta !== null ? (
                        <Text
                          style={{
                            color: m.yoy_delta >= 0 ? "#4CAF50" : "#FF5252",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {m.yoy_delta >= 0 ? "+" : ""}
                          {m.yoy_delta}% vs same month last year (${((m.yoy_revenue_cents ?? 0) / 100).toFixed(0)})
                        </Text>
                      ) : (
                        <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                          No data from last year
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </>
            ) : (
              <LockedCard
                title="Year-over-Year Growth"
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

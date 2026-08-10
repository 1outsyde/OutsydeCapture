import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";
import { RootStackParamList } from "@/navigation/types";
import api, { InfluencerDashboard } from "@/services/api";

const DASHBOARD_COLORS = {
  background: "#080C08",
  surface: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  gold: "#E8B930",
  goldLight: "#E8B86D",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
};

type CollabDay = { date: string; brand: string; type: "Sponsored Post" | "Collab" };

const MOCK_COLLAB_DAYS: CollabDay[] = [
  { date: "2026-08-14", brand: "Sunset Studio", type: "Sponsored Post" },
  { date: "2026-08-19", brand: "Coastal Threads", type: "Collab" },
  { date: "2026-08-27", brand: "Glow Cosmetics", type: "Sponsored Post" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

// Matches the formatting used in StoryInsightsScreen.
function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 4 }}>
      <View style={{ width: 3, height: 11, backgroundColor: DASHBOARD_COLORS.gold, borderRadius: 2 }} />
      <Text style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: DASHBOARD_COLORS.creamDim, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}

export default function InfluencerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const [stats, setStats] = useState<InfluencerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ? String(user.id) : "";

  const loadStats = useCallback(
    async (isCancelled: () => boolean) => {
      if (!userId) {
        if (!isCancelled()) {
          setError("Sign in to see your stats.");
          setIsLoading(false);
        }
        return;
      }
      try {
        const data = await api.getInfluencerDashboard(userId);
        if (!isCancelled()) {
          setStats(data);
          setError(null);
        }
      } catch (err) {
        console.log("[InfluencerDashboard] failed to load stats:", err);
        if (!isCancelled()) setError("Couldn't load your stats.");
      } finally {
        if (!isCancelled()) {
          setIsLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId]
  );

  // Tracks unmount so the pull-to-refresh path — which runs outside the effect
  // and so has no cancelled flag of its own — doesn't set state after teardown.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadStats(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats(() => unmountedRef.current);
  }, [loadStats]);

  const collabsByDate = useMemo(() => {
    const map = new Map<string, CollabDay>();
    MOCK_COLLAB_DAYS.forEach((c) => map.set(c.date, c));
    return map;
  }, []);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [currentMonth, currentYear]);

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Main", { screen: "AccountTab", params: { screen: "Account" } } as any);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const collab = collabsByDate.get(dateStr);
    if (collab) {
      Alert.alert(collab.type, `${collab.brand} · ${MONTHS[currentMonth]} ${day}`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={DASHBOARD_COLORS.gold}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={DASHBOARD_COLORS.cream} />
        </Pressable>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{user?.username || "Influencer"}</Text>
          <Text style={styles.headerSubtitle}>Influencer Dashboard</Text>
        </View>
        <Pressable style={styles.referralBadge} onPress={() => navigation.navigate("InfluencerReferral")}>
          <Text style={styles.referralBadgeText}>Referral</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centeredBlock}>
          <ActivityIndicator color={DASHBOARD_COLORS.gold} />
        </View>
      ) : error ? (
        <View style={styles.centeredBlock}>
          <Feather name="wifi-off" size={22} color={DASHBOARD_COLORS.creamDim} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Stats 2×2 grid */}
          <View style={styles.statsRow}>
            <View style={styles.statsGridRow}>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Feather name="users" size={14} color={DASHBOARD_COLORS.gold} />
                </View>
                <Text style={styles.statValue}>{formatCompact(stats?.followers ?? 0)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Feather name="image" size={14} color={DASHBOARD_COLORS.gold} />
                </View>
                <Text style={styles.statValue}>
                  {formatCompact(stats?.totalPosts ?? 0)}
                  {stats?.postCountCapped ? "+" : ""}
                </Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>
            <View style={[styles.statsGridRow, { marginTop: 10 }]}>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Feather name="trending-up" size={14} color={DASHBOARD_COLORS.gold} />
                </View>
                <Text style={styles.statValue}>{(stats?.engagementRate ?? 0).toFixed(1)}%</Text>
                <Text style={styles.statLabel}>Engagement Rate</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Feather name="heart" size={14} color={DASHBOARD_COLORS.gold} />
                </View>
                <Text style={styles.statValue}>{formatCompact(stats?.totalLikes ?? 0)}</Text>
                <Text style={styles.statLabel}>Total Likes</Text>
              </View>
            </View>
          </View>

          {/* Recent activity feed */}
          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <SectionLabel text="RECENT ACTIVITY" />
            <View style={styles.activityCard}>
              {stats && stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((item, i) => (
                  <Pressable
                    key={item.postId}
                    style={[styles.activityRow, i > 0 ? styles.activityRowDivider : null]}
                    onPress={() =>
                      navigation.navigate("PostDetail", {
                        userId,
                        initialPostId: item.postId,
                      })
                    }
                  >
                    {item.thumbnailUrl ? (
                      <Image
                        source={{ uri: item.thumbnailUrl }}
                        style={styles.activityThumb}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.activityThumb, styles.activityThumbFallback]}>
                        <Feather
                          name={item.mediaType === "video" ? "video" : "image"}
                          size={16}
                          color={DASHBOARD_COLORS.creamDim}
                        />
                      </View>
                    )}
                    <View style={styles.activityTextWrap}>
                      <Text style={styles.activityCaption} numberOfLines={1}>
                        {item.caption || (item.mediaType === "video" ? "Video post" : "Photo post")}
                      </Text>
                      <View style={styles.activityMetaRow}>
                        <Feather name="heart" size={11} color={DASHBOARD_COLORS.gold} />
                        <Text style={styles.activityMetaText}>{formatCompact(item.likesCount)}</Text>
                        <Feather name="message-circle" size={11} color={DASHBOARD_COLORS.gold} />
                        <Text style={styles.activityMetaText}>
                          {formatCompact(item.commentsCount)}
                        </Text>
                        <Text style={styles.activityTime}>· {formatTimeAgo(item.createdAt)}</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={16} color={DASHBOARD_COLORS.creamDim} />
                  </Pressable>
                ))
              ) : (
                <View style={styles.activityEmpty}>
                  <Text style={styles.activityEmptyText}>
                    No posts yet. Your activity shows up here once you post.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}

      {/* Activity nav cards */}
      <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
        <SectionLabel text="MORE" />

        <Pressable style={styles.navCard} onPress={() => navigation.navigate("InfluencerAnalytics")}>
          <View style={styles.navCardLeft}>
            <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
              <Ionicons name="bar-chart-outline" size={20} color={DASHBOARD_COLORS.gold} />
            </View>
            <View style={styles.navCardTextWrap}>
              <Text style={styles.navCardTitle}>Analytics</Text>
              <Text style={styles.navCardSubtitle}>Track your growth & insights</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
        </Pressable>

        <Pressable style={styles.navCard} onPress={() => navigation.navigate("InfluencerReferral")}>
          <View style={styles.navCardLeft}>
            <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
              <Feather name="gift" size={20} color={DASHBOARD_COLORS.gold} />
            </View>
            <View style={styles.navCardTextWrap}>
              <Text style={styles.navCardTitle}>Referral Program</Text>
              <Text style={styles.navCardSubtitle}>Link, tier, and commission earned</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
        </Pressable>
      </View>

      {/* Calendar — collab & sponsor days */}
      <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
        <SectionLabel text="CALENDAR" />
        <View style={styles.calendarCard}>
          <View style={styles.calendarNavRow}>
            <Pressable onPress={handlePrevMonth} hitSlop={8}>
              <Feather name="chevron-left" size={20} color={DASHBOARD_COLORS.gold} />
            </Pressable>
            <Text style={styles.calendarMonthLabel}>
              {MONTHS[currentMonth]} {currentYear}
            </Text>
            <Pressable onPress={handleNextMonth} hitSlop={8}>
              <Feather name="chevron-right" size={20} color={DASHBOARD_COLORS.gold} />
            </Pressable>
          </View>

          <View style={styles.calendarWeekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.calendarWeekday}>{d}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((day, i) => {
              if (day === null) return <View key={i} style={styles.calendarCell} />;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const collab = collabsByDate.get(dateStr);
              return (
                <Pressable
                  key={i}
                  style={styles.calendarCell}
                  onPress={() => handleDayPress(day)}
                  disabled={!collab}
                >
                  <Text style={[styles.calendarDayText, collab ? { color: DASHBOARD_COLORS.gold, fontWeight: "700" } : null]}>
                    {day}
                  </Text>
                  {collab ? <View style={styles.calendarDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calendarLegendRow}>
            <View style={styles.calendarDot} />
            <Text style={styles.calendarLegendText}>Collab / sponsor day</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DASHBOARD_COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: DASHBOARD_COLORS.cream },
  headerSubtitle: { fontSize: 13, color: DASHBOARD_COLORS.creamDim, marginTop: 2 },
  backButton: { padding: 8, marginRight: 8 },
  referralBadge: {
    backgroundColor: DASHBOARD_COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
    alignSelf: "flex-start",
  },
  referralBadgeText: { color: DASHBOARD_COLORS.background, fontSize: 12, fontWeight: "700" },
  // Stats 2×2
  statsRow: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  statsGridRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#111411",
    borderColor: DASHBOARD_COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  statValue: { fontSize: 24, fontWeight: "700", color: DASHBOARD_COLORS.cream },
  statLabel: { fontSize: 11, color: DASHBOARD_COLORS.creamDim, marginTop: 2 },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    backgroundColor: "rgba(201,147,58,0.15)",
  },
  // Loading / error states
  centeredBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  errorText: { color: DASHBOARD_COLORS.creamDim, fontSize: 13, textAlign: "center" },
  retryButton: {
    borderWidth: 1,
    borderColor: DASHBOARD_COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 2,
  },
  retryButtonText: { color: DASHBOARD_COLORS.gold, fontSize: 13, fontWeight: "600" },
  // Recent activity feed
  activityCard: {
    backgroundColor: DASHBOARD_COLORS.surface,
    borderWidth: 1,
    borderColor: DASHBOARD_COLORS.cardBorder,
    borderRadius: 16,
    overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activityRowDivider: {
    borderTopWidth: 1,
    borderTopColor: DASHBOARD_COLORS.cardBorder,
  },
  activityThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#111411" },
  activityThumbFallback: { alignItems: "center", justifyContent: "center" },
  activityTextWrap: { flex: 1 },
  activityCaption: { color: DASHBOARD_COLORS.cream, fontSize: 14, fontWeight: "600" },
  activityMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  activityMetaText: {
    color: DASHBOARD_COLORS.creamDim,
    fontSize: 12,
    marginRight: 6,
  },
  activityTime: { color: DASHBOARD_COLORS.creamDim, fontSize: 12 },
  activityEmpty: { paddingHorizontal: 16, paddingVertical: 22 },
  activityEmptyText: {
    color: DASHBOARD_COLORS.creamDim,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  // Activity nav cards
  navCard: {
    backgroundColor: DASHBOARD_COLORS.surface,
    borderWidth: 1,
    borderColor: DASHBOARD_COLORS.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navCardLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  navCardIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  navCardTextWrap: { flex: 1 },
  navCardTitle: { color: DASHBOARD_COLORS.cream, fontSize: 15, fontWeight: "600" },
  navCardSubtitle: { color: DASHBOARD_COLORS.creamDim, fontSize: 12, marginTop: 2 },
  // Calendar
  calendarCard: {
    backgroundColor: DASHBOARD_COLORS.surface,
    borderWidth: 1,
    borderColor: DASHBOARD_COLORS.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  calendarNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  calendarMonthLabel: { color: DASHBOARD_COLORS.cream, fontSize: 15, fontWeight: "700" },
  calendarWeekRow: { flexDirection: "row", marginBottom: 6 },
  calendarWeekday: {
    flex: 1,
    textAlign: "center",
    color: DASHBOARD_COLORS.creamDim,
    fontSize: 11,
    fontWeight: "600",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  calendarDayText: { color: DASHBOARD_COLORS.cream, fontSize: 13 },
  calendarDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: DASHBOARD_COLORS.gold },
  calendarLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DASHBOARD_COLORS.cardBorder,
  },
  calendarLegendText: { color: DASHBOARD_COLORS.creamDim, fontSize: 12 },
});

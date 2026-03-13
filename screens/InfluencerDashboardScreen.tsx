import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { api, InfluencerStats } from "@/services/api";

const TIER_CONFIG = {
  Bronze: { color: "#CD7F32", min: 0, max: 1, icon: "award" },
  Silver: { color: "#C0C0C0", min: 1, max: 3, icon: "award" },
  Gold: { color: "#FFD700", min: 3, max: 6, icon: "award" },
  Elite: { color: "#9B59B6", min: 6, max: 100, icon: "star" },
};

const TIER_ORDER: InfluencerStats["tier"][] = ["Bronze", "Silver", "Gold", "Elite"];

function getNextTier(current: InfluencerStats["tier"]): InfluencerStats["tier"] | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

function getTierProgress(rate: number, tier: InfluencerStats["tier"]): number {
  const config = TIER_CONFIG[tier];
  const next = getNextTier(tier);
  if (!next) return 1;
  const nextConfig = TIER_CONFIG[next];
  const progress = (rate - config.min) / (nextConfig.min - config.min);
  return Math.min(Math.max(progress, 0), 1);
}

export default function InfluencerDashboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { getAuthToken, user } = useAuth();

  const [stats, setStats] = useState<InfluencerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const data = await api.getInfluencerStats(token || "");
      setStats(data);
    } catch (err) {
      setStats({
        referralCode: user?.username || "yourcode",
        referralLink: `https://outsyde.app/join?ref=${user?.username || "yourcode"}`,
        totalClicks: 0,
        totalDownloads: 0,
        totalSignups: 0,
        totalPurchases: 0,
        pointsBalance: 0,
        totalCommissionCents: 0,
        tier: "Bronze",
        conversionRate: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthToken, user]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  const handleCopyLink = async () => {
    if (!stats) return;
    await Clipboard.setStringAsync(stats.referralLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Your referral link has been copied to clipboard.");
  };

  const handleCopyCode = async () => {
    if (!stats) return;
    await Clipboard.setStringAsync(stats.referralCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "Your referral code has been copied.");
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const tierConfig = stats ? TIER_CONFIG[stats.tier] : TIER_CONFIG.Bronze;
  const nextTier = stats ? getNextTier(stats.tier) : null;
  const progress = stats ? getTierProgress(stats.conversionRate, stats.tier) : 0;

  const StatCard = ({
    icon,
    label,
    value,
  }: {
    icon: string;
    label: string;
    value: string | number;
  }) => (
    <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
      <Feather name={icon as any} size={20} color={theme.primary} />
      <ThemedText type="h3" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {label}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.md, borderBottomColor: theme.border },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Influencer Dashboard</ThemedText>
        <Pressable
          onPress={onRefresh}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="refresh-cw" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["2xl"] }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.tierCard,
            {
              backgroundColor: tierConfig.color + "18",
              borderColor: tierConfig.color + "44",
            },
          ]}
        >
          <View style={styles.tierRow}>
            <View
              style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}
            >
              <Feather name={tierConfig.icon as any} size={18} color="#FFF" />
              <ThemedText
                type="body"
                style={[styles.tierName, { color: "#FFF" }]}
              >
                {stats?.tier}
              </ThemedText>
            </View>
            <View style={styles.tierRight}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Conversion Rate
              </ThemedText>
              <ThemedText type="h3" style={{ color: tierConfig.color }}>
                {stats ? (stats.conversionRate * 100).toFixed(1) : "0.0"}%
              </ThemedText>
            </View>
          </View>

          {nextTier ? (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Progress to {nextTier}
                </ThemedText>
                <ThemedText type="small" style={{ color: tierConfig.color }}>
                  {Math.round(progress * 100)}%
                </ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: tierConfig.color,
                      width: `${Math.round(progress * 100)}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Need {TIER_CONFIG[nextTier].min}% conversion rate to reach {nextTier}
              </ThemedText>
            </View>
          ) : (
            <ThemedText
              type="small"
              style={{ color: tierConfig.color, marginTop: Spacing.sm, fontWeight: "600" }}
            >
              You've reached the highest tier!
            </ThemedText>
          )}
        </View>

        <View style={[styles.linkCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText type="small" style={[styles.linkLabel, { color: theme.textSecondary }]}>
            Your Referral Link
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.linkText, { color: theme.primary }]}
            numberOfLines={1}
          >
            {stats?.referralLink}
          </ThemedText>
          <View style={styles.linkActions}>
            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [
                styles.copyButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="copy" size={16} color="#FFF" />
              <ThemedText type="small" style={[styles.copyButtonText, { color: "#FFF" }]}>
                Copy Link
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleCopyCode}
              style={({ pressed }) => [
                styles.codeButton,
                {
                  borderColor: theme.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: theme.primary }}>
                Code: {stats?.referralCode}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="mouse-pointer" label="Total Clicks" value={stats?.totalClicks ?? 0} />
          <StatCard icon="download" label="App Downloads" value={stats?.totalDownloads ?? 0} />
          <StatCard icon="user-plus" label="Sign-ups" value={stats?.totalSignups ?? 0} />
          <StatCard icon="shopping-bag" label="Purchases" value={stats?.totalPurchases ?? 0} />
        </View>

        <View style={[styles.earningsCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.earningsRow}>
            <View style={styles.earningItem}>
              <View style={[styles.earningIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="star" size={20} color={theme.primary} />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Points Balance
              </ThemedText>
              <ThemedText type="h3">{stats?.pointsBalance ?? 0}</ThemedText>
            </View>
            <View style={[styles.earningDivider, { backgroundColor: theme.border }]} />
            <View style={styles.earningItem}>
              <View style={[styles.earningIcon, { backgroundColor: "#34C75920" }]}>
                <Feather name="dollar-sign" size={20} color="#34C759" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Commission Earned
              </ThemedText>
              <ThemedText type="h3">
                ${((stats?.totalCommissionCents ?? 0) / 100).toFixed(2)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.tiersCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText type="body" style={[styles.tiersTitle, { color: theme.text }]}>
            Tier Thresholds
          </ThemedText>
          {TIER_ORDER.map((t) => {
            const cfg = TIER_CONFIG[t];
            const isActive = stats?.tier === t;
            return (
              <View
                key={t}
                style={[
                  styles.tierRow2,
                  isActive ? { backgroundColor: cfg.color + "15", borderRadius: BorderRadius.sm } : null,
                ]}
              >
                <View style={[styles.tierDot, { backgroundColor: cfg.color }]} />
                <ThemedText
                  type="body"
                  style={[
                    styles.tierRowLabel,
                    { color: isActive ? cfg.color : theme.text, fontWeight: isActive ? "700" : "400" },
                  ]}
                >
                  {t}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t === "Elite"
                    ? "6%+ conversion"
                    : `${cfg.min}% – ${cfg.max}% conversion`}
                </ThemedText>
                {isActive ? (
                  <Feather name="check-circle" size={16} color={cfg.color} style={{ marginLeft: Spacing.sm }} />
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  tierCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 9999,
  },
  tierName: { fontWeight: "700" },
  tierRight: { alignItems: "flex-end" },
  progressSection: { marginTop: Spacing.lg },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  linkCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  linkLabel: { marginBottom: Spacing.xs, fontWeight: "500" },
  linkText: { marginBottom: Spacing.md },
  linkActions: { flexDirection: "row", gap: Spacing.md, alignItems: "center" },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 9999,
  },
  copyButtonText: { fontWeight: "600" },
  codeButton: {
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 9999,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statCard: {
    width: "47%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  statValue: { fontWeight: "700" },
  earningsCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  earningsRow: { flexDirection: "row", alignItems: "center" },
  earningItem: { flex: 1, alignItems: "center", gap: Spacing.xs },
  earningIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  earningDivider: { width: 1, height: 60, marginHorizontal: Spacing.lg },
  tiersCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tiersTitle: { fontWeight: "700", marginBottom: Spacing.sm },
  tierRow2: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierRowLabel: { width: 60 },
});

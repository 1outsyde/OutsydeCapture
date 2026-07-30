import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { ProductionCreditData, ProductionCreditHistory } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

const BG = "#080C08";
const GOLD = "#C9933A";
const CREAM = "#F0EAD6";
const CREAM_DIM = "rgba(200,191,168,0.6)";
const SURFACE = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const GREEN = "#22c55e";

const MILESTONE_TARGET = 3;

function mapShootType(raw: string): string {
  switch (raw) {
    case "on-location-product": return "On-Location Product";
    case "studio-product": return "Studio Product";
    case "video": return "Video Shoot";
    default: return raw;
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function DashboardCreditsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const { getToken } = useAuth();

  const [creditData, setCreditData] = useState<ProductionCreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [milestoneVisible, setMilestoneVisible] = useState(true);
  const [businessId, setBusinessId] = useState<string>("");

  const fetchCredits = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      let bid = businessId;
      if (!bid) {
        const { business } = await api.getVendorMyBusiness(token);
        bid = business.id;
        setBusinessId(bid);
      }

      const result = await api.getBusinessProductionCredits(token, bid);
      setCreditData(result);
    } catch {
      setCreditData({ balance: 0, history: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, businessId]);

  useEffect(() => {
    fetchCredits();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCredits(true);
  };

  const balance = creditData?.balance ?? 0;
  const history: ProductionCreditHistory[] = creditData?.history ?? [];
  const recentHistory = history.slice(0, 5);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: insets.top + 12,
      paddingBottom: 14,
      paddingHorizontal: 16,
      backgroundColor: BG,
      borderBottomWidth: 1,
      borderBottomColor: CARD_BORDER,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
      color: CREAM,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: insets.bottom + 32,
    },
    milestoneBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: GOLD + "18",
      borderWidth: 1,
      borderColor: GOLD + "40",
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
    },
    milestoneText: {
      flex: 1,
      color: GOLD,
      fontSize: 13,
      fontWeight: "600",
    },
    creditsCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 20,
      marginBottom: 22,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 20,
    },
    iconBg: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: GOLD + "18",
    },
    cardCenter: { flex: 1 },
    cardLabel: { fontSize: 13, marginBottom: 2 },
    balanceNum: { fontSize: 44, fontWeight: "900", lineHeight: 50 },
    freeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: GREEN + "20",
    },
    freeBadgeText: { color: GREEN, fontSize: 11, fontWeight: "700" },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressLabelLeft: { fontSize: 12, fontWeight: "600" },
    progressLabelRight: { fontSize: 12, fontWeight: "600", color: GOLD },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 18,
    },
    progressFill: { height: 8, borderRadius: 4 },
    bookBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: GOLD,
      borderRadius: 12,
      paddingVertical: 13,
    },
    bookBtnText: { fontSize: 15, fontWeight: "700", color: "#000" },
    sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
    emptyState: { alignItems: "center", gap: 10, paddingVertical: 32 },
    emptyTitle: { fontSize: 15, fontWeight: "600" },
    emptySubtitle: { fontSize: 13, textAlign: "center" },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
    },
    historyIconBg: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: GOLD + "14",
    },
    historyCenter: { flex: 1 },
    historyType: { fontSize: 14, fontWeight: "600" },
    historyDate: { fontSize: 12, marginTop: 1 },
    historyRight: { alignItems: "flex-end", gap: 4 },
    historyPrice: { fontSize: 14, fontWeight: "700" },
    creditBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    creditBadgeText: { fontSize: 11, fontWeight: "700" },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  const progressPct = Math.min((balance / MILESTONE_TARGET) * 100, 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={CREAM} />
        </Pressable>
        <Text style={styles.headerTitle}>Credits</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Milestone banner */}
        {milestoneVisible && balance >= 2 && balance < MILESTONE_TARGET && (
          <View style={styles.milestoneBanner}>
            <Feather name="zap" size={16} color={GOLD} />
            <Text style={styles.milestoneText}>
              {MILESTONE_TARGET - balance} credit{MILESTONE_TARGET - balance !== 1 ? "s" : ""} away from a free shoot!
            </Text>
            <Pressable onPress={() => setMilestoneVisible(false)} hitSlop={8}>
              <Feather name="x" size={16} color={GOLD} />
            </Pressable>
          </View>
        )}

        {/* Credits card */}
        <View style={[styles.creditsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardTopRow}>
            <View style={styles.iconBg}>
              <Feather name="star" size={22} color={GOLD} />
            </View>
            <View style={styles.cardCenter}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Available Credits</Text>
              <Text style={[styles.balanceNum, { color: theme.text }]}>{balance}</Text>
            </View>
            {balance >= MILESTONE_TARGET && (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free Shoot Ready</Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabelLeft, { color: theme.textSecondary }]}>
              {Math.min(balance, MILESTONE_TARGET)}/{MILESTONE_TARGET} credits to free shoot
            </Text>
            <Text style={styles.progressLabelRight}>
              {balance >= MILESTONE_TARGET ? "Unlocked!" : `${MILESTONE_TARGET - balance} more needed`}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: balance >= MILESTONE_TARGET ? GREEN : GOLD,
                  width: `${progressPct}%`,
                },
              ]}
            />
          </View>

          {/* Book a Shoot button */}
          <Pressable
            style={styles.bookBtn}
            onPress={() =>
              navigation.navigate("ShootBooking", {
                businessId,
                creditBalance: creditData?.balance ?? 0,
              })
            }
          >
            <Feather name="camera" size={16} color="#000" />
            <Text style={styles.bookBtnText}>Book a Shoot</Text>
          </Pressable>
        </View>

        {/* History section */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Redemptions</Text>

        {recentHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="clock" size={28} color={CREAM_DIM} />
            <Text style={[styles.emptyTitle, { color: CREAM }]}>No shoot history yet</Text>
            <Text style={[styles.emptySubtitle, { color: CREAM_DIM }]}>
              Book your first shoot to get started.
            </Text>
          </View>
        ) : (
          recentHistory.map(item => {
            const isFree = item.pricePaidCents === 0;
            const priceLabel = isFree ? "Free" : `$${(item.pricePaidCents / 100).toFixed(0)}`;
            const showBadge = item.creditsUsed > 0;
            const badgeFree = item.creditsUsed >= MILESTONE_TARGET;

            return (
              <View
                key={item.id}
                style={[
                  styles.historyRow,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.historyIconBg}>
                  <Feather name="camera" size={16} color={GOLD} />
                </View>
                <View style={styles.historyCenter}>
                  <Text style={[styles.historyType, { color: theme.text }]}>
                    {mapShootType(item.shootType)}
                  </Text>
                  <Text style={[styles.historyDate, { color: theme.textSecondary }]}>
                    {formatDate(item.date)}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={[styles.historyPrice, { color: theme.text }]}>{priceLabel}</Text>
                  {showBadge && (
                    <View
                      style={[
                        styles.creditBadge,
                        { backgroundColor: badgeFree ? "#22c55e20" : GOLD + "14" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.creditBadgeText,
                          { color: badgeFree ? GREEN : GOLD },
                        ]}
                      >
                        {badgeFree
                          ? "Free"
                          : `-${item.creditsUsed} credit${item.creditsUsed !== 1 ? "s" : ""}`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";

import { useAuth } from "@/context/AuthContext";
import { RootStackParamList } from "@/navigation/types";
import {
  getPointsBalance,
  getPointsHistory,
  redeemPointsForCode,
  PointsActiveCode,
  PointsHistoryTransaction,
} from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedeemTier {
  points: number;
  dollars: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GOLD = "#E8B930";
const GOLD_MUTED = "#9A8A60";
const BG = "#0A0A0A";
const CARD_BG = "#0E0E00";
const SURFACE = "#141414";
const BORDER = "#2A2A1A";
const CREAM = "#F5F0E6";
const MUTED = "#666666";
const EARN_GREEN = "#E8B930";
const REDEEM_RED = "#FF6B6B";

const REDEEM_TIERS: RedeemTier[] = [
  { points: 500, dollars: 5 },
  { points: 1000, dollars: 10 },
  { points: 2500, dollars: 25 },
  { points: 5000, dollars: 50 },
  { points: 10000, dollars: 100 },
];

type Navigation = NativeStackNavigationProp<RootStackParamList>;

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function iconForRefType(
  refType: string
): React.ComponentProps<typeof Feather>["name"] {
  switch (refType) {
    case "cart_order":
    case "multi_vendor_order":
      return "shopping-bag";
    case "appointment":
      return "calendar";
    case "shoot_booking":
      return "camera";
    case "referral_bonus":
      return "users";
    default:
      return "star";
  }
}

function earnTitle(tx: PointsHistoryTransaction): string {
  switch (tx.referenceType) {
    case "cart_order":
    case "multi_vendor_order":
      return "Purchase earned";
    case "appointment":
      return "Service booking earned";
    case "shoot_booking":
      return "Shoot booking earned";
    case "referral_bonus":
      return "Referral bonus";
    default:
      return tx.description || "Points earned";
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OutsydePointsScreen() {
  const navigation = useNavigation<Navigation>();
  const { getToken } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [dollarValue, setDollarValue] = useState<string>("0.00");
  const [canRedeem, setCanRedeem] = useState<boolean>(false);
  const [activeCodes, setActiveCodes] = useState<PointsActiveCode[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<RedeemTier | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [redeemLoading, setRedeemLoading] = useState<boolean>(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [balanceData, historyData] = await Promise.all([
        getPointsBalance(token ?? ""),
        getPointsHistory(token ?? ""),
      ]);
      setBalance(balanceData.balance);
      setDollarValue(balanceData.dollarValue);
      setCanRedeem(balanceData.canRedeem);
      setActiveCodes(balanceData.activeCodes ?? []);
      setPointsHistory(historyData.transactions ?? []);
    } catch {
      setError("Could not load points. Pull down to refresh.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const nextLockedTier = REDEEM_TIERS.find((t) => t.points > balance);
  const pointsNeeded = (tierPoints: number) =>
    (tierPoints - balance).toLocaleString();

  const openModal = (tier: RedeemTier) => {
    setSelectedTier(tier);
    setRedeemError(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedTier(null);
    setRedeemError(null);
  };

  const confirmRedeem = async () => {
    if (!selectedTier) return;
    setRedeemLoading(true);
    setRedeemError(null);
    try {
      const token = await getToken();
      const result = await redeemPointsForCode(token ?? "", selectedTier.points);
      closeModal();
      // Optimistic update
      setBalance(result.newBalance);
      setDollarValue((result.newBalance / 100).toFixed(2));
      setCanRedeem(result.newBalance >= 500);
      setActiveCodes((prev: PointsActiveCode[]) => [
        {
          code: result.code,
          discountCents: result.discountCents,
          expiresAt: new Date(
            Date.now() + result.expiresInDays * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        ...prev,
      ]);
      Alert.alert(
        "Code generated!",
        `${result.code} — worth $${result.discountDollars} off. Use it at checkout.`
      );
    } catch (e: any) {
      const msg: string = e?.message || "Something went wrong. Please try again.";
      setRedeemError(msg);
    } finally {
      setRedeemLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={24} color={CREAM} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Outsyde Points</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAll}
            tintColor={GOLD}
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
          <Text style={[styles.balanceAmount, loading && styles.dimText]}>
            {loading ? "—" : balance.toLocaleString()}
          </Text>
          <Text style={styles.balanceSub}>
            Outsyde Points
          </Text>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>
                {loading ? "—" : balance.toLocaleString()}
              </Text>
              <Text style={styles.metaKey}>Lifetime earned</Text>
            </View>
            <View style={styles.metaSep} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>$0.00</Text>
              <Text style={styles.metaKey}>Total saved</Text>
            </View>
            <View style={styles.metaSep} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>
                {nextLockedTier ? `$${nextLockedTier.dollars} off` : "Maxed"}
              </Text>
              <Text style={styles.metaKey}>Next tier</Text>
            </View>
          </View>
        </View>

        {/* Error state */}
        {error && (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={22} color={GOLD_MUTED} />
            <Text style={styles.errorTitle}>Could not load points</Text>
            <Text style={styles.errorSub}>Pull down to refresh</Text>
          </View>
        )}

        {/* Redeem section */}
        <Text style={styles.sectionLabel}>REDEEM POINTS</Text>
        <View style={styles.tierGrid}>
          {REDEEM_TIERS.map((tier, idx) => {
            const unlocked = balance >= tier.points;
            const isLast = idx === REDEEM_TIERS.length - 1;
            const highestUnlocked =
              unlocked &&
              (idx === REDEEM_TIERS.length - 1 ||
                !REDEEM_TIERS.slice(idx + 1).some((t) => balance >= t.points)
                  ? false
                  : false) &&
              REDEEM_TIERS.filter((t) => balance >= t.points).at(-1)?.points ===
                tier.points;

            return (
              <View
                key={tier.points}
                style={[
                  styles.tierCard,
                  isLast && styles.tierCardFull,
                  !unlocked && styles.tierLocked,
                  highestUnlocked && styles.tierFeatured,
                ]}
              >
                <View style={styles.tierTopRow}>
                  <Text style={styles.tierDollar}>${tier.dollars} off</Text>
                  {unlocked ? (
                    <Feather name="check-circle" size={16} color={GOLD} />
                  ) : (
                    <Feather name="lock" size={14} color={MUTED} />
                  )}
                </View>
                <Text style={styles.tierPts}>{tier.points.toLocaleString()} pts</Text>
                {unlocked ? (
                  <TouchableOpacity
                    style={styles.redeemBtn}
                    onPress={() => openModal(tier)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.redeemBtnText}>Redeem</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.lockedBtn}>
                    <Text style={styles.lockedBtnText}>
                      {pointsNeeded(tier.points)} more pts
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Active Codes */}
        {activeCodes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ACTIVE CODES</Text>
            {activeCodes.map((c: PointsActiveCode) => (
              <View key={c.code} style={styles.codeCard}>
                <View style={styles.codeTag}>
                  <Text style={styles.codeTagText}>{c.code}</Text>
                </View>
                <View style={styles.codeInfo}>
                  <Text style={styles.codeValue}>
                    ${(c.discountCents / 100).toFixed(0)} off any purchase
                  </Text>
                  <Text style={styles.codeExpiry}>
                    Expires {formatDate(c.expiresAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyCode(c.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.copyBtnText}>
                    {copiedCode === c.code ? "Copied!" : "Copy"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Points History */}
        <Text style={styles.sectionLabel}>POINTS HISTORY</Text>
        {loading ? (
          <View style={styles.historyPlaceholder}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : pointsHistory.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Feather name="inbox" size={28} color={MUTED} />
            <Text style={styles.emptyHistoryText}>No transactions yet</Text>
          </View>
        ) : (
          pointsHistory.slice(0, 20).map((tx: PointsHistoryTransaction) => (
            <View key={tx.id} style={styles.txRow}>
              <View
                style={[
                  styles.txIcon,
                  {
                    backgroundColor:
                      tx.type === "earn" ? "#1A3C34" : "#1A1A00",
                  },
                ]}
              >
                <Feather
                  name={
                    tx.type === "earn"
                      ? iconForRefType(tx.referenceType)
                      : "tag"
                  }
                  size={16}
                  color={tx.type === "earn" ? "#4ECBA4" : GOLD_MUTED}
                />
              </View>
              <View style={styles.txMid}>
                <Text style={styles.txTitle}>
                  {tx.type === "earn"
                    ? earnTitle(tx)
                    : `Code generated`}
                </Text>
                <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: tx.type === "earn" ? EARN_GREEN : REDEEM_RED },
                ]}
              >
                {tx.type === "earn" ? "+" : "−"}
                {tx.points.toLocaleString()}
              </Text>
            </View>
          ))
        )}

        {/* Ways to Earn */}
        <Text style={styles.sectionLabel}>WAYS TO EARN</Text>
        {[
          {
            icon: "camera" as const,
            title: "Book a session",
            sub: "Earn points on every shoot booking",
            badge: "Points back",
          },
          {
            icon: "shopping-bag" as const,
            title: "Purchase products",
            sub: "Earn points at any vendor store",
            badge: "Points back",
          },
          {
            icon: "calendar" as const,
            title: "Book a service",
            sub: "Earn points on appointments",
            badge: "Points back",
          },
          {
            icon: "users" as const,
            title: "Refer a friend",
            sub: "When they complete their first purchase",
            badge: "500 pts",
          },
        ].map((row) => (
          <View key={row.title} style={styles.earnRow}>
            <View style={styles.earnIconWrap}>
              <Feather name={row.icon} size={18} color={GOLD} />
            </View>
            <View style={styles.earnInfo}>
              <Text style={styles.earnTitle}>{row.title}</Text>
              <Text style={styles.earnSub}>{row.sub}</Text>
            </View>
            <View style={styles.earnBadge}>
              <Text style={styles.earnBadgeText}>{row.badge}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Redeem Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Redeem {selectedTier?.points.toLocaleString()} points?
            </Text>
            <Text style={styles.modalSub}>
              You'll receive a code worth ${selectedTier?.dollars} off
            </Text>

            <View style={styles.modalDivider} />

            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailKey}>Points deducted</Text>
              <Text style={styles.modalDetailVal}>
                {selectedTier?.points.toLocaleString()} pts
              </Text>
            </View>
            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailKey}>Code value</Text>
              <Text style={styles.modalDetailVal}>
                ${selectedTier?.dollars}.00 off
              </Text>
            </View>
            <View style={styles.modalDetailRow}>
              <Text style={styles.modalDetailKey}>Code expires</Text>
              <Text style={styles.modalDetailVal}>30 days from today</Text>
            </View>

            <Text style={styles.modalWarning}>
              This code can only be used once and only by you.
            </Text>

            {redeemError && (
              <Text style={styles.modalError}>{redeemError}</Text>
            )}

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={confirmRedeem}
              disabled={redeemLoading}
              activeOpacity={0.85}
            >
              {redeemLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.modalConfirmText}>Confirm &amp; Redeem</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={closeModal}
              disabled={redeemLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    alignItems: "flex-start",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
    color: CREAM,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Balance card
  balanceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: GOLD_MUTED,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "700",
    color: GOLD,
    letterSpacing: -1,
  },
  dimText: {
    opacity: 0.5,
  },
  balanceSub: {
    fontSize: 13,
    color: GOLD_MUTED,
    marginTop: 4,
    marginBottom: 16,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(232,185,48,0.2)",
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    width: "100%",
  },
  metaItem: {
    flex: 1,
    alignItems: "center",
  },
  metaSep: {
    width: 1,
    backgroundColor: BORDER,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    color: CREAM,
    marginBottom: 2,
  },
  metaKey: {
    fontSize: 10,
    color: MUTED,
    textAlign: "center",
  },
  // Error
  errorBox: {
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 15,
    color: CREAM,
    marginTop: 8,
  },
  errorSub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },
  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: GOLD_MUTED,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 4,
  },
  // Tier grid
  tierGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  tierCard: {
    width: "47.5%",
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  tierCardFull: {
    width: "100%",
  },
  tierLocked: {
    opacity: 0.4,
  },
  tierFeatured: {
    backgroundColor: CARD_BG,
    borderColor: GOLD,
  },
  tierTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tierDollar: {
    fontSize: 22,
    fontWeight: "700",
    color: GOLD,
  },
  tierPts: {
    fontSize: 11,
    color: GOLD_MUTED,
    marginBottom: 12,
  },
  redeemBtn: {
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  redeemBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000000",
  },
  lockedBtn: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  lockedBtnText: {
    fontSize: 11,
    color: MUTED,
  },
  // Active codes
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  codeTag: {
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  codeTagText: {
    fontFamily: "Courier",
    fontSize: 12,
    fontWeight: "600",
    color: GOLD,
    letterSpacing: 0.5,
  },
  codeInfo: {
    flex: 1,
  },
  codeValue: {
    fontSize: 15,
    color: CREAM,
    fontWeight: "500",
  },
  codeExpiry: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1A1A00",
    borderWidth: 1,
    borderColor: "rgba(232,185,48,0.3)",
    marginLeft: 8,
  },
  copyBtnText: {
    fontSize: 12,
    color: GOLD,
    fontWeight: "600",
  },
  // History
  historyPlaceholder: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyHistory: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyHistoryText: {
    color: MUTED,
    fontSize: 14,
    marginTop: 8,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txMid: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    color: CREAM,
    fontWeight: "500",
  },
  txDate: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Ways to earn
  earnRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 8,
  },
  earnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1A1A00",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  earnInfo: {
    flex: 1,
  },
  earnTitle: {
    fontSize: 14,
    color: CREAM,
    fontWeight: "500",
  },
  earnSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  earnBadge: {
    backgroundColor: "#1A1A00",
    borderWidth: 1,
    borderColor: "rgba(232,185,48,0.3)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  earnBadgeText: {
    fontSize: 11,
    color: GOLD,
    fontWeight: "500",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    padding: 24,
    width: "100%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: CREAM,
    textAlign: "center",
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 20,
  },
  modalDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 16,
  },
  modalDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalDetailKey: {
    fontSize: 14,
    color: MUTED,
  },
  modalDetailVal: {
    fontSize: 14,
    color: CREAM,
    fontWeight: "500",
  },
  modalWarning: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  modalError: {
    fontSize: 13,
    color: REDEEM_RED,
    textAlign: "center",
    marginBottom: 12,
  },
  modalConfirmBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000000",
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    color: CREAM,
  },
});

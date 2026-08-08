import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import api, { BusinessBooking } from "@/services/api";
import RefundModal from "@/components/RefundModal";

const BG = "#080C08";
const GOLD = "#C9933A";
const CREAM = "#F0EAD6";
const CREAM_DIM = "rgba(200,191,168,0.6)";
const SURFACE = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type FilterStatus = "all" | "pending" | "confirmed" | "completed" | "canceled" | "no_show" | "declined" | "expired";
type SortMode = "action" | "newest" | "oldest" | "highest";

const SORT_CYCLE: SortMode[] = ["action", "newest", "oldest", "highest"];
const SORT_LABELS: Record<SortMode, string> = {
  action: "Needs Action First",
  newest: "Newest First",
  oldest: "Oldest First",
  highest: "Highest Earning",
};

const STATUS_PRIORITY: Record<string, number> = {
  pending_provider: 0,
  pending: 0,
  confirmed: 1,
  completed: 2,
  cancelled: 3,
  no_show: 3,
  declined: 4,
  expired: 4,
};

function statusColors(status: BusinessBooking["status"]): { bg: string; text: string } {
  switch (status) {
    case "pending_provider":
    case "pending":
      return { bg: "rgba(212,175,55,0.15)", text: "#D4AF37" };
    case "confirmed":
      return { bg: "rgba(52,199,89,0.15)", text: "#34C759" };
    case "completed":
      return { bg: "rgba(201,147,58,0.15)", text: GOLD };
    case "canceled":
    case "declined":
      return { bg: "rgba(255,59,48,0.12)", text: "#FF3B30" };
    case "no_show":
    case "expired":
      return { bg: "rgba(142,142,147,0.15)", text: "#8E8E93" };
    default:
      return { bg: "rgba(255,255,255,0.08)", text: CREAM_DIM };
  }
}

function formatStatusLabel(status: BusinessBooking["status"]): string {
  switch (status) {
    case "pending_provider": return "Pending Review";
    case "no_show": return "No Show";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export default function DashboardBookingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const [bookings, setBookings] = useState<BusinessBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortMode>("action");

  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BusinessBooking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBookings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.getBusinessBookings(token);
      setBookings(res.bookings);
    } catch (err) {
      if (!silent) Alert.alert("Error", "Failed to load bookings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings(true);
    }, [fetchBookings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings(true);
  };

  const handleAccept = async (bookingId: string) => {
    if (actionLoading) return;
    setActionLoading(bookingId);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await api.acceptBooking(token, "business", bookingId);
      setBookings((prev: BusinessBooking[]) => prev.filter((b: BusinessBooking) => b.id !== bookingId));
      fetchBookings(true);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to accept booking. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = (bookingId: string) => {
    const doDecline = async (reason?: string) => {
      if (actionLoading) return;
      setActionLoading(bookingId);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        await api.declineBooking(token, "business", bookingId, reason?.trim() || undefined);
        setBookings((prev: BusinessBooking[]) => prev.filter((b: BusinessBooking) => b.id !== bookingId));
        fetchBookings(true);
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to decline booking. Please try again.");
      } finally {
        setActionLoading(null);
      }
    };

    Alert.prompt(
      "Decline Booking",
      "Optional: add a reason for the customer (e.g. unavailable, fully booked).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: (reason?: string) => {
            Alert.alert(
              "Confirm Decline",
              "The customer's card hold will be released. They will not be charged.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Decline", style: "destructive", onPress: () => doDecline(reason) },
              ]
            );
          },
        },
      ],
      "plain-text",
      "",
      "default"
    );
  };

  const handleNoShow = (booking: BusinessBooking) => {
    Alert.alert(
      "Cancel without refund?",
      "This marks the booking as a no-show. The customer will NOT be refunded. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error("Not authenticated");
              await api.cancelBookingNoRefund(token, booking.id);
              fetchBookings(true);
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to cancel booking");
            }
          },
        },
      ]
    );
  };

  const handleRefundPress = (booking: BusinessBooking) => {
    setSelectedBooking(booking);
    setRefundModalVisible(true);
  };

  const handleRefundConfirm = async (amount?: number) => {
    if (!selectedBooking) return;
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    const result = await api.issueRefund(token, "business", selectedBooking.id, amount);
    if (result.success) {
      Alert.alert(
        "Refund Issued",
        `$${result.refundedAmount?.toFixed(2) ?? amount ?? selectedBooking.amount} has been refunded.`
      );
      fetchBookings(true);
    } else {
      throw new Error(result.message || "Failed to issue refund");
    }
  };

  const cycleSortMode = () => {
    const idx = SORT_CYCLE.indexOf(sort);
    setSort(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
  };

  const FILTER_OPTIONS = [
    { key: "all" as FilterStatus,       label: "All",       count: bookings.length },
    { key: "pending" as FilterStatus,   label: "Pending",   count: bookings.filter(b => b.status === "pending" || b.status === "pending_provider").length },
    { key: "confirmed" as FilterStatus, label: "Confirmed", count: bookings.filter(b => b.status === "confirmed").length },
    { key: "completed" as FilterStatus, label: "Completed", count: bookings.filter(b => b.status === "completed").length },
    { key: "canceled" as FilterStatus, label: "Cancelled", count: bookings.filter(b => b.status === "canceled").length },
    { key: "no_show" as FilterStatus,   label: "No Show",   count: bookings.filter(b => b.status === "no_show").length },
  ];

  const filtered = bookings.filter(b =>
    filter === "all" ||
    b.status === filter ||
    (filter === "pending" && b.status === "pending_provider")
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "action") {
      return (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
    }
    if (sort === "newest") {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sort === "oldest") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (sort === "highest") {
      return (b.vendorNetAmount ?? b.amount) - (a.vendorNetAmount ?? a.amount);
    }
    return 0;
  });

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
      paddingTop: 4,
      paddingBottom: insets.bottom + 24,
    },
    emptyState: { alignItems: "center", marginTop: 72, gap: 12 },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "rgba(201,147,58,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { color: CREAM, fontSize: 16, fontWeight: "600" },
    emptySubtitle: {
      color: CREAM_DIM,
      fontSize: 13,
      textAlign: "center",
      maxWidth: 260,
    },
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 18,
      marginBottom: 8,
    },
    groupBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: GOLD },
    groupLabel: { color: GOLD, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
    card: {
      backgroundColor: SURFACE,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: CARD_BORDER,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      paddingBottom: 10,
    },
    clientRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.06)",
      alignItems: "center",
      justifyContent: "center",
    },
    clientName: { color: CREAM, fontSize: 14, fontWeight: "600" },
    dateTime: { color: CREAM_DIM, fontSize: 12, marginTop: 1 },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: { fontSize: 11, fontWeight: "700" },
    cardBody: {
      paddingHorizontal: 14,
      paddingBottom: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    serviceName: { color: CREAM_DIM, fontSize: 13 },
    earningsCol: { alignItems: "flex-end", gap: 2 },
    earningsLine: { color: CREAM_DIM, fontSize: 11 },
    earningsPrimary: { color: CREAM, fontSize: 14, fontWeight: "700" },
    actions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: CARD_BORDER,
      overflow: "hidden",
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    actionDivider: { width: 1, backgroundColor: CARD_BORDER },
    actionBtnText: { fontSize: 13, fontWeight: "600" },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  });

  const renderGroupHeaders = (list: BusinessBooking[]) => {
    if (sort !== "action") {
      return list.map(b => <BookingCard key={b.id} booking={b} styles={styles} onAccept={handleAccept} onDecline={handleDecline} onRefund={handleRefundPress} onNoShow={handleNoShow} actionLoading={actionLoading} />);
    }

    const groups: { label: string; items: BusinessBooking[] }[] = [
      { label: "Pending", items: list.filter(b => b.status === "pending" || b.status === "pending_provider") },
      { label: "Confirmed", items: list.filter(b => b.status === "confirmed") },
      { label: "Completed", items: list.filter(b => b.status === "completed") },
      { label: "Cancelled / No Show", items: list.filter(b => b.status === "canceled" || b.status === "no_show") },
      { label: "Declined / Expired", items: list.filter(b => b.status === "declined" || b.status === "expired") },
    ];

    return groups
      .filter(g => g.items.length > 0)
      .map(g => (
        <View key={g.label}>
          <View style={styles.groupHeader}>
            <View style={styles.groupBar} />
            <Text style={styles.groupLabel}>{g.label}</Text>
          </View>
          {g.items.map(b => (
            <BookingCard key={b.id} booking={b} styles={styles} onAccept={handleAccept} onDecline={handleDecline} onRefund={handleRefundPress} onNoShow={handleNoShow} actionLoading={actionLoading} />
          ))}
        </View>
      ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={CREAM} />
        </Pressable>
        <Text style={styles.headerTitle}>Bookings</Text>
      </View>

      {/* Filter chips — scrollable row */}
      <View style={{ height: 44, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            alignItems: "center",
            gap: 8,
          }}
          style={{ flex: 1 }}
        >
          {FILTER_OPTIONS.map(f => {
            const isActive = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  height: 32,
                  flexShrink: 0,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isActive ? GOLD : "rgba(255,255,255,0.15)",
                  backgroundColor: isActive ? GOLD : "rgba(255,255,255,0.06)",
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: isActive ? "#141209" : "#FFFFFF",
                }}>
                  {f.label}
                </Text>
                <View style={{
                  backgroundColor: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  minWidth: 18,
                  alignItems: "center",
                }}>
                  <Text style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: isActive ? "#141209" : "#FFFFFF",
                  }}>
                    {f.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Sort button — separate row */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Pressable
          onPress={cycleSortMode}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            backgroundColor: SURFACE,
            borderWidth: 1,
            borderColor: CARD_BORDER,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: CREAM }}>
            ↕ Sort: {SORT_LABELS[sort]}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        >
          {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="calendar" size={24} color={GOLD} />
              </View>
              <Text style={styles.emptyTitle}>No bookings</Text>
              <Text style={styles.emptySubtitle}>
                {filter === "all"
                  ? "Bookings will appear here once customers book your services"
                  : `No ${formatStatusLabel(filter as BusinessBooking["status"])} bookings`}
              </Text>
            </View>
          ) : (
            renderGroupHeaders(sorted)
          )}
        </ScrollView>
      )}

      {selectedBooking && (
        <RefundModal
          visible={refundModalVisible}
          onClose={() => {
            setRefundModalVisible(false);
            setSelectedBooking(null);
          }}
          onConfirm={handleRefundConfirm}
          bookingAmount={selectedBooking.vendorNetAmount ?? selectedBooking.amount}
          clientName={selectedBooking.customerName}
          serviceName={selectedBooking.serviceName}
        />
      )}
    </View>
  );
}

interface BookingCardProps {
  booking: BusinessBooking;
  styles: ReturnType<typeof StyleSheet.create>;
  onAccept: (id: string) => void | Promise<void>;
  onDecline: (id: string) => void | Promise<void>;
  onRefund: (b: BusinessBooking) => void;
  onNoShow: (b: BusinessBooking) => void;
  actionLoading?: string | null;
}

function BookingCard({ booking, styles, onAccept, onDecline, onRefund, onNoShow, actionLoading }: BookingCardProps) {
  const sc = statusColors(booking.status);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.clientRow}>
          <View style={styles.avatar}>
            {booking.customerAvatar ? (
              <Image
                source={{ uri: booking.customerAvatar }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            ) : (
              <Feather name="user" size={17} color={CREAM_DIM} />
            )}
          </View>
          <View>
            <Text style={styles.clientName}>{booking.customerName}</Text>
            <Text style={styles.dateTime}>{booking.date} at {booking.time}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{formatStatusLabel(booking.status)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.serviceName}>{booking.serviceName}</Text>
        <View style={styles.earningsCol}>
          {booking.subtotalAmount != null && (
            <Text style={styles.earningsLine}>Subtotal: ${booking.subtotalAmount.toFixed(2)}</Text>
          )}
          {booking.bookingFeeAmount != null && (
            <Text style={styles.earningsLine}>Fee: -${booking.bookingFeeAmount.toFixed(2)}</Text>
          )}
          {booking.isInfluencerAttributed && booking.influencerCommissionAmount != null && (
            <Text style={styles.earningsLine}>Influencer: -${booking.influencerCommissionAmount.toFixed(2)}</Text>
          )}
          {booking.vendorNetAmount != null ? (
            <Text style={styles.earningsPrimary}>You Earn: ${booking.vendorNetAmount.toFixed(2)}</Text>
          ) : (
            <Text style={styles.earningsPrimary}>${booking.amount}</Text>
          )}
        </View>
      </View>

      {(booking.status === "pending" || booking.status === "pending_provider") && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "rgba(52,199,89,0.12)", opacity: actionLoading === booking.id ? 0.6 : 1 }]}
            onPress={() => onAccept(booking.id)}
            disabled={!!actionLoading}
          >
            {actionLoading === booking.id ? (
              <ActivityIndicator size="small" color="#34C759" />
            ) : (
              <Text style={[styles.actionBtnText, { color: "#34C759" }]}>Accept</Text>
            )}
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "rgba(255,59,48,0.08)", opacity: actionLoading === booking.id ? 0.6 : 1 }]}
            onPress={() => onDecline(booking.id)}
            disabled={!!actionLoading}
          >
            {actionLoading === booking.id ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <Text style={[styles.actionBtnText, { color: "#FF3B30" }]}>Decline</Text>
            )}
          </Pressable>
        </View>
      )}

      {booking.status === "confirmed" && (
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: "rgba(255,59,48,0.08)" }]} onPress={() => onRefund(booking)}>
            <Text style={[styles.actionBtnText, { color: "#FF3B30" }]}>Issue Refund</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable style={[styles.actionBtn, { backgroundColor: "rgba(142,142,147,0.08)" }]} onPress={() => onNoShow(booking)}>
            <Text style={[styles.actionBtnText, { color: "#8E8E93" }]}>No Show</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

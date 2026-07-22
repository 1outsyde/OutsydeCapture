import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useData } from "@/context/DataContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiGet } from "@/api/client";
import { RootStackParamList } from "@/navigation/types";
import api, { getMyAppointments, BusinessAppointment } from "@/services/api";
import { Session } from "@/context/DataContext";
import { CATEGORY_LABELS, PhotographyCategory } from "@/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CartOrdersRouteProp = RouteProp<RootStackParamList, "CartOrders">;
type ActiveTab = "cart" | "bookings" | "orders";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Order {
  id: string;
  vendorName: string;
  status: "pending" | "paid";
  itemCount: number;
  expectedDate?: string;
  createdAt: string;
  carrier?: string;
  trackingNumber?: string;
}

type CombinedItem =
  | { kind: "photographer"; data: Session }
  | { kind: "business"; data: BusinessAppointment };

const BUSINESS_UPCOMING_STATUSES = new Set(["confirmed", "pending_provider"]);
const BUSINESS_PAST_STATUSES = new Set(["completed", "canceled", "no_show", "declined", "expired"]);

function getItemDate(item: CombinedItem): string {
  return item.kind === "photographer" ? item.data.date : item.data.appointmentDate;
}

function isPastDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CartOrdersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CartOrdersRouteProp>();
  const insets = useSafeAreaInsets();
  const { getToken, isAuthenticated } = useAuth();
  const { items: cart, updateQuantity: ctxUpdateQuantity } = useCart();
  const { getUpcomingSessions, getPastSessions, refreshSessions } = useData();

  const [activeTab, setActiveTab] = useState<ActiveTab>("cart");

  // ─── Cart state ──────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Bookings state ───────────────────────────────────────────────────────
  const [bookingsFilter, setBookingsFilter] = useState<"upcoming" | "past">("upcoming");
  const [businessAppointments, setBusinessAppointments] = useState<BusinessAppointment[]>([]);
  const cancelPreviewingIds = useRef(new Set<string>());

  // ─── Bookings computations ────────────────────────────────────────────────
  const upcomingSessions = getUpcomingSessions();
  const pastSessions = getPastSessions();

  const upcomingCombined: CombinedItem[] = [
    ...upcomingSessions.map((s): CombinedItem => ({ kind: "photographer", data: s })),
    ...businessAppointments
      .filter((a) => BUSINESS_UPCOMING_STATUSES.has(a.status) && !isPastDate(a.appointmentDate))
      .map((a): CombinedItem => ({ kind: "business", data: a })),
  ].sort((a, b) => getItemDate(a).localeCompare(getItemDate(b)));

  const pastCombined: CombinedItem[] = [
    ...pastSessions.map((s): CombinedItem => ({ kind: "photographer", data: s })),
    ...businessAppointments
      .filter((a) => BUSINESS_PAST_STATUSES.has(a.status) || isPastDate(a.appointmentDate))
      .map((a): CombinedItem => ({ kind: "business", data: a })),
  ].sort((a, b) => getItemDate(b).localeCompare(getItemDate(a)));

  const displayedBookings = bookingsFilter === "upcoming" ? upcomingCombined : pastCombined;

  // ─── Badge counts ─────────────────────────────────────────────────────────
  const cartBadge = cart.reduce((sum, i) => sum + i.quantity, 0);
  const bookingsBadge = upcomingCombined.length;
  const totalBadge = cartBadge + bookingsBadge;

  // ─── Data fetching ────────────────────────────────────────────────────────
  const updateShippingAddress = (key: keyof ShippingAddress, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [key]: value }));
  };

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) { setOrders([]); return; }
    const token = await getToken();
    if (!token) { setOrders([]); return; }
    setOrdersLoading(true);
    try {
      const response: any = await apiGet("/api/my-orders", token);
      const ordersPayload = Array.isArray(response)
        ? response
        : Array.isArray(response?.orders) ? response.orders : [];

      const normalized: Order[] = ordersPayload.map((order: any, index: number) => {
        const status: "pending" | "paid" = order?.status === "paid" ? "paid" : "pending";
        const itemCount = Array.isArray(order?.items)
          ? order.items.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 1), 0)
          : Number(order?.itemCount) || 0;
        return {
          id: String(order?.id ?? `order-${index}`),
          vendorName: order?.vendorName || order?.vendor?.name || order?.businessName || "Order",
          status,
          itemCount,
          expectedDate: order?.expectedDate || order?.estimatedDeliveryDate,
          createdAt: order?.createdAt || new Date(0).toISOString(),
          carrier: order?.shipment?.carrier,
          trackingNumber: order?.shipment?.trackingNumber,
        };
      });
      normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(normalized);
    } catch (error: any) {
      console.warn("Failed to fetch orders:", error?.message || error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [getToken, isAuthenticated]);

  const fetchBusinessAppointments = useCallback(async () => {
    if (!isAuthenticated) { setBusinessAppointments([]); return; }
    try {
      const token = await getToken();
      if (!token) { setBusinessAppointments([]); return; }
      const appts = await getMyAppointments(token);
      setBusinessAppointments(appts);
    } catch (error) {
      console.warn("Failed to fetch business appointments:", error);
      setBusinessAppointments([]);
    }
  }, [getToken, isAuthenticated]);

  useEffect(() => {
    fetchOrders();
    fetchBusinessAppointments();
  }, [fetchOrders, fetchBusinessAppointments]);

  useFocusEffect(
    useCallback(() => {
      refreshSessions();
      fetchBusinessAppointments();
    }, [refreshSessions, fetchBusinessAppointments])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchBusinessAppointments(), refreshSessions()]);
    setRefreshing(false);
  };

  // ─── Switch to Orders tab when CartCheckoutScreen navigates back with openTab ──
  useEffect(() => {
    const tab = route.params?.openTab;
    if (tab) {
      setActiveTab(tab);
      if (tab === "orders") fetchOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?._ts]);

  // ─── Cart actions ─────────────────────────────────────────────────────────
  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find((i) => i.productId === productId);
    if (item) ctxUpdateQuantity(productId, item.quantity + delta);
  };

  const getOrderStatusConfig = (status: "pending" | "paid") => {
    if (status === "paid") return { label: "Confirmed", icon: "check-circle" as const, color: "#34C759" };
    return { label: "Processing", icon: "clock" as const, color: "#FF9500" };
  };

  // ─── Bookings helpers ─────────────────────────────────────────────────────
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const formatTimeStr = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    return `${h % 12 || 12}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const formatTime = (startTime: string, endTime: string) =>
    `${formatTimeStr(startTime)} - ${formatTimeStr(endTime)}`;

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "upcoming": return theme.brandSuccess || "#34C759";
      case "completed": return "#007AFF";
      case "cancelled": return theme.brandError || "#FF3B30";
      default: return theme.brandTextDim;
    }
  };

  const getBusinessStatusColor = (status: string) => {
    if (BUSINESS_UPCOMING_STATUSES.has(status)) return theme.brandSuccess || "#34C759";
    if (status === "completed") return theme.brandGold;
    if (BUSINESS_PAST_STATUSES.has(status)) return theme.brandError || "#FF3B30";
    return theme.brandTextDim;
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.brandBg,
    },
    header: {
      paddingTop: insets.top + Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.brandSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetTitle: {
      flex: 1,
      textAlign: "center",
    },
    tabRow: {
      flexDirection: "row",
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBtnActive: {
      backgroundColor: theme.brandGold,
    },
    tabBtnInactive: {
      backgroundColor: theme.brandSurface,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: insets.bottom + Spacing["2xl"],
    },
    // ── Cart styles ──────────────────────────────────────────────────────────
    emptyCard: {
      padding: Spacing.xl,
      borderRadius: BorderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: theme.brandSurface,
    },
    browseButton: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.brandPrimary,
    },
    cartItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    cartIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandGold + "1A",
    },
    cartInfo: { flex: 1, gap: 2 },
    quantityControls: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    quantityBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSurface,
    },
    quantityText: { minWidth: 20, textAlign: "center" },
    proceedButton: {
      marginTop: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
    },
    // ── Orders styles ────────────────────────────────────────────────────────
    ordersEmpty: {
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.brandSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    orderCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
    },
    orderIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    orderInfo: { flex: 1 },
    // ── Bookings styles ──────────────────────────────────────────────────────
    bookingsFilterRow: {
      flexDirection: "row",
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    filterBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: "center",
      borderRadius: BorderRadius.md,
    },
    sessionCard: {
      flexDirection: "row",
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      backgroundColor: theme.brandSurface,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      marginRight: Spacing.md,
    },
    initialsCircle: {
      alignItems: "center",
      justifyContent: "center",
    },
    sessionInfo: { flex: 1 },
    sessionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.xs,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: Spacing.xs,
      gap: Spacing.xs,
    },
    emptyBookings: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing["3xl"],
    },
  });

  // ─── Render bookings card ─────────────────────────────────────────────────
  const renderBookingCard = (item: CombinedItem) => {
    if (item.kind === "photographer") {
      const session = item.data;
      const isOverride = isPastDate(session.date);
      const statusColor =
        isOverride && session.status === "upcoming"
          ? getStatusColor("completed")
          : getStatusColor(session.status);
      const statusLabel =
        isOverride && session.status === "upcoming"
          ? "Completed"
          : session.status.charAt(0).toUpperCase() + session.status.slice(1);

      return (
        <Pressable
          key={`photographer-${session.id}`}
          onPress={() => navigation.navigate("SessionDetail", { sessionId: session.id })}
          style={({ pressed }) => [styles.sessionCard, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Image
            source={{ uri: session.photographerAvatar }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.sessionInfo}>
            <View style={styles.sessionHeader}>
              <ThemedText type="h4" numberOfLines={1} style={{ flex: 1, marginRight: Spacing.sm }}>
                {session.photographerName}
              </ThemedText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <ThemedText type="caption" style={{ color: statusColor }}>{statusLabel}</ThemedText>
                </View>
                {session.status === "upcoming" && !isOverride && (
                  <Pressable
                    hitSlop={8}
                    onPress={async (e) => {
                      e.stopPropagation();
                      if (cancelPreviewingIds.current.has(session.id)) return;
                      cancelPreviewingIds.current.add(session.id);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        const preview = await api.getShootCancelPreview(token, session.id);
                        if (!preview.cancellable) {
                          Alert.alert("Can't cancel", `This booking can no longer be cancelled: ${preview.reason}`);
                          return;
                        }
                        const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
                        const svcFee = preview.grossChargeAmountCents - preview.subtotalCents;
                        let msg: string;
                        if (preview.refundTier === "full") {
                          msg = svcFee > 0
                            ? `You paid ${fmt(preview.grossChargeAmountCents)}. You'll receive a full refund of ${fmt(preview.refundAmountCents)} — the ${fmt(svcFee)} service fee is non-refundable.`
                            : `You paid ${fmt(preview.grossChargeAmountCents)} and will receive a full refund of ${fmt(preview.refundAmountCents)}.`;
                        } else if (preview.refundTier === "partial") {
                          msg = `You paid ${fmt(preview.grossChargeAmountCents)}. You'll receive a partial refund of ${fmt(preview.refundAmountCents)}.`;
                          if (preview.feeWouldBeCharged) msg += ` A ${fmt(preview.feeAmountCents)} cancellation fee also applies.`;
                        } else {
                          msg = `You paid ${fmt(preview.grossChargeAmountCents)} and will not receive a refund.`;
                          if (preview.feeWouldBeCharged) msg += ` A ${fmt(preview.feeAmountCents)} cancellation fee applies.`;
                        }
                        const doCancel = async () => {
                          try {
                            const t = await getToken();
                            if (!t) return;
                            const result = await api.cancelShootBooking(t, session.id);
                            await refreshSessions();
                            const lines: string[] = [];
                            if (result.refundAmountCents > 0) lines.push(`Refunded: $${(result.refundAmountCents / 100).toFixed(2)}`);
                            if (result.feeAmountCents > 0 && result.feeCharged) lines.push(`Cancellation fee charged: $${(result.feeAmountCents / 100).toFixed(2)}`);
                            else if (result.feeAmountCents > 0 && result.feeNeedsManualCollection) lines.push(`A $${(result.feeAmountCents / 100).toFixed(2)} cancellation fee applies — the photographer will collect this separately`);
                            Alert.alert("Session canceled", lines.length > 0 ? lines.join("\n") : "Session canceled");
                          } catch (err: any) {
                            Alert.alert("Error", err.message || "Failed to cancel session");
                          }
                        };
                        Alert.alert("Cancel this session?", `${msg} This can't be undone.`, [
                          { text: "Keep session", style: "cancel" },
                          { text: "Cancel session", style: "destructive", onPress: doCancel },
                        ]);
                      } catch (error: any) {
                        Alert.alert("Error", error.message || "Failed to check cancellation terms");
                      } finally {
                        cancelPreviewingIds.current.delete(session.id);
                      }
                    }}
                  >
                    <Feather name="x-circle" size={18} color={theme.brandError || "#FF3B30"} />
                  </Pressable>
                )}
              </View>
            </View>
            <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
              {CATEGORY_LABELS[session.sessionType as PhotographyCategory] || session.sessionType}
            </ThemedText>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={13} color={theme.brandTextDim} />
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>{formatDate(session.date)}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>·</ThemedText>
              <Feather name="clock" size={13} color={theme.brandTextDim} />
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>{session.time}</ThemedText>
            </View>
            <View style={[styles.metaRow, { marginTop: 2 }]}>
              <Feather name="map-pin" size={13} color={theme.brandTextDim} />
              <ThemedText type="caption" numberOfLines={1} style={{ color: theme.brandTextDim, flex: 1 }}>
                {session.location}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      );
    }

    // kind === "business"
    const appt = item.data;
    const isOverride = isPastDate(appt.appointmentDate);
    const statusColor =
      isOverride && BUSINESS_UPCOMING_STATUSES.has(appt.status)
        ? getBusinessStatusColor("completed")
        : getBusinessStatusColor(appt.status);
    const statusLabel =
      isOverride && BUSINESS_UPCOMING_STATUSES.has(appt.status)
        ? "Completed"
        : appt.status === "pending_provider" ? "Pending"
        : appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
    const locationStr =
      appt.businessCity && appt.businessState
        ? `${appt.businessCity}, ${appt.businessState}`
        : appt.businessCity || appt.businessState || appt.businessAddress || "";
    const timeStr = appt.appointmentEndTime
      ? formatTime(appt.appointmentTime, appt.appointmentEndTime)
      : formatTimeStr(appt.appointmentTime);
    const initials = (appt.businessName ?? "?").slice(0, 2).toUpperCase();

    return (
      <Pressable
        key={`business-${appt.id}`}
        onPress={() => navigation.navigate("AppointmentDetail", { appointment: appt })}
        style={({ pressed }) => [styles.sessionCard, { opacity: pressed ? 0.85 : 1 }]}
      >
        {appt.businessLogoImage ? (
          <Image source={{ uri: appt.businessLogoImage }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.initialsCircle, { backgroundColor: theme.brandGold + "30" }]}>
            <ThemedText type="caption" style={{ color: theme.brandGold, fontWeight: "700" }}>{initials}</ThemedText>
          </View>
        )}
        <View style={styles.sessionInfo}>
          <View style={styles.sessionHeader}>
            <ThemedText type="h4" numberOfLines={1} style={{ flex: 1, marginRight: Spacing.sm }}>
              {appt.businessName ?? "Business"}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                <ThemedText type="caption" style={{ color: statusColor }}>{statusLabel}</ThemedText>
              </View>
              {appt.status === "confirmed" && !isOverride && (
                <Pressable
                  hitSlop={8}
                  onPress={async (e) => {
                    e.stopPropagation();
                    if (cancelPreviewingIds.current.has(appt.id)) return;
                    cancelPreviewingIds.current.add(appt.id);
                    try {
                      const token = await getToken();
                      if (!token) return;
                      const preview = await api.getAppointmentCancelPreview(token, appt.id);
                      if (!preview.cancellable) {
                        Alert.alert("Can't cancel", `This booking can no longer be cancelled: ${preview.reason}`);
                        return;
                      }
                      const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
                      const svcFee = preview.grossChargeAmountCents - preview.subtotalCents;
                      let msg: string;
                      if (preview.refundTier === "full") {
                        msg = svcFee > 0
                          ? `You paid ${fmt(preview.grossChargeAmountCents)}. You'll receive a full refund of ${fmt(preview.refundAmountCents)} — the ${fmt(svcFee)} service fee is non-refundable.`
                          : `You paid ${fmt(preview.grossChargeAmountCents)} and will receive a full refund of ${fmt(preview.refundAmountCents)}.`;
                      } else if (preview.refundTier === "partial") {
                        msg = `You paid ${fmt(preview.grossChargeAmountCents)}. You'll receive a partial refund of ${fmt(preview.refundAmountCents)}.`;
                        if (preview.feeWouldBeCharged) msg += ` A ${fmt(preview.feeAmountCents)} cancellation fee also applies.`;
                      } else {
                        msg = `You paid ${fmt(preview.grossChargeAmountCents)} and will not receive a refund.`;
                        if (preview.feeWouldBeCharged) msg += ` A ${fmt(preview.feeAmountCents)} cancellation fee applies.`;
                      }
                      const doCancel = async () => {
                        try {
                          const t = await getToken();
                          if (!t) return;
                          const result = await api.cancelAppointment(t, appt.id);
                          await fetchBusinessAppointments();
                          const lines: string[] = [];
                          if (result.refundAmountCents > 0) lines.push(`Refunded: $${(result.refundAmountCents / 100).toFixed(2)}`);
                          if (result.feeAmountCents > 0 && result.feeCharged) lines.push(`Cancellation fee charged: $${(result.feeAmountCents / 100).toFixed(2)}`);
                          else if (result.feeAmountCents > 0 && result.feeNeedsManualCollection) lines.push(`A $${(result.feeAmountCents / 100).toFixed(2)} cancellation fee applies — the business will collect this separately`);
                          Alert.alert("Appointment canceled", lines.length > 0 ? lines.join("\n") : "Appointment canceled");
                        } catch (err: any) {
                          Alert.alert("Error", err.message || "Failed to cancel appointment");
                        }
                      };
                      Alert.alert("Cancel this appointment?", `${msg} This can't be undone.`, [
                        { text: "Keep appointment", style: "cancel" },
                        { text: "Cancel appointment", style: "destructive", onPress: doCancel },
                      ]);
                    } catch (error: any) {
                      Alert.alert("Error", error.message || "Failed to check cancellation terms");
                    } finally {
                      cancelPreviewingIds.current.delete(appt.id);
                    }
                  }}
                >
                  <Feather name="x-circle" size={18} color={theme.brandError || "#FF3B30"} />
                </Pressable>
              )}
            </View>
          </View>
          {appt.staffDisplayName ? (
            <ThemedText type="caption" style={{ color: theme.brandTextDim }}>with {appt.staffDisplayName}</ThemedText>
          ) : null}
          <ThemedText type="caption" style={{ color: theme.brandTextDim }}>{appt.serviceName ?? "Service"}</ThemedText>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={13} color={theme.brandTextDim} />
            <ThemedText type="caption" style={{ color: theme.brandTextDim }}>{formatDate(appt.appointmentDate)}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.brandTextDim }}>·</ThemedText>
            <Feather name="clock" size={13} color={theme.brandTextDim} />
            <ThemedText type="caption" style={{ color: theme.brandTextDim }}>{timeStr}</ThemedText>
          </View>
          {locationStr ? (
            <View style={[styles.metaRow, { marginTop: 2 }]}>
              <Feather name="map-pin" size={13} color={theme.brandTextDim} />
              <ThemedText type="caption" numberOfLines={1} style={{ color: theme.brandTextDim, flex: 1 }}>{locationStr}</ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  // ─── Tab content renderers ────────────────────────────────────────────────
  const renderCartTab = () => (
    <>
      {cart.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="shopping-bag" size={40} color={theme.brandTextDim} />
          <ThemedText type="body" style={{ color: theme.brandTextDim }}>Your cart is empty</ThemedText>
          <Pressable style={styles.browseButton} onPress={() => navigation.goBack()}>
            <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>Browse vendors</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          {cart.map((item) => (
            <View key={item.productId} style={styles.cartItem}>
              <View style={styles.cartIcon}>
                <Feather name="package" size={20} color={theme.brandGold} />
              </View>
              <View style={styles.cartInfo}>
                <ThemedText type="h4" numberOfLines={1}>{item.name}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                  ${(item.price / 100).toFixed(2)} each
                </ThemedText>
              </View>
              <View style={styles.quantityControls}>
                <Pressable onPress={() => updateQuantity(item.productId, -1)} style={styles.quantityBtn}>
                  <Feather name="minus" size={14} color={theme.brandCream} />
                </Pressable>
                <ThemedText type="body" style={styles.quantityText}>{item.quantity}</ThemedText>
                <Pressable onPress={() => updateQuantity(item.productId, 1)} style={styles.quantityBtn}>
                  <Feather name="plus" size={14} color={theme.brandCream} />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => navigation.navigate("CartCheckout")}
            disabled={cart.length === 0}
            style={({ pressed }) => [
              styles.proceedButton,
              {
                backgroundColor: cart.length === 0 ? theme.brandPrimary + "66" : theme.brandPrimary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="credit-card" size={18} color={theme.brandPrimaryText} />
            <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>Proceed to Checkout</ThemedText>
          </Pressable>
        </>
      )}
    </>
  );

  const renderBookingsTab = () => (
    <>
      <View style={styles.bookingsFilterRow}>
        <Pressable
          onPress={() => setBookingsFilter("upcoming")}
          style={[
            styles.filterBtn,
            { backgroundColor: bookingsFilter === "upcoming" ? theme.brandGold : theme.brandSurface },
          ]}
        >
          <ThemedText
            type="button"
            style={{ color: bookingsFilter === "upcoming" ? "#fff" : theme.brandCream, fontSize: 13 }}
          >
            Upcoming
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setBookingsFilter("past")}
          style={[
            styles.filterBtn,
            { backgroundColor: bookingsFilter === "past" ? theme.brandGold : theme.brandSurface },
          ]}
        >
          <ThemedText
            type="button"
            style={{ color: bookingsFilter === "past" ? "#fff" : theme.brandCream, fontSize: 13 }}
          >
            Past
          </ThemedText>
        </Pressable>
      </View>

      {displayedBookings.length === 0 ? (
        <View style={styles.emptyBookings}>
          <Feather
            name={bookingsFilter === "upcoming" ? "calendar" : "archive"}
            size={40}
            color={theme.brandTextDim}
          />
          <ThemedText type="body" style={{ color: theme.brandTextDim, marginTop: Spacing.md, textAlign: "center" }}>
            {bookingsFilter === "upcoming"
              ? "No upcoming bookings"
              : "No past bookings"}
          </ThemedText>
        </View>
      ) : (
        displayedBookings.map(renderBookingCard)
      )}
    </>
  );

  const renderOrdersTab = () => (
    <>
      {ordersLoading ? (
        <View style={styles.ordersEmpty}>
          <ActivityIndicator size="small" color={theme.brandGold} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.ordersEmpty}>
          <Feather name="package" size={40} color={theme.brandTextDim} style={{ marginBottom: Spacing.sm }} />
          <ThemedText type="body" style={{ color: theme.brandTextDim }}>No orders yet</ThemedText>
        </View>
      ) : (
        orders.map((order) => {
          const statusConfig = getOrderStatusConfig(order.status);
          return (
            <Pressable
              key={order.id}
              onPress={() =>
                navigation.navigate("ProductOrderDetail", {
                  orderId: order.id,
                  vendorName: order.vendorName,
                  status: order.status,
                  itemCount: order.itemCount,
                  expectedDate: order.expectedDate,
                  carrier: order.carrier,
                  trackingNumber: order.trackingNumber,
                })
              }
              style={({ pressed }) => [styles.orderCard, { opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.orderIcon, { backgroundColor: statusConfig.color + "20" }]}>
                <Feather name={statusConfig.icon} size={18} color={statusConfig.color} />
              </View>
              <View style={styles.orderInfo}>
                <ThemedText type="body" numberOfLines={1}>{order.vendorName}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                  {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} · {statusConfig.label}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.brandTextDim} />
            </Pressable>
          );
        })
      )}
    </>
  );

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <ThemedText type="h3" style={styles.sheetTitle}>Cart & activity</ThemedText>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Feather name="x" size={18} color={theme.brandCream} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["cart", "bookings", "orders"] as ActiveTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "cart" ? "Cart" : tab === "bookings" ? "Bookings" : "Orders";
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabBtn, isActive ? styles.tabBtnActive : styles.tabBtnInactive]}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  { color: isActive ? "#000" : theme.brandCream },
                ]}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brandGold} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "cart" && renderCartTab()}
        {activeTab === "bookings" && renderBookingsTab()}
        {activeTab === "orders" && renderOrdersTab()}
      </ScrollView>
    </View>
  );
}
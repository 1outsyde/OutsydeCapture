import React, { useState, useCallback, useEffect, useRef } from "react";
import { Alert, StyleSheet, View, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/api/client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Session } from "@/context/DataContext";
import { CATEGORY_LABELS, PhotographyCategory } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import api, { getMyAppointments, BusinessAppointment } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = "upcoming" | "past";

interface Order {
  id: string;
  vendorName: string;
  status: "processing" | "shipped" | "delivered";
  itemCount: number;
  expectedDate?: string;
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

export default function SessionsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { getUpcomingSessions, getPastSessions, refreshSessions, isLoading } = useData();
  const { isAuthenticated, getToken } = useAuth();
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const cancelPreviewingIds = useRef(new Set<string>());
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [businessAppointments, setBusinessAppointments] = useState<BusinessAppointment[]>([]);

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

  const displayedItems = filter === "upcoming" ? upcomingCombined : pastCombined;
  const nextSession = upcomingSessions[0];

  const fetchActiveOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setActiveOrders([]);
      return;
    }

    setOrdersLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setActiveOrders([]);
        return;
      }

      const response: any = await apiGet("/api/my-orders", token);
      const ordersPayload = Array.isArray(response)
        ? response
        : Array.isArray(response?.orders)
          ? response.orders
          : [];

      const normalized = ordersPayload
        .map((order: any, index: number): Order => {
          const normalizedStatus =
            order?.status === "shipped"
              ? "shipped"
              : order?.status === "delivered"
                ? "delivered"
                : "processing";

          const itemCount = Array.isArray(order?.items)
            ? order.items.reduce(
                (sum: number, item: any) => sum + (Number(item?.quantity) || 1),
                0
              )
            : Number(order?.itemCount) || 0;

          return {
            id: String(order?.id ?? `order-${index}`),
            vendorName: order?.vendorName || order?.vendor?.name || order?.businessName || "Order",
            status: normalizedStatus,
            itemCount,
            expectedDate: order?.expectedDate || order?.estimatedDeliveryDate,
          };
        })
        .filter((order: Order) => order.status === "processing" || order.status === "shipped");

      setActiveOrders(normalized);
    } catch (error) {
      console.warn("Failed to fetch active orders:", error);
      setActiveOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [getToken, isAuthenticated]);

  const fetchBusinessAppointments = useCallback(async () => {
    if (!isAuthenticated) {
      setBusinessAppointments([]);
      return;
    }
    try {
      const token = await getToken();
      if (!token) {
        setBusinessAppointments([]);
        return;
      }
      const appts = await getMyAppointments(token);
      setBusinessAppointments(appts);
    } catch (error) {
      console.warn("Failed to fetch business appointments:", error);
      setBusinessAppointments([]);
    }
  }, [getToken, isAuthenticated]);

  useEffect(() => {
    if (!nextSession) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const sessionDate = new Date(nextSession.date + "T" + nextSession.time);
      const now = new Date();
      const diff = sessionDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown("Starting now!");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        setCountdown(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextSession]);

  useEffect(() => {
    fetchActiveOrders();
    fetchBusinessAppointments();
  }, [fetchActiveOrders, fetchBusinessAppointments]);

  useFocusEffect(
    useCallback(() => {
      refreshSessions();
      fetchBusinessAppointments();
    }, [refreshSessions, fetchBusinessAppointments]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshSessions(), fetchActiveOrders(), fetchBusinessAppointments()]);
    setRefreshing(false);
  }, [refreshSessions, fetchActiveOrders, fetchBusinessAppointments]);

  const handleSessionPress = (session: Session) => {
    navigation.navigate("SessionDetail", { sessionId: session.id });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (startTime: string, endTime: string) => {
    const formatTimeStr = (time: string) => {
      const [hours, minutes] = time.split(":");
      const h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };
    return `${formatTimeStr(startTime)} - ${formatTimeStr(endTime)}`;
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "upcoming":
        return theme.success;
      case "completed":
        return "#007AFF";
      case "cancelled":
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getBusinessStatusColor = (status: string) => {
    if (BUSINESS_UPCOMING_STATUSES.has(status)) return theme.success;
    if (status === "completed") return theme.brandGold;
    if (BUSINESS_PAST_STATUSES.has(status)) return theme.error;
    return theme.textSecondary;
  };

  const formatTimeStr = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    return `${h % 12 || 12}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const renderCombinedCard = (item: CombinedItem) => {
    if (item.kind === "photographer") {
      const session = item.data;
      const isOverride = isPastDate(session.date);
      const statusColor = (isOverride && session.status === "upcoming")
        ? getStatusColor("completed")
        : getStatusColor(session.status);
      const statusLabel = (isOverride && session.status === "upcoming")
        ? "Completed"
        : session.status.charAt(0).toUpperCase() + session.status.slice(1);
      return (
        <Pressable
          key={`photographer-${session.id}`}
          onPress={() => handleSessionPress(session)}
          style={({ pressed }) => [
            styles.sessionCard,
            {
              backgroundColor: theme.backgroundDefault,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Image
            source={{ uri: session.photographerAvatar }}
            style={styles.photographerAvatar}
            contentFit="cover"
          />
          <View style={styles.sessionInfo}>
            <View style={styles.sessionHeader}>
              <ThemedText type="h4" numberOfLines={1} style={styles.photographerName}>
                {session.photographerName}
              </ThemedText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <ThemedText type="caption" style={{ color: statusColor }}>
                    {statusLabel}
                  </ThemedText>
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
                            if (result.refundAmountCents > 0) {
                              lines.push(`Refunded: $${(result.refundAmountCents / 100).toFixed(2)}`);
                            }
                            if (result.feeAmountCents > 0 && result.feeCharged) {
                              lines.push(`Cancellation fee charged: $${(result.feeAmountCents / 100).toFixed(2)}`);
                            } else if (result.feeAmountCents > 0 && result.feeNeedsManualCollection) {
                              lines.push(`A $${(result.feeAmountCents / 100).toFixed(2)} cancellation fee applies — the photographer will collect this separately`);
                            }
                            Alert.alert(
                              "Session canceled",
                              lines.length > 0 ? lines.join("\n") : "Session canceled",
                            );
                          } catch (err: any) {
                            Alert.alert("Error", err.message || "Failed to cancel session");
                          }
                        };
                        Alert.alert(
                          "Cancel this session?",
                          `${msg} This can't be undone.`,
                          [
                            { text: "Keep session", style: "cancel" },
                            { text: "Cancel session", style: "destructive", onPress: doCancel },
                          ],
                        );
                      } catch (error: any) {
                        Alert.alert("Error", error.message || "Failed to check cancellation terms");
                      } finally {
                        cancelPreviewingIds.current.delete(session.id);
                      }
                    }}
                  >
                    <Feather name="x-circle" size={18} color={theme.error} />
                  </Pressable>
                )}
              </View>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {CATEGORY_LABELS[session.sessionType as PhotographyCategory] || session.sessionType}
            </ThemedText>
            <View style={styles.sessionMeta}>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={14} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  {formatDate(session.date)}
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <Feather name="clock" size={14} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  {session.time}
                </ThemedText>
              </View>
            </View>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
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
    const statusColor = (isOverride && BUSINESS_UPCOMING_STATUSES.has(appt.status))
      ? getBusinessStatusColor("completed")
      : getBusinessStatusColor(appt.status);
    const statusLabel = (isOverride && BUSINESS_UPCOMING_STATUSES.has(appt.status))
      ? "Completed"
      : appt.status === "pending_provider" ? "Pending" : appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
    const locationStr = (appt.businessCity && appt.businessState)
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
        style={[
          styles.sessionCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        {appt.businessLogoImage ? (
          <Image
            source={{ uri: appt.businessLogoImage }}
            style={styles.photographerAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.photographerAvatar, styles.initialsCircle, { backgroundColor: theme.brandGold + "30" }]}>
            <ThemedText type="caption" style={{ color: theme.brandGold, fontWeight: "700" }}>
              {initials}
            </ThemedText>
          </View>
        )}
        <View style={styles.sessionInfo}>
          <View style={styles.sessionHeader}>
            <ThemedText type="h4" numberOfLines={1} style={styles.photographerName}>
              {appt.businessName ?? "Business"}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                <ThemedText type="caption" style={{ color: statusColor }}>
                  {statusLabel}
                </ThemedText>
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
                          if (result.refundAmountCents > 0) {
                            lines.push(`Refunded: $${(result.refundAmountCents / 100).toFixed(2)}`);
                          }
                          if (result.feeAmountCents > 0 && result.feeCharged) {
                            lines.push(`Cancellation fee charged: $${(result.feeAmountCents / 100).toFixed(2)}`);
                          } else if (result.feeAmountCents > 0 && result.feeNeedsManualCollection) {
                            lines.push(`A $${(result.feeAmountCents / 100).toFixed(2)} cancellation fee applies — the business will collect this separately`);
                          }
                          Alert.alert(
                            "Appointment canceled",
                            lines.length > 0 ? lines.join("\n") : "Appointment canceled",
                          );
                        } catch (err: any) {
                          Alert.alert("Error", err.message || "Failed to cancel appointment");
                        }
                      };
                      Alert.alert(
                        "Cancel this appointment?",
                        `${msg} This can't be undone.`,
                        [
                          { text: "Keep appointment", style: "cancel" },
                          { text: "Cancel appointment", style: "destructive", onPress: doCancel },
                        ],
                      );
                    } catch (error: any) {
                      Alert.alert("Error", error.message || "Failed to check cancellation terms");
                    } finally {
                      cancelPreviewingIds.current.delete(appt.id);
                    }
                  }}
                >
                  <Feather name="x-circle" size={18} color={theme.error} />
                </Pressable>
              )}
            </View>
          </View>
          {appt.staffDisplayName ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              with {appt.staffDisplayName}
            </ThemedText>
          ) : null}
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {appt.serviceName ?? "Service"}
          </ThemedText>
          <View style={styles.sessionMeta}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {formatDate(appt.appointmentDate)}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {timeStr}
              </ThemedText>
            </View>
          </View>
          {locationStr ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
                {locationStr}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  if (!isAuthenticated) {
    return (
      <ScreenScrollView contentContainerStyle={styles.centeredContent}>
        <View style={styles.emptyState}>
          <Feather name="lock" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.emptyTitle}>
            Sign in to view sessions
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Create an account or sign in to book and manage your photography sessions
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {nextSession && filter === "upcoming" ? (
        <View style={[styles.countdownCard, { backgroundColor: theme.brandGold }]}>
          <View style={styles.countdownHeader}>
            <ThemedText type="small" style={styles.countdownLabel}>
              Next Session
            </ThemedText>
            <ThemedText type="h2" style={styles.countdownValue}>
              {countdown}
            </ThemedText>
          </View>
          <View style={styles.countdownInfo}>
            <ThemedText type="h4" style={styles.countdownText}>
              {nextSession.photographerName}
            </ThemedText>
            <ThemedText type="small" style={styles.countdownTextOpacity}>
              {formatDate(nextSession.date)} at {nextSession.time}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Active Orders Section */}
      {filter === "upcoming" ? (
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeader}>
            <Feather name="package" size={18} color={theme.brandGold} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Orders In Progress
            </ThemedText>
          </View>
          {ordersLoading ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Loading orders...
            </ThemedText>
          ) : activeOrders.length === 0 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No orders yet
            </ThemedText>
          ) : (
            activeOrders.map((order) => (
              <Pressable
                key={order.id}
                onPress={() => navigation.navigate("CartOrders")}
                style={({ pressed }) => [
                  styles.orderCard,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.orderIcon, { backgroundColor: order.status === "shipped" ? "#007AFF20" : "#FF950020" }]}>
                  <Feather
                    name={order.status === "shipped" ? "truck" : "clock"}
                    size={18}
                    color={order.status === "shipped" ? "#007AFF" : "#FF9500"}
                  />
                </View>
                <View style={styles.orderInfo}>
                  <ThemedText type="body" numberOfLines={1}>
                    {order.vendorName}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {order.itemCount} item{order.itemCount > 1 ? "s" : ""} - {order.status === "shipped" ? `Arrives ${order.expectedDate || "soon"}` : "Processing"}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.filterContainer}>
        <Pressable
          onPress={() => setFilter("upcoming")}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: filter === "upcoming" ? theme.brandGold : theme.backgroundDefault,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText
            type="button"
            style={{ color: filter === "upcoming" ? "#FFFFFF" : theme.text }}
          >
            Upcoming
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFilter("past")}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: filter === "past" ? theme.brandGold : theme.backgroundDefault,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText
            type="button"
            style={{ color: filter === "past" ? "#FFFFFF" : theme.text }}
          >
            Past
          </ThemedText>
        </Pressable>
      </View>

      {displayedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather
            name={filter === "upcoming" ? "calendar" : "archive"}
            size={48}
            color={theme.textSecondary}
          />
          <ThemedText type="h4" style={styles.emptyTitle}>
            No {filter} sessions
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {filter === "upcoming"
              ? "Book a photographer or business to get started"
              : "Your completed sessions will appear here"}
          </ThemedText>
        </View>
      ) : (
        displayedItems.map(renderCombinedCard)
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  countdownCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  countdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  countdownLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countdownValue: {
    color: "#FFFFFF",
  },
  countdownInfo: {},
  countdownText: {
    color: "#FFFFFF",
  },
  countdownTextOpacity: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: Spacing.xl,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  sessionCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  photographerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.md,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  photographerName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  sessionMeta: {
    flexDirection: "row",
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  ordersSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  orderInfo: {
    flex: 1,
  },
  initialsCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
});

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import api, { BusinessOrder } from "@/services/api";
import OrderCard from "@/components/OrderCard";

// Local type override: backend returns "paid" status but the shared type doesn't include it yet.
type Order = Omit<BusinessOrder, "status"> & {
  status: "pending" | "processing" | "paid" | "shipped" | "delivered" | "cancelled";
};

const BG = "#080C08";
const GOLD = "#C9933A";
const CREAM = "#F0EAD6";
const CREAM_DIM = "rgba(200,191,168,0.6)";
const SURFACE = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type FilterStatus = "all" | "pending" | "paid" | "shipped" | "delivered" | "cancelled";
type SortMode = "action" | "newest" | "oldest" | "highest";

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const SORT_CYCLE: SortMode[] = ["action", "newest", "oldest", "highest"];
const SORT_LABELS: Record<SortMode, string> = {
  action: "Needs Action First",
  newest: "Newest First",
  oldest: "Oldest First",
  highest: "Highest Total",
};

const STATUS_PRIORITY: Record<string, number> = {
  paid: 0,
  pending: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 4,
};

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function UrgencyBadge({ order }: { order: Order }) {
  if (order.status !== "paid" || order.shipment) return null;

  const now = new Date();
  const orderDate = new Date(order.orderDate);
  const deadline = new Date(orderDate);
  deadline.setDate(deadline.getDate() + 4);

  const daysLeft = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const orderAgeDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
  const dayNum = Math.min(orderAgeDays + 1, 4);

  if (daysLeft < 0) {
    return (
      <View style={{
        backgroundColor: "rgba(232,93,93,0.12)",
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 10,
        marginBottom: 6,
      }}>
        <Text style={{ color: "#E85D5D", fontSize: 12, fontWeight: "600" }}>
          🚨 Overdue — ship immediately
        </Text>
      </View>
    );
  }

  if (daysLeft <= 1) {
    return (
      <View style={{
        backgroundColor: "rgba(224,169,59,0.12)",
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 10,
        marginBottom: 6,
      }}>
        <Text style={{ color: "#E0A93B", fontSize: 12, fontWeight: "600" }}>
          ⏱ Ship by {formatShortDate(deadline)} — day {dayNum} of 4
        </Text>
      </View>
    );
  }

  return null;
}

export default function DashboardOrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sortIndex, setSortIndex] = useState(0);

  const [shipModalVisible, setShipModalVisible] = useState(false);
  const [shipOrderId, setShipOrderId] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipTracking, setShipTracking] = useState("");
  const [shipSubmitting, setShipSubmitting] = useState(false);

  const sortMode: SortMode = SORT_CYCLE[sortIndex];

  const fetchOrders = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await api.getBusinessOrders(token);
      setOrders(res.orders as unknown as Order[]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const handleCancelOrder = async (orderId: string, _status: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.updateOrderStatus(token, orderId, "cancelled");
      fetchOrders();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to cancel order");
    }
  };

  const handleMarkDelivered = async (orderId: string, shipmentId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.updateShipmentStatus(token, shipmentId, "delivered");
      fetchOrders();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to mark as delivered");
    }
  };

  const openShipModal = (orderId: string) => {
    setShipOrderId(orderId);
    setShipCarrier("");
    setShipTracking("");
    setShipModalVisible(true);
  };

  const handleShipOrder = async () => {
    const token = await getToken();
    if (!token) return;
    setShipSubmitting(true);
    try {
      await api.updateOrderStatus(token, shipOrderId, "shipped", {
        carrier: shipCarrier.trim(),
        trackingNumber: shipTracking.trim(),
      });
      setShipModalVisible(false);
      setShipCarrier("");
      setShipTracking("");
      setShipOrderId("");
      fetchOrders();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to ship order");
    } finally {
      setShipSubmitting(false);
    }
  };

  // --- Filter + Sort ---
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case "action":
        return (STATUS_PRIORITY[a.status] ?? 5) - (STATUS_PRIORITY[b.status] ?? 5);
      case "newest":
        return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
      case "oldest":
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      case "highest":
        return b.totalAmount - a.totalAmount;
    }
  });

  const countFor = (s: FilterStatus) =>
    s === "all" ? orders.length : orders.filter(o => o.status === s).length;

  type Group = { label: string; orders: Order[] };
  const groups: Group[] = sortMode === "action"
    ? [
        { label: "Paid — Ready to Ship", orders: sorted.filter(o => o.status === "paid" && !o.shipment) },
        { label: "Pending", orders: sorted.filter(o => o.status === "pending") },
        { label: "Processing", orders: sorted.filter(o => o.status === "processing") },
        { label: "Shipped", orders: sorted.filter(o => o.status === "shipped") },
        { label: "Delivered / Cancelled", orders: sorted.filter(o => o.status === "delivered" || o.status === "cancelled") },
      ].filter(g => g.orders.length > 0)
    : [];

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: CARD_BORDER,
    },
    backBtn: { padding: 8, marginRight: 8 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: CREAM },
    filterRow: { paddingVertical: 12 },
    filterContent: { paddingHorizontal: 16, gap: 8 },
    chip: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: { fontSize: 13, fontWeight: "600" },
    chipBadge: {
      borderRadius: 10,
      paddingHorizontal: 5,
      paddingVertical: 1,
      minWidth: 18,
      alignItems: "center",
    },
    chipBadgeText: { fontSize: 10, fontWeight: "700" },
    sortRow: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: CARD_BORDER,
    },
    sortBtnText: { fontSize: 12, fontWeight: "600", color: CREAM_DIM },
    list: { paddingHorizontal: 16, paddingBottom: 40 },
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 18,
      marginBottom: 10,
    },
    groupAccent: {
      width: 3,
      height: 11,
      borderRadius: 2,
      backgroundColor: GOLD,
    },
    groupLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: CREAM_DIM,
      textTransform: "uppercase",
      letterSpacing: 0.1,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(201,147,58,0.08)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: CREAM, marginBottom: 6 },
    emptySubtitle: {
      fontSize: 13,
      color: CREAM_DIM,
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 260,
    },
    shipOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    shipCard: {
      width: "100%",
      backgroundColor: "#1A1A1A",
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
    },
    shipTitle: { color: CREAM, fontSize: 18, fontWeight: "700", marginBottom: 20 },
    shipLabel: {
      color: "#999",
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 6,
      marginTop: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    carrierRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    carrierChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      backgroundColor: "#2A2A2A",
    },
    carrierChipSelected: { borderColor: GOLD, backgroundColor: GOLD + "15" },
    carrierChipText: { fontSize: 13, fontWeight: "600", color: "#888" },
    carrierChipTextSelected: { color: GOLD },
    trackingInput: {
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      color: CREAM,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    shipActions: { flexDirection: "row", gap: 12, marginTop: 24 },
    shipBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    shipBtnText: { fontSize: 15, fontWeight: "700" },
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={CREAM} />
        </Pressable>
        <Text style={styles.headerTitle}>Orders</Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            const count = countFor(tab.key);
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? GOLD : SURFACE,
                    borderColor: active ? GOLD : CARD_BORDER,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? "#141209" : CREAM_DIM }]}>
                  {tab.label}
                </Text>
                <View style={[
                  styles.chipBadge,
                  { backgroundColor: active ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)" },
                ]}>
                  <Text style={[styles.chipBadgeText, { color: active ? "#141209" : CREAM_DIM }]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort control */}
        <View style={styles.sortRow}>
          <Pressable
            onPress={() => setSortIndex(i => (i + 1) % SORT_CYCLE.length)}
            style={styles.sortBtn}
          >
            <Text style={styles.sortBtnText}>↕ Sort: {SORT_LABELS[sortMode]}</Text>
          </Pressable>
        </View>

        {/* Orders list */}
        <View style={styles.list}>
          {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="shopping-bag" size={24} color={GOLD} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>
                Orders will appear here once customers make purchases
              </Text>
            </View>
          ) : sortMode === "action" ? (
            groups.map(group => (
              <View key={group.label}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupAccent} />
                  <Text style={styles.groupLabel}>{group.label}</Text>
                </View>
                {group.orders.map(order => (
                  <View key={order.id}>
                    <UrgencyBadge order={order} />
                    <OrderCard
                      order={order as unknown as BusinessOrder}
                      onCancelOrder={handleCancelOrder}
                      onShipPress={openShipModal}
                      onMarkDelivered={handleMarkDelivered}
                    />
                  </View>
                ))}
              </View>
            ))
          ) : (
            sorted.map(order => (
              <View key={order.id}>
                <UrgencyBadge order={order} />
                <OrderCard
                  order={order as unknown as BusinessOrder}
                  onCancelOrder={handleCancelOrder}
                  onShipPress={openShipModal}
                  onMarkDelivered={handleMarkDelivered}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Ship Modal */}
      <Modal
        visible={shipModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShipModalVisible(false)}
      >
        <View style={styles.shipOverlay}>
          <View style={styles.shipCard}>
            <Text style={styles.shipTitle}>Ship Order</Text>

            <Text style={styles.shipLabel}>Carrier</Text>
            <View style={styles.carrierRow}>
              {(["UPS", "FedEx", "USPS", "DHL", "Other"] as const).map(c => {
                const sel = shipCarrier === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setShipCarrier(c)}
                    style={[styles.carrierChip, sel && styles.carrierChipSelected]}
                  >
                    <Text style={[styles.carrierChipText, sel && styles.carrierChipTextSelected]}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.shipLabel, { marginTop: 16 }]}>Tracking Number</Text>
            <TextInput
              style={styles.trackingInput}
              placeholder="Enter tracking number"
              placeholderTextColor="#555"
              value={shipTracking}
              onChangeText={setShipTracking}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />

            <View style={styles.shipActions}>
              <Pressable
                onPress={() => {
                  setShipModalVisible(false);
                  setShipCarrier("");
                  setShipTracking("");
                }}
                style={[styles.shipBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
              >
                <Text style={[styles.shipBtnText, { color: "#CCC" }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleShipOrder}
                disabled={!shipCarrier.trim() || shipTracking.trim().length < 5 || shipSubmitting}
                style={[
                  styles.shipBtn,
                  {
                    backgroundColor: "#1A3C34",
                    opacity:
                      !shipCarrier.trim() || shipTracking.trim().length < 5 || shipSubmitting
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                {shipSubmitting ? (
                  <ActivityIndicator size="small" color={GOLD} />
                ) : (
                  <Text style={[styles.shipBtnText, { color: GOLD }]}>Confirm Shipment</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { BusinessOrder } from "@/services/api";

interface OrderCardProps {
  order: BusinessOrder;
  onCancelOrder: (orderId: string, status: string) => void;
  onShipPress: (orderId: string) => void;
  onMarkDelivered?: (orderId: string, shipmentId: string) => void;
}

const CARD = {
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
};

function statusColor(
  status: string,
  primary: string,
  bgSecondary: string,
  textSecondary: string
): { bg: string; text: string } {
  switch (status) {
    case "pending":    return { bg: "#FF950020", text: "#FF9500" };
    case "paid":       return { bg: "#34C75920", text: "#34C759" };
    case "processing": return { bg: "#007AFF20", text: "#007AFF" };
    case "confirmed":  return { bg: "#34C75920", text: "#34C759" };
    case "shipped":    return { bg: "#5856D620", text: "#5856D6" };
    case "delivered":
    case "completed":  return { bg: primary + "20", text: primary };
    case "canceled":  return { bg: "#FF3B3020", text: "#FF3B30" };
    case "no_show":    return { bg: "#8E8E9320", text: "#8E8E93" };
    default:           return { bg: bgSecondary,  text: textSecondary };
  }
}

function parseAddress(
  raw: string | null | undefined
): { line1: string; city: string; state: string; zipCode: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.line1 === "string") {
      return parsed as { line1: string; city: string; state: string; zipCode: string };
    }
    return null;
  } catch {
    return null;
  }
}

export default function OrderCard({ order, onCancelOrder, onShipPress, onMarkDelivered }: OrderCardProps) {
  const { theme } = useTheme();
  const sc = statusColor(order.status, theme.primary, theme.backgroundSecondary, theme.textSecondary);
  const address = parseAddress(order.shippingAddress);

  const styles = StyleSheet.create({
    card: {
      backgroundColor: CARD.surface,
      borderColor: CARD.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    customer: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + "40",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    name: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: theme.text,
    },
    date: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600" as const,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    itemsCol: {
      flex: 1,
      marginRight: 8,
    },
    itemLine: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    priceCol: {
      alignItems: "flex-end",
    },
    feeLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    earnLabel: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: theme.text,
    },
    addressBlock: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: CARD.border,
      marginBottom: 8,
    },
    addressText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    addressMissing: {
      fontStyle: "italic" as const,
      opacity: 0.6,
    },
    trackingBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: CARD.border,
      marginBottom: 8,
    },
    trackingLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: "#E8B930",
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginRight: 2,
    },
    trackingNumber: {
      fontSize: 12,
      color: theme.text,
      fontFamily: "monospace",
      flex: 1,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "flex-end",
    },
    btn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    btnText: {
      fontSize: 12,
      fontWeight: "600" as const,
    },
  });

  return (
    <View style={styles.card}>
      {/* Top row: buyer identity + status pill */}
      <View style={styles.header}>
        <View style={styles.customer}>
          <View style={styles.avatar}>
            <Feather name="user" size={16} color={theme.primary} />
          </View>
          <View>
            <Text style={styles.name}>{order.customerName || "Customer"}</Text>
            <Text style={styles.date}>{order.orderDate}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Detail row: items (left) + price breakdown (right) */}
      <View style={styles.detailRow}>
        <View style={styles.itemsCol}>
          {order.items.slice(0, 2).map((item, i) => (
            <Text key={i} style={styles.itemLine}>
              {item.quantity}× {item.name} — ${item.price}
            </Text>
          ))}
          {order.items.length > 2 && (
            <Text style={styles.itemLine}>+{order.items.length - 2} more</Text>
          )}
        </View>
        <View style={styles.priceCol}>
          {order.subtotalAmount != null && (
            <Text style={styles.feeLabel}>
              Subtotal: ${order.subtotalAmount.toFixed(2)}
            </Text>
          )}
          {order.platformFeeAmount != null && (
            <Text style={styles.feeLabel}>
              Fee: -${order.platformFeeAmount.toFixed(2)}
            </Text>
          )}
          {order.isInfluencerAttributed && order.influencerCommissionAmount != null && (
            <Text style={styles.feeLabel}>
              Influencer: -${order.influencerCommissionAmount.toFixed(2)}
            </Text>
          )}
          {order.vendorNetAmount != null ? (
            <Text style={styles.earnLabel}>
              You Earn: ${order.vendorNetAmount.toFixed(2)}
            </Text>
          ) : (
            <Text style={styles.earnLabel}>Total: ${order.totalAmount}</Text>
          )}
        </View>
      </View>

      {/* Shipping address block */}
      <View style={styles.addressBlock}>
        <Feather name="map-pin" size={12} color={theme.textSecondary} style={{ marginTop: 1 }} />
        {address ? (
          <Text style={styles.addressText}>
            {address.line1}, {address.city}, {address.state} {address.zipCode}
          </Text>
        ) : (
          <Text style={[styles.addressText, styles.addressMissing]}>
            No shipping address on file
          </Text>
        )}
      </View>

      {/* Tracking row — shown when shipment exists */}
      {order.shipment && (
        <Pressable
          style={styles.trackingBlock}
          onPress={() => Clipboard.setStringAsync(order.shipment!.trackingNumber)}
        >
          <Feather name="package" size={12} color="#E8B930" />
          <Text style={styles.trackingLabel}>{order.shipment.carrier}</Text>
          <Text style={styles.trackingNumber} numberOfLines={1}>
            {order.shipment.trackingNumber}
          </Text>
          <Feather name="copy" size={12} color={theme.textSecondary} />
        </Pressable>
      )}

      {/* Action row */}
      {order.status === "pending" && (
        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              Alert.alert("Cancel this order?", "This cannot be undone.", [
                { text: "Keep", style: "cancel" },
                {
                  text: "Cancel Order",
                  style: "destructive",
                  onPress: () => onCancelOrder(order.id, "canceled"),
                },
              ])
            }
            style={[styles.btn, { backgroundColor: "#FF3B30" }]}
          >
            <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {order.status === "paid" && (
        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              Alert.alert(
                "Cancel this order?",
                "This will refund the customer. This cannot be undone.",
                [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Cancel Order",
                    style: "destructive",
                    onPress: () => onCancelOrder(order.id, "canceled"),
                  },
                ]
              )
            }
            style={[
              styles.btn,
              { backgroundColor: "#FF3B3015", borderWidth: 1, borderColor: "#FF3B30", flex: 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: "#FF3B30" }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onShipPress(order.id)}
            style={[styles.btn, { backgroundColor: "#5856D6", flex: 1 }]}
          >
            <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Ship</Text>
          </Pressable>
        </View>
      )}
      {order.status === "shipped" && onMarkDelivered && order.shipment && (
        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              Alert.alert(
                "Mark as Delivered?",
                "Confirm this order has been delivered to the customer.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Mark Delivered",
                    onPress: () => onMarkDelivered(order.id, order.shipment!.id),
                  },
                ]
              )
            }
            style={[styles.btn, { backgroundColor: "#1A3C34", flex: 1 }]}
          >
            <Text style={[styles.btnText, { color: "#E8B930" }]}>Mark Delivered</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

import React, { useState } from "react";
import { StyleSheet, View, Pressable, RefreshControl, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface CartItem {
  id: string;
  name: string;
  vendor: string;
  price: number;
  quantity: number;
  image: string;
}

interface Order {
  id: string;
  date: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
  items: { name: string; quantity: number }[];
  vendorName: string;
  // Customer-facing fee breakdown (backend-calculated; optional until backend exposes them)
  subtotalAmount?: number;
  consumerServiceFeeAmount?: number;
  taxAmount?: number;
}

const MOCK_CART: CartItem[] = [
  {
    id: "cart1",
    name: "Gallery Canvas Print 24x36",
    vendor: "PrintMaster Studio",
    price: 149.99,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=200",
  },
  {
    id: "cart2",
    name: "Leather Photo Album - 50 Pages",
    vendor: "MemoryBook Co",
    price: 89.99,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200",
  },
  {
    id: "cart3",
    name: "Pro Camera Strap - Leather",
    vendor: "LensCraft Gear",
    price: 45.00,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1606986628253-e0f5f7e6c1fa?w=200",
  },
  {
    id: "cart4",
    name: "Portable LED Ring Light 18\"",
    vendor: "PhotoGear Pro",
    price: 79.99,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=200",
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: "order1",
    date: "2025-01-08",
    status: "shipped",
    total: 134.99,
    items: [{ name: "Canvas Print 24x36", quantity: 1 }, { name: "Oak Wood Frame", quantity: 2 }],
    vendorName: "FrameArt Gallery",
  },
  {
    id: "order2",
    date: "2025-01-05",
    status: "processing",
    total: 79.99,
    items: [{ name: "LED Ring Light 18\"", quantity: 1 }],
    vendorName: "PhotoGear Pro",
  },
  {
    id: "order3",
    date: "2025-01-03",
    status: "delivered",
    total: 67.50,
    items: [{ name: "Portrait Session Photos - Digital", quantity: 1 }],
    vendorName: "Sarah Mitchell Photography",
  },
  {
    id: "order4",
    date: "2024-12-28",
    status: "delivered",
    total: 225.00,
    items: [{ name: "Wedding Album Deluxe", quantity: 1 }],
    vendorName: "James Chen Photography",
  },
  {
    id: "order5",
    date: "2024-12-20",
    status: "delivered",
    total: 45.00,
    items: [{ name: "Pro Camera Strap", quantity: 1 }],
    vendorName: "LensCraft Gear",
  },
];

export default function CartOrdersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(MOCK_CART);
  const [orders] = useState<Order[]>(MOCK_ORDERS);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "processing":
        return "#FF9500";
      case "shipped":
        return "#007AFF";
      case "delivered":
        return "#34C759";
      case "cancelled":
        return "#FF3B30";
      default:
        return theme.textSecondary;
    }
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "processing":
        return "clock";
      case "shipped":
        return "truck";
      case "delivered":
        return "check-circle";
      case "cancelled":
        return "x-circle";
      default:
        return "package";
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Cart Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="shopping-cart" size={20} color={theme.primary} />
          <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
            Cart
          </ThemedText>
          {cart.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                {cart.length}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {cart.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="shopping-bag" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Your cart is empty
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            {cart.map((item) => (
              <View key={item.id} style={[styles.cartItem, { backgroundColor: theme.card }]}>
                <Image source={{ uri: item.image }} style={styles.cartImage} contentFit="cover" />
                <View style={styles.cartInfo}>
                  <ThemedText type="h4" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {item.vendor}
                  </ThemedText>
                  <ThemedText type="body" style={{ color: theme.primary, marginTop: Spacing.xs }}>
                    ${item.price.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.quantityControls}>
                  <Pressable
                    onPress={() => updateQuantity(item.id, -1)}
                    style={[styles.quantityBtn, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name="minus" size={16} color={theme.text} />
                  </Pressable>
                  <ThemedText type="body" style={styles.quantityText}>
                    {item.quantity}
                  </ThemedText>
                  <Pressable
                    onPress={() => updateQuantity(item.id, 1)}
                    style={[styles.quantityBtn, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name="plus" size={16} color={theme.text} />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Cart Summary */}
            <View style={[styles.cartTotal, { borderTopColor: theme.border }]}>
              <View style={{ flex: 1, gap: Spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Subtotal</ThemedText>
                  <ThemedText type="body">${cartTotal.toFixed(2)}</ThemedText>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Service fees & taxes calculated at checkout
                  </ThemedText>
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.checkoutButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="credit-card" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                Proceed to Checkout
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>

      {/* Orders Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="package" size={20} color={theme.primary} />
          <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
            Recent Orders
          </ThemedText>
        </View>

        {orders.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="inbox" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No orders yet
            </ThemedText>
          </ThemedView>
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              style={({ pressed }) => [
                styles.orderCard,
                { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={styles.orderHeader}>
                <View>
                  <ThemedText type="h4">{order.vendorName}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {new Date(order.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + "20" }]}>
                  <Feather name={getStatusIcon(order.status) as any} size={14} color={getStatusColor(order.status)} />
                  <ThemedText
                    type="small"
                    style={{ color: getStatusColor(order.status), marginLeft: Spacing.xs, textTransform: "capitalize" }}
                  >
                    {order.status}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.orderItems}>
                {order.items.map((item, idx) => (
                  <ThemedText key={idx} type="caption" style={{ color: theme.textSecondary }}>
                    {item.quantity}x {item.name}
                  </ThemedText>
                ))}
              </View>

              <View style={[styles.orderFooter, { borderTopColor: theme.border, flexDirection: "column", gap: Spacing.xs }]}>
                {order.subtotalAmount != null ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Subtotal</ThemedText>
                    <ThemedText type="caption">${order.subtotalAmount.toFixed(2)}</ThemedText>
                  </View>
                ) : null}
                {order.consumerServiceFeeAmount != null ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Outsyde Service Fee</ThemedText>
                    <ThemedText type="caption">${order.consumerServiceFeeAmount.toFixed(2)}</ThemedText>
                  </View>
                ) : null}
                {order.taxAmount != null ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Sales Tax</ThemedText>
                    <ThemedText type="caption">${order.taxAmount.toFixed(2)}</ThemedText>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <ThemedText type="body">Order Total</ThemedText>
                  <ThemedText type="h4" style={{ color: theme.primary }}>
                    ${order.total.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  badge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItem: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  cartImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
  },
  cartInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    marginHorizontal: Spacing.sm,
    minWidth: 20,
    textAlign: "center",
  },
  cartTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  checkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  orderCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  orderItems: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
});

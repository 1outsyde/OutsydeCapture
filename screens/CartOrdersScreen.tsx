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
}

const MOCK_CART: CartItem[] = [
  {
    id: "cart1",
    name: "Premium Photo Print (16x20)",
    vendor: "PrintMaster Studio",
    price: 45.00,
    quantity: 2,
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200",
  },
  {
    id: "cart2",
    name: "Custom Photo Album",
    vendor: "MemoryBook Co",
    price: 89.99,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=200",
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: "order1",
    date: "2025-01-08",
    status: "shipped",
    total: 134.99,
    items: [{ name: "Canvas Print 24x36", quantity: 1 }, { name: "Photo Frame Set", quantity: 2 }],
    vendorName: "ArtPrint Gallery",
  },
  {
    id: "order2",
    date: "2025-01-05",
    status: "delivered",
    total: 67.50,
    items: [{ name: "Digital Photo Package", quantity: 1 }],
    vendorName: "Sarah Mitchell Photography",
  },
  {
    id: "order3",
    date: "2024-12-28",
    status: "delivered",
    total: 225.00,
    items: [{ name: "Wedding Album Deluxe", quantity: 1 }],
    vendorName: "James Chen Photography",
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

            {/* Cart Total */}
            <View style={[styles.cartTotal, { borderTopColor: theme.border }]}>
              <ThemedText type="h4">Total</ThemedText>
              <ThemedText type="h3" style={{ color: theme.primary }}>
                ${cartTotal.toFixed(2)}
              </ThemedText>
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

              <View style={[styles.orderFooter, { borderTopColor: theme.border }]}>
                <ThemedText type="body">Order Total</ThemedText>
                <ThemedText type="h4" style={{ color: theme.primary }}>
                  ${order.total.toFixed(2)}
                </ThemedText>
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

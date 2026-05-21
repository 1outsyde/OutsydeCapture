import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useStripePayment } from "@/hooks/useStripePayment";
import { BorderRadius, Spacing } from "@/constants/theme";
import api from "@/services/api";
import { apiGet, apiPost } from "@/api/client";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  vendorId: string;
  vendorStripeAccountId: string;
}

interface ShippingAddress {
  line1: string;
  city: string;
  state: string;
  zipCode: string;
}

interface FeeBreakdown {
  basePriceCents: number;
  consumerUpchargeCents: number;
  vendorPayoutCents: number;
  platformFeeCents: number;
  totalChargedToConsumerCents: number;
  outsydePointsEarned: number;
}

interface OrderItem {
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  vendorName?: string;
  items: OrderItem[];
}

export default function CartOrdersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

  const routeCartItems = ((route.params as { cartItems?: CartItem[] } | undefined)?.cartItems ?? []);

  const [cart, setCart] = useState<CartItem[]>(routeCartItems.length > 0 ? routeCartItems : []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [backendFeeBreakdown, setBackendFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    line1: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const hasShippingAddress =
    shippingAddress.line1.trim().length > 0 &&
    shippingAddress.city.trim().length > 0 &&
    shippingAddress.state.trim().length > 0 &&
    shippingAddress.zipCode.trim().length > 0;

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const clientServiceFee = useMemo(() => subtotal * 0.04, [subtotal]);
  const clientTotal = useMemo(() => subtotal * 1.04, [subtotal]);
  const clientPoints = useMemo(() => Math.round(clientServiceFee * 100), [clientServiceFee]);

  const displayedSubtotal = backendFeeBreakdown
    ? backendFeeBreakdown.basePriceCents / 100
    : subtotal;
  const displayedServiceFee = backendFeeBreakdown
    ? backendFeeBreakdown.consumerUpchargeCents / 100
    : clientServiceFee;
  const displayedTotal = backendFeeBreakdown
    ? backendFeeBreakdown.totalChargedToConsumerCents / 100
    : clientTotal;
  const displayedPoints = backendFeeBreakdown
    ? backendFeeBreakdown.outsydePointsEarned
    : clientPoints;

  const updateShippingAddress = (key: keyof ShippingAddress, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [key]: value }));
  };

  const fetchOrders = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    try {
      let response: any;
      if (typeof (api as any).getOrders === "function") {
        response = await (api as any).getOrders(token);
      } else {
        response = await apiGet("/api/orders", token);
      }
      const ordersPayload = Array.isArray(response)
        ? response
        : Array.isArray(response?.orders)
          ? response.orders
          : [];
      const normalizedOrders: Order[] = ordersPayload.map((order: any) => ({
        id: order.id,
        date: order.date || order.createdAt || new Date().toISOString(),
        status: order.status || "processing",
        total:
          typeof order.total === "number"
            ? order.total
            : typeof order.totalAmount === "number"
              ? order.totalAmount
              : 0,
        vendorName: order.vendorName || order.vendor?.name || order.businessName,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              name: item.name || "Item",
              quantity: Number(item.quantity) || 1,
            }))
          : [],
      }));
      setOrders(normalizedOrders);
    } catch (error: any) {
      // Endpoint may not exist yet; required fallback is empty state.
      console.warn("Unable to fetch orders, showing empty state:", error?.message || error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const checkoutDisabled =
    cart.length === 0 || !hasShippingAddress || checkoutLoading;

  const handleCheckout = async () => {
    if (checkoutDisabled) return;
    const token = await getToken();
    if (!token) {
      Alert.alert("Checkout failed. Please try again.");
      return;
    }

    setCheckoutLoading(true);
    try {
      const paymentIntentResponse = await apiPost(
        "/api/cart/payment-intent",
        {
          items: cart.map((item) => ({
            productId: item.id,
            vendorId: item.vendorId,
            vendorStripeAccountId: item.vendorStripeAccountId,
            priceCents: Math.round(item.price * 100),
            quantity: item.quantity,
            name: item.name,
          })),
          shippingAddress: {
            line1: shippingAddress.line1.trim(),
            city: shippingAddress.city.trim(),
            state: shippingAddress.state.trim(),
            zipCode: shippingAddress.zipCode.trim(),
          },
        },
        token
      ) as { clientSecret?: string; feeBreakdown?: FeeBreakdown };

      const clientSecret = paymentIntentResponse?.clientSecret;
      const feeBreakdown = paymentIntentResponse?.feeBreakdown || null;
      setBackendFeeBreakdown(feeBreakdown);

      if (!clientSecret) {
        throw new Error("Missing clientSecret");
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Outsyde",
      });

      if (initError) {
        if ((initError as any)?.code === "Canceled") {
          Alert.alert("Payment cancelled.");
          return;
        }
        throw initError;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if ((presentError as any)?.code === "Canceled") {
          Alert.alert("Payment cancelled.");
          return;
        }
        throw presentError;
      }

      Alert.alert(
        `Order placed successfully! You earned ${feeBreakdown?.outsydePointsEarned ?? 0} Outsyde Points.`
      );
      setCart([]);
      setBackendFeeBreakdown(null);
    } catch (error: any) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (
        code === "MULTI_VENDOR_NOT_SUPPORTED" ||
        message.includes("MULTI_VENDOR_NOT_SUPPORTED")
      ) {
        Alert.alert("Please checkout one vendor at a time.");
      } else {
        Alert.alert("Checkout failed. Please try again.");
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes("processing") || normalized.includes("pending")) return "#FF9500";
    if (normalized.includes("shipped")) return "#007AFF";
    if (normalized.includes("delivered") || normalized.includes("completed")) return "#34C759";
    if (normalized.includes("cancelled") || normalized.includes("failed")) return "#FF3B30";
    return theme.textSecondary;
  };

  const styles = StyleSheet.create({
    section: {
      marginBottom: Spacing.xl,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      flexDirection: "row",
      alignItems: "center",
    },
    emptyCard: {
      padding: Spacing.xl,
      borderRadius: BorderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    browseButton: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.primary,
    },
    cartItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    cartIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary + "1A",
    },
    cartInfo: {
      flex: 1,
      gap: 2,
    },
    quantityControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    quantityBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundSecondary,
    },
    quantityText: {
      minWidth: 20,
      textAlign: "center",
    },
    shippingCard: {
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.card,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    input: {
      height: 44,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.backgroundSecondary,
      color: theme.text,
      paddingHorizontal: Spacing.md,
      fontSize: 15,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    checkoutButton: {
      marginTop: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
    },
    ordersEmpty: {
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    orderCard: {
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      backgroundColor: theme.card,
    },
    orderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: Spacing.sm,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      gap: 4,
    },
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <Feather name="shopping-cart" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Cart
            </ThemedText>
          </View>
        </View>

        {cart.length === 0 ? (
          <ThemedView style={styles.emptyCard}>
            <Feather name="shopping-bag" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Your cart is empty
            </ThemedText>
            <Pressable style={styles.browseButton} onPress={() => navigation.goBack()}>
              <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                Browse Vendors
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <>
            {cart.map((item) => (
              <View key={item.id} style={styles.cartItem}>
                <View style={styles.cartIcon}>
                  <Feather name="package" size={20} color={theme.primary} />
                </View>
                <View style={styles.cartInfo}>
                  <ThemedText type="h4" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    ${item.price.toFixed(2)} each
                  </ThemedText>
                </View>
                <View style={styles.quantityControls}>
                  <Pressable
                    onPress={() => updateQuantity(item.id, -1)}
                    style={styles.quantityBtn}
                  >
                    <Feather name="minus" size={14} color={theme.text} />
                  </Pressable>
                  <ThemedText type="body" style={styles.quantityText}>
                    {item.quantity}
                  </ThemedText>
                  <Pressable
                    onPress={() => updateQuantity(item.id, 1)}
                    style={styles.quantityBtn}
                  >
                    <Feather name="plus" size={14} color={theme.text} />
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={styles.shippingCard}>
              <ThemedText type="body">Shipping Address</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Address Line 1"
                placeholderTextColor={theme.textSecondary}
                value={shippingAddress.line1}
                onChangeText={(v) => updateShippingAddress("line1", v)}
              />
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor={theme.textSecondary}
                value={shippingAddress.city}
                onChangeText={(v) => updateShippingAddress("city", v)}
              />
              <TextInput
                style={styles.input}
                placeholder="State"
                placeholderTextColor={theme.textSecondary}
                value={shippingAddress.state}
                onChangeText={(v) => updateShippingAddress("state", v)}
              />
              <TextInput
                style={styles.input}
                placeholder="Zip Code"
                placeholderTextColor={theme.textSecondary}
                value={shippingAddress.zipCode}
                onChangeText={(v) => updateShippingAddress("zipCode", v)}
              />
            </View>

            <View style={[styles.shippingCard, { marginTop: Spacing.md }]}>
              <View style={styles.row}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Subtotal
                </ThemedText>
                <ThemedText type="body">${displayedSubtotal.toFixed(2)}</ThemedText>
              </View>
              <View style={styles.row}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Outsyde Service Fee (+4%)
                </ThemedText>
                <ThemedText type="body">${displayedServiceFee.toFixed(2)}</ThemedText>
              </View>
              <View style={[styles.row, { marginBottom: 0 }]}>
                <ThemedText type="h4">Total</ThemedText>
                <ThemedText type="h4" style={{ color: theme.primary }}>
                  ${displayedTotal.toFixed(2)}
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ color: "#22c55e", marginTop: Spacing.xs }}>
                You'll earn {displayedPoints} Outsyde Points
              </ThemedText>
            </View>

            <Pressable
              onPress={handleCheckout}
              disabled={checkoutDisabled}
              style={({ pressed }) => [
                styles.checkoutButton,
                {
                  backgroundColor: checkoutDisabled ? theme.border : theme.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="credit-card" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                    Proceed to Checkout
                  </ThemedText>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitle}>
          <Feather name="package" size={20} color={theme.primary} />
          <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
            Recent Orders
          </ThemedText>
        </View>

        {ordersLoading ? (
          <View style={styles.ordersEmpty}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.ordersEmpty}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No orders yet
            </ThemedText>
          </View>
        ) : (
          orders.map((order) => (
            <Pressable key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h4">{order.vendorName || "Order"}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {new Date(order.date).toLocaleDateString()}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + "20" }]}>
                  <Feather name="circle" size={10} color={getStatusColor(order.status)} />
                  <ThemedText type="small" style={{ color: getStatusColor(order.status), textTransform: "capitalize" }}>
                    {order.status}
                  </ThemedText>
                </View>
              </View>
              {order.items.map((item, idx) => (
                <ThemedText key={`${order.id}-${idx}`} type="caption" style={{ color: theme.textSecondary }}>
                  {item.quantity}x {item.name}
                </ThemedText>
              ))}
              <View style={[styles.row, { marginTop: Spacing.sm, marginBottom: 0 }]}>
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

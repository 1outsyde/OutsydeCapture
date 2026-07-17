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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useStripePayment } from "@/hooks/useStripePayment";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiGet, apiPost } from "@/api/client";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
  vendorName: string;
  status: "pending" | "paid";
  itemCount: number;
  expectedDate?: string;
  createdAt: string;
}

export default function CartOrdersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getToken, isAuthenticated } = useAuth();
  const { items: cart, updateQuantity: ctxUpdateQuantity, clearCart, subtotal } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

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

  // subtotal from CartContext is in cents (price stored as priceCents)
  const clientServiceFee = useMemo(() => (subtotal / 100) * 0.08, [subtotal]);
  const clientTotal = useMemo(() => (subtotal / 100) * 1.08, [subtotal]);
  const clientPoints = useMemo(() => Math.round(clientServiceFee * 100), [clientServiceFee]);

  const displayedSubtotal = backendFeeBreakdown
    ? backendFeeBreakdown.basePriceCents / 100
    : subtotal / 100;
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
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }
    const token = await getToken();
    if (!token) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    try {
      const response: any = await apiGet("/api/my-orders", token);
      const ordersPayload = Array.isArray(response)
        ? response
        : Array.isArray(response?.orders)
          ? response.orders
          : [];

      const normalized: Order[] = ordersPayload.map((order: any, index: number) => {
        const status: "pending" | "paid" = order?.status === "paid" ? "paid" : "pending";

        const itemCount = Array.isArray(order?.items)
          ? order.items.reduce(
              (sum: number, item: any) => sum + (Number(item?.quantity) || 1),
              0
            )
          : Number(order?.itemCount) || 0;

        return {
          id: String(order?.id ?? `order-${index}`),
          vendorName: order?.vendorName || order?.vendor?.name || order?.businessName || "Order",
          status,
          itemCount,
          expectedDate: order?.expectedDate || order?.estimatedDeliveryDate,
          createdAt: order?.createdAt || new Date(0).toISOString(),
        };
      });

      // Sort newest first by createdAt
      normalized.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setOrders(normalized);
    } catch (error: any) {
      console.warn("Failed to fetch orders:", error?.message || error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [getToken, isAuthenticated]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find((i) => i.productId === productId);
    if (item) {
      ctxUpdateQuantity(productId, item.quantity + delta);
    }
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
            productId: item.productId,
            vendorId: item.vendorId,
            priceCents: item.price,
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
      clearCart();
      setBackendFeeBreakdown(null);
      // Refresh orders list after successful checkout
      fetchOrders();
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

  const getOrderStatusConfig = (status: "pending" | "paid") => {
    if (status === "paid") {
      return {
        label: "Confirmed",
        icon: "check-circle" as const,
        color: "#34C759",
      };
    }
    return {
      label: "Processing",
      icon: "clock" as const,
      color: "#FF9500",
    };
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
      backgroundColor: theme.brandSurface,
    },
    quantityText: {
      minWidth: 20,
      textAlign: "center",
    },
    shippingCard: {
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    input: {
      height: 44,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      backgroundColor: theme.brandBgElevated,
      color: theme.brandCream,
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
    orderInfo: {
      flex: 1,
    },
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.brandBg }}
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <Feather name="shopping-cart" size={20} color={theme.brandGold} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Cart
            </ThemedText>
          </View>
        </View>

        {cart.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { backgroundColor: theme.brandSurface }]}>
            <Feather name="shopping-bag" size={40} color={theme.brandTextDim} />
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              Your cart is empty
            </ThemedText>
            <Pressable style={styles.browseButton} onPress={() => navigation.goBack()}>
              <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>
                Browse Vendors
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <>
            {cart.map((item) => (
              <View key={item.productId} style={styles.cartItem}>
                <View style={styles.cartIcon}>
                  <Feather name="package" size={20} color={theme.brandGold} />
                </View>
                <View style={styles.cartInfo}>
                  <ThemedText type="h4" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                    ${(item.price / 100).toFixed(2)} each
                  </ThemedText>
                </View>
                <View style={styles.quantityControls}>
                  <Pressable
                    onPress={() => updateQuantity(item.productId, -1)}
                    style={styles.quantityBtn}
                  >
                    <Feather name="minus" size={14} color={theme.brandCream} />
                  </Pressable>
                  <ThemedText type="body" style={styles.quantityText}>
                    {item.quantity}
                  </ThemedText>
                  <Pressable
                    onPress={() => updateQuantity(item.productId, 1)}
                    style={styles.quantityBtn}
                  >
                    <Feather name="plus" size={14} color={theme.brandCream} />
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={styles.shippingCard}>
              <ThemedText type="body">Shipping Address</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Address Line 1"
                placeholderTextColor={theme.brandTextDim}
                value={shippingAddress.line1}
                onChangeText={(v) => updateShippingAddress("line1", v)}
              />
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor={theme.brandTextDim}
                value={shippingAddress.city}
                onChangeText={(v) => updateShippingAddress("city", v)}
              />
              <TextInput
                style={styles.input}
                placeholder="State"
                placeholderTextColor={theme.brandTextDim}
                value={shippingAddress.state}
                onChangeText={(v) => updateShippingAddress("state", v)}
              />
              <TextInput
                style={styles.input}
                placeholder="Zip Code"
                placeholderTextColor={theme.brandTextDim}
                value={shippingAddress.zipCode}
                onChangeText={(v) => updateShippingAddress("zipCode", v)}
              />
            </View>

            <View style={[styles.shippingCard, { marginTop: Spacing.md }]}>
              <View style={styles.row}>
                <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                  Subtotal
                </ThemedText>
                <ThemedText type="body">${displayedSubtotal.toFixed(2)}</ThemedText>
              </View>
              <View style={styles.row}>
                <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                  Outsyde Service Fee (+8%)
                </ThemedText>
                <ThemedText type="body">${displayedServiceFee.toFixed(2)}</ThemedText>
              </View>
              <View style={[styles.row, { marginBottom: 0 }]}>
                <ThemedText type="h4">Total</ThemedText>
                <ThemedText type="h4" style={{ color: theme.brandGold }}>
                  ${displayedTotal.toFixed(2)}
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ color: theme.brandSuccess, marginTop: Spacing.xs }}>
                You'll earn {displayedPoints} Outsyde Points
              </ThemedText>
            </View>

            <Pressable
              onPress={handleCheckout}
              disabled={checkoutDisabled}
              style={({ pressed }) => [
                styles.checkoutButton,
                {
                  backgroundColor: checkoutDisabled ? theme.brandPrimary + "66" : theme.brandPrimary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color={theme.brandPrimaryText} />
              ) : (
                <>
                  <Feather name="credit-card" size={18} color={theme.brandPrimaryText} />
                  <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>
                    Proceed to Checkout
                  </ThemedText>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionTitle, { marginBottom: Spacing.md }]}>
          <Feather name="package" size={20} color={theme.brandGold} />
          <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
            Recent Orders
          </ThemedText>
        </View>

        {ordersLoading ? (
          <View style={styles.ordersEmpty}>
            <ActivityIndicator size="small" color={theme.brandGold} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.ordersEmpty}>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              No orders yet
            </ThemedText>
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
                  })
                }
                style={({ pressed }) => [
                  styles.orderCard,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.orderIcon,
                    { backgroundColor: statusConfig.color + "20" },
                  ]}
                >
                  <Feather name={statusConfig.icon} size={18} color={statusConfig.color} />
                </View>
                <View style={styles.orderInfo}>
                  <ThemedText type="body" numberOfLines={1}>
                    {order.vendorName}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                    {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} · {statusConfig.label}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.brandTextDim} />
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

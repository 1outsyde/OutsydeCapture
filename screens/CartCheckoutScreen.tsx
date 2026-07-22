import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddressAutocompleteInput, { AddressFields } from "@/components/AddressAutocompleteInput";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useStripePayment } from "@/hooks/useStripePayment";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiPost } from "@/api/client";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FeeBreakdown {
  basePriceCents: number;
  consumerUpchargeCents: number;
  vendorPayoutCents: number;
  platformFeeCents: number;
  totalChargedToConsumerCents: number;
  outsydePointsEarned: number;
}

export default function CartCheckoutScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { items: cart, clearCart, subtotal } = useCart();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [backendFeeBreakdown, setBackendFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [shippingAddress, setShippingAddress] = useState<AddressFields>({
    line1: "",
    city: "",
    state: "",
    zipCode: "",
  });

  // ─── Computations (same formulas as CartOrdersScreen) ────────────────────
  const hasShippingAddress =
    shippingAddress.line1.trim().length > 0 &&
    shippingAddress.city.trim().length > 0 &&
    shippingAddress.state.trim().length > 0 &&
    shippingAddress.zipCode.trim().length > 0;

  const clientServiceFee = useMemo(() => (subtotal / 100) * 0.08, [subtotal]);
  const clientTotal = useMemo(() => (subtotal / 100) * 1.08, [subtotal]);
  const clientPoints = useMemo(() => Math.round(clientServiceFee * 100), [clientServiceFee]);

  const displayedSubtotal = backendFeeBreakdown ? backendFeeBreakdown.basePriceCents / 100 : subtotal / 100;
  const displayedServiceFee = backendFeeBreakdown ? backendFeeBreakdown.consumerUpchargeCents / 100 : clientServiceFee;
  const displayedTotal = backendFeeBreakdown ? backendFeeBreakdown.totalChargedToConsumerCents / 100 : clientTotal;
  const displayedPoints = backendFeeBreakdown ? backendFeeBreakdown.outsydePointsEarned : clientPoints;

  const confirmDisabled = cart.length === 0 || !hasShippingAddress || checkoutLoading;

  // ─── Checkout (relocated verbatim from CartOrdersScreen.handleCheckout) ──
  const handleCheckout = async () => {
    if (confirmDisabled) return;
    const token = await getToken();
    if (!token) { Alert.alert("Checkout failed. Please try again."); return; }
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
      if (!clientSecret) throw new Error("Missing clientSecret");

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Outsyde",
      });
      if (initError) {
        if ((initError as any)?.code === "Canceled") { Alert.alert("Payment cancelled."); return; }
        throw initError;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if ((presentError as any)?.code === "Canceled") { Alert.alert("Payment cancelled."); return; }
        throw presentError;
      }

      Alert.alert(`Order placed successfully! You earned ${feeBreakdown?.outsydePointsEarned ?? 0} Outsyde Points.`);
      clearCart();
      setBackendFeeBreakdown(null);
      navigation.navigate("CartOrders", { openTab: "orders", _ts: Date.now() });
    } catch (error: any) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "MULTI_VENDOR_NOT_SUPPORTED" || message.includes("MULTI_VENDOR_NOT_SUPPORTED")) {
        Alert.alert("Please checkout one vendor at a time.");
      } else {
        Alert.alert("Checkout failed. Please try again.");
      }
    } finally {
      setCheckoutLoading(false);
    }
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
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.brandSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: insets.bottom + Spacing["2xl"],
    },
    sectionLabel: {
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    // ── Item rows — mirrors CartOrdersScreen's cartItem style ────────────────
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
    // ── Card container (address + fee breakdown) ─────────────────────────────
    card: {
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    // ── Confirm & Pay button ─────────────────────────────────────────────────
    checkoutButton: {
      marginTop: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
    },
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={18} color={theme.brandCream} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>Checkout</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order summary */}
        <ThemedText type="h4" style={styles.sectionLabel}>Order Summary</ThemedText>
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
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              ×{item.quantity}
            </ThemedText>
          </View>
        ))}

        {/* Shipping address */}
        <ThemedText type="h4" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
          Shipping Address
        </ThemedText>
        <View style={styles.card}>
          <AddressAutocompleteInput
            line1={shippingAddress.line1}
            city={shippingAddress.city}
            state={shippingAddress.state}
            zipCode={shippingAddress.zipCode}
            onChange={(fields) => setShippingAddress(fields)}
          />
        </View>

        {/* Price breakdown */}
        <View style={[styles.card, { marginTop: Spacing.md }]}>
          <View style={styles.row}>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>Subtotal</ThemedText>
            <ThemedText type="body">${displayedSubtotal.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>Outsyde Service Fee (+8%)</ThemedText>
            <ThemedText type="body">${displayedServiceFee.toFixed(2)}</ThemedText>
          </View>
          <View style={[styles.row, { marginBottom: 0 }]}>
            <ThemedText type="h4">Total</ThemedText>
            <ThemedText type="h4" style={{ color: theme.brandGold }}>${displayedTotal.toFixed(2)}</ThemedText>
          </View>
          <ThemedText type="body" style={{ color: theme.brandSuccess, marginTop: Spacing.xs }}>
            You'll earn {displayedPoints} Outsyde Points
          </ThemedText>
        </View>

        {/* Confirm & Pay */}
        <Pressable
          onPress={handleCheckout}
          disabled={confirmDisabled}
          style={({ pressed }) => [
            styles.checkoutButton,
            {
              backgroundColor: confirmDisabled ? theme.brandPrimary + "66" : theme.brandPrimary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {checkoutLoading ? (
            <ActivityIndicator size="small" color={theme.brandPrimaryText} />
          ) : (
            <>
              <Feather name="credit-card" size={18} color={theme.brandPrimaryText} />
              <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>Confirm & Pay</ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

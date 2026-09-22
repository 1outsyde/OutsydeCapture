import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useStripePayment } from "@/hooks/useStripePayment";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiPost } from "@/api/client";
import { RootStackParamList } from "@/navigation/types";
import api, { ProductVariant } from "@/services/api";

type Route = RouteProp<RootStackParamList, "ProductDetail">;

const formatCents = (cents?: number | null): string => {
  if (cents == null || Number.isNaN(cents)) return "";
  return `$${Number(cents / 100).toFixed(2)}`;
};

export default function ProductDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const { getToken } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

  const {
    id,
    businessId,
    name,
    description,
    priceCents,
    imageUrl,
    inventory,
  } = route.params;

  const isOutOfStock = inventory === 0;
  const hasInventoryCap = inventory != null && inventory > 0;

  const [quantity, setQuantity] = useState(1);
  const [buyingNow, setBuyingNow] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [variantsLoading, setVariantsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setVariantsLoading(true);
      try {
        const product = await api.getProductWithVariants(String(id));
        if (!cancelled) setVariants(product.variants ?? []);
      } catch {
        if (!cancelled) setVariants([]);
      } finally {
        if (!cancelled) setVariantsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const effectiveInventory =
    selectedVariant?.inventory !== undefined && selectedVariant?.inventory !== null
      ? selectedVariant.inventory
      : inventory;

  const effectiveHasInventoryCap = effectiveInventory != null && effectiveInventory > 0;

  const decrement = () => setQuantity((q) => Math.max(1, q - 1));
  const increment = () => {
    setQuantity((q) => (effectiveHasInventoryCap ? Math.min(effectiveInventory!, q + 1) : q + 1));
  };

  const canAddToCart =
    !isOutOfStock &&
    (variants.length === 0 || selectedVariant !== null);

  const handleAddToCart = () => {
    if (!canAddToCart) return;

    addItem({
      productId: String(id),
      name,
      price: selectedVariant ? selectedVariant.priceCents : priceCents,
      quantity,
      vendorId: businessId,
      imageUrl: imageUrl ?? undefined,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant?.label,
    });

    // Toast: fade in → hold → fade out
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToastVisible(true);
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start(() => {
      toastTimeout.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          setToastVisible(false);
        });
      }, 1200);
    });
  };

  const handleBuyNow = async () => {
    if (!canAddToCart || buyingNow) return;

    const token = await getToken();
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to buy this product.");
      return;
    }

    setBuyingNow(true);
    try {
      const unitPriceCents = selectedVariant ? selectedVariant.priceCents : priceCents;
      const paymentIntentResponse = await apiPost(
        "/api/cart/payment-intent",
        {
          items: [
            {
              productId: String(id),
              vendorId: businessId,
              priceCents: unitPriceCents,
              quantity,
              name,
            },
          ],
          vendorId: businessId,
          isEphemeral: true,
        },
        token
      ) as { clientSecret?: string };

      const clientSecret = paymentIntentResponse?.clientSecret;
      if (!clientSecret) throw new Error("Missing clientSecret");

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Outsyde",
        paymentIntentClientSecret: clientSecret,
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if ((presentError as { code?: string }).code === "Canceled") {
          Alert.alert("Payment cancelled.");
          return;
        }
        throw new Error(presentError.message);
      }

      Alert.alert("Order placed!", undefined, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("ADDRESS_REQUIRED")) {
        Alert.alert(
          "Shipping Address Required",
          "Please add a shipping address to continue."
        );
      } else if (message.includes("INVALID_ADDRESS")) {
        Alert.alert(
          "Invalid Address",
          "Please check your shipping address and try again."
        );
      } else if (message.includes("STRIPE_NOT_ONBOARDED")) {
        Alert.alert(
          "Vendor Unavailable",
          "This item cannot be purchased at this time. Please try again later, or contact support."
        );
      } else {
        Alert.alert(
          "Checkout Failed",
          "Something went wrong. Please try again or contact support if the issue continues."
        );
      }
    } finally {
      setBuyingNow(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.brandBg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color={theme.brandCream} />
        </Pressable>
        <ThemedText type="h4" style={{ flex: 1, marginLeft: Spacing.sm }} numberOfLines={1}>
          {name || "Product"}
        </ThemedText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={["#2a2a2a", "#111111"]}
              style={StyleSheet.absoluteFillObject}
            />
          )}
        </View>

        <View style={styles.body}>
          {/* Name + price */}
          <ThemedText type="h3">{name}</ThemedText>
          <ThemedText
            type="h4"
            style={[styles.price, { color: theme.brandGold }]}
          >
            {formatCents(selectedVariant ? selectedVariant.priceCents : priceCents)}
          </ThemedText>

          {/* Description */}
          {description ? (
            <ThemedText
              type="body"
              style={[styles.description, { color: theme.brandTextDim }]}
            >
              {description}
            </ThemedText>
          ) : null}

          {/* Variant pill selector */}
          {variants.length > 0 && (
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={{
                fontSize: 13,
                color: theme.brandTextDim,
                marginBottom: Spacing.sm,
                letterSpacing: 0.5,
              }}>
                Choose an option
              </Text>
              {variantsLoading ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[80, 64, 96].map((w) => (
                    <View key={w} style={{
                      width: w, height: 36, borderRadius: 20,
                      backgroundColor: theme.brandSurface, opacity: 0.4,
                    }} />
                  ))}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                >
                  {variants.map((v: ProductVariant) => {
                    const selected = selectedVariant?.id === v.id;
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => setSelectedVariant(selected ? null : v)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          minHeight: 44,
                          justifyContent: "center",
                          borderRadius: BorderRadius.full,
                          borderWidth: 1.5,
                          borderColor: selected ? theme.brandGold : "rgba(255,255,255,0.2)",
                          backgroundColor: selected ? "rgba(201,147,58,0.15)" : "transparent",
                        }}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: selected ? "600" : "400",
                          color: selected ? theme.brandGold : theme.brandCream,
                        }}>
                          {v.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Inventory status */}
          {isOutOfStock ? (
            <View style={[styles.outOfStockBadge, { backgroundColor: theme.brandSurface }]}>
              <Feather name="x-circle" size={14} color={theme.brandError ?? "#FF3B30"} />
              <ThemedText
                type="caption"
                style={{ color: theme.brandError ?? "#FF3B30", marginLeft: Spacing.xs }}
              >
                Out of stock
              </ThemedText>
            </View>
          ) : hasInventoryCap ? (
            <ThemedText type="caption" style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
              {inventory} in stock
            </ThemedText>
          ) : null}

          {/* Quantity stepper */}
          <View style={styles.stepperRow}>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              Quantity
            </ThemedText>
            <View style={styles.stepper}>
              <Pressable
                onPress={decrement}
                disabled={isOutOfStock || quantity <= 1}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  { backgroundColor: theme.brandSurface, opacity: (isOutOfStock || quantity <= 1) ? 0.4 : pressed ? 0.7 : 1 },
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="minus" size={16} color={theme.brandCream} />
              </Pressable>
              <ThemedText type="h4" style={styles.stepperCount}>
                {quantity}
              </ThemedText>
              <Pressable
                onPress={increment}
                disabled={isOutOfStock || (hasInventoryCap && quantity >= inventory!)}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: theme.brandSurface,
                    opacity: (isOutOfStock || (hasInventoryCap && quantity >= inventory!)) ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="plus" size={16} color={theme.brandCream} />
              </Pressable>
            </View>
          </View>

          {/* Buy Now + Add to Cart */}
          <View
            style={[
              styles.ctaBlock,
              {
                backgroundColor: theme.gray,
                borderColor: "rgba(255,255,255,0.06)",
                opacity: canAddToCart ? 1 : 0.4,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleBuyNow}
              disabled={!canAddToCart || buyingNow}
              accessibilityLabel="Buy Now — instant purchase, skips cart"
              style={[
                styles.buyNowButton,
                { backgroundColor: theme.brandGold },
              ]}
            >
              <View style={styles.ctaRow}>
                <Text style={[styles.buyNowEmoji, { color: theme.black }]}>⚡</Text>
                <Text style={[styles.buyNowText, { color: theme.black }]}>
                  {buyingNow ? "Processing…" : "Buy Now"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAddToCart}
              disabled={!canAddToCart}
              accessibilityLabel="Add to Cart"
              style={[
                styles.addToCartButton,
                { borderColor: theme.brandGold },
              ]}
            >
              <View style={styles.ctaRow}>
                <Feather name="shopping-cart" size={14} color={theme.brandGold} />
                <Text style={[styles.addToCartText, { color: theme.brandGold }]}>
                  {isOutOfStock
                    ? "Out of Stock"
                    : variants.length > 0 && selectedVariant === null
                      ? "Select an option"
                      : "Add to Cart"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Toast */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 90,
              opacity: toastAnim,
            },
          ]}
        >
          <Text style={styles.toastText}>Added to Cart</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    width: "100%",
    height: 280,
    backgroundColor: "#1a1a1a",
    overflow: "hidden",
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  price: {
    marginTop: Spacing.xs,
  },
  description: {
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  outOfStockBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperCount: {
    minWidth: 28,
    textAlign: "center",
  },
  ctaBlock: {
    marginTop: Spacing.xl,
    marginBottom: 16,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  buyNowButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 8,
  },
  buyNowEmoji: {
    fontSize: 14,
  },
  buyNowText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.01,
  },
  addToCartButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  addToCartText: {
    fontSize: 14,
    fontWeight: "700",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.88)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: {
    color: "#F5F0E6",
    fontWeight: "700",
    fontSize: 14,
  },
});

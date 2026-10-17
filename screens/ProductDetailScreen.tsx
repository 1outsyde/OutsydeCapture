import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useCart } from "@/context/CartContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { ProductVariant } from "@/services/api";

type Route = RouteProp<RootStackParamList, "ProductDetail">;

const formatCents = (cents?: number | null): string => {
  if (cents == null || Number.isNaN(cents)) return "";
  return `$${Number(cents / 100).toFixed(2)}`;
};

export default function ProductDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();

  const {
    id,
    businessId,
    name,
    description,
    priceCents,
    imageUrl,
    inventory,
  } = route.params;

  const { width: screenWidth } = useWindowDimensions();

  const [quantity, setQuantity] = useState(1);
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [variantsLoading, setVariantsLoading] = useState(Boolean(id));

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

  // ── Stock ────────────────────────────────────────────────────────────────
  // A variant with its own stock count uses it; a variant without one falls
  // back to the product's count (same rule as the backend's decrementInventory).
  const variantStock = (v: ProductVariant): number | null | undefined => {
    if (v.trackInventory === false) return null;
    return v.inventory !== undefined && v.inventory !== null ? v.inventory : inventory;
  };
  const isVariantSoldOut = (v: ProductVariant): boolean => variantStock(v) === 0;

  const hasVariants = variants.length > 0;
  const isOutOfStock = hasVariants ? variants.every(isVariantSoldOut) : inventory === 0;

  const effectiveInventory = selectedVariant ? variantStock(selectedVariant) : inventory;
  const effectiveHasInventoryCap = effectiveInventory != null && effectiveInventory > 0;

  // ── Price: selected variant, else "From $lowest" when prices differ ──────
  const variantPrices = variants.map((v) => v.priceCents);
  const minVariantPrice = hasVariants ? Math.min(...variantPrices) : null;
  const maxVariantPrice = hasVariants ? Math.max(...variantPrices) : null;
  const displayPrice = selectedVariant
    ? formatCents(selectedVariant.priceCents)
    : hasVariants && minVariantPrice !== null
    ? minVariantPrice !== maxVariantPrice
      ? `From ${formatCents(minVariantPrice)}`
      : formatCents(minVariantPrice)
    : formatCents(priceCents);

  // ── Option grid: 4 per row for short labels (lengths, sizes), fewer when
  //    labels are long so nothing is cut off ─────────────────────────────────
  const longestLabel = variants.reduce((n, v) => Math.max(n, (v.label ?? "").length), 0);
  const optionColumns = longestLabel > 8 ? 2 : longestLabel > 4 ? 3 : 4;
  const optionGap = Spacing.sm;
  const optionChipWidth =
    (screenWidth - Spacing.lg * 2 - optionGap * (optionColumns - 1)) / optionColumns;

  const selectVariant = (v: ProductVariant) => {
    if (isVariantSoldOut(v)) return;
    setSelectedVariant(v);
    const stock = variantStock(v);
    if (stock != null && stock > 0) setQuantity((q) => Math.min(q, stock));
  };

  const decrement = () => setQuantity((q) => Math.max(1, q - 1));
  const increment = () => {
    setQuantity((q) => (effectiveHasInventoryCap ? Math.min(effectiveInventory!, q + 1) : q + 1));
  };
  const atMaxQuantity = effectiveHasInventoryCap && quantity >= effectiveInventory!;

  // Options must finish loading first, so a product with variants can't be
  // bought at its base price by tapping before the options appear.
  const canAddToCart =
    !variantsLoading &&
    !isOutOfStock &&
    (!hasVariants || (selectedVariant !== null && !isVariantSoldOut(selectedVariant)));

  const stockLine: { text: string; low: boolean } | null = (() => {
    if (isOutOfStock) return null;
    if (hasVariants && !selectedVariant) return null;
    if (!effectiveHasInventoryCap) return null;
    const n = effectiveInventory!;
    if (n <= 3) {
      return {
        text: selectedVariant ? `Only ${n} left in ${selectedVariant.label}` : `Only ${n} left`,
        low: true,
      };
    }
    return { text: `${n} in stock`, low: false };
  })();

  const buyNowLabel = isOutOfStock
    ? "Out of Stock"
    : hasVariants && !selectedVariant
    ? "Select an option"
    : selectedVariant
    ? `Buy Now · ${selectedVariant.label}`
    : "Buy Now";

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

  const handleBuyNow = () => {
    if (!canAddToCart) return;
    navigation.navigate("CheckoutScreen", {
      mode: "buyNow",
      buyNowItem: {
        productId: String(id),
        name,
        priceCents: selectedVariant ? selectedVariant.priceCents : (priceCents ?? 0),
        quantity,
        vendorId: businessId,
        imageUrl: imageUrl ?? undefined,
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.label,
      },
    });
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
            {displayPrice}
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

          {/* Option picker */}
          {hasVariants && (
            <View style={styles.optionSection}>
              <Text style={[styles.optionHeading, { color: theme.brandCream }]}>
                {selectedVariant ? "OPTION: " : "CHOOSE AN OPTION"}
                {selectedVariant ? (
                  <Text style={{ color: theme.brandGold }}>{selectedVariant.label}</Text>
                ) : null}
              </Text>
              <View style={[styles.optionGrid, { gap: optionGap }]}>
                {variants.map((v: ProductVariant) => {
                  const selected = selectedVariant?.id === v.id;
                  const soldOut = isVariantSoldOut(v);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => selectVariant(v)}
                      disabled={soldOut}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: soldOut }}
                      accessibilityLabel={`${v.label}, ${soldOut ? "sold out" : formatCents(v.priceCents)}`}
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          width: optionChipWidth,
                          borderWidth: selected ? 2 : 1,
                          borderStyle: soldOut ? "dashed" : "solid",
                          borderColor: selected
                            ? theme.brandGold
                            : soldOut
                            ? "rgba(255,255,255,0.15)"
                            : theme.brandSurfaceBorder,
                          backgroundColor: selected
                            ? "rgba(232,185,48,0.14)"
                            : soldOut
                            ? "transparent"
                            : theme.brandSurface,
                          opacity: pressed && !soldOut ? 0.75 : 1,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[
                          styles.optionLabel,
                          {
                            color: selected
                              ? theme.brandGold
                              : soldOut
                              ? theme.brandTextDim
                              : theme.brandCream,
                            textDecorationLine: soldOut ? "line-through" : "none",
                          },
                        ]}
                      >
                        {v.label}
                      </Text>
                      <Text style={[styles.optionPrice, { color: theme.brandTextDim }]}>
                        {soldOut ? "Sold out" : formatCents(v.priceCents)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
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
          ) : stockLine ? (
            <ThemedText
              type="caption"
              style={{
                color: stockLine.low ? theme.brandPending : theme.brandTextDim,
                marginTop: Spacing.sm,
              }}
            >
              {stockLine.text}
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
                disabled={isOutOfStock || atMaxQuantity}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: theme.brandSurface,
                    opacity: (isOutOfStock || atMaxQuantity) ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="plus" size={16} color={theme.brandCream} />
              </Pressable>
            </View>
          </View>

          {/* ── Dual CTA block ── */}
          <View
            style={{
              backgroundColor: theme.brandSurface,
              borderRadius: BorderRadius.lg,
              padding: Spacing.sm,
              marginTop: Spacing.xl,
              borderWidth: 1,
              borderColor: theme.brandSurfaceBorder,
              gap: Spacing.sm,
            }}
          >
            {/* Buy Now — primary */}
            <Pressable
              onPress={handleBuyNow}
              disabled={!canAddToCart}
              accessibilityLabel="Buy Now — instant purchase, skips cart"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: Spacing.sm,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.full,
                backgroundColor: canAddToCart ? theme.brandGold : theme.brandSurface,
                opacity: !canAddToCart ? 0.4 : pressed ? 0.85 : 1,
              })}
            >
              <Feather
                name="zap"
                size={16}
                color={canAddToCart ? "#000000" : (theme.brandTextDim ?? "#999")}
              />
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  fontSize: 16,
                  fontWeight: "900",
                  letterSpacing: -0.3,
                  color: canAddToCart ? "#000000" : (theme.brandTextDim ?? "#999"),
                }}
              >
                {buyNowLabel}
              </Text>
            </Pressable>

            {/* Add to Cart — secondary */}
            <Pressable
              onPress={handleAddToCart}
              disabled={!canAddToCart}
              accessibilityLabel="Add to Cart"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: Spacing.sm,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.full,
                borderWidth: 1.5,
                borderColor: canAddToCart ? theme.brandGold : theme.brandSurfaceBorder,
                backgroundColor: "transparent",
                opacity: !canAddToCart ? 0.4 : pressed ? 0.7 : 1,
              })}
            >
              <Feather
                name="shopping-cart"
                size={16}
                color={canAddToCart ? theme.brandGold : (theme.brandTextDim ?? "#999")}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: canAddToCart ? theme.brandGold : (theme.brandTextDim ?? "#999"),
                }}
              >
                Add to Cart
              </Text>
            </Pressable>
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
  optionSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  optionHeading: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  optionChip: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "800",
  },
  optionPrice: {
    fontSize: 11,
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

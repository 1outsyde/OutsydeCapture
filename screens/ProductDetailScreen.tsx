import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
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
  const navigation = useNavigation();
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

  const isOutOfStock = inventory === 0;
  const hasInventoryCap = inventory != null && inventory > 0;

  const [quantity, setQuantity] = useState(1);
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

  const handleAddToCart = () => {
    if (isOutOfStock) return;

    addItem({
      productId: String(id),
      name,
      price: priceCents,
      quantity,
      vendorId: businessId,
      imageUrl: imageUrl ?? undefined,
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
            {formatCents(priceCents)}
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

          {/* Add to Cart button */}
          <Pressable
            onPress={handleAddToCart}
            disabled={isOutOfStock}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: isOutOfStock
                  ? theme.brandSurface
                  : theme.brandGold,
                opacity: pressed && !isOutOfStock ? 0.85 : 1,
              },
            ]}
          >
            <Feather
              name="shopping-cart"
              size={18}
              color={isOutOfStock ? (theme.brandTextDim ?? "#999") : "#000"}
            />
            <Text
              style={[
                styles.addButtonText,
                { color: isOutOfStock ? (theme.brandTextDim ?? "#999") : "#000" },
              ]}
            >
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </Text>
          </Pressable>
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
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

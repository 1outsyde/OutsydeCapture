import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { productSaveTarget } from "@/utils/savedFavorites";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { ProductOption, ProductVariant } from "@/services/api";
import { customerStock } from "@/utils/productStock";
import {
  findVariant,
  initialPicks,
  isColorOption,
  liveVariants,
  photoFor,
  pick,
  sortedOptions,
  stockOf,
  swatchFor,
  uniformPriceFor,
  valueState,
  type Picks,
} from "@/components/products/productPickerLogic";
import {
  addonsLabel,
  addonsPerUnitCents,
  countInGroup,
  emptyPicks,
  groupHint,
  missingPick,
  pickedAddons,
  setPickText,
  togglePick,
  type AddonPicks,
  type PublicAddonGroup,
} from "@/components/products/productAddonLogic";

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
  const { user, isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  const {
    id,
    businessId,
    name,
    description,
    priceCents,
    imageUrl,
    inventory: inventoryParam,
  } = route.params;
  // Save button (one Saved place, backend #378). Not shown on the business's own products.
  const saveTarget = productSaveTarget({ id, businessId, name, imageUrl, priceCents }, user?.businessId);
  const isSaved = !!saveTarget && isFavorite(saveTarget.id, "product");
  const handleSaveToggle = () => {
    if (!saveTarget) return;
    if (!isAuthenticated) {
      navigation.navigate("Auth" as any, {} as any);
      return;
    }
    toggleFavorite(saveTarget);
  };
  // Product stock that limits a purchase (null = no limit). The card's number is used until the
  // product loads; then the product's own tracking decides (No limit products never sell out).
  const [inventory, setInventory] = useState<number | null | undefined>(inventoryParam);

  const { width: screenWidth } = useWindowDimensions();

  const [quantity, setQuantity] = useState(1);
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [variantsLoading, setVariantsLoading] = useState(Boolean(id));
  // Products with options (Length, Size, Color) get one picker per option.
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [picks, setPicks] = useState<Picks>([]);
  // Add-ons (backend #371): extras on top of the product, priced per unit.
  const [addonGroups, setAddonGroups] = useState<PublicAddonGroup[]>([]);
  const [addonPicks, setAddonPicks] = useState<AddonPicks>(emptyPicks());
  const [addonLimitGroupId, setAddonLimitGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setVariantsLoading(true);
      try {
        const product = await api.getProductWithVariants(String(id));
        if (!cancelled) {
          const loadedVariants = product.variants ?? [];
          setInventory(customerStock(product));
          const loadedOptions = sortedOptions(product.options);
          setVariants(loadedVariants);
          // Use the per-option pickers only when the variations are built from options.
          const useOptions = loadedOptions.length > 0 && liveVariants(loadedVariants).length > 0;
          setOptions(useOptions ? loadedOptions : []);
          setPicks(useOptions ? initialPicks(loadedOptions) : []);
          setAddonGroups(
            Array.isArray(product.addonGroups)
              ? product.addonGroups.filter((g) => Array.isArray(g.addons) && g.addons.length > 0)
              : [],
          );
          setAddonPicks(emptyPicks());
        }
      } catch {
        if (!cancelled) {
          setVariants([]);
          setOptions([]);
          setPicks([]);
          setAddonGroups([]);
          setAddonPicks(emptyPicks());
        }
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
  const variantStock = (v: ProductVariant): number | null | undefined =>
    stockOf(v, inventory);
  const isVariantSoldOut = (v: ProductVariant): boolean => variantStock(v) === 0;

  const optionMode = options.length > 0;
  // In option mode the bought variation is the one matching every pick;
  // otherwise it is the tapped chip (older label-only variations).
  const activeVariant: ProductVariant | null = optionMode
    ? (findVariant(variants, picks, options.length) as ProductVariant | null)
    : selectedVariant;
  const buyableVariants = optionMode ? (liveVariants(variants) as ProductVariant[]) : variants;

  const hasVariants = buyableVariants.length > 0;
  const isOutOfStock = hasVariants ? buyableVariants.every(isVariantSoldOut) : inventory === 0;

  const shownImageUrl = (optionMode ? photoFor(variants, picks, activeVariant) : null) ?? imageUrl;


  // ── Price: selected variant, else "From $lowest" when prices differ ──────
  const variantPrices = buyableVariants.map((v) => v.priceCents);
  const minVariantPrice = hasVariants ? Math.min(...variantPrices) : null;
  const maxVariantPrice = hasVariants ? Math.max(...variantPrices) : null;
  const displayPrice = activeVariant
    ? formatCents(activeVariant.priceCents)
    : hasVariants && minVariantPrice !== null
    ? minVariantPrice !== maxVariantPrice
      ? `From ${formatCents(minVariantPrice)}`
      : formatCents(minVariantPrice)
    : formatCents(priceCents);

  // ── Add-ons: per unit price = product (or picked variation) + picked add-ons ──
  const hasAddons = addonGroups.length > 0;
  const chosenAddons = hasAddons ? pickedAddons(addonGroups, addonPicks) : [];
  const addonsCents = addonsPerUnitCents(chosenAddons);
  const basePriceCents = activeVariant ? activeVariant.priceCents : (priceCents ?? 0);
  const unitPriceCents = basePriceCents + addonsCents;
  const addonProblem = hasAddons ? missingPick(addonGroups, addonPicks) : null;
  const tapAddon = (addonId: string, groupId: string) => {
    const r = togglePick(addonGroups, addonPicks, addonId);
    setAddonPicks(r.picks);
    setAddonLimitGroupId(r.limitReached ? groupId : null);
  };
  const formatAddonPrice = (cents: number) => (cents > 0 ? `+${formatCents(cents)}` : "Free");

  // ── Option grid: 4 per row for short labels (lengths, sizes), fewer when
  //    labels are long so nothing is cut off ─────────────────────────────────
  const longestLabel = buyableVariants.reduce((n, v) => Math.max(n, (v.label ?? "").length), 0);
  const optionColumns = longestLabel > 8 ? 2 : longestLabel > 4 ? 3 : 4;
  const optionGap = Spacing.sm;
  const optionChipWidth =
    (screenWidth - Spacing.lg * 2 - optionGap * (optionColumns - 1)) / optionColumns;

  const selectVariant = (v: ProductVariant) => {
    if (isVariantSoldOut(v)) return;
    setSelectedVariant(v);
  };

  // Product stock only limits variations when the product tracks it (same as checkout).
  const productStockForPicker = inventory ?? null;
  const pickOption = (optionIndex: number, value: string) => {
    const state = valueState(variants, picks, optionIndex, value, productStockForPicker);
    if (state === "unavailable" && !picks.some((p, i) => i !== optionIndex && p)) return;
    // Tapping a value that doesn't fit the other picks starts over from that value.
    const base = state === "available" ? picks : picks.map((p, i) => (i === optionIndex ? p : null));
    const next = pick(variants, base, optionIndex, value, productStockForPicker);
    setPicks(next);
  };
  const firstUnpicked = optionMode ? options.find((_, i) => !picks[i]) : undefined;
  // A price under each chip only helps when prices differ (Dia Lux lengths), not 15 colors at one price.
  const pricesDiffer = (() => {
    const set = new Set(buyableVariants.map((v) => v.priceCents));
    return set.size > 1;
  })();

  // Stock is never shown to customers (Legend 2026-10-28), not even by where the quantity stops:
  // any quantity can be picked, and checkout says "not enough left" (no count) when it is too many.
  const MAX_QUANTITY = 99;
  const decrement = () => setQuantity((q) => Math.max(1, q - 1));
  const increment = () => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1));
  const atMaxQuantity = quantity >= MAX_QUANTITY;

  // Options must finish loading first, so a product with variants can't be
  // bought at its base price by tapping before the options appear.
  const variationReady =
    !variantsLoading &&
    !isOutOfStock &&
    (!hasVariants || (activeVariant !== null && !isVariantSoldOut(activeVariant)));
  const canAddToCart = variationReady && !addonProblem;
  // Stock counts are not shown to customers (Legend 2026-10-28): only "Out of stock" / "Sold out".

  const buyNowLabel = isOutOfStock
    ? "Out of Stock"
    : firstUnpicked
    ? `Choose ${firstUnpicked.name.toLowerCase()}`
    : hasVariants && !activeVariant
    ? "Select an option"
    : addonProblem
    ? addonProblem
    : hasAddons
    ? `Buy Now · ${formatCents(unitPriceCents * quantity)}`
    : activeVariant
    ? `Buy Now · ${activeVariant.label}`
    : "Buy Now";

  // Products with add-on groups always carry the list (even empty), so checkout checks it.
  const addonFields = hasAddons
    ? { addons: chosenAddons, ...(chosenAddons.length > 0 ? { addonsLabel: addonsLabel(chosenAddons) } : {}) }
    : {};

  const handleAddToCart = () => {
    if (!canAddToCart) return;

    addItem({
      productId: String(id),
      name,
      price: hasAddons ? unitPriceCents : activeVariant ? activeVariant.priceCents : priceCents,
      quantity,
      vendorId: businessId,
      imageUrl: shownImageUrl ?? undefined,
      variantId: activeVariant?.id,
      variantLabel: activeVariant?.label,
      ...addonFields,
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
        priceCents: hasAddons ? unitPriceCents : activeVariant ? activeVariant.priceCents : (priceCents ?? 0),
        quantity,
        vendorId: businessId,
        imageUrl: shownImageUrl ?? undefined,
        variantId: activeVariant?.id,
        variantLabel: activeVariant?.label,
        ...addonFields,
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
        {saveTarget ? (
          <Pressable
            onPress={handleSaveToggle}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSaved }}
            accessibilityLabel={isSaved ? `Remove ${name || "this product"} from Saved` : `Save ${name || "this product"}`}
            testID="product-save"
          >
            <Feather name="bookmark" size={20} color={isSaved ? theme.brandGold : theme.brandCream} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product image */}
        <View style={styles.imageContainer}>
          {shownImageUrl ? (
            <Image
              source={{ uri: shownImageUrl }}
              transition={150}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={["#2a2a2a", "#111111"]}
              style={StyleSheet.absoluteFill}
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

          {/* Option pickers: one row per option (Length, Size, Color) */}
          {optionMode &&
            options.map((option, optionIndex) => {
              const picked = picks[optionIndex];
              const asSwatches = isColorOption(option);
              const showChipPrice = pricesDiffer && optionIndex === 0;
              const longest = option.values.reduce((n, ov) => Math.max(n, ov.value.length), 0);
              const cols = longest > 8 ? 2 : longest > 4 ? 3 : 4;
              const chipWidth = (screenWidth - Spacing.lg * 2 - optionGap * (cols - 1)) / cols;
              return (
                <View key={`${option.position}-${option.name}`} style={styles.optionSection}>
                  <Text style={[styles.optionHeading, { color: theme.brandCream }]}>
                    {picked ? `${option.name.toUpperCase()}: ` : `CHOOSE ${option.name.toUpperCase()}`}
                    {picked ? <Text style={{ color: theme.brandGold }}>{picked}</Text> : null}
                  </Text>
                  <View style={[styles.optionGrid, { gap: asSwatches ? Spacing.md : optionGap }]}>
                    {option.values.map((ov) => {
                      const selected = !!picked && picked.toLowerCase() === ov.value.toLowerCase();
                      const state = valueState(variants, picks, optionIndex, ov.value, productStockForPicker);
                      const blocked = state !== "available";
                      const chipPrice = showChipPrice ? uniformPriceFor(variants, optionIndex, ov.value) : null;
                      const a11y = `${option.name} ${ov.value}${
                        state === "soldout" ? ", sold out" : state === "unavailable" ? ", not available with this pick" : chipPrice != null ? `, ${formatCents(chipPrice)}` : ""
                      }`;
                      if (asSwatches) {
                        return (
                          <Pressable
                            key={ov.value}
                            onPress={() => pickOption(optionIndex, ov.value)}
                            disabled={state === "soldout"}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: blocked }}
                            accessibilityLabel={a11y}
                            style={({ pressed }) => [
                              styles.swatchRing,
                              {
                                borderColor: selected ? theme.brandGold : "transparent",
                                opacity: blocked ? 0.35 : pressed ? 0.75 : 1,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.swatch,
                                { backgroundColor: swatchFor(ov) ?? theme.brandSurface, borderColor: theme.brandSurfaceBorder },
                              ]}
                            />
                            {blocked ? <View pointerEvents="none" style={[styles.swatchSlash, { backgroundColor: theme.brandCream }]} /> : null}
                          </Pressable>
                        );
                      }
                      return (
                        <Pressable
                          key={ov.value}
                          onPress={() => pickOption(optionIndex, ov.value)}
                          disabled={state === "soldout"}
                          accessibilityRole="button"
                          accessibilityState={{ selected, disabled: blocked }}
                          accessibilityLabel={a11y}
                          style={({ pressed }) => [
                            styles.optionChip,
                            {
                              width: chipWidth,
                              height: showChipPrice ? 56 : 46,
                              borderWidth: selected ? 2 : 1,
                              borderStyle: blocked ? "dashed" : "solid",
                              borderColor: selected
                                ? theme.brandGold
                                : blocked
                                ? "rgba(255,255,255,0.15)"
                                : theme.brandSurfaceBorder,
                              backgroundColor: selected
                                ? "rgba(232,185,48,0.14)"
                                : blocked
                                ? "transparent"
                                : theme.brandSurface,
                              opacity: pressed && !blocked ? 0.75 : 1,
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={[
                              styles.optionLabel,
                              {
                                color: selected ? theme.brandGold : blocked ? theme.brandTextDim : theme.brandCream,
                                textDecorationLine: blocked ? "line-through" : "none",
                              },
                            ]}
                          >
                            {ov.value}
                          </Text>
                          {showChipPrice || state === "soldout" ? (
                            <Text style={[styles.optionPrice, { color: theme.brandTextDim }]}>
                              {state === "soldout" ? "Sold out" : chipPrice != null ? formatCents(chipPrice) : ""}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

          {/* Option picker (older variations with a label only) */}
          {!optionMode && hasVariants && (
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
          ) : null}

          {/* Add-ons: extras on top of the product (toppings, a name on the cake) */}
          {hasAddons &&
            addonGroups.map((group) => {
              const count = countInGroup(group, addonPicks);
              const pickOne = group.maxSelect === 1;
              return (
                <View key={group.id} style={styles.optionSection}>
                  <View style={styles.addonHeadingRow}>
                    <Text style={[styles.optionHeading, { color: theme.brandCream, flexShrink: 1 }]}>
                      {group.name.toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        styles.addonHint,
                        { color: group.minSelect > 0 && count < group.minSelect ? theme.brandGold : theme.brandTextDim },
                      ]}
                    >
                      {groupHint(group)}
                    </Text>
                  </View>
                  {group.addons.map((addon) => {
                    const selected = addonPicks.ids.includes(addon.id);
                    const text = addonPicks.text[addon.id] ?? "";
                    return (
                      <View key={addon.id}>
                        <Pressable
                          onPress={() => tapAddon(addon.id, group.id)}
                          accessibilityRole={pickOne ? "radio" : "checkbox"}
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={`${addon.name}, ${formatAddonPrice(addon.priceCents)}`}
                          style={({ pressed }) => [
                            styles.addonRow,
                            {
                              backgroundColor: selected ? "rgba(232,185,48,0.14)" : theme.brandSurface,
                              borderColor: selected ? theme.brandGold : theme.brandSurfaceBorder,
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.addonName, { color: theme.brandCream }]}>{addon.name}</Text>
                            {addon.description ? (
                              <Text style={[styles.addonDesc, { color: theme.brandTextDim }]}>{addon.description}</Text>
                            ) : null}
                          </View>
                          <Text style={[styles.addonPrice, { color: selected ? theme.brandGold : theme.brandTextDim }]}>
                            {formatAddonPrice(addon.priceCents)}
                          </Text>
                          <View
                            style={[
                              pickOne ? styles.addonRadio : styles.addonCheck,
                              {
                                borderColor: selected ? theme.brandGold : theme.brandSurfaceBorder,
                                backgroundColor: selected ? theme.brandGold : "transparent",
                              },
                            ]}
                          >
                            {selected ? <Feather name="check" size={13} color="#000000" /> : null}
                          </View>
                        </Pressable>
                        {selected && addon.acceptsText ? (
                          <View style={{ marginTop: Spacing.xs }}>
                            <TextInput
                              value={text}
                              onChangeText={(t) => setAddonPicks((p) => setPickText(p, addon.id, t.replace(/\n/g, " ")))}
                              placeholder={addon.textLabel || "Type it here"}
                              placeholderTextColor={theme.brandTextDim}
                              maxLength={addon.textMaxLength + 20}
                              accessibilityLabel={addon.textLabel || addon.name}
                              style={[
                                styles.addonInput,
                                { color: theme.brandCream, borderColor: theme.brandSurfaceBorder, backgroundColor: theme.brandBg },
                              ]}
                            />
                            <Text
                              style={[
                                styles.addonCounter,
                                { color: [...text.trim()].length > addon.textMaxLength ? (theme.brandError ?? "#FF3B30") : theme.brandTextDim },
                              ]}
                            >
                              {[...text.trim()].length}/{addon.textMaxLength}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  {addonLimitGroupId === group.id && group.maxSelect !== null ? (
                    <Text style={[styles.addonHint, { color: theme.brandGold }]}>
                      You can pick up to {group.maxSelect}. Tap one to remove it first.
                    </Text>
                  ) : null}
                </View>
              );
            })}

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

          {hasAddons ? (
            <View style={styles.totalRow}>
              <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                {addonsCents > 0 ? `${formatCents(basePriceCents)} + ${formatCents(addonsCents)} add-ons` : "Total"}
              </ThemedText>
              <ThemedText type="h4" style={{ color: theme.brandGold }}>
                {formatCents(unitPriceCents * quantity)}
              </ThemedText>
            </View>
          ) : null}

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
  // The whole 4:5 product photo, full width (photo ratios 2f).
  imageContainer: {
    width: "100%",
    aspectRatio: 4 / 5,
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
  swatchRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  swatchSlash: {
    position: "absolute",
    width: 44,
    height: 2,
    transform: [{ rotate: "-45deg" }],
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
  addonHeadingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  addonHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
  },
  addonName: {
    fontSize: 15,
    fontWeight: "700",
  },
  addonDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  addonPrice: {
    fontSize: 14,
    fontWeight: "700",
  },
  addonCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  addonRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  addonInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  addonCounter: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
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

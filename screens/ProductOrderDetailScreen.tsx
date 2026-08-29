import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { RatingBottomSheet } from "@/components/ratings";
import type { PurchaseItem, RatingCheckResponse } from "@/types/ratings";

type Route = RouteProp<RootStackParamList, "ProductOrderDetail">;

const STATUS_CONFIG: Record<string, { label: string; icon: "clock" | "truck" | "check-circle" | "x-circle"; color: string }> = {
  pending:    { label: "Payment Processing", icon: "clock",         color: "#FF9500" },
  paid:       { label: "Confirmed",          icon: "check-circle",  color: "#34C759" },
  processing: { label: "Processing",         icon: "clock",         color: "#FF9500" },
  shipped:    { label: "Shipped",            icon: "truck",         color: "#007AFF" },
  delivered:  { label: "Delivered",          icon: "check-circle",  color: "#34C759" },
  cancelled:  { label: "Cancelled",          icon: "x-circle",      color: "#FF3B30" },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function parseShippingAddress(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as { line1?: string; city?: string; state?: string; zipCode?: string };
  } catch {
    // unparseable — hide the section
  }
  return null;
}

const CARRIER_TRACKING_URLS: Record<string, (n: string) => string> = {
  UPS:   n => `https://www.ups.com/track?tracknum=${n}`,
  FedEx: n => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  USPS:  n => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  DHL:   n => `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
};

export default function ProductOrderDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(route.params.status);
  const [canRate, setCanRate] = useState(false);
  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [ratingCheckResult, setRatingCheckResult] = useState<RatingCheckResponse | null>(null);

  useEffect(() => {
    if (currentStatus !== "delivered" || !businessId) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const result = await api.checkRating(token, "business", businessId);
        setRatingCheckResult(result);
        setCanRate(result.canRate);
      } catch {
        // ignore — rate button simply won't appear
      }
    })();
  }, [currentStatus, businessId]);

  const {
    orderId,
    orderNumber,
    vendorName,
    businessId,
    status,
    items,
    totalAmount,
    grossChargeAmount,
    shippingAddress,
    createdAt,
    carrier,
    trackingNumber,
    estimatedDelivery,
    shipmentStatus,
  } = route.params;

  const orderRef = orderNumber != null
    ? `#${String(orderNumber).padStart(4, '0')}`
    : `#${orderId.slice(-8).toUpperCase()}`;

  const statusConfig = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.processing;

  const subtotalCents = totalAmount ?? 0;
  const totalCents = grossChargeAmount != null ? grossChargeAmount : subtotalCents;
  const feeCents = grossChargeAmount != null && grossChargeAmount > subtotalCents
    ? grossChargeAmount - subtotalCents
    : null;

  const parsedAddress = parseShippingAddress(shippingAddress);
  const hasTracking = !!(carrier || trackingNumber);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.brandBg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    section: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      overflow: "hidden",
    },
    sectionLabel: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
    },
    divider: { height: 1, backgroundColor: theme.brandSurfaceBorder, marginHorizontal: Spacing.md },
    statusPill: { flexDirection: "row", alignItems: "center", gap: 4 },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
    },
    productImage: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.brandSurfaceBorder,
    },
    productImagePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.brandGold + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    itemInfo: { flex: 1 },
    copyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    monospace: { fontFamily: "monospace", flexShrink: 1 },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      alignItems: "center",
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color={theme.brandCream} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <ThemedText type="h4" numberOfLines={1}>{vendorName}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
            {formatDate(createdAt)} · {orderRef}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing["2xl"] }}
      >
        {/* Status banner */}
        <View style={[styles.section, { marginBottom: Spacing.md }]}>
          <View style={[styles.row, { paddingVertical: Spacing.md }]}>
            <ThemedText type="body">Order Status</ThemedText>
            <View style={[styles.statusPill, { backgroundColor: statusConfig.color + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full }]}>
              <Feather name={statusConfig.icon} size={13} color={statusConfig.color} />
              <ThemedText type="caption" style={{ color: statusConfig.color, marginLeft: 4 }}>
                {statusConfig.label}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Items */}
        {items && items.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
              ITEMS
            </ThemedText>
            {items.map((item, i) => (
              <React.Fragment key={item.productId || i}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.itemRow}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Feather name="package" size={20} color={theme.brandGold} />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <ThemedText type="body" numberOfLines={2}>{item.name}</ThemedText>
                    {item.variantLabel ? (
                      <ThemedText type="caption" style={{ color: theme.brandTextDim, marginTop: 1 }}>
                        {item.variantLabel}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                      {item.quantity} × {formatCents(item.price)}
                    </ThemedText>
                  </View>
                  <ThemedText type="body">
                    {formatCents(item.price * item.quantity)}
                  </ThemedText>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Price breakdown */}
        <View style={styles.section}>
          <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
            PRICE BREAKDOWN
          </ThemedText>
          <View style={styles.row}>
            <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Subtotal</ThemedText>
            <ThemedText type="body">{formatCents(subtotalCents)}</ThemedText>
          </View>
          {feeCents != null && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Outsyde service fee</ThemedText>
                <ThemedText type="body">{formatCents(feeCents)}</ThemedText>
              </View>
            </>
          )}
          <View style={styles.divider} />
          <View style={[styles.row, { paddingVertical: Spacing.md }]}>
            <ThemedText type="body" style={{ fontWeight: "700" }}>Total</ThemedText>
            <ThemedText type="body" style={{ color: theme.brandGold, fontWeight: "700", fontSize: 16 }}>
              {formatCents(totalCents)}
            </ThemedText>
          </View>
        </View>

        {/* Shipping address */}
        {parsedAddress && (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
              SHIPPING ADDRESS
            </ThemedText>
            <View style={[styles.row, { flexDirection: "column", alignItems: "flex-start" }]}>
              {parsedAddress.line1 ? (
                <ThemedText type="body">{parsedAddress.line1}</ThemedText>
              ) : null}
              {(parsedAddress.city || parsedAddress.state || parsedAddress.zipCode) ? (
                <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                  {[parsedAddress.city, parsedAddress.state, parsedAddress.zipCode].filter(Boolean).join(", ")}
                </ThemedText>
              ) : null}
            </View>
          </View>
        )}

        {/* Tracking */}
        {hasTracking && (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
              TRACKING
            </ThemedText>
            {carrier && (
              <View style={styles.row}>
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Carrier</ThemedText>
                <ThemedText type="body">{carrier}</ThemedText>
              </View>
            )}
            {trackingNumber && (
              <>
                {carrier && <View style={styles.divider} />}
                <View style={styles.row}>
                  <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Tracking #</ThemedText>
                  <View style={styles.copyRow}>
                    <ThemedText type="caption" style={[styles.monospace, { color: theme.brandCream }]} numberOfLines={1}>
                      {trackingNumber}
                    </ThemedText>
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        await Clipboard.setStringAsync(trackingNumber);
                        Alert.alert("Copied", "Tracking number copied to clipboard.");
                      }}
                    >
                      <Feather name="copy" size={14} color={theme.brandTextDim} />
                    </Pressable>
                  </View>
                </View>
                {/* Phase 3a: Track Package button */}
                <View style={styles.divider} />
                <Pressable
                  style={({ pressed }) => ({
                    margin: Spacing.md,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: pressed ? "#142d28" : "#1A3C34",
                    alignItems: "center" as const,
                  })}
                  onPress={async () => {
                    const urlFn = carrier ? CARRIER_TRACKING_URLS[carrier] : undefined;
                    const url = urlFn
                      ? urlFn(trackingNumber)
                      : `https://google.com/search?q=${encodeURIComponent((carrier ?? '') + ' tracking ' + trackingNumber)}`;
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                      await Linking.openURL(url);
                    } else {
                      await Clipboard.setStringAsync(trackingNumber);
                      Alert.alert("Copied", "Tracking number copied — carrier site unavailable.");
                    }
                  }}
                >
                  <ThemedText type="caption" style={{ color: "#E8B930", fontWeight: "700" }}>
                    Track Package →
                  </ThemedText>
                </Pressable>
              </>
            )}
            {estimatedDelivery && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Est. Delivery</ThemedText>
                  <ThemedText type="body">{estimatedDelivery}</ThemedText>
                </View>
              </>
            )}
            {shipmentStatus && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Shipment Status</ThemedText>
                  <ThemedText type="body">{shipmentStatus}</ThemedText>
                </View>
              </>
            )}
          </View>
        )}

        {/* Phase 3b: Confirm Delivery button */}
        {currentStatus === "shipped" && (
          <View style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
            <Pressable
              disabled={confirmingDelivery}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: 10,
                backgroundColor: pressed || confirmingDelivery ? "#142d28" : "#1A3C34",
                alignItems: "center" as const,
                borderWidth: 1,
                borderColor: "#E8B930",
              })}
              onPress={() =>
                Alert.alert(
                  "Confirm Delivery?",
                  "Mark this order as delivered? This can't be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Confirm",
                      onPress: async () => {
                        setConfirmingDelivery(true);
                        try {
                          const token = await getToken();
                          if (!token) throw new Error("Not authenticated");
                          await api.confirmDelivery(token, orderId);
                          setCurrentStatus("delivered");
                          Alert.alert("Delivered", "Your order has been marked as delivered.");
                        } catch (err: any) {
                          Alert.alert("Error", err?.message || "Failed to confirm delivery.");
                        } finally {
                          setConfirmingDelivery(false);
                        }
                      },
                    },
                  ]
                )
              }
            >
              <ThemedText type="body" style={{ color: "#E8B930", fontWeight: "700" }}>
                {confirmingDelivery ? "Confirming…" : "Confirm Delivery"}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {/* Rate this vendor — shown after delivery if eligible */}
        {currentStatus === "delivered" && canRate && businessId && (
          <View style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
            <Pressable
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: 10,
                backgroundColor: pressed ? "#b07d2a" : "#C9933A",
                alignItems: "center" as const,
                flexDirection: "row" as const,
                justifyContent: "center" as const,
                gap: 8,
              })}
              onPress={() => setRatingSheetVisible(true)}
            >
              <Feather name="star" size={16} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
                Rate Your Order
              </ThemedText>
            </Pressable>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText type="caption" style={{ color: theme.brandTextDim, textAlign: "center" }}>
            Need help with this order? Contact support.
          </ThemedText>
        </View>
      </ScrollView>

      {businessId && (
        <RatingBottomSheet
          visible={ratingSheetVisible}
          onClose={() => setRatingSheetVisible(false)}
          onSubmit={async (rating, purchaseId, purchaseType) => {
            const token = await getToken();
            if (!token) throw new Error("Not authenticated");
            const purchases = ratingCheckResult?.purchases ?? [];
            const purchase = purchases.find(p => p.purchaseId === purchaseId) ?? purchases[0];
            if (!purchase) return;
            await api.submitRating(token, purchase.targetType, purchase.targetId, rating, purchaseId, purchaseType);
            setCanRate(false);
          }}
          targetType="business"
          targetId={businessId}
          targetName={vendorName}
          purchases={[{
            purchaseId: orderId,
            purchaseType: "order",
            targetId: businessId,
            targetType: "business",
            label: vendorName,
            date: createdAt,
          } as PurchaseItem]}
        />
      )}
    </View>
  );
}

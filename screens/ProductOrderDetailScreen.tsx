import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "ProductOrderDetail">;

const STATUS_CONFIG: Record<string, { label: string; icon: "clock" | "truck" | "check-circle"; color: string }> = {
  processing: { label: "Processing", icon: "clock",        color: "#FF9500" },
  shipped:    { label: "Shipped",    icon: "truck",         color: "#007AFF" },
  delivered:  { label: "Delivered", icon: "check-circle",  color: "#34C759" },
};

export default function ProductOrderDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const { orderId, vendorName, status, itemCount, expectedDate } = route.params;
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.processing;

  return (
    <View style={[styles.container, { backgroundColor: theme.brandBg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color={theme.brandCream} />
        </Pressable>
        <ThemedText type="h4" style={{ flex: 1, marginLeft: Spacing.sm }}>
          Order Details
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder }]}>
        <View style={styles.row}>
          <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Order ID</ThemedText>
          <ThemedText type="caption" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
            {orderId}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.brandSurfaceBorder }]} />

        <View style={styles.row}>
          <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Vendor</ThemedText>
          <ThemedText type="body" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
            {vendorName}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.brandSurfaceBorder }]} />

        <View style={styles.row}>
          <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Items</ThemedText>
          <ThemedText type="body">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.brandSurfaceBorder }]} />

        <View style={styles.row}>
          <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Status</ThemedText>
          <View style={styles.statusPill}>
            <Feather name={statusConfig.icon} size={13} color={statusConfig.color} />
            <ThemedText type="caption" style={{ color: statusConfig.color, marginLeft: 4 }}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        {expectedDate && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.brandSurfaceBorder }]} />
            <View style={styles.row}>
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                {status === "shipped" ? "Estimated Arrival" : "Expected"}
              </ThemedText>
              <ThemedText type="body">{expectedDate}</ThemedText>
            </View>
          </>
        )}
      </View>

      <ThemedText type="caption" style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.lg }}>
        Full order history and receipt will be available once order tracking is live.
      </ThemedText>
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
  card: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
  },
});

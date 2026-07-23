import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "OrderSuccess">;

export default function OrderSuccessScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const { vendorName, itemCount, totalCharged, pointsEarned } = route.params;

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.timing(contentOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const formattedTotal = totalCharged > 0
    ? `$${(totalCharged / 100).toFixed(2)}`
    : null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.brandBg,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    inner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
      gap: Spacing.lg,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: "#34C759" + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    heading: {
      textAlign: "center",
    },
    pointsBadge: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.brandGold + "20",
    },
    summaryCard: {
      width: "100%",
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    buttonStack: {
      width: "100%",
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.brandPrimary,
    },
    secondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }], opacity }]}>
          <Feather name="check" size={40} color="#34C759" />
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity, alignItems: "center", gap: Spacing.md, width: "100%" }}>
          <ThemedText type="h2" style={styles.heading}>Order placed!</ThemedText>

          {pointsEarned > 0 && (
            <View style={styles.pointsBadge}>
              <ThemedText type="body" style={{ color: theme.brandGold }}>
                You earned {pointsEarned} Outsyde Points
              </ThemedText>
            </View>
          )}

          <View style={styles.summaryCard}>
            {vendorName ? (
              <View style={styles.summaryRow}>
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>From</ThemedText>
                <ThemedText type="body">{vendorName}</ThemedText>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Items</ThemedText>
              <ThemedText type="body">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </ThemedText>
            </View>
            {formattedTotal && (
              <View style={styles.summaryRow}>
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>Total charged</ThemedText>
                <ThemedText type="body" style={{ color: theme.brandGold, fontWeight: "700" }}>
                  {formattedTotal}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.buttonStack}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() =>
                navigation.navigate("CartOrders", { openTab: "orders", _ts: Date.now() })
              }
            >
              <Feather name="package" size={16} color={theme.brandPrimaryText} />
              <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>View Orders</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => navigation.navigate("Main", { screen: "Home" })}
            >
              <Feather name="compass" size={16} color={theme.brandCream} />
              <ThemedText type="body" style={{ color: theme.brandCream }}>Continue Shopping</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

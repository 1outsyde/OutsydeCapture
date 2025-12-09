import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, NavigationProp } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";

import { Spacing, BorderRadius } from "@/constants/theme";
import { fetchVendors } from "@/api/vendors";
import { RootStackParamList } from "@/navigation/types";

type Nav = NavigationProp<RootStackParamList>;

export default function VendorsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();

  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = async () => {
    try {
      const response = await fetchVendors();

      // Your backend returns: { businesses: [...] }
      const parsed = response?.businesses ?? response ?? [];

      setVendors(parsed);
    } catch (err: any) {
      console.error("Vendor fetch error:", err);
      setError(err.message || "Failed to load businesses.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVendors();
  }, []);

  if (loading) {
    return (
      <ScreenScrollView>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="h4" style={{ marginTop: 20 }}>
          Loading local businesses…
        </ThemedText>
      </ScreenScrollView>
    );
  }

  if (error) {
    return (
      <ScreenScrollView>
        <ThemedText type="h4">Error: {error}</ThemedText>
      </ScreenScrollView>
    );
  }

  const renderVendorCard = (vendor: any, index: number) => {
    const isLeft = index % 2 === 0;

    return (
      <Pressable
        key={vendor.id}
        onPress={() => navigation.navigate("VendorDetail", { vendorId: vendor.id })}
        style={({ pressed }) => [
          styles.vendorCard,
          {
            backgroundColor: theme.backgroundDefault,
            marginRight: isLeft ? Spacing.sm : 0,
            marginLeft: isLeft ? 0 : Spacing.sm,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Image
          source={{ uri: vendor.coverImage || vendor.logo }}
          style={styles.vendorImage}
          contentFit="cover"
        />

        <View style={styles.vendorInfo}>
          <ThemedText type="h4" numberOfLines={1}>
            {vendor.name}
          </ThemedText>

          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {vendor.city || "Local Business"}
          </ThemedText>

          <View style={styles.vendorMeta}>
            <Feather name="star" size={12} color="#FFD700" />
            <ThemedText type="caption">
              {" "}{vendor.rating || "New"}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>
        Local Businesses
      </ThemedText>

      <View style={styles.grid}>
        {vendors.map((vendor, index) => renderVendorCard(vendor, index))}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  vendorCard: {
    width: "48%",
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  vendorImage: {
    width: "100%",
    height: 140,
    backgroundColor: "#eee",
  },
  vendorInfo: {
    padding: Spacing.md,
  },
  vendorMeta: {
    marginTop: Spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
});

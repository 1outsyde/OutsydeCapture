import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Pressable, ScrollView, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { fetchVendors } from "@/api/vendors";

export default function VendorsScreen() {
  const { theme } = useTheme();

  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadVendors = async () => {
    try {
      const data = await fetchVendors();
      setVendors(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVendors();
  }, []);

  if (loading) {
    return (
      <ScreenScrollView>
        <ThemedText type="h4">Loading marketplace…</ThemedText>
      </ScreenScrollView>
    );
  }

  if (error) {
    return (
      <ScreenScrollView>
        <ThemedText type="h4">Error loading vendors: {error}</ThemedText>
      </ScreenScrollView>
    );
  }

  const renderVendorCard = (vendor: any, index: number) => {
    const isLeftColumn = index % 2 === 0;

    return (
      <Pressable
        key={vendor.id}
        style={({ pressed }) => [
          styles.vendorCard,
          {
            backgroundColor: theme.backgroundDefault,
            marginRight: isLeftColumn ? Spacing.sm : 0,
            marginLeft: isLeftColumn ? 0 : Spacing.sm,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => console.log("Open vendor:", vendor.name)}
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
            {vendor.neighborhood || vendor.city || "Local Business"}
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedText type="h3" style={styles.sectionTitle}>
        Local Businesses  
      </ThemedText>

      <View style={styles.vendorGrid}>
        {vendors.map((vendor, index) => renderVendorCard(vendor, index))}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  vendorGrid: {
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
    aspectRatio: 1.2,
  },
  vendorInfo: {
    padding: Spacing.md,
  },
  vendorMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
});

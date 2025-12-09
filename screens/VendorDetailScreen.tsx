import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

import { fetchVendorById } from "@/api/vendors";
import { RootStackParamList } from "@/navigation/types";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

// ⭐ Correct TypeScript typing for navigation props
type Props = NativeStackScreenProps<RootStackParamList, "VendorDetail">;

export default function VendorDetailScreen({ route }: Props) {
  const { theme } = useTheme();

  // vendorId comes from navigation
  const { vendorId } = route.params;

  const [vendor, setVendor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendor();
  }, []);

  const loadVendor = async () => {
    try {
      const data = await fetchVendorById(vendorId);

      // Support both backend structures:
      // { business: {...}} or { ...vendor }
      setVendor(data.business ?? data);
    } catch (err) {
      console.error("Failed to load vendor:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !vendor) {
    return (
      <ScreenScrollView>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="h4" style={{ marginTop: 20 }}>
          Loading business…
        </ThemedText>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView>
      {/* Cover Image */}
      <Image
        source={{ uri: vendor.coverImage || vendor.logo }}
        style={styles.coverImage}
        contentFit="cover"
      />

      <View style={styles.content}>
        {/* Business Name */}
        <ThemedText type="h2">{vendor.name}</ThemedText>

        {/* City or fallback */}
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {vendor.city || "Local Business"}
        </ThemedText>

        {/* Rating */}
        <View style={styles.ratingRow}>
          <Feather name="star" size={16} color="#FFD700" />
          <ThemedText type="small">  {vendor.rating || "New"}</ThemedText>
        </View>

        {/* Description */}
        {vendor.description ? (
          <ThemedText style={styles.description}>{vendor.description}</ThemedText>
        ) : null}

        {/* Products Section */}
        <ThemedText type="h3" style={styles.sectionTitle}>Products</ThemedText>
        <ThemedText type="caption">
          Vendor products will appear here soon.
        </ThemedText>

        {/* Services Section */}
        <ThemedText type="h3" style={styles.sectionTitle}>Services</ThemedText>
        <ThemedText type="caption">
          Vendor services will be listed here.
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  coverImage: {
    width: "100%",
    height: 230,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  content: {
    padding: Spacing.lg,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  description: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
});

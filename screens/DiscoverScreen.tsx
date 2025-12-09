import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, SubscriptionTiers } from "@/constants/theme";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import { useData, Photographer, PhotographyCategory } from "@/context/DataContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES: PhotographyCategory[] = [
  "wedding",
  "portrait",
  "events",
  "product",
  "nature",
  "fashion",
];

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { photographers, isLoading, error, refreshPhotographers } = useData();

  const [selectedCategory, setSelectedCategory] =
    useState<PhotographyCategory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPhotographers();
    setRefreshing(false);
  }, [refreshPhotographers]);

  if (isLoading && photographers.length === 0) {
    return (
      <ScreenScrollView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Loading photographers...
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  if (error && photographers.length === 0) {
    return (
      <ScreenScrollView>
        <View style={styles.loadingContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            {error}
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  const featuredPhotographers = photographers.filter((p) => p.featured);
  const filteredPhotographers = selectedCategory
    ? photographers.filter((p) => p.specialty === selectedCategory)
    : photographers;

  const handlePhotographerPress = (photographer: Photographer) => {
    navigation.navigate("PhotographerDetail", { photographer });
  };

  // FEATURED CARD
  const renderFeaturedCard = (photographer: Photographer) => (
    <Pressable
      key={photographer.id}
      onPress={() => handlePhotographerPress(photographer)}
      style={({ pressed }) => [
        styles.featuredCard,
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Image
        source={{ uri: photographer.portfolio?.[0] }}
        style={styles.featuredImage}
        contentFit="cover"
      />

      {photographer.subscriptionTier ? (
        <View style={styles.featuredTierBadge} key={`tier-${photographer.id}`}>
          <View style={[styles.tierBadge, { backgroundColor: SubscriptionTiers[photographer.subscriptionTier as keyof typeof SubscriptionTiers]?.color || "#888" }]}>
            <Feather name="award" size={10} color="#000000" />
            <ThemedText type="small" style={styles.tierBadgeText}>
              {SubscriptionTiers[photographer.subscriptionTier as keyof typeof SubscriptionTiers]?.label || ""}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.featuredOverlay,
          { backgroundColor: theme.cardOverlay },
        ]}
      >
        <View style={styles.featuredContent}>
          <Image
            source={{ uri: photographer.avatar }}
            style={styles.featuredAvatar}
            contentFit="cover"
          />
          <View style={styles.featuredInfo}>
            <ThemedText type="h4" style={styles.whiteText}>
              {photographer.name}
            </ThemedText>
            <ThemedText type="small" style={styles.whiteTextOpacity}>
              {CATEGORY_LABELS[photographer.specialty]} |{" "}
              {photographer.location}
            </ThemedText>
          </View>
        </View>

        <View style={styles.featuredRating}>
          <Feather name="star" size={14} color="#FFD700" />
          <ThemedText type="small" style={styles.whiteText}>
            {" "}
            {photographer.rating}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

  // CATEGORY CHIP
  const renderCategoryChip = (category: PhotographyCategory) => {
    const isSelected = selectedCategory === category;
    return (
      <Pressable
        key={category}
        onPress={() => setSelectedCategory(isSelected ? null : category)}
        style={({ pressed }) => [
          styles.categoryChip,
          {
            backgroundColor: isSelected
              ? theme.primary
              : theme.backgroundDefault,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather
          name={CATEGORY_ICONS[category] as any}
          size={16}
          color={isSelected ? "#FFFFFF" : theme.text}
        />
        <ThemedText
          type="small"
          style={[
            styles.categoryText,
            { color: isSelected ? "#FFFFFF" : theme.text },
          ]}
        >
          {CATEGORY_LABELS[category]}
        </ThemedText>
      </Pressable>
    );
  };

  // GRID CARD
  const renderPhotographerCard = (
    photographer: Photographer,
    index: number
  ) => {
    const isLeftColumn = index % 2 === 0;
    return (
      <Pressable
        key={photographer.id}
        onPress={() => handlePhotographerPress(photographer)}
        style={({ pressed }) => [
          styles.photographerCard,
          {
            backgroundColor: theme.backgroundDefault,
            marginRight: isLeftColumn ? Spacing.sm : 0,
            marginLeft: isLeftColumn ? 0 : Spacing.sm,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View>
          <Image
            source={{ uri: photographer.avatar }}
            style={styles.photographerImage}
            contentFit="cover"
          />
          {photographer.subscriptionTier ? (
            <View style={styles.gridTierBadge} key={`grid-tier-${photographer.id}`}>
              <View style={[styles.tierBadge, { backgroundColor: SubscriptionTiers[photographer.subscriptionTier as keyof typeof SubscriptionTiers]?.color || "#888" }]}>
                <Feather name="award" size={10} color="#000000" />
                <ThemedText type="small" style={styles.tierBadgeText}>
                  {SubscriptionTiers[photographer.subscriptionTier as keyof typeof SubscriptionTiers]?.label || ""}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.photographerInfo}>
          <ThemedText type="h4" numberOfLines={1}>
            {photographer.name}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {CATEGORY_LABELS[photographer.specialty]}
          </ThemedText>
          <View style={styles.photographerMeta}>
            <View style={styles.ratingContainer}>
              <Feather name="star" size={12} color="#FFD700" />
              <ThemedText type="caption">
                {" "}
                {photographer.rating} ({photographer.reviewCount})
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.secondary }}>
              {photographer.priceRange}
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
      {/* Featured */}
      <ThemedText type="h3" style={styles.sectionTitle}>
        Featured Photographers
      </ThemedText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuredScroll}
        style={styles.featuredContainer}
      >
        {featuredPhotographers.map(renderFeaturedCard)}
      </ScrollView>

      {/* Categories */}
      <ThemedText type="h4" style={styles.sectionTitle}>
        Browse by Category
      </ThemedText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
        style={styles.categoryContainer}
      >
        {CATEGORIES.map(renderCategoryChip)}
      </ScrollView>

      {/* Photographer Grid */}
      <ThemedText type="h4" style={styles.sectionTitle}>
        {selectedCategory
          ? CATEGORY_LABELS[selectedCategory]
          : "All"}{" "}
        Photographers
      </ThemedText>

      <View style={styles.photographerGrid}>
        {filteredPhotographers.map((photographer, index) =>
          renderPhotographerCard(photographer, index)
        )}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  featuredContainer: {
    marginHorizontal: -Spacing.xl,
    marginBottom: Spacing.xl,
  },
  featuredScroll: {
    paddingHorizontal: Spacing.xl,
  },
  featuredCard: {
    width: 280,
    height: 180,
    marginRight: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: Spacing.lg,
  },
  featuredContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  featuredAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing.sm,
  },
  featuredInfo: {
    flex: 1,
  },
  featuredRating: {
    position: "absolute",
    top: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  whiteText: {
    color: "#FFFFFF",
  },
  whiteTextOpacity: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  categoryContainer: {
    marginHorizontal: -Spacing.xl,
    marginBottom: Spacing.xl,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.xl,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  categoryText: {
    marginLeft: Spacing.xs,
  },
  photographerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  photographerCard: {
    width: "48%",
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  photographerImage: {
    width: "100%",
    aspectRatio: 1,
  },
  photographerInfo: {
    padding: Spacing.md,
  },
  photographerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xxs,
  },
  tierBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "600",
  },
  featuredTierBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    zIndex: 10,
  },
  gridTierBadge: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
  },
});

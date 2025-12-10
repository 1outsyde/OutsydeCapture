import React, { useState, useMemo } from "react";
import { StyleSheet, View, TextInput, Pressable } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Photographer, PhotographyCategory, CATEGORY_LABELS, PriceRange } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PRICE_FILTERS: PriceRange[] = ["$", "$$", "$$$", "$$$$"];
const CATEGORY_FILTERS: PhotographyCategory[] = ["wedding", "portrait", "events", "product", "nature", "fashion"];

export default function SearchScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { photographers } = useData();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrice, setSelectedPrice] = useState<PriceRange | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PhotographyCategory | null>(null);

  const filteredPhotographers = useMemo(() => {
    let result = photographers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
          CATEGORY_LABELS[p.specialty].toLowerCase().includes(query)
      );
    }

    if (selectedPrice) {
      result = result.filter(p => p.priceRange === selectedPrice);
    }

    if (selectedCategory) {
      result = result.filter(p => p.specialty === selectedCategory);
    }

    return result;
  }, [photographers, searchQuery, selectedPrice, selectedCategory]);

  const handlePhotographerPress = (photographer: Photographer) => {
    navigation.navigate("PhotographerDetail", { photographer });
  };

  const clearFilters = () => {
    setSelectedPrice(null);
    setSelectedCategory(null);
    setSearchQuery("");
  };

  const hasActiveFilters = selectedPrice || selectedCategory || searchQuery;

  const renderFilterChip = (
    label: string,
    isSelected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <ThemedText
        type="caption"
        style={{ color: isSelected ? "#FFFFFF" : theme.text }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderPhotographerItem = ({ item }: { item: Photographer }) => (
    <Pressable
      onPress={() => handlePhotographerPress(item)}
      style={({ pressed }) => [
        styles.photographerCard,
        {
          backgroundColor: theme.backgroundDefault,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.photographerImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.photographerInfo}>
        <View style={styles.photographerHeader}>
          <ThemedText type="h4" numberOfLines={1} style={styles.photographerName}>
            {item.name}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.secondary }}>
            {item.priceRange}
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {CATEGORY_LABELS[item.specialty]}
        </ThemedText>
        <View style={styles.photographerMeta}>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color="#FFD700" />
            <ThemedText type="small">
              {" "}{item.rating}
            </ThemedText>
          </View>
          <View style={styles.locationContainer}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {" "}{item.location}
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const ListHeader = () => (
    <View>
      <View style={styles.filterSection}>
        <ThemedText type="small" style={styles.filterLabel}>
          Price Range
        </ThemedText>
        <View style={styles.filterRow}>
          {PRICE_FILTERS.map(price =>
            renderFilterChip(
              price,
              selectedPrice === price,
              () => setSelectedPrice(selectedPrice === price ? null : price)
            )
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        <ThemedText type="small" style={styles.filterLabel}>
          Category
        </ThemedText>
        <View style={styles.filterRow}>
          {CATEGORY_FILTERS.map(category =>
            renderFilterChip(
              CATEGORY_LABELS[category],
              selectedCategory === category,
              () => setSelectedCategory(selectedCategory === category ? null : category)
            )
          )}
        </View>
      </View>

      {hasActiveFilters ? (
        <Pressable
          onPress={clearFilters}
          style={({ pressed }) => [
            styles.clearButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={16} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.xs }}>
            Clear all filters
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="h4" style={styles.resultsTitle}>
        {filteredPhotographers.length} {filteredPhotographers.length === 1 ? "Result" : "Results"}
      </ThemedText>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Feather name="camera-off" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No photographers found
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        Try adjusting your search or filters
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search photographers..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScreenFlatList
        data={filteredPhotographers}
        renderItem={renderPhotographerItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.body.fontSize,
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  filterLabel: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  resultsTitle: {
    marginBottom: Spacing.lg,
  },
  listContent: {
    paddingTop: Spacing.lg,
  },
  photographerCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  photographerImage: {
    width: 100,
    height: 100,
  },
  photographerInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  photographerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  photographerName: {
    flex: 1,
    marginRight: Spacing.sm,
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
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
});

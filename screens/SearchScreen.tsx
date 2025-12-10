import React, { useState, useMemo } from "react";
import { StyleSheet, View, TextInput, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useData, Business, BusinessType, BUSINESS_TYPE_LABELS, BUSINESS_TYPE_ICONS } from "@/context/DataContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const BUSINESS_TYPES: BusinessType[] = ["photography", "cinematography", "food", "fashion", "services"];

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "#FFD700" },
  pro: { label: "Pro", color: "#C0C0C0" },
  basic: { label: "Basic", color: "#CD7F32" },
};

export default function SearchScreen() {
  const { theme } = useTheme();
  const { businesses } = useData();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);

  const filteredBusinesses = useMemo(() => {
    let result = businesses;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        b =>
          b.name.toLowerCase().includes(query) ||
          b.city.toLowerCase().includes(query) ||
          b.state.toLowerCase().includes(query) ||
          b.category.toLowerCase().includes(query) ||
          BUSINESS_TYPE_LABELS[b.type].toLowerCase().includes(query)
      );
    }

    if (selectedType) {
      result = result.filter(b => b.type === selectedType);
    }

    return result;
  }, [businesses, searchQuery, selectedType]);

  const clearFilters = () => {
    setSelectedType(null);
    setSearchQuery("");
  };

  const hasActiveFilters = selectedType || searchQuery;

  const renderTypeChip = (type: BusinessType) => {
    const isSelected = selectedType === type;
    const iconName = BUSINESS_TYPE_ICONS[type] as keyof typeof Feather.glyphMap;
    
    return (
      <Pressable
        key={type}
        onPress={() => setSelectedType(isSelected ? null : type)}
        style={({ pressed }) => [
          styles.typeChip,
          {
            backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather 
          name={iconName} 
          size={14} 
          color={isSelected ? "#FFFFFF" : theme.text} 
        />
        <ThemedText
          type="caption"
          style={{ color: isSelected ? "#FFFFFF" : theme.text, marginLeft: Spacing.xs }}
        >
          {BUSINESS_TYPE_LABELS[type]}
        </ThemedText>
      </Pressable>
    );
  };

  const renderBusinessItem = ({ item }: { item: Business }) => {
    const tierConfig = item.subscriptionTier ? TIER_CONFIG[item.subscriptionTier] : null;
    const typeIcon = BUSINESS_TYPE_ICONS[item.type] as keyof typeof Feather.glyphMap;
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.businessCard,
          {
            backgroundColor: theme.backgroundDefault,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Image
          source={{ uri: item.avatar }}
          style={styles.businessImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.businessInfo}>
          <View style={styles.businessHeader}>
            <ThemedText type="h4" numberOfLines={1} style={styles.businessName}>
              {item.name}
            </ThemedText>
            {tierConfig ? (
              <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                <Feather name="award" size={10} color="#000000" />
              </View>
            ) : null}
          </View>
          
          <View style={styles.typeRow}>
            <Feather name={typeIcon} size={12} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
              {BUSINESS_TYPE_LABELS[item.type]}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              - {item.category}
            </ThemedText>
          </View>
          
          <View style={styles.businessMeta}>
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color="#FFD700" />
              <ThemedText type="small">
                {" "}{item.rating}
              </ThemedText>
            </View>
            <View style={styles.locationContainer}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {" "}{item.city}, {item.state}
              </ThemedText>
            </View>
          </View>
          
          <ThemedText type="caption" style={{ color: theme.secondary }}>
            {item.priceRange}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.filterSection}>
        <ThemedText type="small" style={styles.filterLabel}>
          Category
        </ThemedText>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeRow}
        >
          {BUSINESS_TYPES.map(renderTypeChip)}
        </ScrollView>
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
        {filteredBusinesses.length} {filteredBusinesses.length === 1 ? "Result" : "Results"}
      </ThemedText>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Feather name="search" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        No businesses found
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        Try searching by city, name, or category
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
            placeholder="Search by city, name, or category..."
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
        data={filteredBusinesses}
        renderItem={renderBusinessItem}
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
  typeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
  businessCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  businessImage: {
    width: 100,
    height: 120,
  },
  businessInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  businessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  businessName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  tierBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  businessMeta: {
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

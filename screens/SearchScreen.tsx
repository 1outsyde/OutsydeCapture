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
import { useFavorites } from "@/context/FavoritesContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const BUSINESS_TYPES: BusinessType[] = ["photography", "cinematography", "food", "fashion", "services"];

const FEATURED_LOCATIONS = [
  { id: "all", label: "All Cities", city: null, state: null },
  { id: "nyc", label: "New York", city: "New York", state: "NY" },
  { id: "miami", label: "Miami", city: "Miami", state: "FL" },
  { id: "atlanta", label: "Atlanta", city: "Atlanta", state: "GA" },
  { id: "richmond", label: "Richmond", city: "Richmond", state: "VA" },
  { id: "la", label: "Los Angeles", city: "Los Angeles", state: "CA" },
  { id: "chicago", label: "Chicago", city: "Chicago", state: "IL" },
  { id: "houston", label: "Houston", city: "Houston", state: "TX" },
  { id: "california", label: "California", city: null, state: "CA" },
];

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
  const [selectedLocation, setSelectedLocation] = useState("all");
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleSaveBusiness = (item: Business) => {
    toggleFavorite({
      id: item.id,
      type: "business",
      name: item.name,
      image: item.avatar,
      subtitle: `${item.city}, ${item.state}`,
    });
  };

  const selectedLocationData = FEATURED_LOCATIONS.find(loc => loc.id === selectedLocation);

  const filteredBusinesses = useMemo(() => {
    let result = businesses;

    // Filter by location first
    if (selectedLocation !== "all" && selectedLocationData) {
      result = result.filter(b => {
        // If filtering by state only (like "California")
        if (selectedLocationData.state && !selectedLocationData.city) {
          return b.state.toUpperCase() === selectedLocationData.state.toUpperCase();
        }
        // If filtering by specific city
        if (selectedLocationData.city) {
          return (
            b.city.toLowerCase() === selectedLocationData.city.toLowerCase() &&
            b.state.toUpperCase() === selectedLocationData.state?.toUpperCase()
          );
        }
        return true;
      });
    }

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
  }, [businesses, searchQuery, selectedType, selectedLocation, selectedLocationData]);

  const clearFilters = () => {
    setSelectedType(null);
    setSearchQuery("");
    setSelectedLocation("all");
  };

  const hasActiveFilters = selectedType || searchQuery || selectedLocation !== "all";

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
          size={20} 
          color={isSelected ? "#FFFFFF" : theme.text} 
        />
        <ThemedText
          type="body"
          style={{ color: isSelected ? "#FFFFFF" : theme.text, marginLeft: Spacing.sm, fontSize: 16 }}
        >
          {BUSINESS_TYPE_LABELS[type]}
        </ThemedText>
      </Pressable>
    );
  };

  const renderLocationChip = (location: typeof FEATURED_LOCATIONS[0]) => {
    const isSelected = selectedLocation === location.id;
    
    return (
      <Pressable
        key={location.id}
        onPress={() => setSelectedLocation(location.id)}
        style={({ pressed }) => [
          styles.locationChip,
          {
            backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
            borderColor: isSelected ? theme.primary : theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather 
          name="map-pin" 
          size={18} 
          color={isSelected ? "#FFFFFF" : theme.textSecondary} 
        />
        <ThemedText
          type="body"
          style={{ 
            color: isSelected ? "#FFFFFF" : theme.text, 
            marginLeft: Spacing.sm,
            fontWeight: isSelected ? "600" : "400",
            fontSize: 16,
          }}
        >
          {location.label}
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
            <View style={styles.headerRight}>
              {tierConfig ? (
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Feather name="award" size={10} color="#000000" />
                </View>
              ) : null}
              <Pressable
                onPress={() => handleSaveBusiness(item)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginLeft: Spacing.sm }]}
              >
                <Feather
                  name="bookmark"
                  size={18}
                  color={isFavorite(item.id, "business") ? theme.primary : theme.textSecondary}
                />
              </Pressable>
            </View>
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

  const getResultsLabel = () => {
    const count = filteredBusinesses.length;
    const countText = `${count} ${count === 1 ? "Result" : "Results"}`;
    if (selectedLocation !== "all" && selectedLocationData) {
      return `${countText} in ${selectedLocationData.label}`;
    }
    return countText;
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

      <View style={styles.filterSection}>
        <ThemedText type="small" style={styles.filterLabel}>
          Explore by City
        </ThemedText>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.locationRow}
        >
          {FEATURED_LOCATIONS.map(renderLocationChip)}
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
        {getResultsLabel()}
      </ThemedText>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Feather name="map-pin" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={styles.emptyTitle}>
        {selectedLocation !== "all" && selectedLocationData
          ? `No businesses in ${selectedLocationData.label}`
          : "No businesses found"}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {selectedLocation !== "all"
          ? "Try selecting a different city or clearing your filters"
          : "Try searching by city, name, or category"}
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
    marginBottom: Spacing.xl,
  },
  filterLabel: {
    marginBottom: Spacing.md,
    fontWeight: "600",
    fontSize: 16,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    minHeight: 48,
  },
  locationRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minHeight: 48,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
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

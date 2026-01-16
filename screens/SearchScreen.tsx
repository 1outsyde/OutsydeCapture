import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useFavorites } from "@/context/FavoritesContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import api, { UnifiedSearchResult, SearchResultType, ApiError } from "@/services/api";
import { RootStackParamList, BusinessProfileData } from "@/navigation/types";

type TabType = "all" | "business" | "photographer" | "product" | "service";

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "grid" },
  { id: "business", label: "Businesses", icon: "briefcase" },
  { id: "photographer", label: "Photographers", icon: "camera" },
  { id: "product", label: "Products", icon: "shopping-bag" },
  { id: "service", label: "Services", icon: "scissors" },
];

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "#FFD700" },
  pro: { label: "Pro", color: "#C0C0C0" },
  basic: { label: "Basic", color: "#CD7F32" },
};

const RESULT_TYPE_ICONS: Record<SearchResultType, string> = {
  business: "briefcase",
  photographer: "camera",
  product: "shopping-bag",
  service: "scissors",
};

const RESULT_TYPE_LABELS: Record<SearchResultType, string> = {
  business: "Business",
  photographer: "Photographer",
  product: "Product",
  service: "Service",
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSearchResults = useCallback(async (query?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.search({ query: query || undefined });
      const normalized = api.normalizeSearchResults(response);
      setResults(normalized);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to fetch search results");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchResults();
  }, [fetchSearchResults]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchSearchResults(searchQuery);
      } else {
        fetchSearchResults();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, fetchSearchResults]);

  const handleSaveResult = (item: UnifiedSearchResult) => {
    toggleFavorite({
      id: item.id,
      type: item.resultType === "photographer" ? "photographer" : "business",
      name: item.name,
      image: item.avatar,
      subtitle: `${item.city}, ${item.state}`,
    });
  };

  const handleCardPress = (item: UnifiedSearchResult) => {
    const businessData: BusinessProfileData = {
      id: item.id,
      name: item.name,
      avatar: item.avatar,
      city: item.city,
      state: item.state,
      rating: item.rating,
      priceRange: item.priceRange,
      category: item.category,
      description: item.description,
      subscriptionTier: item.subscriptionTier,
      resultType: item.resultType,
    };
    navigation.navigate("BusinessProfile", { business: businessData });
  };

  const filteredResults = useMemo(() => {
    if (activeTab === "all") {
      return results;
    }
    return results.filter(r => r.resultType === activeTab);
  }, [results, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabType, number> = {
      all: results.length,
      business: 0,
      photographer: 0,
      product: 0,
      service: 0,
    };

    results.forEach(r => {
      counts[r.resultType]++;
    });

    return counts;
  }, [results]);

  const renderTab = (tab: typeof TABS[0]) => {
    const isActive = activeTab === tab.id;
    const count = tabCounts[tab.id];

    return (
      <Pressable
        key={tab.id}
        onPress={() => setActiveTab(tab.id)}
        style={({ pressed }) => [
          styles.tab,
          {
            backgroundColor: isActive ? theme.primary : theme.backgroundDefault,
            borderColor: isActive ? theme.primary : theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather
          name={tab.icon as keyof typeof Feather.glyphMap}
          size={16}
          color={isActive ? "#FFFFFF" : theme.text}
        />
        <ThemedText
          type="body"
          style={{
            color: isActive ? "#FFFFFF" : theme.text,
            marginLeft: Spacing.xs,
            fontWeight: isActive ? "600" : "400",
          }}
        >
          {tab.label}
        </ThemedText>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: isActive ? "rgba(255,255,255,0.3)" : theme.backgroundSecondary },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: isActive ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}
          >
            {count}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderResultItem = ({ item }: { item: UnifiedSearchResult }) => {
    const tierConfig = item.subscriptionTier ? TIER_CONFIG[item.subscriptionTier] : null;
    const typeIcon = RESULT_TYPE_ICONS[item.resultType] as keyof typeof Feather.glyphMap;
    const isSaved = isFavorite(item.id, item.resultType === "photographer" ? "photographer" : "business");

    return (
      <Pressable
        onPress={() => handleCardPress(item)}
        style={({ pressed }) => [
          styles.resultCard,
          {
            backgroundColor: theme.backgroundDefault,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Image
          source={{ uri: item.avatar }}
          style={styles.resultImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.resultInfo}>
          <View style={styles.resultHeader}>
            <ThemedText type="h4" numberOfLines={1} style={styles.resultName}>
              {item.name}
            </ThemedText>
            <View style={styles.headerRight}>
              {tierConfig ? (
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Feather name="award" size={10} color="#000000" />
                </View>
              ) : null}
              <Pressable
                onPress={() => handleSaveResult(item)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginLeft: Spacing.sm }]}
              >
                <Feather
                  name="bookmark"
                  size={18}
                  color={isSaved ? theme.primary : theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.typeRow}>
            <Feather name={typeIcon} size={12} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
              {RESULT_TYPE_LABELS[item.resultType]}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              - {item.category}
            </ThemedText>
          </View>

          <View style={styles.resultMeta}>
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color="#FFD700" />
              <ThemedText type="small"> {item.rating.toFixed(1)}</ThemedText>
            </View>
            <View style={styles.locationContainer}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {" "}
                {item.city}
                {item.state ? `, ${item.state}` : ""}
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
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map(renderTab)}
        </ScrollView>
      </View>

      <ThemedText type="h4" style={styles.resultsTitle}>
        {filteredResults.length} {filteredResults.length === 1 ? "Result" : "Results"}
        {activeTab !== "all" ? ` in ${TABS.find(t => t.id === activeTab)?.label}` : ""}
      </ThemedText>
    </View>
  );

  const ListEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Searching...
          </ThemedText>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="h4" style={styles.emptyTitle}>
            Connection Error
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {error}
          </ThemedText>
          <Pressable
            onPress={() => fetchSearchResults(searchQuery || undefined)}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
              Try Again
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Feather name="search" size={48} color={theme.textSecondary} />
        <ThemedText type="h4" style={styles.emptyTitle}>
          No results found
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
          {searchQuery
            ? `No ${activeTab === "all" ? "results" : activeTab + "s"} match "${searchQuery}"`
            : `No ${activeTab === "all" ? "results" : activeTab + "s"} available`}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search businesses, photographers..."
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
          {isLoading && searchQuery ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: Spacing.sm }} />
          ) : null}
        </View>
      </View>

      <ScreenFlatList
        data={filteredResults}
        renderItem={renderResultItem}
        keyExtractor={(item) => item.id}
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
  tabsContainer: {
    marginBottom: Spacing.lg,
  },
  tabsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  countBadge: {
    marginLeft: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  resultsTitle: {
    marginBottom: Spacing.lg,
  },
  listContent: {
    paddingTop: Spacing.lg,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  resultCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  resultImage: {
    width: 100,
    height: 120,
  },
  resultInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultName: {
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
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  resultMeta: {
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
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
});

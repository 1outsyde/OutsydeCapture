import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TextInput, Pressable, ScrollView, ActivityIndicator, Switch } from "react-native";
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
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import api, { UnifiedSearchResult, SearchResultType, ApiError } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

type TabType = "all" | "consumer" | "business" | "photographer" | "product" | "service";

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "grid" },
  { id: "consumer", label: "Consumers", icon: "user" },
  { id: "photographer", label: "Photographers", icon: "camera" },
  { id: "business", label: "Businesses", icon: "briefcase" },
  { id: "product", label: "Products", icon: "shopping-bag" },
  { id: "service", label: "Services", icon: "scissors" },
];

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "#FFD700" },
  pro: { label: "Pro", color: "#C0C0C0" },
  basic: { label: "Basic", color: "#CD7F32" },
};

const RESULT_TYPE_ICONS: Record<string, string> = {
  consumer: "user",
  business: "briefcase",
  photographer: "camera",
  product: "shopping-bag",
  service: "scissors",
};

const isValidImageUrl = (url?: string): boolean => {
  if (!url) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return !url.includes("placeholder.com");
  }
  return false;
};

const getInitials = (name: string | undefined | null): string => {
  if (!name) return "?";
  const words = name.split(" ").filter(w => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const RESULT_TYPE_LABELS: Record<string, string> = {
  consumer: "Consumer",
  business: "Business",
  photographer: "Photographer",
  product: "Product",
  service: "Service",
};

interface CityData {
  city: string;
  state: string;
  displayName: string;
}

const DISCOVERY_CITIES: CityData[] = [
  { city: "New York", state: "NY", displayName: "New York, NY" },
  { city: "Atlanta", state: "GA", displayName: "Atlanta, GA" },
  { city: "Miami", state: "FL", displayName: "Miami, FL" },
  { city: "Los Angeles", state: "CA", displayName: "Los Angeles, CA" },
  { city: "Chicago", state: "IL", displayName: "Chicago, IL" },
  { city: "Houston", state: "TX", displayName: "Houston, TX" },
  { city: "Dallas", state: "TX", displayName: "Dallas, TX" },
  { city: "Phoenix", state: "AZ", displayName: "Phoenix, AZ" },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user, getToken } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personalized, setPersonalized] = useState(true);
  const [isPersonalizedResults, setIsPersonalizedResults] = useState(false);
  const [activeCity, setActiveCity] = useState<CityData | null>(null);

  const isAuthenticated = !!user && !user.isGuest;
  const isAdmin = user?.email?.toLowerCase() === "info@goutsyde.com" || 
                  user?.email?.toLowerCase() === "jamesmeyers2304@gmail.com";

  const getSearchScope = useCallback((tab: TabType): "all" | "consumers" | "businesses" | "photographers" | "products" | "services" | undefined => {
    switch (tab) {
      case "all": return "all";
      case "consumer": return "consumers";
      case "business": return "businesses";
      case "photographer": return "photographers";
      case "product": return "products";
      case "service": return "services";
      default: return "all";
    }
  }, []);

  const fetchSearchResults = useCallback(async (query?: string, tab?: TabType, cityFilter?: CityData | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const authToken = isAuthenticated ? await getToken() : null;
      const scope = getSearchScope(tab || activeTab);
      const response = await api.unifiedSearch(
        { 
          q: query || undefined,
          city: cityFilter?.city,
          personalized: isAuthenticated && personalized,
          scope,
          viewerUserId: user?.id,
        },
        authToken,
        isAdmin
      );
      console.log("[SearchScreen] Search query:", query, "City:", cityFilter?.city, "Scope:", scope, "Total results:", response.total);
      console.log("[SearchScreen] Raw result types:", response.results.map(r => `${r.type}: ${r.name} (@${r.username || "no-username"})`));
      const normalized = api.normalizeUnifiedResults(response);
      console.log("[SearchScreen] Normalized results:", normalized.map(r => `${r.resultType}: ${r.name} (@${r.username || "no-username"})`));
      setResults(normalized);
      setIsPersonalizedResults(response.personalized);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to fetch search results");
      setResults([]);
      setIsPersonalizedResults(false);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, personalized, getToken, isAdmin, activeTab, user?.id, getSearchScope]);

  useEffect(() => {
    fetchSearchResults(undefined, activeTab, activeCity);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchSearchResults(searchQuery, activeTab, activeCity);
      } else {
        fetchSearchResults(undefined, activeTab, activeCity);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab, activeCity, fetchSearchResults]);

  const handleCitySelect = useCallback((city: CityData) => {
    setActiveCity(city);
    fetchSearchResults(searchQuery.trim() || undefined, activeTab, city);
  }, [searchQuery, activeTab, fetchSearchResults]);

  const handleClearCity = useCallback(() => {
    setActiveCity(null);
    fetchSearchResults(searchQuery.trim() || undefined, activeTab, null);
  }, [searchQuery, activeTab, fetchSearchResults]);

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
    if (item.resultType === "product") {
      // Navigate to business detail with products tab and highlight the product
      const businessId = item.businessId || item.userId || item.id;
      navigation.navigate("VendorDetail", { 
        vendorId: businessId,
        initialTab: "products",
        productId: item.id,
      });
    } else if (item.resultType === "service") {
      // Navigate directly to booking flow with service preselected
      const providerId = item.providerId || item.userId;
      if (item.providerType === "photographer" && providerId) {
        navigation.navigate("Booking", { 
          photographerId: providerId,
          preselectedServiceId: item.id,
        });
      } else if (item.businessId) {
        // Business service - go to business detail with services tab
        navigation.navigate("VendorDetail", { 
          vendorId: item.businessId,
          initialTab: "services",
        });
      } else {
        // Fallback to VendorDetail
        navigation.navigate("VendorDetail", { 
          vendorId: providerId || item.id,
          initialTab: "services",
        });
      }
    } else if (item.resultType === "business") {
      navigation.navigate("VendorDetail", {
        vendorId: item.id,
      });
    } else if (item.resultType === "photographer") {
      navigation.navigate("UserProfile", {
        userId: item.id,
        userType: "photographer",
      });
    } else {
      navigation.navigate("UserProfile", { userId: item.userId || item.id, userType: "consumer" });
    }
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
      consumer: 0,
      business: 0,
      photographer: 0,
      product: 0,
      service: 0,
    };

    results.forEach(r => {
      const type = r.resultType as TabType;
      if (type in counts) {
        counts[type]++;
      }
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
            backgroundColor: isActive ? "#E8B930" : "#111111",
            borderColor: isActive ? "#E8B930" : "#1E1E1E",
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather
          name={tab.icon as keyof typeof Feather.glyphMap}
          size={16}
          color={isActive ? "#0A0A0A" : "#888888"}
        />
        <ThemedText
          type="body"
          style={{
            color: isActive ? "#0A0A0A" : "#888888",
            marginLeft: Spacing.xs,
            fontWeight: isActive ? "600" : "400",
          }}
        >
          {tab.label}
        </ThemedText>
        <View
          style={[
            styles.countBadge,
            { backgroundColor: isActive ? "rgba(10,10,10,0.12)" : "#1A1A1A" },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: isActive ? "#0A0A0A" : "#888888", fontWeight: "600" }}
          >
            {count}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderEntityCard = (item: UnifiedSearchResult) => {
    const tierConfig = item.subscriptionTier ? TIER_CONFIG[item.subscriptionTier] : null;
    const typeIcon = RESULT_TYPE_ICONS[item.resultType] as keyof typeof Feather.glyphMap;
    const isSaved = isFavorite(item.id, item.resultType === "photographer" ? "photographer" : "business");
    const hasValidAvatar = isValidImageUrl(item.avatar);

    const displayLabel =
      item.displayName ||
      (item.username ? `@${item.username}` : null) ||
      "Unknown";

    const typeColors: Record<string, string> = {
      photographer: "#E8B930",
      business: "#4ADE80",
      consumer: "#94A3B8",
      product: "#E8B930",
      service: "#E8B930",
    };
    const accentColor = typeColors[item.resultType] || "#E8B930";

    return (
      <Pressable
        onPress={() => handleCardPress(item)}
        style={({ pressed }) => [
          styles.resultCard,
          {
            backgroundColor: "#111111",
            borderWidth: 1,
            borderColor: pressed ? "#E8B930" : "#1E1E1E",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        {hasValidAvatar ? (
          <Image
            source={{ uri: item.avatar }}
            style={styles.resultImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={[
              styles.resultImage,
              {
                backgroundColor: "#1A3C34",
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <ThemedText type="h2" style={{ color: "#E8B930", fontWeight: "700" }}>
              {getInitials(displayLabel)}
            </ThemedText>
          </View>
        )}
        <View style={styles.resultInfo}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4" numberOfLines={1} style={[styles.resultName, { color: "#F5F0E6" }]}>
                {displayLabel}
              </ThemedText>
              {item.username && !displayLabel.startsWith("@") && (
                <ThemedText type="small" style={{ color: "#666666" }}>
                  @{item.username}
                </ThemedText>
              )}
            </View>
            <Pressable
              onPress={() => handleSaveResult(item)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginLeft: Spacing.sm }]}
            >
              <Feather
                name="bookmark"
                size={16}
                color={isSaved ? "#E8B930" : "#444444"}
              />
            </Pressable>
          </View>

          <View style={[styles.typeRow, { marginTop: 4 }]}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: accentColor + "18",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 20,
                alignSelf: "flex-start",
              }}
            >
              <Feather name={typeIcon} size={11} color={accentColor} />
              <ThemedText
                type="small"
                style={{ color: accentColor, marginLeft: 4, fontSize: 11, fontWeight: "600" }}
              >
                {RESULT_TYPE_LABELS[item.resultType]}
              </ThemedText>
              {item.category && item.category !== item.resultType && (
                <ThemedText
                  type="small"
                  style={{ color: accentColor + "AA", marginLeft: 4, fontSize: 11 }}
                >
                  · {item.category}
                </ThemedText>
              )}
            </View>
          </View>

          <View style={[styles.resultMeta, { marginTop: 6 }]}>
            {item.rating > 0 && (
              <View style={styles.ratingContainer}>
                <Feather name="star" size={12} color="#E8B930" />
                <ThemedText type="small" style={{ color: "#E8B930", marginLeft: 3, fontSize: 12 }}>
                  {item.rating.toFixed(1)}
                </ThemedText>
              </View>
            )}
            {item.city && item.city !== "Unknown" && (
              <View style={styles.locationContainer}>
                <Feather name="map-pin" size={12} color="#555555" />
                <ThemedText type="caption" style={{ color: "#666666", marginLeft: 3, fontSize: 12 }}>
                  {item.city}{item.state ? `, ${item.state}` : ""}
                </ThemedText>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => handleCardPress(item)}
            style={[
              styles.viewProfileButton,
              { backgroundColor: "#E8B930", marginTop: 8 },
            ]}
          >
            <Feather name="user" size={12} color="#0A0A0A" />
            <ThemedText type="small" style={[styles.viewProfileText, { color: "#0A0A0A", fontSize: 12 }]}>
              View Profile
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderServiceCard = (item: UnifiedSearchResult) => {
    const priceDisplay = item.priceFormatted || item.priceRange ||
      (item.price ? `$${(item.price / 100).toFixed(2).replace(/\.00$/, "")}` : "");

    return (
      <Pressable
        onPress={() => handleCardPress(item)}
        style={({ pressed }) => [
          styles.serviceCard,
          {
            backgroundColor: "#111111",
            borderColor: pressed ? "#E8B930" : "#1E1E1E",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={styles.serviceIconContainer}>
          <View
            style={[
              styles.serviceIcon,
              { backgroundColor: "#1A3C34" },
            ]}
          >
            <Feather name="scissors" size={22} color="#E8B930" />
          </View>
        </View>
        <View style={styles.serviceInfo}>
          <ThemedText type="h4" numberOfLines={1} style={[styles.serviceName, { color: "#F5F0E6" }]}>
            {item.name || "Unnamed Service"}
          </ThemedText>
          {item.providerName && (
            <ThemedText type="small" style={{ color: "#666666" }}>
              by {item.providerName}
            </ThemedText>
          )}
          {item.description && (
            <ThemedText
              type="caption"
              numberOfLines={2}
              style={{ color: "#555555", marginTop: 4, fontSize: 12 }}
            >
              {item.description}
            </ThemedText>
          )}
        </View>
        <View style={styles.serviceRight}>
          {priceDisplay ? (
            <ThemedText type="h4" style={{ color: "#E8B930", fontWeight: "700" }}>
              {priceDisplay}
            </ThemedText>
          ) : null}
          <View style={[styles.bookButton, { backgroundColor: "#E8B930", marginTop: 8 }]}>
            <Feather name="calendar" size={13} color="#0A0A0A" />
            <ThemedText type="small" style={{ color: "#0A0A0A", fontWeight: "700", marginLeft: 4, fontSize: 12 }}>
              Book
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderProductCard = (item: UnifiedSearchResult) => {
    const hasProductImage = isValidImageUrl(item.productImage || item.avatar);
    const imageUrl = item.productImage || item.avatar;
    const priceDisplay = item.priceFormatted || item.priceRange ||
      (item.price ? `$${(item.price / 100).toFixed(2).replace(/\.00$/, "")}` : "");

    return (
      <Pressable
        onPress={() => handleCardPress(item)}
        style={({ pressed }) => [
          styles.productCard,
          {
            backgroundColor: "#111111",
            borderColor: pressed ? "#E8B930" : "#1E1E1E",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        {hasProductImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={[
              styles.productImage,
              { backgroundColor: "#1A3C34", alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Feather name="shopping-bag" size={28} color="#E8B930" />
          </View>
        )}
        <View style={styles.productInfo}>
          <ThemedText type="h4" numberOfLines={2} style={[styles.productName, { color: "#F5F0E6" }]}>
            {item.name || "Unnamed Product"}
          </ThemedText>
          {item.businessName && (
            <ThemedText type="small" style={{ color: "#666666" }}>
              by {item.businessName}
            </ThemedText>
          )}
          {priceDisplay ? (
            <ThemedText
              type="h4"
              style={{ color: "#E8B930", fontWeight: "700", marginTop: 4 }}
            >
              {priceDisplay}
            </ThemedText>
          ) : null}
          <View style={[styles.buyButton, { backgroundColor: "#E8B930", marginTop: 8 }]}>
            <Feather name="shopping-bag" size={13} color="#0A0A0A" />
            <ThemedText type="small" style={{ color: "#0A0A0A", fontWeight: "700", marginLeft: 4, fontSize: 12 }}>
              View
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderResultItem = ({ item }: { item: UnifiedSearchResult }) => {
    if (item.resultType === "service") {
      return renderServiceCard(item);
    }
    if (item.resultType === "product") {
      return renderProductCard(item);
    }
    return renderEntityCard(item);
  };

  const ListHeader = () => (
    <View>
      {!searchQuery.trim() && !activeCity ? (
        <View style={styles.cityDiscoverySection}>
          <View style={styles.sectionHeader}>
            <Feather name="map-pin" size={18} color={theme.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Discover by City
            </ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityCardsRow}
          >
            {DISCOVERY_CITIES.map((city) => (
              <Pressable
                key={city.displayName}
                onPress={() => handleCitySelect(city)}
                style={({ pressed }) => [
                  styles.cityCard,
                  { 
                    backgroundColor: theme.backgroundDefault, 
                    borderColor: theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name="map-pin" size={14} color={theme.primary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.xs, fontWeight: "500" }}>
                  {city.displayName}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {activeCity ? (
        <View style={styles.discoveryContextRow}>
          <View style={styles.discoveryContext}>
            <Feather name="map-pin" size={16} color={theme.primary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
              Discovering in {activeCity.displayName}
            </ThemedText>
          </View>
          <Pressable
            onPress={handleClearCity}
            style={({ pressed }) => [
              styles.clearCityButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="x" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ marginLeft: 4, color: theme.textSecondary }}>
              Clear
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map(renderTab)}
        </ScrollView>
      </View>

      <View style={styles.resultsHeaderRow}>
        <ThemedText type="h4" style={styles.resultsTitle}>
          {filteredResults.length} {filteredResults.length === 1 ? "Result" : "Results"}
          {activeTab !== "all" ? ` in ${TABS.find(t => t.id === activeTab)?.label}` : ""}
        </ThemedText>
        {isAuthenticated ? (
          <View style={styles.personalizedToggle}>
            <Feather 
              name="sliders" 
              size={14} 
              color={isPersonalizedResults ? theme.primary : theme.textSecondary} 
            />
            <ThemedText 
              type="caption" 
              style={{ 
                color: isPersonalizedResults ? theme.primary : theme.textSecondary,
                marginLeft: 4,
                marginRight: 8,
              }}
            >
              For You
            </ThemedText>
            <Switch
              value={personalized}
              onValueChange={setPersonalized}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.border}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        ) : null}
      </View>
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
            onPress={() => fetchSearchResults(searchQuery || undefined, activeTab, activeCity)}
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

    if (activeCity) {
      return (
        <View style={styles.emptyState}>
          <Feather name="map-pin" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={styles.emptyTitle}>
            No discoverable users found
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            No discoverable users found in {activeCity.displayName} yet
          </ThemedText>
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
        <View style={styles.searchInputContainer}>
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
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1E1E1E",
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
  resultsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  resultsTitle: {
    flex: 1,
  },
  personalizedToggle: {
    flexDirection: "row",
    alignItems: "center",
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
  viewProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
    gap: 4,
  },
  viewProfileText: {
    color: "#000000",
    fontWeight: "600",
  },
  serviceCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  serviceIconContainer: {
    marginRight: Spacing.md,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    marginBottom: 2,
  },
  serviceRight: {
    alignItems: "flex-end",
    marginLeft: Spacing.md,
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  productCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  productImage: {
    width: 100,
    height: 120,
  },
  productInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  productName: {
    marginBottom: 4,
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  cityDiscoverySection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cityCardsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  cityCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  discoveryContextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  discoveryContext: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearCityButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
});

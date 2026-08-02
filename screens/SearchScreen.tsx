import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StyleSheet, View, TextInput, Pressable, ScrollView, ActivityIndicator, Switch } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import api, { UnifiedSearchResult, SearchResultType, ApiError } from "@/services/api";
import RoleBadge from "@/components/RoleBadge";
import StoryRing from "@/components/StoryRing";
import { RootStackParamList } from "@/navigation/types";

const SEARCH_HISTORY_KEY = "@search_history";
const MAX_HISTORY = 5;

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

const CITY_GRADIENTS: Record<string, { colors: [string, string]; accentColor: string }> = {
  "New York, NY": { colors: ["#2C2A1B", "#141310"], accentColor: "#E8B930" },
  "Atlanta, GA": { colors: ["#1B2530", "#0F1316"], accentColor: "#4A9EE8" },
  "Miami, FL": { colors: ["#2A1B24", "#120E12"], accentColor: "#E84A80" },
  "Los Angeles, CA": { colors: ["#182A22", "#0E1512"], accentColor: "#4AE880" },
  "Chicago, IL": { colors: ["#241E33", "#110E18"], accentColor: "#9B4AE8" },
  "Houston, TX": { colors: ["#2A1E14", "#120E08"], accentColor: "#E87B4A" },
  "Dallas, TX": { colors: ["#1A2028", "#0C0F14"], accentColor: "#4A7BE8" },
  "Phoenix, AZ": { colors: ["#2A1A18", "#120B0A"], accentColor: "#E8634A" },
};

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

  // Search history state
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isAuthenticated = !!user && !user.isGuest;
  const isAdmin = user?.email?.toLowerCase() === "info@goutsyde.com" ||
    user?.email?.toLowerCase() === "jamesmeyers2304@gmail.com";

  // Load search history from AsyncStorage on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (stored) setSearchHistory(JSON.parse(stored));
      } catch (e) {
        // ignore
      }
    };
    loadHistory();
  }, []);

  const saveToHistory = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((query: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(h => h !== query);
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const clearAllHistory = useCallback(async () => {
    setSearchHistory([]);
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY).catch(() => {});
  }, []);

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
      const normalized = api.normalizeUnifiedResults(response);
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

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      saveToHistory(searchQuery.trim());
      setIsInputFocused(false);
      inputRef.current?.blur();
    }
  }, [searchQuery, saveToHistory]);

  const handleHistorySelect = useCallback((query: string) => {
    setSearchQuery(query);
    setIsInputFocused(false);
    inputRef.current?.blur();
    saveToHistory(query);
    fetchSearchResults(query, activeTab, activeCity);
  }, [activeTab, activeCity, fetchSearchResults, saveToHistory]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setIsInputFocused(false);
    inputRef.current?.blur();
  }, []);

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
      navigation.navigate("ProductDetail", {
        id: item.id,
        businessId: item.businessId ?? "",
        name: item.name,
        description: item.description,
        priceCents: item.price ?? 0,
        imageUrl: item.productImage || item.avatar,
      });
    } else if (item.resultType === "service") {
      const providerId = item.providerId || item.userId;
      if (item.providerType === "photographer" && providerId) {
        navigation.navigate("Booking", { photographerId: providerId, preselectedServiceId: item.id });
      } else if (item.businessId) {
        navigation.navigate("VendorDetail", { vendorId: item.businessId, initialTab: "services" });
      } else {
        navigation.navigate("VendorDetail", { vendorId: providerId || item.id, initialTab: "services" });
      }
    } else if (item.resultType === "business") {
      navigation.navigate("VendorDetail", { vendorId: item.id });
    } else if (item.resultType === "photographer") {
      navigation.navigate("VendorDetail", { vendorId: item.id });
    } else if (item.resultType === "staff") {
      if (item.businessId) {
        navigation.navigate("StaffWorkProfile", { businessId: item.businessId, staffId: item.id });
      } else {
        navigation.navigate("UserProfile", { userId: item.userId || item.id, userType: "consumer" });
      }
    } else {
      navigation.navigate("UserProfile", { userId: item.userId || item.id, userType: "consumer" });
    }
  };

  const filteredResults = useMemo(() => {
    if (activeTab === "all") return results;
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
      if (type in counts) counts[type]++;
    });
    return counts;
  }, [results]);

  // Filtered history suggestions while typing
  const historySuggestions = useMemo(() => {
    if (!searchQuery.trim()) return searchHistory;
    return searchHistory.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, searchHistory]);

  const showDropdown = isInputFocused && historySuggestions.length > 0;
  const showHistorySection = !searchQuery.trim() && !isInputFocused && searchHistory.length > 0;

  // Featured items derived from results (products or services with isFeatured=true)
  const featuredItems = useMemo(() => {
    return results.filter(r =>
      (r.resultType === "product" || r.resultType === "service") &&
      r.isFeatured === true
    ).slice(0, 6);
  }, [results]);

  // Split filteredResults into left/right columns for unified masonry
  const leftCol = filteredResults.filter((_, i) => i % 2 === 0);
  const rightCol = filteredResults.filter((_, i) => i % 2 !== 0);

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
            backgroundColor: isActive ? "#E8B930" : theme.backgroundDefault,
            borderColor: isActive ? "#E8B930" : theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather
          name={tab.icon as keyof typeof Feather.glyphMap}
          size={14}
          color={isActive ? "#0A0A0A" : theme.textSecondary}
        />
        <ThemedText
          type="body"
          style={{ color: isActive ? "#0A0A0A" : theme.textSecondary, marginLeft: 6, fontWeight: isActive ? "700" : "400", fontSize: 13 }}
        >
          {tab.label}
        </ThemedText>
        <View style={[styles.countBadge, { backgroundColor: isActive ? "rgba(10,10,10,0.15)" : theme.backgroundSecondary }]}>
          <ThemedText type="small" style={{ color: isActive ? "#0A0A0A" : theme.textSecondary, fontWeight: "600", fontSize: 11 }}>
            {count}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderCard = (item: UnifiedSearchResult) => {
    const typeIcon = RESULT_TYPE_ICONS[item.resultType] as keyof typeof Feather.glyphMap;
    const isSaved = isFavorite(item.id, item.resultType === "photographer" ? "photographer" : "business");
    const displayLabel = item.resultType === "product" || item.resultType === "service"
      ? (item.name || "Unknown")
      : (item.displayName || (item.username ? `@${item.username}` : null) || "Unknown");
    const typeColors: Record<string, string> = {
      photographer: "#E8B930",
      business: "#4ADE80",
      consumer: "#94A3B8",
      product: "#E8B930",
      service: "#E8B930",
    };
    const accentColor = typeColors[item.resultType] || "#E8B930";

    const imageUrl = item.resultType === "product"
      ? (item.productImage || item.avatar)
      : item.avatar;
    const hasImage = isValidImageUrl(imageUrl);

    const fallbackGradientColors: [string, string] =
      item.resultType === "product"
        ? ["#2C2A1B", "#141310"]
        : item.resultType === "service"
        ? ["#1B2530", "#0F1316"]
        : ["#1C1C1E", "#0A0A0A"];

    const fallbackIcon: keyof typeof Feather.glyphMap | null =
      item.resultType === "product" ? "shopping-bag"
      : item.resultType === "service" ? "scissors"
      : null;

    const priceDisplay = item.priceFormatted || item.priceRange ||
      (item.price ? `$${((item.price) / 100).toFixed(0)}` : "");

    return (
      <Pressable
        key={item.id}
        onPress={() => handleCardPress(item)}
        style={({ pressed }) => [
          {
            backgroundColor: theme.backgroundDefault,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: pressed ? "#E8B930" : theme.border,
            marginBottom: 12,
            overflow: "hidden" as const,
          },
        ]}
      >
        <View style={{ height: 160, position: "relative", overflow: "hidden" }}>
          {hasImage ? (
            <>
              <Image
                source={{ uri: imageUrl }}
                style={{ width: "100%", height: 160 }}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
            </>
          ) : (
            <>
              <LinearGradient
                colors={fallbackGradientColors}
                style={{ width: "100%", height: 160, alignItems: "center", justifyContent: "center" }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={{ position: "absolute", alignItems: "center", justifyContent: "center", width: "100%", height: 160 }}>
                {fallbackIcon ? (
                  <Feather name={fallbackIcon} size={32} color="#E8B930" />
                ) : (
                  <ThemedText style={{ color: "#E8B930", fontSize: 22, fontWeight: "700" }}>
                    {getInitials(displayLabel)}
                  </ThemedText>
                )}
              </View>
            </>
          )}

          {/* Bookmark — top right */}
          <Pressable
            onPress={() => handleSaveResult(item)}
            style={({ pressed }) => [{
              position: "absolute" as const,
              top: 8,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: "rgba(0,0,0,0.4)",
              alignItems: "center" as const,
              justifyContent: "center" as const,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Feather name="bookmark" size={13} color={isSaved ? "#E8B930" : "#FFFFFF"} />
          </Pressable>

          {/* Price badge — top left for products and services */}
          {(item.resultType === "product" || item.resultType === "service") && priceDisplay ? (
            <View style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: "#E8B930",
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 8,
            }}>
              <ThemedText style={{ color: "#0A0A0A", fontSize: 11, fontWeight: "700" }}>
                {priceDisplay}
              </ThemedText>
            </View>
          ) : null}

          {/* Story ring overlay — non-product cards only */}
          {item.resultType !== "product" ? (
            <View style={{ position: "absolute", bottom: 8, left: 8 }}>
              <StoryRing
                userId={item.userId || item.id}
                size={40}
                isOwnProfile={(item.userId || item.id) === String(user?.id)}
                onAddStory={() => navigation.navigate("CreatePost")}
                onViewStory={(stories) =>
                  navigation.navigate("StoryViewer", {
                    userId: item.userId || item.id,
                    stories,
                    authorName: item.displayName || item.name,
                    authorAvatarUrl: item.avatar,
                  })
                }
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: "#0d0d0d", backgroundColor: "#222" }}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                        {getInitials(displayLabel)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </StoryRing>
            </View>
          ) : null}
        </View>

        <View style={{ padding: 10 }}>
          <ThemedText numberOfLines={1} style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
            {displayLabel}
          </ThemedText>

          <View style={{ flexDirection: "row", marginTop: 4 }}>
            <RoleBadge
              role={item.resultType === 'photographer' ? 'photographer' : item.resultType === 'business' ? 'vendor' : 'user'}
              subscriptionTier={item.subscriptionTier ?? null}
              size="pill"
            />
          </View>

          {/* Provider/business name for products and services */}
          {(item.resultType === "product" || item.resultType === "service") && (item.providerName || item.businessName) ? (
            <ThemedText numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11, marginTop: 3 }}>
              by {item.providerName || item.businessName}
            </ThemedText>
          ) : null}

          {item.city && item.city !== "Unknown" && item.resultType !== "product" && item.resultType !== "service" && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 5 }}>
              <Feather name="map-pin" size={10} color={theme.textSecondary} />
              <ThemedText numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 3 }}>
                {item.city}{item.state ? `, ${item.state}` : ""}
              </ThemedText>
            </View>
          )}

          {item.rating > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <Feather name="star" size={10} color="#E8B930" />
              <ThemedText style={{ color: "#E8B930", fontSize: 11, marginLeft: 3, fontWeight: "600" }}>
                {item.rating.toFixed(1)}
              </ThemedText>
            </View>
          )}

          {/* Action button for services and products */}
          {item.resultType === "service" ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <View style={{ backgroundColor: "#E8B930", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="calendar" size={10} color="#0A0A0A" />
                <ThemedText style={{ color: "#0A0A0A", fontSize: 10, fontWeight: "700" }}>Book</ThemedText>
              </View>
            </View>
          ) : item.resultType === "product" ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              <View style={{ backgroundColor: "#E8B930", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="shopping-bag" size={10} color="#0A0A0A" />
                <ThemedText style={{ color: "#0A0A0A", fontSize: 10, fontWeight: "700" }}>View</ThemedText>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderSpotlightCard = (item: UnifiedSearchResult) => {
    const imageUrl = item.productImage || item.avatar;
    const hasImage = isValidImageUrl(imageUrl);
    const label = item.resultType === "service" ? "Service" : "Featured";

    return (
      <Pressable
        key={item.id}
        onPress={() => handleCardPress(item)}
        style={({ pressed }) => [{
          width: 200,
          height: 130,
          borderRadius: 18,
          overflow: "hidden" as const,
          backgroundColor: theme.backgroundSecondary,
          marginRight: 12,
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        {hasImage ? (
          <>
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.82)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </>
        ) : (
          <LinearGradient
            colors={["#2C2A1B", "#141310"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        <View style={{ position: "absolute", top: 8, left: 8 }}>
          <View style={{ backgroundColor: "#E8B930", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
            <ThemedText style={{ color: "#0A0A0A", fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {label}
            </ThemedText>
          </View>
        </View>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 }}>
          <ThemedText numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
            {item.name}
          </ThemedText>
          {(item.category || RESULT_TYPE_LABELS[item.resultType]) ? (
            <ThemedText style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>
              {item.category || RESULT_TYPE_LABELS[item.resultType]}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderResultItem = () => null;

  const renderDropdown = () => {
    if (!showDropdown) return null;
    return (
      <View style={[styles.dropdown, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        {historySuggestions.map((item, index) => (
          <Pressable
            key={item}
            onPress={() => handleHistorySelect(item)}
            style={({ pressed }) => [
              styles.dropdownItem,
              {
                borderBottomWidth: index < historySuggestions.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
                backgroundColor: pressed ? theme.backgroundSecondary : "transparent",
              },
            ]}
          >
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="body" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.text }}>
              {item}
            </ThemedText>
            <Pressable onPress={(e) => { e.stopPropagation(); removeFromHistory(item); }} hitSlop={8}>
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          </Pressable>
        ))}
      </View>
    );
  };

  const ListHeader = () => (
    <View>
      {/* Recent Searches history section */}
      {showHistorySection && (
        <View style={styles.historySection}>
          <View style={styles.historySectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="clock" size={13} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={{
                  marginLeft: 6,
                  color: theme.textSecondary,
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Recent Searches
              </ThemedText>
            </View>
            <Pressable onPress={clearAllHistory} hitSlop={8}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 12 }}>Clear all</ThemedText>
            </Pressable>
          </View>
          <View style={styles.historyChips}>
            {searchHistory.map((item) => (
              <Pressable
                key={item}
                onPress={() => handleHistorySelect(item)}
                style={({ pressed }) => [
                  styles.historyChip,
                  { backgroundColor: pressed ? theme.backgroundSecondary : theme.backgroundSecondary, borderColor: theme.border },
                ]}
              >
                <Feather name="clock" size={11} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.text, marginLeft: 6, marginRight: 4, fontSize: 13 }}>{item}</ThemedText>
                <Pressable onPress={(e) => { e.stopPropagation(); removeFromHistory(item); }} hitSlop={6}>
                  <Feather name="x" size={11} color={theme.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* City Discovery Rail */}
      {!searchQuery.trim() && !activeCity ? (
        <View style={styles.cityDiscoverySection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
              📍  Discover by City
            </ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityCardsRow}
            style={styles.cityCardsScroll}
          >
            {DISCOVERY_CITIES.map((city) => {
              const gradient = CITY_GRADIENTS[city.displayName] ?? { colors: ["#1A1A1A", "#0A0A0A"] as [string, string], accentColor: "#E8B930" };
              return (
                <Pressable
                  key={city.displayName}
                  onPress={() => handleCitySelect(city)}
                  style={({ pressed }) => [
                    styles.cityCard,
                    {
                      borderColor: theme.border,
                      borderWidth: 1,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={gradient.colors}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  {/* Accent radial highlight overlay */}
                  <View
                    style={[
                      StyleSheet.absoluteFillObject,
                      {
                        backgroundColor: gradient.accentColor,
                        opacity: 0.1,
                        borderRadius: 16,
                      },
                    ]}
                  />
                  <View style={{ flex: 1, justifyContent: "flex-end", padding: 10 }}>
                    <ThemedText style={{ color: "#E8B930", fontSize: 10, marginBottom: 3 }}>●</ThemedText>
                    <ThemedText style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                      {city.displayName}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Active City Context Banner */}
      {activeCity ? (
        <View
          style={[
            styles.activeCityBanner,
            {
              backgroundColor: "rgba(232,185,48,0.12)",
              borderColor: "rgba(232,185,48,0.3)",
            },
          ]}
        >
          <Feather name="map-pin" size={15} color="#E8B930" />
          <ThemedText
            style={{ color: theme.text, fontWeight: "700", marginLeft: 8, flex: 1, fontSize: 14 }}
          >
            Discovering in {activeCity.displayName}
          </ThemedText>
          <Pressable
            onPress={handleClearCity}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center" }]}
            hitSlop={8}
          >
            <Feather name="x" size={13} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginLeft: 4, fontSize: 13 }}>Clear</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map(renderTab)}
        </ScrollView>
      </View>

      {/* Results Header Row */}
      <View style={styles.resultsHeaderRow}>
        <ThemedText style={{ color: theme.text, fontSize: 15, fontWeight: "700", flex: 1 }}>
          {filteredResults.length} {filteredResults.length === 1 ? "Result" : "Results"}
          {activeTab !== "all" ? ` in ${TABS.find(t => t.id === activeTab)?.label}` : ""}
        </ThemedText>
        {isAuthenticated ? (
          <View style={styles.personalizedToggle}>
            <Feather name="sliders" size={14} color={isPersonalizedResults ? "#E8B930" : theme.textSecondary} />
            <ThemedText type="caption" style={{ color: isPersonalizedResults ? "#E8B930" : theme.textSecondary, marginLeft: 4, marginRight: 8 }}>
              For You
            </ThemedText>
            <Switch
              value={personalized}
              onValueChange={setPersonalized}
              trackColor={{ false: theme.border, true: "#E8B930" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.border}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        ) : null}
      </View>

      {/* Featured Spotlight Rail */}
      {featuredItems.length > 0 && !isLoading ? (
        <View style={styles.featuredSection}>
          <ThemedText style={{ color: theme.text, fontSize: 15, fontWeight: "700", marginBottom: 12 }}>
            ✦ Featured this week
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredCardsRow}
            style={styles.featuredCardsScroll}
          >
            {featuredItems.map(renderSpotlightCard)}
          </ScrollView>
        </View>
      ) : null}

      {/* All results — unified 2-column masonry */}
      {filteredResults.length > 0 ? (
        <View style={styles.masonryGrid}>
          <View style={{ flex: 1 }}>
            {leftCol.map(item => renderCard(item))}
          </View>
          <View style={{ flex: 1 }}>
            {rightCol.map(item => renderCard(item))}
          </View>
        </View>
      ) : null}

      {/* Empty / Error / Loading state */}
      {!isLoading && filteredResults.length === 0 ? (
        error ? (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={44} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.text, fontSize: 17, fontWeight: "700", marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              Connection Error
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", fontSize: 14 }}>{error}</ThemedText>
            <Pressable
              onPress={() => fetchSearchResults(searchQuery || undefined, activeTab, activeCity)}
              style={({ pressed }) => [styles.retryButton, { backgroundColor: "#E8B930", opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="refresh-cw" size={16} color="#0A0A0A" />
              <ThemedText type="body" style={{ color: "#0A0A0A", marginLeft: Spacing.sm, fontWeight: "700" }}>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : activeCity ? (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={44} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.text, fontSize: 17, fontWeight: "700", marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              No discoverable users found
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", fontSize: 14 }}>
              No discoverable users found in {activeCity.displayName} yet
            </ThemedText>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="search" size={44} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.text, fontSize: 17, fontWeight: "700", marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              No results found
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", fontSize: 14 }}>
              {searchQuery
                ? `No ${activeTab === "all" ? "results" : activeTab + "s"} match "${searchQuery}"`
                : `No ${activeTab === "all" ? "results" : activeTab + "s"} available`}
            </ThemedText>
          </View>
        )
      ) : null}

      {/* Loading indicator */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8B930" />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Searching...</ThemedText>
        </View>
      ) : null}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { paddingTop: insets.top + Spacing.sm }]}>
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            },
          ]}
        >
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search businesses, photographers..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setTimeout(() => setIsInputFocused(false), 150)}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={handleClearSearch}>
              <Feather name="x-circle" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          {isLoading && searchQuery ? (
            <ActivityIndicator size="small" color="#E8B930" style={{ marginLeft: Spacing.sm }} />
          ) : null}
        </View>
        {renderDropdown()}
      </View>

      <ScreenFlatList
        data={[] as UnifiedSearchResult[]}
        renderItem={renderResultItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 50,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.body.fontSize,
  },
  dropdown: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  historySection: {
    marginBottom: Spacing.lg,
  },
  historySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  historyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  historyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabsContainer: { marginBottom: Spacing.lg },
  tabsRow: { flexDirection: "row", gap: Spacing.sm },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  countBadge: {
    marginLeft: 6,
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
  personalizedToggle: { flexDirection: "row", alignItems: "center" },
  listContent: { paddingTop: Spacing.lg },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing["3xl"] },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  cityDiscoverySection: { marginBottom: Spacing.lg },
  sectionHeader: { marginBottom: Spacing.md },
  cityCardsScroll: { marginHorizontal: -Spacing.xl },
  cityCardsRow: { flexDirection: "row", paddingHorizontal: Spacing.xl, paddingRight: Spacing.xl * 2 },
  cityCard: {
    width: 110,
    height: 68,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: Spacing.sm,
  },
  activeCityBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  featuredSection: { marginBottom: Spacing.lg },
  featuredCardsScroll: { marginHorizontal: -Spacing.xl },
  featuredCardsRow: { flexDirection: "row", paddingHorizontal: Spacing.xl, paddingRight: Spacing.xl },
  masonryGrid: {
    flexDirection: "row",
    gap: 12,
  },
});

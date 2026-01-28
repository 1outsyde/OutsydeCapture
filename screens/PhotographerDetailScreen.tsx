import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, ScrollView, Dimensions, Alert, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import api from "@/services/api";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { CATEGORY_LABELS } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "PhotographerDetail">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FALLBACK_AVATAR = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200";
const FALLBACK_PORTFOLIO = [
  "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800",
];

interface FullPhotographerProfile {
  id: string;
  userId?: string;
  name: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  city?: string;
  state?: string;
  rating?: number;
  specialty?: string;
  priceRange?: string;
  bio?: string;
  portfolio?: string[];
  availability?: string[];
  subscriptionTier?: string;
  hourlyRate?: number;
  yearsOfExperience?: number;
  reviewCount?: number;
}

export default function PhotographerDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const initialData = route.params.photographer;
  const { isAuthenticated, user, getToken } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const insets = useSafeAreaInsets();
  
  const [photographer, setPhotographer] = useState<FullPhotographerProfile>({
    id: initialData.id,
    userId: (initialData as any).userId,
    name: initialData.name || "Photographer",
    avatar: initialData.avatar,
    location: initialData.location,
    rating: initialData.rating,
    specialty: initialData.specialty,
    priceRange: initialData.priceRange,
    bio: (initialData as any).bio,
    portfolio: initialData.portfolio || [],
    availability: (initialData as any).availability || [],
    subscriptionTier: (initialData as any).subscriptionTier,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [isStartingChat, setIsStartingChat] = useState(false);
  
  const photographerAuthUserId = photographer.userId || (photographer as any).ownerId;
  const isOwner = Boolean(user?.id && photographerAuthUserId && photographerAuthUserId === user.id);

  const portfolio = photographer.portfolio && photographer.portfolio.length > 0 
    ? photographer.portfolio 
    : FALLBACK_PORTFOLIO;
  const allPortfolioPhotos = [...portfolio, ...additionalPhotos];
  const isPhotographerSaved = isFavorite(photographer.id, "photographer");

  useEffect(() => {
    let isMounted = true;

    const fetchFullProfile = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const fullProfile = await api.getPhotographer(initialData.id) as any;
        
        if (isMounted && fullProfile) {
          setPhotographer((prev) => ({
            ...prev,
            id: fullProfile.id || prev.id,
            userId: fullProfile.userId || prev.userId,
            name: fullProfile.name || fullProfile.displayName || prev.name,
            avatar: fullProfile.avatar || fullProfile.profilePhoto || prev.avatar,
            coverImage: fullProfile.coverImage || prev.coverImage,
            location: fullProfile.location || (fullProfile.city && fullProfile.state ? `${fullProfile.city}, ${fullProfile.state}` : prev.location),
            city: fullProfile.city,
            state: fullProfile.state,
            rating: fullProfile.rating ?? prev.rating,
            specialty: fullProfile.specialty || fullProfile.specialties?.[0] || prev.specialty,
            priceRange: fullProfile.priceRange || prev.priceRange,
            bio: fullProfile.bio || prev.bio,
            portfolio: fullProfile.portfolio || fullProfile.portfolioImages || prev.portfolio,
            availability: fullProfile.availability || prev.availability,
            subscriptionTier: fullProfile.subscriptionTier || prev.subscriptionTier,
            hourlyRate: fullProfile.hourlyRate,
            yearsOfExperience: fullProfile.yearsOfExperience,
            reviewCount: fullProfile.reviewCount,
          }));
        }
      } catch (error: any) {
        console.log("[PhotographerDetail] Failed to fetch full profile:", error?.message || error);
        if (isMounted) {
          setLoadError(error?.status === 404 ? "Profile not found" : null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFullProfile();

    return () => {
      isMounted = false;
    };
  }, [initialData.id]);

  const handleSavePhotographer = () => {
    const specialtyLabel = photographer.specialty 
      ? ((CATEGORY_LABELS as Record<string, string>)[photographer.specialty] || photographer.specialty)
      : "Professional";
    
    toggleFavorite({
      id: photographer.id,
      type: "photographer",
      name: photographer.name,
      image: photographer.avatar || FALLBACK_AVATAR,
      subtitle: `${specialtyLabel} Photographer`,
    });
  };

  const handleMessage = async () => {
    if (isStartingChat) return;
    
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    
    const profileData = photographer as any;
    const photographerAuthUserId = profileData.userId || profileData.ownerId;
    const senderId = user?.id;
    
    if (__DEV__) {
      console.log("[PhotographerDetail] handleMessage - senderId:", senderId, "photographerAuthUserId:", photographerAuthUserId, "entityId:", photographer.id);
    }
    
    if (senderId && photographerAuthUserId && photographerAuthUserId === senderId) {
      Alert.alert("Cannot Message", "You cannot send a message to yourself.");
      return;
    }
    
    try {
      setIsStartingChat(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const authToken = await getToken();
      
      const response = await api.createOrGetConversation({
        participantId: photographer.id,
        participantType: "photographer",
        participantName: photographer.name,
        participantAvatar: photographer.avatar,
      }, authToken);
      
      const conversationId = (response as any).conversation?.id || response.id;
      console.log("[PhotographerDetail] Navigating to conversation:", conversationId);
      
      if (!conversationId) {
        throw new Error("No conversation ID returned from API");
      }
      
      navigation.navigate("Chat", {
        conversationId,
        participantId: photographer.id,
        participantName: photographer.name,
        participantAvatar: photographer.avatar,
        participantType: "photographer",
      });
    } catch (error) {
      console.error("Failed to create conversation:", error);
      Alert.alert(
        "Message Failed",
        "Unable to start a conversation right now. Please try again later."
      );
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleAddPhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Run in Expo Go", "Use Expo Go on your mobile device to access the camera and photo library.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please enable photo library access in settings.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setAdditionalPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Run in Expo Go", "Use Expo Go on your mobile device to access the camera.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please enable camera access in settings.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets) {
      const newPhoto = result.assets[0].uri;
      setAdditionalPhotos((prev) => [...prev, newPhoto]);
    }
  };

  const handleBookNow = () => {
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    navigation.navigate("Booking", { photographer: initialData });
  };

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  const getPriceLabel = (range?: string) => {
    switch (range) {
      case "$": return "$150/session";
      case "$$": return "$300/session";
      case "$$$": return "$500/session";
      case "$$$$": return "$800+/session";
      default: return "Contact for pricing";
    }
  };

  const getDisplayLocation = () => {
    if (photographer.location) return photographer.location;
    if (photographer.city && photographer.state) return `${photographer.city}, ${photographer.state}`;
    if (photographer.city) return photographer.city;
    return "Location not specified";
  };

  const getSpecialtyLabel = () => {
    if (!photographer.specialty) return "Professional Photographer";
    const label = (CATEGORY_LABELS as Record<string, string>)[photographer.specialty] || photographer.specialty;
    return `${label} Photographer`;
  };

  const getAvailabilityCount = () => {
    if (!photographer.availability || !Array.isArray(photographer.availability)) {
      return 0;
    }
    return photographer.availability.length;
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <View style={styles.loadingHeader}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.loadingContent}>
            <View style={[styles.skeletonAvatar, { backgroundColor: theme.backgroundDefault }]} />
            <View style={[styles.skeletonTitle, { backgroundColor: theme.backgroundDefault }]} />
            <View style={[styles.skeletonSubtitle, { backgroundColor: theme.backgroundDefault }]} />
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing.xl }} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Loading profile...
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    );
  }

  if (loadError === "Profile not found") {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <View style={styles.loadingHeader}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.loadingContent}>
            <Feather name="user-x" size={64} color={theme.textSecondary} />
            <ThemedText type="h3" style={{ marginTop: Spacing.lg }}>
              Profile Not Found
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              This photographer profile may have been removed or is no longer available.
            </ThemedText>
            <Button onPress={() => navigation.goBack()} style={{ marginTop: Spacing.xl }}>
              Go Back
            </Button>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {portfolio.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={styles.portfolioImage}
              contentFit="cover"
              transition={200}
            />
          ))}
        </ScrollView>

        <View style={[styles.imageOverlay, { paddingTop: insets.top }]}>
          <View style={styles.overlayRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: "rgba(0,0,0,0.3)", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={handleSavePhotographer}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: "rgba(0,0,0,0.3)", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather
                name="bookmark"
                size={24}
                color={isPhotographerSaved ? theme.primary : "#FFFFFF"}
              />
            </Pressable>
          </View>
        </View>

        {portfolio.length > 1 ? (
          <View style={styles.pagination}>
            {portfolio.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  {
                    backgroundColor:
                      activeImageIndex === index
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.5)",
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={{ uri: photographer.avatar || FALLBACK_AVATAR }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.headerInfo}>
            <ThemedText type="h2">{photographer.name}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {getSpecialtyLabel()}
            </ThemedText>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={styles.statValue}>
              <Feather name="star" size={18} color="#FFD700" />
              <ThemedText type="h4" style={styles.statNumber}>
                {photographer.rating?.toFixed(1) || "New"}
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Rating
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="h4" style={{ color: theme.secondary }}>
              {photographer.priceRange || "$$"}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Price
            </ThemedText>
          </View>
          {photographer.yearsOfExperience ? (
            <>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText type="h4" style={{ color: theme.text }}>
                  {photographer.yearsOfExperience}+
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Years
                </ThemedText>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={18} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
              {getDisplayLocation()}
            </ThemedText>
          </View>
        </View>

        {photographer.bio ? (
          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              About
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {photographer.bio}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Pricing
          </ThemedText>
          <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.priceRow}>
              <ThemedText type="body">Session Rate</ThemedText>
              <ThemedText type="h4" style={{ color: theme.primary }}>
                {photographer.hourlyRate 
                  ? `$${photographer.hourlyRate}/hr`
                  : getPriceLabel(photographer.priceRange)
                }
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              Includes 1-hour session and edited digital photos
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Availability
          </ThemedText>
          <View style={styles.availabilityInfo}>
            <Feather 
              name="calendar" 
              size={18} 
              color={getAvailabilityCount() > 0 ? theme.success : theme.textSecondary} 
            />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {getAvailabilityCount() > 0 
                ? `${getAvailabilityCount()} days available this month`
                : "Check booking for availability"
              }
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.portfolioHeader}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Portfolio Gallery
            </ThemedText>
            {isOwner ? (
              <View style={styles.uploadButtons}>
                <Pressable
                  onPress={handleAddPhoto}
                  style={({ pressed }) => [
                    styles.uploadButton,
                    { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="image" size={16} color={theme.primary} />
                </Pressable>
                <Pressable
                  onPress={handleTakePhoto}
                  style={({ pressed }) => [
                    styles.uploadButton,
                    { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1, marginLeft: Spacing.sm },
                  ]}
                >
                  <Feather name="camera" size={16} color={theme.primary} />
                </Pressable>
              </View>
            ) : null}
          </View>
          <View style={styles.portfolioGrid}>
            {allPortfolioPhotos.map((photo, index) => (
              <Pressable key={index} style={styles.portfolioGridItem}>
                <Image
                  source={{ uri: photo }}
                  style={styles.portfolioGridImage}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
            borderTopColor: theme.border,
          },
        ]}
      >
        {!isOwner && (
          <Pressable
            onPress={handleMessage}
            disabled={isStartingChat}
            style={({ pressed }) => [
              styles.messageButton,
              { backgroundColor: theme.backgroundDefault, opacity: pressed || isStartingChat ? 0.8 : 1 },
            ]}
          >
            <Feather name="message-circle" size={24} color={theme.primary} />
          </Pressable>
        )}
        <View style={styles.footerPrice}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Starting at
          </ThemedText>
          <ThemedText type="h3" style={{ color: theme.primary }}>
            {photographer.hourlyRate 
              ? `$${photographer.hourlyRate}`
              : getPriceLabel(photographer.priceRange).split("/")[0]
            }
          </ThemedText>
        </View>
        <Button onPress={handleBookNow} style={styles.bookButton}>
          Book Now
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  loadingHeader: {
    paddingVertical: Spacing.lg,
  },
  loadingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
  },
  skeletonAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.lg,
  },
  skeletonTitle: {
    width: 200,
    height: 24,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  skeletonSubtitle: {
    width: 150,
    height: 16,
    borderRadius: BorderRadius.sm,
  },
  imageContainer: {
    height: 300,
    position: "relative",
  },
  portfolioImage: {
    width: SCREEN_WIDTH,
    height: 300,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  overlayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pagination: {
    position: "absolute",
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.lg,
  },
  headerInfo: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  statNumber: {
    marginLeft: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  priceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  availabilityInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  messageButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrice: {
    marginLeft: Spacing.md,
  },
  bookButton: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  portfolioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  uploadButtons: {
    flexDirection: "row",
  },
  uploadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  portfolioGridItem: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.xs * 4) / 3,
    aspectRatio: 1,
    margin: Spacing.xs,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  portfolioGridImage: {
    width: "100%",
    height: "100%",
  },
});

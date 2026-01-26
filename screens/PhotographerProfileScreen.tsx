import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList, PhotographerProfileData } from "@/navigation/types";
import api, { ApiPhotographerDetail, ApiError } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

type PhotographerProfileRouteProp = RouteProp<RootStackParamList, "PhotographerProfile">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PORTFOLIO_IMAGE_SIZE = SCREEN_WIDTH * 0.6;

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "#FFD700" },
  pro: { label: "Pro", color: "#C0C0C0" },
  basic: { label: "Basic", color: "#CD7F32" },
};

const FALLBACK_COVER = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800";

export default function PhotographerProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PhotographerProfileRouteProp>();
  const { getToken, isAuthenticated, user } = useAuth();
  const initialData = route.params.photographer;

  const [photographer, setPhotographer] = useState<PhotographerProfileData>(initialData);
  
  // Detect if viewing own profile - compare current user ID with photographer's userId
  const isOwner = Boolean(
    user?.id && 
    (photographer.userId === user.id || photographer.id === user.id)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const mergePhotographerData = useCallback(
    (apiData: ApiPhotographerDetail): PhotographerProfileData => {
      const locationParts = apiData.location
        ? apiData.location.split(",").map((s) => s.trim())
        : [];

      // Helper to validate image URLs (filter out local file paths)
      const isValidImageUrl = (url?: string): boolean => {
        if (!url) return false;
        return url.startsWith("http://") || url.startsWith("https://");
      };

      // Get valid avatar URL - check both avatar and logoImage fields
      const avatarUrl = isValidImageUrl(apiData.avatar) 
        ? apiData.avatar 
        : isValidImageUrl((apiData as any).logoImage)
          ? (apiData as any).logoImage
          : photographer.avatar;

      // Get valid cover image URL
      const coverUrl = isValidImageUrl(apiData.coverImage)
        ? apiData.coverImage
        : photographer.coverImage;

      return {
        ...photographer,
        id: apiData.id || photographer.id,
        userId: (apiData as any).userId || photographer.userId, // The actual user ID for messaging
        name: (apiData as any).displayName || apiData.name || photographer.name,
        avatar: avatarUrl,
        city: apiData.city || locationParts[0] || photographer.city,
        state: apiData.state || locationParts[1] || photographer.state,
        rating: apiData.rating ?? photographer.rating,
        priceRange: apiData.priceRange || photographer.priceRange,
        specialty: apiData.specialty || photographer.specialty,
        description: (apiData as any).bio || apiData.description || photographer.description,
        subscriptionTier: apiData.subscriptionTier || photographer.subscriptionTier,
        website: apiData.website || photographer.website,
        phone: apiData.phone || photographer.phone,
        email: apiData.email || photographer.email,
        instagram: apiData.instagram || photographer.instagram,
        facebook: apiData.facebook || photographer.facebook,
        twitter: apiData.twitter || photographer.twitter,
        reviewCount: apiData.reviewCount ?? photographer.reviewCount,
        coverImage: coverUrl,
        yearsOfExperience: apiData.yearsOfExperience ?? photographer.yearsOfExperience,
        portfolio: apiData.portfolio?.length ? apiData.portfolio : photographer.portfolio,
        specialties: apiData.specialties?.length ? apiData.specialties : photographer.specialties,
        brandColors: apiData.brandColors || photographer.brandColors,
        // Check multiple Stripe fields - backend may return stripeOnboardingComplete, stripeConnected, or both
        stripeOnboardingComplete: 
          (apiData as any).stripeOnboardingComplete === true || 
          (apiData as any).stripeConnected === true ||
          !!(apiData as any).stripeAccountId ||
          photographer.stripeOnboardingComplete,
      };
    },
    [photographer]
  );

  const getProfileTheme = (): string => {
    if (photographer.brandColors) {
      try {
        const colors = JSON.parse(photographer.brandColors);
        return colors.primary || theme.primary;
      } catch {
        return theme.primary;
      }
    }
    return theme.primary;
  };

  const profileTheme = getProfileTheme();

  useEffect(() => {
    let isMounted = true;

    const fetchPhotographerDetails = async () => {
      setIsRefreshing(true);
      setFetchError(null);

      try {
        const apiData = await api.getPhotographer(initialData.id);
        if (isMounted) {
          setPhotographer((prev) => mergePhotographerData(apiData));
        }
      } catch (error) {
        if (isMounted) {
          const apiError = error as ApiError;
          if (apiError.status === 404) {
            setFetchError("Photographer not found");
          } else {
            setFetchError(apiError.message || "Failed to load details");
          }
        }
      } finally {
        if (isMounted) {
          setIsRefreshing(false);
        }
      }
    };

    fetchPhotographerDetails();

    return () => {
      isMounted = false;
    };
  }, [initialData.id]);

  const tierConfig = photographer.subscriptionTier
    ? TIER_CONFIG[photographer.subscriptionTier]
    : null;

  const hasWebsite = Boolean(photographer.website);
  const hasPhone = Boolean(photographer.phone);
  const hasEmail = Boolean(photographer.email);
  const hasSocials =
    Boolean(photographer.instagram) ||
    Boolean(photographer.facebook) ||
    Boolean(photographer.twitter);
  const hasInfo = hasWebsite || hasPhone || hasEmail || hasSocials;
  const hasDescription = Boolean(photographer.description);
  const hasPortfolio = photographer.portfolio && photographer.portfolio.length > 0;
  const hasSpecialties = photographer.specialties && photographer.specialties.length > 0;
  const hasYearsOfExperience = photographer.yearsOfExperience && photographer.yearsOfExperience > 0;

  const handleClose = () => {
    navigation.goBack();
  };

  const handleMessage = async () => {
    if (isStartingChat) return;
    
    if (!isAuthenticated) {
      navigation.navigate("Auth", { returnTo: "PhotographerProfile" });
      return;
    }
    
    // Use userId for conversation creation (backend expects user ID, not photographer profile ID)
    const participantUserId = photographer.userId || photographer.id;
    
    // Frontend guard: Block self-messaging
    if (user?.id && (participantUserId === user.id)) {
      Alert.alert("Cannot Message", "You cannot send a message to yourself.");
      return;
    }
    
    try {
      setIsStartingChat(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const authToken = await getToken();
      
      const conversation = await api.createOrGetConversation({
        participantId: participantUserId,
        participantType: "photographer",
        participantName: photographer.name,
        participantAvatar: photographer.avatar,
      }, authToken);
      
      navigation.navigate("Chat", {
        conversationId: conversation.id,
        participantId: participantUserId,
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

  const handleBook = () => {
    console.log("[PhotographerProfile] handleBook - stripeOnboardingComplete:", photographer.stripeOnboardingComplete);
    
    // Require authentication to book
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    
    // Check if photographer has completed Stripe onboarding
    if (!photographer.stripeOnboardingComplete) {
      Alert.alert(
        "Booking Unavailable",
        "This photographer is not yet set up to accept bookings. Please check back later or contact them directly.",
        [{ text: "OK" }]
      );
      return;
    }
    
    const photographerData = {
      id: photographer.id,
      name: photographer.name,
      avatar: photographer.avatar,
      location: `${photographer.city}, ${photographer.state}`,
      rating: photographer.rating,
      specialty: photographer.specialty,
      priceRange: photographer.priceRange,
    };
    navigation.navigate("Booking", { photographer: photographerData as any });
  };

  const handleVisitWebsite = async () => {
    if (photographer.website) {
      const url = photographer.website.startsWith("http")
        ? photographer.website
        : `https://${photographer.website}`;
      try {
        await Linking.openURL(url);
      } catch {
        // Handle error silently
      }
    }
  };

  const handleCall = async () => {
    if (photographer.phone) {
      try {
        await Linking.openURL(`tel:${photographer.phone}`);
      } catch {
        // Handle error silently
      }
    }
  };

  const handleEmail = async () => {
    if (photographer.email) {
      try {
        await Linking.openURL(`mailto:${photographer.email}`);
      } catch {
        // Handle error silently
      }
    }
  };

  const handleSocial = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Handle error silently
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Image
            source={{ uri: photographer.coverImage || photographer.avatar || FALLBACK_COVER }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.heroOverlay} />

          <View style={[styles.headerButtons, { top: insets.top + Spacing.md }]}>
            {isRefreshing ? (
              <View style={styles.refreshIndicator}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.avatarContainer}>
              {photographer.avatar && photographer.avatar.startsWith("http") ? (
                <Image
                  source={{ uri: photographer.avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: profileTheme }]}>
                  <ThemedText type="h1" style={{ color: "#000000" }}>
                    {(photographer.name || "?").charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              {tierConfig ? (
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Feather name="award" size={12} color="#000000" />
                </View>
              ) : null}
            </View>

            <ThemedText type="h2" style={styles.photographerName}>
              {photographer.name}
            </ThemedText>

            <View style={styles.badgesRow}>
              <View style={[styles.specialtyBadge, { backgroundColor: profileTheme }]}>
                <Feather name="camera" size={12} color="#FFFFFF" />
                <ThemedText type="small" style={styles.specialtyText}>
                  {photographer.specialty}
                </ThemedText>
              </View>
              {hasSpecialties ? (
                photographer.specialties!.slice(0, 2).map((spec, index) => (
                  <View
                    key={index}
                    style={[styles.specialtyBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}
                  >
                    <ThemedText type="small" style={styles.specialtyText}>
                      {spec}
                    </ThemedText>
                  </View>
                ))
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color="rgba(255,255,255,0.8)" />
                <ThemedText type="body" style={styles.metaText}>
                  {photographer.city}
                  {photographer.state ? `, ${photographer.state}` : ""}
                </ThemedText>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Feather name="star" size={14} color="#FFD700" />
                <ThemedText type="body" style={styles.metaText}>
                  {photographer.rating.toFixed(1)}
                  {photographer.reviewCount ? ` (${photographer.reviewCount})` : ""}
                </ThemedText>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <ThemedText type="body" style={styles.metaText}>
                  {photographer.priceRange}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.actionButtons}>
            {!isOwner && (
              <Pressable
                onPress={handleMessage}
                disabled={isStartingChat}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed || isStartingChat ? 0.6 : 1 },
                ]}
              >
                {isStartingChat ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Feather name="message-circle" size={20} color={theme.text} />
                )}
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Message
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={handleBook}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonPrimary,
                { backgroundColor: profileTheme, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="calendar" size={20} color="#FFFFFF" />
              <ThemedText
                type="body"
                style={{ marginLeft: Spacing.sm, color: "#FFFFFF", fontWeight: "600" }}
              >
                Book Session
              </ThemedText>
            </Pressable>

            {hasWebsite ? (
              <Pressable
                onPress={handleVisitWebsite}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="globe" size={20} color={theme.text} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Website
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {hasDescription || hasYearsOfExperience ? (
            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.sectionHeader}>
                <Feather name="user" size={18} color={profileTheme} />
                <ThemedText type="h4" style={styles.sectionTitle}>
                  About
                </ThemedText>
              </View>
              {hasYearsOfExperience ? (
                <View style={styles.experienceRow}>
                  <Feather name="clock" size={14} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                    {photographer.yearsOfExperience} years of experience
                  </ThemedText>
                </View>
              ) : null}
              {hasDescription ? (
                <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22, marginTop: hasYearsOfExperience ? Spacing.md : 0 }}>
                  {photographer.description}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {hasPortfolio ? (
            <View style={styles.portfolioSection}>
              <View style={styles.sectionHeader}>
                <Feather name="image" size={18} color={profileTheme} />
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Portfolio
                </ThemedText>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.portfolioScroll}
              >
                {photographer.portfolio!.map((imageUrl, index) => (
                  <Image
                    key={index}
                    source={{ uri: imageUrl }}
                    style={[
                      styles.portfolioImage,
                      { width: PORTFOLIO_IMAGE_SIZE, height: PORTFOLIO_IMAGE_SIZE * 0.75 },
                    ]}
                    contentFit="cover"
                    transition={200}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {hasInfo ? (
            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={18} color={profileTheme} />
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Info
                </ThemedText>
              </View>

              <View style={styles.infoRow}>
                <Feather name="map-pin" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={styles.infoText}>
                  {photographer.city}
                  {photographer.state ? `, ${photographer.state}` : ""}
                </ThemedText>
              </View>

              {hasPhone ? (
                <Pressable
                  onPress={handleCall}
                  style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="phone" size={16} color={profileTheme} />
                  <ThemedText type="body" style={[styles.infoText, { color: profileTheme }]}>
                    {photographer.phone}
                  </ThemedText>
                </Pressable>
              ) : null}

              {hasEmail ? (
                <Pressable
                  onPress={handleEmail}
                  style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="mail" size={16} color={profileTheme} />
                  <ThemedText type="body" style={[styles.infoText, { color: profileTheme }]}>
                    {photographer.email}
                  </ThemedText>
                </Pressable>
              ) : null}

              {hasWebsite ? (
                <Pressable
                  onPress={handleVisitWebsite}
                  style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="globe" size={16} color={profileTheme} />
                  <ThemedText
                    type="body"
                    style={[styles.infoText, { color: profileTheme }]}
                    numberOfLines={1}
                  >
                    {photographer.website}
                  </ThemedText>
                </Pressable>
              ) : null}

              {hasSocials ? (
                <View style={styles.socialsRow}>
                  {photographer.instagram ? (
                    <Pressable
                      onPress={() => handleSocial(`https://instagram.com/${photographer.instagram}`)}
                      style={({ pressed }) => [
                        styles.socialButton,
                        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="instagram" size={20} color={theme.text} />
                    </Pressable>
                  ) : null}
                  {photographer.facebook ? (
                    <Pressable
                      onPress={() => handleSocial(`https://facebook.com/${photographer.facebook}`)}
                      style={({ pressed }) => [
                        styles.socialButton,
                        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="facebook" size={20} color={theme.text} />
                    </Pressable>
                  ) : null}
                  {photographer.twitter ? (
                    <Pressable
                      onPress={() => handleSocial(`https://twitter.com/${photographer.twitter}`)}
                      style={({ pressed }) => [
                        styles.socialButton,
                        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="twitter" size={20} color={theme.text} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    height: 340,
    position: "relative",
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  headerButtons: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    zIndex: 10,
  },
  refreshIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    position: "absolute",
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  tierBadge: {
    position: "absolute",
    bottom: 0,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  photographerName: {
    color: "#FFFFFF",
    marginBottom: Spacing.sm,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  specialtyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  specialtyText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    color: "rgba(255,255,255,0.9)",
    marginLeft: 4,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: Spacing.md,
  },
  contentSection: {
    padding: Spacing.xl,
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    minWidth: 100,
  },
  actionButtonPrimary: {
    flex: 1,
  },
  actionButtonSecondary: {
    flex: 0,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginLeft: Spacing.sm,
  },
  experienceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  portfolioSection: {
    marginBottom: Spacing.lg,
  },
  portfolioScroll: {
    gap: Spacing.md,
  },
  portfolioImage: {
    borderRadius: BorderRadius.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  infoText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  socialsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

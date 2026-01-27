import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  Platform,
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
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList, BusinessProfileData } from "@/navigation/types";
import api, { ApiBusinessDetail, ApiError } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

type BusinessProfileRouteProp = RouteProp<RootStackParamList, "BusinessProfile">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "#FFD700" },
  pro: { label: "Pro", color: "#C0C0C0" },
  basic: { label: "Basic", color: "#CD7F32" },
};

const FALLBACK_COVER = "https://images.unsplash.com/photo-1557683316-973673baf926?w=800";

export default function BusinessProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BusinessProfileRouteProp>();
  const { getToken, isAuthenticated, user } = useAuth();
  const initialData = route.params.business;

  const [business, setBusiness] = useState<BusinessProfileData>(initialData);
  
  // Detect if viewing own profile - compare current user's auth ID with business owner's auth userId
  // Must compare user-to-user, not user-to-entity
  const businessAuthUserId = (business as any).userId || (business as any).ownerId;
  const isOwner = Boolean(user?.id && businessAuthUserId && businessAuthUserId === user.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const mergeBusinessData = useCallback(
    (apiData: ApiBusinessDetail): BusinessProfileData => {
      return {
        ...business,
        id: apiData.id || business.id,
        name: apiData.name || business.name,
        avatar: apiData.avatar || business.avatar,
        city: apiData.city || business.city,
        state: apiData.state || business.state,
        rating: apiData.rating ?? business.rating,
        priceRange: apiData.priceRange || business.priceRange,
        category: apiData.category || apiData.type || business.category,
        description: apiData.description || business.description,
        subscriptionTier: apiData.subscriptionTier || business.subscriptionTier,
        resultType: business.resultType,
        address: apiData.address || business.address,
        website: apiData.website || business.website,
        phone: apiData.phone || business.phone,
        email: apiData.email || business.email,
        instagram: apiData.instagram || business.instagram,
        facebook: apiData.facebook || business.facebook,
        twitter: apiData.twitter || business.twitter,
        reviewCount: apiData.reviewCount ?? business.reviewCount,
        coverImage: apiData.coverImage || business.coverImage,
        brandColors: apiData.brandColors || business.brandColors,
      };
    },
    [business]
  );

  const getProfileTheme = (): string => {
    if (business.brandColors) {
      try {
        const colors = JSON.parse(business.brandColors);
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

    const fetchBusinessDetails = async () => {
      setIsRefreshing(true);
      setFetchError(null);

      try {
        const apiData = await api.getBusiness(initialData.id);
        if (isMounted) {
          setBusiness((prev) => mergeBusinessData(apiData));
        }
      } catch (error) {
        if (isMounted) {
          const apiError = error as ApiError;
          if (apiError.status === 404) {
            setFetchError("Business not found");
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

    fetchBusinessDetails();

    return () => {
      isMounted = false;
    };
  }, [initialData.id]);

  const tierConfig = business.subscriptionTier
    ? TIER_CONFIG[business.subscriptionTier]
    : null;

  const hasWebsite = Boolean(business.website);
  const hasAddress = Boolean(business.address);
  const hasPhone = Boolean(business.phone);
  const hasEmail = Boolean(business.email);
  const hasSocials =
    Boolean(business.instagram) ||
    Boolean(business.facebook) ||
    Boolean(business.twitter);
  const hasInfo = hasAddress || hasWebsite || hasPhone || hasEmail || hasSocials;
  const hasDescription = Boolean(business.description);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleMessage = async () => {
    if (isStartingChat) return;
    
    if (!isAuthenticated) {
      navigation.navigate("Auth", { returnTo: "BusinessProfile" });
      return;
    }
    
    // API expects entity ID (business.id), backend resolves to user internally
    // For self-messaging guard, we need the business owner's auth userId
    const profileData = business as any;
    const businessAuthUserId = profileData.userId || profileData.ownerId;
    const senderId = user?.id;
    
    // Dev logging for ID mapping debugging
    if (__DEV__) {
      console.log("[BusinessProfile] handleMessage - senderId:", senderId, "businessAuthUserId:", businessAuthUserId, "entityId:", business.id);
    }
    
    // Frontend guard: Block self-messaging using auth user IDs
    if (senderId && businessAuthUserId && businessAuthUserId === senderId) {
      Alert.alert("Cannot Message", "You cannot send a message to yourself.");
      return;
    }
    
    try {
      setIsStartingChat(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const authToken = await getToken();
      const participantType = business.resultType === "photographer" ? "photographer" : "business";
      
      // API expects business/photographer entity ID, not auth userId
      const response = await api.createOrGetConversation({
        participantId: business.id,
        participantType,
        participantName: business.name,
        participantAvatar: business.avatar,
      }, authToken);
      
      // Handle both { id } and { conversation: { id } } response shapes
      const conversationId = (response as any).conversation?.id || response.id;
      console.log("[BusinessProfile] Navigating to conversation:", conversationId);
      
      if (!conversationId) {
        throw new Error("No conversation ID returned from API");
      }
      
      navigation.navigate("Chat", {
        conversationId,
        participantId: business.id,
        participantName: business.name,
        participantAvatar: business.avatar,
        participantType,
      });
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleBook = () => {
    if (business.resultType === "photographer") {
      const photographer = {
        id: business.id,
        name: business.name,
        avatar: business.avatar,
        location: `${business.city}, ${business.state}`,
        rating: business.rating,
        specialty: business.category,
        priceRange: business.priceRange,
      };
      navigation.navigate("PhotographerDetail", { photographer: photographer as any });
    } else {
      navigation.navigate("VendorDetail", { vendorId: business.id });
    }
  };

  const handleVisitWebsite = async () => {
    if (business.website) {
      const url = business.website.startsWith("http")
        ? business.website
        : `https://${business.website}`;
      try {
        await Linking.openURL(url);
      } catch {
        // Handle error silently
      }
    }
  };

  const handleCall = async () => {
    if (business.phone) {
      try {
        await Linking.openURL(`tel:${business.phone}`);
      } catch {
        // Handle error silently
      }
    }
  };

  const handleEmail = async () => {
    if (business.email) {
      try {
        await Linking.openURL(`mailto:${business.email}`);
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
            source={{ uri: business.coverImage || business.avatar || FALLBACK_COVER }}
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
              <Image
                source={{ uri: business.avatar }}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
              />
              {tierConfig ? (
                <View style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}>
                  <Feather name="award" size={12} color="#000000" />
                </View>
              ) : null}
            </View>

            <ThemedText type="h2" style={styles.businessName}>
              {business.name}
            </ThemedText>

            <View style={styles.categoryRow}>
              <View style={[styles.categoryBadge, { backgroundColor: profileTheme }]}>
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {business.category}
                </ThemedText>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color="rgba(255,255,255,0.8)" />
                <ThemedText type="body" style={styles.metaText}>
                  {business.city}
                  {business.state ? `, ${business.state}` : ""}
                </ThemedText>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Feather name="star" size={14} color="#FFD700" />
                <ThemedText type="body" style={styles.metaText}>
                  {business.rating.toFixed(1)}
                  {business.reviewCount ? ` (${business.reviewCount})` : ""}
                </ThemedText>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <ThemedText type="body" style={styles.metaText}>
                  {business.priceRange}
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
              <Feather
                name={business.resultType === "photographer" ? "calendar" : "shopping-bag"}
                size={20}
                color="#FFFFFF"
              />
              <ThemedText
                type="body"
                style={{ marginLeft: Spacing.sm, color: "#FFFFFF", fontWeight: "600" }}
              >
                {business.resultType === "photographer" ? "Book" : "View Services"}
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

          {hasDescription ? (
            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.sectionHeader}>
                <Feather name="info" size={18} color={profileTheme} />
                <ThemedText type="h4" style={styles.sectionTitle}>
                  About
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22 }}>
                {business.description}
              </ThemedText>
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

              {hasAddress ? (
                <View style={styles.infoRow}>
                  <Feather name="map-pin" size={16} color={theme.textSecondary} />
                  <ThemedText type="body" style={styles.infoText}>
                    {business.address}
                  </ThemedText>
                </View>
              ) : null}

              {hasPhone ? (
                <Pressable
                  onPress={handleCall}
                  style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="phone" size={16} color={profileTheme} />
                  <ThemedText type="body" style={[styles.infoText, { color: profileTheme }]}>
                    {business.phone}
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
                    {business.email}
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
                    {business.website}
                  </ThemedText>
                </Pressable>
              ) : null}

              {hasSocials ? (
                <View style={styles.socialsRow}>
                  {business.instagram ? (
                    <Pressable
                      onPress={() => handleSocial(`https://instagram.com/${business.instagram}`)}
                      style={({ pressed }) => [
                        styles.socialButton,
                        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="instagram" size={20} color={theme.text} />
                    </Pressable>
                  ) : null}
                  {business.facebook ? (
                    <Pressable
                      onPress={() => handleSocial(`https://facebook.com/${business.facebook}`)}
                      style={({ pressed }) => [
                        styles.socialButton,
                        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="facebook" size={20} color={theme.text} />
                    </Pressable>
                  ) : null}
                  {business.twitter ? (
                    <Pressable
                      onPress={() => handleSocial(`https://twitter.com/${business.twitter}`)}
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
    height: 320,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  tierBadge: {
    position: "absolute",
    bottom: 0,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  businessName: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  categoryRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
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

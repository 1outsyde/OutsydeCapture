import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  Platform,
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
  const { business } = route.params;

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

  const handleMessage = () => {
    navigation.navigate("Conversation", { conversationId: business.id });
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

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              { top: insets.top + Spacing.md, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>

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
              <View style={[styles.categoryBadge, { backgroundColor: theme.primary }]}>
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
            <Pressable
              onPress={handleMessage}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonSecondary,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="message-circle" size={20} color={theme.text} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
                Message
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleBook}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonPrimary,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
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
                <Feather name="info" size={18} color={theme.primary} />
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
                <Feather name="file-text" size={18} color={theme.primary} />
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
                  <Feather name="phone" size={16} color={theme.primary} />
                  <ThemedText type="body" style={[styles.infoText, { color: theme.primary }]}>
                    {business.phone}
                  </ThemedText>
                </Pressable>
              ) : null}

              {hasEmail ? (
                <Pressable
                  onPress={handleEmail}
                  style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="mail" size={16} color={theme.primary} />
                  <ThemedText type="body" style={[styles.infoText, { color: theme.primary }]}>
                    {business.email}
                  </ThemedText>
                </Pressable>
              ) : null}

              {hasWebsite ? (
                <Pressable
                  onPress={handleVisitWebsite}
                  style={({ pressed }) => [styles.infoRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="globe" size={16} color={theme.primary} />
                  <ThemedText
                    type="body"
                    style={[styles.infoText, { color: theme.primary }]}
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
  closeButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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

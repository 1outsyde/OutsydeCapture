import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { PersonalSettingsMenu } from "@/components/PersonalSettingsMenu";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useLoyalty } from "@/context/LoyaltyContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PORTFOLIO_IMAGE_SIZE = SCREEN_WIDTH * 0.6;

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "#FFD700" },
  pro: { label: "Pro", color: "#C0C0C0" },
  basic: { label: "Basic", color: "#CD7F32" },
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800";

interface ProfileData {
  id: string;
  name: string;
  avatar?: string;
  coverImage?: string;
  city?: string;
  state?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
  specialties?: string[];
  portfolio?: string[];
  brandColors?: string;
  subscriptionTier?: string;
  priceRange?: string;
  stripeOnboardingComplete?: boolean;
}

export default function AccountScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user, isAuthenticated, getToken, updateProfile } = useAuth();
  const { points } = useLoyalty();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || "");
  const [editLastName, setEditLastName] = useState(user?.lastName || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");

  const userRole = user?.role || "consumer";

  const fetchProfile = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (userRole === "photographer") {
        const photographer = (await api.getPhotographerMe(token)) as any;
        setProfile({
          id: photographer.id,
          name: photographer.displayName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
          avatar: photographer.logoImage,
          coverImage: photographer.coverImage,
          city: photographer.city,
          state: photographer.state,
          bio: photographer.bio,
          rating: photographer.rating,
          reviewCount: photographer.reviewCount,
          specialties: photographer.specialties,
          portfolio: photographer.portfolio,
          brandColors: photographer.brandColors,
          subscriptionTier: photographer.subscriptionTier,
          priceRange: photographer.hourlyRate
            ? `$${(photographer.hourlyRate / 100).toFixed(0)}/hr`
            : undefined,
          stripeOnboardingComplete: photographer.stripeOnboardingComplete,
        });
      } else if (userRole === "business") {
        const { business: vendor } = await api.getVendorMyBusiness(token);
        setProfile({
          id: vendor.id,
          name: vendor.name,
          avatar: vendor.logoImage || undefined,
          coverImage: vendor.coverImage || undefined,
          city: vendor.city || undefined,
          state: vendor.state || undefined,
          bio: vendor.description || undefined,
          rating: vendor.rating || undefined,
          reviewCount: vendor.reviewCount || undefined,
          specialties: vendor.category ? [vendor.category] : [],
          brandColors: vendor.brandColors || undefined,
        });
      } else {
        setProfile({
          id: user?.id || "",
          name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
          avatar: user?.avatar,
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      setProfile({
        id: user?.id || "",
        name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
        avatar: user?.avatar,
      });
    } finally {
      setLoading(false);
    }
  }, [userRole, getToken, user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchProfile]);

  const handleSaveProfile = async () => {
    await updateProfile({
      firstName: editFirstName,
      lastName: editLastName,
      phone: editPhone,
    });
    setIsEditing(false);
    fetchProfile();
  };

  const getProfileTheme = (): string => {
    if (profile?.brandColors) {
      try {
        const colors =
          typeof profile.brandColors === "string"
            ? JSON.parse(profile.brandColors)
            : profile.brandColors;
        return colors.primary || theme.primary;
      } catch {
        return theme.primary;
      }
    }
    return theme.primary;
  };

  const profileTheme = getProfileTheme();
  const tierConfig = profile?.subscriptionTier
    ? TIER_CONFIG[profile.subscriptionTier]
    : null;

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.authContainer, { paddingTop: insets.top }]}>
          <Feather name="camera" size={64} color={theme.primary} />
          <ThemedText type="h2" style={styles.authTitle}>
            Welcome to Outsyde
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.authSubtitle, { color: theme.textSecondary }]}
          >
            Sign in to book photographers, manage sessions, and more
          </ThemedText>
          <Button
            onPress={() => navigation.navigate("Auth", {})}
            style={styles.authButton}
          >
            Sign In or Sign Up
          </Button>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  const hasDescription = Boolean(profile?.bio);
  const hasPortfolio = profile?.portfolio && profile.portfolio.length > 0;
  const hasSpecialties = profile?.specialties && profile.specialties.length > 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Image
            source={{
              uri:
                profile?.coverImage || profile?.avatar || FALLBACK_COVER,
            }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.heroOverlay} />

          <View style={[styles.headerButtons, { top: insets.top + Spacing.md }]}>
            <View style={{ flex: 1 }} />
            {!user?.isGuest && (
              <Pressable
                onPress={() => setSettingsVisible(true)}
                style={({ pressed }) => [
                  styles.settingsButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="menu" size={24} color="#FFFFFF" />
              </Pressable>
            )}
          </View>

          <View style={styles.heroContent}>
            <View style={styles.avatarContainer}>
              {profile?.avatar ? (
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarPlaceholder,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <Feather name="user" size={40} color={theme.textSecondary} />
                </View>
              )}
              {tierConfig ? (
                <View
                  style={[styles.tierBadge, { backgroundColor: tierConfig.color }]}
                >
                  <Feather name="award" size={12} color="#000000" />
                </View>
              ) : null}
            </View>

            <ThemedText type="h2" style={styles.profileName}>
              {profile?.name || "Your Profile"}
            </ThemedText>

            {hasSpecialties ? (
              <View style={styles.badgesRow}>
                {profile!.specialties!.slice(0, 3).map((spec, index) => (
                  <View
                    key={index}
                    style={[
                      styles.specialtyBadge,
                      {
                        backgroundColor:
                          index === 0 ? profileTheme : "rgba(255,255,255,0.2)",
                      },
                    ]}
                  >
                    {index === 0 && (
                      <Feather name="camera" size={12} color="#FFFFFF" />
                    )}
                    <ThemedText type="small" style={styles.specialtyText}>
                      {spec}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {(profile?.city || profile?.state) && (
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Feather
                    name="map-pin"
                    size={14}
                    color="rgba(255,255,255,0.8)"
                  />
                  <ThemedText type="body" style={styles.metaText}>
                    {profile.city}
                    {profile.state ? `, ${profile.state}` : ""}
                  </ThemedText>
                </View>
                {profile?.rating !== undefined && profile.rating > 0 && (
                  <>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <Feather name="star" size={14} color="#FFD700" />
                      <ThemedText type="body" style={styles.metaText}>
                        {profile.rating.toFixed(1)}
                        {profile.reviewCount ? ` (${profile.reviewCount})` : ""}
                      </ThemedText>
                    </View>
                  </>
                )}
                {profile?.priceRange && (
                  <>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <ThemedText type="body" style={styles.metaText}>
                        {profile.priceRange}
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.contentSection}>
          {userRole !== "consumer" && !profile?.stripeOnboardingComplete && (
            <View
              style={[
                styles.stripeAlert,
                { backgroundColor: "#FF950020", borderColor: "#FF9500" },
              ]}
            >
              <Feather name="alert-circle" size={20} color="#FF9500" />
              <View style={styles.stripeAlertContent}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Complete Your Setup
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  Connect Stripe to accept bookings and receive payments
                </ThemedText>
              </View>
              <Pressable
                onPress={() => {
                  if (userRole === "photographer") {
                    navigation.navigate("PhotographerDashboard");
                  } else {
                    navigation.navigate("BusinessDashboard");
                  }
                }}
                style={[styles.stripeAlertButton, { backgroundColor: "#FF9500" }]}
              >
                <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                  Set Up
                </ThemedText>
              </Pressable>
            </View>
          )}

          {!user?.isGuest && (
            <Pressable
              onPress={() => setSettingsVisible(true)}
              style={[styles.pointsCard, { backgroundColor: theme.primary }]}
            >
              <View style={styles.pointsCardContent}>
                <View style={styles.pointsInfo}>
                  <Feather name="star" size={24} color="#FFFFFF" />
                  <View style={styles.pointsTextContainer}>
                    <ThemedText
                      type="small"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                      Outsyde Points
                    </ThemedText>
                    <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                      {points.toLocaleString()}
                    </ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={24} color="#FFFFFF" />
              </View>
            </Pressable>
          )}

          {isEditing ? (
            <View style={styles.editSection}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Edit Profile
              </ThemedText>
              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  First Name
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                    },
                  ]}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="First name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Last Name
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                    },
                  ]}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Last name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Phone
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                    },
                  ]}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Phone number"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.editButtons}>
                <Pressable
                  onPress={() => {
                    setEditFirstName(user?.firstName || "");
                    setEditLastName(user?.lastName || "");
                    setEditPhone(user?.phone || "");
                    setIsEditing(false);
                  }}
                  style={[
                    styles.cancelButton,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <ThemedText type="button">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSaveProfile}
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                >
                  <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                    Save Changes
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {hasDescription && (
                <View style={styles.section}>
                  <ThemedText type="h4" style={styles.sectionTitle}>
                    About
                  </ThemedText>
                  <ThemedText
                    type="body"
                    style={{ color: theme.textSecondary, lineHeight: 24 }}
                  >
                    {profile!.bio}
                  </ThemedText>
                </View>
              )}

              {hasPortfolio && (
                <View style={styles.section}>
                  <ThemedText type="h4" style={styles.sectionTitle}>
                    Portfolio
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.portfolioScroll}
                  >
                    {profile!.portfolio!.map((img, index) => (
                      <Image
                        key={index}
                        source={{ uri: img }}
                        style={styles.portfolioImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {userRole === "consumer" && !user?.isGuest && (
                <View style={styles.section}>
                  <ThemedText type="h4" style={styles.sectionTitle}>
                    Quick Actions
                  </ThemedText>
                  <Pressable
                    onPress={() => setIsEditing(true)}
                    style={[
                      styles.actionItem,
                      { backgroundColor: theme.backgroundDefault },
                    ]}
                  >
                    <View style={styles.actionItemLeft}>
                      <Feather name="edit-2" size={20} color={theme.text} />
                      <ThemedText type="body" style={styles.actionItemText}>
                        Edit Profile
                      </ThemedText>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <PersonalSettingsMenu
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onEditProfile={
          userRole === "consumer" ? () => setIsEditing(true) : undefined
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  authContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  authTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  authSubtitle: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  authButton: {
    width: "100%",
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
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  headerButtons: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 10,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xl,
    paddingBottom: Spacing["2xl"],
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  tierBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileName: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.sm,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  specialtyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
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
    justifyContent: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: Spacing.sm,
  },
  metaText: {
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  contentSection: {
    padding: Spacing.xl,
  },
  stripeAlert: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  stripeAlertContent: {
    flex: 1,
  },
  stripeAlertButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  pointsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  pointsCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pointsInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  pointsTextContainer: {
    marginLeft: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  portfolioScroll: {
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  portfolioImage: {
    width: PORTFOLIO_IMAGE_SIZE,
    height: PORTFOLIO_IMAGE_SIZE * 0.75,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  actionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionItemText: {
    marginLeft: Spacing.md,
  },
  editSection: {
    marginBottom: Spacing.xl,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  editButtons: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  saveButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
  },
});

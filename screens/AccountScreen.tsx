import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { PersonalSettingsMenu } from "@/components/PersonalSettingsMenu";
import { BookingFlow, PhotographerService, PhotographerProfile } from "@/components/BookingFlow";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { VendorBookerAvailabilitySlot, BlockedDate } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 340;
const AVATAR_SIZE = 100;
const TAB_HEIGHT = 56;
const PORTFOLIO_CARD_WIDTH = 160;
const PORTFOLIO_CARD_HEIGHT = 200;

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
  hourlyRate?: number;
  stripeOnboardingComplete?: boolean;
  availability?: { start: string; end: string } | null;
}

interface PortfolioCategory {
  name: string;
  count: number;
  image: string;
  rating?: number;
  reviewCount?: number;
}

interface FeaturedPost {
  id: string;
  imageUri: string;
  caption: string;
  likes: number;
  comments: number;
  createdAt: Date;
}

type ProfileTab = "featured" | "book" | "availability" | "reviews";

const PHOTOGRAPHER_TABS: { key: ProfileTab; label: string; icon: string }[] = [
  { key: "featured", label: "Featured", icon: "star" },
  { key: "book", label: "Book", icon: "calendar" },
  { key: "availability", label: "Availability", icon: "clock" },
  { key: "reviews", label: "Reviews", icon: "message-square" },
];

const BUSINESS_TABS: { key: ProfileTab; label: string; icon: string }[] = [
  { key: "featured", label: "Products", icon: "shopping-bag" },
  { key: "book", label: "Services", icon: "briefcase" },
  { key: "availability", label: "Availability", icon: "clock" },
  { key: "reviews", label: "Reviews", icon: "message-square" },
];

export default function AccountScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user, isAuthenticated, getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("featured");
  const [portfolioCategories, setPortfolioCategories] = useState<PortfolioCategory[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<VendorBookerAvailabilitySlot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [photographerServices, setPhotographerServices] = useState<PhotographerService[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{ date: string; startTime: string; endTime: string }[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostImage, setNewPostImage] = useState<string>("");
  const [newPostCaption, setNewPostCaption] = useState("");

  const userRole = user?.role || "consumer";
  const isOwner = true;
  const isGuest = user?.isGuest || false;

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
          hourlyRate: photographer.hourlyRate,
          stripeOnboardingComplete: photographer.stripeOnboardingComplete,
          availability: photographer.todayAvailability || null,
        });

        if (photographer.portfolio && photographer.portfolio.length > 0) {
          const categories: PortfolioCategory[] = [];
          const specialties = photographer.specialties || ["Weddings", "Portraits", "Travel"];
          specialties.forEach((spec: string, index: number) => {
            if (photographer.portfolio[index]) {
              categories.push({
                name: spec,
                count: Math.floor(Math.random() * 500) + 100,
                image: photographer.portfolio[index],
                rating: 4.5 + Math.random() * 0.5,
                reviewCount: Math.floor(Math.random() * 300) + 50,
              });
            }
          });
          setPortfolioCategories(categories);
        }

        // Fetch availability, blocked dates, and services
        try {
          const [availRes, blockedRes, servicesRes] = await Promise.all([
            api.getPhotographerMeAvailability(token),
            api.getPhotographerBlockedDates(token),
            api.getPhotographerMeServices(token),
          ]);
          setAvailabilitySlots(availRes.availability || []);
          setBlockedDates(blockedRes.blockedDates || []);
          
          const servicesList = servicesRes.services || [];
          const mappedServices: PhotographerService[] = servicesList.map((svc: any) => ({
            id: svc.id,
            name: svc.name,
            description: svc.description,
            price: svc.price,
            durationMinutes: svc.durationMinutes,
            category: svc.category,
            isPromo: svc.isPromo,
            promoPrice: svc.promoPrice,
            promoEndDate: svc.promoEndDate,
          }));
          setPhotographerServices(mappedServices);
        } catch (availError) {
          console.warn("[AccountScreen] Could not fetch availability/services:", availError);
        }
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
  const tabs = userRole === "photographer" ? PHOTOGRAPHER_TABS : BUSINESS_TABS;

  const formatHourlyRate = (rate?: number): string => {
    if (!rate) return "";
    return `$${(rate / 100).toFixed(0)} / hour`;
  };

  const getAvailabilityText = (): string => {
    if (profile?.availability) {
      return `Available Today: ${profile.availability.start} - ${profile.availability.end}`;
    }
    return "Available Today: 10AM - 6PM";
  };

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

  const handlePickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewPostImage(result.assets[0].uri);
    }
  };

  const handleCreatePost = () => {
    if (!newPostImage) {
      Alert.alert("No Image", "Please select an image for your post.");
      return;
    }
    const newPost: FeaturedPost = {
      id: Date.now().toString(),
      imageUri: newPostImage,
      caption: newPostCaption,
      likes: 0,
      comments: 0,
      createdAt: new Date(),
    };
    setFeaturedPosts([newPost, ...featuredPosts]);
    setNewPostImage("");
    setNewPostCaption("");
    setShowCreatePost(false);
  };

  const renderFeaturedTab = () => (
    <View style={styles.tabContent}>
      {/* Create Post Button for Owners */}
      {isOwner && !isGuest && (
        <Pressable
          onPress={() => setShowCreatePost(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: profileTheme,
            paddingVertical: 14,
            borderRadius: 12,
            marginBottom: Spacing.md,
          }}
        >
          <Feather name="plus" size={20} color="#000" />
          <ThemedText type="button" style={{ color: "#000", marginLeft: 8 }}>
            Create Post
          </ThemedText>
        </Pressable>
      )}

      {/* Posts Grid - Instagram Style */}
      {featuredPosts.length > 0 || (profile?.portfolio && profile.portfolio.length > 0) ? (
        <View style={styles.mediaGrid}>
          {/* Featured Posts first */}
          {featuredPosts.map((post) => (
            <Pressable key={post.id} style={styles.mediaGridItem}>
              <Image
                source={{ uri: post.imageUri }}
                style={styles.mediaGridImage}
                contentFit="cover"
                transition={200}
              />
              <View style={{ position: "absolute", bottom: 6, left: 6, flexDirection: "row", alignItems: "center" }}>
                <Feather name="heart" size={14} color="#fff" />
                <ThemedText type="small" style={{ color: "#fff", marginLeft: 4, textShadowColor: "#000", textShadowRadius: 2 }}>
                  {post.likes}
                </ThemedText>
              </View>
            </Pressable>
          ))}
          {/* Portfolio images */}
          {profile?.portfolio?.map((img, index) => (
            <Pressable key={`portfolio-${index}`} style={styles.mediaGridItem}>
              <Image
                source={{ uri: img }}
                style={styles.mediaGridImage}
                contentFit="cover"
                transition={200}
              />
              <Pressable style={styles.favoriteButton}>
                <Feather name="heart" size={18} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyTab}>
          <Feather name="camera" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No posts yet
          </ThemedText>
          {isOwner && !isGuest && (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Share your best work to attract clients
            </ThemedText>
          )}
        </View>
      )}

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: Spacing.lg,
            maxHeight: "90%",
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
              <ThemedText type="h3">Create Post</ThemedText>
              <Pressable onPress={() => { setShowCreatePost(false); setNewPostImage(""); setNewPostCaption(""); }}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Image Picker */}
            <Pressable
              onPress={handlePickPostImage}
              style={{
                width: "100%",
                aspectRatio: 1,
                backgroundColor: theme.backgroundSecondary,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Spacing.md,
                overflow: "hidden",
              }}
            >
              {newPostImage ? (
                <Image source={{ uri: newPostImage }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Feather name="image" size={48} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                    Tap to select photo
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {/* Caption Input */}
            <TextInput
              value={newPostCaption}
              onChangeText={setNewPostCaption}
              placeholder="Write a caption..."
              placeholderTextColor={theme.textSecondary}
              multiline
              style={{
                backgroundColor: theme.backgroundSecondary,
                borderRadius: 12,
                padding: Spacing.md,
                color: theme.text,
                minHeight: 80,
                textAlignVertical: "top",
                marginBottom: Spacing.md,
              }}
            />

            {/* Post Button */}
            <Pressable
              onPress={handleCreatePost}
              style={{
                backgroundColor: profileTheme,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <ThemedText type="button" style={{ color: "#000" }}>Share Post</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );

  const handleBookingComplete = async (booking: {
    serviceId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    console.log("[AccountScreen] Booking requested:", booking);
  };

  const photographerProfile: PhotographerProfile = {
    id: profile?.id || "",
    name: profile?.name || "Photographer",
    avatar: profile?.avatar,
    rating: profile?.rating,
    reviewCount: profile?.reviewCount,
    hourlyRate: profile?.hourlyRate,
    brandColors: profile?.brandColors,
  };

  const renderBookTab = () => (
    <View style={styles.bookTabContainer}>
      <BookingFlow
        photographer={photographerProfile}
        services={photographerServices}
        availabilitySlots={availabilitySlots}
        blockedDates={blockedDates}
        bookedSlots={bookedSlots}
        onBookingComplete={handleBookingComplete}
        accentColor={profileTheme}
      />
    </View>
  );

  const getNext7Days = () => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const isDateBlocked = (date: Date): boolean => {
    const dateStr = date.toISOString().split("T")[0];
    return blockedDates.some((blocked) => blocked.date === dateStr);
  };

  const getDayAvailability = (date: Date): string | null => {
    const dayIndex = date.getDay();
    const slot = availabilitySlots.find((s) => s.dayOfWeek === dayIndex && s.isRecurring);
    if (!slot) return null;
    return `${slot.startTime} - ${slot.endTime}`;
  };

  const formatDayLabel = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const renderAvailabilityTab = () => {
    const next7Days = getNext7Days();
    const hasAnyAvailability = availabilitySlots.length > 0;

    return (
      <View style={styles.tabContent}>
        <View style={[styles.availabilityCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
          <View style={styles.availabilityHeader}>
            <Feather name="calendar" size={20} color={profileTheme} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Weekly Availability</ThemedText>
          </View>

          {!hasAnyAvailability ? (
            <View style={{ paddingVertical: Spacing.lg }}>
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                No availability set yet
              </ThemedText>
              {isOwner && (
                <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
                  Go to Dashboard to set your hours
                </ThemedText>
              )}
            </View>
          ) : (
            <View style={{ marginTop: Spacing.md }}>
              {next7Days.map((date, index) => {
                const isBlocked = isDateBlocked(date);
                const hours = getDayAvailability(date);
                const dayLabel = formatDayLabel(date);

                return (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: Spacing.sm,
                      borderBottomWidth: index < 6 ? 1 : 0,
                      borderBottomColor: isDark ? "#333" : "#E5E5E5",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {dayLabel}
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {isBlocked ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Feather name="x-circle" size={14} color="#FF3B30" />
                          <ThemedText type="small" style={{ color: "#FF3B30", marginLeft: 4 }}>
                            Blocked
                          </ThemedText>
                        </View>
                      ) : hours ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Feather name="check-circle" size={14} color="#34C759" />
                          <ThemedText type="small" style={{ color: "#34C759", marginLeft: 4 }}>
                            {hours}
                          </ThemedText>
                        </View>
                      ) : (
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          Unavailable
                        </ThemedText>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {blockedDates.length > 0 && (
          <View style={[styles.availabilityCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", marginTop: Spacing.md }]}>
            <View style={styles.availabilityHeader}>
              <Feather name="x-circle" size={18} color="#FF3B30" />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Blocked Dates</ThemedText>
            </View>
            <View style={{ marginTop: Spacing.sm }}>
              {blockedDates.slice(0, 3).map((blocked, index) => (
                <View key={index} style={{ paddingVertical: 4 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {new Date(blocked.date).toLocaleDateString()}
                    {blocked.isFullDay ? " (Full Day)" : ` (${blocked.startTime} - ${blocked.endTime})`}
                    {blocked.reason ? ` - ${blocked.reason}` : ""}
                  </ThemedText>
                </View>
              ))}
              {blockedDates.length > 3 && (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  +{blockedDates.length - 3} more
                </ThemedText>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderReviewsTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.reviewCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
        <View style={styles.reviewHeader}>
          <Feather name="message-square" size={18} color={profileTheme} />
          <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Reviews</ThemedText>
        </View>
        <ThemedText type="body" style={{ marginTop: Spacing.md, fontStyle: "italic" }}>
          "Super professional, fast turnaround..."
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
          - Sarah M.
        </ThemedText>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "featured":
        return renderFeaturedTab();
      case "book":
        return renderBookTab();
      case "availability":
        return renderAvailabilityTab();
      case "reviews":
        return renderReviewsTab();
      default:
        return renderFeaturedTab();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: profile?.coverImage || profile?.avatar || FALLBACK_COVER }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.heroGradient}
          />

          {/* Header Buttons */}
          <View style={[styles.headerButtons, { top: insets.top + Spacing.md }]}>
            {!isGuest && isOwner && (
              <Pressable
                onPress={() => setSettingsVisible(true)}
                style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="menu" size={22} color="#FFFFFF" />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {!isOwner && (
              <>
                <Pressable style={[styles.followButton, { backgroundColor: profileTheme }]}>
                  <ThemedText type="button" style={{ color: "#000000" }}>Follow</ThemedText>
                </Pressable>
                <Pressable style={[styles.headerButton, { marginLeft: Spacing.sm }]}>
                  <Feather name="share" size={20} color="#FFFFFF" />
                </Pressable>
              </>
            )}
          </View>

          {/* Profile Identity */}
          <View style={styles.profileIdentity}>
            <View style={styles.avatarContainer}>
              {profile?.avatar ? (
                <Image
                  source={{ uri: profile.avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
                  <Feather name="user" size={40} color={theme.textSecondary} />
                </View>
              )}
            </View>

            <ThemedText type="h2" style={styles.profileName}>
              {profile?.name || "Your Profile"}
            </ThemedText>

            {profile?.bio && (
              <ThemedText type="body" style={styles.profileBio}>
                {profile.bio}
              </ThemedText>
            )}

            <View style={styles.profileMeta}>
              {(profile?.city || profile?.state) && (
                <ThemedText type="body" style={styles.profileLocation}>
                  {profile.city}{profile.state ? `, ${profile.state}` : ""}
                </ThemedText>
              )}
              {profile?.hourlyRate && (
                <ThemedText type="h4" style={styles.profileRate}>
                  {formatHourlyRate(profile.hourlyRate)}
                </ThemedText>
              )}
            </View>

            {profile?.specialties && profile.specialties.length > 0 && (
              <View style={styles.specialtiesRow}>
                {profile.specialties.slice(0, 3).map((spec, index) => (
                  <View
                    key={index}
                    style={[styles.specialtyPill, { backgroundColor: index === 0 ? profileTheme : "rgba(255,255,255,0.2)" }]}
                  >
                    <ThemedText type="small" style={styles.specialtyText}>{spec}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Availability Strip */}
        {userRole !== "consumer" && (
          <Pressable
            style={[styles.availabilityStrip, { backgroundColor: profileTheme }]}
            onPress={() => setActiveTab("availability")}
          >
            <Feather name="clock" size={16} color="#000000" />
            <ThemedText type="body" style={styles.availabilityText}>
              {getAvailabilityText()}
            </ThemedText>
            <Feather name="chevron-right" size={18} color="#000000" />
          </Pressable>
        )}

        {/* Tab Navigation */}
        {userRole !== "consumer" && (
          <View style={[styles.tabBar, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[
                  styles.tabItem,
                  activeTab === tab.key && { borderBottomColor: profileTheme, borderBottomWidth: 2 },
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <View
                  style={[
                    styles.tabIconContainer,
                    activeTab === tab.key && { backgroundColor: profileTheme },
                  ]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={18}
                    color={activeTab === tab.key ? "#000000" : theme.textSecondary}
                  />
                </View>
                <ThemedText
                  type="small"
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab.key ? theme.text : theme.textSecondary },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {/* Tab Content or Consumer Profile */}
        {userRole !== "consumer" ? (
          renderTabContent()
        ) : (
          <View style={styles.consumerContent}>
            {!isGuest && (
              <Pressable
                style={[styles.editProfileButton, { borderColor: theme.border }]}
                onPress={() => navigation.navigate("PhotographerDashboard")}
              >
                <Feather name="edit-2" size={18} color={theme.text} />
                <ThemedText type="button" style={{ marginLeft: Spacing.sm }}>
                  Edit Profile
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {/* Browse Portfolio Section */}
        {userRole !== "consumer" && portfolioCategories.length > 0 && (
          <View style={styles.portfolioSection}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3">Browse Portfolio</ThemedText>
              <Pressable>
                <Feather name="chevron-right" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.portfolioScroll}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            >
              {portfolioCategories.map((category, index) => (
                <Pressable key={index} style={styles.portfolioCard}>
                  <Image
                    source={{ uri: category.image }}
                    style={styles.portfolioCardImage}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)"]}
                    style={styles.portfolioCardGradient}
                  />
                  <Pressable style={styles.portfolioFavorite}>
                    <Feather name="heart" size={16} color="#FFFFFF" />
                  </Pressable>
                  <View style={styles.portfolioCardContent}>
                    <ThemedText type="body" style={styles.portfolioCardTitle}>
                      {category.name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.portfolioCardCount}>
                      {category.count.toLocaleString()}
                    </ThemedText>
                    <View style={styles.portfolioCardRating}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Feather
                          key={star}
                          name="star"
                          size={10}
                          color={star <= Math.floor(category.rating || 0) ? "#FFD700" : "rgba(255,255,255,0.3)"}
                        />
                      ))}
                      <ThemedText type="small" style={styles.portfolioCardReviewCount}>
                        ({category.reviewCount})
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* For You Section */}
        {userRole !== "consumer" && (
          <View style={styles.forYouSection}>
            <ThemedText type="h3" style={styles.sectionTitle}>For You</ThemedText>
            <View style={styles.forYouGrid}>
              {/* Featured Package */}
              <View style={[styles.forYouCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
                <Image
                  source={{ uri: profile?.portfolio?.[0] || FALLBACK_COVER }}
                  style={styles.forYouImage}
                  contentFit="cover"
                />
                <Pressable style={styles.forYouFavorite}>
                  <Feather name="heart" size={16} color={profileTheme} />
                </Pressable>
                <View style={styles.forYouContent}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>Wedding Package</ThemedText>
                  <ThemedText type="h4" style={{ color: profileTheme }}>$1,500</ThemedText>
                  <View style={styles.forYouRating}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Feather key={star} name="star" size={12} color={star <= 4 ? "#FFD700" : theme.textSecondary} />
                    ))}
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                      (245)
                    </ThemedText>
                  </View>
                </View>
              </View>

              {/* Quick Info Cards */}
              <View style={styles.quickInfoColumn}>
                <View style={[styles.quickInfoCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
                  <View style={styles.quickInfoHeader}>
                    <Feather name="calendar" size={16} color={profileTheme} />
                    <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
                      Availability
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                    Today: 3:30 PM - 6:00 PM
                  </ThemedText>
                  <Pressable style={styles.quickInfoLink}>
                    <ThemedText type="small" style={{ color: profileTheme }}>
                      View full availability
                    </ThemedText>
                    <Feather name="arrow-right" size={12} color={profileTheme} />
                  </Pressable>
                </View>

                <View style={[styles.quickInfoCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}>
                  <View style={styles.quickInfoHeader}>
                    <Feather name="message-square" size={16} color={profileTheme} />
                    <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
                      Reviews
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>
                    "Super professional, fast turnaround..."
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                    - Sarah M.
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Owner Actions - Edit Profile button for owners */}
        {isOwner && !isGuest && userRole !== "consumer" && (
          <View style={styles.ownerActions}>
            <Pressable
              style={[styles.editProfileButtonLarge, { backgroundColor: profileTheme }]}
              onPress={() => {
                if (userRole === "photographer") {
                  navigation.navigate("PhotographerDashboard");
                } else {
                  navigation.navigate("BusinessDashboard");
                }
              }}
            >
              <Feather name="edit-2" size={18} color="#000000" />
              <ThemedText type="button" style={{ color: "#000000", marginLeft: Spacing.sm }}>
                Edit Profile
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <PersonalSettingsMenu
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
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
    height: HERO_HEIGHT,
    position: "relative",
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.7,
  },
  headerButtons: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  followButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  profileIdentity: {
    position: "absolute",
    bottom: Spacing.xl,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  profileBio: {
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
  profileMeta: {
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  profileLocation: {
    color: "rgba(255,255,255,0.8)",
  },
  profileRate: {
    color: "#FFFFFF",
    marginTop: Spacing.xs,
  },
  specialtiesRow: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  specialtyPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  specialtyText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  availabilityStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  availabilityText: {
    color: "#000000",
    fontWeight: "600",
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    height: TAB_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  tabIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  tabContent: {
    padding: Spacing.lg,
    minHeight: 200,
  },
  bookTabContainer: {
    flex: 1,
    minHeight: 600,
  },
  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  mediaGridItem: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - 4) / 3,
    aspectRatio: 1,
    position: "relative",
  },
  mediaGridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  favoriteButton: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookingCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    flexDirection: "row",
    padding: Spacing.md,
  },
  bookingCardImage: {
    width: 100,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  bookingCardContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  favoriteButtonSmall: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
  },
  availabilityCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  availabilityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewFullButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: "flex-start",
    gap: Spacing.xs,
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  consumerContent: {
    padding: Spacing.xl,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  portfolioSection: {
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  portfolioScroll: {
    marginBottom: Spacing.lg,
  },
  portfolioCard: {
    width: PORTFOLIO_CARD_WIDTH,
    height: PORTFOLIO_CARD_HEIGHT,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
    overflow: "hidden",
    position: "relative",
  },
  portfolioCardImage: {
    width: "100%",
    height: "100%",
  },
  portfolioCardGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  portfolioFavorite: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  portfolioCardContent: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
  },
  portfolioCardTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  portfolioCardCount: {
    color: "rgba(255,255,255,0.8)",
  },
  portfolioCardRating: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 1,
  },
  portfolioCardReviewCount: {
    color: "rgba(255,255,255,0.7)",
    marginLeft: 4,
  },
  forYouSection: {
    marginTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  forYouGrid: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  forYouCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) * 0.45,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  forYouImage: {
    width: "100%",
    height: 140,
  },
  forYouFavorite: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  forYouContent: {
    padding: Spacing.md,
  },
  forYouRating: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  quickInfoColumn: {
    flex: 1,
    gap: Spacing.md,
  },
  quickInfoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  quickInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  quickInfoLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 4,
  },
  ownerActions: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  editProfileButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});

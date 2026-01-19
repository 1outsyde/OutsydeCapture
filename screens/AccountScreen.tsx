import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { useVideoPlayer, VideoView } from "expo-video";
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
import api, { VendorBookerAvailabilitySlot, BlockedDate, VendorProduct, VendorService, ApiPost } from "@/services/api";

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
  coverVideo?: string;
  city?: string;
  state?: string;
  bio?: string;
  tagline?: string;
  rating?: number;
  reviewCount?: number;
  specialties?: string[];
  portfolio?: string[];
  brandColors?: string;
  subscriptionTier?: string;
  hourlyRate?: number;
  stripeOnboardingComplete?: boolean;
  availability?: { start: string; end: string } | null;
  address?: string;
  hoursOfOperation?: any;
  contactPhone?: string;
  contactEmail?: string;
  websiteUrl?: string;
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

const mapApiPostToFeaturedPost = (post: ApiPost): FeaturedPost => ({
  id: post.id,
  imageUri: post.imageUrl || (post.images && post.images[0]) || "",
  caption: post.content || "",
  likes: post.likesCount || 0,
  comments: post.commentsCount || 0,
  createdAt: new Date(post.createdAt),
});

type ProfileTab = "featured" | "book" | "availability" | "reviews" | "products" | "services";

const PHOTOGRAPHER_TABS: { key: ProfileTab; label: string; icon: string }[] = [
  { key: "featured", label: "Featured", icon: "star" },
  { key: "book", label: "Book", icon: "calendar" },
  { key: "availability", label: "Availability", icon: "clock" },
  { key: "reviews", label: "Reviews", icon: "message-square" },
];

// Business tabs are now computed dynamically based on products/services

const CONSUMER_TABS: { key: ProfileTab; label: string; icon: string }[] = [
  { key: "featured", label: "Featured", icon: "star" },
  { key: "reviews", label: "Reviews", icon: "message-square" },
];

// Star Rating Display Component
const StarRating = ({ rating, reviewCount, size = 12, showCount = true, color = "#FFD700" }: {
  rating?: number | null;
  reviewCount?: number | null;
  size?: number;
  showCount?: boolean;
  color?: string;
}) => {
  const { theme } = useTheme();
  if (rating === undefined || rating === null || rating === 0) return null;
  
  const fullStars = Math.floor(rating / 10); // rating is 0-50, so divide by 10 for 0-5 stars
  const hasHalfStar = (rating % 10) >= 5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const displayRating = (rating / 10).toFixed(1);
  
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[...Array(fullStars)].map((_, i) => (
        <Feather key={`full-${i}`} name="star" size={size} color={color} style={{ marginRight: 1 }} />
      ))}
      {hasHalfStar && (
        <View style={{ position: "relative", marginRight: 1 }}>
          <Feather name="star" size={size} color={theme.textSecondary} />
          <View style={{ position: "absolute", overflow: "hidden", width: size / 2 }}>
            <Feather name="star" size={size} color={color} />
          </View>
        </View>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Feather key={`empty-${i}`} name="star" size={size} color={theme.textSecondary} style={{ marginRight: 1 }} />
      ))}
      <ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary, fontSize: size }}>
        {displayRating}
      </ThemedText>
      {showCount && reviewCount && reviewCount > 0 && (
        <ThemedText type="small" style={{ marginLeft: 2, color: theme.textSecondary, fontSize: size }}>
          ({reviewCount})
        </ThemedText>
      )}
    </View>
  );
};

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
  const [businessHasProducts, setBusinessHasProducts] = useState(false);
  const [businessHasServices, setBusinessHasServices] = useState(false);
  const [businessProducts, setBusinessProducts] = useState<VendorProduct[]>([]);
  const [businessServices, setBusinessServices] = useState<VendorService[]>([]);
  const [showStateVisibility, setShowStateVisibility] = useState(true);
  const [showEditPhotoModal, setShowEditPhotoModal] = useState(false);
  const [consumerReviews, setConsumerReviews] = useState<{ id: string; businessName: string; rating: number; comment: string; date: string }[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showVideoFullscreen, setShowVideoFullscreen] = useState(false);
  const [postSaving, setPostSaving] = useState(false);

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
        const coverUrl = photographer.coverImage || "";
        const isVideo = coverUrl.match(/\.(mp4|mov|webm|m4v)$/i) || coverUrl.includes("video");
        setProfile({
          id: photographer.id,
          name: photographer.displayName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
          avatar: photographer.logoImage,
          coverImage: isVideo ? undefined : photographer.coverImage,
          coverVideo: isVideo ? photographer.coverImage : undefined,
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
          const [availRes, blockedRes] = await Promise.all([
            api.getPhotographerMeAvailability(token),
            api.getPhotographerBlockedDates(token),
          ]);
          setAvailabilitySlots(availRes.availability || []);
          setBlockedDates(blockedRes.blockedDates || []);
        } catch (availError) {
          console.warn("[AccountScreen] Could not fetch availability:", availError);
        }

        // Fetch PUBLIC services using photographer ID (only returns active/live services)
        try {
          const publicServicesResponse = await api.getPhotographerPublicServices(photographer.id);
          // Handle both array response and wrapped { services: [...] } response
          let servicesList: any[] = [];
          if (Array.isArray(publicServicesResponse)) {
            servicesList = publicServicesResponse;
          } else if (publicServicesResponse && typeof publicServicesResponse === "object") {
            servicesList = (publicServicesResponse as any).services || [];
          }
          console.log("[AccountScreen] Raw public services response:", JSON.stringify(publicServicesResponse).slice(0, 200));
          console.log("[AccountScreen] Services list length:", servicesList.length);
          // Filter for live services (status can be "live" or "active")
          const activeServices = servicesList.filter((svc: any) => 
            svc.status === "live" || svc.status === "active"
          );
          console.log("[AccountScreen] Live services:", activeServices.length, "Statuses:", servicesList.map((s: any) => s.status));
          const mappedServices: PhotographerService[] = activeServices.map((svc: any) => ({
            id: svc.id,
            name: svc.name,
            description: svc.description,
            price: svc.priceCents ? svc.priceCents / 100 : (svc.price || 0),
            durationMinutes: svc.estimatedDurationMinutes || svc.durationMinutes || 60,
            category: svc.category,
            isPromo: svc.isPromo,
            promoPrice: svc.promoPrice,
            promoEndDate: svc.promoEndDate,
            rating: svc.rating || null,
            reviewCount: svc.reviewCount || null,
          }));
          setPhotographerServices(mappedServices);
        } catch (servicesError) {
          console.warn("[AccountScreen] Could not fetch public services:", servicesError);
        }
      } else if (userRole === "business") {
        const [businessRes, productsRes, servicesRes] = await Promise.all([
          api.getVendorMyBusiness(token),
          api.getVendorProducts(token).catch(() => ({ products: [] })),
          api.getVendorServices(token).catch(() => ({ services: [] })),
        ]);
        const vendor = businessRes.business;
        const coverUrl = vendor.coverImage || "";
        const isVideo = coverUrl.match(/\.(mp4|mov|webm|m4v)$/i) || coverUrl.includes("video");
        setProfile({
          id: vendor.id,
          name: vendor.name,
          avatar: vendor.logoImage || undefined,
          coverImage: isVideo ? undefined : (vendor.coverImage || undefined),
          coverVideo: isVideo ? (vendor.coverImage || undefined) : undefined,
          city: vendor.city || undefined,
          state: vendor.state || undefined,
          bio: vendor.description || undefined,
          tagline: vendor.tagline || undefined,
          rating: vendor.rating || undefined,
          reviewCount: vendor.reviewCount || undefined,
          specialties: vendor.category ? [vendor.category] : [],
          brandColors: vendor.brandColors || undefined,
          stripeOnboardingComplete: vendor.stripeOnboardingComplete ?? false,
          address: vendor.address || undefined,
          hoursOfOperation: vendor.hoursOfOperation || undefined,
          contactPhone: vendor.contactPhone || undefined,
          contactEmail: vendor.contactEmail || undefined,
          websiteUrl: vendor.websiteUrl || undefined,
        });
        
        const allProducts = productsRes.products || [];
        const allServices = servicesRes.services || [];
        setBusinessProducts(allProducts);
        setBusinessServices(allServices);
        
        const hasLiveProducts = allProducts.some(p => p.status === "live");
        const hasLiveServices = allServices.some(s => s.status === "live");
        setBusinessHasProducts(hasLiveProducts);
        setBusinessHasServices(hasLiveServices);
      } else {
        setProfile({
          id: user?.id || "",
          name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
          avatar: user?.avatar,
          city: user?.city,
          state: user?.state,
        });
      }
      // Fetch user's posts from the backend feed
      try {
        const postsResponse = await api.getFeed({ limit: 50 });
        const allPosts = postsResponse.posts || [];
        // Filter to only show posts by the current user (check both userId and authorId)
        const userPosts = allPosts.filter((p: ApiPost) => 
          p.userId === user?.id || p.authorId === user?.id
        );
        console.log("[AccountScreen] Loaded posts from backend:", userPosts.length, "User ID:", user?.id);
        console.log("[AccountScreen] All posts authorIds:", allPosts.map((p: ApiPost) => p.authorId));
        setFeaturedPosts(userPosts.map(mapApiPostToFeaturedPost));
      } catch (postsError) {
        console.warn("[AccountScreen] Could not fetch posts:", postsError);
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

  // Set default active tab based on user role
  useEffect(() => {
    if (userRole === "business") {
      // Business: default to first available tab (products or services)
      if (businessHasProducts) {
        setActiveTab("products");
      } else if (businessHasServices) {
        setActiveTab("services");
      } else {
        setActiveTab("availability");
      }
    } else if (userRole === "photographer") {
      setActiveTab("featured");
    } else {
      // Consumer
      setActiveTab("featured");
    }
  }, [userRole, businessHasProducts, businessHasServices]);

  // Handle follow/unfollow toggle
  const handleFollowToggle = async () => {
    if (!profile?.id || followLoading) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(profile.id);
        setIsFollowing(false);
      } else {
        const targetType = userRole === "photographer" ? "photographer" : 
                          userRole === "business" ? "business" : "user";
        await api.followUser(profile.id, targetType);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error("Follow toggle failed:", error);
    } finally {
      setFollowLoading(false);
    }
  };

  // Check follow status when viewing another user's profile
  const checkFollowStatus = useCallback(async (targetUserId: string) => {
    if (isOwner || !targetUserId) return;
    try {
      const result = await api.checkFollowStatus(targetUserId);
      setIsFollowing(result.isFollowing);
    } catch (error) {
      console.error("Failed to check follow status:", error);
    }
  }, [isOwner]);

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
  
  const bannerVideoPlayer = useVideoPlayer(profile?.coverVideo || null, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const fullscreenVideoPlayer = useVideoPlayer(profile?.coverVideo || null, player => {
    player.loop = false;
    player.muted = false;
  });

  useEffect(() => {
    if (showVideoFullscreen && fullscreenVideoPlayer) {
      fullscreenVideoPlayer.play();
    } else if (fullscreenVideoPlayer) {
      fullscreenVideoPlayer.pause();
      fullscreenVideoPlayer.currentTime = 0;
    }
  }, [showVideoFullscreen, fullscreenVideoPlayer]);
  
  // Compute business tabs dynamically based on products/services
  // Businesses show only Products/Services tabs based on what they offer
  const getBusinessTabs = (): { key: ProfileTab; label: string; icon: string }[] => {
    const businessTabs: { key: ProfileTab; label: string; icon: string }[] = [];
    
    // Add Products tab if business has products
    if (businessHasProducts) {
      businessTabs.push({ key: "products", label: "Products", icon: "shopping-bag" });
    }
    // Add Services tab if business has services
    if (businessHasServices) {
      businessTabs.push({ key: "services", label: "Services", icon: "briefcase" });
    }
    // Add Availability tab for booking
    businessTabs.push({ key: "availability", label: "Availability", icon: "clock" });
    
    return businessTabs;
  };

  const tabs = userRole === "photographer" 
    ? PHOTOGRAPHER_TABS 
    : userRole === "business" 
      ? getBusinessTabs()
      : CONSUMER_TABS;

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

  const handleCreatePost = async () => {
    if (!newPostImage) {
      Alert.alert("No Image", "Please select an image for your post.");
      return;
    }
    
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "You must be logged in to create a post.");
      return;
    }

    setPostSaving(true);
    try {
      const response = await api.createPost(authToken, {
        imageUrl: newPostImage,
        content: newPostCaption || undefined,
      });
      
      if (response.post) {
        const newPost = mapApiPostToFeaturedPost(response.post);
        setFeaturedPosts([newPost, ...featuredPosts]);
        setNewPostImage("");
        setNewPostCaption("");
        setShowCreatePost(false);
        console.log("[AccountScreen] Post created successfully:", response.post.id);
      }
    } catch (error: any) {
      console.error("[AccountScreen] Failed to create post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setPostSaving(false);
    }
  };

  // Format business hours for display
  const formatBusinessHours = (hours: any): string => {
    if (!hours) return "";
    try {
      const hoursData = typeof hours === "string" ? JSON.parse(hours) : hours;
      const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
      const todayHours = hoursData[today];
      if (todayHours && todayHours.open && todayHours.close) {
        return `Open Today: ${todayHours.open} - ${todayHours.close}`;
      }
      return "Hours vary";
    } catch {
      return "";
    }
  };

  const renderFeaturedTab = () => {
    // Business Featured Tab - Show featured products/services and store info
    if (userRole === "business") {
      const liveProducts = businessProducts.filter(p => p.status === "live");
      const liveServices = businessServices.filter(s => s.status === "live");
      const featuredProducts = liveProducts.slice(0, 4);
      const featuredServices = liveServices.slice(0, 3);
      const hasFeaturedItems = featuredProducts.length > 0 || featuredServices.length > 0;

      return (
        <View style={styles.tabContent}>
          {/* Featured Products Section */}
          {featuredProducts.length > 0 && (
            <View style={{ marginBottom: Spacing.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
                <ThemedText type="h4">Featured Products</ThemedText>
                {liveProducts.length > 4 && (
                  <Pressable onPress={() => setActiveTab("book")}>
                    <ThemedText type="small" style={{ color: profileTheme }}>See All</ThemedText>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.lg }}>
                <View style={{ flexDirection: "row", paddingHorizontal: Spacing.lg }}>
                  {featuredProducts.map((product) => (
                    <View
                      key={product.id}
                      style={{
                        width: 140,
                        marginRight: Spacing.md,
                        backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      {product.imageUrl ? (
                        <Image
                          source={{ uri: product.imageUrl }}
                          style={{ width: "100%", height: 100 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={{
                          width: "100%",
                          height: 100,
                          backgroundColor: profileTheme + "20",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <Feather name="shopping-bag" size={28} color={profileTheme} />
                        </View>
                      )}
                      <View style={{ padding: Spacing.sm }}>
                        <ThemedText type="small" style={{ fontWeight: "600" }} numberOfLines={1}>{product.name}</ThemedText>
                        <ThemedText type="small" style={{ color: profileTheme, fontWeight: "600", marginTop: 2 }}>
                          {formatPrice(product.priceCents)}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Featured Services Section */}
          {featuredServices.length > 0 && (
            <View style={{ marginBottom: Spacing.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
                <ThemedText type="h4">Featured Services</ThemedText>
                {liveServices.length > 3 && (
                  <Pressable onPress={() => setActiveTab("availability")}>
                    <ThemedText type="small" style={{ color: profileTheme }}>See All</ThemedText>
                  </Pressable>
                )}
              </View>
              {featuredServices.map((service) => (
                <View
                  key={service.id}
                  style={{
                    backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                    borderRadius: 12,
                    padding: Spacing.md,
                    marginBottom: Spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: profileTheme + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: Spacing.md,
                  }}>
                    <Feather name="briefcase" size={20} color={profileTheme} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{service.name}</ThemedText>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                      <ThemedText type="small" style={{ color: profileTheme, fontWeight: "600" }}>
                        {formatPrice(service.priceCents)}
                      </ThemedText>
                      {service.durationMinutes && (
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                          {service.durationMinutes} min
                        </ThemedText>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty state if no featured items */}
          {!hasFeaturedItems && (
            <View style={{ marginBottom: Spacing.lg, alignItems: "center", paddingVertical: Spacing.xl }}>
              <Feather name="star" size={40} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                No featured items yet
              </ThemedText>
              {isOwner && !isGuest && (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
                  Publish products or services to feature them here
                </ThemedText>
              )}
            </View>
          )}

          {/* Business Description */}
          {profile?.bio && (
            <View style={{ marginBottom: Spacing.lg }}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>About</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22 }}>
                {profile.bio}
              </ThemedText>
            </View>
          )}

          {/* Store Hours */}
          {profile?.hoursOfOperation && (
            <View style={{ 
              backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5", 
              borderRadius: 12, 
              padding: Spacing.md, 
              marginBottom: Spacing.md,
              flexDirection: "row",
              alignItems: "center",
            }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                backgroundColor: profileTheme + "20", 
                alignItems: "center", 
                justifyContent: "center",
                marginRight: Spacing.md,
              }}>
                <Feather name="clock" size={18} color={profileTheme} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Store Hours</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {formatBusinessHours(profile.hoursOfOperation)}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Address */}
          {(profile?.address || (profile?.city && profile?.state)) && (
            <View style={{ 
              backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5", 
              borderRadius: 12, 
              padding: Spacing.md, 
              marginBottom: Spacing.md,
              flexDirection: "row",
              alignItems: "center",
            }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                backgroundColor: profileTheme + "20", 
                alignItems: "center", 
                justifyContent: "center",
                marginRight: Spacing.md,
              }}>
                <Feather name="map-pin" size={18} color={profileTheme} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Location</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {profile?.address ? profile.address : `${profile?.city}, ${profile?.state}`}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Contact Info */}
          {(profile?.contactPhone || profile?.contactEmail || profile?.websiteUrl) && (
            <View style={{ 
              backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5", 
              borderRadius: 12, 
              padding: Spacing.md, 
              marginBottom: Spacing.lg,
            }}>
              <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>Contact</ThemedText>
              {profile?.contactPhone && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
                  <Feather name="phone" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                    {profile.contactPhone}
                  </ThemedText>
                </View>
              )}
              {profile?.contactEmail && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
                  <Feather name="mail" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                    {profile.contactEmail}
                  </ThemedText>
                </View>
              )}
              {profile?.websiteUrl && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Feather name="globe" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: profileTheme, marginLeft: Spacing.sm }}>
                    {profile.websiteUrl}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Bio Section */}
          {profile?.bio && (
            <View style={{ marginBottom: Spacing.md }}>
              <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 20 }}>
                {profile.bio}
              </ThemedText>
            </View>
          )}

          {/* Create Post Button - Compact */}
          {isOwner && !isGuest && (
            <Pressable
              onPress={() => setShowCreatePost(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-end",
                backgroundColor: profileTheme,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 20,
                marginBottom: Spacing.md,
              }}
            >
              <Feather name="plus" size={16} color="#000" />
              <ThemedText type="small" style={{ color: "#000", marginLeft: 4, fontWeight: "600" }}>
                Post
              </ThemedText>
            </Pressable>
          )}

          {/* Posts Grid */}
          {featuredPosts.length > 0 ? (
            <View style={styles.mediaGrid}>
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
            </View>
          ) : null}
        </View>
      );
    }

    // Photographer/Consumer Featured Tab - Show posts
    return (
      <View style={styles.tabContent}>
        {/* Bio Section */}
        {profile?.bio && (
          <View style={{ marginBottom: Spacing.md }}>
            <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 20 }}>
              {profile.bio}
            </ThemedText>
          </View>
        )}

        {/* Posts Grid - Instagram Style with Add Button */}
        <View style={styles.mediaGrid}>
          {/* Add Post Button as first grid item for owners */}
          {isOwner && !isGuest && (
            <Pressable
              onPress={() => setShowCreatePost(true)}
              style={[styles.mediaGridItem, {
                backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: profileTheme,
                borderStyle: "dashed",
              }]}
            >
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: profileTheme,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Spacing.xs,
              }}>
                <Feather name="plus" size={24} color="#000" />
              </View>
              <ThemedText type="small" style={{ color: profileTheme, fontWeight: "600" }}>
                Post
              </ThemedText>
            </Pressable>
          )}
          {/* Featured Posts */}
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
        {/* Empty state message when no posts */}
        {featuredPosts.length === 0 && (!profile?.portfolio || profile.portfolio.length === 0) && (
          <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
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
              disabled={postSaving}
              style={{
                backgroundColor: postSaving ? theme.textSecondary : profileTheme,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: "center",
                opacity: postSaving ? 0.7 : 1,
              }}
            >
              {postSaving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <ThemedText type="button" style={{ color: "#000" }}>Share Post</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
  };

  const handleBookingComplete = async (booking: {
    serviceId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    console.log("[AccountScreen] Booking requested:", booking);
  };

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const renderBusinessServicesProducts = () => {
    const liveServices = businessServices.filter(s => s.status === "live");
    const liveProducts = businessProducts.filter(p => p.status === "live");
    const hasLiveServices = liveServices.length > 0;
    const hasLiveProducts = liveProducts.length > 0;

    if (!hasLiveServices && !hasLiveProducts) {
      return (
        <View style={styles.emptyTab}>
          <Feather name="package" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No offerings available yet
          </ThemedText>
          {isOwner && !isGuest && (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Configure your products or services in your dashboard
            </ThemedText>
          )}
        </View>
      );
    }

    return (
      <>
        {hasLiveServices && (
          <View style={{ marginBottom: Spacing.lg }}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Services</ThemedText>
            {liveServices.map((service) => (
              <View
                key={service.id}
                style={{
                  backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                  borderRadius: 12,
                  padding: Spacing.md,
                  marginBottom: Spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 10,
                  backgroundColor: profileTheme + "20",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: Spacing.md,
                }}>
                  <Feather name="briefcase" size={22} color={profileTheme} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{service.name}</ThemedText>
                  {service.description && (
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }} numberOfLines={2}>
                      {service.description}
                    </ThemedText>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <ThemedText type="body" style={{ color: profileTheme, fontWeight: "600" }}>
                      {formatPrice(service.priceCents)}
                    </ThemedText>
                    {service.durationMinutes && (
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                        {service.durationMinutes} min
                      </ThemedText>
                    )}
                  </View>
                  <StarRating rating={service.rating} reviewCount={service.reviewCount} size={11} color={profileTheme} />
                </View>
                {!isOwner && (
                  <Pressable
                    style={{
                      backgroundColor: profileTheme,
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.sm,
                      borderRadius: 8,
                    }}
                  >
                    <ThemedText type="small" style={{ color: "#000", fontWeight: "600" }}>Book</ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {hasLiveProducts && (
          <View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Products</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -Spacing.xs }}>
              {liveProducts.map((product) => (
                <View
                  key={product.id}
                  style={{
                    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2,
                    marginHorizontal: Spacing.xs,
                    marginBottom: Spacing.md,
                    backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {product.imageUrl ? (
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={{ width: "100%", height: 120 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={{
                      width: "100%",
                      height: 120,
                      backgroundColor: profileTheme + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Feather name="shopping-bag" size={32} color={profileTheme} />
                    </View>
                  )}
                  <View style={{ padding: Spacing.sm }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>{product.name}</ThemedText>
                    <ThemedText type="body" style={{ color: profileTheme, fontWeight: "600", marginTop: 4 }}>
                      {formatPrice(product.priceCents)}
                    </ThemedText>
                    <StarRating rating={product.rating} reviewCount={product.reviewCount} size={10} color={profileTheme} />
                    {!isOwner && (
                      <Pressable
                        style={{
                          backgroundColor: profileTheme,
                          paddingVertical: Spacing.xs,
                          borderRadius: 6,
                          alignItems: "center",
                          marginTop: Spacing.sm,
                        }}
                      >
                        <ThemedText type="small" style={{ color: "#000", fontWeight: "600" }}>Add to Cart</ThemedText>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </>
    );
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

  const renderBookTab = () => {
    if (userRole === "photographer") {
      return (
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
    }

    // Business Services Tab
    const stripeComplete = profile?.stripeOnboardingComplete ?? false;

    return (
      <View style={styles.tabContent}>
        {/* Stripe Status Banner for Business */}
        {isOwner && !isGuest && !stripeComplete && (
          <View style={{
            backgroundColor: "#7C3AED20",
            padding: Spacing.md,
            borderRadius: 12,
            marginBottom: Spacing.md,
            flexDirection: "row",
            alignItems: "center",
          }}>
            <Feather name="credit-card" size={20} color="#7C3AED" />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText type="body" style={{ color: "#7C3AED", fontWeight: "600" }}>
                Complete Stripe Setup
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Connect Stripe to accept payments and publish your offerings
              </ThemedText>
            </View>
          </View>
        )}

        {stripeComplete && isOwner && (
          <View style={{
            backgroundColor: "#34C75920",
            padding: Spacing.md,
            borderRadius: 12,
            marginBottom: Spacing.md,
            flexDirection: "row",
            alignItems: "center",
          }}>
            <Feather name="check-circle" size={20} color="#34C759" />
            <ThemedText type="body" style={{ color: "#34C759", marginLeft: Spacing.sm }}>
              Stripe connected - ready to accept payments
            </ThemedText>
          </View>
        )}

        {/* Services/Products content */}
        {renderBusinessServicesProducts()}
      </View>
    );
  };

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

  const renderReviewsTab = () => {
    if (userRole === "consumer") {
      return (
        <View style={styles.tabContent}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Reviews You've Written</ThemedText>
          {consumerReviews.length > 0 ? (
            consumerReviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", marginBottom: Spacing.md }]}>
                <View style={styles.reviewHeader}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{review.businessName}</ThemedText>
                  <View style={{ flexDirection: "row", marginLeft: "auto" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Feather
                        key={star}
                        name="star"
                        size={14}
                        color={star <= review.rating ? "#FFD700" : theme.textSecondary}
                      />
                    ))}
                  </View>
                </View>
                <ThemedText type="body" style={{ marginTop: Spacing.sm, fontStyle: "italic" }}>
                  "{review.comment}"
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                  {review.date}
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.emptyTab}>
              <Feather name="message-square" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No reviews yet
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                After booking services, you can leave reviews for photographers and businesses
              </ThemedText>
            </View>
          )}
        </View>
      );
    }

    return (
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
  };

  // Render Products Tab for businesses
  const renderProductsTab = () => {
    const liveProducts = businessProducts.filter(p => p.status === "live");
    
    if (liveProducts.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyTab}>
            <Feather name="shopping-bag" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No products available yet
            </ThemedText>
            {isOwner && !isGuest && (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                Add products in your dashboard to display them here
              </ThemedText>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -Spacing.xs }}>
          {liveProducts.map((product) => (
            <View
              key={product.id}
              style={{
                width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2,
                marginHorizontal: Spacing.xs,
                marginBottom: Spacing.md,
                backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {product.imageUrl ? (
                <Image
                  source={{ uri: product.imageUrl }}
                  style={{ width: "100%", height: 120 }}
                  contentFit="cover"
                />
              ) : (
                <View style={{
                  width: "100%",
                  height: 120,
                  backgroundColor: profileTheme + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Feather name="shopping-bag" size={32} color={profileTheme} />
                </View>
              )}
              <View style={{ padding: Spacing.sm }}>
                <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>{product.name}</ThemedText>
                <ThemedText type="body" style={{ color: profileTheme, fontWeight: "600", marginTop: 4 }}>
                  {formatPrice(product.priceCents)}
                </ThemedText>
                <StarRating rating={product.rating} reviewCount={product.reviewCount} size={10} color={profileTheme} />
                {!isOwner && (
                  <Pressable
                    style={{
                      backgroundColor: profileTheme,
                      paddingVertical: Spacing.xs,
                      borderRadius: 6,
                      alignItems: "center",
                      marginTop: Spacing.sm,
                    }}
                  >
                    <ThemedText type="small" style={{ color: "#000", fontWeight: "600" }}>Add to Cart</ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render Services Tab for businesses
  const renderServicesTab = () => {
    const liveServices = businessServices.filter(s => s.status === "live");
    
    if (liveServices.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyTab}>
            <Feather name="briefcase" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No services available yet
            </ThemedText>
            {isOwner && !isGuest && (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                Add services in your dashboard to display them here
              </ThemedText>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {liveServices.map((service) => (
          <View
            key={service.id}
            style={{
              backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
              borderRadius: 12,
              padding: Spacing.md,
              marginBottom: Spacing.sm,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 10,
              backgroundColor: profileTheme + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: Spacing.md,
            }}>
              <Feather name="briefcase" size={22} color={profileTheme} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{service.name}</ThemedText>
              {service.description && (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }} numberOfLines={2}>
                  {service.description}
                </ThemedText>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <ThemedText type="body" style={{ color: profileTheme, fontWeight: "600" }}>
                  {formatPrice(service.priceCents)}
                </ThemedText>
                {service.durationMinutes && (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                    {service.durationMinutes} min
                  </ThemedText>
                )}
              </View>
              <StarRating rating={service.rating} reviewCount={service.reviewCount} size={11} color={profileTheme} />
            </View>
            {!isOwner && (
              <Pressable
                style={{
                  backgroundColor: profileTheme,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: 8,
                }}
              >
                <ThemedText type="small" style={{ color: "#000", fontWeight: "600" }}>Book</ThemedText>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    );
  };

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
      case "products":
        return renderProductsTab();
      case "services":
        return renderServicesTab();
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
          {profile?.coverVideo ? (
            <Pressable 
              style={StyleSheet.absoluteFill}
              onPress={() => setShowVideoFullscreen(true)}
            >
              <VideoView
                player={bannerVideoPlayer}
                style={styles.coverImage}
                contentFit="cover"
                nativeControls={false}
              />
            </Pressable>
          ) : (
            <Image
              source={{ uri: profile?.coverImage || profile?.avatar || FALLBACK_COVER }}
              style={styles.coverImage}
              contentFit="cover"
              transition={300}
            />
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.heroGradient}
            pointerEvents="none"
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
                <Pressable 
                  style={[
                    styles.followButton, 
                    { 
                      backgroundColor: isFollowing ? "transparent" : profileTheme,
                      borderWidth: isFollowing ? 2 : 0,
                      borderColor: profileTheme,
                    }
                  ]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  <ThemedText type="button" style={{ color: isFollowing ? "#FFFFFF" : "#000000" }}>
                    {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                  </ThemedText>
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

            {/* Profile Rating */}
            {(profile?.rating && profile.rating > 0) && (
              <View style={{ marginTop: Spacing.xs }}>
                <StarRating 
                  rating={profile.rating} 
                  reviewCount={profile.reviewCount} 
                  size={14} 
                  color={profileTheme}
                />
              </View>
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

        {/* Bio + Posts Section for Business (like photographer layout) */}
        {userRole === "business" && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
            {/* Bio Section */}
            {profile?.bio && (
              <View style={{ marginBottom: Spacing.md }}>
                <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 20 }}>
                  {profile.bio}
                </ThemedText>
              </View>
            )}

            {/* Posts Grid - Instagram Style with Add Button */}
            <View style={styles.mediaGrid}>
              {/* Add Post Button as first grid item for owners */}
              {isOwner && !isGuest && (
                <Pressable
                  onPress={() => setShowCreatePost(true)}
                  style={[styles.mediaGridItem, {
                    backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: profileTheme,
                    borderStyle: "dashed",
                  }]}
                >
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: profileTheme,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: Spacing.xs,
                  }}>
                    <Feather name="plus" size={24} color="#000" />
                  </View>
                  <ThemedText type="small" style={{ color: profileTheme, fontWeight: "600" }}>
                    Post
                  </ThemedText>
                </Pressable>
              )}
              {/* Business Posts */}
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
            </View>
            {/* Empty state message when no posts */}
            {featuredPosts.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
                <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  Share your best work to attract customers
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Tab Navigation - Now for all users including consumers */}
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

        {/* Tab Content - Now for all users */}
        {renderTabContent()}

        
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
              {/* First Service or Placeholder */}
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
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {photographerServices[0]?.name || "Wedding Package"}
                  </ThemedText>
                  <ThemedText type="h4" style={{ color: profileTheme }}>
                    ${photographerServices[0]?.price || "1,500"}
                  </ThemedText>
                  {photographerServices[0]?.durationMinutes && (
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {photographerServices[0].durationMinutes} min
                    </ThemedText>
                  )}
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
                  <Pressable onPress={() => setActiveTab("availability")} style={styles.quickInfoLink}>
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

            {/* Additional Services Grid */}
            {photographerServices.length > 1 && (
              <View style={{ marginTop: Spacing.md }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -Spacing.xs }}>
                  {photographerServices.slice(1, 5).map((service, index) => (
                    <View
                      key={service.id}
                      style={{
                        width: "50%",
                        paddingHorizontal: Spacing.xs,
                        marginBottom: Spacing.sm,
                      }}
                    >
                      <View style={{
                        backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}>
                        <Image
                          source={{ uri: profile?.portfolio?.[index + 1] || FALLBACK_COVER }}
                          style={{ width: "100%", height: 100 }}
                          contentFit="cover"
                        />
                        <View style={{ padding: Spacing.sm }}>
                          <ThemedText type="small" style={{ fontWeight: "600" }} numberOfLines={1}>
                            {service.name}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: profileTheme, fontWeight: "600", marginTop: 2 }}>
                            ${service.price}
                          </ThemedText>
                          {service.durationMinutes && (
                            <ThemedText type="small" style={{ color: theme.textSecondary }}>
                              {service.durationMinutes} min
                            </ThemedText>
                          )}
                          <StarRating rating={service.rating} reviewCount={service.reviewCount} size={10} color={profileTheme} showCount={false} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
                {photographerServices.length > 5 && (
                  <Pressable onPress={() => setActiveTab("book")} style={{ alignItems: "center", marginTop: Spacing.xs }}>
                    <ThemedText type="small" style={{ color: profileTheme }}>
                      View all {photographerServices.length} services
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}
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
        onEditPhotos={userRole === "consumer" ? () => setShowEditPhotoModal(true) : undefined}
        showLocationVisible={showStateVisibility}
        onToggleLocationVisibility={() => setShowStateVisibility(!showStateVisibility)}
      />

      {/* Fullscreen Video Modal */}
      <Modal visible={showVideoFullscreen} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <Pressable
            onPress={() => setShowVideoFullscreen(false)}
            style={{ position: "absolute", top: insets.top + 16, right: 16, zIndex: 10, padding: 8 }}
          >
            <Feather name="x" size={28} color="#FFFFFF" />
          </Pressable>
          {profile?.coverVideo && (
            <VideoView
              player={fullscreenVideoPlayer}
              style={{ flex: 1 }}
              contentFit="contain"
              nativeControls={true}
            />
          )}
        </View>
      </Modal>

      {/* Photo Edit Modal for Consumers */}
      <Modal visible={showEditPhotoModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg }}>
              <ThemedText type="h3">Edit Photos</ThemedText>
              <Pressable onPress={() => setShowEditPhotoModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <Pressable
              onPress={async () => {
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
                  setProfile(prev => prev ? { ...prev, avatar: result.assets[0].uri } : prev);
                  Alert.alert("Success", "Profile photo updated!");
                }
              }}
              style={[styles.settingsRow, { backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5" }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="user" size={20} color={theme.text} />
                <ThemedText type="body" style={{ marginLeft: Spacing.md }}>Change Profile Photo</ThemedText>
              </View>
              <Feather name="camera" size={20} color={profileTheme} />
            </Pressable>

            <Pressable
              onPress={async () => {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== "granted") {
                  Alert.alert("Permission Required", "Please allow access to your photo library.");
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [16, 9],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  setProfile(prev => prev ? { ...prev, coverImage: result.assets[0].uri } : prev);
                  Alert.alert("Success", "Banner photo updated!");
                }
              }}
              style={[styles.settingsRow, { backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5" }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="image" size={20} color={theme.text} />
                <ThemedText type="body" style={{ marginLeft: Spacing.md }}>Change Banner Photo</ThemedText>
              </View>
              <Feather name="camera" size={20} color={profileTheme} />
            </Pressable>

            <Pressable
              onPress={() => setShowEditPhotoModal(false)}
              style={{
                backgroundColor: profileTheme,
                paddingVertical: Spacing.md,
                borderRadius: BorderRadius.lg,
                alignItems: "center",
                marginTop: Spacing.lg,
              }}
            >
              <ThemedText type="button" style={{ color: "#000" }}>Done</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  videoPlayIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
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
  consumerSettings: {
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
});

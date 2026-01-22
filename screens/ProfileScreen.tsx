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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { PersonalSettingsMenu } from "@/components/PersonalSettingsMenu";
import { BookingFlow, PhotographerService, PhotographerProfile } from "@/components/BookingFlow";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { VendorBookerAvailabilitySlot, BlockedDate, VendorProduct, VendorService, ApiPost } from "@/services/api";
import { uploadImageToCloudinary } from "@/services/cloudinary";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Profile">;

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
  userId: string;
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

const CONSUMER_TABS: { key: ProfileTab; label: string; icon: string }[] = [
  { key: "featured", label: "Featured", icon: "star" },
  { key: "reviews", label: "Reviews", icon: "message-square" },
];

const StarRating = ({ rating, reviewCount, size = 12, showCount = true, color = "#FFD700" }: {
  rating?: number | null;
  reviewCount?: number | null;
  size?: number;
  showCount?: boolean;
  color?: string;
}) => {
  const { theme } = useTheme();
  if (rating === undefined || rating === null || rating === 0) return null;
  
  const fullStars = Math.floor(rating / 10);
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

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { user, isAuthenticated, getToken } = useAuth();
  const { unreadCount } = useNotifications();

  const { userId, profileId, userType, displayName: initialDisplayName, avatar: initialAvatar } = route.params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("featured");
  const [availabilitySlots, setAvailabilitySlots] = useState<VendorBookerAvailabilitySlot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [photographerServices, setPhotographerServices] = useState<PhotographerService[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{ date: string; startTime: string; endTime: string }[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
  const [businessHasProducts, setBusinessHasProducts] = useState(false);
  const [businessHasServices, setBusinessHasServices] = useState(false);
  const [businessProducts, setBusinessProducts] = useState<VendorProduct[]>([]);
  const [businessServices, setBusinessServices] = useState<VendorService[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isSelfProfile, setIsSelfProfile] = useState(false); // Backend-detected self-profile
  const [showVideoFullscreen, setShowVideoFullscreen] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostImage, setNewPostImage] = useState<string>("");
  const [newPostCaption, setNewPostCaption] = useState("");
  const [linkedServiceId, setLinkedServiceId] = useState<string>("");
  const [postSaving, setPostSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchId = profileId || userId;
  const profileUserType = userType || "consumer";
  const isGuest = user?.isGuest || false;

  // Multi-layer ownership detection:
  // 1. Compare user.id with userId from route
  // 2. For photographers: compare user.photographerId with profileId (photographer record ID)
  // 3. For businesses: compare user.businessId with profileId (business record ID)
  // 4. Fallback to backend-detected self-profile
  const isOwnerByUserId = user?.id === userId;
  const isOwnerByPhotographerId = profileUserType === "photographer" && !!user?.photographerId && user.photographerId === fetchId;
  const isOwnerByBusinessId = profileUserType === "business" && !!user?.businessId && user.businessId === fetchId;
  const isOwnerComputed = isOwnerByUserId || isOwnerByPhotographerId || isOwnerByBusinessId;
  const isOwner = isOwnerComputed || isSelfProfile;

  // Debug ownership detection
  console.log("[ProfileScreen] Ownership check:", {
    "user.id": user?.id,
    "user.photographerId": user?.photographerId,
    "user.businessId": user?.businessId,
    userId,
    fetchId,
    profileUserType,
    isOwnerByUserId,
    isOwnerByPhotographerId,
    isOwnerByBusinessId,
    isOwnerComputed,
    isSelfProfile,
    isOwner,
  });

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();

      if (profileUserType === "photographer") {
        if (isOwner && token) {
          const photographer = (await api.getPhotographerMe(token)) as any;
          const coverUrl = photographer.coverImage || "";
          const isVideo = coverUrl.match(/\.(mp4|mov|webm|m4v)$/i) || coverUrl.includes("video");
          setProfile({
            id: photographer.id,
            userId: userId,
            name: photographer.displayName || initialDisplayName || "Photographer",
            avatar: photographer.logoImage || initialAvatar,
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

          try {
            const [availRes, blockedRes] = await Promise.all([
              api.getPhotographerMeAvailability(token),
              api.getPhotographerBlockedDates(token),
            ]);
            if (availRes.hoursOfOperation) {
              const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
              const slots: VendorBookerAvailabilitySlot[] = [];
              dayNames.forEach((dayName, index) => {
                const dayData = availRes.hoursOfOperation[dayName];
                if (dayData && !dayData.closed) {
                  slots.push({
                    id: `hours-${index}`,
                    photographerId: photographer.id,
                    dayOfWeek: index,
                    startTime: dayData.open,
                    endTime: dayData.close,
                    isRecurring: true,
                  });
                }
              });
              setAvailabilitySlots(slots);
            }
            setBlockedDates(blockedRes.blockedDates || []);
          } catch (e) {
            console.warn("[ProfileScreen] Could not fetch availability:", e);
          }

          try {
            const publicServicesResponse = await api.getPhotographerPublicServices(photographer.id);
            let servicesList: any[] = [];
            if (Array.isArray(publicServicesResponse)) {
              servicesList = publicServicesResponse;
            } else if (publicServicesResponse && typeof publicServicesResponse === "object") {
              servicesList = (publicServicesResponse as any).services || [];
            }
            const activeServices = servicesList.filter((svc: any) => 
              svc.status === "live" || svc.status === "active"
            );
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
          } catch (e) {
            console.warn("[ProfileScreen] Could not fetch services:", e);
          }
        } else {
          const photographerPublic = await api.getPhotographer(fetchId) as any;
          const coverUrl = photographerPublic.coverImage || "";
          const isVideo = coverUrl.match(/\.(mp4|mov|webm|m4v)$/i) || coverUrl.includes("video");
          setProfile({
            id: photographerPublic.id,
            userId: photographerPublic.userId || userId,
            name: photographerPublic.displayName || photographerPublic.name || initialDisplayName || "Photographer",
            avatar: photographerPublic.logoImage || photographerPublic.avatar || initialAvatar,
            coverImage: isVideo ? undefined : photographerPublic.coverImage,
            coverVideo: isVideo ? photographerPublic.coverImage : undefined,
            city: photographerPublic.city,
            state: photographerPublic.state,
            bio: photographerPublic.bio,
            rating: photographerPublic.rating,
            reviewCount: photographerPublic.reviewCount,
            specialties: photographerPublic.specialties,
            portfolio: photographerPublic.portfolio,
            brandColors: photographerPublic.brandColors,
            hourlyRate: photographerPublic.hourlyRate,
            stripeOnboardingComplete: photographerPublic.stripeOnboardingComplete,
            availability: photographerPublic.todayAvailability || null,
          });

          try {
            const publicServicesResponse = await api.getPhotographerPublicServices(fetchId);
            let servicesList: any[] = [];
            if (Array.isArray(publicServicesResponse)) {
              servicesList = publicServicesResponse;
            } else if (publicServicesResponse && typeof publicServicesResponse === "object") {
              servicesList = (publicServicesResponse as any).services || [];
            }
            const activeServices = servicesList.filter((svc: any) => 
              svc.status === "live" || svc.status === "active"
            );
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
          } catch (e) {
            console.warn("[ProfileScreen] Could not fetch public services:", e);
          }
        }
      } else if (profileUserType === "business") {
        if (isOwner && token) {
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
            userId: userId,
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
          
          const hasLiveProducts = allProducts.some((p: any) => p.status === "live");
          const hasLiveServices = allServices.some((s: any) => s.status === "live");
          setBusinessHasProducts(hasLiveProducts);
          setBusinessHasServices(hasLiveServices);
        } else {
          const vendorPublic = await api.getBusiness(fetchId) as any;
          const coverUrl = vendorPublic.coverImage || "";
          const isVideo = coverUrl.match(/\.(mp4|mov|webm|m4v)$/i) || coverUrl.includes("video");
          setProfile({
            id: vendorPublic.id,
            userId: vendorPublic.userId || userId,
            name: vendorPublic.name || initialDisplayName || "Business",
            avatar: vendorPublic.logoImage || vendorPublic.avatar || initialAvatar,
            coverImage: isVideo ? undefined : vendorPublic.coverImage,
            coverVideo: isVideo ? vendorPublic.coverImage : undefined,
            city: vendorPublic.city,
            state: vendorPublic.state,
            bio: vendorPublic.description,
            rating: vendorPublic.rating,
            reviewCount: vendorPublic.reviewCount,
            specialties: vendorPublic.category ? [vendorPublic.category] : [],
            stripeOnboardingComplete: vendorPublic.stripeOnboardingComplete,
            address: vendorPublic.address,
            hoursOfOperation: vendorPublic.hoursOfOperation,
          });

          try {
            const [productsRes, servicesRes] = await Promise.all([
              api.getBusinessPublicProducts(fetchId).catch(() => ({ products: [] })),
              api.getBusinessPublicServices(fetchId).catch(() => ({ services: [] })),
            ]);
            const allProducts = productsRes.products || [];
            const allServices = servicesRes.services || [];
            setBusinessProducts(allProducts.filter((p: any) => p.status === "live"));
            setBusinessServices(allServices.filter((s: any) => s.status === "live"));
            setBusinessHasProducts(allProducts.some((p: any) => p.status === "live"));
            setBusinessHasServices(allServices.some((s: any) => s.status === "live"));
          } catch (e) {
            console.warn("[ProfileScreen] Could not fetch public products/services:", e);
          }
        }
      } else {
        setProfile({
          id: userId,
          userId: userId,
          name: initialDisplayName || "User",
          avatar: initialAvatar,
        });
      }

      try {
        const postsResponse = await api.getFeed({ limit: 50 });
        const allPosts = postsResponse.posts || [];
        const userPosts = allPosts.filter((p: ApiPost) => 
          p.userId === userId || p.authorId === userId
        );
        setFeaturedPosts(userPosts.map(mapApiPostToFeaturedPost));
      } catch (e) {
        console.warn("[ProfileScreen] Could not fetch posts:", e);
      }

      if (!isOwnerComputed && userId) {
        try {
          const result = await api.checkFollowStatus(userId);
          // Check if backend response indicates self-profile
          if ((result as any).isSelf) {
            setIsSelfProfile(true);
          } else {
            setIsFollowing(result.isFollowing);
          }
        } catch (e: any) {
          console.warn("[ProfileScreen] Could not check follow status:", e);
          // Check if error indicates self-follow scenario
          const errorStr = typeof e === "object" ? JSON.stringify(e) : String(e);
          if (errorStr.includes("Cannot follow yourself") || errorStr.includes("self")) {
            setIsSelfProfile(true);
          }
        }
      }
    } catch (error) {
      console.error("[ProfileScreen] Failed to fetch profile:", error);
      setProfile({
        id: userId,
        userId: userId,
        name: initialDisplayName || "User",
        avatar: initialAvatar,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, fetchId, profileUserType, isOwnerComputed, getToken, initialDisplayName, initialAvatar]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profileUserType === "business") {
      if (businessHasProducts) {
        setActiveTab("products");
      } else if (businessHasServices) {
        setActiveTab("services");
      } else {
        setActiveTab("availability");
      }
    } else {
      setActiveTab("featured");
    }
  }, [profileUserType, businessHasProducts, businessHasServices]);

  const handleFollowToggle = async () => {
    if (!profile?.userId || followLoading) return;
    
    // Double-check: prevent following yourself even if isOwner check failed
    if (user?.id === profile.userId || user?.id === userId) {
      console.warn("[ProfileScreen] Prevented self-follow attempt");
      return;
    }
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(profile.userId);
        setIsFollowing(false);
      } else {
        const targetType = profileUserType === "photographer" ? "photographer" : 
                          profileUserType === "business" ? "business" : "user";
        await api.followUser(profile.userId, targetType);
        setIsFollowing(true);
      }
    } catch (error: any) {
      console.error("Follow toggle failed:", error);
      // If backend says "Cannot follow yourself", the user is viewing their own profile
      const errorStr = typeof error === "object" ? JSON.stringify(error) : String(error);
      if (error?.message?.includes("Cannot follow yourself") || errorStr.includes("Cannot follow yourself")) {
        console.warn("[ProfileScreen] Backend rejected self-follow - marking as self-profile");
        setIsSelfProfile(true); // Hide the follow button going forward
        return;
      }
    } finally {
      setFollowLoading(false);
    }
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

  const getBusinessTabs = (): { key: ProfileTab; label: string; icon: string }[] => {
    const businessTabs: { key: ProfileTab; label: string; icon: string }[] = [];
    if (businessHasProducts) {
      businessTabs.push({ key: "products", label: "Products", icon: "shopping-bag" });
    }
    if (businessHasServices) {
      businessTabs.push({ key: "services", label: "Services", icon: "briefcase" });
    }
    businessTabs.push({ key: "availability", label: "Availability", icon: "clock" });
    return businessTabs;
  };

  const tabs = profileUserType === "photographer" 
    ? PHOTOGRAPHER_TABS 
    : profileUserType === "business" 
      ? getBusinessTabs()
      : CONSUMER_TABS;

  const formatHourlyRate = (rate?: number): string => {
    if (!rate) return "";
    return `$${(rate / 100).toFixed(0)} / hour`;
  };

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getAvailabilityText = (): string => {
    if (profile?.availability) {
      return `Available Today: ${profile.availability.start} - ${profile.availability.end}`;
    }
    return "Available Today: 10AM - 6PM";
  };

  const handleBookNow = () => {
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    if (!profile?.stripeOnboardingComplete && profileUserType === "photographer") {
      Alert.alert("Booking Unavailable", "This photographer hasn't completed their payment setup yet.");
      return;
    }
    navigation.navigate("Booking", { photographerId: userId });
  };

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
      const cloudinaryUrl = await uploadImageToCloudinary(newPostImage, "posts");
      if (!cloudinaryUrl) {
        throw new Error("Failed to upload image. Please try again.");
      }
      
      const postData: {
        imageUrl: string;
        content?: string;
        photographerServiceId?: string;
      } = {
        imageUrl: cloudinaryUrl,
        content: newPostCaption.trim() || " ",
      };
      
      if (linkedServiceId) {
        postData.photographerServiceId = linkedServiceId;
      }
      
      const response = await api.createPost(authToken, postData);
      
      if (response.post) {
        const newPost = mapApiPostToFeaturedPost(response.post);
        setFeaturedPosts([newPost, ...featuredPosts]);
        setNewPostImage("");
        setNewPostCaption("");
        setLinkedServiceId("");
        setShowCreatePost(false);
      }
    } catch (error: any) {
      console.error("[ProfileScreen] Failed to create post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setPostSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  const photographerProfile: PhotographerProfile = {
    id: profile?.id || "",
    name: profile?.name || "Photographer",
    avatar: profile?.avatar,
    rating: profile?.rating,
    reviewCount: profile?.reviewCount,
    hourlyRate: profile?.hourlyRate,
    brandColors: profile?.brandColors,
  };

  const renderFeaturedTab = () => (
    <View style={styles.tabContent}>
      {profile?.bio && (
        <View style={{ marginBottom: Spacing.md }}>
          <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 20 }}>
            {profile.bio}
          </ThemedText>
        </View>
      )}

      <View style={styles.mediaGrid}>
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
        {profile?.portfolio?.map((img, index) => (
          <Pressable key={`portfolio-${index}`} style={styles.mediaGridItem}>
            <Image
              source={{ uri: img }}
              style={styles.mediaGridImage}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ))}
      </View>

      {featuredPosts.length === 0 && (!profile?.portfolio || profile.portfolio.length === 0) && (
        <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
          <Feather name="camera" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No posts yet
          </ThemedText>
        </View>
      )}
    </View>
  );

  const handleBookingComplete = async (booking: {
    serviceId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    console.log("[ProfileScreen] Booking requested:", booking);
  };

  const renderBookTab = () => {
    if (profileUserType === "photographer") {
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

    const liveServices = businessServices.filter((s: any) => s.status === "live");
    const liveProducts = businessProducts.filter((p: any) => p.status === "live");

    return (
      <View style={styles.tabContent}>
        {liveServices.length > 0 && (
          <View style={{ marginBottom: Spacing.lg }}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Services</ThemedText>
            {liveServices.map((service: any) => (
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
                  <ThemedText type="body" style={{ color: profileTheme, fontWeight: "600", marginTop: 4 }}>
                    {formatPrice(service.priceCents)}
                  </ThemedText>
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

        {liveProducts.length > 0 && (
          <View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Products</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -Spacing.xs }}>
              {liveProducts.map((product: any) => (
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

        {liveServices.length === 0 && liveProducts.length === 0 && (
          <View style={styles.emptyTab}>
            <Feather name="package" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No offerings available yet
            </ThemedText>
          </View>
        )}
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
            </View>
          ) : (
            <View style={{ marginTop: Spacing.md }}>
              {next7Days.map((date, index) => {
                const blocked = isDateBlocked(date);
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
                      {blocked ? (
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

  const renderProductsTab = () => {
    const liveProducts = businessProducts.filter((p: any) => p.status === "live");
    
    if (liveProducts.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyTab}>
            <Feather name="shopping-bag" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No products available yet
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -Spacing.xs }}>
          {liveProducts.map((product: any) => (
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

  const renderServicesTab = () => {
    const liveServices = businessServices.filter((s: any) => s.status === "live");
    
    if (liveServices.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyTab}>
            <Feather name="briefcase" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No services available yet
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {liveServices.map((service: any) => (
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
              <ThemedText type="body" style={{ color: profileTheme, fontWeight: "600", marginTop: 4 }}>
                {formatPrice(service.priceCents)}
              </ThemedText>
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
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
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

          <View style={[styles.headerButtons, { top: insets.top + Spacing.md }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
            {!isGuest && isOwner && (
              <Pressable
                onPress={() => setSettingsVisible(true)}
                style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1, marginLeft: Spacing.sm }]}
              >
                <Feather name="menu" size={22} color="#FFFFFF" />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {!isGuest && (
              <Pressable
                onPress={() => navigation.navigate("Notifications")}
                style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1, marginRight: Spacing.sm }]}
              >
                <Feather name="bell" size={22} color="#FFFFFF" />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <ThemedText style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            )}
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
              {profile?.name || "Profile"}
            </ThemedText>

            {profile?.rating != null && profile.rating > 0 ? (
              <View style={{ marginTop: Spacing.xs }}>
                <StarRating 
                  rating={profile.rating} 
                  reviewCount={profile.reviewCount} 
                  size={14} 
                  color={profileTheme}
                />
              </View>
            ) : null}

            <View style={styles.profileMeta}>
              {(profile?.city || profile?.state) && (
                <ThemedText type="body" style={styles.profileLocation}>
                  {profile.city}{profile.state ? `, ${profile.state}` : ""}
                </ThemedText>
              )}
              {profile?.hourlyRate != null && profile.hourlyRate > 0 ? (
                <ThemedText type="h4" style={styles.profileRate}>
                  {formatHourlyRate(profile.hourlyRate)}
                </ThemedText>
              ) : null}
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

        {profileUserType !== "consumer" && (
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

        <View 
          style={[styles.tabBar, { backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }]}
        >
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

        {renderTabContent()}

        {isOwner && !isGuest && profileUserType !== "consumer" && (
          <View style={styles.ownerActions}>
            <Pressable
              style={[styles.editProfileButtonLarge, { backgroundColor: profileTheme }]}
              onPress={() => {
                if (profileUserType === "photographer") {
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

        {!isOwner && profileUserType === "photographer" && (
          <View style={styles.ownerActions}>
            <Pressable
              style={[styles.editProfileButtonLarge, { backgroundColor: profileTheme }]}
              onPress={handleBookNow}
            >
              <Feather name="calendar" size={18} color="#000000" />
              <ThemedText type="button" style={{ color: "#000000", marginLeft: Spacing.sm }}>
                Book Now
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <PersonalSettingsMenu
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        showLocationVisible={true}
        onToggleLocationVisibility={() => {}}
      />

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
              <Pressable onPress={() => { setShowCreatePost(false); setNewPostImage(""); setNewPostCaption(""); setLinkedServiceId(""); }}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

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

            {profileUserType === "photographer" && photographerServices.length > 0 && (
              <View style={{ marginBottom: Spacing.md }}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  Link a service (optional)
                </ThemedText>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -Spacing.lg }}
                  contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
                >
                  <Pressable
                    onPress={() => setLinkedServiceId("")}
                    style={{
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.sm,
                      borderRadius: 20,
                      backgroundColor: !linkedServiceId ? profileTheme : theme.backgroundSecondary,
                      borderWidth: 1,
                      borderColor: !linkedServiceId ? profileTheme : theme.border,
                    }}
                  >
                    <ThemedText type="small" style={{ color: !linkedServiceId ? "#000" : theme.text }}>
                      No link
                    </ThemedText>
                  </Pressable>
                  {photographerServices.map((service) => (
                    <Pressable
                      key={service.id}
                      onPress={() => setLinkedServiceId(service.id)}
                      style={{
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.sm,
                        borderRadius: 20,
                        backgroundColor: linkedServiceId === service.id ? profileTheme : theme.backgroundSecondary,
                        borderWidth: 1,
                        borderColor: linkedServiceId === service.id ? profileTheme : theme.border,
                      }}
                    >
                      <ThemedText type="small" style={{ color: linkedServiceId === service.id ? "#000" : theme.text }}>
                        {service.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

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
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
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
  availabilityCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  availabilityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
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

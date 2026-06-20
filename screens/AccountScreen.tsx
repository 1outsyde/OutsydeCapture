// ─── OUTSYDE — PROFILE SCREEN (REDESIGNED) ───────────────────
// Role-aware: Business | Photographer | Consumer
// View-aware: Own profile (AccountScreen) | External (VendorDetail)
// Brand colors: Business uses brandColors.primary override
// TODO: Wire follow/unfollow to API
// TODO: Wire review submit to POST /reviews endpoint
// TODO: Wire booking modal to existing booking flow screen
// ─────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";

import { RootStackParamList, AccountStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { PersonalSettingsMenu } from "@/components/PersonalSettingsMenu";
import apiClient, {
  ApiPost,
  VendorProduct,
  VendorService,
  VendorBookerPhotographerService,
  WeeklyAvailabilitySlot,
} from "@/services/api";
import { uploadImage, uploadVideo } from "@/services/mediaUpload";
import { feedEvents } from "@/services/feedEvents";

const COLORS = {
  black: "#0A0A0A",
  gold: "#E8B930",
  goldDim: "#C9A84C",
  cream: "#F5F0E6",
  emerald: "#1A3C34",
  gray: "#2A2A2A",
  grayMid: "#555555",
  grayLight: "#999999",
  white: "#FFFFFF",
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = 300;
const HORIZONTAL_PADDING = 20;

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type ProfileRole = "business" | "photographer" | "consumer";
type ProfileTab =
  | "posts"
  | "shop"
  | "booking"
  | "availability"
  | "saved"
  | "reviews"
  | "about";
type ResponseTimeUnit = "minutes" | "hours" | "business_days";

type ProfileData = {
  id: string;
  userId?: string;
  role: ProfileRole;
  name: string;
  handle: string;
  avatarUrl?: string;
  coverMediaUrl?: string;
  coverMediaType?: "image" | "video";
  city?: string;
  state?: string;
  location?: string;
  bio?: string;
  tagline?: string;
  rating: number;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  bookingsCount: number;
  shootsCount: number;
  postsCount: number;
  isVerified: boolean;
  subscriptionTier?: string;
  brandColors?: { primary?: string; accent?: string } | null;
  hasProducts: boolean;
  hasServices: boolean;
  specialties: string[];
  hourlyRate?: number;
  minPrice?: number;
  responseTime?: string;
  responseTimeValue?: number;
  responseTimeUnit?: ResponseTimeUnit;
  showResponseTime?: boolean;
  availabilitySummary?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  hoursOfOperation?: string;
  showEmail?: boolean;
  showPhone?: boolean;
  showWebsite?: boolean;
  showStoreHours?: boolean;
};

type PostCard = {
  id: string;
  label: string;
  likes: number;
  mediaUrl?: string;
  mediaType: "image" | "video";
  aspect: "portrait" | "square";
};

type ReviewCard = {
  id: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
};

type ServiceCard = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  durationMinutes?: number;
  rating?: number;
};

const parseBrandColors = (
  raw: unknown,
): { primary?: string; accent?: string } | null => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as { primary?: unknown; accent?: unknown };
      return {
        primary:
          typeof parsed.primary === "string" ? parsed.primary : undefined,
        accent: typeof parsed.accent === "string" ? parsed.accent : undefined,
      };
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    const casted = raw as { primary?: unknown; accent?: unknown };
    return {
      primary: typeof casted.primary === "string" ? casted.primary : undefined,
      accent: typeof casted.accent === "string" ? casted.accent : undefined,
    };
  }
  return null;
};

const getInitials = (name?: string): string => {
  if (!name) return "O";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
};

const formatMoney = (amount?: number | null): string => {
  if (amount == null || Number.isNaN(amount)) return "";
  return `$${Number(amount).toFixed(2)}`;
};

const formatCents = (cents?: number | null): string => {
  if (cents == null || Number.isNaN(cents)) return "";
  return formatMoney(cents / 100);
};

const formatResponseTime = (
  value: number = 2,
  unit: ResponseTimeUnit = "hours",
): string => {
  const unitLabel =
    unit === "business_days"
      ? value === 1
        ? "business day"
        : "business days"
      : unit === "minutes"
        ? value === 1
          ? "minute"
          : "minutes"
        : value === 1
          ? "hour"
          : "hours";

  return `Usually responds in ${value} ${unitLabel}`;
};

const resolveResponseTime = (
  raw: Record<string, any>,
  fallback = "Usually responds in 2h",
): string | undefined => {
  if (raw.showResponseTime === false) return undefined;
  if (raw.responseTimeValue != null || raw.responseTimeUnit != null) {
    return formatResponseTime(
      Number(raw.responseTimeValue ?? 2),
      (raw.responseTimeUnit || "hours") as ResponseTimeUnit,
    );
  }
  return raw.responseTime || fallback;
};

const tabLabel = (tab: ProfileTab): string => {
  switch (tab) {
    case "shop":
      return "Shop";
    case "booking":
      return "Booking";
    case "availability":
      return "Availability";
    case "saved":
      return "Saved";
    case "reviews":
      return "Reviews";
    case "about":
      return "About";
    case "posts":
    default:
      return "Posts";
  }
};

const profileHasAbout = (profile: ProfileData): boolean =>
  Boolean(
    profile.bio?.trim() ||
      profile.tagline?.trim() ||
      (profile.showStoreHours !== false && profile.hoursOfOperation?.trim()) ||
      (profile.showEmail !== false && profile.contactEmail?.trim()) ||
      (profile.showPhone !== false && profile.contactPhone?.trim()) ||
      (profile.showWebsite !== false && profile.websiteUrl?.trim()) ||
      (profile.showResponseTime !== false && profile.responseTime?.trim()),
  );

const priceCentsToDollars = (priceCents?: number | null): number | null => {
  const value = Number(priceCents);
  return Number.isFinite(value) ? value / 100 : null;
};

const getMinimumPrice = (
  products: VendorProduct[],
  services: ServiceCard[],
): number | undefined => {
  const prices = [
    ...products.map((item) => priceCentsToDollars(item.priceCents)),
    ...services.map((item) => priceCentsToDollars(item.priceCents)),
  ].filter((price): price is number => price != null);

  return prices.length > 0 ? Math.min(...prices) : undefined;
};

const toPosts = (items: ApiPost[]): PostCard[] =>
  items.map((item, index) => {
    const mediaType =
      item.mediaType === "video" || (!!item.videoUrl && !item.imageUrl)
        ? "video"
        : "image";
    return {
      id: String(item.id),
      label: item.content?.trim() || "Outsyde Post",
      likes: Number(item.likesCount ?? 0),
      mediaUrl:
        item.imageUrl ||
        item.thumbnailUrl ||
        item.videoUrl ||
        item.mediaUrl ||
        item.images?.[0],
      mediaType,
      aspect: index % 3 === 0 ? "portrait" : "square",
    };
  });

const tabsForRole = (profile: ProfileData): ProfileTab[] => {
  const showAbout = profileHasAbout(profile);

  if (profile.role === "business") {
    const tabs: ProfileTab[] = ["posts"];
    if (profile.hasProducts) tabs.push("shop");
    if (profile.hasServices) tabs.push("booking");
    tabs.push("reviews");
    if (showAbout) tabs.push("about");
    return tabs;
  }

  if (profile.role === "photographer") {
    const tabs: ProfileTab[] = ["posts", "booking", "reviews"];
    if (showAbout) tabs.push("about");
    return tabs;
  }

  return ["posts", "reviews"];
};

const scoreToStars = (rating: number): number => {
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return rating > 5 ? Math.round(rating / 10) : Math.round(rating);
};

const StarRating = ({
  rating,
  color,
  size = 13,
}: {
  rating: number;
  color: string;
  size?: number;
}) => {
  const stars = scoreToStars(rating);
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <Feather
          key={`star-${idx}`}
          name="star"
          size={size}
          color={idx < stars ? color : COLORS.grayMid}
        />
      ))}
    </View>
  );
};

const AvatarWithInitials = ({
  name,
  imageUrl,
  accentColor,
}: {
  name: string;
  imageUrl?: string;
  accentColor: string;
}) => (
  <View style={styles.avatarOuterRing}>
    <View style={[styles.avatarInnerRing, { borderColor: accentColor }]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.avatarImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: accentColor }]}>
          <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
        </View>
      )}
    </View>
    <View style={styles.onlineDot} />
  </View>
);

const CoverMediaHero = ({
  profile,
  primaryColor,
  accentColor,
}: {
  profile: ProfileData;
  primaryColor: string;
  accentColor: string;
}) => {
  const isVideo = profile.coverMediaType === "video" && !!profile.coverMediaUrl;
  const isImage = profile.coverMediaType === "image" && !!profile.coverMediaUrl;

  const videoPlayer = useVideoPlayer(
    isVideo ? profile.coverMediaUrl || "" : "",
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    },
  );

  const gradientColors: [string, string, string] =
    profile.role === "business" && profile.brandColors
      ? [primaryColor, accentColor, COLORS.black]
      : ["#1a1a1a", "#2d2410", "#0a0a0a"];

  return (
    <View style={styles.coverHero}>
      {isVideo ? (
        <VideoView
          player={videoPlayer}
          style={styles.coverMedia}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}
      {!isVideo && isImage ? (
        <Image
          source={{ uri: profile.coverMediaUrl }}
          style={styles.coverMedia}
          contentFit="cover"
        />
      ) : null}
      {!isVideo && !isImage ? (
        <LinearGradient
          colors={gradientColors}
          style={styles.coverMedia}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : null}
      <LinearGradient
        colors={["transparent", COLORS.black]}
        style={styles.coverFade}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
};

export default function AccountScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<AccountStackParamList, "Account"> | RouteProp<RootStackParamList, "UserProfile">>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, getToken } = useAuth();
  const { unreadCount } = useNotifications();
  console.log("[NOTIF-DEBUG] AccountScreen bell sees unreadCount =", unreadCount);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [savedItems, setSavedItems] = useState<PostCard[]>([]);
  const [availability, setAvailability] = useState<WeeklyAvailabilitySlot[]>(
    [],
  );
  const [reviews, setReviews] = useState<ReviewCard[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostImage, setNewPostImage] = useState<string>("");
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostLayout, setNewPostLayout] = useState<"pro" | "pulse" | null>(null);
  const [postSaving, setPostSaving] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const role = (user?.role || "consumer") as ProfileRole;

  // ── Viewer-mode params ────────────────────────────────────────────────────
  const params = route.params;
  const routeUserId = params?.userId;
  const routeUserType = params?.userType;
  const viewerMode = Boolean(routeUserId && routeUserId !== String(user?.id));
  const isOwner = !viewerMode;

  useEffect(() => {
    console.log('[AccountScreen] mode', {
      viewerMode,
      isOwner,
      routeUserId,
      routeUserType,
      selfId: user?.id,
    });
  }, [viewerMode, isOwner, routeUserId, routeUserType, user?.id]);

  useEffect(() => {
    if (!profile || isOwner || !isAuthenticated) return;
    const targetId = profile.userId || profile.id;
    apiClient
      .checkFollowStatus(targetId)
      .then((result) => setIsFollowing(result.isFollowing))
      .catch(() => setIsFollowing(false));
  }, [profile, isOwner, isAuthenticated]);

  const handleFollowToggle = useCallback(async () => {
    if (!profile || followBusy) return;
    const targetId = profile.userId || profile.id;
    const targetType =
      profile.role === "business"
        ? "business"
        : profile.role === "photographer"
          ? "photographer"
          : "user";

    const wasFollowing = isFollowing;
    const previousFollowerCount = profile.followerCount;
    const nextFollowerCount = wasFollowing
      ? Math.max(0, previousFollowerCount - 1)
      : previousFollowerCount + 1;

    setFollowBusy(true);
    setIsFollowing(!wasFollowing);
    setProfile((prev) =>
      prev ? { ...prev, followerCount: nextFollowerCount } : prev,
    );
    try {
      if (wasFollowing) {
        await apiClient.unfollowUser(targetId);
      } else {
        await apiClient.followUser(targetId, targetType);
      }
    } catch (error) {
      console.error("Follow toggle failed:", error);
      setIsFollowing(wasFollowing);
      setProfile((prev) =>
        prev ? { ...prev, followerCount: previousFollowerCount } : prev,
      );
      Alert.alert("Unable to update follow", "Please try again.");
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, isFollowing, profile]);

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let profileData: ProfileData | null = null;
      let resolvedProducts: VendorProduct[] = [];
      let resolvedServices: ServiceCard[] = [];
      let resolvedPosts: PostCard[] = [];
      let resolvedSaved: PostCard[] = [];
      let resolvedAvailability: WeeklyAvailabilitySlot[] = [];
      let resolvedReviews: ReviewCard[] = [];

      // ── VIEWER MODE: fetch another user's public data ─────────────────────
      if (viewerMode && routeUserId) {
        // Resolve the target's role
        let resolvedType: ProfileRole = routeUserType || "consumer";
        if (!routeUserType) {
          const publicUserResult = await apiClient.getPublicUser(routeUserId);
          const u = publicUserResult.user;
          resolvedType = u.isPhotographer
            ? "photographer"
            : u.isVendor
              ? "business"
              : "consumer";
        }

        if (resolvedType === "business") {
          // Pass the user id to getBusiness — the public endpoint may accept
          // either the business record id or the owner/user id. Log which was used.
          console.log(
            "[AccountScreen] viewer-mode business: calling getBusiness with user id:",
            routeUserId,
          );
          const [business, productsResponse, servicesResponse, postResponse] =
            await Promise.all([
              apiClient.getBusiness(routeUserId),
              apiClient
                .getBusinessPublicProducts(routeUserId)
                .catch(() => ({ products: [] })),
              apiClient
                .getBusinessPublicServices(routeUserId)
                .catch(() => ({ services: [] })),
              apiClient
                .getProfilePosts(routeUserId, { limit: 60 })
                .catch(() => ({ posts: [] })),
            ]);

          const liveProducts = (productsResponse.products || []).filter(
            (item) => item.status === "live",
          );
          const liveServices = (servicesResponse.services || [])
            .filter((item) => item.status === "live")
            .map((item: VendorService) => ({
              id: String(item.id),
              name: item.name,
              description: item.description || undefined,
              priceCents: Number(item.priceCents ?? 0),
              durationMinutes:
                item.durationMinutes ||
                (item as any).estimatedDurationMinutes ||
                undefined,
              rating: Number(item.rating ?? 0),
            }));

          resolvedPosts = toPosts(postResponse.posts || []);
          resolvedProducts = liveProducts;
          resolvedServices = liveServices;
          resolvedReviews = Array.isArray((business as any).reviews)
            ? (business as any).reviews.map((entry: any, idx: number) => ({
                id: String(entry.id ?? `review-${idx}`),
                userName: entry.userName || entry.authorName || "Outsyde User",
                rating: Number(entry.rating ?? 5),
                text: entry.text || entry.comment || "",
                createdAt: entry.createdAt || new Date().toISOString(),
              }))
            : [];

          const minPrice = getMinimumPrice(liveProducts, liveServices);
          const bizName = business.name || "Business";
          const logoRaw =
            (business as any).logoImage || business.avatar || "";

          profileData = {
            id: String(business.id),
            userId: routeUserId,
            role: "business",
            name: bizName,
            handle: `@${(business as any).username || bizName.replace(/\s+/g, "").toLowerCase()}`,
            avatarUrl: logoRaw !== "" ? logoRaw : undefined,
            coverMediaUrl: business.coverImage || undefined,
            coverMediaType:
              (business as any).coverMediaType === "video" ? "video" : "image",
            city: business.city || undefined,
            state: business.state || undefined,
            location:
              [business.city, business.state].filter(Boolean).join(", ") ||
              undefined,
            bio: business.description || undefined,
            tagline: (business as any).tagline || undefined,
            rating: Number(business.rating ?? 0),
            reviewCount: Number(business.reviewCount ?? 0),
            followerCount: Number(
              (business as any).followerCount ??
                (business as any).followersCount ??
                0,
            ),
            followingCount: Number((business as any).followingCount ?? 0),
            bookingsCount: Number(
              (business as any).bookingCount ??
                (business as any).totalBookings ??
                0,
            ),
            shootsCount: 0,
            postsCount: resolvedPosts.length,
            isVerified: Boolean((business as any).isVerified),
            subscriptionTier: String((business as any).subscriptionTier || ""),
            brandColors: parseBrandColors(business.brandColors),
            hasProducts: liveProducts.length > 0,
            hasServices: liveServices.length > 0,
            specialties: business.category ? [business.category] : [],
            minPrice,
            responseTime: resolveResponseTime(business as any),
            responseTimeValue: Number((business as any).responseTimeValue ?? 2),
            responseTimeUnit: ((business as any).responseTimeUnit ||
              "hours") as ResponseTimeUnit,
            showResponseTime: (business as any).showResponseTime !== false,
            availabilitySummary: (business as any).availability || undefined,
            address: business.address || undefined,
            contactEmail:
              (business as any).contactEmail || business.email || undefined,
            contactPhone:
              (business as any).contactPhone || business.phone || undefined,
            websiteUrl:
              (business as any).websiteUrl || business.website || undefined,
            hoursOfOperation:
              typeof (business as any).hoursOfOperation === "string"
                ? (business as any).hoursOfOperation
                : undefined,
            showEmail: (business as any).showEmail !== false,
            showPhone: (business as any).showPhone !== false,
            showWebsite: (business as any).showWebsite !== false,
            showStoreHours: (business as any).showStoreHours !== false,
          };
        } else if (resolvedType === "photographer") {
          console.log(
            "[AccountScreen] viewer-mode photographer: calling getPhotographer with user id:",
            routeUserId,
          );
          const [photographer, rawServices, postResponse] = await Promise.all([
            apiClient.getPhotographer(routeUserId),
            apiClient
              .getPhotographerPublicServices(routeUserId)
              .catch(() => [] as VendorBookerPhotographerService[]),
            apiClient
              .getProfilePosts(routeUserId, { limit: 60 })
              .catch(() => ({ posts: [] })),
          ]);

          const serviceList: VendorBookerPhotographerService[] =
            Array.isArray(rawServices)
              ? rawServices
              : (rawServices as any)?.services || [];

          const mappedServices = serviceList
            .filter(
              (item) => item.status === "live" || item.status === "active",
            )
            .map((item: VendorBookerPhotographerService) => ({
              id: String(item.id),
              name: item.name,
              description: item.description || undefined,
              priceCents: Number(item.priceCents ?? 0),
              durationMinutes:
                (item as any).durationMinutes ||
                item.estimatedDurationMinutes ||
                undefined,
              rating: Number((item as any).rating ?? 0),
            }));

          resolvedPosts = toPosts(postResponse.posts || []);
          resolvedServices = mappedServices;
          resolvedReviews = Array.isArray((photographer as any).reviews)
            ? (photographer as any).reviews.map((entry: any, idx: number) => ({
                id: String(entry.id ?? `review-${idx}`),
                userName: entry.userName || entry.authorName || "Outsyde User",
                rating: Number(entry.rating ?? 5),
                text: entry.text || entry.comment || "",
                createdAt: entry.createdAt || new Date().toISOString(),
              }))
            : [];

          const displayName =
            (photographer as any).displayName ||
            photographer.name ||
            "Photographer";
          const avatarRaw =
            (photographer as any).logoImage || photographer.avatar || "";

          profileData = {
            id: String(photographer.id),
            userId: routeUserId,
            role: "photographer",
            name: displayName,
            handle: `@${(photographer as any).username || displayName.replace(/\s+/g, "").toLowerCase()}`,
            avatarUrl: avatarRaw !== "" ? avatarRaw : undefined,
            coverMediaUrl: photographer.coverImage || undefined,
            coverMediaType: ((photographer as any).coverMediaType === "video"
              ? "video"
              : "image") as "image" | "video",
            city: photographer.city || undefined,
            state: photographer.state || undefined,
            location:
              [photographer.city, photographer.state]
                .filter(Boolean)
                .join(", ") || undefined,
            bio:
              (photographer as any).bio ||
              photographer.description ||
              undefined,
            tagline: (photographer as any).tagline || undefined,
            rating: Number((photographer as any).rating ?? 0),
            reviewCount: Number((photographer as any).reviewCount ?? 0),
            followerCount: Number(
              (photographer as any).followerCount ??
                (photographer as any).followersCount ??
                0,
            ),
            followingCount: Number((photographer as any).followingCount ?? 0),
            bookingsCount: 0,
            shootsCount: Number(
              (photographer as any).shootCount ??
                (photographer as any).shootsCount ??
                (photographer as any).totalShoots ??
                (photographer as any).bookingCount ??
                (photographer as any).totalBookings ??
                0,
            ),
            postsCount: resolvedPosts.length,
            isVerified: Boolean((photographer as any).isVerified),
            subscriptionTier: "",
            brandColors: null,
            hasProducts: false,
            hasServices: mappedServices.length > 0,
            specialties: photographer.specialties || [],
            hourlyRate: Number((photographer as any).hourlyRate ?? 0) || undefined,
            minPrice: getMinimumPrice([], mappedServices),
            responseTime: resolveResponseTime(
              photographer as any,
              "Usually responds in 3h",
            ),
            responseTimeValue: Number(
              (photographer as any).responseTimeValue ?? 3,
            ),
            responseTimeUnit: ((photographer as any).responseTimeUnit ||
              "hours") as ResponseTimeUnit,
            showResponseTime: (photographer as any).showResponseTime !== false,
            availabilitySummary: undefined,
            contactEmail: undefined,
            contactPhone: undefined,
            websiteUrl: undefined,
            showEmail: true,
            showPhone: true,
            showWebsite: true,
            showStoreHours: true,
          };
        } else {
          // consumer viewer
          const [publicUserResult, postResponse] = await Promise.all([
            apiClient.getPublicUser(routeUserId),
            apiClient
              .getProfilePosts(routeUserId, { limit: 60 })
              .catch(() => ({ posts: [] })),
          ]);

          const publicUser = publicUserResult.user;
          resolvedPosts = toPosts(postResponse.posts || []);
          // No consumer-review endpoint yet
          resolvedReviews = [];

          const displayName =
            publicUser.name || publicUser.username || "Outsyde User";
          const avatarRaw =
            publicUser.avatarUrl || publicUser.profileImageUrl || "";

          profileData = {
            id: routeUserId,
            userId: routeUserId,
            role: "consumer",
            name: displayName,
            handle: `@${publicUser.username || "outsyde"}`,
            avatarUrl: avatarRaw !== "" ? avatarRaw : undefined,
            coverMediaUrl: publicUser.coverMediaUrl || undefined,
            coverMediaType:
              publicUser.coverMediaType === "video" ? "video" : "image",
            city: publicUser.city || undefined,
            state: publicUser.state || undefined,
            location:
              [publicUser.city, publicUser.state].filter(Boolean).join(", ") ||
              undefined,
            bio: publicUser.bio || undefined,
            rating: 0,
            reviewCount: 0,
            followerCount: Number(
              publicUser.followerCount ?? publicUser.followersCount ?? 0,
            ),
            followingCount: Number(publicUser.followingCount ?? 0),
            bookingsCount: 0,
            shootsCount: 0,
            postsCount: resolvedPosts.length,
            isVerified: Boolean(publicUser.isVerified),
            subscriptionTier: "",
            brandColors: null,
            hasProducts: false,
            hasServices: false,
            specialties: Array.isArray(publicUser.niches)
              ? publicUser.niches
              : [],
            responseTime: undefined,
            showResponseTime: false,
            showEmail: false,
            showPhone: false,
            showWebsite: false,
            showStoreHours: false,
          };
        }
      } else {
        // ── OWNER MODE: existing logic unchanged ────────────────────────────
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        if (role === "business") {
          const [
            businessResponse,
            productsResponse,
            servicesResponse,
            weeklyResponse,
            postResponse,
          ] = await Promise.all([
            apiClient.getVendorMyBusiness(token),
            apiClient.getVendorProducts(token).catch(() => ({ products: [] })),
            apiClient.getVendorServices(token).catch(() => ({ services: [] })),
            apiClient.getWeeklyAvailability(token, "business").catch(() => []),
            apiClient
              .getProfilePosts(String(user?.id || ""), { limit: 60 })
              .catch(() => ({ posts: [] })),
          ]);

          const business = businessResponse.business;
          const liveProducts = (productsResponse.products || []).filter(
            (item) => item.status === "live",
          );
          const liveServices = (servicesResponse.services || [])
            .filter((item) => item.status === "live")
            .map((item: VendorService) => ({
              id: String(item.id),
              name: item.name,
              description: item.description || undefined,
              priceCents: Number(item.priceCents ?? 0),
              durationMinutes:
                item.durationMinutes ||
                (item as any).estimatedDurationMinutes ||
                undefined,
              rating: Number(item.rating ?? 0),
            }));

          resolvedPosts = toPosts(postResponse.posts || []);
          resolvedSaved = [];
          resolvedAvailability = weeklyResponse;
          resolvedProducts = liveProducts;
          resolvedServices = liveServices;
          resolvedReviews = Array.isArray((business as any).reviews)
            ? (business as any).reviews.map((entry: any, idx: number) => ({
                id: String(entry.id ?? `review-${idx}`),
                userName: entry.userName || entry.authorName || "Outsyde User",
                rating: Number(entry.rating ?? 5),
                text: entry.text || entry.comment || "",
                createdAt: entry.createdAt || new Date().toISOString(),
              }))
            : [];

          const minPrice = getMinimumPrice(liveProducts, liveServices);

          profileData = {
            id: String(business.id),
            userId: String(business.ownerId || user?.id || ""),
            role: "business",
            name: business.name || "Business",
            handle: `@${user?.username || business.name.replace(/\s+/g, "").toLowerCase()}`,
            avatarUrl: business.logoImage || undefined,
            coverMediaUrl: business.coverImage || undefined,
            coverMediaType:
              business.coverMediaType === "video" ? "video" : "image",
            city: business.city || undefined,
            state: business.state || undefined,
            location:
              [business.city, business.state].filter(Boolean).join(", ") ||
              undefined,
            bio: business.description || undefined,
            tagline: business.tagline || undefined,
            rating: Number(business.rating ?? 0),
            reviewCount: Number(business.reviewCount ?? 0),
            followerCount: Number(
              (business as any).followerCount ??
                (business as any).followersCount ??
                0,
            ),
            followingCount: Number((business as any).followingCount ?? 0),
            bookingsCount: Number(
              (business as any).bookingCount ??
                (business as any).totalBookings ??
                0,
            ),
            shootsCount: 0,
            postsCount: resolvedPosts.length,
            isVerified: Boolean((business as any).isVerified),
            subscriptionTier: String(
              (business as any).subscriptionTier || "Starter",
            ),
            brandColors: parseBrandColors(business.brandColors),
            hasProducts: liveProducts.length > 0,
            hasServices: liveServices.length > 0,
            specialties: business.category ? [business.category] : [],
            minPrice,
            responseTime: resolveResponseTime(business as any),
            responseTimeValue: Number((business as any).responseTimeValue ?? 2),
            responseTimeUnit: ((business as any).responseTimeUnit ||
              "hours") as ResponseTimeUnit,
            showResponseTime: (business as any).showResponseTime !== false,
            availabilitySummary: (business as any).availability || undefined,
            address: business.address || undefined,
            contactEmail: business.contactEmail || undefined,
            contactPhone: business.contactPhone || undefined,
            websiteUrl: business.websiteUrl || undefined,
            hoursOfOperation:
              typeof business.hoursOfOperation === "string"
                ? business.hoursOfOperation
                : undefined,
            showEmail: (business as any).showEmail !== false,
            showPhone: (business as any).showPhone !== false,
            showWebsite: (business as any).showWebsite !== false,
            showStoreHours: (business as any).showStoreHours !== false,
          };
        } else if (role === "photographer") {
          const [
            photographer,
            photographerServices,
            weeklyResponse,
            postResponse,
          ] = await Promise.all([
            apiClient.getPhotographerMe(token),
            apiClient
              .getPhotographerMeServices(token)
              .catch(() => ({ services: [] })),
            apiClient
              .getWeeklyAvailability(token, "photographer")
              .catch(() => []),
            apiClient
              .getProfilePosts(String(user?.id || ""), { limit: 60 })
              .catch(() => ({ posts: [] })),
          ]);

          const mappedServices = (photographerServices.services || [])
            .filter((item) => item.status === "live" || item.status === "active")
            .map((item: VendorBookerPhotographerService) => ({
              id: String(item.id),
              name: item.name,
              description: item.description || undefined,
              priceCents: Number(item.priceCents ?? 0),
              durationMinutes: (item as any).durationMinutes || undefined,
              rating: Number((item as any).rating ?? 0),
            }));

          resolvedPosts = toPosts(postResponse.posts || []);
          resolvedSaved = [];
          resolvedServices = mappedServices;
          resolvedAvailability = weeklyResponse;
          resolvedReviews = Array.isArray((photographer as any).reviews)
            ? (photographer as any).reviews.map((entry: any, idx: number) => ({
                id: String(entry.id ?? `review-${idx}`),
                userName: entry.userName || entry.authorName || "Outsyde User",
                rating: Number(entry.rating ?? 5),
                text: entry.text || entry.comment || "",
                createdAt: entry.createdAt || new Date().toISOString(),
              }))
            : [];

          profileData = {
            id: String(photographer.id),
            userId: String(photographer.userId || user?.id || ""),
            role: "photographer",
            name:
              photographer.displayName ||
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              "Photographer",
            handle: `@${user?.username || "photographer"}`,
            avatarUrl: photographer.logoImage || undefined,
            coverMediaUrl: photographer.coverImage || undefined,
            coverMediaType: ((photographer as any).coverMediaType === "video"
              ? "video"
              : "image") as "image" | "video",
            city: photographer.city || undefined,
            state: photographer.state || undefined,
            location:
              [photographer.city, photographer.state]
                .filter(Boolean)
                .join(", ") || undefined,
            bio: photographer.bio || undefined,
            tagline: (photographer as any).tagline || undefined,
            rating: Number((photographer as any).rating ?? 0),
            reviewCount: Number((photographer as any).reviewCount ?? 0),
            followerCount: Number(
              (photographer as any).followerCount ??
                (photographer as any).followersCount ??
                0,
            ),
            followingCount: Number((photographer as any).followingCount ?? 0),
            bookingsCount: 0,
            shootsCount: Number(
              (photographer as any).shootCount ??
                (photographer as any).shootsCount ??
                (photographer as any).totalShoots ??
                (photographer as any).bookingCount ??
                (photographer as any).totalBookings ??
                0,
            ),
            postsCount: resolvedPosts.length,
            isVerified: Boolean((photographer as any).isVerified),
            subscriptionTier: "",
            brandColors: null,
            hasProducts: false,
            hasServices: mappedServices.length > 0,
            specialties: photographer.specialties || [],
            hourlyRate: Number(photographer.hourlyRate ?? 0) || undefined,
            minPrice: getMinimumPrice([], mappedServices),
            responseTime: resolveResponseTime(
              photographer as any,
              "Usually responds in 3h",
            ),
            responseTimeValue: Number(
              (photographer as any).responseTimeValue ?? 3,
            ),
            responseTimeUnit: ((photographer as any).responseTimeUnit ||
              "hours") as ResponseTimeUnit,
            showResponseTime: (photographer as any).showResponseTime !== false,
            availabilitySummary: undefined,
            contactEmail: undefined,
            contactPhone: undefined,
            websiteUrl: undefined,
            showEmail: true,
            showPhone: true,
            showWebsite: true,
            showStoreHours: true,
          };
        } else {
          const [profilePosts, publicUserResult] = await Promise.all([
            apiClient
              .getProfilePosts(String(user?.id || ""), { limit: 60 })
              .catch(() => ({ posts: [] })),
            apiClient.getPublicUser(String(user?.id || "")).catch(() => null),
          ]);
          const publicUser = publicUserResult?.user;
          resolvedPosts = toPosts(profilePosts.posts || []);
          resolvedSaved = [];
          resolvedReviews = [];
          profileData = {
            id: String(user?.id || "me"),
            userId: String(user?.id || ""),
            role: "consumer",
            name:
              user?.displayName ||
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              "Outsyde User",
            handle: `@${user?.username || "outsyde"}`,
            avatarUrl: user?.avatar || user?.profileImageUrl || undefined,
            coverMediaUrl: user?.coverMediaUrl || undefined,
            coverMediaType:
              user?.coverMediaType === "video" ? "video" : "image",
            city: user?.city || undefined,
            state: user?.state || undefined,
            location:
              [user?.city, user?.state].filter(Boolean).join(", ") || undefined,
            bio: user?.bio || undefined,
            tagline: (user as any)?.tagline || undefined,
            rating: 0,
            reviewCount: 0,
            followerCount: Number(
              publicUser?.followerCount ?? publicUser?.followersCount ?? 0,
            ),
            followingCount: Number(publicUser?.followingCount ?? 0),
            bookingsCount: 0,
            shootsCount: 0,
            postsCount: resolvedPosts.length,
            isVerified: Boolean((user as any)?.isVerified),
            subscriptionTier: "",
            brandColors: null,
            hasProducts: false,
            hasServices: false,
            specialties: Array.isArray((user as any)?.niches)
              ? (user as any).niches
              : [],
            responseTime: undefined,
            showResponseTime: false,
            showEmail: false,
            showPhone: false,
            showWebsite: false,
            showStoreHours: false,
          };
        }
      }

      setProfile(profileData);
      setProducts(resolvedProducts);
      setServices(resolvedServices);
      setPosts(resolvedPosts);
      setSavedItems(resolvedSaved);
      setAvailability(resolvedAvailability);
      setReviews(resolvedReviews);
    } catch (error) {
      console.error("Failed to load profile:", error);
      Alert.alert("Unable to load profile", "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [getToken, isAuthenticated, role, user, viewerMode, routeUserId, routeUserType]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const tabList = useMemo<ProfileTab[]>(
    () => (profile ? tabsForRole(profile) : ["posts"]),
    [profile],
  );

  useEffect(() => {
    if (!tabList.includes(activeTab)) {
      setActiveTab(tabList[0]);
    }
  }, [activeTab, tabList]);

  const accentColor =
    profile?.role === "business"
      ? profile.brandColors?.primary || COLORS.gold
      : COLORS.gold;
  const accentDimColor =
    profile?.role === "business"
      ? profile.brandColors?.accent || COLORS.goldDim
      : COLORS.goldDim;
  const pageBg = `${accentColor}28`;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [120, 220],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [170, 260],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const shareProfile = useCallback(async () => {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out my Outsyde profile: ${profile.handle}`,
      });
    } catch (error) {
      console.warn("Share failed:", error);
    }
  }, [profile]);

  const onEditProfilePress = useCallback(() => {
    if (!profile) return;
    if (profile.role === "business") {
      navigation.navigate("StorefrontEditor");
      return;
    }
    if (profile.role === "photographer") {
      navigation.navigate("PhotographerDashboard", { openModal: "profile" });
      return;
    }
    (navigation as any).navigate("EditProfile");
  }, [navigation, profile]);

  const openCreatePost = useCallback(() => {
    if (!isOwner || !profile || !user?.id || profile.role === "consumer") return;
    setShowCreatePost(true);
  }, [isOwner, profile, user?.id]);

  const handlePickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setNewPostImage(asset.uri);
      const isVideo = asset.type === "video" || (asset.mimeType?.includes("video") ?? false);
      setNewPostLayout(isVideo ? "pulse" : "pro");
    }
  };

  const handleCreatePost = async () => {
    if (!newPostImage) {
      Alert.alert("No Media", "Please select a photo or video for your post.");
      return;
    }
    if (!newPostLayout) {
      Alert.alert("Layout Required", "Please select a photo or video first.");
      return;
    }
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "You must be logged in to create a post.");
      return;
    }
    setPostSaving(true);
    try {
      const isVideo = newPostLayout === "pulse";
      const postData: {
        imageUrl?: string;
        videoUrl?: string;
        mediaType?: "image" | "video";
        content?: string;
        displayLayout?: "pro" | "pulse";
        feedSurface?: "pro" | "pulse";
      } = {
        content: newPostCaption.trim() || " ",
        displayLayout: newPostLayout,
        feedSurface: newPostLayout,
      };
      if (isVideo) {
        const uploadResult = await uploadVideo(newPostImage, "video/mp4", authToken);
        if (!uploadResult.uploadId) throw new Error("Failed to upload video. Please try again.");
        postData.videoUrl = uploadResult.uploadId;
        postData.mediaType = "video";
      } else {
        const uploadResult = await uploadImage(newPostImage, "image/jpeg", "posts", authToken);
        if (!uploadResult.url) throw new Error("Failed to upload image. Please try again.");
        postData.imageUrl = uploadResult.url;
      }
      const response = await apiClient.createPost(authToken, postData);
      if (response.post) {
        const newCard: PostCard = {
          id: String(response.post.id),
          label: response.post.content?.trim() || "",
          likes: 0,
          mediaUrl: response.post.imageUrl || response.post.videoUrl || undefined,
          mediaType: isVideo ? "video" : "image",
          aspect: "square",
        };
        setPosts((prev) => [newCard, ...prev]);
      }
      setNewPostImage("");
      setNewPostCaption("");
      setNewPostLayout(null);
      setShowCreatePost(false);
      Alert.alert(
        "Post Shared!",
        isVideo ? "Your video is now live on the Pulse feed!" : "Your post is now live on the Pro feed!",
        [{ text: "OK" }],
      );
      feedEvents.emitRefresh(isVideo ? "pulse" : "pro");
    } catch (error: any) {
      console.error("[AccountScreen] Failed to create post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setPostSaving(false);
    }
  };

  const postCellWidth = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - 8) / 3;

  const renderFloatingHeader = () => (
    <Animated.View
      style={[styles.floatingHeader, { paddingTop: insets.top + 6 }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: headerBgOpacity }]}
      >
        <BlurView
          intensity={22}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.headerOverlay} />
      </Animated.View>
      <View style={styles.headerRow}>
        {isOwner ? (
          <Pressable
            style={styles.headerButton}
            onPress={() => setSettingsVisible(true)}
          >
            <Feather name="menu" size={18} color={COLORS.white} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={18} color={COLORS.white} />
          </Pressable>
        )}
        <Animated.Text
          numberOfLines={1}
          style={[styles.headerTitle, { opacity: titleOpacity }]}
        >
          {profile?.name || "Profile"}
        </Animated.Text>
        <View style={styles.headerRight}>
          {isOwner ? (
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Feather name="bell" size={18} color={COLORS.white} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable style={styles.headerButton} onPress={shareProfile}>
            <Feather name="share-2" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  const renderIdentityBlock = () => {
    if (!profile) return null;
    const middleLabel =
      profile.role === "business"
        ? "Bookings"
        : profile.role === "photographer"
          ? "Shoots"
          : "Posts";
    const middleValue =
      profile.role === "business"
        ? profile.bookingsCount
        : profile.role === "photographer"
          ? profile.shootsCount
          : profile.postsCount;

    return (
      <View style={styles.identityBlock}>
        <View style={styles.avatarActionRow}>
          <AvatarWithInitials
            name={profile.name}
            imageUrl={profile.avatarUrl}
            accentColor={accentColor}
          />
          {isOwner ? (
            <Pressable
              style={[styles.editProfileButton, { backgroundColor: accentColor }]}
              onPress={onEditProfilePress}
            >
              <Text style={styles.editProfileText}>✏️ Edit Profile</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.followButton,
                isFollowing && styles.followButtonActive,
                !isFollowing && { backgroundColor: accentColor },
                isFollowing && { borderColor: accentColor },
              ]}
              onPress={handleFollowToggle}
              disabled={followBusy}
            >
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing ? { color: accentColor } : { color: COLORS.black },
                ]}
              >
                {followBusy ? "..." : isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.nameText}>{profile.name}</Text>
          {profile.isVerified ? (
            <View
              style={[styles.verifiedBadge, { backgroundColor: accentColor }]}
            >
              <Feather name="check" size={12} color={COLORS.black} />
            </View>
          ) : null}
          {profile.role === "business" && profile.subscriptionTier ? (
            <View
              style={[
                styles.tierBadge,
                profile.subscriptionTier.toLowerCase().includes("pro")
                  ? { backgroundColor: COLORS.gold }
                  : profile.subscriptionTier.toLowerCase().includes("growth")
                    ? { backgroundColor: COLORS.emerald }
                    : { backgroundColor: COLORS.gray },
              ]}
            >
              <Text
                style={[
                  styles.tierBadgeText,
                  profile.subscriptionTier.toLowerCase().includes("pro")
                    ? { color: COLORS.black }
                    : { color: COLORS.white },
                ]}
              >
                {profile.subscriptionTier}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.metaLine}>
          {profile.handle}
          {profile.location ? `  •  📍 ${profile.location}` : ""}
        </Text>

        {profile.role !== "business" && profile.bio?.trim() ? (
          <Text style={styles.bioInline}>{profile.bio.trim()}</Text>
        ) : null}

        {profile.specialties.length > 0 ? (
          <View style={styles.tagRow}>
            {profile.specialties.slice(0, 4).map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tagPill,
                  {
                    borderColor: accentColor,
                    backgroundColor: `${accentColor}22`,
                  },
                ]}
              >
                <Text style={[styles.tagPillText, { color: accentColor }]}>
                  {tag}
                </Text>
              </View>
            ))}
            {profile.role === "business" || profile.role === "photographer" ? (
              <View
                style={[
                  styles.tagPill,
                  styles.availablePill,
                  {
                    borderColor: accentColor,
                    backgroundColor: `${accentColor}22`,
                  },
                ]}
              >
                <Text style={[styles.tagPillText, { color: accentColor }]}>
                  Available
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {(profile.role === "business" || profile.role === "photographer") &&
        profile.rating > 0 ? (
          <View style={styles.ratingInlineRow}>
            <StarRating rating={profile.rating} color={accentColor} />
            <Text style={styles.ratingText}>{profile.rating.toFixed(1)}</Text>
            <Text style={styles.ratingMeta}>({profile.reviewCount})</Text>
            {profile.responseTime ? (
              <Text style={styles.ratingMeta}>⚡ {profile.responseTime}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{profile.followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{middleValue}</Text>
            <Text style={styles.statLabel}>{middleLabel}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTabBar = () => (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "rgba(0,0,0,0.55)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.10)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.10)",
      }}
    >
      {tabList.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => setActiveTab(tab)}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === tab ? "700" : "500",
              color: activeTab === tab ? accentColor : "rgba(255,255,255,0.55)",
              letterSpacing: 0.2,
            }}
          >
            {tabLabel(tab)}
          </Text>
          <View
            style={{
              height: 2,
              width: "60%",
              marginTop: 6,
              borderRadius: 1,
              backgroundColor: activeTab === tab ? accentColor : "transparent",
            }}
          />
        </Pressable>
      ))}
    </View>
  );

  const renderPostsTab = () => {
    const allCells = [
      ...(isOwner ? [{ id: "new-post", isAdd: true }] : []),
      ...posts.map((post) => ({ ...post, isAdd: false })),
    ];
    const hasPosts = posts.length > 0;
    return (
      <View style={styles.tabContent}>
        <View style={styles.mediaGrid}>
          {allCells.map((cell, index) => {
            if (cell.isAdd) {
              return (
                <Pressable
                  key="new-post"
                  style={[
                    styles.mediaCell,
                    {
                      width: postCellWidth,
                      height: postCellWidth,
                      borderWidth: 2,
                      borderStyle: "dashed",
                      borderColor: accentColor,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.03)",
                    },
                  ]}
                  onPress={openCreatePost}
                >
                  <Feather name="plus" size={20} color={accentColor} />
                  <Text style={[styles.addPostLabel, { color: accentColor }]}>
                    Post
                  </Text>
                </Pressable>
              );
            }

            const typedCell = cell as PostCard & { isAdd: false };
            const cellHeight =
              typedCell.aspect === "portrait"
                ? postCellWidth * 1.33
                : postCellWidth;
            return (
              <Pressable
                key={typedCell.id}
                style={[
                  styles.mediaCell,
                  { width: postCellWidth, height: cellHeight },
                ]}
                onPress={() =>
                  navigation.navigate("PostDetail", {
                    userId: routeUserId || String(user?.id),
                    initialPostId: typedCell.id,
                  })
                }
              >
                {typedCell.mediaUrl ? (
                  <Image
                    source={{ uri: typedCell.mediaUrl }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={["#2a2a2a", "#111111"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                {typedCell.mediaType === "video" ? (
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>▶</Text>
                  </View>
                ) : null}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.78)"]}
                  style={styles.mediaOverlay}
                >
                  <Text style={styles.mediaLabel} numberOfLines={1}>
                    {typedCell.label}
                  </Text>
                  <Text style={styles.mediaLikes}>♥ {typedCell.likes}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        {!hasPosts ? (
          <View style={styles.emptyState}>
            <Feather name="camera" size={26} color={COLORS.grayLight} />
            <Text style={styles.emptyTitle}>Share your best work</Text>
            {isOwner ? (
              <Pressable
                style={[styles.emptyCta, { backgroundColor: accentColor }]}
                onPress={openCreatePost}
              >
                <Text style={styles.emptyCtaText}>Post</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderShopTab = () => (
    <View style={styles.tabContent}>
      {products.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="shopping-bag" size={24} color={COLORS.grayLight} />
          <Text style={styles.emptyTitle}>No products yet</Text>
        </View>
      ) : (
        <View style={styles.productGrid}>
          {products.map((product) => (
            <Pressable
              key={String(product.id)}
              style={styles.productCard}
              onPress={() =>
                Alert.alert(
                  "Product details",
                  "Product detail view will be available soon.",
                )
              }
            >
              <View style={styles.productImageWrap}>
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[COLORS.gray, COLORS.black]}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={[styles.productPrice, { color: accentColor }]}>
                  {formatCents(product.priceCents)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const renderBookingTab = () => {
    if (services.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No services listed yet</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <Text
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: 12,
            paddingHorizontal: 4,
          }}
        >
          Select a Service
        </Text>
        {services.map((service) => (
          <Pressable
            key={service.id}
            onPress={() =>
              Alert.alert(
                service.name,
                `Duration: ${
                  service.durationMinutes
                    ? service.durationMinutes + " min"
                    : "TBD"
                }

Booking flow coming soon.`,
              )
            }
            style={{
              backgroundColor: "rgba(0,0,0,0.30)",
              borderRadius: 14,
              padding: 16,
              marginBottom: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                {service.name}
              </Text>
              {service.description ? (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {service.description}
                </Text>
              ) : null}
              {service.durationMinutes ? (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  {service.durationMinutes} min
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: accentColor,
                  marginBottom: 8,
                }}
              >
                {formatCents(service.priceCents)}
              </Text>
              <View
                style={{
                  backgroundColor: accentColor,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    color: "#000000",
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  Book
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderAvailabilityTab = () => {
    const slotsByDay = [0, 1, 2, 3, 4, 5, 6].map((day) =>
      availability.find((slot) => slot.dayOfWeek === day && slot.isActive),
    );
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <View style={styles.tabContent}>
        <View style={styles.calendarGrid}>
          {labels.map((label, idx) => {
            const slot = slotsByDay[idx];
            return (
              <View key={label} style={styles.calendarCard}>
                <Text style={styles.calendarDay}>{label}</Text>
                <Text style={styles.calendarHours}>
                  {slot ? `${slot.startTime} - ${slot.endTime}` : "Unavailable"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSavedTab = () => (
    <View style={styles.tabContent}>
      {savedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="bookmark" size={24} color={COLORS.grayLight} />
          <Text style={styles.emptyTitle}>No saved items yet</Text>
        </View>
      ) : (
        <View style={styles.mediaGrid}>
          {savedItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.mediaCell,
                { width: postCellWidth, height: postCellWidth },
              ]}
            >
              {item.mediaUrl ? (
                <Image
                  source={{ uri: item.mediaUrl }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const reviewBreakdown = useMemo(() => {
    if (reviews.length === 0)
      return [5, 4, 3, 2, 1].map((stars) => ({ stars, ratio: 0 }));
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      ratio:
        reviews.filter((row) => Math.round(row.rating) === stars).length /
        reviews.length,
    }));
  }, [reviews]);

  const renderReviewsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.reviewSummaryCard}>
        <View style={styles.reviewSummaryLeft}>
          <Text style={styles.reviewScore}>
            {profile?.rating?.toFixed(1) || "0.0"}
          </Text>
          <StarRating
            rating={profile?.rating || 0}
            color={accentColor}
            size={14}
          />
          <Text style={styles.reviewCountLabel}>
            {profile?.reviewCount || 0} reviews
          </Text>
        </View>
        <View style={styles.reviewSummaryRight}>
          {reviewBreakdown.map((row) => (
            <View key={row.stars} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{row.stars}</Text>
              <View style={styles.breakdownTrack}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${row.ratio * 100}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
        </View>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                <Text style={styles.reviewAvatarInitial}>
                  {getInitials(review.userName)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewUser}>{review.userName}</Text>
                <Text style={styles.reviewMeta}>
                  {"★".repeat(
                    Math.max(1, Math.min(5, Math.round(review.rating))),
                  )}{" "}
                  • {new Date(review.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <Text style={styles.reviewText}>{review.text}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderAboutTab = () => (
    <View style={styles.tabContent}>
      {profile?.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
      <View style={styles.aboutRow}>
        <Feather name="map-pin" size={14} color={accentColor} />
        <Text style={styles.aboutLabel}>Location</Text>
        <Text style={styles.aboutValue}>
          {profile?.location || "Not listed"}
        </Text>
      </View>
      <View style={styles.aboutRow}>
        <Feather name="grid" size={14} color={accentColor} />
        <Text style={styles.aboutLabel}>Category</Text>
        <Text style={styles.aboutValue}>
          {profile?.specialties[0] || "Not listed"}
        </Text>
      </View>
      {profile?.showEmail !== false ? (
        <View style={styles.aboutRow}>
          <Feather name="mail" size={14} color={accentColor} />
          <Text style={styles.aboutLabel}>Email</Text>
          <Text style={styles.aboutValue}>
            {profile?.contactEmail || "Not listed"}
          </Text>
        </View>
      ) : null}
      {profile?.showPhone !== false ? (
        <View style={styles.aboutRow}>
          <Feather name="phone" size={14} color={accentColor} />
          <Text style={styles.aboutLabel}>Phone</Text>
          <Text style={styles.aboutValue}>
            {profile?.contactPhone || "Not listed"}
          </Text>
        </View>
      ) : null}
      {profile?.showWebsite !== false ? (
        <View style={styles.aboutRow}>
          <Feather name="globe" size={14} color={accentColor} />
          <Text style={styles.aboutLabel}>Website</Text>
          <Text style={styles.aboutValue}>
            {profile?.websiteUrl || "Not listed"}
          </Text>
        </View>
      ) : null}
      {profile?.role === "business" && profile.showStoreHours !== false ? (
        <View style={styles.aboutRow}>
          <Feather name="clock" size={14} color={accentColor} />
          <Text style={styles.aboutLabel}>Store Hours</Text>
          <Text style={styles.aboutValue}>
            {profile?.hoursOfOperation || "Not listed"}
          </Text>
        </View>
      ) : null}
      {profile?.showResponseTime !== false && profile?.responseTime ? (
        <View style={styles.aboutRow}>
          <Feather name="zap" size={14} color={accentColor} />
          <Text style={styles.aboutLabel}>Response Time</Text>
          <Text style={styles.aboutValue}>{profile.responseTime}</Text>
        </View>
      ) : null}
      <View style={styles.aboutRow}>
        <Feather name="calendar" size={14} color={accentColor} />
        <Text style={styles.aboutLabel}>Availability</Text>
        <Text style={styles.aboutValue}>
          {profile?.availabilitySummary ||
            (profile?.showStoreHours !== false
              ? profile?.hoursOfOperation
              : undefined) ||
            "Available"}
        </Text>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "posts":
        return renderPostsTab();
      case "shop":
        return renderShopTab();
      case "booking":
        return renderBookingTab();
      case "availability":
        return renderAvailabilityTab();
      case "saved":
        return renderSavedTab();
      case "reviews":
        return renderReviewsTab();
      case "about":
        return renderAboutTab();
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]}>
        <View style={styles.loadingWrap}>
          <Feather name="user" size={46} color={COLORS.gold} />
          <Text style={[styles.loadingText, { marginTop: 10 }]}>
            Sign in to view your profile
          </Text>
          <Pressable
            style={[
              styles.emptyCta,
              { marginTop: 16, backgroundColor: COLORS.gold },
            ]}
            onPress={() => navigation.navigate("Auth", {})}
          >
            <Text style={styles.emptyCtaText}>Go to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !profile) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]}>
      {renderFloatingHeader()}
      <Animated.ScrollView
        style={[styles.scrollView, { backgroundColor: pageBg }]}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 30,
          backgroundColor: pageBg,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
          },
        )}
        scrollEventThrottle={16}
      >
        <CoverMediaHero
          profile={profile}
          primaryColor={accentColor}
          accentColor={accentDimColor}
        />
        {renderIdentityBlock()}
        {renderTabBar()}
        {renderTabContent()}
      </Animated.ScrollView>

      <PersonalSettingsMenu
        visible={isOwner && settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onEditProfile={
          isOwner && profile?.role !== "business" ? onEditProfilePress : undefined
        }
      />

      <Modal visible={isOwner && showCreatePost} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#111111", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ color: COLORS.white, fontSize: 18, fontWeight: "800" }}>Create Post</Text>
                <Pressable onPress={() => { setShowCreatePost(false); setNewPostImage(""); setNewPostCaption(""); setNewPostLayout(null); }}>
                  <Feather name="x" size={24} color={COLORS.white} />
                </Pressable>
              </View>

              <Pressable
                onPress={handlePickPostImage}
                style={{ width: "100%", aspectRatio: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" }}
              >
                {newPostImage ? (
                  newPostLayout === "pulse" ? (
                    <View style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }}>
                      <Feather name="video" size={48} color="rgba(255,255,255,0.7)" />
                      <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 8, fontSize: 14 }}>Video selected</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: newPostImage }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  )
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Feather name="image" size={48} color={COLORS.grayLight} />
                    <Text style={{ color: COLORS.grayLight, marginTop: 8, fontSize: 14 }}>Tap to select photo or video</Text>
                  </View>
                )}
              </Pressable>

              <TextInput
                value={newPostCaption}
                onChangeText={setNewPostCaption}
                placeholder="Write a caption..."
                placeholderTextColor={COLORS.grayLight}
                multiline
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, color: COLORS.white, minHeight: 80, textAlignVertical: "top", marginBottom: 16, fontSize: 14 }}
              />

              <Pressable
                onPress={handleCreatePost}
                disabled={postSaving || !newPostImage}
                style={{ backgroundColor: postSaving || !newPostImage ? COLORS.grayMid : accentColor, paddingVertical: 16, borderRadius: 12, alignItems: "center", opacity: postSaving || !newPostImage ? 0.5 : 1 }}
              >
                {postSaving ? (
                  <Text style={{ color: COLORS.black, fontWeight: "800", fontSize: 15 }}>Sharing...</Text>
                ) : (
                  <Text style={{ color: COLORS.black, fontWeight: "800", fontSize: 15 }}>Share Post</Text>
                )}
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  scrollView: {
    backgroundColor: COLORS.black,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  floatingHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 50,
    paddingHorizontal: 14,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.95)",
  },
  headerRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    marginHorizontal: 2,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
    maxWidth: "45%",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "700",
  },
  coverHero: {
    height: HERO_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },
  coverMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  coverFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  identityBlock: {
    marginTop: -60,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 16,
    zIndex: 5,
    position: "relative",
  },
  avatarActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  avatarOuterRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarInnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: COLORS.black,
    fontSize: 28,
    fontWeight: "800",
  },
  onlineDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    right: 2,
    bottom: 2,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: COLORS.black,
  },
  editProfileButton: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 9,
    marginBottom: 6,
  },
  editProfileText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "800",
  },
  followButton: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  followButtonActive: {
    backgroundColor: "transparent",
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  nameRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  nameText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tierBadge: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaLine: {
    marginTop: 6,
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
  },
  tagRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  availablePill: {
    borderStyle: "solid",
  },
  tagPillText: {
    color: COLORS.cream,
    fontSize: 11,
    fontWeight: "600",
  },
  ratingInlineRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  ratingMeta: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
  },
  statsCard: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    flexDirection: "row",
    overflow: "hidden",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 2,
    color: COLORS.grayLight,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.2,
  },
  tabUnderline: {
    height: 2,
    width: "60%",
    marginTop: 6,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  tabContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    backgroundColor: "transparent",
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  mediaCell: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  addPostLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  videoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.56)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700",
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mediaLabel: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "600",
  },
  mediaLikes: {
    marginTop: 2,
    color: COLORS.cream,
    fontSize: 10,
    fontWeight: "600",
  },
  emptyState: {
    marginTop: 14,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  emptyTitle: {
    marginTop: 8,
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
  },
  emptyCta: {
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyCtaText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: "800",
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productCard: {
    width: (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - 10) / 2,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  productImageWrap: {
    height: 132,
    backgroundColor: "#191919",
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: "600",
  },
  productPrice: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
  },
  serviceCard: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
    marginBottom: 10,
  },
  serviceName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  serviceDescription: {
    marginTop: 4,
    color: COLORS.grayLight,
    fontSize: 12,
    lineHeight: 18,
  },
  serviceMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: "800",
  },
  serviceMeta: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
  },
  summaryCard: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
    marginTop: 4,
  },
  summaryText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: "500",
  },
  summaryLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
  },
  calendarGrid: {
    gap: 8,
  },
  calendarCard: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
  },
  calendarDay: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  calendarHours: {
    marginTop: 4,
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
  },
  reviewSummaryCard: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
    flexDirection: "row",
    marginBottom: 12,
  },
  reviewSummaryLeft: {
    width: "36%",
  },
  reviewSummaryRight: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  reviewScore: {
    color: COLORS.white,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 44,
  },
  reviewCountLabel: {
    marginTop: 4,
    color: COLORS.grayLight,
    fontSize: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  breakdownLabel: {
    width: 14,
    color: COLORS.grayLight,
    fontSize: 11,
    fontWeight: "700",
  },
  breakdownTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
  },
  breakdownFill: {
    height: 4,
    borderRadius: 4,
  },
  reviewCard: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.grayMid,
    marginRight: 8,
  },
  reviewAvatarInitial: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  reviewUser: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  reviewMeta: {
    color: COLORS.grayLight,
    fontSize: 11,
  },
  reviewText: {
    color: COLORS.cream,
    fontSize: 13,
    lineHeight: 19,
  },
  bioText: {
    color: COLORS.cream,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  bioInline: {
    color: COLORS.cream,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 2,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  aboutLabel: {
    marginLeft: 10,
    width: 110,
    color: COLORS.grayLight,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  aboutValue: {
    flex: 1,
    color: COLORS.cream,
    fontSize: 13,
    textAlign: "right",
  },
});

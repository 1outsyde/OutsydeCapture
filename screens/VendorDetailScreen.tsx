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
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

import apiClient, {
  ApiPost,
  VendorBookerPhotographerService,
  VendorProduct,
  VendorService,
} from "@/services/api";
import { useTheme } from "@/hooks/useTheme";
import {
  BrandColorSpec,
  resolveBrandColor,
  parseBrandColorSpec,
} from "@/constants/colorOptions";
import { hoursObjectToArray } from "@/components/HoursEditor";
import StaffCardList, { StaffCardVM } from "@/components/StaffCardList";
import BookingFlow from "@/components/BookingFlow";
import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";

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

const HERO_HEIGHT = 300;
const HORIZONTAL_PADDING = 20;
const SCREEN_WIDTH = Dimensions.get("window").width;

type Props = NativeStackScreenProps<RootStackParamList, "VendorDetail">;
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

type BrandColors = BrandColorSpec | null;

type ReviewItem = {
  id: string;
  userName: string;
  avatarUrl?: string;
  rating: number;
  text: string;
  createdAt: string;
};

type PostCard = {
  id: string;
  label: string;
  likes: number;
  mediaUrl?: string;
  mediaType: "image" | "video";
  aspect: "portrait" | "square";
  displayLayout?: "pro" | "pulse";
  authorUserId?: string;
};

type ServiceCard = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  durationMinutes?: number;
  rating?: number;
  reviewCount?: number;
};

type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

type ProfileViewModel = {
  id: string;
  userId?: string;
  role: ProfileRole;
  name: string;
  handle: string;
  avatarUrl?: string;
  logoImage?: string;
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
  bookingCount: number;
  shootsCount: number;
  postsCount: number;
  isVerified: boolean;
  subscriptionTier?: string;
  brandColors: BrandColors;
  hasProducts: boolean;
  hasServices: boolean;
  isMultiStaff: boolean;
  specialties: string[];
  hourlyRate?: number;
  minPrice?: number;
  responseTime?: string;
  responseTimeValue?: number;
  responseTimeUnit?: ResponseTimeUnit;
  showResponseTime?: boolean;
  availabilitySummary?: string;
  address?: string;
  hasPhysicalLocation?: boolean;
  showAddress?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  hoursOfOperation?: Record<string, any> | string | null;
  showEmail?: boolean;
  showPhone?: boolean;
  showWebsite?: boolean;
  showStoreHours?: boolean;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const profileHasAbout = (profile: ProfileViewModel): boolean =>
  Boolean(
    profile.bio?.trim() ||
      profile.tagline?.trim() ||
      (profile.showStoreHours !== false && Boolean(profile.hoursOfOperation)) ||
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

const getInitials = (name?: string): string => {
  if (!name) return "O";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "O";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const parseBrandColors = (raw: unknown): BrandColors =>
  parseBrandColorSpec(raw);

const scoreToStars = (rating: number): number => {
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return rating > 5 ? Math.round(rating / 10) : Math.round(rating);
};

const normalizePosts = (posts: ApiPost[], ownerId?: string): PostCard[] =>
  posts.map((post, index) => {
    const mediaType =
      post.mediaType === "video" || (!!post.videoUrl && !post.imageUrl)
        ? "video"
        : "image";
    const mediaUrl =
      post.imageUrl ||
      post.thumbnailUrl ||
      post.videoUrl ||
      post.mediaUrl ||
      post.images?.[0];
    return {
      id: String(post.id),
      label: post.content?.trim() || "",
      likes: Number(post.likesCount ?? 0),
      mediaUrl: mediaUrl || undefined,
      mediaType,
      aspect: index % 3 === 0 ? "portrait" : "square",
      displayLayout: post.displayLayout || undefined,
      authorUserId: post.userId || post.authorId || ownerId,
    };
  });

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
      {Array.from({ length: 5 }).map((_, index) => (
        <Feather
          key={`star-${index}`}
          name="star"
          size={size}
          color={index < stars ? color : COLORS.grayMid}
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
  profile: ProfileViewModel;
  primaryColor: string;
  accentColor: string;
}) => {
  const isMuxVideo =
    profile.coverMediaType === "video" &&
    !!profile.coverMediaUrl &&
    profile.coverMediaUrl.startsWith("https://stream.mux.com/");
  const isProcessingVideo =
    profile.coverMediaType === "video" &&
    !!profile.coverMediaUrl &&
    !profile.coverMediaUrl.startsWith("https://stream.mux.com/");
  const isImage = profile.coverMediaType === "image" && !!profile.coverMediaUrl;

  const [showFullscreen, setShowFullscreen] = useState(false);

  const videoPlayer = useVideoPlayer(
    isMuxVideo ? profile.coverMediaUrl || "" : "",
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    },
  );

  const fullscreenPlayer = useVideoPlayer(
    isMuxVideo ? profile.coverMediaUrl || "" : "",
    (player) => {
      player.muted = false;
    },
  );

  const gradientColors: [string, string, string] =
    profile.role === "business" && profile.brandColors
      ? [primaryColor, accentColor, COLORS.black]
      : ["#1a1a1a", "#2d2410", "#0a0a0a"];

  const handleVideoTap = () => {
    videoPlayer.pause();
    fullscreenPlayer.play();
    setShowFullscreen(true);
  };

  const handleFullscreenClose = () => {
    fullscreenPlayer.pause();
    setShowFullscreen(false);
    videoPlayer.play();
  };

  return (
    <View style={styles.coverHero}>
      {isMuxVideo ? (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleVideoTap}
        >
          <VideoView
            player={videoPlayer}
            style={styles.coverMedia}
            contentFit="cover"
            nativeControls={false}
          />
        </Pressable>
      ) : null}
      {isProcessingVideo ? (
        <>
          <LinearGradient
            colors={gradientColors}
            style={styles.coverMedia}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>Processing video...</Text>
          </View>
        </>
      ) : null}
      {!isMuxVideo && !isProcessingVideo && isImage ? (
        <Image
          source={{ uri: profile.coverMediaUrl }}
          style={styles.coverMedia}
          contentFit="cover"
        />
      ) : null}
      {!isMuxVideo && !isProcessingVideo && !isImage ? (
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
      <Modal
        visible={showFullscreen}
        animationType="fade"
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={handleFullscreenClose}
      >
        <View style={styles.fullscreenContainer}>
          <VideoView
            player={fullscreenPlayer}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            nativeControls
          />
          <Pressable
            style={styles.fullscreenCloseButton}
            onPress={handleFullscreenClose}
          >
            <Feather name="x" size={24} color={COLORS.white} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
};

export default function VendorDetailScreen({ route }: Props) {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const { vendorId, initialTab } = route.params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileViewModel | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [staff, setStaff] = useState<StaffCardVM[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [bookingFlowActive, setBookingFlowActive] = useState(false);
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSheetIndex, setReviewSheetIndex] = useState(-1);

  const scrollY = useRef(new Animated.Value(0)).current;
  const reviewSnapPoints = useMemo(() => ["45%"], []);

  const isOwnProfile = useMemo(() => {
    if (!profile || !user?.id) return false;
    return (
      String(user.id) === String(profile.id) ||
      String(user.id) === String(profile.userId ?? "")
    );
  }, [profile, user?.id]);

  const colorMode = isDark ? "dark" : "light";
  const accentColor =
    profile?.role === "business" || profile?.role === "photographer"
      ? resolveBrandColor(profile.brandColors ?? null, colorMode)
      : COLORS.gold;
  const accentDimColor = COLORS.goldDim;
  const pageBg = `${accentColor}28`;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedProfile: ProfileViewModel | null = null;
      let resolvedProducts: VendorProduct[] = [];
      let resolvedServices: ServiceCard[] = [];
      let resolvedPosts: PostCard[] = [];
      let resolvedReviews: ReviewItem[] = [];
      let resolvedAvailability: AvailabilitySlot[] = [];

      try {
        const business = await apiClient.getBusiness(vendorId);
        const postOwnerId = String(
          (business as any).ownerId ??
            (business as any).userId ??
            business.id ??
            vendorId,
        );
        const [productResponse, serviceResponse, postResponse] =
          await Promise.all([
            apiClient
              .getBusinessPublicProducts(vendorId)
              .catch(() => ({ products: [] })),
            apiClient
              .getBusinessPublicServices(vendorId)
              .catch(() => ({ services: [] })),
            apiClient
              .getProfilePosts(postOwnerId, { limit: 60 })
              .catch(() => ({ posts: [] })),
          ]);

        const liveProducts = (
          (productResponse.products || []) as VendorProduct[]
        )
          .filter((item: VendorProduct) => item.status === "live")
          .map((item) => ({
            ...item,
            priceCents: Number(
              item.priceCents ?? (item as any).price ?? 0
            ),
          }));
        const liveServices = (
          (serviceResponse.services || []) as VendorService[]
        )
          .filter((item: VendorService) => item.status === "live")
          .map((item: VendorService) => ({
            id: String(item.id),
            name: item.name,
            description: item.description || undefined,
            priceCents: Number(
              item.priceCents ?? (item as any).price ?? 0
            ),
            durationMinutes:
              item.durationMinutes ||
              (item as any).estimatedDurationMinutes ||
              undefined,
            rating: Number(item.rating ?? 0),
            reviewCount: Number(item.reviewCount ?? 0),
          }));

        resolvedPosts = normalizePosts(postResponse.posts || [], postOwnerId);

        const brandColors = parseBrandColors((business as any).brandColors);
        const hasProducts = liveProducts.length > 0;
        const hasServices = liveServices.length > 0;
        const minPrice = getMinimumPrice(liveProducts, liveServices);

        resolvedProfile = {
          id: String(business.id ?? vendorId),
          userId: String((business as any).userId ?? ""),
          role: "business",
          name: business.name || "Business",
          handle: `@${
            (business as any).username ||
            (business as any).handle ||
            String(business.name || "business")
              .replace(/\s+/g, "")
              .toLowerCase()
          }`,
          avatarUrl: (business as any).avatar || undefined,
          logoImage: (business as any).logoImage || undefined,
          coverMediaUrl:
            (business as any).coverMediaUrl || business.coverImage || undefined,
          coverMediaType: ((business as any).coverMediaType === "video"
            ? "video"
            : "image") as "image" | "video",
          city: business.city || undefined,
          state: business.state || undefined,
          location:
            [business.city, business.state].filter(Boolean).join(", ") ||
            (business as any).location ||
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
          bookingCount: Number(
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
          brandColors,
          hasProducts,
          hasServices,
          isMultiStaff: business.isMultiStaff ?? false,
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
          hoursOfOperation: (business as any).hoursOfOperation ?? undefined,
          hasPhysicalLocation: (business as any).hasPhysicalLocation !== false,
          showAddress: (business as any).showAddress !== false,
          showEmail: (business as any).showEmail !== false,
          showPhone: (business as any).showPhone !== false,
          showWebsite: (business as any).showWebsite !== false,
          showStoreHours: (business as any).showStoreHours !== false,
        };

        resolvedProducts = liveProducts;
        resolvedServices = liveServices;
        resolvedReviews = Array.isArray((business as any).reviews)
          ? (business as any).reviews.map((item: any, index: number) => ({
              id: String(item.id ?? `review-${index}`),
              userName: item.userName || item.authorName || "Outsyde User",
              avatarUrl: item.avatarUrl || item.authorAvatar || undefined,
              rating: Number(item.rating ?? 5),
              text: item.text || item.comment || "",
              createdAt: item.createdAt || new Date().toISOString(),
            }))
          : [];
      } catch {
        try {
          console.log(
            "[VendorDetail] Business lookup failed, trying photographer with vendorId:",
            vendorId,
          );
          const photographer = await apiClient.getPhotographer(vendorId);
          const postOwnerId = String(
            (photographer as any).userId ?? photographer.id ?? vendorId,
          );
          const [serviceResponse, availabilityResponse, postResponse] =
            await Promise.all([
              apiClient.getPhotographerPublicServices(vendorId).catch(() => []),
              apiClient
                .getPhotographerPublicAvailability(vendorId)
                .catch(() => ({ availability: [] })),
              apiClient
                .getProfilePosts(postOwnerId, { limit: 60 })
                .catch(() => ({ posts: [] })),
            ]);
          console.log(
            "[VendorDetail] Photographer loaded:",
            photographer.id,
            photographer.name || (photographer as any).displayName,
          );

          try {
            const photographerServices = (
              (Array.isArray(serviceResponse)
                ? serviceResponse
                : (serviceResponse as any)?.services ||
                  (serviceResponse as any)?.data ||
                  []) as VendorBookerPhotographerService[]
            )
              .filter((item: VendorBookerPhotographerService) => {
                if (!item.status) return true;
                const s = item.status.toLowerCase();
                return (
                  s === "live" ||
                  s === "active" ||
                  (s !== "archived" && s !== "paused" && s !== "draft")
                );
              })
              .map((item: VendorBookerPhotographerService) => ({
                id: String(item.id),
                name: item.name,
                description: item.description || undefined,
                priceCents: Number(
                  item.priceCents ?? (item as any).price ?? 0
                ),
                durationMinutes: (item as any).durationMinutes || undefined,
                rating: Number((item as any).rating ?? 0),
                reviewCount: Number((item as any).reviewCount ?? 0),
              }));

            resolvedPosts = normalizePosts(postResponse.posts || [], postOwnerId);

            resolvedProfile = {
              id: String(photographer.id ?? vendorId),
              userId: String((photographer as any).userId ?? ""),
              role: "photographer",
              name:
                photographer.name ||
                (photographer as any).displayName ||
                "Photographer",
              handle: `@${
                (photographer as any).username ||
                String(photographer.name || "photographer")
                  .replace(/\s+/g, "")
                  .toLowerCase()
              }`,
              avatarUrl:
                (photographer as any).avatar ||
                (photographer as any).logoImage ||
                undefined,
              coverMediaUrl:
                (photographer as any).coverMediaUrl ||
                photographer.coverImage ||
                undefined,
              coverMediaType: ((photographer as any).coverMediaType === "video"
                ? "video"
                : "image") as "image" | "video",
              city: photographer.city || undefined,
              state: photographer.state || undefined,
              location:
                photographer.location ||
                [photographer.city, photographer.state]
                  .filter(Boolean)
                  .join(", "),
              bio: photographer.description || undefined,
              tagline: (photographer as any).tagline || undefined,
              rating: Number(photographer.rating ?? 0),
              reviewCount: Number(photographer.reviewCount ?? 0),
              followerCount: Number(
                (photographer as any).followerCount ??
                  (photographer as any).followersCount ??
                  0,
              ),
              followingCount: Number((photographer as any).followingCount ?? 0),
              bookingCount: 0,
              shootsCount: Number(
                (photographer as any).shootCount ??
                  (photographer as any).shootsCount ??
                  (photographer as any).totalShoots ??
                  (photographer as any).bookingCount ??
                  (photographer as any).totalBookings ??
                  (photographer as any).bookingsCount ??
                  0,
              ),
              postsCount: resolvedPosts.length,
              isVerified: Boolean((photographer as any).isVerified),
              subscriptionTier: String(
                (photographer as any).subscriptionTier || "",
              ),
              brandColors: parseBrandColors((photographer as any).brandColors),
              hasProducts: false,
              hasServices: photographerServices.length > 0,
              isMultiStaff: false,
              specialties:
                photographer.specialties ||
                (photographer.specialty ? [photographer.specialty] : []),
              hourlyRate:
                Number((photographer as any).hourlyRate ?? 0) || undefined,
              minPrice: getMinimumPrice([], photographerServices),
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
              availabilitySummary:
                (photographer as any).availability || undefined,
              contactEmail: photographer.email || undefined,
              contactPhone: photographer.phone || undefined,
              websiteUrl: photographer.website || undefined,
              showEmail: (photographer as any).showEmail !== false,
              showPhone: (photographer as any).showPhone !== false,
              showWebsite: (photographer as any).showWebsite !== false,
              showStoreHours: true,
            };

            resolvedServices = photographerServices;
            resolvedAvailability = (
              availabilityResponse.availability || []
            ).map((slot: any) => ({
              dayOfWeek: Number(slot.dayOfWeek ?? 0),
              startTime: String(slot.startTime ?? ""),
              endTime: String(slot.endTime ?? ""),
              isActive: Boolean(slot.isActive ?? true),
            }));
            resolvedReviews = Array.isArray((photographer as any).reviews)
              ? (photographer as any).reviews.map(
                  (item: any, index: number) => ({
                    id: String(item.id ?? `review-${index}`),
                    userName: item.userName || item.authorName || "Outsyde User",
                    avatarUrl: item.avatarUrl || item.authorAvatar || undefined,
                    rating: Number(item.rating ?? 5),
                    text: item.text || item.comment || "",
                    createdAt: item.createdAt || new Date().toISOString(),
                  }),
                )
              : [];
          } catch (processingError) {
            console.warn(
              "[VendorDetail] Photographer data processing error, rendering with partial data:",
              processingError,
            );
            resolvedPosts = [];
            resolvedAvailability = [];
            resolvedReviews = [];
            try {
              resolvedServices = (
                (Array.isArray(serviceResponse)
                  ? serviceResponse
                  : (serviceResponse as any)?.services ||
                    (serviceResponse as any)?.data ||
                    []) as VendorBookerPhotographerService[]
              )
                .filter((item: VendorBookerPhotographerService) => {
                  if (!item.status) return true;
                  const s = item.status.toLowerCase();
                  return (
                    s === "live" ||
                    s === "active" ||
                    (s !== "archived" && s !== "paused" && s !== "draft")
                  );
                })
                .map((item: VendorBookerPhotographerService) => ({
                  id: String(item.id),
                  name: item.name,
                  description: item.description || undefined,
                  priceCents: Number(
                    item.priceCents ?? (item as any).price ?? 0
                  ),
                  durationMinutes: (item as any).durationMinutes || undefined,
                  rating: Number((item as any).rating ?? 0),
                  reviewCount: Number((item as any).reviewCount ?? 0),
                }));
            } catch {
              resolvedServices = [];
            }
            resolvedProfile = {
              id: String(photographer.id ?? vendorId),
              userId: String((photographer as any).userId ?? ""),
              role: "photographer",
              name:
                (photographer as any).displayName ||
                photographer.name ||
                "Photographer",
              handle: `@${
                (photographer as any).username ||
                String(
                  (photographer as any).displayName ||
                    photographer.name ||
                    "photographer",
                )
                  .replace(/\s+/g, "")
                  .toLowerCase()
              }`,
              avatarUrl:
                (photographer as any).avatar ||
                (photographer as any).logoImage ||
                undefined,
              coverMediaUrl:
                (photographer as any).coverMediaUrl ||
                photographer.coverImage ||
                undefined,
              coverMediaType: ((photographer as any).coverMediaType === "video"
                ? "video"
                : "image") as "image" | "video",
              city: photographer.city || undefined,
              state: photographer.state || undefined,
              location:
                photographer.location ||
                [photographer.city, photographer.state]
                  .filter(Boolean)
                  .join(", "),
              bio: photographer.description || undefined,
              tagline: (photographer as any).tagline || undefined,
              rating: Number(photographer.rating ?? 0),
              reviewCount: Number(photographer.reviewCount ?? 0),
              followerCount: Number(
                (photographer as any).followerCount ??
                  (photographer as any).followersCount ??
                  0,
              ),
              followingCount: Number((photographer as any).followingCount ?? 0),
              bookingCount: 0,
              shootsCount: Number(
                (photographer as any).shootCount ??
                  (photographer as any).shootsCount ??
                  (photographer as any).totalShoots ??
                  (photographer as any).bookingCount ??
                  (photographer as any).totalBookings ??
                  (photographer as any).bookingsCount ??
                  0,
              ),
              postsCount: 0,
              isVerified: Boolean((photographer as any).isVerified),
              subscriptionTier: String(
                (photographer as any).subscriptionTier || "",
              ),
              brandColors: parseBrandColors((photographer as any).brandColors),
              hasProducts: false,
              hasServices: resolvedServices.length > 0,
              isMultiStaff: false,
              specialties: Array.isArray(photographer.specialties)
                ? photographer.specialties
                : photographer.specialty
                  ? [photographer.specialty]
                  : [],
              hourlyRate:
                Number((photographer as any).hourlyRate ?? 0) || undefined,
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
              availabilitySummary:
                (photographer as any).availability || undefined,
              contactEmail: photographer.email || undefined,
              contactPhone: photographer.phone || undefined,
              websiteUrl: photographer.website || undefined,
              showEmail: (photographer as any).showEmail !== false,
              showPhone: (photographer as any).showPhone !== false,
              showWebsite: (photographer as any).showWebsite !== false,
              showStoreHours: true,
            };
          }
        } catch {
          console.error(
            "[VendorDetail] Both business and photographer lookups failed for vendorId:",
            vendorId,
          );
          // Consumer resolution: try getPublicUser before falling back to stub
          try {
            const { user } = await apiClient.getPublicUser(vendorId);
            console.log(
              "[VendorDetail] consumer path: getPublicUser for",
              vendorId,
              "→",
              { name: user.name, followerCount: user.followerCount },
            );
            const postResponse = await apiClient
              .getProfilePosts(vendorId, { limit: 60 })
              .catch(() => ({ posts: [] }));
            resolvedPosts = normalizePosts(postResponse.posts || [], String(user.id));
            const avatarUrl =
              user.avatarUrl || user.profileImageUrl || undefined;
            resolvedProfile = {
              id: String(user.id),
              userId: String(user.id),
              role: "consumer",
              name: user.name || user.username || "Outsyde User",
              handle: `@${user.username || "outsyde"}`,
              avatarUrl: avatarUrl && avatarUrl !== "" ? avatarUrl : undefined,
              coverMediaUrl: user.coverMediaUrl || undefined,
              coverMediaType: (user.coverMediaType === "video"
                ? "video"
                : "image") as "image" | "video",
              city: user.city || undefined,
              state: user.state || undefined,
              location:
                [user.city, user.state].filter(Boolean).join(", ") ||
                undefined,
              rating: 0,
              reviewCount: 0,
              followerCount: Number(user.followerCount ?? 0),
              followingCount: Number(user.followingCount ?? 0),
              bookingCount: 0,
              shootsCount: 0,
              postsCount: resolvedPosts.length,
              isVerified: false,
              brandColors: null,
              hasProducts: false,
              hasServices: false,
              isMultiStaff: false,
              specialties: [],
              showResponseTime: false,
              showEmail: false,
              showPhone: false,
              showWebsite: false,
              showStoreHours: false,
            };
          } catch {
            // Final fallback stub — truly unknown id or network error
            const postResponse = await apiClient
              .getProfilePosts(vendorId, { limit: 60 })
              .catch(() => ({ posts: [] }));
            resolvedPosts = normalizePosts(postResponse.posts || [], vendorId);
            resolvedProfile = {
              id: vendorId,
              role: "consumer",
              name: "Outsyde User",
              handle: "@outsyde",
              rating: 0,
              reviewCount: 0,
              followerCount: 0,
              followingCount: 0,
              bookingCount: 0,
              shootsCount: 0,
              postsCount: resolvedPosts.length,
              isVerified: false,
              brandColors: null,
              hasProducts: false,
              hasServices: false,
              isMultiStaff: false,
              specialties: [],
              showResponseTime: false,
              showEmail: false,
              showPhone: false,
              showWebsite: false,
              showStoreHours: false,
            };
          }
        }
      }

      setProfile(resolvedProfile);
      setProducts(resolvedProducts);
      setServices(resolvedServices);
      setPosts(resolvedPosts);
      setReviews(resolvedReviews);
      setAvailability(resolvedAvailability);
    } catch (error) {
      console.error("Failed to load profile:", error);
      Alert.alert("Unable to load profile", "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile?.isMultiStaff) {
      setStaff([]);
      setSelectedStaffId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.getBusinessPublicStaff(vendorId);
        if (cancelled) return;
        const mapped: StaffCardVM[] = (response.staff || []).map((member) => ({
          id: String(member.id),
          displayName: member.displayName || "Team Member",
          bio: member.bio || undefined,
          profileImageUrl: member.profileImageUrl || undefined,
          specialties: Array.isArray(member.specialties)
            ? member.specialties
            : [],
          serviceIds: Array.isArray(member.serviceIds)
            ? member.serviceIds
            : [],
          rating: Number(member.rating ?? 0),
          reviewCount: Number(member.reviewCount ?? 0),
        }));
        setStaff(mapped);
      } catch (error) {
        console.error("[VendorDetail] Failed to load staff:", error);
        if (!cancelled) setStaff([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.isMultiStaff, vendorId]);

  const tabOrder = useMemo<ProfileTab[]>(() => {
    if (!profile) return ["posts", "reviews"];
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
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    if (initialTab === "products" && tabOrder.includes("shop")) {
      setActiveTab("shop");
      return;
    }
    if (initialTab === "services" && tabOrder.includes("booking")) {
      setActiveTab("booking");
      return;
    }
    if (initialTab === "reviews" && tabOrder.includes("reviews")) {
      setActiveTab("reviews");
      return;
    }
    if (!tabOrder.includes(activeTab)) {
      setActiveTab(tabOrder[0]);
    }
  }, [profile, tabOrder, initialTab, activeTab]);

  useEffect(() => {
    if (!profile || isOwnProfile || !isAuthenticated) return;
    const targetId = profile.userId || profile.id;
    apiClient
      .checkFollowStatus(targetId)
      .then((result) => setIsFollowing(result.isFollowing))
      .catch(() => setIsFollowing(false));
  }, [profile, isOwnProfile, isAuthenticated]);

  useEffect(() => {
    return () => setBookingFlowActive(false);
  }, []);

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

  const openReviewModal = useCallback(() => {
    setReviewSheetIndex(0);
  }, []);

  const handleShare = useCallback(async () => {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out ${profile.name} on Outsyde`,
      });
    } catch (error) {
      console.warn("Share failed:", error);
    }
  }, [profile]);

  const handleSubmitReview = useCallback(() => {
    if (!profile || reviewRating === 0) {
      Alert.alert("Add a rating", "Select a star rating before submitting.");
      return;
    }
    console.log("TODO review submit", {
      profileId: profile.id,
      rating: reviewRating,
      reviewText,
    });
    // TODO: Wire review submit to POST /reviews endpoint
    setReviewRating(0);
    setReviewText("");
    setReviewSheetIndex(-1);
    Alert.alert("Review captured", "Thanks for your feedback.");
  }, [profile, reviewRating, reviewText]);

  const resolvePrimaryAction = useCallback(() => {
    if (!profile) return { label: "", onPress: () => {} };
    if (profile.role === "photographer") {
      return {
        label: "Book Shoot →",
        onPress: () =>
          navigation.navigate("Booking", { photographerId: profile.id }),
      };
    }
    if (profile.role === "business") {
      if (profile.hasServices) {
        return {
          label: "Book Now →",
          onPress: () => {
            setActiveTab("booking");
            setBookingFlowActive(true);
          },
        };
      }
      if (profile.hasProducts) {
        return {
          label: "Book Now →",
          onPress: () => setActiveTab("shop"),
        };
      }
    }
    return {
      label: "Message",
      onPress: () =>
        Alert.alert(
          "Coming soon",
          "Messaging will be wired in a follow-up update.",
        ),
    };
  }, [navigation, profile]);

  const reviewBreakdown = useMemo(() => {
    if (reviews.length === 0) {
      return [5, 4, 3, 2, 1].map((stars) => ({ stars, ratio: 0 }));
    }
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = reviews.filter(
        (review) => Math.round(review.rating) === stars,
      ).length;
      return { stars, ratio: count / reviews.length };
    });
  }, [reviews]);

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
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={18} color={COLORS.white} />
        </Pressable>
        <Animated.Text
          numberOfLines={1}
          style={[styles.headerTitle, { opacity: titleOpacity }]}
        >
          {profile?.name || "Profile"}
        </Animated.Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerButton}>
            <Feather name="bell" size={18} color={COLORS.white} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleShare}>
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
        ? profile.bookingCount
        : profile.role === "photographer"
          ? profile.shootsCount
          : profile.postsCount;

    return (
      <View style={styles.identityBlock}>
        <View style={styles.avatarActionRow}>
          <AvatarWithInitials
            name={profile.name}
            imageUrl={profile.avatarUrl || profile.logoImage}
            accentColor={accentColor}
          />
          <View style={styles.actionsWrap}>
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
                  isFollowing
                    ? { color: accentColor }
                    : { color: COLORS.black },
                ]}
              >
                {followBusy ? "..." : isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>

            <Pressable style={styles.messageButton}>
              <Feather name="message-circle" size={15} color={COLORS.white} />
            </Pressable>
          </View>
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

        {profile.role === "business" && profile.tagline?.trim() ? (
          <Text style={styles.taglineText}>{profile.tagline}</Text>
        ) : null}

        <Text style={styles.metaLine}>
          {profile.handle}
          {profile.location ? `  •  📍 ${profile.location}` : ""}
        </Text>

        {profile.specialties.length > 0 ||
        profile.role === "business" ||
        profile.role === "photographer" ? (
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

        <View style={styles.ratingInlineRow}>
          <StarRating rating={profile.rating} color={accentColor} />
          <Text style={styles.ratingText}>{profile.rating.toFixed(1)}</Text>
          <Text style={styles.ratingMeta}>({profile.reviewCount})</Text>
          {profile.responseTime ? (
            <Text style={styles.ratingMeta}>⚡ {profile.responseTime}</Text>
          ) : null}
        </View>

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
      {tabOrder.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => {
              if (tab !== activeTab) setBookingFlowActive(false);
              setActiveTab(tab);
            }}
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
    if (posts.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="camera" size={26} color={COLORS.grayLight} />
          <Text style={styles.emptyTitle}>Share your best work</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.mediaGrid}>
          {posts.map((post) => {
            const cellHeight = postCellWidth;
            return (
              <Pressable
                key={post.id}
                style={[
                  styles.mediaCell,
                  { width: postCellWidth, height: cellHeight },
                ]}
                onPress={() => {
                  navigation.navigate("PostDetail", {
                    userId: post.authorUserId || profile?.userId || profile?.id || vendorId,
                    initialPostId: post.id,
                  });
                }}
              >
                {post.mediaUrl ? (
                  <Image
                    source={{ uri: post.mediaUrl }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[COLORS.gray, COLORS.black]}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                {post.mediaType === "video" ? (
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>▶</Text>
                  </View>
                ) : null}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.78)"]}
                  style={styles.mediaOverlay}
                >
                  <Text numberOfLines={1} style={styles.mediaLabel}>
                    {post.label}
                  </Text>
                  <Text style={styles.mediaLikes}>♥ {post.likes}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
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
                    colors={["#2a2a2a", "#111111"]}
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
                <View
                  style={[
                    styles.productAddButton,
                    { borderColor: accentColor },
                  ]}
                >
                  <Text style={[styles.productAddText, { color: accentColor }]}>
                    Add
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const renderBookingTab = () => {
    if (bookingFlowActive) {
      return (
        <BookingFlow
          providerId={vendorId}
          providerType="business"
          providerName={profile?.name || ""}
          providerAddress={profile?.address}
          providerCity={profile?.city}
          providerState={profile?.state}
          providerShowAddress={profile?.showAddress}
          staffMemberId={selectedStaffId}
          accentColor={accentColor}
        />
      );
    }

    const hasServices = services.length > 0;
    const showTeam = Boolean(profile?.isMultiStaff);

    // Plain empty state: no services and not multi-staff (unchanged pre-fix path)
    if (!hasServices && !showTeam) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No services listed yet</Text>
          </View>
        </View>
      );
    }

    const sectionLabelStyle = {
      color: "rgba(255,255,255,0.5)" as const,
      fontSize: 11,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      paddingHorizontal: 4,
    };

    return (
      <View style={styles.tabContent}>
        {/* ── SERVICE LIST: renders unconditionally whenever services exist ── */}
        {hasServices && (
          <>
            <Text style={[sectionLabelStyle, { marginBottom: 12 }]}>
              Select a Service
            </Text>
            {services.map((service) => (
              <Pressable
                key={service.id}
                onPress={() => {
                  setSelectedStaffId(null);
                  setBookingFlowActive(true);
                }}
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
          </>
        )}

        {/* ── TEAM SECTION: additive below service list when isMultiStaff ── */}
        {showTeam && (
          <>
            {/* Section divider (with horizontal rules) when services are above;
                plain label when the team section is the only content */}
            {hasServices ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 24,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    marginRight: 8,
                  }}
                />
                <Text style={sectionLabelStyle}>Select a Team Member</Text>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    marginLeft: 8,
                  }}
                />
              </View>
            ) : (
              <Text style={[sectionLabelStyle, { marginBottom: 12 }]}>
                Select a Team Member
              </Text>
            )}

            {staff.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  No team members available to book yet
                </Text>
              </View>
            ) : (
              <StaffCardList
                staff={staff}
                accentColor={accentColor}
                selectedStaffId={selectedStaffId}
                onSelect={setSelectedStaffId}
                onViewProfile={(staffId) => {
                  navigation.navigate("StaffWorkProfile", {
                    businessId: vendorId,
                    staffId,
                  });
                }}
                onBook={(staffId) => {
                  setSelectedStaffId(staffId);
                  setBookingFlowActive(true);
                }}
              />
            )}
          </>
        )}
      </View>
    );
  };

  const renderAvailabilityTab = () => {
    const slotsByDay = DAY_LABELS.map((_, dayOfWeek) =>
      availability.find(
        (slot) => slot.dayOfWeek === dayOfWeek && slot.isActive !== false,
      ),
    );
    return (
      <View style={styles.tabContent}>
        <View style={styles.calendarGrid}>
          {DAY_LABELS.map((label, index) => {
            const slot = slotsByDay[index];
            const isAvailable = Boolean(slot);
            return (
              <View key={label} style={styles.calendarCard}>
                <Text style={styles.calendarDay}>{label}</Text>
                <Text style={styles.calendarHours}>
                  {isAvailable
                    ? `${slot?.startTime} - ${slot?.endTime}`
                    : "Unavailable"}
                </Text>
                {isAvailable ? (
                  <Pressable
                    style={[styles.slotButton, { borderColor: accentColor }]}
                    onPress={() => setBookingFlowActive(true)}
                  >
                    <Text
                      style={[styles.slotButtonText, { color: accentColor }]}
                    >
                      Book a Slot
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSavedTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.emptyState}>
        <Feather name="bookmark" size={24} color={COLORS.grayLight} />
        <Text style={styles.emptyTitle}>No saved items yet</Text>
      </View>
    </View>
  );

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

      <Pressable
        style={[styles.leaveReviewButton, { borderColor: accentColor }]}
        onPress={openReviewModal}
      >
        <Text style={[styles.leaveReviewButtonText, { color: accentColor }]}>
          ✍️ Leave a Review
        </Text>
      </Pressable>

      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
        </View>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                {review.avatarUrl ? (
                  <Image
                    source={{ uri: review.avatarUrl }}
                    style={styles.reviewAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.reviewAvatarInitial}>
                    {getInitials(review.userName)}
                  </Text>
                )}
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

  const renderAboutTab = () => {
    if (!profile) return null;
    return (
      <View style={styles.tabContent}>
        {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
        {profile?.hasPhysicalLocation !== false ? (
          <View style={styles.aboutRow}>
            <Feather name="map-pin" size={14} color={accentColor} />
            <Text style={styles.aboutLabel}>Location</Text>
            <Text style={styles.aboutValue}>
              {profile?.showAddress !== false && profile?.address
                ? [profile.address, profile.location].filter(Boolean).join(", ")
                : profile.location || "Not listed"}
            </Text>
          </View>
        ) : null}
        <View style={styles.aboutRow}>
          <Feather name="grid" size={14} color={accentColor} />
          <Text style={styles.aboutLabel}>Category</Text>
          <Text style={styles.aboutValue}>
            {profile.specialties[0] || "Not listed"}
          </Text>
        </View>
        {profile?.showEmail !== false ? (
          <View style={styles.aboutRow}>
            <Feather name="mail" size={14} color={accentColor} />
            <Text style={styles.aboutLabel}>Email</Text>
            <Text style={styles.aboutValue}>
              {profile.contactEmail || "Not listed"}
            </Text>
          </View>
        ) : null}
        {profile?.showPhone !== false ? (
          <View style={styles.aboutRow}>
            <Feather name="phone" size={14} color={accentColor} />
            <Text style={styles.aboutLabel}>Phone</Text>
            <Text style={styles.aboutValue}>
              {profile.contactPhone || "Not listed"}
            </Text>
          </View>
        ) : null}
        {profile?.showWebsite !== false ? (
          <View style={styles.aboutRow}>
            <Feather name="globe" size={14} color={accentColor} />
            <Text style={styles.aboutLabel}>Website</Text>
            <Text style={styles.aboutValue}>
              {profile.websiteUrl || "Not listed"}
            </Text>
          </View>
        ) : null}
        {profile?.role === "business" && profile.showStoreHours !== false ? (() => {
          const hoursObj =
            profile.hoursOfOperation &&
            typeof profile.hoursOfOperation === "object"
              ? profile.hoursOfOperation
              : null;
          const dayRows = hoursObj
            ? hoursObjectToArray(hoursObj as Parameters<typeof hoursObjectToArray>[0])
            : [];
          return (
            <View style={styles.aboutRow}>
              <Feather name="clock" size={14} color={accentColor} />
              <Text style={styles.aboutLabel}>Store Hours</Text>
              {dayRows.length > 0 ? (
                <View style={styles.hoursGrid}>
                  {dayRows.map((day) => (
                    <View key={day.dayOfWeek} style={styles.hoursRow}>
                      <Text style={styles.hoursDayLabel}>
                        {DAY_LABELS[day.dayOfWeek]}
                      </Text>
                      <Text style={styles.hoursValue}>
                        {day.isAvailable
                          ? `${day.startTime} – ${day.endTime}`
                          : "Closed"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.aboutValue}>Not listed</Text>
              )}
            </View>
          );
        })() : null}
        {profile?.showResponseTime !== false && profile?.responseTime ? (
          <View style={styles.aboutRow}>
            <Feather name="zap" size={14} color={accentColor} />
            <Text style={styles.aboutLabel}>Response Time</Text>
            <Text style={styles.aboutValue}>{profile.responseTime}</Text>
          </View>
        ) : null}
        {/* Availability row: hidden for business when real store hours are shown */}
        {profile?.role !== "business" ? (
          <View style={styles.aboutRow}>
            <Feather name="calendar" size={14} color={accentColor} />
            <Text style={styles.aboutLabel}>Availability</Text>
            <Text style={styles.aboutValue}>
              {profile.availabilitySummary || "Available"}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

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

  if (loading || !profile) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showStickyBottom = !isOwnProfile && profile.role !== "consumer";
  const primaryAction = resolvePrimaryAction();
  const minLabel =
    profile.minPrice != null
      ? `Starting from ${formatMoney(profile.minPrice)}`
      : "";
  const selectedStaffMember = profile.isMultiStaff
    ? staff.find((member) => member.id === selectedStaffId)
    : undefined;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]}>
      {renderFloatingHeader()}
      <Animated.ScrollView
        style={[styles.scrollView, { backgroundColor: pageBg }]}
        contentContainerStyle={{
          paddingBottom: showStickyBottom
            ? insets.bottom + 112
            : insets.bottom + 28,
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

      {showStickyBottom ? (
        <View
          style={[styles.stickyWrap, { paddingBottom: insets.bottom + 12 }]}
        >
          <LinearGradient
            colors={["transparent", COLORS.black]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.stickyInner}>
            {selectedStaffMember ? (
              <View style={styles.minPriceWrap}>
                <Text style={styles.minPriceText}>
                  With {selectedStaffMember.displayName}
                </Text>
              </View>
            ) : minLabel ? (
              <View style={styles.minPriceWrap}>
                <Text style={styles.minPriceText}>{minLabel}</Text>
              </View>
            ) : null}
            <Pressable
              style={[styles.stickyButton, { backgroundColor: accentColor }]}
              onPress={primaryAction.onPress}
            >
              <Text style={styles.stickyButtonText}>{primaryAction.label}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <BottomSheet
        index={reviewSheetIndex}
        snapPoints={reviewSnapPoints}
        onChange={setReviewSheetIndex}
        enablePanDownToClose
        animateOnMount={false}
        backgroundStyle={{ backgroundColor: "#111111" }}
        handleIndicatorStyle={{ backgroundColor: COLORS.gray }}
      >
        <BottomSheetView style={styles.sheetBody}>
          <Text style={styles.sheetTitle}>Rate {profile.name}</Text>
          <View style={styles.largeStars}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Pressable
                key={`rating-${index}`}
                onPress={() => setReviewRating(index + 1)}
              >
                <Feather
                  name="star"
                  size={36}
                  color={index < reviewRating ? accentColor : COLORS.grayMid}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            style={styles.reviewInput}
            placeholder="Share your experience..."
            placeholderTextColor={COLORS.grayLight}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[
              styles.submitReviewButton,
              { backgroundColor: accentColor },
            ]}
            onPress={handleSubmitReview}
          >
            <Text style={styles.submitReviewText}>Submit Review</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
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
  },
  loadingText: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: "600",
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
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  processingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
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
  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 4,
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
  actionButton: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionButton: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
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
  taglineText: {
    color: COLORS.cream,
    fontSize: 14,
    fontStyle: "italic",
    fontWeight: "500",
    marginTop: 4,
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
  emptyState: {
    paddingVertical: 26,
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
  productAddButton: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
    backgroundColor: "transparent",
  },
  productAddText: {
    fontSize: 11,
    fontWeight: "800",
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
  cardCta: {
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  cardCtaText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: "800",
  },
  serviceCard: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
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
  slotButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  slotButtonText: {
    fontSize: 12,
    fontWeight: "700",
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
  leaveReviewButton: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 12,
  },
  leaveReviewButtonText: {
    fontSize: 13,
    fontWeight: "700",
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
    overflow: "hidden",
    backgroundColor: COLORS.grayMid,
    marginRight: 8,
  },
  reviewAvatarImage: {
    width: "100%",
    height: "100%",
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
  hoursGrid: {
    flex: 1,
    marginLeft: 4,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  hoursDayLabel: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "600",
    width: 32,
  },
  hoursValue: {
    color: COLORS.cream,
    fontSize: 12,
    textAlign: "right",
    flex: 1,
  },
  stickyWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
  },
  stickyInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  minPriceWrap: {
    flex: 1,
  },
  minPriceText: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "700",
  },
  stickyButton: {
    flex: 2,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  stickyButtonText: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: "900",
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  sheetTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  sheetSubtitle: {
    color: COLORS.grayLight,
    fontSize: 12,
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetRowText: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: "500",
  },
  sheetCta: {
    marginTop: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  sheetCtaText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: "800",
  },
  largeStars: {
    marginTop: 8,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewInput: {
    minHeight: 110,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  submitReviewButton: {
    marginTop: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  submitReviewText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: "800",
  },
});

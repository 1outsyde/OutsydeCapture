// ─── OUTSYDE — VENDOR PROFILE SCREEN (REDESIGNED) ────────────────
// Frontend only. Expo / React Native.
// Backend: unchanged. API contract: unchanged.
// TODO: Wire follow/unfollow to API endpoint
// TODO: Wire subscribe to vendor subscription API endpoint
// TODO: Wire like/save on posts to API endpoints
// TODO: Wire "Continue to Booking" to existing booking flow screen
// TODO: Wire review submission to POST /reviews endpoint
// ──────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Video, ResizeMode } from "expo-av";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import api, { VendorProduct, VendorService } from "@/services/api";
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

type Props = NativeStackScreenProps<RootStackParamList, "VendorDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileTab = "posts" | "shop" | "reviews" | "about";
type PostItem = {
  id: string;
  title: string;
  type: "image" | "video";
  mediaUrl?: string;
  likes?: number;
  comments?: number;
  category?: string;
};
type ReviewItem = {
  id: string;
  userName: string;
  avatarUrl?: string;
  rating: number;
  text: string;
  createdAt: string;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function VendorDetailScreen({ route }: Props) {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const { vendorId } = route.params;

  const [vendor, setVendor] = useState<any | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [services, setServices] = useState<VendorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const [savedProductIds, setSavedProductIds] = useState<Record<string, boolean>>({});
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const [bookingSheetIndex, setBookingSheetIndex] = useState(-1);
  const [reviewSheetIndex, setReviewSheetIndex] = useState(-1);

  const scrollY = useRef(new Animated.Value(0)).current;
  const bookingSnapPoints = useMemo(() => ["50%"], []);
  const reviewSnapPoints = useMemo(() => ["45%"], []);

  useEffect(() => {
    loadVendor();
    loadProducts();
    loadServices();
  }, [vendorId]);

  const loadVendor = async () => {
    try {
      const data = await api.getBusiness(vendorId);
      setVendor(data);
    } catch (err) {
      console.error("Failed to load vendor:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await api.getBusinessPublicProducts(vendorId);
      const liveProducts = (data.products || []).filter((p) => p.status === "live");
      setProducts(liveProducts);
    } catch (err) {
      console.error("Failed to load products:", err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const data = await api.getBusinessPublicServices(vendorId);
      const liveServices = (data.services || []).filter((s) => s.status === "live");
      setServices(liveServices);
    } catch (err) {
      console.error("Failed to load services:", err);
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const normalizedVendor = useMemo(() => {
    const coverMediaUrl = vendor?.coverMediaUrl ?? vendor?.coverImage ?? null;
    const inferredCoverType =
      vendor?.coverMediaType ||
      (typeof coverMediaUrl === "string" &&
      /\.(mp4|mov|m4v|webm)$/i.test(coverMediaUrl)
        ? "video"
        : coverMediaUrl
          ? "image"
          : null);
    const subscriptionTierRaw = String(
      vendor?.subscriptionTier ?? vendor?.tier ?? "Starter"
    ).toLowerCase();
    const subscriptionTier = subscriptionTierRaw.includes("pro")
      ? "Pro"
      : subscriptionTierRaw.includes("growth") || subscriptionTierRaw.includes("premium")
        ? "Growth"
        : "Starter";

    const minServicePrice = services.length
      ? Math.min(...services.map((s) => (typeof s.priceCents === "number" ? s.priceCents / 100 : 0)))
      : null;

    return {
      id: String(vendor?.id ?? vendorId),
      name: vendor?.name ?? "Vendor",
      handle: vendor?.handle ?? vendor?.username ? `@${vendor?.username ?? vendor?.handle}` : "@vendor",
      location:
        [vendor?.city, vendor?.state].filter(Boolean).join(", ") || "Location not set",
      category: vendor?.category ?? "Business",
      tagline: vendor?.tagline ?? "Curated outdoor and lifestyle experiences.",
      bio: vendor?.description ?? vendor?.bio ?? "",
      avatarUrl: vendor?.avatarUrl ?? vendor?.avatar ?? null,
      coverMediaUrl,
      coverMediaType: inferredCoverType,
      rating: Number(vendor?.rating ?? 0),
      reviewCount: Number(vendor?.reviewCount ?? 0),
      followerCount: Number(vendor?.followerCount ?? 0),
      followingCount: Number(vendor?.followingCount ?? 0),
      bookingCount: Number(vendor?.bookingCount ?? 0),
      isVerified: Boolean(vendor?.isVerified),
      subscriptionTier,
      brandColors:
        subscriptionTier === "Pro" && vendor?.brandColors
          ? vendor.brandColors
          : null,
      availability: vendor?.availability ?? "Available Now",
      responseTime: vendor?.responseTime ?? "Usually responds in 2h",
      posts: Array.isArray(vendor?.posts) ? vendor.posts : [],
      products,
      reviews: Array.isArray(vendor?.reviews) ? vendor.reviews : [],
      minPrice: vendor?.minPrice ?? minServicePrice,
    };
  }, [vendor, services, vendorId, products]);

  const isOwnProfile =
    user?.id && (String(user.id) === String(vendor?.id) || String(user.id) === String(vendor?.userId));
  const isAdminView = String((user as any)?.role || "").toLowerCase() === "admin";

  const brandPrimary = normalizedVendor.brandColors?.primary ?? COLORS.gold;
  const brandAccent = normalizedVendor.brandColors?.accent ?? COLORS.goldDim;

  const postsData: PostItem[] = useMemo(() => {
    if (normalizedVendor.posts.length > 0) {
      return normalizedVendor.posts.map((p: any, idx: number) => ({
        id: String(p.id ?? `post-${idx}`),
        title: p.title ?? p.caption ?? "Behind the scenes",
        type: p.type === "video" ? "video" : "image",
        mediaUrl: p.mediaUrl ?? p.imageUrl ?? normalizedVendor.coverMediaUrl ?? undefined,
        likes: Number(p.likes ?? p.likeCount ?? 0),
        comments: Number(p.comments ?? p.commentCount ?? 0),
        category: p.category ?? normalizedVendor.category,
      }));
    }
    return [
      {
        id: "default-1",
        title: "Signature edits from our latest outdoor campaign",
        type: normalizedVendor.coverMediaType === "video" ? "video" : "image",
        mediaUrl: normalizedVendor.coverMediaUrl ?? undefined,
        likes: 112,
        comments: 24,
        category: normalizedVendor.category,
      },
    ];
  }, [normalizedVendor]);

  const reviewsData: ReviewItem[] = useMemo(() => {
    if (normalizedVendor.reviews.length > 0) {
      return normalizedVendor.reviews.map((r: any, idx: number) => ({
        id: String(r.id ?? `review-${idx}`),
        userName: r.userName ?? r.authorName ?? "Outsyde User",
        avatarUrl: r.avatarUrl ?? r.authorAvatar ?? undefined,
        rating: Number(r.rating ?? 5),
        text: r.text ?? r.comment ?? "",
        createdAt: r.createdAt ?? r.date ?? new Date().toISOString(),
      }));
    }
    return [];
  }, [normalizedVendor.reviews]);

  const ratingBreakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviewsData.forEach((r) => {
      const clamped = Math.max(1, Math.min(5, Math.round(r.rating)));
      counts[5 - clamped] += 1;
    });
    const total = reviewsData.length || 1;
    return counts.map((count, idx) => ({ stars: 5 - idx, ratio: count / total, count }));
  }, [reviewsData]);

  const mediaCellWidth = (SCREEN_WIDTH - 40 - 8) / 3;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [120, 220],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [170, 240],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const openBookingSheet = () => {
    setReviewSheetIndex(-1);
    setBookingSheetIndex(0);
  };
  const openReviewSheet = () => {
    setBookingSheetIndex(-1);
    setReviewSheetIndex(0);
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${normalizedVendor.name} on Outsyde`,
      });
    } catch (error) {
      console.warn("Share failed:", error);
    }
  };

  const toggleLikePost = (postId: string) => {
    setLikedPostIds((prev) => ({ ...prev, [postId]: !prev[postId] }));
    // TODO: Wire like/save on posts to API endpoints
  };

  const toggleSaveProduct = (productId: string) => {
    setSavedProductIds((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleSubmitReview = () => {
    // TODO: Wire review submission to POST /reviews endpoint
    console.log("Review submit draft:", {
      vendorId: normalizedVendor.id,
      rating: reviewRating,
      text: reviewText,
    });
    setReviewText("");
    setReviewRating(0);
    setReviewSheetIndex(-1);
    Alert.alert("Thanks!", "Your review draft was captured.");
  };

  const renderFloatingHeader = () => (
    <Animated.View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: headerBgOpacity }]}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.floatingHeaderBg} />
      </Animated.View>
      <View style={styles.floatingHeaderRow}>
        <Pressable style={styles.headerIconButton} onPress={() => navigation.goBack()}>
          <Feather name="menu" size={18} color={COLORS.white} />
        </Pressable>
        <Animated.Text style={[styles.floatingHeaderTitle, { opacity: headerTitleOpacity }]}>
          {normalizedVendor.name}
        </Animated.Text>
        <View style={styles.headerRightActions}>
          <Pressable style={styles.headerIconButton}>
            <Feather name="bell" size={18} color={COLORS.white} />
          </Pressable>
          <Pressable style={styles.headerIconButton} onPress={handleShareProfile}>
            <Feather name="share-2" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  const renderCoverMediaHero = () => {
    const showVideo =
      normalizedVendor.coverMediaUrl && normalizedVendor.coverMediaType === "video";
    const showImage =
      normalizedVendor.coverMediaUrl && normalizedVendor.coverMediaType === "image";

    return (
      <View style={styles.coverHero}>
        {showVideo ? (
          <Video
            source={{ uri: normalizedVendor.coverMediaUrl as string }}
            shouldPlay
            isLooping
            isMuted
            resizeMode={ResizeMode.COVER}
            style={styles.coverMedia}
          />
        ) : showImage ? (
          <Animated.Image
            source={{ uri: normalizedVendor.coverMediaUrl as string }}
            style={styles.coverMedia}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={
              normalizedVendor.subscriptionTier === "Pro" && normalizedVendor.brandColors
                ? [brandPrimary, brandAccent, COLORS.black]
                : ["#1a1a1a", "#2d2410", "#0a0a0a"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverMedia}
          />
        )}

        <LinearGradient
          colors={["rgba(232,185,48,0.12)", "transparent"]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.coverGlow}
        />
        <LinearGradient
          colors={["transparent", COLORS.black]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.coverBottomFade}
        />

        {normalizedVendor.coverMediaType === "video" ? (
          <View style={styles.heroPlayBadge}>
            <Feather name="play" size={18} color={COLORS.white} />
          </View>
        ) : null}

        {isOwnProfile ? (
          <View style={styles.addCoverHint}>
            <Feather name="upload" size={12} color={COLORS.white} />
            <Text style={styles.addCoverHintText}>Add cover media</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderProfileIdentityBlock = () => (
    <View style={styles.identityWrap}>
      <View style={styles.avatarActionRow}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarOuterRing}>
            <View style={styles.avatarInnerRing}>
              {normalizedVendor.avatarUrl ? (
                <Animated.Image
                  source={{ uri: normalizedVendor.avatarUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Feather name="user" size={28} color={COLORS.cream} />
                </View>
              )}
            </View>
          </View>
          <View style={styles.onlineDot} />
        </View>

        {!isAdminView ? (
          <View style={styles.profileActionButtons}>
            <Pressable
              style={[styles.followButton, isFollowing && styles.followButtonActive]}
              onPress={() => {
                setIsFollowing((prev) => !prev);
                // TODO: Wire follow/unfollow to API endpoint
              }}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
                {isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>

            <Pressable style={styles.bookButton} onPress={openBookingSheet}>
              <Text style={styles.bookButtonText}>Book</Text>
            </Pressable>

            <Pressable
              style={styles.messageIconButton}
              onPress={() => Alert.alert("Message", "Messaging flow will be wired here.")}
            >
              <Feather name="message-circle" size={16} color={COLORS.white} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.vendorName}>{normalizedVendor.name}</Text>
        {normalizedVendor.isVerified ? (
          <View style={styles.verifiedBadge}>
            <Feather name="check" size={12} color={COLORS.white} />
          </View>
        ) : null}
        <View
          style={[
            styles.tierPill,
            normalizedVendor.subscriptionTier === "Pro"
              ? styles.proTierPill
              : normalizedVendor.subscriptionTier === "Growth"
                ? styles.growthTierPill
                : styles.starterTierPill,
          ]}
        >
          <Text style={styles.tierPillText}>{normalizedVendor.subscriptionTier}</Text>
        </View>
      </View>

      <Text style={styles.handleLocationText}>
        {normalizedVendor.handle} · {normalizedVendor.location}
      </Text>

      <View style={styles.metaBadgeRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{normalizedVendor.category}</Text>
        </View>
        {normalizedVendor.availability.toLowerCase().includes("available") ? (
          <View style={styles.availableBadge}>
            <Text style={styles.availableBadgeText}>{normalizedVendor.availability}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.taglineText}>{normalizedVendor.tagline}</Text>

      <View style={styles.ratingRow}>
        <View style={styles.starRow}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <Feather
              key={`star-${idx}`}
              name="star"
              size={14}
              color={idx < Math.round(normalizedVendor.rating) ? COLORS.gold : COLORS.grayMid}
            />
          ))}
        </View>
        <Text style={styles.ratingText}>{normalizedVendor.rating.toFixed(1)}</Text>
        <Text style={styles.reviewCountText}>({normalizedVendor.reviewCount})</Text>
        <Text style={styles.responseTimeText}>⚡ {normalizedVendor.responseTime}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{normalizedVendor.followerCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{normalizedVendor.bookingCount}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{normalizedVendor.followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
      </View>

      {!isAdminView ? (
        <Pressable
          style={styles.subscribeButtonWrap}
          onPress={() => {
            setIsSubscribed((prev) => !prev);
            // TODO: Wire subscribe to vendor subscription API endpoint
          }}
        >
          {isSubscribed ? (
            <View style={styles.subscribedButton}>
              <Text style={styles.subscribedButtonText}>
                ✓ Subscribed — Exclusive Access Unlocked
              </Text>
            </View>
          ) : (
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscribeButton}
            >
              <Text style={styles.subscribeButtonText}>
                ⭐ Subscribe for Exclusive Drops & Deals
              </Text>
            </LinearGradient>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  const renderStickyTabBar = () => (
    <View style={styles.tabBarContainer}>
      {(["posts", "shop", "reviews", "about"] as ProfileTab[]).map((tab) => (
        <Pressable key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
          <View style={[styles.tabUnderline, activeTab === tab && styles.tabUnderlineActive]} />
        </Pressable>
      ))}
    </View>
  );

  const renderPostsTab = () => {
    const featured = postsData[0];
    const gridItems = postsData.slice(1);

    return (
      <View style={styles.tabSectionWrap}>
        <View style={styles.featuredPostCard}>
          {featured?.mediaUrl ? (
            <Animated.Image source={{ uri: featured.mediaUrl }} style={styles.featuredPostMedia} resizeMode="cover" />
          ) : (
            <LinearGradient colors={[brandPrimary, COLORS.black]} style={styles.featuredPostMedia} />
          )}
          {featured?.type === "video" ? (
            <View style={styles.featuredPlayBadge}>
              <Feather name="play" size={16} color={COLORS.white} />
            </View>
          ) : null}
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.featuredPostOverlay}>
            <View style={styles.featuredCategoryBadge}>
              <Text style={styles.featuredCategoryText}>{featured?.category || normalizedVendor.category}</Text>
            </View>
            <Text style={styles.featuredTitle}>{featured?.title || "Featured Story"}</Text>
            <View style={styles.featuredEngagementRow}>
              <Text style={styles.featuredEngagement}>❤️ {featured?.likes ?? 0}</Text>
              <Text style={styles.featuredEngagement}>💬 {featured?.comments ?? 0}</Text>
              <Text style={styles.featuredEngagement}>📤 Share</Text>
              <Text style={styles.featuredEngagement}>🔖 Save</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.mediaGrid}>
          {gridItems.map((post, idx) => {
            const isPortrait = idx % 3 === 0;
            const cellHeight = isPortrait ? mediaCellWidth * 1.33 : mediaCellWidth;
            return (
              <Pressable key={post.id} style={[styles.mediaCell, { width: mediaCellWidth, height: cellHeight }]}>
                {post.mediaUrl ? (
                  <Animated.Image source={{ uri: post.mediaUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={[COLORS.gray, COLORS.black]} style={StyleSheet.absoluteFillObject} />
                )}
                {post.type === "video" ? (
                  <View style={styles.mediaVideoBadge}>
                    <Feather name="play" size={10} color={COLORS.white} />
                  </View>
                ) : null}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.mediaCellOverlay}>
                  <Text style={styles.mediaCellLabel} numberOfLines={1}>
                    {post.title}
                  </Text>
                  <Pressable onPress={() => toggleLikePost(post.id)}>
                    <Text style={styles.mediaCellLikes}>
                      {likedPostIds[post.id] ? "❤️" : "🤍"} {post.likes ?? 0}
                    </Text>
                  </Pressable>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderShopTab = () => (
    <View style={styles.tabSectionWrap}>
      <LinearGradient colors={["#1f1f1f", "#0f0f0f"]} style={styles.shopCollectionCard}>
        <View style={styles.shopCollectionGlow} />
        <View style={styles.featuredCategoryBadge}>
          <Text style={styles.featuredCategoryText}>{normalizedVendor.category}</Text>
        </View>
        <Text style={styles.shopCollectionTitle}>Signature Collection</Text>
        <Text style={styles.shopCollectionSubtitle}>
          {products.length} pieces · Starting from{" "}
          {products.length > 0 ? `$${(products[0].priceCents / 100).toFixed(2)}` : "$0.00"}
        </Text>
        <Pressable style={styles.shopAllButton}>
          <Text style={styles.shopAllButtonText}>Shop All →</Text>
        </Pressable>
      </LinearGradient>

      {productsLoading ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyBlockText}>Loading products...</Text>
        </View>
      ) : (
        <View style={styles.productGrid}>
          {products.map((product: any, idx) => (
            <View key={product.id ?? `product-${idx}`} style={styles.productCard}>
              <View style={styles.productImageZone}>
                {product.imageUrl ? (
                  <Animated.Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={[COLORS.grayMid, COLORS.black]} style={StyleSheet.absoluteFillObject} />
                )}
                <View style={styles.productTagBadge}>
                  <Text style={styles.productTagText}>
                    {idx % 3 === 0 ? "New" : idx % 3 === 1 ? "Best Seller" : "Low Stock"}
                  </Text>
                </View>
                <Pressable
                  style={styles.productSaveButton}
                  onPress={() => toggleSaveProduct(String(product.id))}
                >
                  <Feather
                    name={savedProductIds[String(product.id)] ? "heart" : "heart"}
                    size={14}
                    color={savedProductIds[String(product.id)] ? COLORS.gold : COLORS.white}
                  />
                </Pressable>
              </View>
              <View style={styles.productInfoZone}>
                <Text style={styles.productNameText} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.productPriceText}>${(product.priceCents / 100).toFixed(2)}</Text>
                <View style={styles.productButtonRow}>
                  <Pressable style={styles.smallAddButton}>
                    <Text style={styles.smallAddButtonText}>Add</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderReviewsTab = () => (
    <View style={styles.tabSectionWrap}>
      <View style={styles.reviewSummaryCard}>
        <View style={styles.reviewSummaryLeft}>
          <Text style={styles.reviewSummaryRating}>{normalizedVendor.rating.toFixed(1)}</Text>
          <View style={styles.starRow}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Feather
                key={`summary-star-${idx}`}
                name="star"
                size={14}
                color={idx < Math.round(normalizedVendor.rating) ? COLORS.gold : COLORS.grayMid}
              />
            ))}
          </View>
          <Text style={styles.reviewSummaryCount}>{normalizedVendor.reviewCount} reviews</Text>
        </View>
        <View style={styles.reviewSummaryRight}>
          {ratingBreakdown.map((item) => (
            <View key={`ratio-${item.stars}`} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.stars}</Text>
              <View style={styles.breakdownTrack}>
                <View style={[styles.breakdownFill, { width: `${item.ratio * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {!isAdminView ? (
        <Pressable style={styles.leaveReviewButton} onPress={openReviewSheet}>
          <Text style={styles.leaveReviewButtonText}>Leave a Review</Text>
        </Pressable>
      ) : null}

      {reviewsData.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyBlockText}>No reviews yet.</Text>
        </View>
      ) : (
        reviewsData.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                {review.avatarUrl ? (
                  <Animated.Image source={{ uri: review.avatarUrl }} style={styles.reviewAvatarImg} resizeMode="cover" />
                ) : (
                  <Feather name="user" size={12} color={COLORS.white} />
                )}
              </View>
              <View style={styles.reviewMeta}>
                <Text style={styles.reviewUserName}>{review.userName}</Text>
                <Text style={styles.reviewMetaText}>
                  {"★".repeat(Math.max(1, Math.min(5, Math.round(review.rating))))} ·{" "}
                  {new Date(review.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <Text style={styles.reviewBody}>{review.text || "Great experience!"}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderAboutTab = () => {
    const aboutRows = [
      { icon: "map-pin", label: "Location", value: normalizedVendor.location },
      { icon: "tag", label: "Category", value: normalizedVendor.category },
      { icon: "zap", label: "Response Time", value: normalizedVendor.responseTime },
      { icon: "clock", label: "Availability", value: normalizedVendor.availability },
      { icon: "check-circle", label: "Verified", value: normalizedVendor.isVerified ? "Verified" : "Not Verified" },
      { icon: "award", label: "Subscription Tier", value: normalizedVendor.subscriptionTier },
    ];
    return (
      <View style={styles.tabSectionWrap}>
        {aboutRows.map((row) => (
          <View key={row.label} style={styles.aboutRow}>
            <Feather name={row.icon as any} size={14} color={COLORS.gold} />
            <Text style={styles.aboutLabel}>{row.label}</Text>
            <Text style={styles.aboutValue}>{row.value}</Text>
          </View>
        ))}
        {!isAdminView ? (
          <View style={styles.aboutActionRow}>
            <Pressable style={styles.aboutMessageButton}>
              <Text style={styles.aboutMessageButtonText}>💬 Message</Text>
            </Pressable>
            <Pressable style={styles.aboutReportButton}>
              <Text style={styles.aboutReportButtonText}>🚩 Report</Text>
            </Pressable>
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
      case "reviews":
        return renderReviewsTab();
      case "about":
        return renderAboutTab();
      default:
        return null;
    }
  };

  const stickyMinPrice = normalizedVendor.minPrice;
  const showBookingBar = !isAdminView;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerLoader}>
          <Text style={styles.loadingText}>Loading vendor profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderFloatingHeader()}

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: showBookingBar ? insets.bottom + 110 : insets.bottom + 24 }}
        stickyHeaderIndices={[2]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {renderCoverMediaHero()}
        {renderProfileIdentityBlock()}
        {renderStickyTabBar()}
        {renderTabContent()}
      </Animated.ScrollView>

      {showBookingBar ? (
        <View style={[styles.stickyBookingWrap, { paddingBottom: insets.bottom + 12 }]}>
          <LinearGradient colors={["transparent", COLORS.black]} style={StyleSheet.absoluteFillObject} />
          <View style={styles.stickyBookingInner}>
            {stickyMinPrice != null ? (
              <View style={styles.minPriceBlock}>
                <Text style={styles.minPriceLabel}>Starting from</Text>
                <Text style={styles.minPriceValue}>${Number(stickyMinPrice).toFixed(2)}</Text>
              </View>
            ) : null}
            <Pressable style={styles.bookNowWrap} onPress={openBookingSheet}>
              <LinearGradient colors={[COLORS.gold, COLORS.goldDim]} style={styles.bookNowButton}>
                <Text style={styles.bookNowButtonText}>Book Now →</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      ) : null}

      <BottomSheet
        index={bookingSheetIndex}
        snapPoints={bookingSnapPoints}
        onChange={setBookingSheetIndex}
        enablePanDownToClose
        animateOnMount={false}
        backgroundStyle={{ backgroundColor: "#111111" }}
        handleIndicatorStyle={{ backgroundColor: COLORS.gray }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Book with {normalizedVendor.name}</Text>
          <Text style={styles.sheetSubtitle}>⚡ {normalizedVendor.responseTime}</Text>
          {[
            "Custom Shoot / Styling",
            "In-Store Experience",
            "Virtual Consultation",
            "Brand Campaign",
          ].map((option) => (
            <Pressable key={option} style={styles.sheetOptionRow}>
              <Text style={styles.sheetOptionText}>{option}</Text>
              <Feather name="chevron-right" size={16} color={COLORS.grayLight} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              // TODO: Wire "Continue to Booking" to existing booking flow screen
              setBookingSheetIndex(-1);
              navigation.navigate("CartOrders");
            }}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDim]} style={styles.sheetCtaButton}>
              <Text style={styles.sheetCtaText}>Continue to Booking</Text>
            </LinearGradient>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>

      <BottomSheet
        index={reviewSheetIndex}
        snapPoints={reviewSnapPoints}
        onChange={setReviewSheetIndex}
        enablePanDownToClose
        animateOnMount={false}
        backgroundStyle={{ backgroundColor: "#111111" }}
        handleIndicatorStyle={{ backgroundColor: COLORS.gray }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Rate {normalizedVendor.name}</Text>
          <View style={styles.largeStarRow}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Pressable key={`rate-${idx}`} onPress={() => setReviewRating(idx + 1)}>
                <Feather
                  name="star"
                  size={36}
                  color={idx < reviewRating ? COLORS.gold : COLORS.grayMid}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="Share your experience..."
            placeholderTextColor={COLORS.grayLight}
            multiline
            maxLength={500}
            value={reviewText}
            onChangeText={setReviewText}
          />
          <Pressable onPress={handleSubmitReview}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDim]} style={styles.sheetCtaButton}>
              <Text style={styles.sheetCtaText}>Submit Review</Text>
            </LinearGradient>
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
  centerLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: "500",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 16,
  },
  floatingHeaderBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.95)",
  },
  floatingHeaderRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 2,
  },
  floatingHeaderTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
    maxWidth: "45%",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  coverHero: {
    height: 320,
    overflow: "hidden",
    position: "relative",
  },
  coverMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  coverGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  coverBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  heroPlayBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -24,
    marginLeft: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  addCoverHint: {
    position: "absolute",
    right: 12,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addCoverHintText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "600",
  },
  identityWrap: {
    marginTop: -60,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  avatarActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  avatarContainer: {
    position: "relative",
  },
  avatarOuterRing: {
    width: 87,
    height: 87,
    borderRadius: 43.5,
    borderWidth: 4,
    borderColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.gold,
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
    backgroundColor: COLORS.gray,
  },
  onlineDot: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.black,
    backgroundColor: "#22c55e",
  },
  profileActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  followButton: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: COLORS.gold,
  },
  followButtonActive: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  followButtonText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "700",
  },
  followButtonTextActive: {
    color: COLORS.gold,
  },
  bookButton: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: COLORS.emerald,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  messageIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  vendorName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gold,
  },
  tierPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proTierPill: {
    backgroundColor: COLORS.gold,
  },
  growthTierPill: {
    backgroundColor: COLORS.emerald,
  },
  starterTierPill: {
    backgroundColor: COLORS.gray,
  },
  tierPillText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: "700",
  },
  handleLocationText: {
    marginTop: 6,
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
  },
  metaBadgeRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryBadge: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.2)",
    backgroundColor: "rgba(201,168,76,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: COLORS.goldDim,
    fontSize: 11,
    fontWeight: "700",
  },
  availableBadge: {
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  availableBadgeText: {
    color: "#8dffb4",
    fontSize: 11,
    fontWeight: "700",
  },
  taglineText: {
    marginTop: 12,
    color: COLORS.cream,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.85,
  },
  ratingRow: {
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
  reviewCountText: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
  },
  responseTimeText: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
  },
  statsContainer: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: COLORS.gray,
    flexDirection: "row",
    alignItems: "stretch",
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
    backgroundColor: "rgba(255,255,255,0.06)",
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
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  subscribeButtonWrap: {
    marginTop: 14,
  },
  subscribeButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButtonText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: "800",
  },
  subscribedButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  subscribedButtonText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: "800",
  },
  tabBarContainer: {
    backgroundColor: COLORS.black,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    paddingHorizontal: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  tabText: {
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextActive: {
    color: COLORS.gold,
    fontWeight: "700",
  },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    alignSelf: "stretch",
    backgroundColor: "transparent",
  },
  tabUnderlineActive: {
    backgroundColor: COLORS.gold,
  },
  tabSectionWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  featuredPostCard: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
  },
  featuredPostMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredPlayBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -18,
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  featuredPostOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 14,
  },
  featuredCategoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 8,
  },
  featuredCategoryText: {
    color: COLORS.cream,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  featuredTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  featuredEngagementRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  featuredEngagement: {
    color: COLORS.cream,
    fontSize: 12,
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
    backgroundColor: COLORS.gray,
  },
  mediaCellOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mediaCellLabel: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "600",
  },
  mediaCellLikes: {
    color: COLORS.cream,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  mediaVideoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  shopCollectionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
  },
  shopCollectionGlow: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(232,185,48,0.15)",
  },
  shopCollectionTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  shopCollectionSubtitle: {
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 14,
  },
  shopAllButton: {
    alignSelf: "flex-start",
    borderRadius: 22,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shopAllButtonText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "700",
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: COLORS.gray,
  },
  productImageZone: {
    height: 140,
    backgroundColor: "#1f1f1f",
    position: "relative",
  },
  productTagBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  productTagText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700",
  },
  productSaveButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  productInfoZone: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  productNameText: {
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: "600",
    minHeight: 32,
  },
  productPriceText: {
    marginTop: 4,
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: "800",
  },
  productButtonRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  smallAddButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232,185,48,0.4)",
    backgroundColor: "rgba(232,185,48,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallAddButtonText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "700",
  },
  reviewSummaryCard: {
    flexDirection: "row",
    borderRadius: 14,
    backgroundColor: COLORS.gray,
    padding: 14,
    marginBottom: 12,
  },
  reviewSummaryLeft: {
    width: "36%",
  },
  reviewSummaryRating: {
    color: COLORS.white,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 44,
  },
  reviewSummaryCount: {
    marginTop: 4,
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
  },
  reviewSummaryRight: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
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
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  breakdownFill: {
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  leaveReviewButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 12,
  },
  leaveReviewButtonText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: "700",
  },
  reviewCard: {
    borderRadius: 14,
    backgroundColor: COLORS.gray,
    padding: 16,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.grayMid,
    overflow: "hidden",
    marginRight: 8,
  },
  reviewAvatarImg: {
    width: "100%",
    height: "100%",
  },
  reviewMeta: {
    flex: 1,
  },
  reviewUserName: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  reviewMetaText: {
    color: COLORS.grayLight,
    fontSize: 11,
    fontWeight: "500",
  },
  reviewBody: {
    color: COLORS.cream,
    fontSize: 13,
    lineHeight: 19.5,
    fontWeight: "400",
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  aboutLabel: {
    width: 110,
    marginLeft: 10,
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  aboutValue: {
    flex: 1,
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },
  aboutActionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  aboutMessageButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: COLORS.gray,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  aboutMessageButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  aboutReportButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.grayMid,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  aboutReportButtonText: {
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "700",
  },
  stickyBookingWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  stickyBookingInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  minPriceBlock: {
    flex: 1,
  },
  minPriceLabel: {
    color: COLORS.grayLight,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  minPriceValue: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  bookNowWrap: {
    flex: 2,
  },
  bookNowButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.gold,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  bookNowButtonText: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: "900",
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
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
    fontWeight: "500",
    marginBottom: 10,
  },
  sheetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetOptionText: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: "500",
  },
  sheetCtaButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCtaText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: "800",
  },
  largeStarRow: {
    marginTop: 8,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewInput: {
    minHeight: 110,
    borderRadius: 12,
    backgroundColor: COLORS.gray,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "400",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  emptyBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: COLORS.gray,
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyBlockText: {
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
  },
});

// ─── STAFF WORK PROFILE (F3) ───────────────────────────────────
// A staff member's own bookable public profile within a business.
// Reuses VendorDetailScreen's dark card/header/identity conventions
// so it doesn't introduce a new design language (see StaffCardList
// for the same rationale on the booking-tab card).
//
// Data reality (see PR description for full gap list):
// - Posts: no staff-post backend exists yet — empty state only.
// - Follow/Message: rendered to match the real business-profile look,
//   but inert — staff members aren't a followable/messageable entity
//   type in the backend yet (no linked userId, no "staff" participant
//   type on follow/message endpoints).
// - Book actions: no staff-specific booking flow exists yet, so they
//   route back into VendorDetail's real Booking tab (closest existing
//   real entry point) rather than a fabricated flow.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import apiClient from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/hooks/useTheme";
import {
  BrandColorSpec,
  resolveBrandColor,
  parseBrandColorSpec,
} from "@/constants/colorOptions";

// Text sitting on top of the business's accentColor (buttons/badges/avatar
// fallback) stays a fixed near-black regardless of theme — the same
// convention VendorDetailScreen uses for its own accent-colored buttons.
const COLORS = {
  black: "#0A0A0A",
};

type Props = NativeStackScreenProps<RootStackParamList, "StaffWorkProfile">;
type StaffTab = "posts" | "services" | "reviews" | "about";

type StaffServiceCard = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  durationMinutes?: number;
};

type StaffProfileViewModel = {
  id: string;
  displayName: string;
  username?: string | null;
  bio?: string;
  profileImageUrl?: string;
  specialties: string[];
  serviceIds: string[];
  rating: number;
  reviewCount: number;
};

const formatCents = (cents?: number | null): string => {
  if (cents == null || Number.isNaN(cents)) return "";
  return `$${(cents / 100).toFixed(2)}`;
};

const getInitials = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const slugify = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, "");

const scoreToStars = (rating: number): number =>
  Math.max(0, Math.min(5, Math.round(rating)));

const StarRow = ({
  rating,
  color,
  inactiveColor,
}: {
  rating: number;
  color: string;
  inactiveColor: string;
}) => {
  const stars = scoreToStars(rating);
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Feather
          key={`star-${index}`}
          name="star"
          size={14}
          color={index < stars ? color : inactiveColor}
        />
      ))}
    </View>
  );
};

const tabLabel = (tab: StaffTab): string => {
  switch (tab) {
    case "services":
      return "Services";
    case "reviews":
      return "Reviews";
    case "about":
      return "About";
    case "posts":
    default:
      return "Posts";
  }
};

export default function StaffWorkProfileScreen({ route }: Props) {
  const { businessId, staffId } = route.params;
  const navigation = useNavigation<Props["navigation"]>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffProfileViewModel | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [brandColors, setBrandColors] = useState<BrandColorSpec | null>(null);
  const [services, setServices] = useState<StaffServiceCard[]>([]);
  const [activeTab, setActiveTab] = useState<StaffTab>("posts");

  const accentColor = resolveBrandColor(brandColors, isDark ? "dark" : "light");

  // Adaptive surface/text tokens — reuses the app's real theme palette
  // (constants/theme.ts) instead of this screen's old fixed-dark colors.
  const pageBg = theme.backgroundDefault;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const textMuted = theme.textMuted;
  const hairline = isDark ? "rgba(255,255,255,0.10)" : theme.border;
  const cardSurface = isDark ? "rgba(255,255,255,0.06)" : theme.backgroundSecondary;
  const cardSurfaceStrong = isDark ? "rgba(0,0,0,0.30)" : theme.backgroundSecondary;
  const chipBg = isDark ? "rgba(255,255,255,0.08)" : theme.backgroundSecondary;
  const chipBorder = isDark ? "rgba(255,255,255,0.16)" : theme.border;
  const headerButtonBg = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)";
  const tabBarBg = isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.03)";
  const stickyBarBg = isDark ? "rgba(10,10,10,0.92)" : "rgba(255,255,255,0.92)";

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [businessResult, staffResult, serviceResult] = await Promise.all([
        apiClient.getBusiness(businessId).catch(() => null),
        apiClient.getBusinessPublicStaff(businessId).catch(() => ({ staff: [] })),
        apiClient
          .getBusinessPublicServices(businessId)
          .catch(() => ({ services: [] })),
      ]);

      if (businessResult?.name) setBusinessName(businessResult.name);
      setBrandColors(parseBrandColorSpec((businessResult as any)?.brandColors));

      const member = (staffResult.staff || []).find(
        (item) => String(item.id) === String(staffId),
      );

      if (member) {
        setStaff({
          id: String(member.id),
          displayName: member.displayName || "Team Member",
          username: member.username || undefined,
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
        });

        const memberServiceIds = new Set(
          (Array.isArray(member.serviceIds) ? member.serviceIds : []).map(
            String,
          ),
        );
        const liveMemberServices = (serviceResult.services || [])
          .filter(
            (service) =>
              service.status === "live" &&
              memberServiceIds.has(String(service.id)),
          )
          .map((service) => ({
            id: String(service.id),
            name: service.name,
            description: service.description || undefined,
            priceCents: Number(service.priceCents ?? 0),
            durationMinutes: service.durationMinutes || undefined,
          }));
        setServices(liveMemberServices);
      } else {
        setStaff(null);
      }
    } catch (error) {
      console.error("[StaffWorkProfile] Failed to load profile:", error);
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, staffId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const goBackToBusiness = useCallback(() => {
    navigation.navigate("VendorDetail", { vendorId: businessId });
  }, [navigation, businessId]);

  const handleShare = useCallback(async () => {
    if (!staff) return;
    try {
      await Share.share({
        message: `Check out ${staff.displayName} on Outsyde`,
      });
    } catch (error) {
      console.warn("Share failed:", error);
    }
  }, [staff]);

  const goToBookingEntryPoint = useCallback(() => {
    navigation.navigate("VendorDetail", {
      vendorId: businessId,
      initialTab: "services",
    });
  }, [navigation, businessId]);

  const handleInertAction = useCallback((label: string) => {
    Alert.alert("Coming soon", `${label} will be wired in a follow-up update.`);
  }, []);

  const minPriceCents = useMemo(() => {
    if (services.length === 0) return undefined;
    return Math.min(...services.map((service) => service.priceCents));
  }, [services]);

  const startingLabel = minPriceCents != null
    ? `Starting from ${formatCents(minPriceCents)}`
    : "";

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: textSecondary }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!staff) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: pageBg }]}
        edges={["left", "right", "bottom"]}
      >
        <View style={[styles.headerRow, { paddingTop: insets.top + 6, paddingHorizontal: 14 }]}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: headerButtonBg }]}
            onPress={goBackToBusiness}
          >
            <Feather name="arrow-left" size={18} color={textPrimary} />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: textSecondary }]}>
            Team member not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const affiliationLabel = businessName
    ? `@ ${businessName}`
    : "Managed by shop";

  const renderTabContent = () => {
    switch (activeTab) {
      case "services":
        return (
          <View style={styles.tabContent}>
            {services.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: chipBg, borderColor: chipBorder },
                ]}
              >
                <Feather name="briefcase" size={24} color={textMuted} />
                <Text style={[styles.emptyTitle, { color: textMuted }]}>
                  No bookable services yet
                </Text>
              </View>
            ) : (
              services.map((service) => (
                <Pressable
                  key={service.id}
                  style={[styles.serviceCard, { backgroundColor: cardSurfaceStrong }]}
                  onPress={goToBookingEntryPoint}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceName, { color: textPrimary }]}>
                      {service.name}
                    </Text>
                    {service.description ? (
                      <Text
                        style={[styles.serviceDescription, { color: textSecondary }]}
                        numberOfLines={2}
                      >
                        {service.description}
                      </Text>
                    ) : null}
                    {service.durationMinutes ? (
                      <Text style={[styles.serviceMeta, { color: textMuted }]}>
                        {service.durationMinutes} min
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.servicePrice, { color: accentColor }]}>
                      {formatCents(service.priceCents)}
                    </Text>
                    <View style={[styles.bookChip, { backgroundColor: accentColor }]}>
                      <Text style={styles.bookChipText}>Book</Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        );
      case "reviews":
        return (
          <View style={styles.tabContent}>
            <View style={[styles.reviewSummaryCard, { backgroundColor: cardSurfaceStrong }]}>
              <Text style={[styles.reviewScore, { color: textPrimary }]}>
                {staff.rating.toFixed(1)}
              </Text>
              <StarRow rating={staff.rating} color={accentColor} inactiveColor={textMuted} />
              <Text style={[styles.reviewCountLabel, { color: textMuted }]}>
                {staff.reviewCount} {staff.reviewCount === 1 ? "review" : "reviews"}
              </Text>
            </View>
          </View>
        );
      case "about":
        return (
          <View style={styles.tabContent}>
            {staff.bio ? (
              <Text style={[styles.bioText, { color: textSecondary }]}>{staff.bio}</Text>
            ) : (
              <Text style={[styles.emptyTitle, { color: textMuted }]}>No bio yet</Text>
            )}
            <View style={[styles.aboutRow, { borderBottomColor: hairline }]}>
              <Feather name="briefcase" size={14} color={accentColor} />
              <Text style={[styles.aboutLabel, { color: textMuted }]}>Business</Text>
              <Text style={[styles.aboutValue, { color: textSecondary }]}>
                {businessName || "Not listed"}
              </Text>
            </View>
          </View>
        );
      case "posts":
      default:
        return (
          <View style={styles.tabContent}>
            <View
              style={[
                styles.emptyState,
                { backgroundColor: chipBg, borderColor: chipBorder },
              ]}
            >
              <Feather name="camera" size={26} color={textMuted} />
              <Text style={[styles.emptyTitle, { color: textMuted }]}>No work posts yet</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: pageBg }]}
      edges={["left", "right", "bottom"]}
    >
      <View style={[styles.headerRow, { paddingTop: insets.top + 6, paddingHorizontal: 14 }]}>
        <Pressable
          style={[styles.headerButton, { backgroundColor: headerButtonBg }]}
          onPress={goBackToBusiness}
        >
          <Feather name="arrow-left" size={18} color={textPrimary} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: headerButtonBg }]}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Feather name="bell" size={18} color={textPrimary} />
          </Pressable>
          <Pressable
            style={[styles.headerButton, { backgroundColor: headerButtonBg }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={18} color={textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: pageBg }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
      >
        <View style={styles.identityBlock}>
          <View style={styles.avatarActionRow}>
            <View style={[styles.avatarOuterRing, { borderColor: accentColor }]}>
              {staff.profileImageUrl ? (
                <Image
                  source={{ uri: staff.profileImageUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: accentColor }]}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(staff.displayName)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.actionsWrap}>
              <Pressable
                style={[styles.followButton, { backgroundColor: accentColor }]}
                onPress={() => handleInertAction("Follow")}
              >
                <Text style={styles.followButtonText}>Follow</Text>
              </Pressable>
              <Pressable
                style={[styles.messageButton, { backgroundColor: cardSurface }]}
                onPress={() => handleInertAction("Messaging")}
              >
                <Feather name="message-circle" size={15} color={textPrimary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: textPrimary }]}>
              {staff.displayName}
            </Text>
          </View>
          <Text style={[styles.metaLine, { color: textMuted }]}>
            @{staff.username || slugify(staff.displayName)}
          </Text>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.workProfileBadge,
                { backgroundColor: `${accentColor}28`, borderColor: accentColor },
              ]}
            >
              <Text style={[styles.workProfileBadgeText, { color: accentColor }]}>
                Work profile
              </Text>
            </View>
            <View
              style={[
                styles.affiliationBadge,
                { backgroundColor: chipBg, borderColor: chipBorder },
              ]}
            >
              <Text style={[styles.affiliationBadgeText, { color: textSecondary }]}>
                {affiliationLabel}
              </Text>
            </View>
          </View>

          {staff.specialties.length > 0 ? (
            <View style={styles.tagRow}>
              {staff.specialties.slice(0, 4).map((tag) => (
                <View
                  key={tag}
                  style={[styles.tagPill, { backgroundColor: chipBg, borderColor: chipBorder }]}
                >
                  <Text style={[styles.tagPillText, { color: textSecondary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {staff.bio ? (
            <Text style={[styles.bioTextInline, { color: textSecondary }]} numberOfLines={3}>
              {staff.bio}
            </Text>
          ) : null}

          <View style={[styles.statsCard, { backgroundColor: cardSurfaceStrong }]}>
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: textPrimary }]}>0</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Posts</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: hairline }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: textPrimary }]}>0</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Followers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: hairline }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: textPrimary }]}>0</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Bookings</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.tabBar,
            { backgroundColor: tabBarBg, borderTopColor: hairline, borderBottomColor: hairline },
          ]}
        >
          {(["posts", "services", "reviews", "about"] as StaffTab[]).map(
            (tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={styles.tabButton}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: textMuted },
                    activeTab === tab && styles.tabLabelActive,
                    activeTab === tab && { color: accentColor },
                  ]}
                >
                  {tabLabel(tab)}
                </Text>
                <View
                  style={[
                    styles.tabUnderline,
                    activeTab === tab && { backgroundColor: accentColor },
                  ]}
                />
              </Pressable>
            ),
          )}
        </View>

        {renderTabContent()}
      </ScrollView>

      <View
        style={[
          styles.stickyWrap,
          { paddingBottom: insets.bottom + 12, backgroundColor: stickyBarBg, borderTopColor: hairline },
        ]}
      >
        <View style={styles.stickyInner}>
          {startingLabel ? (
            <View style={{ flex: 1 }}>
              <Text style={[styles.minPriceText, { color: textMuted }]}>{startingLabel}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            style={[styles.stickyButton, { backgroundColor: accentColor }]}
            onPress={goToBookingEntryPoint}
          >
            <Text style={styles.stickyButtonText}>Book {staff.displayName}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {},
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  identityBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
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
  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  followButton: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  followButtonText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "700",
  },
  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 22,
    fontWeight: "800",
  },
  metaLine: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  workProfileBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  workProfileBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  affiliationBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  affiliationBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bioTextInline: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  statsCard: {
    marginTop: 16,
    borderRadius: 16,
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
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: "700",
  },
  tabUnderline: {
    height: 2,
    width: "60%",
    marginTop: 6,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyState: {
    paddingVertical: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
  },
  serviceCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceName: {
    fontSize: 15,
    fontWeight: "700",
  },
  serviceDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  serviceMeta: {
    marginTop: 6,
    fontSize: 12,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  bookChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  bookChipText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: "800",
  },
  reviewSummaryCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  reviewScore: {
    fontSize: 32,
    fontWeight: "800",
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
  },
  reviewCountLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: 13,
    fontWeight: "600",
    width: 80,
  },
  aboutValue: {
    fontSize: 13,
    flex: 1,
  },
  stickyWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  stickyInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  minPriceText: {
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
});

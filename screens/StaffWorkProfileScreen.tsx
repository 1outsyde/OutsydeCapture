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

const COLORS = {
  black: "#0A0A0A",
  gold: "#E8B930",
  cream: "#F5F0E6",
  gray: "#2A2A2A",
  grayMid: "#555555",
  grayLight: "#999999",
  white: "#FFFFFF",
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

const StarRow = ({ rating, color }: { rating: number; color: string }) => {
  const stars = scoreToStars(rating);
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Feather
          key={`star-${index}`}
          name="star"
          size={14}
          color={index < stars ? color : COLORS.grayMid}
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

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffProfileViewModel | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [services, setServices] = useState<StaffServiceCard[]>([]);
  const [activeTab, setActiveTab] = useState<StaffTab>("posts");

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

      const member = (staffResult.staff || []).find(
        (item) => String(item.id) === String(staffId),
      );

      if (member) {
        setStaff({
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!staff) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.headerRow, { paddingTop: insets.top + 6, paddingHorizontal: 14 }]}>
          <Pressable style={styles.headerButton} onPress={goBackToBusiness}>
            <Feather name="arrow-left" size={18} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Team member not found.</Text>
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
              <View style={styles.emptyState}>
                <Feather name="briefcase" size={24} color={COLORS.grayLight} />
                <Text style={styles.emptyTitle}>No bookable services yet</Text>
              </View>
            ) : (
              services.map((service) => (
                <Pressable
                  key={service.id}
                  style={styles.serviceCard}
                  onPress={goToBookingEntryPoint}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    {service.description ? (
                      <Text style={styles.serviceDescription} numberOfLines={2}>
                        {service.description}
                      </Text>
                    ) : null}
                    {service.durationMinutes ? (
                      <Text style={styles.serviceMeta}>
                        {service.durationMinutes} min
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.servicePrice}>
                      {formatCents(service.priceCents)}
                    </Text>
                    <View style={styles.bookChip}>
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
            <View style={styles.reviewSummaryCard}>
              <Text style={styles.reviewScore}>{staff.rating.toFixed(1)}</Text>
              <StarRow rating={staff.rating} color={COLORS.gold} />
              <Text style={styles.reviewCountLabel}>
                {staff.reviewCount} {staff.reviewCount === 1 ? "review" : "reviews"}
              </Text>
            </View>
          </View>
        );
      case "about":
        return (
          <View style={styles.tabContent}>
            {staff.bio ? (
              <Text style={styles.bioText}>{staff.bio}</Text>
            ) : (
              <Text style={styles.emptyTitle}>No bio yet</Text>
            )}
            <View style={styles.aboutRow}>
              <Feather name="briefcase" size={14} color={COLORS.gold} />
              <Text style={styles.aboutLabel}>Business</Text>
              <Text style={styles.aboutValue}>{businessName || "Not listed"}</Text>
            </View>
          </View>
        );
      case "posts":
      default:
        return (
          <View style={styles.tabContent}>
            <View style={styles.emptyState}>
              <Feather name="camera" size={26} color={COLORS.grayLight} />
              <Text style={styles.emptyTitle}>No work posts yet</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 6, paddingHorizontal: 14 }]}>
        <Pressable style={styles.headerButton} onPress={goBackToBusiness}>
          <Feather name="arrow-left" size={18} color={COLORS.white} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Feather name="bell" size={18} color={COLORS.white} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleShare}>
            <Feather name="share-2" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
      >
        <View style={styles.identityBlock}>
          <View style={styles.avatarActionRow}>
            <View style={styles.avatarOuterRing}>
              {staff.profileImageUrl ? (
                <Image
                  source={{ uri: staff.profileImageUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(staff.displayName)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.actionsWrap}>
              <Pressable
                style={styles.followButton}
                onPress={() => handleInertAction("Follow")}
              >
                <Text style={styles.followButtonText}>Follow</Text>
              </Pressable>
              <Pressable
                style={styles.messageButton}
                onPress={() => handleInertAction("Messaging")}
              >
                <Feather name="message-circle" size={15} color={COLORS.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.nameText}>{staff.displayName}</Text>
          </View>
          <Text style={styles.metaLine}>
            @{slugify(staff.displayName)}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.workProfileBadge}>
              <Text style={styles.workProfileBadgeText}>Work profile</Text>
            </View>
            <View style={styles.affiliationBadge}>
              <Text style={styles.affiliationBadgeText}>{affiliationLabel}</Text>
            </View>
          </View>

          {staff.specialties.length > 0 ? (
            <View style={styles.tagRow}>
              {staff.specialties.slice(0, 4).map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {staff.bio ? (
            <Text style={styles.bioTextInline} numberOfLines={3}>
              {staff.bio}
            </Text>
          ) : null}

          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Bookings</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
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
                    activeTab === tab && styles.tabLabelActive,
                  ]}
                >
                  {tabLabel(tab)}
                </Text>
                <View
                  style={[
                    styles.tabUnderline,
                    activeTab === tab && styles.tabUnderlineActive,
                  ]}
                />
              </Pressable>
            ),
          )}
        </View>

        {renderTabContent()}
      </ScrollView>

      <View style={[styles.stickyWrap, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.stickyInner}>
          {startingLabel ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.minPriceText}>{startingLabel}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable style={styles.stickyButton} onPress={goToBookingEntryPoint}>
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
    backgroundColor: COLORS.gold,
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
    backgroundColor: COLORS.gold,
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
  metaLine: {
    marginTop: 4,
    color: COLORS.grayLight,
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
    backgroundColor: "rgba(232,185,48,0.16)",
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  workProfileBadgeText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "700",
  },
  affiliationBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  affiliationBadgeText: {
    color: COLORS.cream,
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
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagPillText: {
    color: COLORS.cream,
    fontSize: 11,
    fontWeight: "600",
  },
  bioTextInline: {
    marginTop: 10,
    color: COLORS.cream,
    fontSize: 13,
    lineHeight: 18,
  },
  statsCard: {
    marginTop: 16,
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
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
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
  tabLabelActive: {
    fontWeight: "700",
    color: COLORS.gold,
  },
  tabUnderline: {
    height: 2,
    width: "60%",
    marginTop: 6,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  tabUnderlineActive: {
    backgroundColor: COLORS.gold,
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
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  emptyTitle: {
    marginTop: 8,
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "500",
  },
  serviceCard: {
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceName: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  serviceDescription: {
    marginTop: 4,
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 18,
  },
  serviceMeta: {
    marginTop: 6,
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.gold,
    marginBottom: 8,
  },
  bookChip: {
    backgroundColor: COLORS.gold,
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
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 20,
    alignItems: "center",
  },
  reviewScore: {
    color: COLORS.white,
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
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "600",
  },
  bioText: {
    color: COLORS.cream,
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
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  aboutLabel: {
    color: COLORS.grayLight,
    fontSize: 13,
    fontWeight: "600",
    width: 80,
  },
  aboutValue: {
    color: COLORS.cream,
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
    backgroundColor: "rgba(10,10,10,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  stickyInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    backgroundColor: COLORS.gold,
  },
  stickyButtonText: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: "900",
  },
});

// ─── STAFF CARD LIST ───────────────────────────────────────────
// Renders the multi-staff Booking-tab alternative to the flat
// service list. Reuses VendorDetailScreen's dark card/chip/typography
// conventions so it doesn't introduce a new design language.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

// Mirrors VendorDetailScreen's local COLORS palette so the staff cards
// match the screen's dark theme without introducing a circular import.
const COLORS = {
  black: "#0A0A0A",
  gold: "#E8B930",
  cream: "#F5F0E6",
  grayMid: "#555555",
  grayLight: "#999999",
  white: "#FFFFFF",
};

export interface StaffCardVM {
  id: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  specialties: string[];
  serviceIds: string[];
  rating: number;
  reviewCount: number;
}

interface StaffCardListProps {
  staff: StaffCardVM[];
  accentColor: string;
  selectedStaffId?: string | null;
  onSelect?: (staffId: string) => void;
  onBook?: (staffId: string) => void;
  onViewProfile?: (staffId: string) => void;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const scoreToStars = (rating: number): number =>
  Math.max(0, Math.min(5, Math.round(rating)));

const StaffStarRow = ({ rating, color }: { rating: number; color: string }) => {
  const stars = scoreToStars(rating);
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Feather
          key={`staff-star-${index}`}
          name="star"
          size={13}
          color={index < stars ? color : COLORS.grayMid}
        />
      ))}
    </View>
  );
};

const WORK_IMAGE_PLACEHOLDER_COUNT = 3;

export default function StaffCardList({
  staff,
  accentColor,
  selectedStaffId,
  onSelect,
  onBook,
  onViewProfile,
}: StaffCardListProps) {
  return (
    <View style={styles.container}>
      {staff.map((member) => {
        const isSelected = selectedStaffId === member.id;
        return (
          <View
            key={member.id}
            style={[
              styles.card,
              isSelected && {
                borderColor: accentColor,
                backgroundColor: `${accentColor}14`,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.avatarWrap}>
                {member.profileImageUrl ? (
                  <Image
                    source={{ uri: member.profileImageUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: accentColor },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>
                      {getInitials(member.displayName)}
                    </Text>
                  </View>
                )}
                {isSelected ? (
                  <View
                    style={[
                      styles.selectedBadge,
                      { backgroundColor: accentColor },
                    ]}
                  >
                    <Feather name="check" size={10} color={COLORS.black} />
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.staffName, { color: COLORS.gold }]}>
                  {member.displayName}
                </Text>
                <Text style={styles.staffSpecialtyLine} numberOfLines={1}>
                  {member.specialties[0] ||
                    (member.bio ? member.bio : "Team Member")}
                </Text>
                <View style={styles.ratingInlineRow}>
                  <StaffStarRow rating={member.rating} color={accentColor} />
                  <Text style={styles.ratingText}>
                    {member.rating.toFixed(1)}
                  </Text>
                  <Text style={styles.ratingMeta}>({member.reviewCount})</Text>
                </View>
              </View>
            </View>

            {member.specialties.length > 0 ? (
              <View style={styles.chipRow}>
                {member.specialties.slice(0, 4).map((tag) => (
                  <View
                    key={tag}
                    style={[
                      styles.chip,
                      {
                        borderColor: accentColor,
                        backgroundColor: `${accentColor}22`,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: accentColor }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {member.bio ? (
              <Text style={styles.bioText} numberOfLines={2}>
                {member.bio}
              </Text>
            ) : null}

            <View style={styles.workRow}>
              {Array.from({ length: WORK_IMAGE_PLACEHOLDER_COUNT }).map(
                (_, index) => (
                  <View
                    key={`work-${member.id}-${index}`}
                    style={styles.workTile}
                  >
                    <Feather
                      name="image"
                      size={16}
                      color="rgba(255,255,255,0.25)"
                    />
                  </View>
                ),
              )}
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.profileButton]}
                onPress={() => onViewProfile?.(member.id)}
              >
                <Text style={styles.profileButtonText}>Profile</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: accentColor }]}
                onPress={() => onBook?.(member.id)}
              >
                <Text style={styles.bookButtonText}>Book</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.30)",
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "visible",
    position: "relative",
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: COLORS.black,
    fontSize: 18,
    fontWeight: "800",
  },
  selectedBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.black,
  },
  staffName: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  staffSpecialtyLine: {
    color: COLORS.grayLight,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  ratingInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  ratingMeta: {
    color: COLORS.grayLight,
    fontSize: 11,
    fontWeight: "500",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bioText: {
    color: COLORS.cream,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  workRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  workTile: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  profileButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  profileButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  bookButtonText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: "800",
  },
});

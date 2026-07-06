import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import InviteTeamModal from "@/components/InviteTeamModal";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface StaffMemberRow {
  id: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  role?: string;
  status?: string;
}

interface StaffInviteRow {
  id: string;
  email: string;
  role?: string;
  status: string;
  createdAt?: string;
}

const getInitials = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function StaffManagementScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { getToken } = useAuth();

  const accentColor = theme.accent;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMemberRow[]>([]);
  const [invites, setInvites] = useState<StaffInviteRow[]>([]);
  const [seatStatus, setSeatStatus] = useState<{
    activeCount: number;
    maxStaff: number | null;
    tierName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const token = await getToken();
      if (!token) {
        setLoadError("Please sign in to manage your team.");
        return;
      }

      const [businessRes, staffRes, invitesRes, seatRes] = await Promise.all([
        api.getVendorMyBusiness(token),
        api.getVendorStaff(token),
        api.getStaffInvites(token),
        api.getStaffSeatStatus(token).catch(() => null),
      ]);

      setBusinessId(businessRes.business.id);
      setStaff(
        (staffRes.staff || []).map((m: any) => ({
          id: String(m.id),
          displayName: m.displayName || m.name || "Team Member",
          bio: m.bio || undefined,
          profileImageUrl: m.profileImageUrl || m.avatarUrl || undefined,
          specialties: Array.isArray(m.specialties) ? m.specialties : [],
          rating: Number(m.rating ?? 0),
          reviewCount: Number(m.reviewCount ?? 0),
          role: m.role,
          status: m.status,
        })),
      );
      setInvites(invitesRes.invites || []);
      if (seatRes) setSeatStatus(seatRes);
    } catch (error) {
      console.error("[StaffManagementScreen] Failed to load team:", error);
      setLoadError("Failed to load your team. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const pendingInvites = invites.filter((inv) => inv.status === "pending");
  const expiredInvites = invites.filter((inv) => inv.status === "expired");

  const renderInviteCard = (invite: StaffInviteRow, variant: "pending" | "expired") => {
    const sentDate = invite.createdAt
      ? new Date(invite.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    const badgeColor = variant === "pending" ? "#FFC800" : theme.textMuted;
    const badgeBg = variant === "pending" ? "rgba(255,200,0,0.15)" : `${theme.textMuted}22`;
    const badgeLabel = variant === "pending" ? "Pending" : "Expired";

    return (
      <View
        key={invite.id}
        style={[
          styles.inviteCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={[styles.inviteIcon, { backgroundColor: `${accentColor}18` }]}>
          <Feather
            name={variant === "expired" ? "clock" : "mail"}
            size={16}
            color={variant === "expired" ? theme.textMuted : accentColor}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[styles.inviteEmail, { color: theme.text }]}
            numberOfLines={1}
          >
            {invite.email}
          </Text>
          {sentDate ? (
            <Text style={[styles.inviteDate, { color: theme.textSecondary }]}>
              Invited {sentDate}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgeRow}>
          {invite.role ? (
            <View
              style={[
                styles.roleBadge,
                { borderColor: `${accentColor}66`, backgroundColor: `${accentColor}18` },
              ]}
            >
              <Text style={[styles.roleBadgeText, { color: accentColor }]}>
                {invite.role}
              </Text>
            </View>
          ) : null}
          <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
              {badgeLabel}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSectionHeader = (label: string) => (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeaderText, { color: theme.textSecondary }]}>
        {label}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />
        }
      >
        {loadError ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color="#FF4444" />
            <Text style={styles.errorBannerText}>{loadError}</Text>
          </View>
        ) : null}

        {/* Seat usage + Add button */}
        <View style={styles.headerRow}>
          {seatStatus ? (
            <View style={styles.seatRow}>
              <Feather
                name="users"
                size={13}
                color={
                  seatStatus.maxStaff !== null && seatStatus.activeCount >= seatStatus.maxStaff
                    ? "#FF3B30"
                    : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.seatText,
                  {
                    color:
                      seatStatus.maxStaff !== null && seatStatus.activeCount >= seatStatus.maxStaff
                        ? "#FF3B30"
                        : theme.textSecondary,
                  },
                ]}
              >
                {seatStatus.maxStaff === null
                  ? `${seatStatus.activeCount} seat${seatStatus.activeCount === 1 ? "" : "s"} used · Unlimited on ${seatStatus.tierName}`
                  : `${seatStatus.activeCount} of ${seatStatus.maxStaff} seats used · ${seatStatus.tierName}`}
              </Text>
            </View>
          ) : (
            <View />
          )}

          <Pressable
            onPress={() => setInviteModalVisible(true)}
            style={[styles.addButton, { backgroundColor: `${accentColor}22` }]}
          >
            <Feather name="user-plus" size={12} color={accentColor} />
            <Text style={[styles.addButtonText, { color: accentColor }]}>+ Add</Text>
          </Pressable>
        </View>

        {/* Active Staff */}
        {renderSectionHeader("ACTIVE STAFF")}
        {staff.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { borderColor: accentColor, backgroundColor: `${accentColor}0D` },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: `${accentColor}22` }]}>
              <Feather name="user-plus" size={22} color={accentColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No team members yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Add team members so customers can book them individually instead of
              just the shop.
            </Text>
            <Pressable
              onPress={() => setInviteModalVisible(true)}
              style={[styles.emptyButton, { backgroundColor: accentColor }]}
            >
              <Feather name="user-plus" size={14} color="#000" />
              <Text style={styles.emptyButtonText}>+ Add team member</Text>
            </Pressable>
          </View>
        ) : (
          staff.map((member) => (
            <View
              key={member.id}
              style={[
                styles.staffCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.staffTopRow}>
                <View style={[styles.avatar, { backgroundColor: `${accentColor}22` }]}>
                  {member.profileImageUrl ? (
                    <Image
                      source={{ uri: member.profileImageUrl }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {getInitials(member.displayName)}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.staffName, { color: accentColor }]}>
                    {member.displayName}
                  </Text>
                  <Text
                    style={[styles.staffSubtitle, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {member.specialties[0] || (member.bio ? member.bio : "Team Member")}
                  </Text>
                  <View style={styles.staffBadgeRow}>
                    {member.role ? (
                      <View
                        style={[
                          styles.roleBadge,
                          { borderColor: `${accentColor}66`, backgroundColor: `${accentColor}18` },
                        ]}
                      >
                        <Text style={[styles.roleBadgeText, { color: accentColor }]}>
                          {member.role}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            member.status === "inactive"
                              ? `${theme.textMuted}22`
                              : "rgba(52,199,89,0.15)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color: member.status === "inactive" ? theme.textMuted : "#34C759",
                            textTransform: "capitalize",
                          },
                        ]}
                      >
                        {member.status || "active"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.staffActionsRow}>
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      "Coming soon",
                      "Staff editing is launching soon — check back shortly.",
                    )
                  }
                  style={[styles.editButton, { borderColor: accentColor }]}
                >
                  <Text style={[styles.editButtonText, { color: accentColor }]}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!businessId) return;
                    navigation.navigate("StaffWorkProfile", {
                      businessId,
                      staffId: member.id,
                    });
                  }}
                  style={[styles.previewButton, { backgroundColor: `${accentColor}22` }]}
                >
                  <Feather name="eye" size={13} color={accentColor} />
                  <Text style={[styles.previewButtonText, { color: accentColor }]}>
                    Preview
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* Pending Invites */}
        {renderSectionHeader("PENDING INVITES")}
        {pendingInvites.length === 0 ? (
          <Text style={[styles.emptySectionText, { color: theme.textSecondary }]}>
            No pending invites.
          </Text>
        ) : (
          pendingInvites.map((invite) => renderInviteCard(invite, "pending"))
        )}

        {/* Expired Invites */}
        {expiredInvites.length > 0 && (
          <>
            {renderSectionHeader("EXPIRED INVITES")}
            {expiredInvites.map((invite) => renderInviteCard(invite, "expired"))}
          </>
        )}
      </ScrollView>

      <InviteTeamModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        onInviteSent={() => load()}
        brandColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,68,68,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    color: "#FF4444",
    fontSize: 13,
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  seatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  seatText: {
    fontSize: 12,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addButtonText: {
    fontWeight: "700",
    fontSize: 12,
  },
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptySectionText: {
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyButtonText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 13,
  },
  staffCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  staffTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarInitials: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
  },
  staffName: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  staffSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  staffBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  staffActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  editButton: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  editButtonText: {
    fontWeight: "700",
    fontSize: 13,
  },
  previewButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  previewButtonText: {
    fontWeight: "700",
    fontSize: 13,
  },
  inviteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteEmail: {
    fontSize: 13,
    fontWeight: "600",
  },
  inviteDate: {
    fontSize: 11,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

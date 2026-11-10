// Account tab ☰ menu (full screen page, Full Screen Pass #525).
// Redesign (Legend 2026-11-10): profile card on top, grouped sections, filled icons, neutral
// black / white that follows the phone (green and gold only as hints). Edit Profile and Saved left
// out: every profile already has its own Edit Profile / Manage business button and a Saved tab.
// Every row keeps the same destination and the same rule for who sees it as before.
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  Linking,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { hasPaidPlan } from "@/utils/subscriptionState";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";
import { MENU_ITEM } from "@/utils/host/memberLogic";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface PersonalSettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Kept for callers; Edit Profile is on the profile itself now, so the menu doesn't show it. */
  onEditProfile?: () => void;
  /** Kept for callers; see onEditProfile. */
  onEditPhotos?: () => void;
  showLocationVisible?: boolean;
  onToggleLocationVisibility?: () => void;
  isMultiStaff?: boolean;
  /** Kept for callers; Saved is a tab on your own profile now, so the menu doesn't show it. */
  onOpenSaved?: () => void;
  /** The profile card at the top: what the Account tab shows (a business's logo, a photographer's name). */
  profileName?: string;
  profileHandle?: string;
  profileAvatarUrl?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type MenuColors = {
  iconColor: string;
  iconBg: string;
  cardBg: string;
  divider: string;
  textSecondary: string;
  textMuted: string;
};

function Row({
  icon,
  label,
  subtitle,
  onPress,
  last,
  colors,
}: {
  icon: IconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
  colors: MenuColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: last ? "transparent" : colors.divider,
          backgroundColor: pressed ? colors.iconBg : "transparent",
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={19} color={colors.iconColor} />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="body" style={styles.rowLabel}>
          {label}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: MenuColors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText
        style={[styles.sectionTitle, { color: colors.textSecondary }]}
      >
        {title.toUpperCase()}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
        {children}
      </View>
    </View>
  );
}

export function PersonalSettingsMenu({
  visible,
  onClose,
  showLocationVisible,
  onToggleLocationVisibility,
  isMultiStaff,
  profileName,
  profileHandle,
  profileAvatarUrl,
}: PersonalSettingsMenuProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken } = useAuth();

  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Fetch subscription status when menu opens so we can route correctly
  useEffect(() => {
    if (!visible || user?.role !== "business") return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await api.getCurrentSubscription(token);
        const sub = res?.subscription;
        // A late or paused paid plan still belongs on Manage (update payment), not the public plans page.
        setHasActiveSubscription(hasPaidPlan(sub));
      } catch {
        setHasActiveSubscription(false);
      }
    })();
  }, [visible]);

  const isAdmin =
    user?.email?.toLowerCase() === "info@goutsyde.com" ||
    user?.email?.toLowerCase() === "jamesmeyers2304@gmail.com";

  const handleNavigate = (screen: keyof RootStackParamList) => {
    onClose();
    (navigation as any).navigate(screen);
  };

  const handleManageSubscription = async () => {
    onClose();
    try {
      const token = await getToken();
      // First-timers go to /subscription to purchase; existing subscribers go to /manage
      const path = hasActiveSubscription
        ? "/subscription/manage"
        : "/subscription";
      const url = token
        ? `https://goutsyde.com${path}?from=app&token=${encodeURIComponent(token)}`
        : `https://goutsyde.com${path}?from=app`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open subscription page.");
    }
  };

  // Neutral surfaces; gold icons in dark mode, green icons in light mode (gold is too faint on white).
  const iconColor = isDark ? theme.brandGold : theme.brandPrimary;
  const iconBg = theme.surfaceSecondary;
  const cardBg = theme.backgroundDefault;
  const divider = theme.border;
  const colors: MenuColors = {
    iconColor,
    iconBg,
    cardBg,
    divider,
    textSecondary: theme.textSecondary,
    textMuted: theme.textMuted,
  };

  const isConsumerOrGuest = user?.role === "consumer" || !!user?.isGuest;
  const showApplyInfluencer = !user?.isInfluencer && isConsumerOrGuest;
  const influencerPending = user?.influencerStatus === "pending";
  const showInfluencerDashboard =
    !!user?.isInfluencer && user?.influencerStatus === "approved";
  const initial =
    Array.from((profileName || "").trim())[0]?.toUpperCase() || "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.brandScreen,
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h2">Menu</ThemedText>
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: cardBg }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {profileName ? (
            <Pressable
              onPress={onClose}
              style={[styles.profileCard, { backgroundColor: cardBg }]}
              accessibilityRole="button"
              accessibilityLabel="View your profile"
            >
              {profileAvatarUrl && !avatarFailed ? (
                <Image
                  source={{ uri: profileAvatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.center,
                    { backgroundColor: theme.brandGold },
                  ]}
                >
                  <ThemedText style={styles.avatarInitial}>
                    {initial}
                  </ThemedText>
                </View>
              )}
              <View style={styles.rowText}>
                <ThemedText
                  type="body"
                  style={styles.profileName}
                  numberOfLines={1}
                >
                  {profileName}
                </ThemedText>
                {profileHandle ? (
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                    numberOfLines={1}
                  >
                    {profileHandle}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.pill, { backgroundColor: theme.text }]}>
                <ThemedText
                  style={[styles.pillText, { color: theme.backgroundDefault }]}
                >
                  View profile
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {isAdmin ? (
            <Section colors={colors} title="Admin">
              <Row
                colors={colors}
                icon="shield"
                label="Admin Dashboard"
                onPress={() => handleNavigate("AdminDashboard")}
                last
              />
            </Section>
          ) : null}

          {user?.role === "business" ? (
            <Section colors={colors} title="Your business">
              <Row
                colors={colors}
                icon="grid"
                label="Business Dashboard"
                subtitle={
                  user?.approvalStatus === "pending"
                    ? "Approval pending"
                    : "Orders, bookings and money"
                }
                onPress={() => handleNavigate("BusinessDashboard")}
              />
              <Row
                colors={colors}
                icon="storefront"
                label="Manage business"
                subtitle="Products, services and your storefront"
                onPress={() => handleNavigate("StorefrontEditor")}
              />
              <Row
                colors={colors}
                icon="card"
                label={
                  hasActiveSubscription ? "Manage Subscription" : "View Plans"
                }
                subtitle={
                  hasActiveSubscription
                    ? "Change plan, update billing, or cancel"
                    : "Choose a plan to start selling"
                }
                onPress={handleManageSubscription}
                last={!isMultiStaff}
              />
              {isMultiStaff ? (
                <Row
                  colors={colors}
                  icon="people"
                  label="Staff"
                  subtitle="Manage your team and seat usage"
                  onPress={() => handleNavigate("StaffManagement")}
                  last
                />
              ) : null}
            </Section>
          ) : null}

          {user?.role === "photographer" ? (
            <Section colors={colors} title="Your work">
              <Row
                colors={colors}
                icon="grid"
                label="Photographer Dashboard"
                subtitle="Bookings, calendar and earnings"
                onPress={() => handleNavigate("PhotographerDashboard")}
              />
              <Row
                colors={colors}
                icon="camera"
                label="Manage business"
                subtitle="Services, your profile, hours and payouts"
                onPress={() => handleNavigate("PhotographerManageBusiness")}
                last
              />
            </Section>
          ) : null}

          {user?.role === "staff" ? (
            <Section colors={colors} title="Your work">
              <Row
                colors={colors}
                icon="grid"
                label="Staff Dashboard"
                subtitle="Manage bookings, hours and earnings"
                onPress={() => handleNavigate("StaffDashboard")}
                last
              />
            </Section>
          ) : null}

          <Section colors={colors} title="Your activity">
            <Row
              colors={colors}
              icon="star"
              label="Outsyde Points"
              onPress={() => {
                onClose();
                navigation.navigate("Main", {
                  screen: "AccountTab",
                  params: { screen: "OutsydePoints" },
                } as any);
              }}
              last={!!user?.isGuest && !showInfluencerDashboard}
            />
            {!user?.isGuest ? (
              <Row
                colors={colors}
                icon="calendar"
                label="Your events"
                subtitle="Drafts, upcoming and past events you host"
                onPress={() => handleNavigate("YourEvents")}
              />
            ) : null}
            {!user?.isGuest ? (
              <Row
                colors={colors}
                icon="id-card"
                label={MENU_ITEM.label}
                subtitle={MENU_ITEM.subtitle}
                onPress={() => handleNavigate("DoorEvents")}
                last={!showInfluencerDashboard}
              />
            ) : null}
            {showInfluencerDashboard ? (
              <Row
                colors={colors}
                icon="stats-chart"
                label="Influencer Dashboard"
                subtitle="Stats, analytics and collab calendar"
                onPress={() => handleNavigate("InfluencerDashboard")}
                last
              />
            ) : null}
          </Section>

          <Section colors={colors} title="Account">
            <Row
              colors={colors}
              icon="settings"
              label="Settings"
              onPress={() => {
                onClose();
                (navigation as any).navigate("Settings");
              }}
            />
            <Row
              colors={colors}
              icon="notifications"
              label="Notifications"
              onPress={() => {
                onClose();
                // Activity redesign step 2 (Legend 2026-11-10): opens the settings, not the list.
                navigation.navigate("NotificationSettings" as any);
              }}
              last
            />
          </Section>

          <Section colors={colors} title="Privacy">
            {onToggleLocationVisibility ? (
              <View style={[styles.row, { borderBottomColor: divider }]}>
                <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                  <Ionicons name="location" size={19} color={iconColor} />
                </View>
                <View style={styles.rowText}>
                  <ThemedText type="body" style={styles.rowLabel}>
                    Show location
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {showLocationVisible
                      ? "Visible to others"
                      : "Hidden from your profile"}
                  </ThemedText>
                </View>
                <Switch
                  value={!!showLocationVisible}
                  onValueChange={() => onToggleLocationVisibility()}
                  trackColor={{
                    false: theme.surfaceSecondary,
                    true: theme.brandPrimary,
                  }}
                  accessibilityLabel="Show location"
                />
              </View>
            ) : null}
            <Row
              colors={colors}
              icon="ban"
              label="Blocked Users"
              onPress={() => handleNavigate("BlockedUsers")}
              last
            />
          </Section>

          <Section colors={colors} title="Support">
            <Row
              colors={colors}
              icon="help-circle"
              label="Help Center"
              onPress={() => handleNavigate("SupportContact")}
            />
            <Row
              colors={colors}
              icon="document-text"
              label="Terms of Service"
              onPress={() => handleNavigate("TermsOfService")}
            />
            <Row
              colors={colors}
              icon="shield-checkmark"
              label="Privacy Policy"
              onPress={() => handleNavigate("PrivacyPolicy")}
              last
            />
          </Section>

          {showApplyInfluencer ? (
            <Pressable
              onPress={() => handleNavigate("InfluencerApplication")}
              style={[
                styles.promo,
                { backgroundColor: cardBg, borderColor: theme.brandGoldDim },
              ]}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.promoIcon,
                  { backgroundColor: theme.brandPrimary },
                ]}
              >
                <Ionicons
                  name={influencerPending ? "time" : "star"}
                  size={22}
                  color={theme.brandGold}
                />
              </View>
              <View style={styles.rowText}>
                <ThemedText type="body" style={styles.profileName}>
                  {influencerPending
                    ? "Influencer application pending"
                    : "Apply as Influencer"}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {influencerPending
                    ? "Your application is being reviewed."
                    : "Apply to join the Outsyde influencer program."}
                </ThemedText>
              </View>
              {influencerPending ? (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textMuted}
                />
              ) : (
                <View
                  style={[styles.pill, { backgroundColor: theme.brandGold }]}
                >
                  <ThemedText style={[styles.pillText, { color: "#171717" }]}>
                    Apply
                  </ThemedText>
                </View>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, gap: 22 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    marginTop: Spacing.xs,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  center: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 20, fontWeight: "800", color: "#171717" },
  profileName: { fontWeight: "800" },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: "center",
  },
  pillText: { fontSize: 14, fontWeight: "700" },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginHorizontal: 4,
  },
  card: { borderRadius: 18, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontWeight: "600" },
  promo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  promoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

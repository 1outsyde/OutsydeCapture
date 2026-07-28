import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";

interface PersonalSettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
  onEditPhotos?: () => void;
  showLocationVisible?: boolean;
  onToggleLocationVisibility?: () => void;
  isMultiStaff?: boolean;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PersonalSettingsMenu({
  visible,
  onClose,
  onEditProfile,
  onEditPhotos,
  showLocationVisible,
  onToggleLocationVisibility,
  isMultiStaff,
}: PersonalSettingsMenuProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken } = useAuth();

  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Fetch subscription status when menu opens so we can route correctly
  useEffect(() => {
    if (!visible || user?.role !== "business") return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await api.getCurrentSubscription(token);
        const sub = res?.subscription;
        setHasActiveSubscription(!!sub && sub.status === "active");
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
      const path = hasActiveSubscription ? "/subscription/manage" : "/subscription";
      const url = token
        ? `https://goutsyde.com${path}?from=app&token=${encodeURIComponent(token)}`
        : `https://goutsyde.com${path}?from=app`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open subscription page.");
    }
  };

  const handleNavigateToSettings = () => {
    onClose();
    (navigation as any).navigate("Settings");
  };

  const MenuItem = ({
    icon,
    label,
    onPress,
    color,
    backgroundColor,
    subtitle,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    color?: string;
    backgroundColor?: string;
    subtitle?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: backgroundColor || theme.backgroundDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.menuItemLeft}>
        <Feather name={icon as any} size={20} color={color || theme.text} />
        <View>
          <ThemedText
            type="body"
            style={[styles.menuItemText, color ? { color } : null]}
          >
            {label}
          </ThemedText>
          {subtitle ? (
            <ThemedText
              type="small"
              style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}
            >
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <Feather
        name="chevron-right"
        size={20}
        color={color || theme.textSecondary}
      />
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.menuContainer,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
           <ThemedText type="h3">Menu</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {isAdmin ? (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Admin
                </ThemedText>
                <MenuItem
                  icon="shield"
                  label="Admin Dashboard"
                  onPress={() => handleNavigate("AdminDashboard")}
                  color="#FFD60A"
                  backgroundColor="#FFD60A20"
                />
              </View>
            ) : null}

            {user?.role === "photographer" ? (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Photographer
                </ThemedText>
                <MenuItem
                  icon="camera"
                  label="Photographer Dashboard"
                  onPress={() => handleNavigate("PhotographerDashboard")}
                  color="#007AFF"
                  backgroundColor="#007AFF10"
                  subtitle="Manage bookings, services, and earnings"
                />
              </View>
            ) : null}

            {user?.role === "staff" ? (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Staff
                </ThemedText>
                <MenuItem
                  icon="briefcase"
                  label="Staff Dashboard"
                  onPress={() => handleNavigate("StaffDashboard")}
                  color="#C9933A"
                  backgroundColor="#C9933A10"
                  subtitle="Manage bookings, hours, and earnings"
                />
              </View>
            ) : null}

            {user?.role === "business" ? (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Business
                </ThemedText>
                <MenuItem
                  icon="briefcase"
                  label="Business Dashboard"
                  onPress={() => handleNavigate("BusinessDashboard")}
                  color="#34C759"
                  backgroundColor="#34C75910"
                  subtitle={
                    user?.approvalStatus === "pending"
                      ? "Approval pending"
                      : "Manage orders and products"
                  }
                />
                <MenuItem
                  icon="edit-3"
                  label="Edit Storefront"
                  onPress={() => handleNavigate("StorefrontEditor")}
                  color="#34C759"
                  backgroundColor="#34C75910"
                />
                <MenuItem
                  icon="credit-card"
                  label={hasActiveSubscription ? "Manage Subscription" : "View Plans"}
                  onPress={handleManageSubscription}
                  color="#34C759"
                  backgroundColor="#34C75910"
                  subtitle={
                    hasActiveSubscription
                      ? "Change plan, update billing, or cancel"
                      : "Choose a plan to start selling"
                  }
                />
                {isMultiStaff ? (
                  <MenuItem
                    icon="users"
                    label="Staff"
                    onPress={() => handleNavigate("StaffManagement")}
                    color="#34C759"
                    backgroundColor="#34C75910"
                    subtitle="Manage your team and seat usage"
                  />
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <ThemedText
                type="small"
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                Account
              </ThemedText>

              <Pressable
                onPress={handleNavigateToSettings}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: "#1f1a10",
                    borderWidth: 1,
                    borderColor: "#3a2c10",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.menuItemLeft}>
                  <Feather name="settings" size={20} color="#e8a020" />
                  <ThemedText
                    type="body"
                    style={[styles.menuItemText, { color: "#e8a020" }]}
                  >
                    Settings
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color="#e8a020" />
              </Pressable>

              {onEditProfile ? (
                <MenuItem
                  icon="edit-2"
                  label="Edit Profile"
                  onPress={() => {
                    onClose();
                    onEditProfile();
                  }}
                />
              ) : null}

              {onEditPhotos ? (
                <MenuItem
                  icon="user"
                  label="Edit Profile"
                  onPress={() => {
                    onClose();
                    onEditPhotos();
                  }}
                  subtitle="Customize your profile"
                />
              ) : null}

              {onToggleLocationVisibility ? (
                <Pressable
                  onPress={() => {
                    onToggleLocationVisibility();
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    {
                      backgroundColor: theme.backgroundDefault,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.menuItemLeft}>
                    <Feather name="map-pin" size={20} color={theme.text} />
                    <View>
                      <ThemedText type="body" style={styles.menuItemText}>
                        Show Location
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={[styles.menuItemSubtitle, { color: theme.textSecondary }]}
                      >
                        {showLocationVisible ? "Visible to others" : "Hidden from profile"}
                      </ThemedText>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.toggleSwitch,
                      { backgroundColor: showLocationVisible ? "#FFD60A" : "#767577" },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        { marginLeft: showLocationVisible ? 22 : 2 },
                      ]}
                    />
                  </View>
                </Pressable>
              ) : null}

              <MenuItem
                icon="bell"
                label="Notifications"
                onPress={() => {
                  onClose();
                  navigation.navigate("Main", {
                    screen: "AccountTab",
                    params: { screen: "Notifications" },
                  } as any);
                }}
              />

              <MenuItem
                icon="bookmark"
                label="Saved Items"
                onPress={() => handleNavigate("Favorites")}
              />

              <MenuItem
                icon="star"
                label="Outsyde Points"
                onPress={() => {
                  onClose();
                  navigation.navigate("Main", {
                    screen: "AccountTab",
                    params: { screen: "OutsydePoints" },
                  } as any);
                }}
              />

              {user?.isInfluencer && user?.influencerStatus === "approved" ? (
                <MenuItem
                  icon="bar-chart-2"
                  label="Influencer Dashboard"
                  onPress={() => handleNavigate("InfluencerDashboard")}
                  color={theme.primary}
                  backgroundColor={theme.primaryTransparent}
                  subtitle="Stats, link, earnings, and tier"
                />
              ) : null}

              {!user?.isInfluencer && (user?.role === "consumer" || user?.isGuest) ? (
                <MenuItem
                  icon="star"
                  label="Apply as Influencer"
                  onPress={() => handleNavigate("InfluencerApplication")}
                  color={theme.primary}
                  backgroundColor={theme.primaryTransparent}
                />
              ) : null}
            </View>

            <View style={styles.section}>
              <ThemedText
                type="small"
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                Privacy
              </ThemedText>
              <MenuItem icon="slash" label="Blocked Users" onPress={() => handleNavigate("BlockedUsers")} />
            </View>

            <View style={styles.section}>
              <ThemedText
                type="small"
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                Support
              </ThemedText>
              <MenuItem icon="help-circle" label="Help Center" onPress={() => {}} />
              <MenuItem icon="file-text" label="Terms of Service" onPress={() => handleNavigate("TermsOfService")} />
              <MenuItem icon="shield" label="Privacy Policy" onPress={() => handleNavigate("PrivacyPolicy")} />
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#999",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150,150,150,0.2)",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuItemText: {
    marginLeft: Spacing.md,
  },
  menuItemSubtitle: {
    marginLeft: Spacing.md,
    marginTop: 2,
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

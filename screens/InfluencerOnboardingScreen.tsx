import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { api } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TIERS = [
  { name: "Bronze", range: "0% – 1%", color: "#CD7F32", description: "Just getting started" },
  { name: "Silver", range: "1% – 3%", color: "#C0C0C0", description: "Growing influence" },
  { name: "Gold", range: "3% – 6%", color: "#FFD700", description: "High performer" },
  { name: "Elite", range: "6%+", color: "#9B59B6", description: "Top creator" },
];

const PLATFORMS = [
  {
    icon: "instagram",
    name: "Instagram",
    instruction: "Add your link to your bio and tell viewers in your caption or story to tap the link in bio.",
  },
  {
    icon: "video",
    name: "TikTok",
    instruction: "Add your link to your bio and direct viewers in your video or caption to tap the link in bio.",
  },
  {
    icon: "youtube",
    name: "YouTube",
    instruction: "Place your link directly in the video description — viewers can click it without leaving the page.",
  },
  {
    icon: "twitter",
    name: "Twitter / X",
    instruction: "Include your link directly in your posts or pinned tweet.",
  },
];

export default function InfluencerOnboardingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, getAuthToken } = useAuth();

  const [referralLink, setReferralLink] = useState<string>(
    `https://outsyde.app/join?ref=${user?.username || "yourcode"}`
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const stats = await api.getInfluencerStats(token || "");
        setReferralLink(stats.referralLink);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [getAuthToken]);

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", `${label} copied to clipboard.`);
  };

  const PlatformCard = ({
    icon,
    name,
    instruction,
  }: {
    icon: string;
    name: string;
    instruction: string;
  }) => (
    <View style={[styles.platformCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
      <View style={[styles.platformIcon, { backgroundColor: theme.primary + "20" }]}>
        <Feather name={icon as any} size={22} color={theme.primary} />
      </View>
      <View style={styles.platformContent}>
        <ThemedText type="body" style={styles.platformName}>
          {name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }}>
          {instruction}
        </ThemedText>
        <Pressable
          onPress={() => handleCopy(referralLink, `${name} link`)}
          style={({ pressed }) => [
            styles.platformCopyBtn,
            { borderColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="copy" size={13} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
            Copy for {name}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.md, borderBottomColor: theme.border },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Welcome, Influencer</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.welcomeBanner, { backgroundColor: theme.primary + "18" }]}>
          <Feather name="star" size={28} color={theme.primary} />
          <ThemedText type="h3" style={{ color: theme.primary, marginTop: Spacing.sm }}>
            You're officially an Outsyde Influencer!
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs, lineHeight: 18 }}
          >
            Share your unique link and earn commissions on every sign-up and purchase you drive.
          </ThemedText>
        </View>

        <View style={[styles.linkSection, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            Your Unique Referral Link
          </ThemedText>
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <ThemedText
                type="body"
                style={[styles.linkText, { color: theme.primary }]}
                numberOfLines={1}
              >
                {referralLink}
              </ThemedText>
              <Pressable
                onPress={() => handleCopy(referralLink, "Referral link")}
                style={({ pressed }) => [
                  styles.copyBtn,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="copy" size={16} color="#FFF" />
                <ThemedText type="body" style={[styles.copyBtnText, { color: "#FFF" }]}>
                  Copy Link
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>

        <View>
          <ThemedText type="body" style={[styles.sectionTitle, { color: theme.text }]}>
            How to Share Your Link
          </ThemedText>
          {PLATFORMS.map((p) => (
            <PlatformCard key={p.name} {...p} />
          ))}
        </View>

        <View style={[styles.commissionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText type="body" style={[styles.sectionTitle, { color: theme.text }]}>
            Commission Structure
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18, marginBottom: Spacing.md }}>
            You earn a commission on every purchase made by a user who signed up through your link. Your tier is based on your rolling average conversion rate (sign-ups that lead to purchases).
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Your first post is commission-only — no upfront payment. As you grow, your tier and earnings increase automatically.
          </ThemedText>
        </View>

        <View>
          <ThemedText type="body" style={[styles.sectionTitle, { color: theme.text }]}>
            Influencer Tiers
          </ThemedText>
          {TIERS.map((tier) => (
            <View
              key={tier.name}
              style={[styles.tierRow, { backgroundColor: tier.color + "12", borderColor: tier.color + "33" }]}
            >
              <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
                <ThemedText type="small" style={[styles.tierBadgeText, { color: "#FFF" }]}>
                  {tier.name}
                </ThemedText>
              </View>
              <View style={styles.tierInfo}>
                <ThemedText type="body" style={{ color: tier.color, fontWeight: "700" }}>
                  {tier.range} conversion
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {tier.description}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <Button
          onPress={() => navigation.navigate("InfluencerDashboard")}
          style={styles.dashboardBtn}
        >
          Go to My Dashboard
        </Button>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  welcomeBanner: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  linkSection: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionLabel: { fontWeight: "500" },
  linkText: { fontWeight: "500" },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: 9999,
  },
  copyBtnText: { fontWeight: "700" },
  sectionTitle: { fontWeight: "700", marginBottom: Spacing.md },
  platformCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  platformContent: { flex: 1, gap: Spacing.xs },
  platformName: { fontWeight: "700" },
  platformCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: 9999,
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
  },
  commissionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  tierBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 9999,
    minWidth: 64,
    alignItems: "center",
  },
  tierBadgeText: { fontWeight: "700", fontSize: 13 },
  tierInfo: { flex: 1 },
  dashboardBtn: { marginTop: Spacing.sm },
});

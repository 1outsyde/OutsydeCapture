import React, { useEffect, useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { type TaxonomyCategory } from "@/services/api";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Every answer is sent and saved (2026-10-18): each social with its followers, what you post
// about (the shared industry list, up to 5, Other with words) and why you want to join.
const MAX_CATEGORIES = 5;

const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "X" },
] as const;
type PlatformKey = (typeof PLATFORMS)[number]["key"];

type ScreenState = "loading" | "form" | "pending" | "approved";

export default function InfluencerApplicationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { getToken, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<ScreenState>("loading");
  const [wasRejected, setWasRejected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handles, setHandles] = useState<Record<PlatformKey, string>>({ instagram: "", tiktok: "", youtube: "", twitter: "" });
  const [followers, setFollowers] = useState<Record<PlatformKey, string>>({ instagram: "", tiktok: "", youtube: "", twitter: "" });
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [contentOther, setContentOther] = useState("");
  const [why, setWhy] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const res = await api.getMyInfluencerApplication(token);
          const status = res?.application?.status;
          if (cancelled) return;
          if (status === "pending" || status === "approved") { setState(status); return; }
          setWasRejected(status === "rejected");
        }
      } catch {
        // Status unknown: show the form; the backend refuses a second application anyway.
      }
      if (!cancelled) setState("form");
    })();
    api.getBusinessTaxonomy()
      .then((t) => { if (!cancelled && Array.isArray(t?.categories)) setCategories(t.categories); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [getToken]);

  const toggleCategory = (code: string) => {
    setPicked((prev) => {
      if (prev.includes(code)) {
        if (code === "other") setContentOther("");
        return prev.filter((c) => c !== code);
      }
      return prev.length >= MAX_CATEGORIES ? prev : [...prev, code];
    });
  };

  const handleSubmit = async () => {
    if (!PLATFORMS.some((p) => handles[p.key].trim())) {
      Alert.alert("Your socials", "Please add at least one social media handle or link.");
      return;
    }
    if (picked.includes("other") && !contentOther.trim()) {
      Alert.alert("What you post about", "Tell us what you post about when you pick Other.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign in", "Please sign in to apply.");
        return;
      }
      await api.applyAsInfluencer(token, {
        instagramUrl: handles.instagram.trim() || undefined,
        tiktokUrl: handles.tiktok.trim() || undefined,
        youtubeUrl: handles.youtube.trim() || undefined,
        twitterUrl: handles.twitter.trim() || undefined,
        instagramFollowers: followers.instagram.trim() || undefined,
        tiktokFollowers: followers.tiktok.trim() || undefined,
        youtubeFollowers: followers.youtube.trim() || undefined,
        twitterFollowers: followers.twitter.trim() || undefined,
        contentCategories: picked,
        contentOther: picked.includes("other") ? contentOther.trim() : undefined,
        whyInfluencer: why.trim() || undefined,
      });
      setState("pending");
      // Picks up influencerStatus "pending" so the account menu stops offering Apply.
      refreshUser().catch(() => {});
      Alert.alert(
        "Application Submitted",
        "Thank you for applying to become an Outsyde influencer! We'll review your application and get back to you soon.",
      );
    } catch (error: any) {
      // The backend explains what to fix (for example "Add at least one social media handle or link").
      Alert.alert("Couldn't send your application", error?.message || "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
  ];

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
      <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}>
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>
      <ThemedText type="h3">Apply as Influencer</ThemedText>
      <View style={{ width: 40 }} />
    </View>
  );

  if (state === "loading") {
    return (
      <ThemedView style={styles.container}>
        {header}
        <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.xl }} />
      </ThemedView>
    );
  }

  if (state === "pending" || state === "approved") {
    return (
      <ThemedView style={styles.container}>
        {header}
        <View style={[styles.infoCard, { backgroundColor: theme.primary + "15", marginHorizontal: Spacing.lg }]}>
          <Feather name={state === "pending" ? "clock" : "check-circle"} size={24} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {state === "pending" ? "Application received" : "You're an Outsyde influencer"}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              {state === "pending"
                ? "We're reviewing your application and will get back to you soon."
                : "Your application was approved. Open your influencer dashboard from your account."}
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {header}

      <ScreenKeyboardAwareScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={[styles.infoCard, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="star" size={24} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Outsyde Influencer Program
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Get exclusive perks, early access to features, and partner with local businesses.
              {wasRejected ? " Your last application wasn't approved, but you're welcome to apply again." : ""}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="body" style={styles.sectionTitle}>Your socials</ThemedText>
        <ThemedText type="small" style={[styles.hint, { color: theme.textSecondary }]}>
          Add at least one. Followers are optional, for example 12500 or 3.5k.
        </ThemedText>
        {PLATFORMS.map((p) => (
          <View style={styles.row} key={p.key}>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" style={styles.label}>{p.label}</ThemedText>
              <TextInput
                style={inputStyle}
                value={handles[p.key]}
                onChangeText={(v) => setHandles((prev) => ({ ...prev, [p.key]: v }))}
                placeholder="@yourname or link"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.followersField}>
              <ThemedText type="small" style={styles.label}>Followers</ThemedText>
              <TextInput
                style={inputStyle}
                value={followers[p.key]}
                onChangeText={(v) => setFollowers((prev) => ({ ...prev, [p.key]: v }))}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ))}

        <ThemedText type="body" style={styles.sectionTitle}>What do you post about?</ThemedText>
        <ThemedText type="small" style={[styles.hint, { color: theme.textSecondary }]}>Pick up to {MAX_CATEGORIES}.</ThemedText>
        {categories.length === 0 ? (
          <ActivityIndicator color={theme.primary} style={{ alignSelf: "flex-start", marginBottom: Spacing.lg }} />
        ) : (
          <View style={styles.chips}>
            {categories.map((c) => {
              const on = picked.includes(c.code);
              const disabled = !on && picked.length >= MAX_CATEGORIES;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => toggleCategory(c.code)}
                  disabled={disabled}
                  style={[styles.chip, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary + "15" : theme.backgroundDefault, opacity: disabled ? 0.4 : 1 }]}
                >
                  <ThemedText type="small" style={{ color: on ? theme.primary : theme.text, fontWeight: on ? "600" : "400" }}>{c.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
        {picked.includes("other") ? (
          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>Tell us what you post about</ThemedText>
            <TextInput
              style={[inputStyle, styles.textArea]}
              value={contentOther}
              onChangeText={setContentOther}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        ) : null}

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>Why do you want to join?</ThemedText>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={why}
            onChangeText={setWhy}
            placeholder="Tell us about your content and the businesses you'd love to work with."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitButton}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : "Submit Application"}
        </Button>
      </ScreenKeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  hint: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  followersField: {
    width: 110,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
  },
  textArea: {
    height: 120,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
});

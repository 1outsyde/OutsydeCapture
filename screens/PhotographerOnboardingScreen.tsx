import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { VendorBookerPhotographer, PhotographerOnboardingData } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SUCCESS_COLOR = "#34C759";

const SPECIALTIES = [
  "weddings",
  "portraits",
  "events",
  "commercial",
  "fashion",
  "nature",
  "real_estate",
  "food",
];

const SPECIALTY_LABELS: Record<string, string> = {
  weddings: "Weddings",
  portraits: "Portraits",
  events: "Events",
  commercial: "Commercial",
  fashion: "Fashion",
  nature: "Nature & Landscape",
  real_estate: "Real Estate",
  food: "Food & Product",
};

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function PhotographerOnboardingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<VendorBookerPhotographer | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [willTravel, setWillTravel] = useState(false);

  useEffect(() => {
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    const authToken = await getToken();
    if (!authToken) {
      setLoading(false);
      return;
    }

    try {
      const profile = await api.getPhotographerMe(authToken);
      setExistingProfile(profile);
      
      if (profile.displayName) setDisplayName(profile.displayName);
      if (profile.bio) setBio(profile.bio);
      if (profile.city) setCity(profile.city);
      if (profile.state) setState(profile.state);
      if (profile.hourlyRate) setHourlyRate(String(profile.hourlyRate / 100));
      if (profile.portfolioUrl) setPortfolioUrl(profile.portfolioUrl);
      if (profile.specialties) setSelectedSpecialties(profile.specialties);
    } catch (error) {
      console.log("No existing profile found, starting fresh");
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!displayName.trim()) {
          Alert.alert("Required", "Please enter your display name");
          return false;
        }
        return true;
      case 2:
        if (!city.trim() || !state.trim()) {
          Alert.alert("Required", "Please enter your city and state");
          return false;
        }
        return true;
      case 3:
        if (!hourlyRate.trim() || isNaN(Number(hourlyRate))) {
          Alert.alert("Required", "Please enter a valid hourly rate");
          return false;
        }
        return true;
      case 4:
        if (selectedSpecialties.length === 0) {
          Alert.alert("Required", "Please select at least one specialty");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSaveProfile = async () => {
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "Please log in to continue");
      return;
    }

    setSaving(true);

    try {
      const data: PhotographerOnboardingData = {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        hourlyRate: Math.round(Number(hourlyRate) * 100),
        portfolioUrl: portfolioUrl.trim() || undefined,
        specialties: selectedSpecialties,
        willTravel,
      };

      await api.updatePhotographerMe(authToken, data);
      setStep(6);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    const authToken = await getToken();
    if (!authToken) return;

    try {
      setSaving(true);
      const { url } = await api.startPhotographerStripeOnboarding(authToken);
      
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
      
      navigation.navigate("Main", { screen: "AccountTab", params: { screen: "Account" } });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to start Stripe onboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStripe = () => {
    navigation.navigate("Main", { screen: "AccountTab", params: { screen: "Account" } });
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Loading profile...
        </ThemedText>
      </ThemedView>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Welcome! Let's set up your photographer profile
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              Enter your display name - this is how clients will see you
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Display Name *
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g., Sarah's Photography"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Bio (optional)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell clients about yourself and your photography style..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Where are you located?
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              Help clients in your area find you
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                City *
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={city}
                onChangeText={setCity}
                placeholder="e.g., Los Angeles"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                State *
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
                <View style={styles.stateRow}>
                  {US_STATES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setState(s)}
                      style={[
                        styles.stateChip,
                        {
                          backgroundColor: state === s ? theme.primary : theme.backgroundDefault,
                          borderColor: state === s ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: state === s ? "#fff" : theme.text }}
                      >
                        {s}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <Pressable
              onPress={() => setWillTravel(!willTravel)}
              style={[styles.checkbox, { borderColor: theme.border }]}
            >
              <View
                style={[
                  styles.checkboxInner,
                  { backgroundColor: willTravel ? theme.primary : "transparent" },
                ]}
              >
                {willTravel && <Feather name="check" size={14} color="#fff" />}
              </View>
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                I'm willing to travel for shoots
              </ThemedText>
            </Pressable>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Set your hourly rate
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              This is your base rate. You can customize service-specific pricing later.
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Hourly Rate (USD) *
              </ThemedText>
              <View style={styles.rateInputContainer}>
                <ThemedText type="h3" style={{ marginRight: Spacing.xs }}>
                  $
                </ThemedText>
                <TextInput
                  style={[styles.rateInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  placeholder="150"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                  / hour
                </ThemedText>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Portfolio URL (optional)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={portfolioUrl}
                onChangeText={setPortfolioUrl}
                placeholder="https://yourportfolio.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              What do you specialize in?
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              Select all that apply
            </ThemedText>

            <View style={styles.specialtiesGrid}>
              {SPECIALTIES.map((specialty) => {
                const isSelected = selectedSpecialties.includes(specialty);
                return (
                  <Pressable
                    key={specialty}
                    onPress={() => toggleSpecialty(specialty)}
                    style={[
                      styles.specialtyChip,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name={isSelected ? "check-circle" : "circle"}
                      size={18}
                      color={isSelected ? "#fff" : theme.textSecondary}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        marginLeft: Spacing.sm,
                        color: isSelected ? "#fff" : theme.text,
                      }}
                    >
                      {SPECIALTY_LABELS[specialty]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Review your profile
            </ThemedText>

            <View style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Display Name</ThemedText>
                <ThemedText type="body">{displayName}</ThemedText>
              </View>
              {bio && (
                <View style={styles.reviewRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Bio</ThemedText>
                  <ThemedText type="body" numberOfLines={2}>{bio}</ThemedText>
                </View>
              )}
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Location</ThemedText>
                <ThemedText type="body">{city}, {state}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Hourly Rate</ThemedText>
                <ThemedText type="body">${hourlyRate}/hr</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Specialties</ThemedText>
                <ThemedText type="body">
                  {selectedSpecialties.map((s) => SPECIALTY_LABELS[s]).join(", ")}
                </ThemedText>
              </View>
              {portfolioUrl && (
                <View style={styles.reviewRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Portfolio</ThemedText>
                  <ThemedText type="body" numberOfLines={1}>{portfolioUrl}</ThemedText>
                </View>
              )}
              {willTravel && (
                <View style={styles.reviewRow}>
                  <Feather name="check" size={16} color={SUCCESS_COLOR} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>Willing to travel</ThemedText>
                </View>
              )}
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <View style={[styles.successIcon, { backgroundColor: SUCCESS_COLOR + "20" }]}>
              <Feather name="check-circle" size={48} color={SUCCESS_COLOR} />
            </View>

            <ThemedText type="h3" style={[styles.stepTitle, { textAlign: "center" }]}>
              Profile saved!
            </ThemedText>

            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary, textAlign: "center" }]}>
              To receive payments for bookings, connect your Stripe account. You can do this later from your dashboard.
            </ThemedText>

            <View style={[styles.stripeCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="credit-card" size={24} color={theme.primary} />
              <ThemedText type="body" style={[styles.stripeText, { color: theme.text }]}>
                Connect Stripe to receive payments directly to your bank account
              </ThemedText>
            </View>
          </View>
        );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        
        {step < 6 && (
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: s <= step ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {step < 5 && (
          <Button onPress={handleNext} disabled={saving}>
            Continue
          </Button>
        )}
        {step === 5 && (
          <Button onPress={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        )}
        {step === 6 && (
          <>
            <Button onPress={handleConnectStripe} disabled={saving}>
              {saving ? "Loading..." : "Connect Stripe"}
            </Button>
            <Pressable
              onPress={handleSkipStripe}
              style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                I'll do this later
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepDescription: {
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    fontSize: 16,
  },
  stateScroll: {
    maxHeight: 44,
  },
  stateRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  stateChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  checkbox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  rateInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rateInput: {
    height: 48,
    width: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 20,
    fontWeight: "600",
  },
  specialtiesGrid: {
    gap: Spacing.sm,
  },
  specialtyChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reviewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  stripeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  stripeText: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  skipButton: {
    alignItems: "center",
    padding: Spacing.md,
  },
});

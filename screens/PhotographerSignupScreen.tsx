import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SPECIALTIES = [
  "Weddings",
  "Portraits",
  "Events",
  "Product",
  "Real Estate",
  "Fashion",
  "Sports",
  "Food",
  "Landscape",
  "Street",
  "Newborn",
  "Boudoir",
  "Corporate",
  "Concert",
  "Travel",
  "Wildlife",
];

const STEPS = [
  { id: 1, name: "Account" },
  { id: 2, name: "Profile" },
  { id: 3, name: "Location" },
  { id: 4, name: "Pricing" },
  { id: 5, name: "Specialties" },
  { id: 6, name: "Finish" },
];

export default function PhotographerSignupScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { signup, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [hourlyRate, setHourlyRate] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [specialties, setSpecialties] = useState<string[]>([]);

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      if (parts.length === 0) return "";
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return `(${parts[0]}) ${parts[1]}`;
      return `(${parts[0]}) ${parts[1]}-${parts[2]}`;
    }
    return text;
  };

  const toggleSpecialty = (specialty: string) => {
    setSpecialties(prev => 
      prev.includes(specialty) 
        ? prev.filter(s => s !== specialty) 
        : [...prev, specialty]
    );
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!email.trim() || !password.trim() || !name.trim() || !phone.trim()) {
          Alert.alert("Error", "Please fill in all required fields");
          return false;
        }
        if (password.length < 6) {
          Alert.alert("Error", "Password must be at least 6 characters");
          return false;
        }
        return true;
      case 2:
        if (!displayName.trim()) {
          Alert.alert("Error", "Please enter your display name");
          return false;
        }
        return true;
      case 3:
        if (!city.trim() || !state.trim()) {
          Alert.alert("Error", "Please enter your city and state");
          return false;
        }
        return true;
      case 4:
        if (!hourlyRate.trim()) {
          Alert.alert("Error", "Please enter your hourly rate");
          return false;
        }
        return true;
      case 5:
        if (specialties.length === 0) {
          Alert.alert("Error", "Please select at least one specialty");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    const storedRole = await AsyncStorage.getItem("@outsyde_user_type");
    if (!storedRole) {
      console.error("[PhotographerSignup] No role found in AsyncStorage — aborting signup");
      Alert.alert("Error", "Something went wrong. Please restart the app and try again.");
      return;
    }
    console.log("[PhotographerSignup] Role read from AsyncStorage:", storedRole);

    // Validate hourlyRate is a valid number
    const parsedRate = Number(hourlyRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      Alert.alert("Error", "Please enter a valid hourly rate");
      return;
    }

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Convert hourlyRate to cents (multiply by 100)
    const hourlyRateInCents = Math.round(parsedRate * 100);

    const result = await signup({
      firstName,
      lastName,
      email,
      phone: phone.replace(/\D/g, ""),
      dateOfBirth: "",
      password,
      role: storedRole as "consumer" | "business" | "photographer",
      displayName,
      bio,
      city,
      state,
      hourlyRate: hourlyRateInCents,
      portfolioUrl: portfolioUrl.trim() || undefined,
      specialties,
    });

    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert("Error", result.errorMessage || "Registration failed. Please try again.");
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Create Account</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Enter your personal details
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Full Name *</ThemedText>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Email *</ThemedText>
              <TextInput
                style={inputStyle}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Phone *</ThemedText>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={(text) => setPhone(formatPhone(text))}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Password *</ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Your Profile</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              How clients will see you
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Display Name *</ThemedText>
              <TextInput
                style={inputStyle}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your professional name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                This is how clients will find you
              </ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Bio</ThemedText>
              <TextInput
                style={[inputStyle, { height: 120, textAlignVertical: "top", paddingTop: Spacing.md }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell clients about yourself, your style, and experience..."
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={500}
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                {bio.length}/500 characters
              </ThemedText>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Location</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Where do you offer services?
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>City *</ThemedText>
              <TextInput
                style={inputStyle}
                value={city}
                onChangeText={setCity}
                placeholder="Your city"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>State *</ThemedText>
              <TextInput
                style={inputStyle}
                value={state}
                onChangeText={setState}
                placeholder="Your state (e.g., CA)"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Pricing</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Set your rates and showcase your work
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Hourly Rate *</ThemedText>
              <View style={styles.priceInputContainer}>
                <ThemedText type="body" style={{ color: theme.textSecondary, marginRight: Spacing.xs }}>$</ThemedText>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  value={hourlyRate}
                  onChangeText={(text) => setHourlyRate(text.replace(/\D/g, ""))}
                  placeholder="150"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>/hour</ThemedText>
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Portfolio URL</ThemedText>
              <TextInput
                style={inputStyle}
                value={portfolioUrl}
                onChangeText={setPortfolioUrl}
                placeholder="https://yourportfolio.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="url"
                autoCapitalize="none"
              />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Link to your website, Instagram, or portfolio
              </ThemedText>
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Specialties</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              What types of photography do you specialize in?
            </ThemedText>

            <View style={styles.specialtyGrid}>
              {SPECIALTIES.map((specialty) => (
                <Pressable
                  key={specialty}
                  onPress={() => toggleSpecialty(specialty)}
                  style={[
                    styles.specialtyChip,
                    {
                      backgroundColor: specialties.includes(specialty) 
                        ? theme.primary 
                        : theme.backgroundDefault,
                      borderColor: specialties.includes(specialty) 
                        ? theme.primary 
                        : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: specialties.includes(specialty) ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {specialty}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Selected: {specialties.length}
            </ThemedText>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <View style={[styles.successIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="camera" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h2" style={[styles.stepTitle, { textAlign: "center" }]}>You're Ready!</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary, textAlign: "center" }]}>
              Create your account and start booking clients
            </ThemedText>

            <View style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Display Name</ThemedText>
                <ThemedText type="body">{displayName}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Location</ThemedText>
                <ThemedText type="body">{city}, {state}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Hourly Rate</ThemedText>
                <ThemedText type="body">${hourlyRate}/hr</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Specialties</ThemedText>
                <ThemedText type="body">{specialties.slice(0, 3).join(", ")}{specialties.length > 3 ? "..." : ""}</ThemedText>
              </View>
            </View>

            <View style={[styles.noticeBox, { backgroundColor: "#007AFF15" }]}>
              <Feather name="check-circle" size={20} color="#007AFF" />
              <ThemedText type="small" style={{ color: "#007AFF", marginLeft: Spacing.sm, flex: 1 }}>
                Photographer accounts are auto-approved! You can start accepting bookings immediately.
              </ThemedText>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Step {currentStep} of {STEPS.length}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepContent()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.background }]}>
        {currentStep === 6 ? (
          <Button onPress={handleSubmit} style={styles.nextButton} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : "Create Account"}
          </Button>
        ) : (
          <Button onPress={handleNext} style={styles.nextButton}>
            Continue
          </Button>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: { marginRight: Spacing.md },
  progressContainer: { flex: 1 },
  progressBar: { height: 4, borderRadius: 2, marginBottom: Spacing.xs },
  progressFill: { height: "100%", borderRadius: 2 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  stepContent: {},
  stepTitle: { marginBottom: Spacing.xs },
  stepSubtitle: { marginBottom: Spacing.xl },
  field: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.xs, fontWeight: "600" },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  eyeButton: { position: "absolute", right: Spacing.md },
  priceInputContainer: { flexDirection: "row", alignItems: "center" },
  specialtyGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  specialtyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    margin: 4,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  reviewCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  noticeBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "flex-start",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  nextButton: { width: "100%" },
});

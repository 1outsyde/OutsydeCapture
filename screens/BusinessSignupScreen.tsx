import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, Switch } from "react-native";
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
import api from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BUSINESS_CATEGORIES = [
  "Food & Dining",
  "Beauty & Hair",
  "Art & Design",
  "Health & Wellness",
  "Fashion & Apparel",
  "Home Services",
  "Events & Entertainment",
  "Retail & Shopping",
  "Professional Services",
];

const OFFER_TYPES = [
  { id: "products", name: "Products Only", description: "I sell physical or digital products" },
  { id: "services", name: "Services Only", description: "I offer services and appointments" },
  { id: "both", name: "Products & Services", description: "I sell products and offer services" },
];

const YEARS_IN_BUSINESS = [
  "Just starting",
  "Less than 1 year",
  "1-2 years",
  "3-5 years",
  "5-10 years",
  "10+ years",
];

const EMPLOYEE_COUNTS = [
  "Just me",
  "2-5",
  "6-10",
  "11-25",
  "26-50",
  "51-100",
  "100+",
];

const BUSINESS_TYPES = [
  "Sole Proprietor",
  "LLC",
  "Corporation",
  "Partnership",
  "Nonprofit",
  "Other",
];

const STEPS = [
  { id: 1, name: "Account" },
  { id: 2, name: "Business Info" },
  { id: 3, name: "What You Offer" },
  { id: 4, name: "Business Details" },
  { id: 5, name: "Location" },
  { id: 6, name: "Online Presence" },
  { id: 7, name: "Review" },
];

export default function BusinessSignupScreen() {
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

  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");

  const [offerType, setOfferType] = useState<"products" | "services" | "both" | "">("");
  const [isStartup, setIsStartup] = useState(false);

  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [businessType, setBusinessType] = useState("");

  const [hasPhysicalLocation, setHasPhysicalLocation] = useState(true);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialMedia, setSocialMedia] = useState("");

  const [showPending, setShowPending] = useState(false);

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
        if (!businessName.trim() || !businessCategory) {
          Alert.alert("Error", "Please enter business name and select a category");
          return false;
        }
        return true;
      case 3:
        if (!offerType) {
          Alert.alert("Error", "Please select what you offer");
          return false;
        }
        return true;
      case 4:
        return true;
      case 5:
        if (!city.trim() || !state.trim()) {
          Alert.alert("Error", "Please enter city and state");
          return false;
        }
        return true;
      case 6:
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
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const result = await signup({
      firstName,
      lastName,
      email,
      phone: phone.replace(/\D/g, ""),
      dateOfBirth: "",
      password,
      role: "business",
      businessName,
      businessCategory,
      businessDescription,
      offerType: offerType as "products" | "services" | "both",
      isStartup,
      yearsInBusiness,
      employeeCount,
      businessType,
      hasPhysicalLocation,
      address,
      city,
      state,
      zipCode,
      websiteUrl,
      socialMedia,
    });

    if (result.success) {
      if (result.isPending) {
        api.notifyAdminBusinessApplication({
          businessName,
          businessCategory,
          ownerName: name,
          ownerEmail: email,
          city,
          state,
        });
        setShowPending(true);
      } else {
        navigation.goBack();
      }
    } else {
      Alert.alert("Error", "Registration failed. Please try again.");
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
  ];

  if (showPending) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.pendingContainer, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.pendingIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="clock" size={64} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.pendingTitle}>Application Submitted</ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: theme.textSecondary }]}>
            Thank you for registering your business with Outsyde! Your application is now under review.
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: theme.textSecondary }]}>
            Our team will review your application and get back to you within 24-48 hours.
          </ThemedText>
          <View style={styles.pendingDetails}>
            <View style={styles.pendingDetailRow}>
              <Feather name="briefcase" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{businessName}</ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="tag" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{businessCategory}</ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="mail" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{email}</ThemedText>
            </View>
          </View>
          <Button onPress={() => navigation.goBack()} style={styles.pendingButton}>
            Got it
          </Button>
        </View>
      </ThemedView>
    );
  }

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
              <ThemedText type="small" style={styles.label}>Your Full Name *</ThemedText>
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
            <ThemedText type="h2" style={styles.stepTitle}>Business Info</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Tell us about your business
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Business Name *</ThemedText>
              <TextInput
                style={inputStyle}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Your business name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Category *</ThemedText>
              <View style={styles.categoryGrid}>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setBusinessCategory(cat)}
                    style={[
                      styles.categoryButton,
                      {
                        backgroundColor: businessCategory === cat ? theme.primary : theme.backgroundDefault,
                        borderColor: businessCategory === cat ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: businessCategory === cat ? "#FFFFFF" : theme.text }}
                    >
                      {cat}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Description</ThemedText>
              <TextInput
                style={[inputStyle, { height: 100, textAlignVertical: "top", paddingTop: Spacing.md }]}
                value={businessDescription}
                onChangeText={setBusinessDescription}
                placeholder="Tell customers about your business..."
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>What You Offer</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              What does your business provide?
            </ThemedText>

            <View style={styles.offerList}>
              {OFFER_TYPES.map((offer) => (
                <Pressable
                  key={offer.id}
                  onPress={() => setOfferType(offer.id as "products" | "services" | "both")}
                  style={[
                    styles.offerCard,
                    {
                      backgroundColor: offerType === offer.id ? theme.primary + "15" : theme.backgroundDefault,
                      borderColor: offerType === offer.id ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View style={styles.offerContent}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{offer.name}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{offer.description}</ThemedText>
                  </View>
                  {offerType === offer.id ? (
                    <Feather name="check-circle" size={24} color={theme.primary} />
                  ) : (
                    <Feather name="circle" size={24} color={theme.border} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={[styles.switchRow, { marginTop: Spacing.xl }]}>
              <View style={styles.switchContent}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Is this a startup?</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  New business less than 2 years old
                </ThemedText>
              </View>
              <Switch
                value={isStartup}
                onValueChange={setIsStartup}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Business Details</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Help us understand your business better
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Years in Business</ThemedText>
              <View style={styles.optionGrid}>
                {YEARS_IN_BUSINESS.map((years) => (
                  <Pressable
                    key={years}
                    onPress={() => setYearsInBusiness(years)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: yearsInBusiness === years ? theme.primary : theme.backgroundDefault,
                        borderColor: yearsInBusiness === years ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: yearsInBusiness === years ? "#FFFFFF" : theme.text }}
                    >
                      {years}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Number of Employees</ThemedText>
              <View style={styles.optionGrid}>
                {EMPLOYEE_COUNTS.map((count) => (
                  <Pressable
                    key={count}
                    onPress={() => setEmployeeCount(count)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: employeeCount === count ? theme.primary : theme.backgroundDefault,
                        borderColor: employeeCount === count ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: employeeCount === count ? "#FFFFFF" : theme.text }}
                    >
                      {count}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Business Structure</ThemedText>
              <View style={styles.optionGrid}>
                {BUSINESS_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setBusinessType(type)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: businessType === type ? theme.primary : theme.backgroundDefault,
                        borderColor: businessType === type ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: businessType === type ? "#FFFFFF" : theme.text }}
                    >
                      {type}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Location</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Where is your business located?
            </ThemedText>

            <View style={[styles.switchRow, { marginBottom: Spacing.lg }]}>
              <View style={styles.switchContent}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>Physical Location?</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Do you have a storefront or office?
                </ThemedText>
              </View>
              <Switch
                value={hasPhysicalLocation}
                onValueChange={setHasPhysicalLocation}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>

            {hasPhysicalLocation ? (
              <View style={styles.field}>
                <ThemedText type="small" style={styles.label}>Street Address</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main Street"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            ) : null}

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

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: Spacing.sm }]}>
                <ThemedText type="small" style={styles.label}>State *</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={state}
                  onChangeText={setState}
                  placeholder="State"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText type="small" style={styles.label}>Zip Code</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={zipCode}
                  onChangeText={setZipCode}
                  placeholder="12345"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Online Presence</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Share your online presence (optional)
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Website URL</ThemedText>
              <TextInput
                style={inputStyle}
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                placeholder="https://yourbusiness.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Social Media</ThemedText>
              <TextInput
                style={inputStyle}
                value={socialMedia}
                onChangeText={setSocialMedia}
                placeholder="@yourbusiness (Instagram, TikTok, etc.)"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContent}>
            <View style={[styles.reviewIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="check-circle" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h2" style={[styles.stepTitle, { textAlign: "center" }]}>Review & Submit</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary, textAlign: "center" }]}>
              Please review your information before submitting
            </ThemedText>

            <View style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Business Name</ThemedText>
                <ThemedText type="body">{businessName}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Category</ThemedText>
                <ThemedText type="body">{businessCategory}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Offer Type</ThemedText>
                <ThemedText type="body">{OFFER_TYPES.find(o => o.id === offerType)?.name}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Location</ThemedText>
                <ThemedText type="body">{city}, {state}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Contact</ThemedText>
                <ThemedText type="body">{email}</ThemedText>
              </View>
            </View>

            <View style={[styles.noticeBox, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="info" size={20} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm, flex: 1 }}>
                Business accounts require manual approval. We'll review your application within 24-48 hours.
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
        {currentStep === 7 ? (
          <Button onPress={handleSubmit} style={styles.nextButton} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : "Submit Application"}
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
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  categoryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    margin: 4,
  },
  offerList: { gap: Spacing.sm },
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  offerContent: { flex: 1 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  switchContent: { flex: 1 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    margin: 4,
  },
  row: { flexDirection: "row" },
  reviewIcon: {
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
  pendingContainer: { flex: 1, alignItems: "center", padding: Spacing.xl },
  pendingIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  pendingTitle: { textAlign: "center", marginBottom: Spacing.md },
  pendingText: { textAlign: "center", marginBottom: Spacing.md },
  pendingDetails: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  pendingDetailRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  pendingButton: { width: "100%" },
});

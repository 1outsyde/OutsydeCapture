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
import api, { VendorBookerBusiness, BusinessOnboardingData } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SUCCESS_COLOR = "#34C759";

const CATEGORIES = [
  { value: "food_dining", label: "Food & Dining" },
  { value: "beauty_hair", label: "Beauty & Hair" },
  { value: "art_design", label: "Art & Design" },
  { value: "health_wellness", label: "Health & Wellness" },
  { value: "fashion", label: "Fashion & Apparel" },
  { value: "home_services", label: "Home Services" },
  { value: "events", label: "Events & Entertainment" },
  { value: "retail", label: "Retail & Shopping" },
  { value: "professional", label: "Professional Services" },
  { value: "other", label: "Other" },
];

const BUSINESS_STRUCTURES = [
  { value: "sole_proprietor", label: "Sole Proprietor" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Non-Profit" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function BusinessOnboardingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingBusiness, setExistingBusiness] = useState<VendorBookerBusiness | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [hasProducts, setHasProducts] = useState(false);
  const [hasServices, setHasServices] = useState(false);
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [numberOfEmployees, setNumberOfEmployees] = useState("");
  const [businessStructure, setBusinessStructure] = useState("");
  const [hasPhysicalLocation, setHasPhysicalLocation] = useState(true);
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate("Auth", { returnTo: "BusinessOnboarding" });
      return;
    }
    loadExistingBusiness();
  }, [isAuthenticated]);

  const loadExistingBusiness = async () => {
    const authToken = await getToken();
    if (!authToken) {
      setLoading(false);
      return;
    }

    try {
      const { business } = await api.getVendorMyBusiness(authToken);
      setExistingBusiness(business);
      
      if (business.name) setName(business.name);
      if (business.category) setCategory(business.category);
      if (business.description) setDescription(business.description);
      if (business.tagline) setTagline(business.tagline);
      if (business.city) setCity(business.city);
      if (business.state) setState(business.state);
      setHasProducts(business.hasProducts);
      setHasServices(business.hasServices);
      if (business.contactEmail) setContactEmail(business.contactEmail);
      if (business.contactPhone) setContactPhone(business.contactPhone);
      if (business.websiteUrl) setWebsiteUrl(business.websiteUrl);
    } catch (error) {
      console.log("No existing business found, starting fresh");
    } finally {
      setLoading(false);
    }
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!name.trim()) {
          Alert.alert("Required", "Please enter your business name");
          return false;
        }
        if (!category) {
          Alert.alert("Required", "Please select a category");
          return false;
        }
        return true;
      case 2:
        if (!hasProducts && !hasServices) {
          Alert.alert("Required", "Please select at least one: products or services");
          return false;
        }
        return true;
      case 3:
        if (!city.trim() || !state.trim()) {
          Alert.alert("Required", "Please enter your city and state");
          return false;
        }
        return true;
      case 4:
        if (!contactEmail.trim()) {
          Alert.alert("Required", "Please enter a contact email");
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

  const handleSaveBusiness = async () => {
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "Please log in to continue");
      return;
    }

    setSaving(true);

    try {
      const data: BusinessOnboardingData = {
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        tagline: tagline.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        hasProducts,
        hasServices,
        yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness) : undefined,
        numberOfEmployees: numberOfEmployees ? parseInt(numberOfEmployees) : undefined,
        businessStructure: businessStructure || undefined,
        hasPhysicalLocation,
        address: address.trim() || undefined,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
      };

      await api.updateVendorMyBusiness(authToken, data);
      setStep(6);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save business profile");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    const authToken = await getToken();
    if (!authToken) return;

    try {
      setSaving(true);
      const { url } = await api.startVendorStripeOnboarding(authToken);
      
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
          Loading business profile...
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
              Tell us about your business
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              This information helps customers find you
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Business Name *
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Urban Cuts Barbershop"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Category *
              </ThemedText>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: category === cat.value ? theme.primary : theme.backgroundDefault,
                        borderColor: category === cat.value ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color: category === cat.value ? "#fff" : theme.text }}
                    >
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Tagline (optional)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={tagline}
                onChangeText={setTagline}
                placeholder="A short catchy phrase for your business"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              What do you offer?
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              Select all that apply to your business
            </ThemedText>

            <View style={styles.offeringsContainer}>
              <Pressable
                onPress={() => setHasProducts(!hasProducts)}
                style={[
                  styles.offeringCard,
                  {
                    backgroundColor: hasProducts ? theme.primary + "15" : theme.backgroundDefault,
                    borderColor: hasProducts ? theme.primary : theme.border,
                  },
                ]}
              >
                <View style={[styles.offeringIcon, { backgroundColor: hasProducts ? theme.primary : theme.border }]}>
                  <Feather name="shopping-bag" size={24} color={hasProducts ? "#fff" : theme.textSecondary} />
                </View>
                <ThemedText type="h4">Products</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  Physical or digital items for sale
                </ThemedText>
                <View style={[styles.checkCircle, { borderColor: hasProducts ? theme.primary : theme.border }]}>
                  {hasProducts && <Feather name="check" size={16} color={theme.primary} />}
                </View>
              </Pressable>

              <Pressable
                onPress={() => setHasServices(!hasServices)}
                style={[
                  styles.offeringCard,
                  {
                    backgroundColor: hasServices ? theme.primary + "15" : theme.backgroundDefault,
                    borderColor: hasServices ? theme.primary : theme.border,
                  },
                ]}
              >
                <View style={[styles.offeringIcon, { backgroundColor: hasServices ? theme.primary : theme.border }]}>
                  <Feather name="calendar" size={24} color={hasServices ? "#fff" : theme.textSecondary} />
                </View>
                <ThemedText type="h4">Services</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  Appointments or bookable services
                </ThemedText>
                <View style={[styles.checkCircle, { borderColor: hasServices ? theme.primary : theme.border }]}>
                  {hasServices && <Feather name="check" size={16} color={theme.primary} />}
                </View>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Business Structure (optional)
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.structureRow}>
                  {BUSINESS_STRUCTURES.map((struct) => (
                    <Pressable
                      key={struct.value}
                      onPress={() => setBusinessStructure(struct.value)}
                      style={[
                        styles.structureChip,
                        {
                          backgroundColor: businessStructure === struct.value ? theme.primary : theme.backgroundDefault,
                          borderColor: businessStructure === struct.value ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: businessStructure === struct.value ? "#fff" : theme.text }}
                      >
                        {struct.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Where is your business located?
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              Help local customers find you
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
              onPress={() => setHasPhysicalLocation(!hasPhysicalLocation)}
              style={[styles.checkbox, { borderColor: theme.border }]}
            >
              <View
                style={[
                  styles.checkboxInner,
                  { backgroundColor: hasPhysicalLocation ? theme.primary : "transparent", borderColor: theme.border },
                ]}
              >
                {hasPhysicalLocation && <Feather name="check" size={14} color="#fff" />}
              </View>
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                I have a physical location customers can visit
              </ThemedText>
            </Pressable>

            {hasPhysicalLocation && (
              <View style={[styles.inputGroup, { marginTop: Spacing.lg }]}>
                <ThemedText type="caption" style={styles.inputLabel}>
                  Street Address (optional)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main Street"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            )}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Contact Information
            </ThemedText>
            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary }]}>
              How can customers reach you?
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Contact Email *
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="hello@yourbusiness.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Phone Number (optional)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Website (optional)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                placeholder="https://yourbusiness.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="caption" style={styles.inputLabel}>
                Description (optional)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Tell customers what makes your business special..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h3" style={styles.stepTitle}>
              Review your business
            </ThemedText>

            <View style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Business Name</ThemedText>
                <ThemedText type="body">{name}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Category</ThemedText>
                <ThemedText type="body">
                  {CATEGORIES.find((c) => c.value === category)?.label || category}
                </ThemedText>
              </View>
              {tagline ? (
                <View style={styles.reviewRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Tagline</ThemedText>
                  <ThemedText type="body">{tagline}</ThemedText>
                </View>
              ) : null}
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Offerings</ThemedText>
                <ThemedText type="body">
                  {[hasProducts && "Products", hasServices && "Services"].filter(Boolean).join(" & ")}
                </ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Location</ThemedText>
                <ThemedText type="body">{city}, {state}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Email</ThemedText>
                <ThemedText type="body">{contactEmail}</ThemedText>
              </View>
              {contactPhone ? (
                <View style={styles.reviewRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Phone</ThemedText>
                  <ThemedText type="body">{contactPhone}</ThemedText>
                </View>
              ) : null}
              {websiteUrl ? (
                <View style={styles.reviewRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Website</ThemedText>
                  <ThemedText type="body" numberOfLines={1}>{websiteUrl}</ThemedText>
                </View>
              ) : null}
            </View>

            <View style={[styles.noteCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
              <Feather name="info" size={18} color={theme.primary} />
              <ThemedText type="caption" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Business accounts require manual approval (24-48 hours). We'll notify you once approved.
              </ThemedText>
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
              Business profile submitted!
            </ThemedText>

            <ThemedText type="body" style={[styles.stepDescription, { color: theme.textSecondary, textAlign: "center" }]}>
              Your application is pending approval. While you wait, you can connect Stripe to prepare for receiving payments.
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
          <Button onPress={handleSaveBusiness} disabled={saving}>
            {saving ? "Submitting..." : "Submit Application"}
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
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  offeringsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  offeringCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: "center",
    gap: Spacing.sm,
  },
  offeringIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  structureRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  structureChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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

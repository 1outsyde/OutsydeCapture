import React, { useState, useEffect } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, Switch, Image, Linking, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { API_BASE_URL, type BusinessTaxonomy, type TaxonomySpecialty } from "@/services/api";
import UsernameField from "@/components/UsernameField";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Industries come from the shared list (GET /api/taxonomy/business-categories), the same
// list goutsyde.com uses. Codes are stored by the backend and never change.
const OTHER_DESCRIPTION_MAX = 500;
const isOtherCode = (code: string) => code === "other" || code.endsWith(".other");

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
  { id: 8, name: "Agreement" },
];

export default function BusinessSignupScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "BusinessSignup">>();
  const { signup, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const prefillName = route.params?.prefillName ?? "";
  const prefillEmail = route.params?.prefillEmail ?? "";

  const [currentStep, setCurrentStep] = useState(1);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showFormError, setShowFormError] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (prefillName) {
      const parts = prefillName.trim().split(" ");
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" ") ?? "");
    }
  }, [prefillName]);

  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profilePhotoMimeType, setProfilePhotoMimeType] = useState<string | undefined>(undefined);

  const handlePickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setProfilePhotoUri(result.assets[0].uri);
      setProfilePhotoMimeType(result.assets[0].mimeType ?? undefined);
    }
  };

  const [businessName, setBusinessName] = useState("");
  // Industry (shared list)
  const [taxonomy, setTaxonomy] = useState<BusinessTaxonomy | null>(null);
  const [taxonomyError, setTaxonomyError] = useState(false);
  const [categoryCode, setCategoryCode] = useState("");
  const [businessSpecialties, setBusinessSpecialties] = useState<string[]>([]);
  const [otherDescription, setOtherDescription] = useState("");

  const loadTaxonomy = async (isCancelled: () => boolean = () => false) => {
    try {
      const data = await api.getBusinessTaxonomy();
      if (isCancelled()) return;
      if (data && Array.isArray(data.categories)) {
        setTaxonomy(data);
        setTaxonomyError(false);
      } else {
        setTaxonomyError(true);
      }
    } catch {
      if (!isCancelled()) setTaxonomyError(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadTaxonomy(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = taxonomy?.categories.find((c) => c.code === categoryCode);
  // Readable label (shown on review / pending screens and sent as businessCategory).
  const businessCategory = selectedCategory?.label ?? "";
  const maxSpecialties = taxonomy?.maxSpecialties ?? 3;
  const needsOtherDescription = categoryCode === "other" || businessSpecialties.some(isOtherCode);
  const [businessDescription, setBusinessDescription] = useState("");

  const [offerType, setOfferType] = useState<"products" | "services" | "both" | "">("");
  const [isStartup, setIsStartup] = useState(false);
  const [isMultiStaff, setIsMultiStaff] = useState(false);

  // "What do you do?" choices for the chosen industry, filtered by what the business offers.
  const specialtiesForOffer = (offer: typeof offerType): TaxonomySpecialty[] => {
    if (!selectedCategory || !offer) return [];
    return selectedCategory.specialties.filter((sp) =>
      offer === "both" ? true : offer === "services" ? sp.kind === "service" : sp.kind === "product",
    );
  };
  const availableSpecialties = specialtiesForOffer(offerType);

  const chooseCategory = (code: string) => {
    if (code === categoryCode) return;
    setCategoryCode(code);
    setBusinessSpecialties([]);
  };

  const chooseOffer = (next: "products" | "services" | "both") => {
    setOfferType(next);
    if (next === "products") setIsMultiStaff(false);
    // Drop picks that no longer fit (e.g. product picks after switching to services only).
    const allowed = new Set(specialtiesForOffer(next).map((sp) => sp.code));
    setBusinessSpecialties((prev) => prev.filter((c) => allowed.has(c)));
  };

  const toggleSpecialty = (code: string) => {
    setBusinessSpecialties((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= maxSpecialties) return prev;
      return [...prev, code];
    });
  };

  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [businessType, setBusinessType] = useState("");

  const [hasPhysicalLocation, setHasPhysicalLocation] = useState(true);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZipCode, setBillingZipCode] = useState("");

  useEffect(() => {
    const prefillLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const savedCity = await AsyncStorage.getItem("@outsyde_onboarding_city");
          const savedState = await AsyncStorage.getItem("@outsyde_onboarding_state");
          if (savedCity) setCity(savedCity);
          if (savedState) setState(savedState);
        }
      } catch (e) {
        // Silent fail — user can fill manually
      }
    };
    prefillLocation();
  }, []);

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
        if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim() || !phone.trim()) {
          Alert.alert("Error", "Please fill in all required fields");
          return false;
        }
        if (username.length < 3 || usernameAvailable === false) {
          Alert.alert("Error", "Please choose a valid, available username (min 3 characters)");
          return false;
        }
        if (password.length < 6) {
          Alert.alert("Error", "Password must be at least 6 characters");
          return false;
        }
        return true;
      case 2:
        if (!businessName.trim() || !selectedCategory) {
          Alert.alert(
            "Error",
            taxonomyError ? "We couldn't load the industry list. Please try again." : "Please enter business name and select your industry",
          );
          return false;
        }
        return true;
      case 3:
        if (!offerType) {
          Alert.alert("Error", "Please select what you offer");
          return false;
        }
        if (categoryCode !== "other" && businessSpecialties.length === 0) {
          Alert.alert("Error", "Please choose at least one thing you do");
          return false;
        }
        if (needsOtherDescription && !otherDescription.trim()) {
          Alert.alert("Error", "Please tell us what your business does");
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

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null;
    switch (field) {
      case "firstName": return !firstName.trim() ? "This field is required" : null;
      case "lastName": return !lastName.trim() ? "This field is required" : null;
      case "email": return !email.trim() ? "This field is required" : !/\S+@\S+\.\S+/.test(email) ? "Please enter a valid email address" : null;
      case "phone": return !phone.trim() ? "This field is required" : null;
      case "password": return password.length === 0 ? "This field is required" : password.length < 6 ? "Password must be at least 6 characters" : null;
      default: return null;
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!agreedToTerms) { Alert.alert("Required", "Please agree to the Terms of Service and Privacy Policy to continue."); return; }
      const allTouched = { firstName: true, lastName: true, username: true, email: true, phone: true, password: true };
      setTouched(allTouched);
      const step1Valid =
        firstName.trim() !== "" &&
        lastName.trim() !== "" &&
        username.length >= 3 &&
        usernameAvailable !== false &&
        email.trim() !== "" &&
        /\S+@\S+\.\S+/.test(email) &&
        phone.trim() !== "" &&
        password.length >= 6;
      if (!step1Valid) {
        setShowFormError(true);
        return;
      }
      setShowFormError(false);
      setCurrentStep(prev => prev + 1);
      return;
    }
    if (!validateStep()) return;
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep === 8) {
      setHasScrolledToBottom(false);
      setAgreementChecked(false);
    }
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleAgreementScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (atBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSubmit = async () => {
    const logoImage =
      profilePhotoUri && /^https?:\/\//i.test(profilePhotoUri) ? profilePhotoUri : null;
    // A logo picked on the device is uploaded right after the account exists (AuthContext.signup).
    const logoLocalUri = profilePhotoUri && !logoImage ? profilePhotoUri : undefined;

    const businessDetailsPayload = {
      phone: phone.replace(/\D/g, ""),
      businessDescription,
      logoImage,
      isStartup,
      isMultiStaff,
      yearsInBusiness,
      employeeCount,
      businessType,
      hasPhysicalLocation,
      address,
      city,
      state,
      zipCode,
      billingAddress: !hasPhysicalLocation ? billingAddress : address,
      billingCity: !hasPhysicalLocation ? billingCity : city,
      billingState: !hasPhysicalLocation ? billingState : state,
      billingZipCode: !hasPhysicalLocation ? billingZipCode : zipCode,
      websiteUrl,
      socialMedia,
    };

    const result = await signup({
      firstName,
      lastName,
      email,
      phone: businessDetailsPayload.phone,
      dateOfBirth: "",
      password,
      username,
      role: "business",
      businessName,
      businessCategory,
      businessDescription: businessDetailsPayload.businessDescription,
      offerType: offerType as "products" | "services" | "both",
      logoImage: businessDetailsPayload.logoImage,
      profileImageUrl: businessDetailsPayload.logoImage || undefined,
      isStartup: businessDetailsPayload.isStartup,
      isMultiStaff: businessDetailsPayload.isMultiStaff,
      yearsInBusiness: businessDetailsPayload.yearsInBusiness,
      employeeCount: businessDetailsPayload.employeeCount,
      businessType: businessDetailsPayload.businessType,
      hasPhysicalLocation: businessDetailsPayload.hasPhysicalLocation,
      address: businessDetailsPayload.address,
      city: businessDetailsPayload.city,
      state: businessDetailsPayload.state,
      zipCode: businessDetailsPayload.zipCode,
      billingAddress: !hasPhysicalLocation ? billingAddress : address,
      billingCity: !hasPhysicalLocation ? billingCity : city,
      billingState: !hasPhysicalLocation ? billingState : state,
      billingZipCode: !hasPhysicalLocation ? billingZipCode : zipCode,
      websiteUrl: businessDetailsPayload.websiteUrl,
      socialMedia: businessDetailsPayload.socialMedia,
      vendorAgreementAccepted: agreementChecked,
      vendorAgreementAcceptedAt: new Date().toISOString(),
      categoryCode,
      businessSpecialties,
      otherDescription: needsOtherDescription ? otherDescription.trim() : undefined,
      logoLocalUri,
      logoMimeType: profilePhotoMimeType,
    });

    if (result.success) {
      if (result.isPending) {
        setShowPending(true);
      } else {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }));
      }
    } else {
      const msg = result.errorMessage || "";
      if (msg.toLowerCase().includes("username")) {
        const isTaken = msg.toLowerCase().includes("taken") || msg.toLowerCase().includes("already");
        setUsernameError(isTaken ? "That username was just taken — please choose another" : msg);
        setUsernameAvailable(null);
        setCurrentStep(1);
      } else {
        if (/already registered/i.test(msg)) {
          // Some of these accounts were made for the person (old website signups) and have no
          // password yet — ClaimAccount emails a code to finish it. Others just need to sign in.
          Alert.alert(
            "You already have an account",
            "This email is already registered. Sign in, or if you never created a password, finish your account.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Sign in", onPress: () => navigation.navigate("Auth", {}) },
              { text: "Finish my account", onPress: () => navigation.navigate("ClaimAccount", { email: email.trim().toLowerCase() }) },
            ],
          );
        } else {
          Alert.alert("Error", msg || "Registration failed. Please try again.");
        }
      }
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
              Just a few details and you're in
            </ThemedText>

            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={styles.label}>First Name *</ThemedText>
                <TextInput
                  style={[inputStyle, touched.firstName && getFieldError("firstName") ? { borderColor: "#E05252" } : {}]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="words"
                  onBlur={() => setTouched(t => ({ ...t, firstName: true }))}
                />
                {touched.firstName && getFieldError("firstName") ? (
                  <ThemedText style={styles.fieldError}>{getFieldError("firstName")}</ThemedText>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={styles.label}>Last Name *</ThemedText>
                <TextInput
                  style={[inputStyle, touched.lastName && getFieldError("lastName") ? { borderColor: "#E05252" } : {}]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="words"
                  onBlur={() => setTouched(t => ({ ...t, lastName: true }))}
                />
                {touched.lastName && getFieldError("lastName") ? (
                  <ThemedText style={styles.fieldError}>{getFieldError("lastName")}</ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Username *</ThemedText>
              <UsernameField
                value={username}
                onChange={(v) => { setUsername(v); setUsernameError(null); setTouched(t => ({ ...t, username: true })); }}
                onAvailabilityChange={setUsernameAvailable}
                externalError={usernameError}
                inputBaseStyle={[styles.input, { backgroundColor: theme.backgroundDefault }]}
                theme={theme}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Email *</ThemedText>
              <TextInput
                style={[inputStyle, touched.email && getFieldError("email") ? { borderColor: "#E05252" } : {}]}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
              />
              {touched.email && getFieldError("email") ? (
                <ThemedText style={styles.fieldError}>{getFieldError("email")}</ThemedText>
              ) : null}
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Phone *</ThemedText>
              <TextInput
                style={[inputStyle, touched.phone && getFieldError("phone") ? { borderColor: "#E05252" } : {}]}
                value={phone}
                onChangeText={(text) => setPhone(formatPhone(text))}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                maxLength={14}
                onBlur={() => setTouched(t => ({ ...t, phone: true }))}
              />
              {touched.phone && getFieldError("phone") ? (
                <ThemedText style={styles.fieldError}>{getFieldError("phone")}</ThemedText>
              ) : null}
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Password *</ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[inputStyle, { flex: 1, marginBottom: 0 }, touched.password && getFieldError("password") ? { borderColor: "#E05252" } : {}]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
              {touched.password && getFieldError("password") ? (
                <ThemedText style={styles.fieldError}>{getFieldError("password")}</ThemedText>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: Spacing.md, marginBottom: Spacing.lg }}>
              <Pressable onPress={() => setAgreedToTerms(v => !v)}>
                <Feather
                  name={agreedToTerms ? "check-square" : "square"}
                  size={20}
                  color={agreedToTerms ? theme.primary : theme.textSecondary}
                />
              </Pressable>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: Spacing.sm, flex: 1 }}>
                <ThemedText type="small" style={{ color: theme.text }}>{"I agree to the "}</ThemedText>
                <ThemedText
                  type="small"
                  onPress={() => Linking.openURL("https://www.goutsyde.com/terms")}
                  style={{ color: theme.primary, textDecorationLine: "underline" }}
                >
                  {"Terms of Service"}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.text }}>{" and "}</ThemedText>
                <ThemedText
                  type="small"
                  onPress={() => Linking.openURL("https://www.goutsyde.com/privacy")}
                  style={{ color: theme.primary, textDecorationLine: "underline" }}
                >
                  {"Privacy Policy"}
                </ThemedText>
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

            <Pressable onPress={handlePickProfilePhoto} style={{ alignSelf: "center", marginBottom: 4 }}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePhotoCircle} />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Feather name="camera" size={28} color="#C9933A" />
                  <ThemedText style={styles.profilePhotoHint}>Business Logo</ThemedText>
                </View>
              )}
            </Pressable>
            <ThemedText style={styles.profilePhotoOptional}>Optional</ThemedText>

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
              <ThemedText type="small" style={styles.label}>Industry *</ThemedText>
              {taxonomyError ? (
                <Pressable onPress={() => { setTaxonomyError(false); loadTaxonomy(); }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {"We couldn't load the industry list. Tap to try again."}
                  </ThemedText>
                </Pressable>
              ) : !taxonomy ? (
                <ActivityIndicator color={theme.primary} style={{ alignSelf: "flex-start", marginTop: Spacing.sm }} />
              ) : (
                <View style={styles.categoryGrid}>
                  {taxonomy.categories.map((cat) => (
                    <Pressable
                      key={cat.code}
                      onPress={() => chooseCategory(cat.code)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: categoryCode === cat.code }}
                      style={[
                        styles.categoryButton,
                        {
                          backgroundColor: categoryCode === cat.code ? theme.primary : theme.backgroundDefault,
                          borderColor: categoryCode === cat.code ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: categoryCode === cat.code ? "#FFFFFF" : theme.text }}
                      >
                        {cat.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
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
                  onPress={() => chooseOffer(offer.id as "products" | "services" | "both")}
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

            {selectedCategory && selectedCategory.code !== "other" && offerType ? (
              <View style={[styles.field, { marginTop: Spacing.xl }]}>
                <ThemedText type="small" style={styles.label}>
                  What do you do? * (pick up to {maxSpecialties})
                </ThemedText>
                {(offerType === "both"
                  ? [
                      { title: "Services", list: availableSpecialties.filter((sp) => sp.kind === "service") },
                      { title: "Products", list: availableSpecialties.filter((sp) => sp.kind === "product") },
                    ]
                  : [{ title: "", list: availableSpecialties }]
                ).map((group) => (
                  <View key={group.title || "all"}>
                    {group.title ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                        {group.title}
                      </ThemedText>
                    ) : null}
                    <View style={styles.categoryGrid}>
                      {group.list.map((sp) => {
                        const active = businessSpecialties.includes(sp.code);
                        const full = !active && businessSpecialties.length >= maxSpecialties;
                        return (
                          <Pressable
                            key={sp.code}
                            onPress={() => toggleSpecialty(sp.code)}
                            disabled={full}
                            accessibilityState={{ selected: active, disabled: full }}
                            style={[
                              styles.categoryButton,
                              {
                                backgroundColor: active ? theme.primary : theme.backgroundDefault,
                                borderColor: active ? theme.primary : theme.border,
                                opacity: full ? 0.4 : 1,
                              },
                            ]}
                          >
                            <ThemedText type="small" style={{ color: active ? "#FFFFFF" : theme.text }}>
                              {sp.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {needsOtherDescription ? (
              <View style={[styles.field, { marginTop: Spacing.lg }]}>
                <ThemedText type="small" style={styles.label}>Tell us what you do *</ThemedText>
                <TextInput
                  style={[inputStyle, { height: 100, textAlignVertical: "top", paddingTop: Spacing.md }]}
                  value={otherDescription}
                  onChangeText={(t) => setOtherDescription(t.slice(0, OTHER_DESCRIPTION_MAX))}
                  placeholder="Describe your business in your own words"
                  placeholderTextColor={theme.textSecondary}
                  maxLength={OTHER_DESCRIPTION_MAX}
                  multiline
                />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {otherDescription.length}/{OTHER_DESCRIPTION_MAX}
                </ThemedText>
              </View>
            ) : null}

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

            {(offerType === "services" || offerType === "both") && (
              <View style={[styles.switchRow, { marginTop: Spacing.xl }]}>
                <View style={styles.switchContent}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Do multiple team members each take their own appointments?
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Choose Yes if each person books their own clients, like barbers or stylists in one shop.
                    Choose No if one person manages all bookings.
                  </ThemedText>
                </View>
                <Switch
                  value={isMultiStaff}
                  onValueChange={setIsMultiStaff}
                  trackColor={{ false: theme.border, true: theme.primary }}
                />
              </View>
            )}
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

            {!hasPhysicalLocation ? (
              <>
                <View style={styles.field}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>Billing Address</ThemedText>
                  <ThemedText type="small" style={styles.billingHelperText}>
                    Used for Stripe payout verification only. Not shown publicly.
                  </ThemedText>
                </View>

                <View style={styles.field}>
                  <ThemedText type="small" style={styles.label}>Street Address</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={billingAddress}
                    onChangeText={setBillingAddress}
                    placeholder="Street Address"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText type="small" style={styles.label}>City</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={billingCity}
                    onChangeText={setBillingCity}
                    placeholder="City"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1, marginRight: Spacing.sm }]}>
                    <ThemedText type="small" style={styles.label}>State</ThemedText>
                    <TextInput
                      style={inputStyle}
                      value={billingState}
                      onChangeText={setBillingState}
                      placeholder="State"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="characters"
                      maxLength={2}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <ThemedText type="small" style={styles.label}>ZIP Code</ThemedText>
                    <TextInput
                      style={inputStyle}
                      value={billingZipCode}
                      onChangeText={setBillingZipCode}
                      placeholder="ZIP Code"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
              </>
            ) : null}

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
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Username</ThemedText>
                <ThemedText type="body">@{username}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Industry</ThemedText>
                <ThemedText type="body">{businessCategory}</ThemedText>
              </View>
              {businessSpecialties.length > 0 ? (
                <View style={styles.reviewRow}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>What You Do</ThemedText>
                  <ThemedText type="body" style={{ flexShrink: 1, textAlign: "right" }}>
                    {businessSpecialties
                      .map((code) => selectedCategory?.specialties.find((sp) => sp.code === code)?.label ?? code)
                      .join(", ")}
                  </ThemedText>
                </View>
              ) : null}
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

      case 8:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Vendor Agreement</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Scroll through the full agreement, then check the box to continue.
            </ThemedText>

            <ScrollView
              style={styles.agreementScroll}
              onScroll={handleAgreementScroll}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <ThemedText style={styles.agSectionHeader}>
                OUTSYDE VENDOR MARKETPLACE AGREEMENT
              </ThemedText>
              <ThemedText style={styles.agItalic}>
                Payment Processing Compliance &amp; Permitted Products Addendum
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>1. Parties &amp; Purpose</ThemedText>
              <ThemedText style={styles.agBody}>
                This agreement is between Outsyde, LLC and you, the Vendor, governing your access to
                the Outsyde marketplace. It establishes explicit standards for permitted products and
                protects both parties from payment processing disruptions caused by violations of
                Stripe's policies.
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>2. Payment Processor Compliance</ThemedText>
              <ThemedText style={styles.agBody}>
                Outsyde processes all vendor payments through Stripe Connect. Stripe maintains a
                Prohibited and Restricted Businesses list. Violations may result in immediate account
                termination and fund holds of 90–180+ days without prior notice.
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>3. Explicitly Permitted Products</ThemedText>
              <ThemedText style={styles.agBody}>
                Approved without additional review: physical goods (apparel, home goods, art,
                electronics, beauty products without medical claims, packaged food and non-alcoholic
                beverages, fitness equipment, pet products, outdoor gear); digital products (downloads,
                photography, creative services, coaching, courses, event planning); event services
                (ticketing, catering, entertainment, photography); professional services (moving,
                cleaning, contracting, notary).
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>4. Explicitly Prohibited Products</ThemedText>
              <ThemedText style={styles.agWarning}>
                The following are strictly prohibited and may not be listed on Outsyde under any
                circumstances:
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Tobacco &amp; Smoking Products</ThemedText>
              <ThemedText style={styles.agBody}>
                Cigarettes (tobacco or herbal), pre-rolled cones or sticks of ANY plant material
                intended for smoking — including hemp, lavender, chamomile, eucalyptus, or any other
                botanical — herbal cigarettes, loose smoking blends, vape pens, vape cartridges,
                e-cigarette products of any kind. Labeling a pre-rolled product as "aromatherapy"
                does not exempt it. The physical form of the product controls its classification.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Cannabis &amp; CBD</ThemedText>
              <ThemedText style={styles.agBody}>
                THC-containing products of any kind, CBD products exceeding 0.3% THC by dry weight,
                CBD edibles or ingestibles, hemp flower sold for smoking.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Alcohol</ThemedText>
              <ThemedText style={styles.agBody}>
                Alcoholic beverages of any kind — beer, wine, spirits, hard seltzers — and alcohol
                subscription boxes or delivery services.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Adult Content &amp; Services</ThemedText>
              <ThemedText style={styles.agBody}>
                Pornographic or sexually explicit content in any format, escort or companionship
                services, adult novelty products, AI-generated adult content.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Gambling &amp; Games of Chance</ThemedText>
              <ThemedText style={styles.agBody}>
                Online casino services, poker, sports betting, fantasy sports with real-money prizes,
                lotteries, sweepstakes where prizes are contingent on purchase, bidding-fee auctions.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Weapons &amp; Dangerous Items</ThemedText>
              <ThemedText style={styles.agBody}>
                Firearms, ammunition, switchblades or other weapons prohibited by law, explosives,
                pyrotechnics, replica or unregistered weapon facsimiles.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Pharmaceutical &amp; Medical Products</ThemedText>
              <ThemedText style={styles.agBody}>
                Prescription medications, supplements or vitamins making disease-prevention or cure
                claims (FDA prohibited without approval), prescription veterinary products.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Financial Services &amp; Fraud</ThemedText>
              <ThemedText style={styles.agBody}>
                Unlicensed investment or securities services, cryptocurrency or NFT sales, payday
                loans, debt settlement or credit repair services, pyramid schemes or MLM structures
                with recruitment-based income.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Counterfeit Goods &amp; IP Violations</ThemedText>
              <ThemedText style={styles.agBody}>
                Counterfeit goods of any brand, pirated software or media, products using trademarked
                names or logos without authorization, fake identification documents or credentials.
              </ThemedText>

              <ThemedText style={styles.agSubsection}>Illegal Activity</ThemedText>
              <ThemedText style={styles.agBody}>
                Any product or service that is illegal under applicable federal, state, or local law.
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>5. Restricted Categories</ThemedText>
              <ThemedText style={styles.agBody}>
                The following require written approval from Outsyde before listing: herbal supplements
                and ingestible wellness products, food products with health claims, age-restricted
                products (18+/21+), subscription box services, extended warranties over 12 months,
                telehealth or wellness consultation services. Email vendors@outsyde.com before listing
                any of these.
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>6. Vendor Representations</ThemedText>
              <ThemedText style={styles.agBody}>
                By agreeing, you confirm: (a) all your listed products fall within permitted categories
                or you have written approval; (b) all listings are truthful and not deceptively
                described; (c) you will notify Outsyde immediately if any product may conflict with
                this Agreement; (d) you hold all required licenses, permits, and regulatory approvals.
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>7. Enforcement</ThemedText>
              <ThemedText style={styles.agBody}>
                Violations may result in immediate listing removal, account suspension, payout holds
                up to 90 days, or permanent termination. If Outsyde's Stripe account incurs holds,
                fund freezes, or penalties as a direct result of your prohibited product listings,
                you may be held financially liable for documented losses including held funds,
                chargeback fees, and platform remediation costs.
              </ThemedText>

              <ThemedText style={styles.agSectionHeader}>8. Governing Law</ThemedText>
              <ThemedText style={styles.agBody}>
                This Agreement is governed by the laws of the State of New York. Disputes are resolved
                by binding arbitration under AAA rules in Nassau County, NY.
              </ThemedText>

              <ThemedText style={styles.agItalic}>
                By checking the box below, you confirm you have read this Agreement in full and agree
                to be bound by its terms.
              </ThemedText>
            </ScrollView>

            {!hasScrolledToBottom && (
              <ThemedText style={styles.agScrollHint}>
                ↓ Scroll to the bottom to enable the checkbox
              </ThemedText>
            )}

            <Pressable
              style={[styles.agCheckboxRow, !hasScrolledToBottom && styles.agCheckboxDisabled]}
              onPress={() => hasScrolledToBottom && setAgreementChecked(prev => !prev)}
            >
              <View style={[styles.agCheckbox, agreementChecked && styles.agCheckboxChecked]}>
                {agreementChecked && (
                  <ThemedText style={styles.agCheckmark}>✓</ThemedText>
                )}
              </View>
              <ThemedText style={[styles.agCheckboxLabel, !hasScrolledToBottom && styles.agCheckboxLabelDim]}>
                I have read the Outsyde Vendor Agreement in full and agree to its terms
              </ThemedText>
            </Pressable>
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

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScreenKeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.background }]}>
        {currentStep === 8 ? (
          <Button
            onPress={handleSubmit}
            style={[styles.nextButton, { backgroundColor: "#C9933A" }]}
            disabled={!agreementChecked || isLoading}
          >
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : "Confirm & Submit"}
          </Button>
        ) : currentStep === 7 ? (
          <Button
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: "#2D7A2D" }]}
          >
            Continue to Agreement
          </Button>
        ) : (
          <>
            {showFormError && currentStep === 1 ? (
              <ThemedText style={styles.formError}>
                Please complete all required fields to continue
              </ThemedText>
            ) : null}
            <Button
              onPress={handleNext}
              style={[styles.nextButton, { backgroundColor: "#2D7A2D" }]}
              disabled={currentStep === 1 && !agreedToTerms}
            >
              Continue
            </Button>
          </>
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
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: Spacing.lg,
  },
  label: { marginBottom: Spacing.xs, fontWeight: "600" },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  fieldError: {
    fontSize: 12,
    color: "#E05252",
    marginTop: 4,
  },
  formError: {
    fontSize: 12,
    color: "#E05252",
    textAlign: "center",
    marginBottom: 8,
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
  billingHelperText: {
    color: "rgba(200,191,168,0.6)",
    marginTop: Spacing.xs,
  },
  profilePhotoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    marginBottom: 8,
  },
  profilePhotoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 2,
    borderColor: "#C9933A",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
    gap: 4,
  },
  profilePhotoHint: {
    fontSize: 11,
    color: "#C9933A",
    fontWeight: "500",
  },
  profilePhotoOptional: {
    fontSize: 11,
    color: "rgba(200,191,168,0.4)",
    textAlign: "center",
    marginBottom: 16,
  },
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
  agreementScroll: {
    maxHeight: 340,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginTop: 12,
  },
  agSectionHeader: {
    fontWeight: "700",
    fontSize: 12,
    color: "#E8B930",
    marginTop: 16,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  agSubsection: {
    fontWeight: "600",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 2,
  },
  agBody: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.75,
    marginBottom: 4,
  },
  agWarning: {
    fontSize: 12,
    color: "#e05c5c",
    fontWeight: "600",
    marginBottom: 6,
  },
  agItalic: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: "italic",
    marginTop: 14,
    marginBottom: 8,
  },
  agScrollHint: {
    fontSize: 12,
    color: "#E8B930",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  agCheckboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 16,
  },
  agCheckboxDisabled: {
    opacity: 0.4,
  },
  agCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#E8B930",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    flexShrink: 0,
    marginTop: 1,
  },
  agCheckboxChecked: {
    backgroundColor: "#E8B930",
  },
  agCheckmark: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  agCheckboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  agCheckboxLabelDim: {
    opacity: 0.4,
  },
});

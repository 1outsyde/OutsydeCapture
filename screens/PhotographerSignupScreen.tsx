import React, { useState, useEffect } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import UsernameField from "@/components/UsernameField";
import { API_BASE_URL } from "@/services/api";

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
  { id: 5, name: "Services" },
  { id: 6, name: "Details" },
  { id: 7, name: "Finish" },
];

const ADDITIONAL_SERVICES = [
  "Photo editing & retouching",
  "Same-day previews",
  "Prints & albums",
  "Videography / Reels",
  "Drone photography",
  "Makeup artist coordination",
  "Model sourcing",
  "Wardrobe styling assistance",
  "Rush delivery",
];

const TRAVEL_RADIUS_OPTIONS = [
  { label: "Within my city only", value: "city_only" },
  { label: "Up to 25 miles", value: "25_miles" },
  { label: "Up to 50 miles", value: "50_miles" },
  { label: "Up to 100 miles", value: "100_miles" },
  { label: "Willing to travel anywhere", value: "anywhere" },
];

const PRICING_TYPES = [
  { label: "Hourly Rate", value: "hourly" },
  { label: "Per Session", value: "per_session" },
  { label: "Per Project", value: "per_project" },
  { label: "Custom Packages", value: "packages" },
  { label: "Contact for Pricing", value: "contact" },
];

const MIN_BOOKING_OPTIONS = [
  { label: "30 min", value: "30_min" },
  { label: "1 hour", value: "1_hour" },
  { label: "2 hours", value: "2_hours" },
  { label: "Half day", value: "half_day" },
  { label: "Full day", value: "full_day" },
];

const EXPERIENCE_OPTIONS = [
  { label: "Just starting out", value: "beginner" },
  { label: "1–2 years", value: "1_2_years" },
  { label: "3–5 years", value: "3_5_years" },
  { label: "5–10 years", value: "5_10_years" },
  { label: "10+ years", value: "10_plus_years" },
];

const EQUIPMENT_OPTIONS = [
  { label: "Professional camera + studio lighting", value: "pro_studio" },
  { label: "Professional camera, natural light", value: "pro_natural" },
  { label: "Building my kit", value: "building" },
];

const DELIVERY_OPTIONS = [
  { label: "Same day", value: "same_day" },
  { label: "24–48 hours", value: "24_48_hours" },
  { label: "3–5 business days", value: "3_5_days" },
  { label: "1–2 weeks", value: "1_2_weeks" },
  { label: "Varies by project", value: "varies" },
];

export default function PhotographerSignupScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "PhotographerSignup">>();
  const { signup, loginWithTokens, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const googleProfile = route.params?.googleProfile ?? null;
  const isGoogleSignup = route.params?.isGoogleSignup ?? false;
  const isAppleSignup = route.params?.socialProvider === "apple";
  const prefillName = route.params?.prefillName ?? googleProfile?.name ?? "";
  const prefillEmail = route.params?.prefillEmail ?? googleProfile?.email ?? "";

  const [currentStep, setCurrentStep] = useState(1);
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

  useEffect(() => {
    if (prefillName) {
      const parts = prefillName.trim().split(" ");
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" ") ?? "");
    }
  }, [prefillName]);

  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(googleProfile?.profileImageUrl ?? null);

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
    }
  };

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    AsyncStorage.multiGet(["@outsyde_onboarding_city", "@outsyde_onboarding_state"]).then(([cityPair, statePair]) => {
      if (cityPair[1] && !city) setCity(cityPair[1]);
      if (statePair[1] && !state) setState(statePair[1]);
    }).catch(() => {});
  }, []);

  const [shootLocation, setShootLocation] = useState<string[]>([]);
  const [studioName, setStudioName] = useState("");
  const [studioAddress, setStudioAddress] = useState("");
  const [usesSharedStudio, setUsesSharedStudio] = useState(false);
  const [travelRadius, setTravelRadius] = useState("");

  const [pricingType, setPricingType] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [minimumBooking, setMinimumBooking] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [additionalServices, setAdditionalServices] = useState<string[]>([]);

  const [experienceLevel, setExperienceLevel] = useState("");
  const [equipmentLevel, setEquipmentLevel] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");

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
      prev.includes(specialty) ? prev.filter(s => s !== specialty) : [...prev, specialty]
    );
  };

  const toggleShootLocation = (loc: string) => {
    setShootLocation(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  const toggleAdditionalService = (svc: string) => {
    setAdditionalServices(prev =>
      prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
    );
  };

  const showsStudioFields =
    shootLocation.includes("studio") || shootLocation.includes("both");

  const pricingNeedsAmount = pricingType !== "" && pricingType !== "packages" && pricingType !== "contact";

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
        if (shootLocation.length === 0) {
          Alert.alert("Error", "Please select where you shoot");
          return false;
        }
        if (!travelRadius) {
          Alert.alert("Error", "Please select your travel range");
          return false;
        }
        return true;
      case 4:
        if (!pricingType) {
          Alert.alert("Error", "Please select how you price your work");
          return false;
        }
        if (pricingNeedsAmount && !startingPrice.trim()) {
          Alert.alert("Error", "Please enter your starting price");
          return false;
        }
        return true;
      case 5:
        if (specialties.length === 0) {
          Alert.alert("Error", "Please select at least one specialty");
          return false;
        }
        return true;
      case 6:
        if (!experienceLevel) {
          Alert.alert("Error", "Please select your years of experience");
          return false;
        }
        if (!deliveryTime) {
          Alert.alert("Error", "Please select your typical delivery time");
          return false;
        }
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
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    const newFieldPayload = {
      shootLocation,
      studioName: studioName.trim() || null,
      studioAddress: studioAddress.trim() || null,
      usesSharedStudio,
      travelRadius,
      pricingType,
      startingPrice: startingPrice.trim() ? parseFloat(startingPrice) : null,
      minimumBooking: minimumBooking || null,
      additionalServices,
      experienceLevel,
      equipmentLevel: equipmentLevel || null,
      deliveryTime,
    };

    if (isGoogleSignup && googleProfile) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/oauth/complete-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            email,
            firstName,
            lastName,
            role: "photographer",
            password,
            googleProfile,
            profileImageUrl: profilePhotoUri || googleProfile?.profileImageUrl || null,
            displayName,
            bio,
            city,
            state,
            portfolioUrl: portfolioUrl.trim() || undefined,
            specialties,
            ...newFieldPayload,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          await AsyncStorage.removeItem("@outsyde_google_profile");
          await loginWithTokens(data.accessToken, data.refreshToken, data as any);
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }));
        } else {
          Alert.alert("Error", data.error ?? "Something went wrong. Please try again.");
        }
      } catch {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
      return;
    }

    const result = await signup({
      firstName,
      lastName,
      email,
      phone: phone.replace(/\D/g, ""),
      dateOfBirth: "",
      password,
      username,
      role: "photographer",
      displayName,
      bio,
      city,
      state,
      portfolioUrl: portfolioUrl.trim() || undefined,
      specialties,
      profileImageUrl: profilePhotoUri || undefined,
      ...newFieldPayload,
    });

    if (result.success) {
      navigation.goBack();
    } else {
      const msg = result.errorMessage || "";
      if (msg.toLowerCase().includes("username")) {
        setUsernameError("That username was just taken — please choose another");
        setUsernameAvailable(null);
        setCurrentStep(1);
      } else {
        Alert.alert("Error", msg || "Registration failed. Please try again.");
      }
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
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Your Profile</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              How clients will see you
            </ThemedText>

            <Pressable onPress={handlePickProfilePhoto} style={{ alignSelf: "center", marginBottom: 4 }}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePhotoCircle} />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Feather name="camera" size={28} color="#C9933A" />
                  <ThemedText style={styles.profilePhotoHint}>Add Photo</ThemedText>
                </View>
              )}
            </Pressable>
            <ThemedText style={styles.profilePhotoOptional}>Optional</ThemedText>

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
            <ThemedText type="h2" style={styles.stepTitle}>Location & Studio</ThemedText>
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

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Where do you shoot? *</ThemedText>
              <View style={styles.chipRow}>
                {[
                  { label: "I come to you", value: "on-location" },
                  { label: "I have a studio", value: "studio" },
                  { label: "Both", value: "both" },
                ].map(opt => (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleShootLocation(opt.value)}
                    style={[
                      styles.chip,
                      shootLocation.includes(opt.value)
                        ? { backgroundColor: "#2D7A2D", borderColor: "#2D7A2D" }
                        : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                    ]}
                  >
                    <ThemedText type="small" style={{ color: shootLocation.includes(opt.value) ? "#FFF" : theme.text }}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {showsStudioFields ? (
              <>
                <View style={styles.field}>
                  <ThemedText type="small" style={styles.label}>Studio Name</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={studioName}
                    onChangeText={setStudioName}
                    placeholder="Optional"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.field}>
                  <ThemedText type="small" style={styles.label}>Studio Address</ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={studioAddress}
                    onChangeText={setStudioAddress}
                    placeholder="Optional"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                  />
                </View>
                <ThemedText type="small" style={[{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.md }]}>— OR —</ThemedText>
                <Pressable onPress={() => setUsesSharedStudio(v => !v)} style={styles.checkRow}>
                  <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: usesSharedStudio ? "#2D7A2D" : "transparent" }]}>
                    {usesSharedStudio ? <Feather name="check" size={14} color="#FFF" /> : null}
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>I use rented/shared studio spaces</ThemedText>
                </Pressable>
              </>
            ) : null}

            <View style={[styles.field, { marginTop: Spacing.md }]}>
              <ThemedText type="small" style={styles.label}>How far will you travel? *</ThemedText>
              {TRAVEL_RADIUS_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setTravelRadius(opt.value)}
                  style={styles.radioRow}
                >
                  <View style={[styles.radioOuter, { borderColor: travelRadius === opt.value ? "#2D7A2D" : theme.border }]}>
                    {travelRadius === opt.value ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Pricing</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              How do you price your work?
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Pricing Type *</ThemedText>
              {PRICING_TYPES.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => { setPricingType(opt.value); setStartingPrice(""); }}
                  style={styles.radioRow}
                >
                  <View style={[styles.radioOuter, { borderColor: pricingType === opt.value ? "#2D7A2D" : theme.border }]}>
                    {pricingType === opt.value ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            {pricingNeedsAmount ? (
              <View style={styles.field}>
                <ThemedText type="small" style={styles.label}>
                  {pricingType === "hourly" ? "Rate *" : "Starting at *"}
                </ThemedText>
                <View style={styles.priceInputContainer}>
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginRight: Spacing.xs }}>$</ThemedText>
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    value={startingPrice}
                    onChangeText={text => setStartingPrice(text.replace(/[^0-9.]/g, ""))}
                    placeholder={pricingType === "hourly" ? "150" : "200"}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  {pricingType === "hourly" ? (
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>/hour</ThemedText>
                  ) : null}
                </View>
              </View>
            ) : pricingType === "packages" ? (
              <View style={[styles.field, { backgroundColor: theme.backgroundDefault, borderRadius: 8, padding: Spacing.md }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  You can add packages on your profile after signup.
                </ThemedText>
              </View>
            ) : null}

            {pricingType && pricingType !== "contact" ? (
              <View style={styles.field}>
                <ThemedText type="small" style={styles.label}>Minimum Booking Duration</ThemedText>
                <View style={styles.chipRow}>
                  {MIN_BOOKING_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setMinimumBooking(minimumBooking === opt.value ? "" : opt.value)}
                      style={[
                        styles.chip,
                        minimumBooking === opt.value
                          ? { backgroundColor: "#2D7A2D", borderColor: "#2D7A2D" }
                          : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                      ]}
                    >
                      <ThemedText type="small" style={{ color: minimumBooking === opt.value ? "#FFF" : theme.text }}>
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

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
            <ThemedText type="h2" style={styles.stepTitle}>Services & Specialties</ThemedText>
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
                    style={{ color: specialties.includes(specialty) ? "#FFFFFF" : theme.text }}
                  >
                    {specialty}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xl }}>
              Selected: {specialties.length}
            </ThemedText>

            <ThemedText type="small" style={[styles.label, { marginBottom: Spacing.sm }]}>Additional Services</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>Select all that apply</ThemedText>
            <View style={styles.specialtyGrid}>
              {ADDITIONAL_SERVICES.map((svc) => (
                <Pressable
                  key={svc}
                  onPress={() => toggleAdditionalService(svc)}
                  style={[
                    styles.specialtyChip,
                    {
                      backgroundColor: additionalServices.includes(svc)
                        ? "#2D7A2D"
                        : theme.backgroundDefault,
                      borderColor: additionalServices.includes(svc)
                        ? "#2D7A2D"
                        : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: additionalServices.includes(svc) ? "#FFFFFF" : theme.text }}
                  >
                    {svc}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>A Few More Details</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Help clients understand your experience
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Years of Experience *</ThemedText>
              {EXPERIENCE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setExperienceLevel(opt.value)}
                  style={styles.radioRow}
                >
                  <View style={[styles.radioOuter, { borderColor: experienceLevel === opt.value ? "#2D7A2D" : theme.border }]}>
                    {experienceLevel === opt.value ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Equipment Level</ThemedText>
              {EQUIPMENT_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setEquipmentLevel(equipmentLevel === opt.value ? "" : opt.value)}
                  style={styles.radioRow}
                >
                  <View style={[styles.radioOuter, { borderColor: equipmentLevel === opt.value ? "#2D7A2D" : theme.border }]}>
                    {equipmentLevel === opt.value ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Typical Photo Delivery Time *</ThemedText>
              {DELIVERY_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setDeliveryTime(opt.value)}
                  style={styles.radioRow}
                >
                  <View style={[styles.radioOuter, { borderColor: deliveryTime === opt.value ? "#2D7A2D" : theme.border }]}>
                    {deliveryTime === opt.value ? <View style={styles.radioInner} /> : null}
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 7:
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
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Username</ThemedText>
                <ThemedText type="body">@{username}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Location</ThemedText>
                <ThemedText type="body">{city}{state ? `, ${state}` : ""}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Travel Range</ThemedText>
                <ThemedText type="body">{TRAVEL_RADIUS_OPTIONS.find(o => o.value === travelRadius)?.label ?? "—"}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Pricing</ThemedText>
                <ThemedText type="body" style={{ flex: 1, textAlign: "right", flexWrap: "wrap" }}>
                  {pricingType === "contact"
                    ? "Contact for pricing"
                    : pricingType === "packages"
                    ? "Custom Packages"
                    : `${PRICING_TYPES.find(o => o.value === pricingType)?.label ?? pricingType}${startingPrice ? ` — $${startingPrice}` : ""}`}
                </ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Specialties</ThemedText>
                <ThemedText type="body">{specialties.slice(0, 3).join(", ")}{specialties.length > 3 ? "…" : ""}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Experience</ThemedText>
                <ThemedText type="body">{EXPERIENCE_OPTIONS.find(o => o.value === experienceLevel)?.label ?? "—"}</ThemedText>
              </View>
              <View style={styles.reviewRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Delivery Time</ThemedText>
                <ThemedText type="body">{DELIVERY_OPTIONS.find(o => o.value === deliveryTime)?.label ?? "—"}</ThemedText>
              </View>
            </View>

            <View style={[styles.noticeBox, { backgroundColor: "rgba(45,122,45,0.12)", borderColor: "rgba(45,122,45,0.4)", borderWidth: 1 }]}>
              <Feather name="check-circle" size={20} color="#3A9E3A" />
              <ThemedText type="small" style={{ color: "#3A9E3A", marginLeft: Spacing.sm, flex: 1 }}>
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
        {currentStep === 7 ? (
          <Button onPress={handleSubmit} style={[styles.nextButton, { backgroundColor: "#C9933A" }]} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : "Create Account"}
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
  priceInputContainer: { flexDirection: "row", alignItems: "center" },
  specialtyGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  specialtyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    margin: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2D7A2D",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
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
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 16,
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

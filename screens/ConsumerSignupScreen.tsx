import React, { useState, useEffect } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, Platform, Linking, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import UsernameField from "@/components/UsernameField";
import api, { API_BASE_URL, type CustomerInterestTaxonomy } from "@/services/api";
import { getStoredReferral } from "@/services/referral";
import { normalizeReferralCode, REFERRAL_COPY } from "@/utils/friendReferral";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Customer interests come from the shared business list (backend GET /api/taxonomy/customer-
// interests, 2026-10-18), the same list goutsyde.com uses, so customers can be matched to
// businesses. Codes are saved; labels come from the list.
const INDUSTRY_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  beauty: "scissors", fashion: "shopping-bag", food: "coffee", health_fitness: "activity", home: "home",
  auto: "truck", events: "music", art: "edit-3", professional: "briefcase", pets: "heart", other: "plus-circle",
};

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const SHOPPING_FREQUENCIES = ["Rarely", "Monthly", "Weekly", "Multiple times a week"];

const STEPS = [
  { id: 1, name: "Account" },
  { id: 2, name: "About You" },
  { id: 3, name: "Industries" },
  { id: 4, name: "Your Tastes" },
  { id: 5, name: "Finish" },
];

type ConsumerSignupRouteProp = RouteProp<RootStackParamList, "ConsumerSignup">;

export default function ConsumerSignupScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConsumerSignupRouteProp>();
  const { signup, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const prefillName = route.params?.prefillName ?? "";
  const prefillEmail = route.params?.prefillEmail ?? "";

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showFormError, setShowFormError] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const handlePickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setProfilePhotoUri(result.assets[0].uri);
    }
  };

  useEffect(() => {
    if (prefillName) {
      const parts = prefillName.trim().split(" ");
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" ") ?? "");
    }
  }, [prefillName]);

  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [shoppingFrequency, setShoppingFrequency] = useState("");

  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industryNiches, setIndustryNiches] = useState<Record<string, string[]>>({});
  const [industryValues, setIndustryValues] = useState<Record<string, string[]>>({});

  const [currentIndustryIndex, setCurrentIndustryIndex] = useState(0);
  const [interestOther, setInterestOther] = useState("");
  const [interestTaxonomy, setInterestTaxonomy] = useState<CustomerInterestTaxonomy | null>(null);
  const [interestTaxonomyFailed, setInterestTaxonomyFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getCustomerInterestTaxonomy()
      .then((t) => {
        if (cancelled) return;
        if (t && Array.isArray(t.categories)) setInterestTaxonomy(t);
        else setInterestTaxonomyFailed(true);
      })
      .catch(() => { if (!cancelled) setInterestTaxonomyFailed(true); });
    return () => { cancelled = true; };
  }, []);

  // Friend invite code (2026-10-23): prefilled from a goutsyde.com/r/<CODE> link the app was opened
  // with. Optional; a wrong code never stops the signup (the backend just doesn't apply it).
  const [referralCode, setReferralCode] = useState("");
  useEffect(() => {
    let cancelled = false;
    getStoredReferral().then((saved) => {
      const code = normalizeReferralCode(saved);
      if (!cancelled && code) setReferralCode((current) => current || code);
    });
    return () => { cancelled = true; };
  }, []);

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

  const formatDOB = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,2})(\d{0,2})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      if (parts.length === 0) return "";
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return text;
  };

  const toggleIndustry = (id: string) => {
    setSelectedIndustries(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    if (id === "other" && selectedIndustries.includes("other")) setInterestOther("");
  };

  const toggleNiche = (industry: string, niche: string) => {
    setIndustryNiches(prev => {
      const current = prev[industry] || [];
      return {
        ...prev,
        [industry]: current.includes(niche) 
          ? current.filter(n => n !== niche) 
          : [...current, niche]
      };
    });
  };

  const toggleValue = (industry: string, value: string) => {
    setIndustryValues(prev => {
      const current = prev[industry] || [];
      return {
        ...prev,
        [industry]: current.includes(value) 
          ? current.filter(v => v !== value) 
          : [...current, value]
      };
    });
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
        return true;
      case 3:
        return true;
      case 4:
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

    // No industries picked: nothing to ask per industry, go straight to Finish.
    if (currentStep === 3 && selectedIndustries.length === 0) {
      setCurrentStep(5);
      return;
    }

    if (currentStep === 4) {
      if (currentIndustryIndex < selectedIndustries.length - 1) {
        setCurrentIndustryIndex(prev => prev + 1);
      } else {
        setCurrentStep(5);
      }
    } else {
      if (currentStep === 3) {
        setCurrentIndustryIndex(0);
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 5 && selectedIndustries.length === 0) {
      setCurrentStep(3);
    } else if (currentStep === 4 && currentIndustryIndex > 0) {
      setCurrentIndustryIndex(prev => prev - 1);
    } else if (currentStep > 1) {
      if (currentStep === 4) {
        setCurrentIndustryIndex(0);
      }
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSkipToFinish = () => {
    setSelectedIndustries([]);
    setIndustryNiches({});
    setIndustryValues({});
    setInterestOther("");
    setCurrentIndustryIndex(0);
    setCurrentStep(5);
  };

  const onlyPicked = (map: Record<string, string[]>) =>
    Object.fromEntries(Object.entries(map).filter(([k, v]) => selectedIndustries.includes(k) && v.length > 0));

  const handleSubmit = async () => {
    const result = await signup({
      referralCode: normalizeReferralCode(referralCode) ?? undefined,
      firstName,
      lastName,
      email,
      phone: phone.replace(/\D/g, ""),
      dateOfBirth,
      password,
      role: "consumer",
      username,
      gender,
      ethnicity,
      shoppingFrequency,
      // Only picks for industries still chosen; Other text only when Other is chosen (2026-10-18).
      selectedIndustries,
      industryNiches: onlyPicked(industryNiches),
      industryValues: onlyPicked(industryValues),
      interestOther: selectedIndustries.includes("other") ? interestOther.trim() || undefined : undefined,
      profileImageUrl: profilePhotoUri || undefined,
    });

    if (result.success) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }));
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
              {usernameAvailable === true ? (
                <ThemedText style={styles.usernameHint}>
                  You can change your username once every 14 days
                </ThemedText>
              ) : null}
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
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
              {touched.password && getFieldError("password") ? (
                <ThemedText style={styles.fieldError}>{getFieldError("password")}</ThemedText>
              ) : null}
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>{REFERRAL_COPY.fieldLabel}</ThemedText>
              <TextInput
                style={inputStyle}
                value={referralCode}
                onChangeText={(text) => setReferralCode(text.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                placeholder={REFERRAL_COPY.fieldHint}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
            </View>

            <Pressable onPress={handlePickProfilePhoto} style={{ alignSelf: "center", marginBottom: 4 }}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePhotoCircle} />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Feather name="camera" size={24} color="#C9933A" />
                  <ThemedText style={styles.profilePhotoHint}>Profile Photo</ThemedText>
                </View>
              )}
            </Pressable>
            <ThemedText style={styles.profilePhotoOptional}>Optional — you can add this later</ThemedText>

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
            <ThemedText type="h2" style={styles.stepTitle}>About You</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Help us personalize your experience
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Date of Birth</ThemedText>
              <TextInput
                style={inputStyle}
                value={dateOfBirth}
                onChangeText={(text) => setDateOfBirth(formatDOB(text))}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Gender</ThemedText>
              <View style={styles.optionGrid}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: gender === g ? theme.primary : theme.backgroundDefault,
                        borderColor: gender === g ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: gender === g ? "#FFFFFF" : theme.text }}
                    >
                      {g}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>How often do you shop?</ThemedText>
              <View style={styles.optionGrid}>
                {SHOPPING_FREQUENCIES.map((freq) => (
                  <Pressable
                    key={freq}
                    onPress={() => setShoppingFrequency(freq)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: shoppingFrequency === freq ? theme.primary : theme.backgroundDefault,
                        borderColor: shoppingFrequency === freq ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: shoppingFrequency === freq ? "#FFFFFF" : theme.text }}
                    >
                      {freq}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Your Interests</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Select industries you're interested in
            </ThemedText>

            {!interestTaxonomy ? (
              <View style={styles.field}>
                {interestTaxonomyFailed ? (
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Interests couldn't load. You can skip this step and add them later.
                  </ThemedText>
                ) : (
                  <ActivityIndicator color={theme.primary} />
                )}
              </View>
            ) : (
            <View style={styles.industryGrid}>
              {interestTaxonomy.categories.map((industry) => (
                <Pressable
                  key={industry.code}
                  onPress={() => toggleIndustry(industry.code)}
                  style={[
                    styles.industryCard,
                    {
                      backgroundColor: selectedIndustries.includes(industry.code) 
                        ? theme.primary + "20" 
                        : theme.backgroundDefault,
                      borderColor: selectedIndustries.includes(industry.code) 
                        ? theme.primary 
                        : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={INDUSTRY_ICONS[industry.code] ?? "star"}
                    size={24}
                    color={selectedIndustries.includes(industry.code) ? theme.primary : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      marginTop: Spacing.xs,
                      textAlign: "center",
                      color: selectedIndustries.includes(industry.code) ? theme.primary : theme.text,
                    }}
                  >
                    {industry.label}
                  </ThemedText>
                  {selectedIndustries.includes(industry.code) ? (
                    <View style={[styles.checkMark, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
            )}
          </View>
        );

      case 4: {
        const currentIndustry = selectedIndustries[currentIndustryIndex];
        const category = interestTaxonomy?.categories.find((c) => c.code === currentIndustry);
        const picked = industryNiches[currentIndustry] || [];
        const valuesPicked = industryValues[currentIndustry] || [];
        const groups = [
          { title: "Services", items: (category?.specialties ?? []).filter((sp) => sp.kind === "service") },
          { title: "Products", items: (category?.specialties ?? []).filter((sp) => sp.kind === "product") },
        ].filter((g) => g.items.length > 0);

        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>{category?.label ?? ""}</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              {currentIndustryIndex + 1} of {selectedIndustries.length}. Pick anything you're into.
            </ThemedText>

            {currentIndustry === "other" ? (
              <View style={styles.field}>
                <ThemedText type="body" style={styles.questionLabel}>Tell us what you're into</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border, minHeight: 72, textAlignVertical: "top" }]}
                  placeholder="For example, vintage cars or board games"
                  placeholderTextColor={theme.textSecondary}
                  value={interestOther}
                  onChangeText={setInterestOther}
                  multiline
                  maxLength={interestTaxonomy?.otherMax ?? 500}
                />
              </View>
            ) : null}

            {groups.map((group) => (
              <View style={styles.field} key={group.title}>
                <ThemedText type="body" style={styles.questionLabel}>{group.title}</ThemedText>
                <View style={styles.nicheGrid}>
                  {group.items.map((sp) => {
                    const on = picked.includes(sp.code);
                    return (
                      <Pressable
                        key={sp.code}
                        onPress={() => toggleNiche(currentIndustry, sp.code)}
                        style={[styles.nicheChip, { backgroundColor: on ? theme.primary : theme.backgroundDefault, borderColor: on ? theme.primary : theme.border }]}
                      >
                        <ThemedText type="small" style={{ color: on ? "#FFFFFF" : theme.text }}>{sp.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {category && category.values.length > 0 ? (
              <View style={styles.field}>
                <ThemedText type="body" style={styles.questionLabel}>What matters most</ThemedText>
                <View style={styles.nicheGrid}>
                  {category.values.map((option) => {
                    const on = valuesPicked.includes(option.id);
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => toggleValue(currentIndustry, option.id)}
                        style={[styles.nicheChip, { backgroundColor: on ? theme.primary + "15" : theme.backgroundDefault, borderColor: on ? theme.primary : theme.border }]}
                      >
                        <ThemedText type="small" style={{ color: on ? theme.primary : theme.text, fontWeight: on ? "600" : "400" }}>{option.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        );
      }

      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={[styles.successIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="check" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h2" style={[styles.stepTitle, { textAlign: "center" }]}>You're All Set!</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary, textAlign: "center" }]}>
              Tap below to create your account and start exploring
            </ThemedText>
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
        {showFormError && currentStep === 1 ? (
          <ThemedText style={styles.formError}>
            Please complete all required fields to continue
          </ThemedText>
        ) : null}
        {currentStep === 5 ? (
          <Button onPress={handleSubmit} style={styles.nextButton} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : "Create Account"}
          </Button>
        ) : (
          <>
            <Button
              onPress={handleNext}
              style={styles.nextButton}
              disabled={currentStep === 1 && !agreedToTerms}
            >
              Continue
            </Button>
            {(currentStep === 3 || currentStep === 4) ? (
              <Pressable onPress={handleSkipToFinish} style={styles.skipButton}>
                <ThemedText style={styles.skipText}>Skip for now</ThemedText>
              </Pressable>
            ) : null}
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
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  stepContent: {},
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  usernameHint: {
    fontSize: 11,
    color: "rgba(200,191,168,0.5)",
    marginTop: 4,
    marginLeft: 2,
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
  skipButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  skipText: {
    fontSize: 14,
    color: "rgba(200,191,168,0.5)",
    textDecorationLine: "underline",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.md,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    margin: 4,
  },
  industryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  industryCard: {
    width: "45%",
    margin: "2.5%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    position: "relative",
  },
  checkMark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  questionLabel: {
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  nicheChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    margin: 4,
  },
  valueList: {
    gap: Spacing.sm,
  },
  valueCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  valueContent: {
    flex: 1,
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
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  nextButton: {
    width: "100%",
  },
});

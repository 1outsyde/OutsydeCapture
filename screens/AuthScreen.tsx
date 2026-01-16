import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, UserRole, SignupData } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AuthMode = "login" | "signup";

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

export default function AuthScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { login, signup, loginAsGuest, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("consumer");
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  
  const [showPendingMessage, setShowPendingMessage] = useState(false);
  const [pendingUserInfo, setPendingUserInfo] = useState<{ businessName: string; businessCategory: string; email: string } | null>(null);

  const formatPhoneNumber = (text: string) => {
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

  const formatDateOfBirth = (text: string) => {
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

  const validateForm = () => {
    if (mode === "login") {
      if (!email.trim() || !password.trim()) {
        Alert.alert("Error", "Please fill in all required fields");
        return false;
      }
      return true;
    }
    
    if (!firstName.trim()) {
      Alert.alert("Error", "Please enter your first name");
      return false;
    }
    if (!lastName.trim()) {
      Alert.alert("Error", "Please enter your last name");
      return false;
    }
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return false;
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return false;
    }
    if (!dateOfBirth.trim() || dateOfBirth.length < 10) {
      Alert.alert("Error", "Please enter your date of birth (MM/DD/YYYY)");
      return false;
    }
    if (!password.trim() || password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return false;
    }
    if (role === "business") {
      if (!businessName.trim()) {
        Alert.alert("Error", "Please enter your business name");
        return false;
      }
      if (!businessCategory) {
        Alert.alert("Error", "Please select a business category");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (mode === "login") {
      const result = await login(email, password);
      if (result.success) {
        if (result.isPending && result.user) {
          setPendingUserInfo({
            businessName: result.user.businessName || "",
            businessCategory: result.user.businessCategory || "",
            email: result.user.email,
          });
          setShowPendingMessage(true);
        } else {
          navigation.goBack();
        }
      } else if (result.isRejected) {
        Alert.alert("Account Rejected", "Your business application was not approved. Please contact support for more information.");
      } else {
        Alert.alert("Error", "Login failed. Please check your credentials.");
      }
    } else {
      const signupData: SignupData = {
        firstName,
        lastName,
        email,
        phone: phone.replace(/\D/g, ""),
        dateOfBirth,
        password,
        role,
        businessName: role === "business" ? businessName : undefined,
        businessCategory: role === "business" ? businessCategory : undefined,
      };
      
      const result = await signup(signupData);
      
      if (result.success) {
        if (result.isPending) {
          setShowPendingMessage(true);
        } else {
          navigation.goBack();
        }
      } else {
        Alert.alert("Error", "Registration failed. Please try again.");
      }
    }
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setDateOfBirth("");
    setPassword("");
    setConfirmPassword("");
    setBusinessName("");
    setBusinessCategory("");
    setRole("consumer");
    setShowPendingMessage(false);
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  if (showPendingMessage) {
    const displayBusinessName = pendingUserInfo?.businessName || businessName;
    const displayBusinessCategory = pendingUserInfo?.businessCategory || businessCategory;
    const displayEmail = pendingUserInfo?.email || email;
    const isLoginPending = !!pendingUserInfo;
    
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.pendingContainer, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.pendingIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="clock" size={64} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.pendingTitle}>
            {isLoginPending ? "Account Pending Approval" : "Application Submitted"}
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: theme.textSecondary }]}>
            {isLoginPending
              ? "Your business account is still under review."
              : "Thank you for registering your business with Outsyde! Your application is now under review."}
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: theme.textSecondary }]}>
            Our team will review your application and get back to you within 24-48 hours. You will receive an email notification once your account is approved.
          </ThemedText>
          <View style={styles.pendingDetails}>
            <View style={styles.pendingDetailRow}>
              <Feather name="briefcase" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {displayBusinessName}
              </ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="tag" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {displayBusinessCategory}
              </ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="mail" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {displayEmail}
              </ThemedText>
            </View>
          </View>
          <Button
            onPress={() => {
              setPendingUserInfo(null);
              resetForm();
              navigation.goBack();
            }}
            style={styles.pendingButton}
          >
            Got it
          </Button>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Feather name="camera" size={48} color={theme.primary} />
            <ThemedText type="h1" style={styles.logoText}>
              Outsyde
            </ThemedText>
          </View>

          <ThemedText type="h2" style={styles.title}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {mode === "login"
              ? "Sign in to continue"
              : "Join Outsyde to discover amazing services"}
          </ThemedText>

          {mode === "signup" ? (
            <>
              <View style={styles.accountTypeContainer}>
                <ThemedText type="small" style={styles.label}>
                  I am a...
                </ThemedText>
                <View style={styles.roleButtons}>
                  <Pressable
                    onPress={() => setRole("consumer")}
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor: role === "consumer" ? theme.primary : theme.backgroundDefault,
                        borderColor: role === "consumer" ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="user"
                      size={20}
                      color={role === "consumer" ? "#FFFFFF" : theme.text}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: role === "consumer" ? "#FFFFFF" : theme.text,
                        marginTop: Spacing.xs,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      Consumer
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: role === "consumer" ? "#FFFFFF" : theme.textSecondary,
                        textAlign: "center",
                        fontSize: 10,
                      }}
                    >
                      Browse & book
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setRole("business")}
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor: role === "business" ? theme.primary : theme.backgroundDefault,
                        borderColor: role === "business" ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={20}
                      color={role === "business" ? "#FFFFFF" : theme.text}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: role === "business" ? "#FFFFFF" : theme.text,
                        marginTop: Spacing.xs,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      Business
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: role === "business" ? "#FFFFFF" : theme.textSecondary,
                        textAlign: "center",
                        fontSize: 10,
                      }}
                    >
                      Sell products
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setRole("photographer")}
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor: role === "photographer" ? theme.primary : theme.backgroundDefault,
                        borderColor: role === "photographer" ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="camera"
                      size={20}
                      color={role === "photographer" ? "#FFFFFF" : theme.text}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: role === "photographer" ? "#FFFFFF" : theme.text,
                        marginTop: Spacing.xs,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      Photographer
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: role === "photographer" ? "#FFFFFF" : theme.textSecondary,
                        textAlign: "center",
                        fontSize: 10,
                      }}
                    >
                      Offer shoots
                    </ThemedText>
                  </Pressable>
                </View>
                {role === "business" ? (
                  <View style={[styles.approvalNotice, { backgroundColor: theme.primary + "15" }]}>
                    <Feather name="info" size={16} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm, flex: 1 }}>
                      Business accounts require manual approval (24-48 hours)
                    </ThemedText>
                  </View>
                ) : null}
                {role === "photographer" ? (
                  <View style={[styles.approvalNotice, { backgroundColor: "#007AFF15" }]}>
                    <Feather name="check-circle" size={16} color="#007AFF" />
                    <ThemedText type="small" style={{ color: "#007AFF", marginLeft: Spacing.sm, flex: 1 }}>
                      Photographer accounts are auto-approved
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.nameRow}>
                <View style={[styles.fieldContainer, { flex: 1, marginRight: Spacing.sm }]}>
                  <ThemedText type="small" style={styles.label}>
                    First Name *
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldContainer, { flex: 1 }]}>
                  <ThemedText type="small" style={styles.label}>
                    Last Name *
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Phone Number *
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhoneNumber(text))}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  maxLength={14}
                />
              </View>

              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Date of Birth *
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={dateOfBirth}
                  onChangeText={(text) => setDateOfBirth(formatDateOfBirth(text))}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={10}
                />
              </View>

              {role === "business" ? (
                <>
                  <View style={styles.fieldContainer}>
                    <ThemedText type="small" style={styles.label}>
                      Business Name *
                    </ThemedText>
                    <TextInput
                      style={inputStyle}
                      value={businessName}
                      onChangeText={setBusinessName}
                      placeholder="Your Business Name"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.fieldContainer}>
                    <ThemedText type="small" style={styles.label}>
                      Business Category *
                    </ThemedText>
                    <Pressable
                      onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                      style={[
                        inputStyle,
                        styles.pickerButton,
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{ color: businessCategory ? theme.text : theme.textSecondary }}
                      >
                        {businessCategory || "Select a category"}
                      </ThemedText>
                      <Feather
                        name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                    {showCategoryPicker ? (
                      <View style={[styles.categoryList, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                        {BUSINESS_CATEGORIES.map((category) => (
                          <Pressable
                            key={category}
                            onPress={() => {
                              setBusinessCategory(category);
                              setShowCategoryPicker(false);
                            }}
                            style={[
                              styles.categoryItem,
                              businessCategory === category && { backgroundColor: theme.primary + "20" },
                            ]}
                          >
                            <ThemedText
                              type="body"
                              style={{ color: businessCategory === category ? theme.primary : theme.text }}
                            >
                              {category}
                            </ThemedText>
                            {businessCategory === category ? (
                              <Feather name="check" size={18} color={theme.primary} />
                            ) : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Email *
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Password *
            </ThemedText>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "signup" ? "Min. 6 characters" : "Enter password"}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType={mode === "signup" ? "next" : "done"}
                onSubmitEditing={mode === "login" ? handleSubmit : undefined}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {mode === "signup" ? (
            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>
                Confirm Password *
              </ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[inputStyle, styles.passwordInput]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>
          ) : null}

          <Button
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.submitButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : mode === "login" ? (
              "Sign In"
            ) : role === "business" ? (
              "Submit Application"
            ) : (
              "Create Account"
            )}
          </Button>

          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "signup" : "login");
              resetForm();
            }}
            style={styles.switchMode}
          >
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600" }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </ThemedText>
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText type="small" style={[styles.dividerText, { color: theme.textSecondary }]}>
              or
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <Pressable
            onPress={loginAsGuest}
            disabled={isLoading}
            style={[styles.guestButton, { borderColor: theme.border }]}
          >
            <Feather name="user" size={20} color={theme.text} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Continue as Guest
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => Alert.alert("Coming Soon", "Apple Sign-In will be available soon!")}
            style={[styles.socialButton, { backgroundColor: isDark ? "#FFFFFF" : "#000000" }]}
          >
            <Feather name="smartphone" size={20} color={isDark ? "#000000" : "#FFFFFF"} />
            <ThemedText
              type="body"
              style={{ marginLeft: Spacing.sm, color: isDark ? "#000000" : "#FFFFFF" }}
            >
              Continue with Apple
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => Alert.alert("Coming Soon", "Google Sign-In will be available soon!")}
            style={[styles.socialButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, borderWidth: 1 }]}
          >
            <ThemedText type="body" style={{ color: "#4285F4", fontWeight: "bold", fontSize: 18 }}>G</ThemedText>
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Continue with Google
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoText: {
    marginTop: Spacing.sm,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  accountTypeContainer: {
    marginBottom: Spacing.lg,
  },
  roleButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  roleButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  approvalNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
  },
  fieldContainer: {
    marginBottom: Spacing.md,
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
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryList: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  switchMode: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
  },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  pendingContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  pendingIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  pendingTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  pendingText: {
    textAlign: "center",
    marginBottom: Spacing.md,
    lineHeight: 24,
  },
  pendingDetails: {
    width: "100%",
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  pendingDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  pendingButton: {
    width: "100%",
  },
});

import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth, UserRole, GoogleProfile } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useGoogleSignIn, useAppleSignIn } from "@/hooks/useOAuthSignIn";

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:          "#080C08",
  card:        "rgba(255,255,255,0.04)",
  cardBorder:  "rgba(255,255,255,0.08)",
  greenDeep:   "#1A4A1A",
  greenBright: "#2D7A2D",
  greenAccent: "#3A9E3A",
  gold:        "#C9933A",
  cream:       "#F0EAD6",
  creamDim:    "rgba(200,191,168,0.6)",
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type AuthMode = "login" | "signup";

const ROLE_OPTIONS: {
  role: UserRole;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
  accent: string;
}[] = [
  {
    role: "consumer",
    icon: "shopping-bag",
    label: "Consumer",
    description: "Browse, book sessions & shop local talent",
    accent: DS.greenAccent,
  },
  {
    role: "business",
    icon: "briefcase",
    label: "Business",
    description: "Sell products & services to your community",
    accent: DS.gold,
  },
  {
    role: "photographer",
    icon: "camera",
    label: "Photographer",
    description: "Offer photography & creative services",
    accent: "#C8BFA8",
  },
];

export default function AuthScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login, loginAsGuest, isLoading, pendingResetParams, clearPendingResetParams } = useAuth();
  const insets = useSafeAreaInsets();

  // Handle password reset deep link for unauthenticated users
  useEffect(() => {
    if (pendingResetParams) {
      clearPendingResetParams();
      navigation.navigate("ResetPassword", pendingResetParams);
    }
  }, [pendingResetParams]);

  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<GoogleProfile | null>(null);

  const [showPendingMessage, setShowPendingMessage] = useState(false);
  const [pendingUserInfo, setPendingUserInfo] = useState<{
    businessName: string;
    businessCategory: string;
    email: string;
  } | null>(null);

  const { signIn: handleGoogleSignIn, isLoading: isGoogleLoading } = useGoogleSignIn(
    (gProfile) => {
      setPendingGoogleProfile(gProfile);
      setMode("signup");
    }
  );

  const { signIn: handleAppleSignIn, isLoading: isAppleLoading } = useAppleSignIn(
    ({ prefillName, prefillEmail }) => {
      navigation.navigate("ConsumerSignup", {
        prefillName,
        prefillEmail,
        socialProvider: "apple",
      });
    }
  );

  const validateForm = () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    const raw = identifier.trim();
    const isEmail = raw.includes("@") && raw.includes(".");
    const loginIdentifier = isEmail ? raw.toLowerCase() : raw.replace(/^@/, "").toLowerCase();
    const result = await login(loginIdentifier, password, isEmail ? "email" : "username");
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
      Alert.alert(
        "Account Rejected",
        "Your business application was not approved. Please contact support for more information."
      );
    } else {
      Alert.alert("Error", "Login failed. Please check your credentials.");
    }
  };

  const navigateToSignup = (role: UserRole) => {
    const googleParams = pendingGoogleProfile
      ? { googleProfile: pendingGoogleProfile, isGoogleSignup: true as const }
      : undefined;
    if (role === "consumer") navigation.navigate("ConsumerSignup", googleParams);
    else if (role === "business") navigation.navigate("BusinessSignup", googleParams);
    else navigation.navigate("PhotographerSignup", googleParams);
  };

  const handleGuestLogin = async () => {
    await loginAsGuest();
    navigation.goBack();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setIdentifier("");
    setPassword("");
    setPendingGoogleProfile(null);
  };

  const inputBorder = (name: string) =>
    focusedInput === name ? DS.gold : DS.cardBorder;

  // ─── Pending approval screen ──────────────────────────────────────────────
  if (showPendingMessage) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.pendingContainer, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.pendingIconWrap, { backgroundColor: DS.greenBright + "22" }]}>
            <Feather name="clock" size={64} color={DS.greenBright} />
          </View>
          <ThemedText type="h2" style={styles.pendingTitle}>
            Account Pending Approval
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: DS.creamDim }]}>
            Your business account is still under review.
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: DS.creamDim }]}>
            Our team will review your application and get back to you within 24-48 hours. You will
            receive an email notification once your account is approved.
          </ThemedText>
          <View style={styles.pendingDetails}>
            <View style={styles.pendingDetailRow}>
              <Feather name="briefcase" size={20} color={DS.greenBright} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {pendingUserInfo?.businessName}
              </ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="tag" size={20} color={DS.greenBright} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {pendingUserInfo?.businessCategory}
              </ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="mail" size={20} color={DS.greenBright} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {pendingUserInfo?.email}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={() => {
              setPendingUserInfo(null);
              setShowPendingMessage(false);
              navigation.goBack();
            }}
            style={{ width: "100%" }}
          >
            <LinearGradient
              colors={[DS.greenBright, DS.greenAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <ThemedText style={styles.gradientBtnText}>Got it</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  // ─── Main screen ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: DS.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.logoRow}>
            <Feather name="camera" size={36} color={DS.gold} />
            <ThemedText style={styles.wordmark}>Outsyde</ThemedText>
          </View>

          <ThemedText
            style={[
              styles.headline,
              mode === "signup" ? { fontSize: 28, lineHeight: 34 } : {},
            ]}
          >
            {mode === "login" ? "Welcome back" : "Join Outsyde"}
          </ThemedText>
          <ThemedText style={styles.subheadline}>
            {mode === "login" ? "Sign in to continue" : "Choose your path to get started"}
          </ThemedText>

          {/* ── LOGIN MODE ────────────────────────────────────────────────── */}
          {mode === "login" ? (
            <>
              <View style={styles.fieldWrap}>
                <ThemedText style={styles.fieldLabel}>Email or Username *</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: inputBorder("identifier") }]}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="your@email.com or @username"
                  placeholderTextColor="rgba(200,191,168,0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocusedInput("identifier")}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={styles.fieldWrap}>
                <ThemedText style={styles.fieldLabel}>Password *</ThemedText>
                <View>
                  <TextInput
                    style={[styles.input, { paddingRight: 48, borderColor: inputBorder("password") }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="rgba(200,191,168,0.4)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    onFocus={() => setFocusedInput("password")}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color={DS.creamDim}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={handleLogin} disabled={isLoading} style={styles.gradientBtnWrap}>
                <LinearGradient
                  colors={[DS.greenBright, DS.greenAccent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.gradientBtn, isLoading ? { opacity: 0.7 } : {}]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={DS.cream} />
                  ) : (
                    <ThemedText style={styles.gradientBtnText}>Sign In</ThemedText>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => {
                  console.log("FORGOT PASSWORD TAPPED");
                  navigation.push("ForgotPassword");
                }}
                style={[styles.switchRow, { marginBottom: 20 }]}
                hitSlop={12}
              >
                <ThemedText style={[styles.switchText, { color: DS.gold }]}>
                  Forgot password?
                </ThemedText>
              </Pressable>

              <Pressable onPress={switchMode} style={styles.switchRow}>
                <ThemedText style={styles.switchText}>Don't have an account? </ThemedText>
                <ThemedText style={[styles.switchText, { color: DS.gold, fontWeight: "600" }]}>
                  Sign up
                </ThemedText>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <ThemedText style={styles.dividerLabel}>or</ThemedText>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                style={[
                  styles.socialBtn,
                  {
                    backgroundColor: DS.greenDeep,
                    borderColor: "rgba(45,122,45,0.4)",
                    opacity: isGoogleLoading ? 0.6 : 1,
                  },
                ]}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={DS.cream} size="small" />
                ) : (
                  <Feather name="mail" size={20} color={DS.cream} />
                )}
                <ThemedText style={[styles.socialBtnText, { color: DS.cream }]}>
                  Continue with Google
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleAppleSignIn}
                disabled={isAppleLoading}
                style={[
                  styles.socialBtn,
                  {
                    backgroundColor: "#000000",
                    borderColor: "rgba(255,255,255,0.15)",
                    opacity: isAppleLoading ? 0.6 : 1,
                  },
                ]}
              >
                {isAppleLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Feather name="smartphone" size={20} color="#FFFFFF" />
                )}
                <ThemedText style={[styles.socialBtnText, { color: "#FFFFFF" }]}>
                  Continue with Apple
                </ThemedText>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <ThemedText style={styles.dividerLabel}>or</ThemedText>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : (
            /* ── SIGNUP MODE ───────────────────────────────────────────────── */
            <>
              <View style={{ gap: 10, marginBottom: 8 }}>
                {ROLE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.role}
                    onPress={() => navigateToSignup(opt.role)}
                    style={({ pressed }) => [
                      styles.roleCard,
                      pressed && styles.roleCardPressed,
                    ]}
                  >
                    <View style={[styles.roleIconWrap, { backgroundColor: opt.accent + "30" }]}>
                      <Feather name={opt.icon} size={22} color={opt.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <ThemedText style={styles.roleTitle}>{opt.label}</ThemedText>
                      <ThemedText style={styles.roleDesc}>{opt.description}</ThemedText>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={switchMode} style={[styles.switchRow, { marginTop: 16 }]}>
                <ThemedText style={styles.switchText}>Already have an account? </ThemedText>
                <ThemedText style={[styles.switchText, { color: DS.gold, fontWeight: "600" }]}>
                  Sign in
                </ThemedText>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <ThemedText style={styles.dividerLabel}>or</ThemedText>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          {/* ── Guest button (always visible) ─────────────────────────────── */}
          <Pressable
            onPress={handleGuestLogin}
            style={[styles.socialBtn, { backgroundColor: "rgba(255,255,255,0.04)", borderColor: DS.cardBorder }]}
          >
            <Feather name="user" size={20} color={DS.creamDim} />
            <ThemedText style={[styles.socialBtnText, { color: DS.creamDim }]}>
              Continue as Guest
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  wordmark: {
  marginLeft: 10,
  fontSize: 28,
  lineHeight: 36,
  fontWeight: "800",
  color: "#F0EAD6",
},
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: "#F0EAD6",
    textAlign: "center",
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 15,
    color: "rgba(200,191,168,0.6)",
    textAlign: "center",
    marginBottom: 28,
  },

  // ── Inputs ────────────────────────────────────────────────────────────────
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0EAD6",
    marginBottom: 6,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#F0EAD6",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  eyeBtn: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  gradientBtnWrap: {
    marginBottom: 16,
  },
  gradientBtn: {
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F0EAD6",
    letterSpacing: 0.2,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Mode switcher ─────────────────────────────────────────────────────────
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  switchText: {
    fontSize: 14,
    color: "rgba(200,191,168,0.6)",
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerLabel: {
    fontSize: 13,
    color: "rgba(200,191,168,0.4)",
    marginHorizontal: 12,
  },

  // ── Role cards (signup mode) ───────────────────────────────────────────────
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    width: "100%",
  },
  roleCardPressed: {
    backgroundColor: "rgba(45,122,45,0.1)",
    borderColor: "rgba(45,122,45,0.35)",
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F0EAD6",
  },
  roleDesc: {
    fontSize: 12,
    color: "rgba(200,191,168,0.6)",
    marginTop: 2,
  },

  // ── Pending approval screen ────────────────────────────────────────────────
  pendingContainer: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.xl,
  },
  pendingIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  pendingTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  pendingText: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  pendingDetails: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  pendingDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
});

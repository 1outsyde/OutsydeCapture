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
import { useAuth, UserRole } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AuthMode = "login" | "signup";

export default function AuthScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { login, loginAsGuest, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("consumer");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [showPendingMessage, setShowPendingMessage] = useState(false);
  const [pendingUserInfo, setPendingUserInfo] = useState<{ businessName: string; businessCategory: string; email: string } | null>(null);

  const validateForm = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

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
  };

  const handleSignupNavigation = () => {
    switch (role) {
      case "consumer":
        navigation.navigate("ConsumerSignup");
        break;
      case "business":
        navigation.navigate("BusinessSignup");
        break;
      case "photographer":
        navigation.navigate("PhotographerSignup");
        break;
    }
  };

  const handleGuestLogin = async () => {
    await loginAsGuest();
    navigation.goBack();
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
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.pendingContainer, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.pendingIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="clock" size={64} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.pendingTitle}>
            Account Pending Approval
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: theme.textSecondary }]}>
            Your business account is still under review.
          </ThemedText>
          <ThemedText type="body" style={[styles.pendingText, { color: theme.textSecondary }]}>
            Our team will review your application and get back to you within 24-48 hours. You will receive an email notification once your account is approved.
          </ThemedText>
          <View style={styles.pendingDetails}>
            <View style={styles.pendingDetailRow}>
              <Feather name="briefcase" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {pendingUserInfo?.businessName}
              </ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="tag" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {pendingUserInfo?.businessCategory}
              </ThemedText>
            </View>
            <View style={styles.pendingDetailRow}>
              <Feather name="mail" size={20} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {pendingUserInfo?.email}
              </ThemedText>
            </View>
          </View>
          <Button
            onPress={() => {
              setPendingUserInfo(null);
              setShowPendingMessage(false);
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
            {mode === "login" ? "Welcome back" : "Join Outsyde"}
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {mode === "login"
              ? "Sign in to continue"
              : "Select your account type to get started"}
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

              <Button
                onPress={handleSignupNavigation}
                style={styles.submitButton}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
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
                    placeholder="Enter password"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
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

              <Button
                onPress={handleLogin}
                disabled={isLoading}
                style={styles.submitButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </>
          )}

          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "signup" : "login");
              setEmail("");
              setPassword("");
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
            onPress={handleGuestLogin}
            style={[styles.guestButton, { borderColor: theme.border }]}
          >
            <Feather name="user" size={20} color={theme.text} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Continue as Guest
            </ThemedText>
          </Pressable>

          <View style={styles.socialButtons}>
            <Pressable
              style={[styles.socialButton, { backgroundColor: "#000000" }]}
            >
              <Feather name="smartphone" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                Continue with Apple
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.socialButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, borderWidth: 1 }]}
            >
              <Feather name="mail" size={20} color={theme.text} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                Continue with Google
              </ThemedText>
            </Pressable>
          </View>
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
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  logoText: {
    marginLeft: Spacing.md,
    fontSize: 32,
    fontWeight: "800",
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
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  roleButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  roleButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
  },
  approvalNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  passwordToggle: {
    position: "absolute",
    right: Spacing.md,
    height: 50,
    justifyContent: "center",
  },
  submitButton: {
    marginBottom: Spacing.lg,
  },
  switchMode: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
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
  socialButtons: {
    gap: Spacing.sm,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.md,
  },
  pendingContainer: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.xl,
  },
  pendingIcon: {
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
  pendingButton: {
    width: "100%",
  },
});

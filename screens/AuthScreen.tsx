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
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AuthMode = "login" | "signup";

export default function AuthScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { login, signup, loginAsGuest, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    let success: boolean;
    if (mode === "login") {
      success = await login(email, password);
    } else {
      success = await signup(name, email, password);
    }

    if (success) {
      navigation.goBack();
    } else {
      Alert.alert("Error", "Authentication failed. Please try again.");
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

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
              ? "Sign in to continue booking photographers"
              : "Join Outsyde to book your next photography session"}
          </ThemedText>

          {mode === "signup" ? (
            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>
                Full Name
              </ThemedText>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          ) : null}

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Email
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
              Password
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
                onSubmitEditing={handleSubmit}
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
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.submitButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>

          <View style={styles.switchMode}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            </ThemedText>
            <Pressable onPress={() => setMode(mode === "login" ? "signup" : "login")}>
              <ThemedText type="link">
                {mode === "login" ? "Sign Up" : "Sign In"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText type="small" style={[styles.dividerText, { color: theme.textSecondary }]}>
              or continue with
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.socialButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="smartphone" size={20} color={theme.text} />
              <ThemedText type="button" style={styles.socialButtonText}>
                Apple
              </ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="mail" size={20} color={theme.text} />
              <ThemedText type="button" style={styles.socialButtonText}>
                Google
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={async () => {
              const success = await loginAsGuest();
              if (success) {
                navigation.goBack();
              }
            }}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.guestButton,
              { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="user" size={20} color={theme.textSecondary} />
            <ThemedText type="button" style={[styles.guestButtonText, { color: theme.textSecondary }]}>
              Continue as Guest
            </ThemedText>
          </Pressable>

          <View style={styles.terms}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
              By continuing, you agree to our{" "}
            </ThemedText>
            <View style={styles.termsLinks}>
              <Pressable>
                <ThemedText type="caption" style={{ color: theme.link }}>
                  Terms of Service
                </ThemedText>
              </Pressable>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {" "}and{" "}
              </ThemedText>
              <Pressable>
                <ThemedText type="caption" style={{ color: theme.link }}>
                  Privacy Policy
                </ThemedText>
              </Pressable>
            </View>
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logoText: {
    marginTop: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    marginBottom: Spacing["2xl"],
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
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
    height: Spacing.inputHeight,
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
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
    paddingHorizontal: Spacing.lg,
  },
  socialButtons: {
    flexDirection: "row",
    marginBottom: Spacing.xl,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.xs,
  },
  socialButtonText: {
    marginLeft: Spacing.sm,
  },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  guestButtonText: {
    marginLeft: Spacing.sm,
  },
  terms: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  termsLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
});

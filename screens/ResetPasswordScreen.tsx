import React, { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/types";

const API_BASE_URL = "https://outsyde-backend.onrender.com";

const DS = {
  bg: "#080C08",
  cardBorder: "rgba(255,255,255,0.08)",
  greenBright: "#2D7A2D",
  greenAccent: "#3A9E3A",
  gold: "#C9933A",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
  error: "#E05252",
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "ResetPassword">;

export default function ResetPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const insets = useSafeAreaInsets();

  const { token, email } = route.params ?? {};

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const validate = (): string | null => {
    if (newPassword.length < 8) return "Password must be at least 8 characters.";
    if (newPassword !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!token || !email) { setError("Invalid reset link. Please request a new one."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken: token, email, newPassword }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => {
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: "Auth", params: { returnTo: undefined } }] })
          );
        }, 2500);
      } else {
        const body = await res.json().catch(() => ({}));
        if (res.status === 400) {
          setError(body?.message || "This reset link has expired or already been used.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.doneCenter}>
          <View style={[styles.iconCircle, { backgroundColor: DS.greenBright + "22" }]}>
            <Feather name="check-circle" size={44} color={DS.greenBright} />
          </View>
          <ThemedText style={styles.doneTitle}>Password updated</ThemedText>
          <ThemedText style={styles.doneBody}>
            Your password has been changed successfully. Redirecting you to sign in...
          </ThemedText>
          <ActivityIndicator color={DS.greenBright} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  const isExpiredError = error?.toLowerCase().includes("expired") || error?.toLowerCase().includes("already been used");

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={DS.cream} />
          </Pressable>

          <Feather name="key" size={40} color={DS.gold} style={{ marginBottom: 20 }} />
          <ThemedText style={styles.headline}>Create new password</ThemedText>
          <ThemedText style={styles.subheadline}>
            Choose a strong password of at least 8 characters.
          </ThemedText>

          {/* New password */}
          <ThemedText style={styles.fieldLabel}>New password</ThemedText>
          <View style={styles.inputWrap}>
            <TextInput
              style={[
                styles.input,
                { paddingRight: 52, borderColor: focused === "new" ? DS.gold : DS.cardBorder },
              ]}
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setError(null); }}
              placeholder="At least 8 characters"
              placeholderTextColor="rgba(200,191,168,0.4)"
              secureTextEntry={!showNew}
              autoCapitalize="none"
              returnKeyType="next"
              onFocus={() => setFocused("new")}
              onBlur={() => setFocused(null)}
            />
            <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
              <Feather name={showNew ? "eye-off" : "eye"} size={20} color={DS.creamDim} />
            </Pressable>
          </View>

          {/* Confirm password */}
          <ThemedText style={styles.fieldLabel}>Confirm password</ThemedText>
          <View style={styles.inputWrap}>
            <TextInput
              style={[
                styles.input,
                { paddingRight: 52, borderColor: focused === "confirm" ? DS.gold : DS.cardBorder, marginBottom: 0 },
              ]}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
              placeholder="Repeat your password"
              placeholderTextColor="rgba(200,191,168,0.4)"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              onFocus={() => setFocused("confirm")}
              onBlur={() => setFocused(null)}
            />
            <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Feather name={showConfirm ? "eye-off" : "eye"} size={20} color={DS.creamDim} />
            </Pressable>
          </View>

          {/* Error message */}
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={DS.error} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {/* Expired error — offer to request a new link */}
          {isExpiredError ? (
            <Pressable
              onPress={() =>
                navigation.dispatch(
                  CommonActions.reset({ index: 0, routes: [{ name: "ForgotPassword" }] })
                )
              }
              style={styles.retryLink}
            >
              <ThemedText style={{ color: DS.gold, fontSize: 14, fontWeight: "600" }}>
                Request a new reset link
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable onPress={handleSubmit} disabled={loading} style={{ marginTop: 24 }}>
            <LinearGradient
              colors={[DS.greenBright, DS.greenAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.primaryBtn, loading ? { opacity: 0.7 } : {}]}
            >
              {loading ? (
                <ActivityIndicator color={DS.cream} />
              ) : (
                <ThemedText style={styles.primaryBtnText}>Update Password</ThemedText>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.bg,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  backBtn: {
    marginBottom: 32,
  },
  doneCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  doneTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: DS.cream,
    textAlign: "center",
    marginBottom: 16,
  },
  doneBody: {
    fontSize: 15,
    color: DS.creamDim,
    textAlign: "center",
    lineHeight: 22,
  },
  headline: {
    fontSize: 28,
    fontWeight: "700",
    color: DS.cream,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    color: DS.creamDim,
    marginBottom: 36,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.cream,
    marginBottom: 6,
  },
  inputWrap: {
    position: "relative",
    marginBottom: 20,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DS.cream,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  eyeBtn: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(224,82,82,0.1)",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: DS.error,
    flex: 1,
    lineHeight: 18,
  },
  retryLink: {
    marginTop: 12,
    alignItems: "center",
  },
  primaryBtn: {
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: DS.cream,
    letterSpacing: 0.2,
  },
});

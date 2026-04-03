import React, { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function isValidEmail(e: string) {
  return /\S+@\S+\.\S+/.test(e.trim());
}

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      // Intentional: always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={DS.cream} />
        </Pressable>
        <View style={styles.sentCenter}>
          <View style={[styles.iconCircle, { backgroundColor: DS.greenBright + "22" }]}>
            <Feather name="mail" size={40} color={DS.greenBright} />
          </View>
          <ThemedText style={styles.sentTitle}>Check your inbox</ThemedText>
          <ThemedText style={styles.sentBody}>
            If an account exists with that email, you'll receive a reset link shortly. Check your inbox and spam folder.
          </ThemedText>
          <Pressable onPress={() => navigation.goBack()} style={{ width: "100%", marginTop: 40 }}>
            <LinearGradient
              colors={[DS.greenBright, DS.greenAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <ThemedText style={styles.primaryBtnText}>Back to Sign In</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

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

          <Feather name="lock" size={40} color={DS.gold} style={{ marginBottom: 20 }} />
          <ThemedText style={styles.headline}>Forgot password?</ThemedText>
          <ThemedText style={styles.subheadline}>
            Enter the email address linked to your account and we'll send you a reset link.
          </ThemedText>

          <ThemedText style={styles.fieldLabel}>Email address</ThemedText>
          <TextInput
            style={[
              styles.input,
              { borderColor: focused ? DS.gold : DS.cardBorder },
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="rgba(200,191,168,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />

          <Pressable onPress={handleSubmit} disabled={loading}>
            <LinearGradient
              colors={[DS.greenBright, DS.greenAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.primaryBtn, loading ? { opacity: 0.7 } : {}]}
            >
              {loading ? (
                <ActivityIndicator color={DS.cream} />
              ) : (
                <ThemedText style={styles.primaryBtnText}>Send Reset Link</ThemedText>
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
  sentCenter: {
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
  sentTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: DS.cream,
    textAlign: "center",
    marginBottom: 16,
  },
  sentBody: {
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
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DS.cream,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 24,
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

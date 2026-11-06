/**
 * Change email (backend #426 + #428). Opened from Settings → Change email.
 *
 * Step 1: new email (+ password only when the account has one). Step 2: the 6 digit code sent to the NEW
 * address. Reopening the screen with a code still waiting goes straight to step 2. On success the user is
 * refreshed (AuthContext now copies email) and the screen goes back to Settings. The header back button always
 * works, so nobody is stuck here.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { AccountStackParamList } from "@/navigation/types";
import {
  CODE_LENGTH,
  checkEmailForm,
  cleanCode,
  endsCodeStep,
  expiryLine,
  normalizeEmail,
  readEmailChangeError,
} from "@/utils/changeEmailLogic";

type Nav = NativeStackNavigationProp<AccountStackParamList, "ChangeEmail">;
type Step = "loading" | "email" | "code";

export default function ChangeEmailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { getToken, user, refreshUser } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [passwordRequired, setPasswordRequired] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStep("loading");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const status = await api.getEmailChange(token);
      setPasswordRequired(status.passwordRequired !== false);
      if (status.pending) {
        setPendingEmail(status.pending.newEmail);
        setExpiresAt(status.pending.expiresAt);
        setStep("code");
      } else {
        setStep("email");
      }
    } catch (e) {
      // Ask for the password when unsure; the backend refuses a missing one with a clear message anyway.
      setPasswordRequired(true);
      setStep("email");
      setError(readEmailChangeError(e).message);
    }
  }, [getToken]);

  useEffect(() => {
    // Deferred one tick so the first render isn't followed by a synchronous state change (react-hooks rule).
    let active = true;
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const sendCode = async (email: string) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const res = await api.requestEmailChange(
        token,
        normalizeEmail(email),
        passwordRequired ? password : undefined,
      );
      setPendingEmail(res.pending.newEmail);
      setExpiresAt(res.pending.expiresAt);
      setCode("");
      setPassword("");
      setStep("code");
      return true;
    } catch (e) {
      setError(readEmailChangeError(e).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSend = () => {
    const check = checkEmailForm({
      newEmail,
      currentEmail: user?.email,
      password,
      passwordRequired,
    });
    if (!check.ok) {
      setError(check.message);
      return;
    }
    sendCode(newEmail);
  };

  const onConfirm = async () => {
    if (code.length !== CODE_LENGTH) {
      setError("Enter the 6 digit code.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      const res = await api.confirmEmailChange(token, code);
      await refreshUser();
      Alert.alert(
        "Email changed",
        `Your email is now ${res.email}. Use it the next time you sign in.`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      const err = readEmailChangeError(e);
      setCode("");
      if (endsCodeStep(err.code)) {
        setPendingEmail(null);
        setExpiresAt(null);
        setStep("email");
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onUseDifferentEmail = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      if (token) await api.cancelEmailChange(token);
    } catch {
      // Nothing to undo: a new request replaces the open one anyway.
    } finally {
      setBusy(false);
      setPendingEmail(null);
      setExpiresAt(null);
      setCode("");
      setError(null);
      setInfo(null);
      setStep("email");
    }
  };

  const onResend = async () => {
    if (!pendingEmail) return;
    if (passwordRequired) {
      // A new code needs the password again: send them back to step 1 with the address filled in.
      setNewEmail(pendingEmail);
      setStep("email");
      setInfo("Enter your password to get a new code.");
      return;
    }
    if (await sendCode(pendingEmail)) setInfo("We sent a new code.");
  };

  if (step === "loading") {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#E8B930" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {step === "email" ? (
          <>
            <ThemedText style={styles.label}>Current email</ThemedText>
            <View style={styles.card}>
              <ThemedText style={styles.currentEmail}>
                {user?.email || "No email on this account"}
              </ThemedText>
            </View>

            <ThemedText style={styles.label}>New email</ThemedText>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={(v) => {
                setNewEmail(v);
                setError(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!busy}
              accessibilityLabel="New email"
            />

            {passwordRequired ? (
              <>
                <ThemedText style={styles.label}>Password</ThemedText>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setError(null);
                    }}
                    placeholder="Your Outsyde password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    editable={!busy}
                    accessibilityLabel="Password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((s) => !s)}
                    style={styles.eye}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <ThemedText style={styles.eyeText}>
                      {showPassword ? "Hide" : "Show"}
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            ) : null}

            <ThemedText style={styles.hint}>
              {
                "We'll send a 6 digit code to your new email. Your email changes once you enter it."
              }
            </ThemedText>
            {info ? <ThemedText style={styles.info}>{info}</ThemedText> : null}
            {error ? (
              <ThemedText style={styles.error} accessibilityRole="alert">
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primary,
                (busy || pressed) && { opacity: 0.7 },
              ]}
              onPress={onSend}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#E8B930" />
              ) : (
                <ThemedText style={styles.primaryText}>Send code</ThemedText>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText style={styles.title}>Check your new email</ThemedText>
            <ThemedText style={styles.body}>
              Enter the 6 digit code we sent to{" "}
              <ThemedText style={styles.bold}>{pendingEmail}</ThemedText>.
            </ThemedText>
            {expiryLine(expiresAt) ? (
              <ThemedText style={styles.hint}>
                {expiryLine(expiresAt)}
              </ThemedText>
            ) : null}

            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(v) => {
                setCode(cleanCode(v));
                setError(null);
              }}
              placeholder="000000"
              placeholderTextColor="#444"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH + 4}
              editable={!busy}
              accessibilityLabel="6 digit code"
            />
            {info ? <ThemedText style={styles.info}>{info}</ThemedText> : null}
            {error ? (
              <ThemedText style={styles.error} accessibilityRole="alert">
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primary,
                (busy || pressed || code.length !== CODE_LENGTH) && {
                  opacity: 0.7,
                },
              ]}
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#E8B930" />
              ) : (
                <ThemedText style={styles.primaryText}>Confirm</ThemedText>
              )}
            </Pressable>

            <View style={styles.links}>
              <Pressable
                onPress={onResend}
                disabled={busy}
                accessibilityRole="button"
                hitSlop={8}
              >
                <ThemedText style={styles.link}>Resend code</ThemedText>
              </Pressable>
              <Pressable
                onPress={onUseDifferentEmail}
                disabled={busy}
                accessibilityRole="button"
                hitSlop={8}
              >
                <ThemedText style={styles.link}>
                  Use a different email
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },
  center: { alignItems: "center", justifyContent: "center" },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#888888",
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#232323",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  currentEmail: { color: "#f0f0f0", fontSize: 15 },
  input: {
    backgroundColor: "#232323",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "#f0f0f0",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2e2e2e",
  },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, paddingRight: 64 },
  eye: {
    position: "absolute",
    right: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  eyeText: { color: "#E8B930", fontSize: 13, fontWeight: "600" },
  hint: { color: "#888888", fontSize: 13, marginTop: 14, lineHeight: 19 },
  info: { color: "#4ad4a8", fontSize: 14, marginTop: 12 },
  error: { color: "#E74C3C", fontSize: 14, marginTop: 12 },
  primary: {
    marginTop: 22,
    backgroundColor: "#1A3C34",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: { color: "#E8B930", fontSize: 16, fontWeight: "700" },
  title: { color: "#f0f0f0", fontSize: 20, fontWeight: "700", marginTop: 8 },
  body: { color: "#cccccc", fontSize: 15, marginTop: 10, lineHeight: 21 },
  bold: { color: "#f0f0f0", fontWeight: "700" },
  codeInput: {
    marginTop: 20,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  links: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  link: { color: "#E8B930", fontSize: 14, fontWeight: "600" },
});

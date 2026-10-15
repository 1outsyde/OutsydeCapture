// ClaimAccountScreen — finish an account that exists but has no password yet.
//
// Reached from:
//   • AuthScreen, when login answers ACCOUNT_NEEDS_SETUP (the backend already emailed a code) → codeSent
//   • a signup screen's "Email already registered" → "Finish my account" (we send a code here)
//   • a goutsyde.com/claim?token=…&email=… link (reminder email) → straight to the password step
//
// Steps: email (only when unknown) → 6-digit code → password → username (only when the backend says
// USERNAME_REQUIRED) → signed in with the new password through the normal login().
// Backend: POST /api/account-setup/send-code, POST /api/auth/forgot-password/verify-code (existing),
// POST /api/account-setup/claim. Same flow as goutsyde.com/claim.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/types";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  USERNAME_RE,
  apiErrorCode,
  apiErrorMessage,
  cleanUsernameInput,
  shouldOpenFinishSetup,
} from "@/utils/accountSetup";

const DS = {
  bg: "#080C08",
  surface: "#141414",
  cardBorder: "rgba(255,255,255,0.08)",
  greenBright: "#2D7A2D",
  greenAccent: "#3A9E3A",
  gold: "#C9933A",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
  error: "#E74C3C",
};

const RESEND_SECONDS = 60;
const APP_STORE_SUPPORT =
  "mailto:info@goutsyde.com?subject=This%20account%20isn%27t%20mine";

type Step = "email" | "code" | "password" | "username" | "expired" | "already";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Check = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

function isValidEmail(e: string) {
  return /\S+@\S+\.\S+/.test(e.trim());
}

export default function ClaimAccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "ClaimAccount">>();
  const insets = useSafeAreaInsets();
  const { login, getToken } = useAuth();

  const initialEmail = (route.params?.email ?? "").trim().toLowerCase();
  const linkToken = route.params?.token ?? "";
  const codeSent = route.params?.codeSent === true;

  const [step, setStep] = useState<Step>(
    linkToken && initialEmail ? "password" : initialEmail ? "code" : "email",
  );
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState(linkToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [remoteCheck, setRemoteCheck] = useState<{
    name: string;
    state: "available" | "taken" | "error";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(codeSent ? RESEND_SECONDS : 0);
  const autoSent = useRef(false);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // From signup ("Finish my account"): we know the email but no code was sent yet.
  useEffect(() => {
    if (autoSent.current) return;
    if (step === "code" && initialEmail && !codeSent && !linkToken) {
      autoSent.current = true;
      void sendCode(initialEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live username availability (debounced). idle / invalid / checking are derived, not stored.
  const trimmed = username.trim();
  const usernameValid = USERNAME_RE.test(trimmed);
  const usernameCheck: Check = !trimmed
    ? "idle"
    : !usernameValid
      ? "invalid"
      : remoteCheck?.name === trimmed
        ? remoteCheck.state
        : "checking";

  useEffect(() => {
    if (step !== "username" || !usernameValid) return;
    const name = trimmed;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await api.checkUsernameAvailability(name);
        if (!cancelled)
          setRemoteCheck({ name, state: r.available ? "available" : "taken" });
      } catch {
        if (!cancelled) setRemoteCheck({ name, state: "error" });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, usernameValid, step]);

  async function sendCode(target: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await api.sendClaimCode(target);
      setNotice(
        `If ${target} needs setting up, a 6-digit code is on its way. Check your inbox and spam.`,
      );
      setResendIn(RESEND_SECONDS);
      return true;
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn’t send a code. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail() {
    const target = email.trim().toLowerCase();
    if (!isValidEmail(target)) {
      setError("Enter the email on your account.");
      return;
    }
    setEmail(target);
    if (await sendCode(target)) {
      setCode("");
      setStep("code");
    }
  }

  async function handleCode() {
    setError(null);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.verifyPasswordResetCode(email, digits);
      if (!r?.resetToken) throw new Error("No token");
      setResetToken(r.resetToken);
      setNotice(null);
      setStep("password");
    } catch (e) {
      setError(apiErrorMessage(e, "That code didn’t work. Request a new one."));
    } finally {
      setBusy(false);
    }
  }

  // Signs in with the new password through the normal login, then shows what's left (if anything).
  async function finishSignIn() {
    const result = await login(email, password, "email");
    if (!result.success) {
      setError(
        "Your account is ready, but signing in failed. Sign in with your email and new password.",
      );
      navigation.navigate("Auth", {});
      return;
    }
    try {
      const token = await getToken();
      const status = token ? await api.getAccountSetupStatus(token) : null;
      if (shouldOpenFinishSetup(status, result.user?.role)) {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [{ name: "Main" }, { name: "FinishSetup" }],
          }),
        );
        return;
      }
    } catch {
      // the checklist is a convenience; never block sign-in on it
    }
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }),
    );
  }

  async function submitClaim(withUsername?: string) {
    setError(null);
    setBusy(true);
    try {
      await api.claimAccount({
        email,
        resetToken,
        newPassword: password,
        ...(withUsername ? { username: withUsername } : {}),
      });
      await finishSignIn();
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === "USERNAME_REQUIRED") setStep("username");
      else if (code === "INVALID_TOKEN") setStep("expired");
      else if (code === "ALREADY_CLAIMED") setStep("already");
      else {
        if (code === "USERNAME_TAKEN" && withUsername)
          setRemoteCheck({ name: withUsername, state: "taken" });
        setError(
          apiErrorMessage(e, "Couldn’t finish your account. Please try again."),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function handlePassword() {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }
    void submitClaim();
  }

  function handleUsername() {
    if (!usernameValid) {
      setError("Use 3–20 lowercase letters, numbers or underscores.");
      return;
    }
    if (usernameCheck === "taken") {
      setError("That username is taken. Try another.");
      return;
    }
    void submitClaim(trimmed);
  }

  async function handleExpired() {
    if (!email) {
      setStep("email");
      return;
    }
    if (await sendCode(email)) {
      setCode("");
      setResetToken("");
      setStep("code");
    }
  }

  const handleBack = () => {
    setError(null);
    if (step === "username") setStep("password");
    else navigation.goBack();
  };

  const stepNumber = step === "password" ? 1 : step === "username" ? 2 : 0;

  const PrimaryButton = ({
    label,
    busyLabel,
    onPress,
    disabled,
  }: {
    label: string;
    busyLabel: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.btnWrap, (busy || disabled) && { opacity: 0.55 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={[DS.greenBright, DS.greenAccent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryBtn}
      >
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={DS.cream} />
            <ThemedText style={styles.primaryBtnText}>{busyLabel}</ThemedText>
          </View>
        ) : (
          <ThemedText style={styles.primaryBtnText}>{label}</ThemedText>
        )}
      </LinearGradient>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={24} color={DS.cream} />
            </Pressable>
            {stepNumber > 0 && (
              <ThemedText style={styles.stepText}>
                Step {stepNumber} of 2
              </ThemedText>
            )}
          </View>
          {stepNumber > 0 && (
            <View style={styles.bars}>
              <View style={[styles.bar, styles.barOn]} />
              <View style={[styles.bar, stepNumber === 2 && styles.barOn]} />
            </View>
          )}

          {step === "email" && (
            <>
              <ThemedText style={styles.eyebrow}>
                FINISH YOUR ACCOUNT
              </ThemedText>
              <ThemedText style={styles.heading}>
                Let’s lock in your account
              </ThemedText>
              <ThemedText style={styles.subheading}>
                {codeSent
                  ? "We emailed a 6-digit code to the address on your account. Enter that email to continue."
                  : "Enter the email you signed up with. We’ll send you a 6-digit code."}
              </ThemedText>
              <ThemedText style={styles.fieldLabel}>Email</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: DS.cardBorder }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={DS.creamDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                accessibilityLabel="Email"
              />
              {error && (
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
              <PrimaryButton
                label="Continue"
                busyLabel="Sending…"
                onPress={handleEmail}
              />
            </>
          )}

          {step === "code" && (
            <>
              <ThemedText style={styles.eyebrow}>CHECK YOUR EMAIL</ThemedText>
              <ThemedText style={styles.heading}>Enter your code</ThemedText>
              <ThemedText style={styles.subheading}>
                Your account is saved — it just needs a password. We sent a
                6-digit code to{" "}
                <ThemedText style={styles.strong}>{email}</ThemedText>.
              </ThemedText>
              <ThemedText style={styles.fieldLabel}>6-digit code</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.codeInput,
                  { borderColor: error ? DS.error : DS.cardBorder },
                ]}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={DS.creamDim}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                accessibilityLabel="6-digit code"
              />
              {notice && !error && (
                <ThemedText style={styles.notice}>{notice}</ThemedText>
              )}
              {error && (
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
              <PrimaryButton
                label="Continue"
                busyLabel="Checking…"
                onPress={handleCode}
              />
              <View style={styles.linkRow}>
                <Pressable
                  disabled={busy || resendIn > 0}
                  onPress={() => void sendCode(email)}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <ThemedText
                    style={[
                      styles.link,
                      (busy || resendIn > 0) && styles.linkDisabled,
                    ]}
                  >
                    {resendIn > 0
                      ? `Send a new code in ${resendIn}s`
                      : "Send a new code"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setError(null);
                    setNotice(null);
                    setStep("email");
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <ThemedText style={styles.link}>
                    Use a different email
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}

          {step === "password" && (
            <>
              <ThemedText style={styles.eyebrow}>WELCOME BACK</ThemedText>
              <ThemedText style={styles.heading}>
                Create your password
              </ThemedText>
              <ThemedText style={styles.subheading}>
                This is the account you made with Outsyde. Set a password so you
                can sign in here and on goutsyde.com.
              </ThemedText>
              <ThemedText style={styles.fieldLabel}>Email</ThemedText>
              <TextInput
                style={[styles.input, styles.readonly]}
                value={email}
                editable={false}
                accessibilityLabel="Email"
              />
              <ThemedText style={styles.fieldLabel}>New password</ThemedText>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { borderColor: DS.cardBorder },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={DS.creamDim}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  accessibilityLabel="New password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={DS.creamDim}
                  />
                </Pressable>
              </View>
              <ThemedText style={styles.fieldLabel}>
                Confirm password
              </ThemedText>
              <TextInput
                style={[styles.input, { borderColor: DS.cardBorder }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Type it again"
                placeholderTextColor={DS.creamDim}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                accessibilityLabel="Confirm password"
              />
              {error && (
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
              <PrimaryButton
                label="Continue"
                busyLabel="Saving…"
                onPress={handlePassword}
              />
              <Pressable
                style={styles.linkRow}
                onPress={() => void Linking.openURL(APP_STORE_SUPPORT)}
                accessibilityRole="link"
              >
                <ThemedText style={styles.smallText}>
                  Not you? Let us know and we’ll remove this account.
                </ThemedText>
              </Pressable>
            </>
          )}

          {step === "username" && (
            <>
              <ThemedText style={styles.eyebrow}>LAST STEP</ThemedText>
              <ThemedText style={styles.heading}>
                Pick your @username
              </ThemedText>
              <ThemedText style={styles.subheading}>
                It’s how people find you in search, and you can sign in with it
                too.
              </ThemedText>
              <ThemedText style={styles.fieldLabel}>Username</ThemedText>
              <View
                style={[
                  styles.unWrap,
                  {
                    borderColor:
                      usernameCheck === "available"
                        ? DS.greenAccent
                        : usernameCheck === "taken" ||
                            usernameCheck === "invalid"
                          ? DS.error
                          : DS.cardBorder,
                  },
                ]}
              >
                <ThemedText style={styles.at}>@</ThemedText>
                <TextInput
                  style={styles.unInput}
                  value={username}
                  onChangeText={(t) => setUsername(cleanUsernameInput(t))}
                  placeholder="yourname"
                  placeholderTextColor={DS.creamDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  accessibilityLabel="Username"
                />
              </View>
              <ThemedText
                style={[
                  styles.unState,
                  usernameCheck === "available" && { color: DS.greenAccent },
                  (usernameCheck === "taken" ||
                    usernameCheck === "invalid") && { color: DS.error },
                ]}
              >
                {usernameCheck === "checking"
                  ? "Checking…"
                  : usernameCheck === "available"
                    ? "✓ Available"
                    : usernameCheck === "taken"
                      ? "Taken — try another"
                      : usernameCheck === "invalid"
                        ? "3–20 lowercase letters, numbers or _"
                        : usernameCheck === "error"
                          ? "Couldn’t check right now — you can still continue"
                          : " "}
              </ThemedText>
              {error && (
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
              <PrimaryButton
                label="Finish my account"
                busyLabel="Finishing…"
                onPress={handleUsername}
                disabled={
                  usernameCheck === "taken" ||
                  usernameCheck === "invalid" ||
                  !trimmed
                }
              />
              <ThemedText style={[styles.smallText, styles.center]}>
                You can change your username later in Settings.
              </ThemedText>
            </>
          )}

          {step === "expired" && (
            <>
              <ThemedText style={styles.eyebrow}>LINK EXPIRED</ThemedText>
              <ThemedText style={styles.heading}>
                Let’s get you a new code
              </ThemedText>
              <ThemedText style={styles.subheading}>
                That link has expired or was replaced by a newer one. We’ll
                email a 6-digit code instead.
              </ThemedText>
              {error && (
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
              <PrimaryButton
                label="Send me a code"
                busyLabel="Sending…"
                onPress={handleExpired}
              />
            </>
          )}

          {step === "already" && (
            <>
              <ThemedText style={styles.eyebrow}>ALL SET</ThemedText>
              <ThemedText style={styles.heading}>
                This account already has a password
              </ThemedText>
              <ThemedText style={styles.subheading}>
                Sign in with your email or username. Forgot it? Reset it in a
                minute.
              </ThemedText>
              <PrimaryButton
                label="Sign in"
                busyLabel="…"
                onPress={() => navigation.navigate("Auth", {})}
              />
              <Pressable
                style={styles.linkRow}
                onPress={() => navigation.navigate("ForgotPassword")}
                accessibilityRole="button"
              >
                <ThemedText style={styles.link}>Forgot password</ThemedText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.bg },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  stepText: { fontSize: 13, color: DS.creamDim },
  bars: { flexDirection: "row", gap: 6, marginBottom: 28 },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(240,234,214,0.18)",
  },
  barOn: { backgroundColor: DS.gold },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    color: DS.gold,
    marginBottom: 8,
    fontWeight: "600",
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    color: DS.cream,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 15,
    color: DS.creamDim,
    marginBottom: 28,
    lineHeight: 22,
  },
  strong: { color: DS.cream, fontWeight: "600", fontSize: 15 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: DS.cream,
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DS.cream,
    backgroundColor: DS.surface,
    marginBottom: 20,
  },
  codeInput: {
    fontSize: 26,
    letterSpacing: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  readonly: {
    color: DS.creamDim,
    borderColor: DS.cardBorder,
    backgroundColor: "rgba(20,20,20,0.6)",
  },
  passwordWrap: { position: "relative", marginBottom: 20 },
  passwordInput: { marginBottom: 0, paddingRight: 52 },
  eyeBtn: {
    position: "absolute",
    right: 8,
    top: 6,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  unWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: DS.surface,
  },
  at: { fontSize: 16, color: DS.creamDim },
  unInput: {
    flex: 1,
    fontSize: 16,
    color: DS.cream,
    paddingHorizontal: 4,
    height: 54,
  },
  unState: { fontSize: 12, color: DS.creamDim, marginTop: 6, marginBottom: 16 },
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
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnWrap: { marginTop: 4, marginBottom: 4 },
  errorText: { fontSize: 13, color: DS.error, marginTop: -8, marginBottom: 16 },
  notice: {
    fontSize: 13,
    color: DS.creamDim,
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 19,
  },
  linkRow: {
    marginTop: 20,
    alignItems: "center",
    gap: 14,
    minHeight: 44,
    justifyContent: "center",
  },
  link: { fontSize: 14, color: DS.gold, textDecorationLine: "underline" },
  linkDisabled: { color: DS.creamDim, textDecorationLine: "none" },
  smallText: { fontSize: 13, color: DS.creamDim, lineHeight: 19 },
  center: { textAlign: "center", marginTop: 16 },
});

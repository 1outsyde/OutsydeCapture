import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/types";
import { api } from "@/services/api";

// ─── Design tokens ─────────────────────────────────────────────────────────
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

const CODE_LENGTH = 6;
const CODE_EXPIRY_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS = 3;

type Step = 1 | 2 | 3 | "success";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function isValidEmail(e: string) {
  return /\S+@\S+\.\S+/.test(e.trim());
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── OTP Input Row ─────────────────────────────────────────────────────────
interface OTPInputProps {
  value: string[];
  onChange: (digits: string[]) => void;
  focused: number | null;
  onFocusChange: (idx: number | null) => void;
  shakeAnim: Animated.Value;
  error: string | null;
  loading: boolean;
}

function OTPInputRow({ value, onChange, focused, onFocusChange, shakeAnim, error, loading }: OTPInputProps) {
  const refs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first box when this row mounts
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (text: string, idx: number) => {
    // Handle paste: if text has 6+ chars, spread across boxes
    if (text.length >= CODE_LENGTH) {
      const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");
      if (digits.length === CODE_LENGTH) {
        onChange(digits);
        refs.current[CODE_LENGTH - 1]?.blur();
        return;
      }
    }
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < CODE_LENGTH - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === "Backspace") {
      if (value[idx]) {
        const next = [...value];
        next[idx] = "";
        onChange(next);
      } else if (idx > 0) {
        const next = [...value];
        next[idx - 1] = "";
        onChange(next);
        refs.current[idx - 1]?.focus();
      }
    }
  };

  const shake = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-8, 0, 8],
  });

  return (
    <Animated.View style={[styles.otpRow, { transform: [{ translateX: shake }] }]}>
      {Array.from({ length: CODE_LENGTH }).map((_, idx) => (
        <TextInput
          key={idx}
          ref={(r) => { refs.current[idx] = r; }}
          style={[
            styles.otpBox,
            focused === idx && styles.otpBoxFocused,
            error ? styles.otpBoxError : null,
          ]}
          value={value[idx] || ""}
          onChangeText={(t) => handleChange(t, idx)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
          onFocus={() => onFocusChange(idx)}
          onBlur={() => onFocusChange(null)}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          textAlign="center"
          selectTextOnFocus
          editable={!loading}
          caretHidden
        />
      ))}
    </Animated.View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 state
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [otpFocused, setOtpFocused] = useState<number | null>(null);
  const [step2Loading, setStep2Loading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const codeSentAt = useRef<number>(0);
  const [expirySecondsLeft, setExpirySecondsLeft] = useState(CODE_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendCount, setResendCount] = useState(0);
  const expiryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitLock = useRef(false);

  // Step 3 state
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step3Loading, setStep3Loading] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  // Success auto-navigate
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer management ────────────────────────────────────────────────────
  const startTimers = useCallback(() => {
    codeSentAt.current = Date.now();
    autoSubmitLock.current = false;

    if (expiryTimer.current) clearInterval(expiryTimer.current);
    if (resendTimer.current) clearInterval(resendTimer.current);

    setExpirySecondsLeft(CODE_EXPIRY_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    expiryTimer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - codeSentAt.current) / 1000);
      const remaining = Math.max(0, CODE_EXPIRY_SECONDS - elapsed);
      setExpirySecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(expiryTimer.current!);
        expiryTimer.current = null;
      }
    }, 1000);

    resendTimer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - codeSentAt.current) / 1000);
      const remaining = Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
      setResendCooldown(remaining);
      if (remaining === 0) {
        clearInterval(resendTimer.current!);
        resendTimer.current = null;
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (expiryTimer.current) clearInterval(expiryTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);


  // ── Auto-submit OTP when all filled ────────────────────────────────────
  useEffect(() => {
    if (step === 2 && digits.every((d) => d !== "") && !autoSubmitLock.current) {
      autoSubmitLock.current = true;
      verifyCode(digits.join(""));
    }
  }, [digits, step]);

  // ── Step 1: Send Code ───────────────────────────────────────────────────
  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setStep1Loading(true);
    try {
      await api.sendPasswordResetCode(trimmed);
      setResendCount(0);
      startTimers();
      setStep(2);
    } catch {
      Alert.alert("Error", "Something went wrong. Please check your connection and try again.");
    } finally {
      setStep1Loading(false);
    }
  };

  // ── Step 2: Verify Code ─────────────────────────────────────────────────
  const verifyCode = async (code: string) => {
    if (step2Loading) return;
    setStep2Loading(true);
    setCodeError(null);
    try {
      const result = await api.verifyPasswordResetCode(email.trim().toLowerCase(), code);
      if (result.resetToken) {
        setResetToken(result.resetToken);
        if (expiryTimer.current) clearInterval(expiryTimer.current);
        if (resendTimer.current) clearInterval(resendTimer.current);
        setStep(3);
      }
    } catch (err: any) {
      const errCode = err?.body?.error?.code || err?.body?.code;
      if (errCode === "TOO_MANY_ATTEMPTS") {
        setCodeError("Too many failed attempts. Please request a new code.");
      } else {
        setCodeError("Invalid code. Please try again.");
      }
      // Shake and clear
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      setDigits(Array(CODE_LENGTH).fill(""));
      autoSubmitLock.current = false;
    } finally {
      setStep2Loading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendCount >= MAX_RESENDS) return;
    const trimmed = email.trim().toLowerCase();
    try {
      await api.sendPasswordResetCode(trimmed);
      setResendCount((c) => c + 1);
      setDigits(Array(CODE_LENGTH).fill(""));
      setCodeError(null);
      autoSubmitLock.current = false;
      startTimers();
    } catch {
      Alert.alert("Error", "Failed to resend code. Please try again.");
    }
  };

  // ── Step 3: Reset Password ──────────────────────────────────────────────
  const meetsLength = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const step3Enabled = meetsLength && passwordsMatch && !step3Loading;

  const handleResetPassword = async () => {
    if (!step3Enabled) return;
    setStep3Loading(true);
    setStep3Error(null);
    const resolvedEmail = email.trim().toLowerCase();
    console.error("RESET BODY:", JSON.stringify({ resetToken: resetToken || "(EMPTY)", email: resolvedEmail || "(EMPTY)", newPassword: "***" }));
    console.error("[ForgotPw] Step3 resetToken:", resetToken ? `${resetToken.slice(0, 8)}... (len=${resetToken.length})` : "EMPTY STRING");
    console.error("[ForgotPw] Step3 email:", resolvedEmail || "EMPTY STRING");
    console.error("[ForgotPw] Step3 newPassword length:", newPassword.length);
    try {
      await api.resetPassword(resetToken, resolvedEmail, newPassword);
      setStep("success");
      successTimer.current = setTimeout(() => {
        navigation.navigate("Auth");
      }, 3000);
    } catch (err: any) {
      const errCode = err?.body?.error?.code || err?.body?.code;
      if (errCode === "INVALID_TOKEN") {
        setStep3Error("Your reset session has expired. Please start over.");
      } else if (errCode === "WEAK_PASSWORD") {
        setStep3Error("Password must be at least 8 characters.");
      } else {
        setStep3Error(err?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setStep3Loading(false);
    }
  };

  // ── Back navigation ─────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 1 || step === "success") {
      navigation.goBack();
    } else if (step === 2) {
      setDigits(Array(CODE_LENGTH).fill(""));
      setCodeError(null);
      autoSubmitLock.current = false;
      setStep(1);
    } else if (step === 3) {
      // Step 3 back → Step 1 (token is consumed, start over)
      setDigits(Array(CODE_LENGTH).fill(""));
      setCodeError(null);
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setStep3Error(null);
      autoSubmitLock.current = false;
      setStep(1);
    }
  };

  // ── Shared layout wrapper ───────────────────────────────────────────────
  const paddingTop = insets.top + 16;
  const paddingBottom = insets.bottom + 32;

  // ─────────────────────────────────────────────────────────────────────────
  // SUCCESS STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <View style={[styles.container, { paddingTop, paddingBottom }]}>
        <View style={styles.successCenter}>
          <View style={styles.successIconWrap}>
            <Feather name="check-circle" size={72} color={DS.greenAccent} />
          </View>
          <ThemedText style={styles.heading}>Password Reset!</ThemedText>
          <ThemedText style={styles.subheading}>
            Your password has been updated successfully.
          </ThemedText>
          <Pressable onPress={() => navigation.navigate("Auth")} style={styles.btnWrap}>
            <LinearGradient
              colors={[DS.greenBright, DS.greenAccent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <ThemedText style={styles.primaryBtnText}>Sign In</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEPS 1–3
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop, paddingBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={24} color={DS.cream} />
          </Pressable>

          {/* ── STEP 1: Enter Email ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <ThemedText style={styles.heading}>Reset Password</ThemedText>
              <ThemedText style={styles.subheading}>
                Enter the email address associated with your account.
              </ThemedText>

              <ThemedText style={styles.fieldLabel}>Email address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: emailError ? DS.error : emailFocused ? DS.gold : DS.cardBorder },
                ]}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (emailError) setEmailError(null);
                }}
                placeholder="your@email.com"
                placeholderTextColor="rgba(200,191,168,0.35)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                editable={!step1Loading}
              />
              {emailError ? (
                <ThemedText style={styles.errorText}>{emailError}</ThemedText>
              ) : null}

              <Pressable onPress={handleSendCode} disabled={step1Loading} style={styles.btnWrap}>
                <LinearGradient
                  colors={[DS.greenBright, DS.greenAccent]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.primaryBtn, step1Loading ? { opacity: 0.7 } : null]}
                >
                  {step1Loading ? (
                    <ActivityIndicator color={DS.cream} />
                  ) : (
                    <ThemedText style={styles.primaryBtnText}>Send Code</ThemedText>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.goBack()} style={styles.linkRow}>
                <ThemedText style={styles.linkText}>
                  Remember your password?{" "}
                  <ThemedText style={[styles.linkText, { color: DS.gold }]}>Sign in</ThemedText>
                </ThemedText>
              </Pressable>
            </>
          )}

          {/* ── STEP 2: Enter Code ──────────────────────────────────────── */}
          {step === 2 && (
            <>
              <ThemedText style={styles.heading}>Check Your Email</ThemedText>
              <ThemedText style={styles.subheading}>
                {"We sent a 6-digit code to "}
                <ThemedText style={[styles.subheading, { color: DS.cream }]}>{email.trim().toLowerCase()}</ThemedText>
              </ThemedText>

              <OTPInputRow
                value={digits}
                onChange={(d) => {
                  setDigits(d);
                  if (codeError) setCodeError(null);
                }}
                focused={otpFocused}
                onFocusChange={setOtpFocused}
                shakeAnim={shakeAnim}
                error={codeError}
                loading={step2Loading}
              />

              {step2Loading ? (
                <ActivityIndicator color={DS.greenAccent} style={{ marginTop: 20 }} />
              ) : null}

              {codeError ? (
                <ThemedText style={[styles.errorText, { textAlign: "center", marginTop: 12 }]}>
                  {codeError}
                </ThemedText>
              ) : null}

              {/* Timer */}
              <View style={styles.timerRow}>
                {expirySecondsLeft > 0 ? (
                  <ThemedText style={styles.timerText}>
                    Code expires in{" "}
                    <ThemedText style={[styles.timerText, { color: expirySecondsLeft < 60 ? DS.error : DS.cream }]}>
                      {formatTime(expirySecondsLeft)}
                    </ThemedText>
                  </ThemedText>
                ) : (
                  <ThemedText style={[styles.timerText, { color: DS.error }]}>
                    Code has expired. Please request a new one.
                  </ThemedText>
                )}
              </View>

              {/* Resend */}
              <View style={styles.resendRow}>
                {resendCount >= MAX_RESENDS ? (
                  <ThemedText style={styles.creamDim}>Maximum attempts reached. Please try again later.</ThemedText>
                ) : resendCooldown > 0 ? (
                  <ThemedText style={styles.creamDim}>
                    Didn't receive a code?{" "}
                    <ThemedText style={styles.creamDim}>Resend in {resendCooldown}s</ThemedText>
                  </ThemedText>
                ) : (
                  <Pressable onPress={handleResend}>
                    <ThemedText style={styles.creamDim}>
                      Didn't receive a code?{" "}
                      <ThemedText style={[styles.creamDim, { color: DS.gold }]}>Resend</ThemedText>
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* ── STEP 3: Set New Password ────────────────────────────────── */}
          {step === 3 && (
            <>
              <ThemedText style={styles.heading}>Create New Password</ThemedText>
              <ThemedText style={styles.subheading}>Enter your new password below.</ThemedText>

              <ThemedText style={styles.fieldLabel}>New Password</ThemedText>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { borderColor: step3Error ? DS.error : DS.cardBorder }]}
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); if (step3Error) setStep3Error(null); }}
                  placeholder="New password"
                  placeholderTextColor="rgba(200,191,168,0.35)"
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn} hitSlop={8}>
                  <Feather name={showNew ? "eye-off" : "eye"} size={20} color={DS.creamDim} />
                </Pressable>
              </View>

              <ThemedText style={styles.fieldLabel}>Confirm Password</ThemedText>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, {
                    borderColor: confirmPassword && !passwordsMatch ? DS.error : DS.cardBorder,
                  }]}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); if (step3Error) setStep3Error(null); }}
                  placeholder="Confirm password"
                  placeholderTextColor="rgba(200,191,168,0.35)"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn} hitSlop={8}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={20} color={DS.creamDim} />
                </Pressable>
              </View>

              {/* Requirements */}
              <View style={styles.requirementsWrap}>
                <Feather
                  name={meetsLength ? "check-circle" : "circle"}
                  size={14}
                  color={meetsLength ? DS.greenAccent : DS.creamDim}
                />
                <ThemedText style={[styles.requirementText, meetsLength ? { color: DS.greenAccent } : null]}>
                  {" "}At least 8 characters
                </ThemedText>
              </View>

              {step3Error ? (
                <ThemedText style={[styles.errorText, { marginBottom: 12 }]}>{step3Error}</ThemedText>
              ) : null}

              {/* "Start Over" for expired token */}
              {step3Error && step3Error.includes("expired") ? (
                <Pressable onPress={() => {
                  setStep(1);
                  setDigits(Array(CODE_LENGTH).fill(""));
                  setResetToken("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setStep3Error(null);
                  autoSubmitLock.current = false;
                }}>
                  <ThemedText style={[styles.linkText, { color: DS.gold, textAlign: "center", marginBottom: 16 }]}>
                    Start Over
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleResetPassword}
                disabled={!step3Enabled}
                style={styles.btnWrap}
              >
                <LinearGradient
                  colors={[DS.greenBright, DS.greenAccent]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.primaryBtn, !step3Enabled ? { opacity: 0.45 } : null]}
                >
                  {step3Loading ? (
                    <ActivityIndicator color={DS.cream} />
                  ) : (
                    <ThemedText style={styles.primaryBtnText}>Reset Password</ThemedText>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
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
    flexGrow: 1,
  },
  backBtn: {
    marginBottom: 32,
    alignSelf: "flex-start",
  },
  heading: {
  fontSize: 28,
  lineHeight: 36,
  fontWeight: "700",
  color: DS.cream,
  marginBottom: 10,
  letterSpacing: 0.1,
},
  subheading: {
    fontSize: 15,
    color: DS.creamDim,
    marginBottom: 36,
    lineHeight: 22,
  },
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
  passwordWrap: {
    position: "relative",
    marginBottom: 20,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 52,
  },
  eyeBtn: {
    position: "absolute",
    right: 16,
    top: 18,
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
  btnWrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: DS.error,
    marginTop: -12,
    marginBottom: 16,
  },
  linkRow: {
    marginTop: 28,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: DS.creamDim,
    textAlign: "center",
  },
  // OTP
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 60,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: DS.surface,
    borderColor: DS.cardBorder,
    color: DS.cream,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  otpBoxFocused: {
    borderColor: DS.gold,
  },
  otpBoxError: {
    borderColor: DS.error,
  },
  // Timer & resend
  timerRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  timerText: {
    fontSize: 13,
    color: DS.creamDim,
  },
  resendRow: {
    alignItems: "center",
    marginBottom: 8,
  },
  creamDim: {
    fontSize: 13,
    color: DS.creamDim,
  },
  // Requirements
  requirementsWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 2,
  },
  requirementText: {
    fontSize: 13,
    color: DS.creamDim,
  },
  // Success
  successCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIconWrap: {
    marginBottom: 28,
  },
});

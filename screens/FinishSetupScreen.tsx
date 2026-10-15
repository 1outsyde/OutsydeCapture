// FinishSetupScreen — what this account still needs: plan, payouts, username (businesses,
// photographers, staff and consumers). Same list as goutsyde.com/finish and the reminder emails:
// GET /api/account-setup/status (backend #289).
//
// Opened right after sign-in when something is left (AuthScreen, ClaimAccountScreen), from the home
// card (FinishSetupCard), from a reminder push (data.type "account_setup") and from goutsyde.com/finish
// links. Every action reuses an existing flow:
//   plan     → SubscriptionPlan screen
//   payouts  → business: api.startVendorStripeOnboarding · photographer: api.startPhotographerStripeOnboarding
//              (both return through outsyde://stripe-return, handled in MainTabNavigator) · staff: StaffOnboarding
//   username → POST /api/account-setup/username

import React, { useCallback, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/types";
import {
  api,
  type AccountSetupStatus,
  type AccountSetupStepKey,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  USERNAME_RE,
  apiErrorCode,
  apiErrorMessage,
  cleanUsernameInput,
} from "@/utils/accountSetup";

const DS = {
  bg: "#080C08",
  surface: "#141414",
  card: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  greenDeep: "#1A4A1A",
  greenBright: "#2D7A2D",
  greenAccent: "#3A9E3A",
  gold: "#C9933A",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
  error: "#E74C3C",
};

const STRIPE_RETURN_URL = "outsyde://stripe-return";

const DONE_LABEL: Record<AccountSetupStepKey, string> = {
  password: "Password set",
  username: "Username picked",
  approval: "Business approved",
  plan: "Plan chosen",
  payouts: "Payouts connected",
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Check = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export default function FinishSetupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getToken, user } = useAuth();

  const [status, setStatus] = useState<AccountSetupStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [remoteCheck, setRemoteCheck] = useState<{
    name: string;
    state: "available" | "taken" | "error";
  } | null>(null);

  const load = useCallback(async (): Promise<AccountSetupStatus | null> => {
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) {
        navigation.navigate("Auth", {});
        return null;
      }
      const s = await api.getAccountSetupStatus(token);
      setStatus(s);
      return s;
    } catch (e) {
      setLoadError(
        apiErrorMessage(e, "Couldn’t load your setup steps. Please try again."),
      );
      return null;
    }
  }, [getToken, navigation]);

  // Refresh whenever the screen comes back into view (e.g. after Stripe or the plan screen).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live username availability (debounced). idle / invalid / checking are derived.
  const trimmed = username.trim();
  const usernameValid = USERNAME_RE.test(trimmed);
  const usernameCheck: Check = !trimmed
    ? "idle"
    : !usernameValid
      ? "invalid"
      : remoteCheck?.name === trimmed
        ? remoteCheck.state
        : "checking";

  React.useEffect(() => {
    if (!usernameValid) return;
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
  }, [trimmed, usernameValid]);

  async function startPayouts() {
    if (!status) return;
    setActionError(null);
    if (status.role === "staff") {
      navigation.navigate("StaffOnboarding");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again and retry.");
      const { url } =
        status.role === "photographer"
          ? await api.startPhotographerStripeOnboarding(
              token,
              STRIPE_RETURN_URL,
            )
          : await api.startVendorStripeOnboarding(token, STRIPE_RETURN_URL);
      if (!url) throw new Error("Stripe did not return a setup link.");
      await Linking.openURL(url);
    } catch (e) {
      setActionError(
        apiErrorMessage(e, "Couldn’t start Stripe. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkAgain() {
    setActionError(null);
    setChecking(true);
    const s = await load();
    setChecking(false);
    if (s) {
      const payouts = s.steps.find((x) => x.key === "payouts");
      setNotice(
        payouts?.state === "done"
          ? "Payouts connected. Nice work."
          : "Stripe hasn’t confirmed your payouts yet. Finish the Stripe steps, then check again.",
      );
    }
  }

  async function saveUsername() {
    setActionError(null);
    if (!usernameValid) {
      setActionError("Use 3–20 lowercase letters, numbers or underscores.");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again and retry.");
      await api.setAccountSetupUsername(token, trimmed);
      setUsername("");
      await load();
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === "USERNAME_TAKEN")
        setRemoteCheck({ name: trimmed, state: "taken" });
      if (code === "ALREADY_SET") {
        await load();
        return;
      }
      setActionError(apiErrorMessage(e, "Couldn’t save your username."));
    } finally {
      setBusy(false);
    }
  }

  const steps = status?.steps ?? [];
  const doneCount = steps.filter((s) => s.state === "done").length;
  const todoCount = steps.filter((s) => s.state === "todo").length;
  const waitingOnly = !!status && todoCount === 0 && !status.complete;
  const name = user?.businessName || user?.displayName || user?.firstName;
  const heading = status?.complete
    ? "You’re all set"
    : waitingOnly
      ? "Almost there"
      : todoCount === 1
        ? "One step left"
        : todoCount > 1
          ? `${todoCount} steps left`
          : "Finish your setup";

  const Primary = ({
    label,
    onPress,
    disabled,
    icon,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    icon?: keyof typeof Feather.glyphMap;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[(busy || disabled) && { opacity: 0.55 }]}
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
          <ActivityIndicator color={DS.cream} />
        ) : (
          <View style={styles.btnRow}>
            {icon ? <Feather name={icon} size={16} color={DS.cream} /> : null}
            <ThemedText style={styles.primaryBtnText}>{label}</ThemedText>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );

  const Secondary = ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[styles.secondaryBtn, (busy || disabled) && { opacity: 0.55 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <ThemedText style={styles.secondaryBtnText}>{label}</ThemedText>
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
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={24} color={DS.cream} />
          </Pressable>

          <ThemedText style={styles.eyebrow}>
            {status?.complete ? "SETUP COMPLETE" : "FINISH YOUR SETUP"}
          </ThemedText>
          <ThemedText style={styles.heading}>
            {heading}
            {name ? (
              <ThemedText
                style={[styles.heading, { color: DS.gold }]}
              >{`, ${name}`}</ThemedText>
            ) : null}
          </ThemedText>

          {status && !status.complete && (
            <View
              style={styles.progressRow}
              accessibilityLabel={`${doneCount} of ${steps.length} steps done`}
            >
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={styles.progressText}>
                {doneCount} of {steps.length}
              </ThemedText>
            </View>
          )}

          {notice && (
            <View style={styles.notice}>
              <ThemedText style={styles.noticeText}>{notice}</ThemedText>
            </View>
          )}

          {!status && !loadError && (
            <ActivityIndicator color={DS.gold} style={{ marginTop: 32 }} />
          )}
          {loadError && (
            <View style={styles.card}>
              <ThemedText style={styles.errorText}>{loadError}</ThemedText>
              <Primary label="Try again" onPress={() => void load()} />
            </View>
          )}

          {status?.complete && (
            <View style={styles.card}>
              <ThemedText style={styles.bodyText}>
                Everything’s done. Thanks for finishing your account.
              </ThemedText>
              <Primary label="Done" onPress={() => navigation.goBack()} />
            </View>
          )}

          {status &&
            !status.complete &&
            steps.map((s, i) => {
              const isNext = s.key === status.next;
              if (s.state === "done") {
                return (
                  <View key={s.key} style={styles.row}>
                    <View style={[styles.dot, styles.dotDone]}>
                      <Feather name="check" size={14} color={DS.gold} />
                    </View>
                    <ThemedText style={styles.rowLabel}>
                      {DONE_LABEL[s.key]}
                    </ThemedText>
                    {s.key === "plan" && (
                      <Pressable
                        onPress={() => navigation.navigate("SubscriptionPlan")}
                        hitSlop={10}
                        accessibilityRole="button"
                      >
                        <ThemedText style={styles.mini}>Change</ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              }
              if (s.state === "waiting") {
                return (
                  <View key={s.key} style={styles.row}>
                    <View style={[styles.dot, styles.dotWaiting]}>
                      <Feather name="clock" size={13} color={DS.creamDim} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.rowLabel}>
                        Business approval
                      </ThemedText>
                      <ThemedText style={styles.small}>
                        We’re reviewing your business and will email you when
                        it’s approved.
                      </ThemedText>
                    </View>
                  </View>
                );
              }
              return (
                <View
                  key={s.key}
                  style={[styles.todo, isNext && styles.todoNext]}
                >
                  <View style={styles.todoHead}>
                    <View
                      style={[
                        styles.dot,
                        isNext ? styles.dotNext : styles.dotTodo,
                      ]}
                    >
                      <ThemedText
                        style={[styles.dotNum, isNext && { color: "#000" }]}
                      >
                        {i + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.todoLabel}>{s.label}</ThemedText>
                  </View>

                  {s.key === "plan" && (
                    <>
                      <ThemedText style={styles.bodyText}>
                        Pick the plan that fits. Customers can book and buy from
                        you once it’s active. You can switch any time.
                      </ThemedText>
                      {isNext ? (
                        <Primary
                          label="Choose your plan"
                          onPress={() =>
                            navigation.navigate("SubscriptionPlan")
                          }
                        />
                      ) : (
                        <Secondary
                          label="Choose your plan"
                          onPress={() =>
                            navigation.navigate("SubscriptionPlan")
                          }
                        />
                      )}
                    </>
                  )}

                  {s.key === "payouts" && (
                    <>
                      <ThemedText style={styles.bodyText}>
                        Stripe is the secure service that sends your booking
                        money to your bank. You’ll leave Outsyde for a few
                        minutes, then come right back.
                      </ThemedText>
                      {isNext && (
                        <View style={styles.ready}>
                          <ThemedText style={styles.kicker}>
                            HAVE THESE READY
                          </ThemedText>
                          <ThemedText style={styles.bullet}>
                            • Your legal name and date of birth
                          </ThemedText>
                          <ThemedText style={styles.bullet}>
                            • Your bank account and routing number
                          </ThemedText>
                          <ThemedText style={styles.bullet}>
                            • Last 4 digits of your SSN (or your EIN)
                          </ThemedText>
                        </View>
                      )}
                      {isNext ? (
                        <Primary
                          label="Continue to Stripe"
                          icon="external-link"
                          onPress={() => void startPayouts()}
                        />
                      ) : (
                        <Secondary
                          label="Continue to Stripe"
                          onPress={() => void startPayouts()}
                        />
                      )}
                      <Pressable
                        onPress={() => void checkAgain()}
                        disabled={checking}
                        style={styles.linkBtn}
                        accessibilityRole="button"
                      >
                        <ThemedText style={styles.link}>
                          {checking
                            ? "Checking…"
                            : "I already finished on Stripe — check again"}
                        </ThemedText>
                      </Pressable>
                    </>
                  )}

                  {s.key === "username" && (
                    <>
                      <ThemedText style={styles.bodyText}>
                        It’s how people find you in search, and you can sign in
                        with it too.
                      </ThemedText>
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
                          onChangeText={(t) =>
                            setUsername(cleanUsernameInput(t))
                          }
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
                          styles.small,
                          usernameCheck === "available" && {
                            color: DS.greenAccent,
                          },
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
                                  ? "Couldn’t check right now — you can still save"
                                  : " "}
                      </ThemedText>
                      {isNext ? (
                        <Primary
                          label="Save username"
                          onPress={() => void saveUsername()}
                          disabled={
                            !trimmed ||
                            usernameCheck === "taken" ||
                            usernameCheck === "invalid"
                          }
                        />
                      ) : (
                        <Secondary
                          label="Save username"
                          onPress={() => void saveUsername()}
                          disabled={
                            !trimmed ||
                            usernameCheck === "taken" ||
                            usernameCheck === "invalid"
                          }
                        />
                      )}
                    </>
                  )}

                  {s.key === "password" && (
                    <>
                      <ThemedText style={styles.bodyText}>
                        Set a password so you can sign in on the app and the
                        website.
                      </ThemedText>
                      <Primary
                        label="Set a password"
                        onPress={() => navigation.navigate("ForgotPassword")}
                      />
                    </>
                  )}
                </View>
              );
            })}

          {actionError && (
            <ThemedText style={[styles.errorText, { marginTop: 12 }]}>
              {actionError}
            </ThemedText>
          )}

          <Pressable
            onPress={() => void Linking.openURL("mailto:info@goutsyde.com")}
            style={styles.help}
            accessibilityRole="link"
          >
            <ThemedText style={styles.small}>
              Need help?{" "}
              <ThemedText style={[styles.small, { color: DS.gold }]}>
                info@goutsyde.com
              </ThemedText>
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.bg },
  scroll: { paddingHorizontal: 20 },
  backBtn: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    color: DS.gold,
    marginBottom: 8,
    fontWeight: "600",
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: DS.cream,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(240,234,214,0.14)",
    overflow: "hidden",
  },
  fill: { height: 6, backgroundColor: DS.gold },
  progressText: { fontSize: 12, color: DS.creamDim },
  notice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: DS.greenDeep,
    borderWidth: 1,
    borderColor: "rgba(58,158,58,0.4)",
    marginBottom: 14,
  },
  noticeText: { fontSize: 13, color: DS.cream, lineHeight: 19 },
  card: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.cardBorder,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.cardBorder,
    marginBottom: 10,
    minHeight: 52,
  },
  rowLabel: { flex: 1, fontSize: 14, color: DS.creamDim },
  todo: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.cardBorder,
    marginBottom: 10,
    gap: 12,
  },
  todoNext: { borderColor: DS.gold, backgroundColor: "rgba(255,255,255,0.06)" },
  todoHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  todoLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: DS.cream },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: DS.greenDeep },
  dotWaiting: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: DS.creamDim,
  },
  dotTodo: { borderWidth: 1.5, borderColor: DS.gold },
  dotNext: { backgroundColor: DS.gold },
  dotNum: { fontSize: 12, fontWeight: "700", color: DS.gold },
  mini: { fontSize: 13, color: DS.gold, paddingVertical: 8 },
  bodyText: { fontSize: 14, lineHeight: 20, color: "rgba(240,234,214,0.8)" },
  ready: { gap: 4 },
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    color: DS.creamDim,
    marginBottom: 2,
  },
  bullet: { fontSize: 13, color: "rgba(240,234,214,0.85)" },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: DS.cream },
  secondaryBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(240,234,214,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: DS.cream },
  linkBtn: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: {
    fontSize: 13,
    color: "rgba(240,234,214,0.8)",
    textDecorationLine: "underline",
  },
  unWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: DS.surface,
  },
  at: { fontSize: 16, color: DS.creamDim },
  unInput: {
    flex: 1,
    fontSize: 16,
    color: DS.cream,
    paddingHorizontal: 4,
    height: 52,
  },
  small: { fontSize: 12, color: DS.creamDim, lineHeight: 18 },
  errorText: { fontSize: 13, color: DS.error, lineHeight: 19 },
  help: {
    marginTop: 24,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
});

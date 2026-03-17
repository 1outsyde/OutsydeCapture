import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  FlatList,
  ScrollView,
  Animated,
  Text,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";

import { RootStackParamList } from "@/navigation/types";
import { UserRole, GoogleAuthUserData, useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api";

WebBrowser.maybeCompleteAuthSession();

const BACKEND_GOOGLE_PREFLIGHT = `${API_BASE_URL}/api/auth/mobile/google/preflight`;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────────────────────────
const OB = {
  bg:          "#080C08",
  greenDeep:   "#0D2B0D",
  greenMid:    "#1A4A1A",
  greenBright: "#2D7A2D",
  greenAccent: "#3A9E3A",
  gold:        "#C9933A",
  goldLight:   "#E8B86D",
  cream:       "#F0EAD6",
  creamDim:    "#C8BFA8",
};

// ─── Async Storage Keys ───────────────────────────────────────────────────────
export const ONBOARDING_COMPLETE_KEY = "@outsyde_onboarding_complete";
export const ONBOARDING_USER_TYPE_KEY = "@outsyde_user_type";
export const ONBOARDING_CITY_KEY = "@outsyde_onboarding_city";
export const ONBOARDING_STATE_KEY = "@outsyde_onboarding_state";

// ─── March 2026 static calendar data ─────────────────────────────────────────
const CAL_WEEKS = [
  [null, null, null, null, null, null,   1],
  [2,    3,    4,    5,    6,    7,    8],
  [9,   10,   11,   12,   13,   14,   15],
  [16,  17,   18,   19,   20,   21,   22],
  [23,  24,   25,   26,   27,   28,   29],
  [30,  31, null, null, null, null, null],
];
const CAL_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const CAL_BOOKED = new Set([3, 7, 11, 15, 18, 26]);
const CAL_SELECTED = 17;

// ─── Role Options ─────────────────────────────────────────────────────────────
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
    accent: OB.greenAccent,
  },
  {
    role: "business",
    icon: "briefcase",
    label: "Business",
    description: "Sell products & services to your community",
    accent: OB.gold,
  },
  {
    role: "photographer",
    icon: "camera",
    label: "Photographer",
    description: "Offer photography & creative services",
    accent: OB.creamDim,
  },
];

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { loginWithTokens, isAuthenticated } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Pulse animation for Screen 1
  const pulseScale1 = useRef(new Animated.Value(1)).current;
  const pulseScale2 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0.6)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0.4)).current;

  // Float animations for Screen 2 pills
  const pillAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Pulsing rings on Screen 1
    const ring1 = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale1, { toValue: 1.22, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseOpacity1, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale1, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity1, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    const ring2 = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(pulseScale2, { toValue: 1.22, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseOpacity2, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale2, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity2, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    ring1.start();
    ring2.start();

    // Floating pills on Screen 2
    const pillLoops = pillAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 350),
          Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ])
      )
    );
    pillLoops.forEach((l) => l.start());

    return () => {
      ring1.stop();
      ring2.stop();
      pillLoops.forEach((l) => l.stop());
    };
  }, []);

  // Location permission + city detection when slide 2 (Discover) mounts
  useEffect(() => {
    if (currentIndex !== 1) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (cancelled || !geo?.city) return;
        const city = geo.city;
        const region = geo.region ?? "";
        setDetectedCity(city);
        await AsyncStorage.setItem(ONBOARDING_CITY_KEY, city);
        await AsyncStorage.setItem(ONBOARDING_STATE_KEY, region);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [currentIndex]);

  // Auto-complete onboarding and navigate to Main when user becomes authenticated
  // (fires after Google/Apple/Email sign-in from Slide 4)
  useEffect(() => {
    if (isAuthenticated) {
      AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true").finally(() => {
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
      });
    }
  }, [isAuthenticated]);

  // Deep link listener — backup for Google OAuth redirect when WebBrowser doesn't intercept
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.startsWith("outsyde://auth/success")) {
        setIsGoogleLoading(true);
        try {
          const urlParams = new URL(event.url.replace("outsyde://", "https://outsyde.app/"));
          const accessToken = urlParams.searchParams.get("accessToken");
          const refreshToken = urlParams.searchParams.get("refreshToken");
          const userId = urlParams.searchParams.get("userId");
          const email = urlParams.searchParams.get("email");

          if (!accessToken || !refreshToken || !userId || !email) {
            Alert.alert("Error", "Authentication failed. Missing required data.");
            setIsGoogleLoading(false);
            return;
          }

          const isNewUser = urlParams.searchParams.get("isNewUser") === "true";

          if (isNewUser) {
            const prefillName = (urlParams.searchParams.get("name") ||
              `${urlParams.searchParams.get("firstName") || ""} ${urlParams.searchParams.get("lastName") || ""}`.trim()) || undefined;
            await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
            navigation.reset({
              index: 1,
              routes: [
                { name: "Main" },
                { name: "ConsumerSignup", params: { prefillName, prefillEmail: email, socialProvider: "google" } },
              ],
            });
          } else {
            const userData: GoogleAuthUserData = {
              userId,
              email,
              firstName: urlParams.searchParams.get("firstName") || undefined,
              lastName: urlParams.searchParams.get("lastName") || undefined,
              name: urlParams.searchParams.get("name") || undefined,
              profileImageUrl: urlParams.searchParams.get("profileImageUrl") || undefined,
              isVendor: urlParams.searchParams.get("isVendor") === "true",
              isPhotographer: urlParams.searchParams.get("isPhotographer") === "true",
              isAdmin: urlParams.searchParams.get("isAdmin") === "true",
              businessId: urlParams.searchParams.get("businessId") || undefined,
              photographerId: urlParams.searchParams.get("photographerId") || undefined,
            };
            await loginWithTokens(accessToken, refreshToken, userData);
            // isAuthenticated useEffect will handle navigation
          }
        } catch {
          Alert.alert("Error", "Failed to complete sign-in. Please try again.");
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (event.url.startsWith("outsyde://auth/error")) {
        const urlParams = new URL(event.url.replace("outsyde://", "https://outsyde.app/"));
        Alert.alert("Sign-In Error", urlParams.searchParams.get("error") || "Google sign-in failed");
        setIsGoogleLoading(false);
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    return () => subscription.remove();
  }, [loginWithTokens, navigation]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const preflightRes = await fetch(BACKEND_GOOGLE_PREFLIGHT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!preflightRes.ok) throw new Error("Failed to initialize Google Sign-In");

      const { authUrl } = await preflightRes.json();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, "outsyde://auth");

      if (result.type === "success" && result.url) {
        if (result.url.startsWith("outsyde://auth/success")) {
          const urlParams = new URL(result.url.replace("outsyde://", "https://outsyde.app/"));
          const accessToken = urlParams.searchParams.get("accessToken");
          const refreshToken = urlParams.searchParams.get("refreshToken");
          const userId = urlParams.searchParams.get("userId");
          const email = urlParams.searchParams.get("email");

          if (!accessToken || !refreshToken || !userId || !email) {
            Alert.alert("Error", "Authentication failed. Missing required data.");
            setIsGoogleLoading(false);
            return;
          }

          const isNewUser = urlParams.searchParams.get("isNewUser") === "true";

          if (isNewUser) {
            const prefillName = (urlParams.searchParams.get("name") ||
              `${urlParams.searchParams.get("firstName") || ""} ${urlParams.searchParams.get("lastName") || ""}`.trim()) || undefined;
            await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
            navigation.reset({
              index: 1,
              routes: [
                { name: "Main" },
                { name: "ConsumerSignup", params: { prefillName, prefillEmail: email, socialProvider: "google" } },
              ],
            });
          } else {
            const userData: GoogleAuthUserData = {
              userId,
              email,
              firstName: urlParams.searchParams.get("firstName") || undefined,
              lastName: urlParams.searchParams.get("lastName") || undefined,
              name: urlParams.searchParams.get("name") || undefined,
              profileImageUrl: urlParams.searchParams.get("profileImageUrl") || undefined,
              isVendor: urlParams.searchParams.get("isVendor") === "true",
              isPhotographer: urlParams.searchParams.get("isPhotographer") === "true",
              isAdmin: urlParams.searchParams.get("isAdmin") === "true",
              businessId: urlParams.searchParams.get("businessId") || undefined,
              photographerId: urlParams.searchParams.get("photographerId") || undefined,
            };
            const sessionResult = await loginWithTokens(accessToken, refreshToken, userData);
            if (sessionResult.success) {
              if (sessionResult.isPending) {
                Alert.alert("Pending Approval", "Your business application is under review. We'll notify you when it's approved.");
              }
              // isAuthenticated useEffect handles navigation to Main
            } else if (sessionResult.isRejected) {
              Alert.alert("Account Rejected", "Your business application was not approved. Please contact support.");
            } else {
              Alert.alert("Error", "Failed to complete sign-in. Please try again.");
            }
          }
        } else if (result.url.startsWith("outsyde://auth/error")) {
          const urlParams = new URL(result.url.replace("outsyde://", "https://outsyde.app/"));
          Alert.alert("Sign-In Error", urlParams.searchParams.get("error") || "Google sign-in failed");
        }
      } else if (result.type !== "cancel" && result.type !== "dismiss") {
        // handled by deep link listener
      }
    } catch {
      Alert.alert("Error", "Failed to start Google Sign-In. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert("Apple Sign In", "Apple Sign In is only available on iOS devices.");
      return;
    }
    setIsAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Apple provides email and fullName only on the FIRST authorization
      if (credential.email) {
        // New Apple user — route to ConsumerSignup with pre-filled data
        const givenName = credential.fullName?.givenName || "";
        const familyName = credential.fullName?.familyName || "";
        const prefillName = `${givenName} ${familyName}`.trim() || undefined;
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
        navigation.reset({
          index: 1,
          routes: [
            { name: "Main" },
            { name: "ConsumerSignup", params: { prefillName, prefillEmail: credential.email, socialProvider: "apple" } },
          ],
        });
      } else {
        // Returning Apple user — no email returned by Apple; direct to email sign-in
        // TODO: Backend needs /api/auth/mobile/apple endpoint for returning users
        Alert.alert(
          "Sign In",
          "To sign into your existing Outsyde account, please use your email and password.",
          [
            { text: "Sign In with Email", onPress: () => navigation.navigate("Auth", {}) },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Error", "Apple sign-in failed. Please try again.");
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  const isLastSlide = currentIndex === 3;
  const handleNext = () => {
    const next = currentIndex + 1;
    flatListRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
    setCurrentIndex(next);
  };

  const handleSkip = () => {
    flatListRef.current?.scrollToOffset({ offset: 3 * SCREEN_WIDTH, animated: true });
    setCurrentIndex(3);
  };

  const completeOnboarding = async (role: UserRole) => {
    try {
      await AsyncStorage.multiSet([
        [ONBOARDING_COMPLETE_KEY, "true"],
        [ONBOARDING_USER_TYPE_KEY, role],
      ]);
    } catch (err) {
      console.error("[Onboarding] Failed to save onboarding state:", err);
    }

    const signupScreen =
      role === "business"
        ? "BusinessSignup"
        : role === "photographer"
        ? "PhotographerSignup"
        : "ConsumerSignup";

    navigation.reset({
      index: 1,
      routes: [{ name: "Main" }, { name: signupScreen }],
    });
  };

  const handleRoleSelect = async (role: UserRole) => {
    await completeOnboarding(role);
  };

  // ─── Slide Renders ──────────────────────────────────────────────────────────

  const renderSlide1 = () => {
    const iconSize = 96;
    const ringSize = iconSize + 48;
    return (
      <View style={styles.slide}>
        {/* Pulsing icon */}
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 36 }}>
          <Animated.View
            style={{
              position: "absolute",
              width: ringSize + 40,
              height: ringSize + 40,
              borderRadius: (ringSize + 40) / 2,
              borderWidth: 1.5,
              borderColor: OB.gold,
              opacity: pulseOpacity1,
              transform: [{ scale: pulseScale1 }],
            }}
          />
          <Animated.View
            style={{
              position: "absolute",
              width: ringSize + 16,
              height: ringSize + 16,
              borderRadius: (ringSize + 16) / 2,
              borderWidth: 1,
              borderColor: OB.gold,
              opacity: pulseOpacity2,
              transform: [{ scale: pulseScale2 }],
            }}
          />
          <View
            style={{
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: 2,
              borderColor: OB.gold,
              backgroundColor: OB.greenDeep,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="camera" size={40} color={OB.gold} />
          </View>
        </View>

        {/* "Now Live in Your City" pill */}
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>NOW LIVE IN YOUR CITY</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>
          <Text style={{ color: OB.cream }}>Go Outside.{"\n"}</Text>
          <Text style={{ color: OB.gold }}>Find{"\n"}</Text>
          <Text style={{ color: OB.cream }}>Your Crew.</Text>
        </Text>

        {/* Subtext */}
        <Text style={styles.subtext}>
          Photographers, vendors & creatives — all in one place, right in your neighborhood.
        </Text>
      </View>
    );
  };

  const PILLS = [
    { label: "Photographers", color: OB.greenAccent },
    { label: "Food Vendors", color: OB.gold },
    { label: "Cinematographers", color: OB.creamDim },
    { label: "Fashion Stores", color: OB.greenMid },
  ];

  const PILL_OFFSETS: { left: number; marginLeft: number }[] = [
    { left: 24, marginLeft: 0 },
    { left: SCREEN_WIDTH / 2 - 60, marginLeft: 0 },
    { left: 8, marginLeft: 0 },
    { left: SCREEN_WIDTH / 2 - 40, marginLeft: 0 },
  ];

  const renderSlide2 = () => (
    <View style={styles.slide}>
      {/* Floating pills */}
      <View style={{ width: SCREEN_WIDTH, height: 200, position: "relative" }}>
        {PILLS.map((pill, i) => {
          const translateY = pillAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, -10],
          });
          const top = [20, 70, 130, 80][i];
          const left = PILL_OFFSETS[i].left;
          return (
            <Animated.View
              key={pill.label}
              style={{
                position: "absolute",
                top,
                left,
                transform: [{ translateY }],
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: OB.greenDeep,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: pill.color + "60",
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: pill.color,
                  marginRight: 8,
                }}
              />
              <Text style={{ color: OB.cream, fontSize: 14, fontWeight: "500" }}>
                {pill.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Eyebrow label */}
      <Text style={[styles.eyebrow, { marginBottom: 8 }]}>COMMUNITY DISCOVERY</Text>

      {/* Headline */}
      <Text style={styles.headline}>
        <Text style={{ color: OB.cream }}>Your City's{"\n"}</Text>
        <Text style={{ color: OB.gold }}>Best{"\n"}</Text>
        <Text style={{ color: OB.cream }}>Talent,{"\n"}Right Here.</Text>
      </Text>

      {/* Subtext */}
      <Text style={styles.subtext}>
        Browse creatives in your area. Filter by city, vibe, and category to find exactly who you need.
      </Text>

      {/* Fake search bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={OB.creamDim} style={{ marginRight: 8 }} />
        <Text style={[styles.searchPlaceholder, { flex: 1 }]}>
          {detectedCity ? `Photographers near ${detectedCity}...` : "Photographers near Atlanta..."}
        </Text>
        <View style={styles.nearMeBadge}>
          <Text style={styles.nearMeText}>Near Me</Text>
        </View>
      </View>
    </View>
  );

  const renderSlide3 = () => (
    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Mini Calendar */}
        <View style={styles.calendarCard}>
          {/* Calendar header */}
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>March 2026</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable style={styles.calNavBtn}>
                <Feather name="chevron-left" size={14} color={OB.creamDim} />
              </Pressable>
              <Pressable style={styles.calNavBtn}>
                <Feather name="chevron-right" size={14} color={OB.creamDim} />
              </Pressable>
            </View>
          </View>
          {/* Day labels */}
          <View style={styles.calRow}>
            {CAL_DAYS.map((d) => (
              <View key={d} style={styles.calCell}>
                <Text style={styles.calDayLabel}>{d}</Text>
              </View>
            ))}
          </View>
          {/* Weeks */}
          {CAL_WEEKS.map((week, wi) => (
            <View key={wi} style={styles.calRow}>
              {week.map((day, di) => {
                const isBooked = day != null && CAL_BOOKED.has(day);
                const isSelected = day === CAL_SELECTED;
                return (
                  <View key={di} style={styles.calCell}>
                    {day != null ? (
                      <View
                        style={[
                          styles.calDay,
                          isSelected && { backgroundColor: OB.gold },
                          isBooked && !isSelected && { backgroundColor: OB.greenAccent },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayText,
                            (isBooked || isSelected) && { color: isSelected ? OB.bg : "#fff", fontWeight: "700" },
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.calDay} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Booking preview card */}
        <View style={styles.bookingCard}>
          <View style={styles.bookingAvatar}>
            <Text style={{ color: OB.cream, fontWeight: "700", fontSize: 14 }}>JR</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookingName}>Jordan Rivera · Photographer</Text>
            <Text style={styles.bookingMeta}>March 17 · 2:00 PM · Downtown ATL</Text>
          </View>
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedText}>Confirmed</Text>
          </View>
        </View>

        {/* Headline below */}
        <Text style={[styles.headline, { textAlign: "center", marginTop: 12 }]}>
          <Text style={{ color: OB.cream }}>Book &{"\n"}Manage{"\n"}Everything{"\n"}</Text>
          <Text style={{ color: OB.gold }}>Here.</Text>
        </Text>
      </ScrollView>
    </View>
  );

  const renderSlide4 = () => (
    <ScrollView
      style={{ width: SCREEN_WIDTH, flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Eyebrow */}
      <Text style={[styles.eyebrow, { marginBottom: 12, color: OB.gold }]}>STEP 4 OF 4</Text>

      {/* Headline */}
      <Text style={[styles.headline, { textAlign: "center", marginBottom: 8 }]}>
        <Text style={{ color: OB.cream }}>What brings{"\n"}you to{"\n"}</Text>
        <Text style={{ color: OB.gold }}>Outsyde?</Text>
      </Text>

      {/* Subtext — updated */}
      <Text style={[styles.subtext, { marginBottom: 20 }]}>
        New to Outsyde? Choose your path to get started.
      </Text>

      {/* Role cards — tap navigates immediately, behavior unchanged */}
      <View style={{ gap: 12 }}>
        {ROLE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.role}
            onPress={() => handleRoleSelect(opt.role)}
            style={({ pressed }) => [
              styles.roleCard,
              pressed && { borderColor: opt.accent + "80", backgroundColor: opt.accent + "12" },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.roleIconWrap, { backgroundColor: opt.accent + "20" }]}>
              <Feather name={opt.icon} size={22} color={opt.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.roleLabel, { color: OB.cream }]}>{opt.label}</Text>
              <Text style={[styles.roleDesc, { color: OB.creamDim }]}>{opt.description}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={OB.greenMid} />
          </Pressable>
        ))}
      </View>

      {/* "or" divider */}
      <View style={styles.orDivider}>
        <View style={[styles.orLine, { backgroundColor: OB.greenMid }]} />
        <Text style={styles.orText}>or</Text>
        <View style={[styles.orLine, { backgroundColor: OB.greenMid }]} />
      </View>

      {/* Returning user sign-in section */}
      <Text style={styles.signInLabel}>Already have an account? Sign in</Text>

      {/* Google sign-in button */}
      <Pressable
        onPress={handleGoogleSignIn}
        disabled={isGoogleLoading}
        style={[styles.socialBtn, { backgroundColor: OB.greenDeep, borderColor: OB.greenMid, borderWidth: 1, opacity: isGoogleLoading ? 0.6 : 1 }]}
      >
        {isGoogleLoading ? (
          <ActivityIndicator size="small" color={OB.cream} />
        ) : (
          <>
            <Feather name="mail" size={20} color={OB.cream} />
            <Text style={[styles.socialBtnText, { color: OB.cream }]}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      {/* Apple sign-in button */}
      <Pressable
        onPress={handleAppleSignIn}
        disabled={isAppleLoading}
        style={[styles.socialBtn, { backgroundColor: "#000000", opacity: isAppleLoading ? 0.6 : 1 }]}
      >
        {isAppleLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Feather name="smartphone" size={20} color="#FFFFFF" />
            <Text style={[styles.socialBtnText, { color: "#FFFFFF" }]}>Continue with Apple</Text>
          </>
        )}
      </Pressable>

      {/* Email sign-in button */}
      <Pressable
        onPress={() => navigation.navigate("Auth", {})}
        style={[styles.socialBtn, { backgroundColor: OB.greenDeep, borderColor: OB.greenMid, borderWidth: 1 }]}
      >
        <Feather name="lock" size={20} color={OB.cream} />
        <Text style={[styles.socialBtnText, { color: OB.cream }]}>Sign in with Email</Text>
      </Pressable>
    </ScrollView>
  );

  const SLIDES = [0, 1, 2, 3];

  const renderSlide = ({ item }: { item: number }) => {
    switch (item) {
      case 0: return renderSlide1();
      case 1: return renderSlide2();
      case 2: return renderSlide3();
      case 3: return renderSlide4();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: OB.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={OB.bg} />

      {/* Skip button — visible only on slides 2 & 3 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {currentIndex > 0 && currentIndex < 3 ? (
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => String(item)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({
            offset: info.index * SCREEN_WIDTH,
            animated: true,
          });
        }}
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* Dot indicators */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index
                  ? { backgroundColor: OB.gold, width: 24, borderRadius: 4 }
                  : { backgroundColor: OB.greenMid, width: 6 },
              ]}
            />
          ))}
        </View>

        {/* CTA Button — hidden on slide 4 (role picker navigates directly) */}
        {currentIndex < 3 ? (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={[OB.greenBright, OB.greenAccent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={[styles.ctaText, { color: OB.cream }]}>
                {currentIndex === 0 ? "Get Started — It's Free  →" : "Next  →"}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Exported Helpers (used by RootNavigator) ─────────────────────────────────

export async function checkOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function getSavedUserType(): Promise<UserRole | null> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_USER_TYPE_KEY);
    if (value === "consumer" || value === "business" || value === "photographer") {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ONBOARDING_COMPLETE_KEY, ONBOARDING_USER_TYPE_KEY]);
  } catch {}
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    color: "#C8BFA8",
    fontSize: 16,
    fontWeight: "400",
  },

  // ── Slides ──────────────────────────────────────────────────────────────────
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  // ── Slide 1 ─────────────────────────────────────────────────────────────────
  livePill: {
    borderWidth: 1,
    borderColor: "#C9933A80",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  livePillText: {
    color: "#C9933A",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  // ── Shared text styles ───────────────────────────────────────────────────────
  headline: {
    fontSize: 42,
    fontWeight: "800",
    lineHeight: 50,
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#C8BFA8",
    textAlign: "center",
  },
  subtext: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
    color: "#C8BFA8",
    textAlign: "center",
    marginBottom: 24,
  },

  // ── Slide 2 ─────────────────────────────────────────────────────────────────
  searchBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A4A1A40",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1A4A1A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  searchPlaceholder: {
    color: "#C8BFA890",
    fontSize: 14,
  },
  nearMeBadge: {
    backgroundColor: "#C9933A25",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C9933A50",
  },
  nearMeText: {
    color: "#C9933A",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Slide 3 — Calendar ───────────────────────────────────────────────────────
  calendarCard: {
    width: "100%",
    backgroundColor: "#0D2B0D80",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1A4A1A",
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  calendarMonth: {
    color: "#F0EAD6",
    fontSize: 15,
    fontWeight: "700",
  },
  calNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1A4A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  calRow: {
    flexDirection: "row",
  },
  calCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1,
  },
  calDayLabel: {
    color: "#C8BFA870",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    paddingBottom: 4,
  },
  calDay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayText: {
    color: "#C8BFA8",
    fontSize: 12,
    fontWeight: "400",
  },

  // ── Slide 3 — Booking card ───────────────────────────────────────────────────
  bookingCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D2B0D80",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A4A1A",
    padding: 14,
    gap: 12,
  },
  bookingAvatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#1A4A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  bookingName: {
    color: "#F0EAD6",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  bookingMeta: {
    color: "#C8BFA8",
    fontSize: 12,
    fontWeight: "400",
  },
  confirmedBadge: {
    backgroundColor: "#2D7A2D30",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#3A9E3A60",
  },
  confirmedText: {
    color: "#3A9E3A",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Slide 4 — Role cards ─────────────────────────────────────────────────────
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A4A1A",
    backgroundColor: "#0D2B0D50",
    overflow: "hidden",
  },
  roleIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  roleDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  roleCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  ctaButton: {
    width: "100%",
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  roleCounter: {
    color: "#C8BFA870",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },

  // ── Slide 4 sign-in section ───────────────────────────────────────────────
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    color: "#C8BFA8",
    fontSize: 13,
    marginHorizontal: 12,
    fontWeight: "500",
  },
  signInLabel: {
    color: "#C8BFA8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 10,
  },
});

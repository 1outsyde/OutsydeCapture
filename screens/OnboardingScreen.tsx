import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  FlatList,
  Animated,
  Text,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "@/navigation/types";
import { UserRole } from "@/context/AuthContext";

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
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

  const isLastSlide = currentIndex === 3;
  const canProceed = !isLastSlide || selectedRoles.length > 0;

  const handleNext = async () => {
    if (!isLastSlide) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
      return;
    }
    if (selectedRoles.length === 0) return;
    const primaryRole: UserRole = selectedRoles.includes("photographer")
      ? "photographer"
      : selectedRoles.includes("business")
      ? "business"
      : "consumer";
    await completeOnboarding(primaryRole);
  };

  const handleSkip = () => {
    flatListRef.current?.scrollToIndex({ index: 3, animated: true });
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

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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
            <Feather name="star" size={40} color={OB.gold} />
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
        <Text style={[styles.searchPlaceholder, { flex: 1 }]}>Photographers near Atlanta...</Text>
        <View style={styles.nearMeBadge}>
          <Text style={styles.nearMeText}>Near Me</Text>
        </View>
      </View>
    </View>
  );

  const renderSlide3 = () => (
    <View style={[styles.slide, { justifyContent: "flex-start", paddingTop: 16 }]}>
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
      <Text style={[styles.headline, { textAlign: "center", marginTop: 20 }]}>
        <Text style={{ color: OB.cream }}>Book &{"\n"}Manage{"\n"}Everything{"\n"}</Text>
        <Text style={{ color: OB.gold }}>Here.</Text>
      </Text>
    </View>
  );

  const renderSlide4 = () => (
    <View style={[styles.slide, { justifyContent: "flex-start", paddingTop: 8 }]}>
      {/* Eyebrow */}
      <Text style={[styles.eyebrow, { marginBottom: 12, color: OB.gold }]}>STEP 4 OF 4</Text>

      {/* Headline */}
      <Text style={[styles.headline, { textAlign: "center", marginBottom: 8 }]}>
        <Text style={{ color: OB.cream }}>What brings{"\n"}you to{"\n"}</Text>
        <Text style={{ color: OB.gold }}>Outsyde?</Text>
      </Text>

      {/* Subtext */}
      <Text style={[styles.subtext, { marginBottom: 24 }]}>
        Choose your path — you can always add more roles later.
      </Text>

      {/* Role cards */}
      <View style={{ width: "100%", gap: 12 }}>
        {ROLE_OPTIONS.map((opt) => {
          const selected = selectedRoles.includes(opt.role);
          return (
            <Pressable
              key={opt.role}
              onPress={() => toggleRole(opt.role)}
              style={({ pressed }) => [
                styles.roleCard,
                selected && { borderColor: opt.accent + "80", backgroundColor: opt.accent + "12" },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {selected ? (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                    backgroundColor: opt.accent,
                  }}
                />
              ) : null}
              <View
                style={[
                  styles.roleIconWrap,
                  { backgroundColor: selected ? opt.accent + "25" : OB.greenDeep },
                ]}
              >
                <Feather
                  name={opt.icon}
                  size={22}
                  color={selected ? opt.accent : OB.creamDim}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text
                  style={[
                    styles.roleLabel,
                    { color: selected ? OB.cream : OB.creamDim },
                  ]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[
                    styles.roleDesc,
                    { color: selected ? OB.creamDim : OB.creamDim + "90" },
                  ]}
                >
                  {opt.description}
                </Text>
              </View>
              <View
                style={[
                  styles.roleCheck,
                  selected
                    ? { backgroundColor: opt.accent, borderColor: opt.accent }
                    : { backgroundColor: "transparent", borderColor: OB.greenMid },
                ]}
              >
                {selected ? (
                  <Feather name="check" size={14} color={OB.bg} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Hint text */}
      <Text style={{ color: OB.creamDim + "70", fontSize: 13, marginTop: 16, textAlign: "center" }}>
        Select all that apply
      </Text>
    </View>
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

  const isLastOrFirst = currentIndex === 3;

  return (
    <View style={[styles.container, { backgroundColor: OB.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={OB.bg} />

      {/* Skip button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {!isLastOrFirst && currentIndex !== 0 ? (
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
        contentContainerStyle={{ alignItems: "stretch" }}
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

        {/* CTA Button */}
        <Pressable
          onPress={handleNext}
          disabled={!canProceed}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={
              isLastOrFirst
                ? [OB.gold, OB.goldLight]
                : [OB.greenBright, OB.greenAccent]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaButton, !canProceed && { opacity: 0.4 }]}
          >
            <Text
              style={[
                styles.ctaText,
                { color: isLastOrFirst ? OB.bg : OB.cream },
              ]}
            >
              {currentIndex === 0
                ? "Get Started — It's Free  →"
                : isLastOrFirst
                ? "Get Started →"
                : "Next  →"}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Role counter / hint */}
        {isLastOrFirst ? (
          <Text style={styles.roleCounter}>
            {selectedRoles.length === 0
              ? "Select at least one to continue"
              : `${selectedRoles.length} role${selectedRoles.length > 1 ? "s" : ""} selected`}
          </Text>
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
    padding: 16,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
    paddingVertical: 2,
  },
  calDayLabel: {
    color: "#C8BFA870",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    paddingBottom: 4,
  },
  calDay: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
});

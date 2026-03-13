import React, { useState, useRef } from "react";
import { StyleSheet, View, Pressable, Dimensions, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { UserRole } from "@/context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const ONBOARDING_COMPLETE_KEY = "@outsyde_onboarding_complete";
export const ONBOARDING_USER_TYPE_KEY = "@outsyde_user_type";

interface InfoSlide {
  id: string;
  type: "info";
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}

interface RoleSlide {
  id: string;
  type: "role";
  title: string;
}

type Slide = InfoSlide | RoleSlide;

const SLIDES: Slide[] = [
  {
    id: "1",
    type: "info",
    icon: "camera",
    title: "Welcome to Outsyde",
    description:
      "Discover amazing photographers and vendors in your area. Book sessions, shop products, and connect with creative professionals.",
  },
  {
    id: "2",
    type: "info",
    icon: "search",
    title: "Find Local Talent",
    description:
      "Browse photographers, cinematographers, food vendors, fashion stores, and local services. Filter by city and category to find exactly what you need.",
  },
  {
    id: "3",
    type: "info",
    icon: "calendar",
    title: "Book with Ease",
    description:
      "Schedule photography sessions, purchase products from vendors, and manage all your bookings in one place.",
  },
  {
    id: "4",
    type: "role",
    title: "What brings you to Outsyde?",
  },
];

const ROLE_OPTIONS: {
  role: UserRole;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
}[] = [
  {
    role: "consumer",
    icon: "shopping-bag",
    label: "Consumer",
    description: "Browse, book, and shop from local talent",
  },
  {
    role: "business",
    icon: "briefcase",
    label: "Business",
    description: "Sell products and services to clients",
  },
  {
    role: "photographer",
    icon: "camera",
    label: "Photographer",
    description: "Offer photography and creative services",
  },
];

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const canProceed = !isLastSlide || selectedRole !== null;

  const handleNext = async () => {
    if (!isLastSlide) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
      return;
    }
    if (!selectedRole) return;
    await completeOnboarding(selectedRole);
  };

  const handleSkip = async () => {
    // Skip lands on role selection slide
    const lastIndex = SLIDES.length - 1;
    flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true });
    setCurrentIndex(lastIndex);
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

    // Reset the stack so the signup screen sits on top of Main.
    // After signup the user calls goBack() and lands on Main (home).
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

  const renderSlide = ({ item }: { item: Slide }) => {
    if (item.type === "role") {
      return (
        <View style={styles.slide}>
          <ThemedText type="h2" style={[styles.roleTitle, { color: theme.text }]}>
            {item.title}
          </ThemedText>
          <View style={styles.roleOptions}>
            {ROLE_OPTIONS.map((opt) => {
              const selected = selectedRole === opt.role;
              return (
                <Pressable
                  key={opt.role}
                  onPress={() => setSelectedRole(opt.role)}
                  style={({ pressed }) => [
                    styles.roleCard,
                    {
                      backgroundColor: selected ? theme.primary : theme.card,
                      borderColor: selected ? theme.primary : theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.roleIconWrap,
                      {
                        backgroundColor: selected
                          ? "rgba(0,0,0,0.15)"
                          : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={24}
                      color={selected ? "#000000" : theme.primary}
                    />
                  </View>
                  <View style={styles.roleTextWrap}>
                    <ThemedText
                      style={[
                        styles.roleLabel,
                        { color: selected ? "#000000" : theme.text },
                      ]}
                    >
                      {opt.label}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.roleDesc,
                        { color: selected ? "rgba(0,0,0,0.65)" : theme.textSecondary },
                      ]}
                    >
                      {opt.description}
                    </ThemedText>
                  </View>
                  {selected ? (
                    <Feather name="check-circle" size={20} color="#000000" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.slide}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
          <Feather name={item.icon} size={64} color="#FFFFFF" />
        </View>
        <ThemedText type="h1" style={styles.title}>
          {item.title}
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.description, { color: theme.textSecondary }]}
        >
          {item.description}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        {!isLastSlide ? (
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Skip
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEnabled={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    currentIndex === index ? theme.primary : theme.border,
                  width: currentIndex === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button
          onPress={handleNext}
          style={[
            styles.button,
            !canProceed ? { opacity: 0.4 } : undefined,
          ]}
          disabled={!canProceed}
        >
          {isLastSlide ? "Get Started" : "Next"}
        </Button>

        {isLastSlide && !selectedRole ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}
          >
            Select an account type to continue
          </ThemedText>
        ) : null}
      </View>
    </ThemedView>
  );
}

// ─── Helpers (used by RootNavigator) ─────────────────────────────────────────

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
  slide: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["3xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  description: {
    textAlign: "center",
    lineHeight: 24,
  },

  // Role selection slide
  roleTitle: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  roleOptions: {
    width: "100%",
    gap: Spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTextWrap: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  footer: {
    paddingHorizontal: Spacing.xl,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: "100%",
  },
});

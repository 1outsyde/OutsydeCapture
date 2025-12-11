import React, { useState, useRef } from "react";
import { StyleSheet, View, Pressable, Dimensions, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ONBOARDING_COMPLETE_KEY = "@outsyde_onboarding_complete";

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    icon: "camera",
    title: "Welcome to Outsyde",
    description: "Discover amazing photographers and vendors in your area. Book sessions, shop products, and connect with creative professionals.",
  },
  {
    id: "2",
    icon: "search",
    title: "Find Local Talent",
    description: "Browse photographers, cinematographers, food vendors, fashion stores, and local services. Filter by city and category to find exactly what you need.",
  },
  {
    id: "3",
    icon: "calendar",
    title: "Book with Ease",
    description: "Schedule photography sessions, purchase products from vendors, and manage all your bookings in one place.",
  },
  {
    id: "4",
    icon: "star",
    title: "Earn Rewards",
    description: "Collect Outsyde Points with every booking and purchase. Leave reviews and refer friends to earn even more!",
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    if (currentIndex === SLIDES.length - 1) {
      await completeOnboarding();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch (error) {
      console.error("Failed to save onboarding status:", error);
    }
    onComplete();
  };

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
        <Feather name={item.icon} size={64} color="#FFFFFF" />
      </View>
      <ThemedText type="h1" style={styles.title}>
        {item.title}
      </ThemedText>
      <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
        {item.description}
      </ThemedText>
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: currentIndex === index ? theme.primary : theme.border,
                  width: currentIndex === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button onPress={handleNext} style={styles.button}>
          {isLastSlide ? "Get Started" : "Next"}
        </Button>
      </View>
    </ThemedView>
  );
}

export async function checkOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === "true";
  } catch (error) {
    console.error("Failed to check onboarding status:", error);
    return false;
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch (error) {
    console.error("Failed to reset onboarding:", error);
  }
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
    paddingHorizontal: Spacing["3xl"],
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

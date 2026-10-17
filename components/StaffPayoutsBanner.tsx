// StaffPayoutsBanner: red strip at the top of the main tabs for staff who skipped Staff Setup
// ("Browse the app for now"). Lets them use the app while making it clear payouts aren't connected.
// Tap pushes StaffOnboarding (not a reset), so its back button returns here.
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

const BANNER_RED = "#D93025";

export function shouldShowStaffPayoutsBanner(
  user:
    | {
        role?: string;
        isGuest?: boolean;
        staffStripeOnboardingComplete?: boolean;
      }
    | null
    | undefined,
): boolean {
  return (
    !!user &&
    !user.isGuest &&
    user.role === "staff" &&
    user.staffStripeOnboardingComplete !== true
  );
}

export default function StaffPayoutsBanner({ topInset }: { topInset: number }) {
  const navigation = useNavigation<any>();

  return (
    <Pressable
      onPress={() => navigation.navigate("StaffOnboarding")}
      accessibilityRole="button"
      accessibilityLabel="Payouts not connected. Tap to finish setup."
      style={({ pressed }) => [
        styles.banner,
        { paddingTop: topInset + Spacing.xs, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.row}>
        <Feather name="alert-circle" size={16} color="#FFFFFF" />
        <ThemedText type="small" style={styles.text} numberOfLines={1}>
          Payouts not connected. Tap to finish setup.
        </ThemedText>
        <Feather name="chevron-right" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: BANNER_RED,
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  text: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

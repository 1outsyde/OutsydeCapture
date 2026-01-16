import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileCompletionGateRouteProp = RouteProp<RootStackParamList, "ProfileCompletionGate">;

export default function ProfileCompletionGateScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileCompletionGateRouteProp>();
  const insets = useSafeAreaInsets();

  const { dashboardType } = route.params;
  const isPhotographer = dashboardType === "photographer";

  const title = isPhotographer ? "Complete Your Photographer Profile" : "Complete Your Business Profile";
  const description = isPhotographer
    ? "Before you can access your Photographer Dashboard, please complete your profile setup. This helps clients find and book you."
    : "Before you can access your Business Dashboard, please complete your profile setup and subscription. This allows customers to discover your products and services.";

  const steps = isPhotographer
    ? [
        { icon: "user" as const, text: "Add your display name and bio" },
        { icon: "dollar-sign" as const, text: "Set your hourly rate" },
        { icon: "map-pin" as const, text: "Add your location" },
        { icon: "camera" as const, text: "Select your specialties" },
        { icon: "credit-card" as const, text: "Connect Stripe to receive payments" },
      ]
    : [
        { icon: "briefcase" as const, text: "Complete business information" },
        { icon: "tag" as const, text: "Add products or services" },
        { icon: "credit-card" as const, text: "Subscribe to a plan" },
        { icon: "link" as const, text: "Connect Stripe to receive payments" },
      ];

  const handleSetupProfile = () => {
    if (isPhotographer) {
      navigation.navigate("PhotographerDashboard");
    } else {
      navigation.navigate("BusinessDashboard");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
          <Feather
            name={isPhotographer ? "camera" : "briefcase"}
            size={48}
            color={theme.primary}
          />
        </View>

        <ThemedText type="h2" style={styles.title}>
          {title}
        </ThemedText>

        <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>

        <View style={[styles.stepsContainer, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.stepsTitle}>
            Steps to complete:
          </ThemedText>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name={step.icon} size={16} color={theme.primary} />
              </View>
              <ThemedText type="body" style={styles.stepText}>
                {step.text}
              </ThemedText>
            </View>
          ))}
        </View>

        <Button onPress={handleSetupProfile} style={styles.setupButton}>
          Complete Setup
        </Button>

        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.laterButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            I'll do this later
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  stepsContainer: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  stepsTitle: {
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  stepText: {
    flex: 1,
  },
  setupButton: {
    width: "100%",
  },
  laterButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
  },
});

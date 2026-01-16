import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function InfluencerApplicationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [followers, setFollowers] = useState("");
  const [bio, setBio] = useState("");

  const handleSubmit = async () => {
    if (!instagram.trim() && !tiktok.trim()) {
      Alert.alert("Error", "Please provide at least one social media handle");
      return;
    }
    if (!followers.trim()) {
      Alert.alert("Error", "Please enter your follower count");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert(
        "Application Submitted",
        "Thank you for applying to become an Outsyde Influencer! We'll review your application and get back to you within 3-5 business days.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Apply as Influencer</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={[styles.infoCard, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="star" size={24} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Outsyde Influencer Program
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Get exclusive perks, early access to features, and partner with local businesses.
            </ThemedText>
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>
            Instagram Handle
          </ThemedText>
          <TextInput
            style={inputStyle}
            value={instagram}
            onChangeText={setInstagram}
            placeholder="@yourusername"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>
            TikTok Handle
          </ThemedText>
          <TextInput
            style={inputStyle}
            value={tiktok}
            onChangeText={setTiktok}
            placeholder="@yourusername"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>
            Total Followers *
          </ThemedText>
          <TextInput
            style={inputStyle}
            value={followers}
            onChangeText={setFollowers}
            placeholder="e.g., 10000"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>
            Tell us about yourself
          </ThemedText>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="What type of content do you create? Why do you want to join the Outsyde Influencer program?"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitButton}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : "Submit Application"}
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
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
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
  },
  textArea: {
    height: 120,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
});

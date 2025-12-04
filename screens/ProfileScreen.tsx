import { useState } from "react";
import { StyleSheet, View, TextInput } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import Spacer from "@/components/Spacer";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Profile">;
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { theme, isDark } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    console.log("Form submitted:", { name, email, password });
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.section}>
        <ThemedText type="h1">Heading 1</ThemedText>
        <ThemedText type="small" style={styles.meta}>
          32px • Bold
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h2">Heading 2</ThemedText>
        <ThemedText type="small" style={styles.meta}>
          28px • Bold
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h3">Heading 3</ThemedText>
        <ThemedText type="small" style={styles.meta}>
          24px • Semi-Bold
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4">Heading 4</ThemedText>
        <ThemedText type="small" style={styles.meta}>
          20px • Semi-Bold
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="body">
          Body text - This is the default text style for paragraphs and general
          content.
        </ThemedText>
        <ThemedText type="small" style={styles.meta}>
          16px • Regular
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="small">
          Small text - Used for captions, labels, and secondary information.
        </ThemedText>
        <ThemedText type="small" style={styles.meta}>
          14px • Regular
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="link">Link text - Interactive elements</ThemedText>
        <ThemedText type="small" style={styles.meta}>
          16px • Regular • Colored
        </ThemedText>
      </View>

      <Spacer height={Spacing["4xl"]} />

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Name
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <Spacer height={Spacing.lg} />

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Email
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder="your.email@example.com"
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
      </View>

      <Spacer height={Spacing.lg} />

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Password
        </ThemedText>
        <TextInput
          style={inputStyle}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter a password"
          placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="next"
        />
      </View>

      <Spacer height={Spacing.lg} />

      <Button onPress={handleSubmit}>Submit Form</Button>

      <Spacer height={Spacing["2xl"]} />

      <ThemedText type="h3" style={styles.sectionTitle}>
        Testing
      </ThemedText>
      <Spacer height={Spacing.md} />
      <Button
        onPress={() => navigation.navigate("Crash")}
        style={styles.crashButton}
      >
        Crash App
      </Button>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing["3xl"],
  },
  meta: {
    opacity: 0.5,
    marginTop: Spacing.sm,
  },
  fieldContainer: {
    width: "100%",
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
    opacity: 0.8,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 0,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  sectionTitle: {
    marginTop: Spacing.xl,
  },
  crashButton: {
    backgroundColor: "#FF3B30",
  },
});

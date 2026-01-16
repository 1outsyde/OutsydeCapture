import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Role = "business" | "photographer";

interface BusinessFormData {
  name: string;
  category: string;
  city: string;
  state: string;
  description: string;
  website: string;
  instagram: string;
  phone: string;
  email: string;
}

interface PhotographerFormData {
  name: string;
  specialty: string;
  city: string;
  state: string;
  priceRange: string;
  description: string;
  website: string;
  instagram: string;
  phone: string;
  email: string;
}

const BUSINESS_CATEGORIES = [
  "Food & Dining",
  "Beauty & Hair",
  "Art & Design",
  "Fashion & Apparel",
  "Health & Wellness",
  "Home Services",
  "Events & Entertainment",
  "Other",
];

const PHOTOGRAPHER_SPECIALTIES = [
  "Portrait",
  "Wedding",
  "Event",
  "Fashion",
  "Product",
  "Landscape",
  "Street",
  "Other",
];

const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"];

export default function BusinessOnboardingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, getToken } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [businessData, setBusinessData] = useState<BusinessFormData>({
    name: "",
    category: "",
    city: "",
    state: "",
    description: "",
    website: "",
    instagram: "",
    phone: "",
    email: "",
  });

  const [photographerData, setPhotographerData] = useState<PhotographerFormData>({
    name: "",
    specialty: "",
    city: "",
    state: "",
    priceRange: "",
    description: "",
    website: "",
    instagram: "",
    phone: "",
    email: "",
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate("Auth", { returnTo: "BusinessOnboarding" });
    }
  }, [isAuthenticated]);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      handleClose();
    }
  };

  const handleNext = () => {
    if (step === 1 && !role) {
      Alert.alert("Select Role", "Please select whether you are a Business Owner or Photographer.");
      return;
    }

    if (step === 2) {
      if (role === "business") {
        if (!businessData.name || !businessData.category || !businessData.city || !businessData.state || !businessData.description) {
          Alert.alert("Required Fields", "Please fill in all required fields.");
          return;
        }
      } else {
        if (!photographerData.name || !photographerData.specialty || !photographerData.city || !photographerData.state || !photographerData.priceRange || !photographerData.description) {
          Alert.alert("Required Fields", "Please fill in all required fields.");
          return;
        }
      }
    }

    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const token = await getToken();
      
      if (!token) {
        Alert.alert("Authentication Required", "Please sign in to continue.");
        navigation.navigate("Auth", { returnTo: "BusinessOnboarding" });
        return;
      }

      if (role === "business") {
        await api.createBusiness({
          name: businessData.name,
          category: businessData.category,
          city: businessData.city,
          state: businessData.state,
          description: businessData.description,
          website: businessData.website || undefined,
          instagram: businessData.instagram || undefined,
          phone: businessData.phone || undefined,
          email: businessData.email || undefined,
        }, token);
      } else {
        await api.createPhotographer({
          name: photographerData.name,
          specialty: photographerData.specialty,
          city: photographerData.city,
          state: photographerData.state,
          priceRange: photographerData.priceRange,
          description: photographerData.description,
          website: photographerData.website || undefined,
          instagram: photographerData.instagram || undefined,
          phone: photographerData.phone || undefined,
          email: photographerData.email || undefined,
        }, token);
      }

      Alert.alert(
        "Success!",
        `Your ${role === "business" ? "business" : "photographer"} profile has been created. It will appear in search results shortly.`,
        [
          {
            text: "OK",
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: "Main", params: { screen: "SearchTab" } }],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("Failed to create profile:", error);
      Alert.alert("Error", "Failed to create your profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundSecondary,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Choose Your Role
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Are you a business owner or a photographer?
      </ThemedText>

      <Pressable
        onPress={() => setRole("business")}
        style={({ pressed }) => [
          styles.roleCard,
          {
            backgroundColor: role === "business" ? theme.primaryTransparent : theme.backgroundSecondary,
            borderColor: role === "business" ? theme.primary : theme.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Feather
          name="briefcase"
          size={32}
          color={role === "business" ? theme.primary : theme.textSecondary}
        />
        <View style={styles.roleTextContainer}>
          <ThemedText type="h4" style={role === "business" ? { color: theme.primary } : undefined}>
            Business Owner
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Restaurants, salons, shops, and more
          </ThemedText>
        </View>
        {role === "business" && (
          <Feather name="check-circle" size={24} color={theme.primary} />
        )}
      </Pressable>

      <Pressable
        onPress={() => setRole("photographer")}
        style={({ pressed }) => [
          styles.roleCard,
          {
            backgroundColor: role === "photographer" ? theme.primaryTransparent : theme.backgroundSecondary,
            borderColor: role === "photographer" ? theme.primary : theme.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Feather
          name="camera"
          size={32}
          color={role === "photographer" ? theme.primary : theme.textSecondary}
        />
        <View style={styles.roleTextContainer}>
          <ThemedText type="h4" style={role === "photographer" ? { color: theme.primary } : undefined}>
            Photographer
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Portrait, events, weddings, and more
          </ThemedText>
        </View>
        {role === "photographer" && (
          <Feather name="check-circle" size={24} color={theme.primary} />
        )}
      </Pressable>
    </View>
  );

  const renderStep2Business = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Business Details
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Tell us about your business
      </ThemedText>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Business Name *</ThemedText>
        <TextInput
          style={inputStyle}
          value={businessData.name}
          onChangeText={(text) => setBusinessData({ ...businessData, name: text })}
          placeholder="Enter your business name"
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Category *</ThemedText>
        <View style={styles.optionsRow}>
          {BUSINESS_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setBusinessData({ ...businessData, category: cat })}
              style={[
                styles.optionChip,
                {
                  backgroundColor: businessData.category === cat ? theme.primaryTransparent : theme.backgroundSecondary,
                  borderColor: businessData.category === cat ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                type="caption"
                style={{ color: businessData.category === cat ? theme.primary : theme.text }}
              >
                {cat}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldContainer, { flex: 1, marginRight: Spacing.sm }]}>
          <ThemedText type="caption" style={styles.label}>City *</ThemedText>
          <TextInput
            style={inputStyle}
            value={businessData.city}
            onChangeText={(text) => setBusinessData({ ...businessData, city: text })}
            placeholder="City"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        <View style={[styles.fieldContainer, { flex: 1 }]}>
          <ThemedText type="caption" style={styles.label}>State *</ThemedText>
          <TextInput
            style={inputStyle}
            value={businessData.state}
            onChangeText={(text) => setBusinessData({ ...businessData, state: text })}
            placeholder="State"
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Short Description *</ThemedText>
        <TextInput
          style={[inputStyle, styles.textArea]}
          value={businessData.description}
          onChangeText={(text) => setBusinessData({ ...businessData, description: text })}
          placeholder="Tell customers what you offer..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderStep2Photographer = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Photographer Details
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Tell us about your photography
      </ThemedText>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Your Name *</ThemedText>
        <TextInput
          style={inputStyle}
          value={photographerData.name}
          onChangeText={(text) => setPhotographerData({ ...photographerData, name: text })}
          placeholder="Enter your name"
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Specialty *</ThemedText>
        <View style={styles.optionsRow}>
          {PHOTOGRAPHER_SPECIALTIES.map((spec) => (
            <Pressable
              key={spec}
              onPress={() => setPhotographerData({ ...photographerData, specialty: spec })}
              style={[
                styles.optionChip,
                {
                  backgroundColor: photographerData.specialty === spec ? theme.primaryTransparent : theme.backgroundSecondary,
                  borderColor: photographerData.specialty === spec ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                type="caption"
                style={{ color: photographerData.specialty === spec ? theme.primary : theme.text }}
              >
                {spec}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldContainer, { flex: 1, marginRight: Spacing.sm }]}>
          <ThemedText type="caption" style={styles.label}>City *</ThemedText>
          <TextInput
            style={inputStyle}
            value={photographerData.city}
            onChangeText={(text) => setPhotographerData({ ...photographerData, city: text })}
            placeholder="City"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        <View style={[styles.fieldContainer, { flex: 1 }]}>
          <ThemedText type="caption" style={styles.label}>State *</ThemedText>
          <TextInput
            style={inputStyle}
            value={photographerData.state}
            onChangeText={(text) => setPhotographerData({ ...photographerData, state: text })}
            placeholder="State"
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Starting Price Range *</ThemedText>
        <View style={styles.optionsRow}>
          {PRICE_RANGES.map((range) => (
            <Pressable
              key={range}
              onPress={() => setPhotographerData({ ...photographerData, priceRange: range })}
              style={[
                styles.priceChip,
                {
                  backgroundColor: photographerData.priceRange === range ? theme.primaryTransparent : theme.backgroundSecondary,
                  borderColor: photographerData.priceRange === range ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: photographerData.priceRange === range ? theme.primary : theme.text }}
              >
                {range}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="caption" style={styles.label}>Short Bio *</ThemedText>
        <TextInput
          style={[inputStyle, styles.textArea]}
          value={photographerData.description}
          onChangeText={(text) => setPhotographerData({ ...photographerData, description: text })}
          placeholder="Tell clients about your style and experience..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderStep3 = () => {
    const data = role === "business" ? businessData : photographerData;
    const setData = role === "business" 
      ? (updates: Partial<BusinessFormData>) => setBusinessData({ ...businessData, ...updates })
      : (updates: Partial<PhotographerFormData>) => setPhotographerData({ ...photographerData, ...updates });

    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <ThemedText type="h2" style={styles.stepTitle}>
          Optional Details
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Add contact info and social links (optional)
        </ThemedText>

        <View style={styles.fieldContainer}>
          <ThemedText type="caption" style={styles.label}>Website</ThemedText>
          <TextInput
            style={inputStyle}
            value={data.website}
            onChangeText={(text) => setData({ website: text })}
            placeholder="https://yourwebsite.com"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="caption" style={styles.label}>Instagram Handle</ThemedText>
          <TextInput
            style={inputStyle}
            value={data.instagram}
            onChangeText={(text) => setData({ instagram: text })}
            placeholder="@yourhandle"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="caption" style={styles.label}>Phone Number</ThemedText>
          <TextInput
            style={inputStyle}
            value={data.phone}
            onChangeText={(text) => setData({ phone: text })}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="caption" style={styles.label}>Email Address</ThemedText>
          <TextInput
            style={inputStyle}
            value={data.email}
            onChangeText={(text) => setData({ email: text })}
            placeholder="contact@yourbusiness.com"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderStep4 = () => {
    const data = role === "business" ? businessData : photographerData;
    
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <ThemedText type="h2" style={styles.stepTitle}>
          Review Your Profile
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Make sure everything looks good before submitting
        </ThemedText>

        <View style={[styles.reviewCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.reviewRow}>
            <Feather name={role === "business" ? "briefcase" : "camera"} size={20} color={theme.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {role === "business" ? "Business" : "Photographer"}
            </ThemedText>
          </View>

          <View style={styles.reviewDivider} />

          <View style={styles.reviewItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Name</ThemedText>
            <ThemedText type="body">{data.name}</ThemedText>
          </View>

          <View style={styles.reviewItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {role === "business" ? "Category" : "Specialty"}
            </ThemedText>
            <ThemedText type="body">
              {role === "business" ? (data as BusinessFormData).category : (data as PhotographerFormData).specialty}
            </ThemedText>
          </View>

          <View style={styles.reviewItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Location</ThemedText>
            <ThemedText type="body">{data.city}, {data.state}</ThemedText>
          </View>

          {role === "photographer" && (
            <View style={styles.reviewItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Price Range</ThemedText>
              <ThemedText type="body">{(data as PhotographerFormData).priceRange}</ThemedText>
            </View>
          )}

          <View style={styles.reviewItem}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {role === "business" ? "Description" : "Bio"}
            </ThemedText>
            <ThemedText type="body">{data.description}</ThemedText>
          </View>

          {(data.website || data.instagram || data.phone || data.email) && (
            <>
              <View style={styles.reviewDivider} />
              <ThemedText type="caption" style={[styles.reviewSectionTitle, { color: theme.textSecondary }]}>
                Contact Info
              </ThemedText>
              {data.website ? (
                <View style={styles.reviewItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Website</ThemedText>
                  <ThemedText type="body">{data.website}</ThemedText>
                </View>
              ) : null}
              {data.instagram ? (
                <View style={styles.reviewItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Instagram</ThemedText>
                  <ThemedText type="body">{data.instagram}</ThemedText>
                </View>
              ) : null}
              {data.phone ? (
                <View style={styles.reviewItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Phone</ThemedText>
                  <ThemedText type="body">{data.phone}</ThemedText>
                </View>
              ) : null}
              {data.email ? (
                <View style={styles.reviewItem}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Email</ThemedText>
                  <ThemedText type="body">{data.email}</ThemedText>
                </View>
              ) : null}
            </>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return role === "business" ? renderStep2Business() : renderStep2Photographer();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Feather name={step === 1 ? "x" : "arrow-left"} size={24} color={theme.text} />
        </Pressable>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor: s <= step ? theme.primary : theme.backgroundSecondary,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.headerButton} />
      </View>

      {renderStepContent()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {step < 4 ? (
          <Button onPress={handleNext} disabled={step === 1 && !role}>
            Continue
          </Button>
        ) : (
          <Button onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              "Submit Profile"
            )}
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  roleTextContainer: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  priceChip: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reviewCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    marginVertical: Spacing.lg,
  },
  reviewItem: {
    marginBottom: Spacing.md,
  },
  reviewSectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
});

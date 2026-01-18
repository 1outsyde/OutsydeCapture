import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, Platform, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const INDUSTRIES = [
  { id: "clothing", name: "Clothing & Fashion", icon: "shopping-bag" as const },
  { id: "beauty-products", name: "Beauty Products", icon: "droplet" as const },
  { id: "beauty-services", name: "Beauty Services", icon: "scissors" as const },
  { id: "food", name: "Food & Dining", icon: "coffee" as const },
  { id: "fitness", name: "Fitness & Wellness", icon: "activity" as const },
  { id: "home-goods", name: "Home & Decor", icon: "home" as const },
  { id: "arts", name: "Arts & Crafts", icon: "edit-3" as const },
  { id: "services", name: "Professional Services", icon: "tool" as const },
];

const INDUSTRY_NICHES: Record<string, { label: string; options: string[] }> = {
  "clothing": {
    label: "What types of clothing interest you?",
    options: ["Streetwear", "Vintage", "Designer", "Casual", "Athletic Wear", "Formal Wear", "Children's Clothing", "Plus Size", "Sustainable Fashion", "Accessories & Jewelry", "Shoes & Footwear", "Custom/Tailored"]
  },
  "beauty-products": {
    label: "What beauty products are you interested in?",
    options: ["Skincare", "Makeup", "Haircare", "Natural/Organic", "Fragrances", "Nail Products", "Men's Grooming", "K-Beauty", "Anti-aging", "Acne Care", "Body Care", "Indie Brands"]
  },
  "beauty-services": {
    label: "What beauty services do you look for?",
    options: ["Hair Styling", "Hair Coloring", "Barbershop", "Nail Salon", "Spa & Massage", "Facials", "Waxing", "Lash Extensions", "Brow Services", "Makeup Artist", "Braiding & Locs", "Med Spa"]
  },
  "food": {
    label: "What types of food do you enjoy?",
    options: ["Italian", "Soul Food", "Mexican", "Asian Fusion", "Caribbean", "BBQ", "Vegan/Vegetarian", "Bakery & Sweets", "Coffee & Cafe", "Seafood", "Food Trucks", "Fine Dining", "Fast Casual", "Desserts", "Healthy/Organic"]
  },
  "fitness": {
    label: "What fitness activities interest you?",
    options: ["Yoga", "CrossFit", "Personal Training", "Pilates", "Boxing/MMA", "Dance Fitness", "Swimming", "Cycling/Spin", "Meditation", "Nutrition Coaching", "Physical Therapy", "Group Classes"]
  },
  "home-goods": {
    label: "What home items are you looking for?",
    options: ["Furniture", "Home Decor", "Plants & Garden", "Kitchenware", "Bedding & Linens", "Candles & Scents", "Wall Art", "Handmade Items", "Antiques", "Organization", "Outdoor Living", "Pet Supplies"]
  },
  "arts": {
    label: "What arts & crafts interest you?",
    options: ["Paintings", "Photography", "Pottery & Ceramics", "Jewelry Making", "Handmade Crafts", "Digital Art", "Sculpture", "Textiles", "Woodworking", "Custom Commissions", "Art Classes", "Supplies"]
  },
  "services": {
    label: "What services might you need?",
    options: ["Cleaning", "Landscaping", "Handyman", "Auto Repair", "Pet Services", "Photography", "Event Planning", "Tutoring", "Legal Services", "Accounting", "Real Estate", "Tech Support"]
  }
};

const INDUSTRY_VALUES: Record<string, { label: string; options: { id: string; name: string; description: string }[] }> = {
  "clothing": {
    label: "What matters most when shopping for clothing?",
    options: [
      { id: "quality", name: "Quality", description: "Well-made, durable items" },
      { id: "style", name: "Style & Trends", description: "On-trend, fashionable pieces" },
      { id: "price", name: "Value for Money", description: "Good quality at fair prices" },
      { id: "service", name: "Customer Service", description: "Helpful, attentive staff" },
      { id: "unique", name: "Uniqueness", description: "One-of-a-kind items" },
      { id: "sustainable", name: "Sustainability", description: "Eco-friendly practices" },
    ]
  },
  "beauty-products": {
    label: "What's most important when choosing beauty products?",
    options: [
      { id: "quality", name: "Product Quality", description: "High-performance formulas" },
      { id: "ingredients", name: "Ingredients", description: "Clean, safe ingredients" },
      { id: "price", name: "Affordability", description: "Good value for the price" },
      { id: "brand", name: "Brand Reputation", description: "Trusted, well-known brands" },
      { id: "results", name: "Visible Results", description: "Products that deliver" },
      { id: "cruelty-free", name: "Cruelty-Free", description: "Not tested on animals" },
    ]
  },
  "beauty-services": {
    label: "What matters most in beauty service experiences?",
    options: [
      { id: "skill", name: "Technical Skill", description: "Expert technique and results" },
      { id: "hospitality", name: "Hospitality", description: "Warm, welcoming atmosphere" },
      { id: "cleanliness", name: "Cleanliness", description: "Sanitary environment" },
      { id: "price", name: "Pricing", description: "Fair and transparent pricing" },
      { id: "convenience", name: "Convenience", description: "Easy booking, good hours" },
      { id: "trendy", name: "Trendy Styles", description: "Up-to-date with trends" },
    ]
  },
  "food": {
    label: "What matters most when dining out?",
    options: [
      { id: "taste", name: "Taste & Flavor", description: "Delicious, flavorful food" },
      { id: "presentation", name: "Presentation", description: "Beautiful plating" },
      { id: "service", name: "Service Quality", description: "Attentive, friendly staff" },
      { id: "hospitality", name: "Hospitality", description: "Warm, welcoming atmosphere" },
      { id: "ambiance", name: "Ambiance", description: "Nice decor and vibe" },
      { id: "value", name: "Value for Money", description: "Good portions at fair prices" },
      { id: "speed", name: "Speed", description: "Quick service when needed" },
      { id: "authenticity", name: "Authenticity", description: "True to cuisine origins" },
    ]
  },
  "fitness": {
    label: "What's most important in your fitness experience?",
    options: [
      { id: "expertise", name: "Trainer Expertise", description: "Knowledgeable instructors" },
      { id: "equipment", name: "Equipment Quality", description: "Modern, well-maintained gear" },
      { id: "atmosphere", name: "Atmosphere", description: "Motivating, energetic vibe" },
      { id: "community", name: "Community", description: "Supportive, friendly members" },
      { id: "cleanliness", name: "Cleanliness", description: "Clean, hygienic facilities" },
      { id: "results", name: "Results-Focused", description: "Programs that deliver" },
    ]
  },
  "home-goods": {
    label: "What matters most when shopping for home items?",
    options: [
      { id: "quality", name: "Quality", description: "Well-crafted, durable items" },
      { id: "design", name: "Design & Aesthetics", description: "Beautiful, stylish pieces" },
      { id: "price", name: "Value", description: "Good quality at fair prices" },
      { id: "unique", name: "Uniqueness", description: "One-of-a-kind finds" },
      { id: "handmade", name: "Handmade/Artisan", description: "Crafted with care" },
      { id: "function", name: "Functionality", description: "Practical and useful" },
    ]
  },
  "arts": {
    label: "What do you value in arts and crafts?",
    options: [
      { id: "creativity", name: "Creativity", description: "Original, creative work" },
      { id: "skill", name: "Craftsmanship", description: "Technical skill and quality" },
      { id: "story", name: "Story & Meaning", description: "Pieces with a story" },
      { id: "local", name: "Local Artists", description: "Supporting local creators" },
      { id: "affordable", name: "Accessibility", description: "Art for every budget" },
      { id: "interactive", name: "Interactive", description: "Classes and workshops" },
    ]
  },
  "services": {
    label: "What matters most in professional services?",
    options: [
      { id: "reliability", name: "Reliability", description: "Dependable and on-time" },
      { id: "expertise", name: "Expertise", description: "Skilled, knowledgeable pros" },
      { id: "communication", name: "Communication", description: "Clear, responsive contact" },
      { id: "price", name: "Fair Pricing", description: "Transparent, honest rates" },
      { id: "trust", name: "Trustworthiness", description: "Honest, ethical practices" },
      { id: "convenience", name: "Convenience", description: "Flexible scheduling" },
    ]
  }
};

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const SHOPPING_FREQUENCIES = ["Rarely", "Monthly", "Weekly", "Multiple times a week"];

const STEPS = [
  { id: 1, name: "Account" },
  { id: 2, name: "Location" },
  { id: 3, name: "About You" },
  { id: 4, name: "Industries" },
  { id: 5, name: "Your Tastes" },
  { id: 6, name: "Finish" },
];

export default function ConsumerSignupScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { signup, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  const handleUseMyLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "Please enable location access to auto-fill your city and state.",
          [
            { text: "Cancel", style: "cancel" },
            ...(Platform.OS !== "web" ? [{ text: "Open Settings", onPress: async () => {
              try { await Linking.openSettings(); } catch (e) {}
            }}] : []),
          ]
        );
        setDetectingLocation(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (geocode) {
        if (geocode.city) setCity(geocode.city);
        if (geocode.region) setState(geocode.region.length === 2 ? geocode.region : geocode.region.substring(0, 2).toUpperCase());
        if (geocode.postalCode) setZipCode(geocode.postalCode);
      }
    } catch (error) {
      Alert.alert("Location Error", "Could not detect your location. Please enter manually.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [shoppingFrequency, setShoppingFrequency] = useState("");

  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industryNiches, setIndustryNiches] = useState<Record<string, string[]>>({});
  const [industryValues, setIndustryValues] = useState<Record<string, string[]>>({});

  const [currentIndustryIndex, setCurrentIndustryIndex] = useState(0);

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      if (parts.length === 0) return "";
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return `(${parts[0]}) ${parts[1]}`;
      return `(${parts[0]}) ${parts[1]}-${parts[2]}`;
    }
    return text;
  };

  const formatDOB = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,2})(\d{0,2})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      if (parts.length === 0) return "";
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return text;
  };

  const toggleIndustry = (id: string) => {
    setSelectedIndustries(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleNiche = (industry: string, niche: string) => {
    setIndustryNiches(prev => {
      const current = prev[industry] || [];
      return {
        ...prev,
        [industry]: current.includes(niche) 
          ? current.filter(n => n !== niche) 
          : [...current, niche]
      };
    });
  };

  const toggleValue = (industry: string, value: string) => {
    setIndustryValues(prev => {
      const current = prev[industry] || [];
      return {
        ...prev,
        [industry]: current.includes(value) 
          ? current.filter(v => v !== value) 
          : [...current, value]
      };
    });
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!email.trim() || !password.trim() || !name.trim() || !phone.trim()) {
          Alert.alert("Error", "Please fill in all required fields");
          return false;
        }
        if (password.length < 6) {
          Alert.alert("Error", "Password must be at least 6 characters");
          return false;
        }
        return true;
      case 2:
        if (!city.trim() || !state.trim()) {
          Alert.alert("Error", "Please enter your city and state");
          return false;
        }
        return true;
      case 3:
        return true;
      case 4:
        if (selectedIndustries.length === 0) {
          Alert.alert("Error", "Please select at least one industry");
          return false;
        }
        return true;
      case 5:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (currentStep === 5) {
      if (currentIndustryIndex < selectedIndustries.length - 1) {
        setCurrentIndustryIndex(prev => prev + 1);
      } else {
        setCurrentStep(6);
      }
    } else {
      if (currentStep === 4) {
        setCurrentIndustryIndex(0);
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 5 && currentIndustryIndex > 0) {
      setCurrentIndustryIndex(prev => prev - 1);
    } else if (currentStep > 1) {
      if (currentStep === 5) {
        setCurrentIndustryIndex(0);
      }
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const result = await signup({
      firstName,
      lastName,
      email,
      phone: phone.replace(/\D/g, ""),
      dateOfBirth,
      password,
      role: "consumer",
      city,
      state,
      zipCode,
      username,
      gender,
      ethnicity,
      shoppingFrequency,
      selectedIndustries,
      industryNiches,
      industryValues,
    });

    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert("Error", result.errorMessage || "Registration failed. Please try again.");
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Create Account</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Enter your details to get started
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Full Name *</ThemedText>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Email *</ThemedText>
              <TextInput
                style={inputStyle}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Phone *</ThemedText>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={(text) => setPhone(formatPhone(text))}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Password *</ThemedText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Your Location</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Help us find local businesses for you
            </ThemedText>

            <Pressable
              onPress={handleUseMyLocation}
              disabled={detectingLocation}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.primary,
                  paddingVertical: 14,
                  borderRadius: BorderRadius.md,
                  marginBottom: Spacing.lg,
                  opacity: pressed || detectingLocation ? 0.7 : 1,
                },
              ]}
            >
              {detectingLocation ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Feather name="map-pin" size={18} color="#000" />
                  <ThemedText type="button" style={{ color: "#000", marginLeft: 8 }}>
                    Use My Location
                  </ThemedText>
                </>
              )}
            </Pressable>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>City *</ThemedText>
              <TextInput
                style={inputStyle}
                value={city}
                onChangeText={setCity}
                placeholder="Your city"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>State *</ThemedText>
              <TextInput
                style={inputStyle}
                value={state}
                onChangeText={setState}
                placeholder="Your state"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Zip Code</ThemedText>
              <TextInput
                style={inputStyle}
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="12345"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>About You</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Help us personalize your experience
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Username</ThemedText>
              <TextInput
                style={inputStyle}
                value={username}
                onChangeText={setUsername}
                placeholder="@username"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Date of Birth</ThemedText>
              <TextInput
                style={inputStyle}
                value={dateOfBirth}
                onChangeText={(text) => setDateOfBirth(formatDOB(text))}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>Gender</ThemedText>
              <View style={styles.optionGrid}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: gender === g ? theme.primary : theme.backgroundDefault,
                        borderColor: gender === g ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: gender === g ? "#FFFFFF" : theme.text }}
                    >
                      {g}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" style={styles.label}>How often do you shop?</ThemedText>
              <View style={styles.optionGrid}>
                {SHOPPING_FREQUENCIES.map((freq) => (
                  <Pressable
                    key={freq}
                    onPress={() => setShoppingFrequency(freq)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: shoppingFrequency === freq ? theme.primary : theme.backgroundDefault,
                        borderColor: shoppingFrequency === freq ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: shoppingFrequency === freq ? "#FFFFFF" : theme.text }}
                    >
                      {freq}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>Your Interests</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              Select industries you're interested in
            </ThemedText>

            <View style={styles.industryGrid}>
              {INDUSTRIES.map((industry) => (
                <Pressable
                  key={industry.id}
                  onPress={() => toggleIndustry(industry.id)}
                  style={[
                    styles.industryCard,
                    {
                      backgroundColor: selectedIndustries.includes(industry.id) 
                        ? theme.primary + "20" 
                        : theme.backgroundDefault,
                      borderColor: selectedIndustries.includes(industry.id) 
                        ? theme.primary 
                        : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={industry.icon}
                    size={24}
                    color={selectedIndustries.includes(industry.id) ? theme.primary : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      marginTop: Spacing.xs,
                      textAlign: "center",
                      color: selectedIndustries.includes(industry.id) ? theme.primary : theme.text,
                    }}
                  >
                    {industry.name}
                  </ThemedText>
                  {selectedIndustries.includes(industry.id) ? (
                    <View style={[styles.checkMark, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        );

      case 5:
        const currentIndustry = selectedIndustries[currentIndustryIndex];
        const nicheData = INDUSTRY_NICHES[currentIndustry];
        const valueData = INDUSTRY_VALUES[currentIndustry];
        const industryName = INDUSTRIES.find(i => i.id === currentIndustry)?.name || "";

        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>{industryName}</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
              {currentIndustryIndex + 1} of {selectedIndustries.length}
            </ThemedText>

            {nicheData ? (
              <View style={styles.field}>
                <ThemedText type="body" style={styles.questionLabel}>{nicheData.label}</ThemedText>
                <View style={styles.nicheGrid}>
                  {nicheData.options.map((niche) => (
                    <Pressable
                      key={niche}
                      onPress={() => toggleNiche(currentIndustry, niche)}
                      style={[
                        styles.nicheChip,
                        {
                          backgroundColor: (industryNiches[currentIndustry] || []).includes(niche)
                            ? theme.primary
                            : theme.backgroundDefault,
                          borderColor: (industryNiches[currentIndustry] || []).includes(niche)
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: (industryNiches[currentIndustry] || []).includes(niche)
                            ? "#FFFFFF"
                            : theme.text,
                        }}
                      >
                        {niche}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {valueData ? (
              <View style={styles.field}>
                <ThemedText type="body" style={styles.questionLabel}>{valueData.label}</ThemedText>
                <View style={styles.valueList}>
                  {valueData.options.map((option) => (
                    <Pressable
                      key={option.id}
                      onPress={() => toggleValue(currentIndustry, option.id)}
                      style={[
                        styles.valueCard,
                        {
                          backgroundColor: (industryValues[currentIndustry] || []).includes(option.id)
                            ? theme.primary + "15"
                            : theme.backgroundDefault,
                          borderColor: (industryValues[currentIndustry] || []).includes(option.id)
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <View style={styles.valueContent}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>{option.name}</ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>{option.description}</ThemedText>
                      </View>
                      {(industryValues[currentIndustry] || []).includes(option.id) ? (
                        <Feather name="check-circle" size={20} color={theme.primary} />
                      ) : (
                        <Feather name="circle" size={20} color={theme.border} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <View style={[styles.successIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="check" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h2" style={[styles.stepTitle, { textAlign: "center" }]}>You're All Set!</ThemedText>
            <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary, textAlign: "center" }]}>
              Tap below to create your account and start exploring
            </ThemedText>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Step {currentStep} of {STEPS.length}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepContent()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.background }]}>
        {currentStep === 6 ? (
          <Button onPress={handleSubmit} style={styles.nextButton} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : "Create Account"}
          </Button>
        ) : (
          <Button onPress={handleNext} style={styles.nextButton}>
            Continue
          </Button>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: { marginRight: Spacing.md },
  progressContainer: { flex: 1 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  stepContent: {},
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.md,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    margin: 4,
  },
  industryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  industryCard: {
    width: "45%",
    margin: "2.5%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    position: "relative",
  },
  checkMark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  questionLabel: {
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  nicheChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    margin: 4,
  },
  valueList: {
    gap: Spacing.sm,
  },
  valueCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  valueContent: {
    flex: 1,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  nextButton: {
    width: "100%",
  },
});

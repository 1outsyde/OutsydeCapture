import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { CATEGORY_LABELS } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "PhotographerDetail">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PhotographerDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { photographer } = route.params;
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleBookNow = () => {
    if (!isAuthenticated) {
      navigation.navigate("Auth");
      return;
    }
    navigation.navigate("Booking", { photographer });
  };

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  const getPriceLabel = (range: string) => {
    switch (range) {
      case "$": return "$150/session";
      case "$$": return "$300/session";
      case "$$$": return "$500/session";
      case "$$$$": return "$800+/session";
      default: return "Contact for pricing";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {photographer.portfolio.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={styles.portfolioImage}
              contentFit="cover"
              transition={200}
            />
          ))}
        </ScrollView>

        <View style={[styles.imageOverlay, { paddingTop: insets.top }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: "rgba(0,0,0,0.3)", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.pagination}>
          {photographer.portfolio.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                {
                  backgroundColor:
                    activeImageIndex === index
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.5)",
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={{ uri: photographer.avatar }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.headerInfo}>
            <ThemedText type="h2">{photographer.name}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {CATEGORY_LABELS[photographer.specialty]} Photographer
            </ThemedText>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={styles.statValue}>
              <Feather name="star" size={18} color="#FFD700" />
              <ThemedText type="h4" style={styles.statNumber}>
                {photographer.rating}
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Rating
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="h4">{photographer.reviewCount}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Reviews
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="h4" style={{ color: theme.secondary }}>
              {photographer.priceRange}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Price
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={18} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
              {photographer.location}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            About
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {photographer.bio}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Pricing
          </ThemedText>
          <View style={[styles.priceCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.priceRow}>
              <ThemedText type="body">Session Rate</ThemedText>
              <ThemedText type="h4" style={{ color: theme.primary }}>
                {getPriceLabel(photographer.priceRange)}
              </ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              Includes 1-hour session and edited digital photos
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Availability
          </ThemedText>
          <View style={styles.availabilityInfo}>
            <Feather name="calendar" size={18} color={theme.success} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {photographer.availability.length} days available this month
            </ThemedText>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
            borderTopColor: theme.border,
          },
        ]}
      >
        <View style={styles.footerPrice}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Starting at
          </ThemedText>
          <ThemedText type="h3" style={{ color: theme.primary }}>
            {getPriceLabel(photographer.priceRange).split("/")[0]}
          </ThemedText>
        </View>
        <Button onPress={handleBookNow} style={styles.bookButton}>
          Book Now
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    height: 300,
    position: "relative",
  },
  portfolioImage: {
    width: SCREEN_WIDTH,
    height: 300,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pagination: {
    position: "absolute",
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.lg,
  },
  headerInfo: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  statNumber: {
    marginLeft: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  priceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  availabilityInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  footerPrice: {},
  bookButton: {
    flex: 1,
    marginLeft: Spacing.xl,
  },
});

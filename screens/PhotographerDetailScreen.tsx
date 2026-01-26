import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView, Dimensions, Alert, Platform } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import api from "@/services/api";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
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
  const { isAuthenticated, user, getToken } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const insets = useSafeAreaInsets();
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [isStartingChat, setIsStartingChat] = useState(false);
  
  // Detect if viewing own profile - compare current user's auth ID with photographer's auth userId
  // Must compare user-to-user, not user-to-entity
  const photographerAuthUserId = (photographer as any).userId || (photographer as any).ownerId;
  const isOwner = Boolean(user?.id && photographerAuthUserId && photographerAuthUserId === user.id);

  const allPortfolioPhotos = [...photographer.portfolio, ...additionalPhotos];
  const isPhotographerSaved = isFavorite(photographer.id, "photographer");

  const handleSavePhotographer = () => {
    toggleFavorite({
      id: photographer.id,
      type: "photographer",
      name: photographer.name,
      image: photographer.avatar,
      subtitle: `${CATEGORY_LABELS[photographer.specialty]} Photographer`,
    });
  };

  const handleMessage = async () => {
    if (isStartingChat) return;
    
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    
    // CRITICAL: Messaging is user-to-user, not entity-to-entity
    // Must use the profile owner's auth userId, never the photographer profile ID
    const profileData = photographer as any;
    const authUserId = profileData.userId || profileData.ownerId;
    const senderId = user?.id;
    
    // Dev logging for ID mapping debugging
    if (__DEV__) {
      console.log("[PhotographerDetail] handleMessage - senderId:", senderId, "recipientId (authUserId):", authUserId);
      if (!authUserId) {
        console.warn("[PhotographerDetail] WARNING: No userId/ownerId found, messaging may fail. Photographer ID:", photographer.id);
      } else if (authUserId === photographer.id) {
        console.warn("[PhotographerDetail] WARNING: userId matches profile ID - verify this is the auth user ID, not entity ID");
      }
    }
    
    // Block messaging if no valid auth userId found
    if (!authUserId) {
      Alert.alert("Unable to Message", "This photographer's profile is not set up for messaging.");
      return;
    }
    
    const participantUserId = authUserId;
    
    // Frontend guard: Block self-messaging
    if (senderId && (participantUserId === senderId)) {
      Alert.alert("Cannot Message", "You cannot send a message to yourself.");
      return;
    }
    
    try {
      setIsStartingChat(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const authToken = await getToken();
      const conversation = await api.createOrGetConversation({
        participantId: participantUserId,
        participantType: "photographer",
        participantName: photographer.name,
        participantAvatar: photographer.avatar,
      }, authToken);
      
      navigation.navigate("Chat", {
        conversationId: conversation.id,
        participantId: participantUserId,
        participantName: photographer.name,
        participantAvatar: photographer.avatar,
        participantType: "photographer",
      });
    } catch (error) {
      console.error("Failed to create conversation:", error);
      Alert.alert(
        "Message Failed",
        "Unable to start a conversation right now. Please try again later."
      );
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleAddPhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Run in Expo Go", "Use Expo Go on your mobile device to access the camera and photo library.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please enable photo library access in settings.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map((asset) => asset.uri);
      setAdditionalPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Run in Expo Go", "Use Expo Go on your mobile device to access the camera.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please enable camera access in settings.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets) {
      const newPhoto = result.assets[0].uri;
      setAdditionalPhotos((prev) => [...prev, newPhoto]);
    }
  };

  const handleBookNow = () => {
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
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
          <View style={styles.overlayRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: "rgba(0,0,0,0.3)", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={handleSavePhotographer}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: "rgba(0,0,0,0.3)", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather
                name="bookmark"
                size={24}
                color={isPhotographerSaved ? theme.primary : "#FFFFFF"}
              />
            </Pressable>
          </View>
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

        <View style={styles.section}>
          <View style={styles.portfolioHeader}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Portfolio Gallery
            </ThemedText>
            <View style={styles.uploadButtons}>
              <Pressable
                onPress={handleAddPhoto}
                style={({ pressed }) => [
                  styles.uploadButton,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="image" size={16} color={theme.primary} />
              </Pressable>
              <Pressable
                onPress={handleTakePhoto}
                style={({ pressed }) => [
                  styles.uploadButton,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1, marginLeft: Spacing.sm },
                ]}
              >
                <Feather name="camera" size={16} color={theme.primary} />
              </Pressable>
            </View>
          </View>
          <View style={styles.portfolioGrid}>
            {allPortfolioPhotos.map((photo, index) => (
              <Pressable key={index} style={styles.portfolioGridItem}>
                <Image
                  source={{ uri: photo }}
                  style={styles.portfolioGridImage}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            ))}
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
        {!isOwner && (
          <Pressable
            onPress={handleMessage}
            disabled={isStartingChat}
            style={({ pressed }) => [
              styles.messageButton,
              { backgroundColor: theme.backgroundDefault, opacity: pressed || isStartingChat ? 0.8 : 1 },
            ]}
          >
            <Feather name="message-circle" size={24} color={theme.primary} />
          </Pressable>
        )}
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
  overlayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  messageButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrice: {
    marginLeft: Spacing.md,
  },
  bookButton: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  portfolioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  uploadButtons: {
    flexDirection: "row",
  },
  uploadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  portfolioGridItem: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.xs * 4) / 3,
    aspectRatio: 1,
    margin: Spacing.xs,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  portfolioGridImage: {
    width: "100%",
    height: "100%",
  },
});

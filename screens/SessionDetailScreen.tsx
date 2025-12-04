import React from "react";
import { StyleSheet, View, Pressable, Alert, Linking, Platform, ScrollView, FlatList, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { CATEGORY_LABELS, Session, SessionPhoto } from "@/types";
import { RootStackParamList } from "@/navigation/types";

const PHOTO_THUMBNAIL_SIZE = (Dimensions.get("window").width - Spacing.lg * 2 - Spacing.sm * 2) / 3;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "SessionDetail">;

export default function SessionDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { sessionId } = route.params;
  const { sessions, cancelSession, getPhotographer } = useData();
  const insets = useSafeAreaInsets();

  const session = sessions.find(s => s.id === sessionId);
  const photographer = session ? getPhotographer(session.photographerId) : null;

  if (!session) {
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
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={styles.emptyTitle}>
            Session not found
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (startTime: string, endTime: string) => {
    const formatTimeStr = (time: string) => {
      const [hours, minutes] = time.split(":");
      const h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };
    return `${formatTimeStr(startTime)} - ${formatTimeStr(endTime)}`;
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "confirmed":
        return theme.success;
      case "pending":
        return theme.warning;
      case "completed":
        return theme.info;
      case "cancelled":
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const handleCancelSession = () => {
    Alert.alert(
      "Cancel Session",
      "Are you sure you want to cancel this session? This action cannot be undone.",
      [
        { text: "Keep Session", style: "cancel" },
        {
          text: "Cancel Session",
          style: "destructive",
          onPress: async () => {
            await cancelSession(session.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleOpenMaps = () => {
    const address = encodeURIComponent(session.location);
    const url = Platform.select({
      ios: `maps:?q=${address}`,
      android: `geo:0,0?q=${address}`,
      default: `https://maps.google.com/?q=${address}`,
    });
    
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open maps");
    });
  };

  const isUpcoming = () => {
    const sessionDate = new Date(session.date + "T" + session.startTime);
    return sessionDate > new Date() && session.status !== "cancelled";
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
        <ThemedText type="h4">Session Details</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: getStatusColor(session.status) + "20" },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(session.status) },
            ]}
          />
          <ThemedText
            type="button"
            style={{ color: getStatusColor(session.status) }}
          >
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </ThemedText>
        </View>

        <View style={styles.photographerSection}>
          <Image
            source={{ uri: session.photographerAvatar }}
            style={styles.photographerAvatar}
            contentFit="cover"
          />
          <View style={styles.photographerInfo}>
            <ThemedText type="h3">{session.photographerName}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {CATEGORY_LABELS[session.sessionType]} Photographer
            </ThemedText>
          </View>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="calendar" size={20} color={theme.primary} />
            </View>
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Date
              </ThemedText>
              <ThemedText type="body">{formatDate(session.date)}</ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="clock" size={20} color={theme.primary} />
            </View>
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Time
              </ThemedText>
              <ThemedText type="body">
                {formatTime(session.startTime, session.endTime)}
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={handleOpenMaps}
            style={({ pressed }) => [
              styles.detailRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.detailIcon}>
              <Feather name="map-pin" size={20} color={theme.primary} />
            </View>
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Location
              </ThemedText>
              <ThemedText type="body">{session.location}</ThemedText>
            </View>
            <Feather name="external-link" size={18} color={theme.textSecondary} />
          </Pressable>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="camera" size={20} color={theme.primary} />
            </View>
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Session Type
              </ThemedText>
              <ThemedText type="body">
                {CATEGORY_LABELS[session.sessionType]}
              </ThemedText>
            </View>
          </View>
        </View>

        {session.notes ? (
          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Notes
            </ThemedText>
            <View style={[styles.notesCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {session.notes}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {session.photos && session.photos.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Photos
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {session.photos.length} photos
              </ThemedText>
            </View>
            <View style={styles.photoGrid}>
              {session.photos.slice(0, 6).map((photo, index) => (
                <Pressable
                  key={photo.id}
                  onPress={() => navigation.navigate("PhotoGallery", { sessionId: session.id, initialIndex: index })}
                  style={({ pressed }) => [
                    styles.photoThumbnail,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Image
                    source={{ uri: photo.thumbnailUrl }}
                    style={styles.thumbnailImage}
                    contentFit="cover"
                    transition={200}
                  />
                  {index === 5 && session.photos && session.photos.length > 6 ? (
                    <View style={styles.morePhotosOverlay}>
                      <ThemedText type="h4" style={styles.morePhotosText}>
                        +{session.photos.length - 6}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => navigation.navigate("PhotoGallery", { sessionId: session.id })}
              style={({ pressed }) => [
                styles.viewAllButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="image" size={18} color={theme.primary} />
              <ThemedText type="button" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
                View All Photos
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Payment
          </ThemedText>
          <View style={[styles.paymentCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.paymentRow}>
              <ThemedText type="body">Session Fee</ThemedText>
              <ThemedText type="body">${session.totalPrice}</ThemedText>
            </View>
            <View style={[styles.paymentDivider, { backgroundColor: theme.border }]} />
            <View style={styles.paymentRow}>
              <ThemedText type="h4">Total</ThemedText>
              <ThemedText type="h4" style={{ color: theme.primary }}>
                ${session.totalPrice}
              </ThemedText>
            </View>
          </View>
        </View>

        {isUpcoming() ? (
          <View style={styles.actionsSection}>
            <Pressable
              onPress={handleCancelSession}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  backgroundColor: theme.error + "15",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="x-circle" size={20} color={theme.error} />
              <ThemedText
                type="button"
                style={{ color: theme.error, marginLeft: Spacing.sm }}
              >
                Cancel Session
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: Spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  photographerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  photographerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.lg,
  },
  photographerInfo: {
    flex: 1,
  },
  detailsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  notesCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  paymentCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  actionsSection: {
    marginBottom: Spacing.xl,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  bottomPadding: {
    height: Spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  photoThumbnail: {
    width: PHOTO_THUMBNAIL_SIZE,
    height: PHOTO_THUMBNAIL_SIZE,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  morePhotosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  morePhotosText: {
    color: "#FFFFFF",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});

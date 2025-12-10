import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, View, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Session } from "@/context/DataContext";
import { CATEGORY_LABELS, PhotographyCategory } from "@/types";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = "upcoming" | "past";

interface Order {
  id: string;
  vendorName: string;
  status: "processing" | "shipped" | "delivered";
  itemCount: number;
  expectedDate?: string;
}

const MOCK_ACTIVE_ORDERS: Order[] = [
  { id: "o1", vendorName: "FrameArt Gallery", status: "shipped", itemCount: 3, expectedDate: "Jan 15" },
  { id: "o2", vendorName: "PhotoGear Pro", status: "processing", itemCount: 1 },
  { id: "o3", vendorName: "PrintMaster Studio", status: "shipped", itemCount: 1, expectedDate: "Jan 18" },
];

export default function SessionsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { getUpcomingSessions, getPastSessions, refreshSessions, isLoading } = useData();
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string>("");

  const upcomingSessions = getUpcomingSessions();
  const pastSessions = getPastSessions();
  const displayedSessions = filter === "upcoming" ? upcomingSessions : pastSessions;
  const nextSession = upcomingSessions[0];

  useEffect(() => {
    if (!nextSession) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const sessionDate = new Date(nextSession.date + "T" + nextSession.time);
      const now = new Date();
      const diff = sessionDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown("Starting now!");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        setCountdown(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextSession]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshSessions();
    setRefreshing(false);
  }, [refreshSessions]);

  const handleSessionPress = (session: Session) => {
    navigation.navigate("SessionDetail", { sessionId: session.id });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
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
      case "upcoming":
        return theme.success;
      case "completed":
        return "#007AFF";
      case "cancelled":
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const renderSessionCard = (session: Session) => (
    <Pressable
      key={session.id}
      onPress={() => handleSessionPress(session)}
      style={({ pressed }) => [
        styles.sessionCard,
        {
          backgroundColor: theme.backgroundDefault,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Image
        source={{ uri: session.photographerAvatar }}
        style={styles.photographerAvatar}
        contentFit="cover"
      />
      <View style={styles.sessionInfo}>
        <View style={styles.sessionHeader}>
          <ThemedText type="h4" numberOfLines={1} style={styles.photographerName}>
            {session.photographerName}
          </ThemedText>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(session.status) + "20" },
            ]}
          >
            <ThemedText
              type="caption"
              style={{ color: getStatusColor(session.status) }}
            >
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {CATEGORY_LABELS[session.sessionType as PhotographyCategory] || session.sessionType}
        </ThemedText>
        <View style={styles.sessionMeta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {formatDate(session.date)}
            </ThemedText>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {session.time}
            </ThemedText>
          </View>
        </View>
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText
            type="caption"
            numberOfLines={1}
            style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}
          >
            {session.location}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

  if (!isAuthenticated) {
    return (
      <ScreenScrollView contentContainerStyle={styles.centeredContent}>
        <View style={styles.emptyState}>
          <Feather name="lock" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.emptyTitle}>
            Sign in to view sessions
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Create an account or sign in to book and manage your photography sessions
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {nextSession && filter === "upcoming" ? (
        <View style={[styles.countdownCard, { backgroundColor: theme.primary }]}>
          <View style={styles.countdownHeader}>
            <ThemedText type="small" style={styles.countdownLabel}>
              Next Session
            </ThemedText>
            <ThemedText type="h2" style={styles.countdownValue}>
              {countdown}
            </ThemedText>
          </View>
          <View style={styles.countdownInfo}>
            <ThemedText type="h4" style={styles.countdownText}>
              {nextSession.photographerName}
            </ThemedText>
            <ThemedText type="small" style={styles.countdownTextOpacity}>
              {formatDate(nextSession.date)} at {nextSession.time}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Active Orders Section */}
      {filter === "upcoming" && MOCK_ACTIVE_ORDERS.length > 0 ? (
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeader}>
            <Feather name="package" size={18} color={theme.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Orders In Progress
            </ThemedText>
          </View>
          {MOCK_ACTIVE_ORDERS.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => navigation.navigate("CartOrders")}
              style={({ pressed }) => [
                styles.orderCard,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.orderIcon, { backgroundColor: order.status === "shipped" ? "#007AFF20" : "#FF950020" }]}>
                <Feather
                  name={order.status === "shipped" ? "truck" : "clock"}
                  size={18}
                  color={order.status === "shipped" ? "#007AFF" : "#FF9500"}
                />
              </View>
              <View style={styles.orderInfo}>
                <ThemedText type="body" numberOfLines={1}>
                  {order.vendorName}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {order.itemCount} item{order.itemCount > 1 ? "s" : ""} - {order.status === "shipped" ? `Arrives ${order.expectedDate}` : "Processing"}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.filterContainer}>
        <Pressable
          onPress={() => setFilter("upcoming")}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: filter === "upcoming" ? theme.primary : theme.backgroundDefault,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText
            type="button"
            style={{ color: filter === "upcoming" ? "#FFFFFF" : theme.text }}
          >
            Upcoming
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFilter("past")}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: filter === "past" ? theme.primary : theme.backgroundDefault,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText
            type="button"
            style={{ color: filter === "past" ? "#FFFFFF" : theme.text }}
          >
            Past
          </ThemedText>
        </Pressable>
      </View>

      {displayedSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather
            name={filter === "upcoming" ? "calendar" : "archive"}
            size={48}
            color={theme.textSecondary}
          />
          <ThemedText type="h4" style={styles.emptyTitle}>
            No {filter} sessions
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {filter === "upcoming"
              ? "Book a photographer to get started"
              : "Your completed sessions will appear here"}
          </ThemedText>
        </View>
      ) : (
        displayedSessions.map(renderSessionCard)
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  countdownCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  countdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  countdownLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countdownValue: {
    color: "#FFFFFF",
  },
  countdownInfo: {},
  countdownText: {
    color: "#FFFFFF",
  },
  countdownTextOpacity: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: Spacing.xl,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  sessionCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  photographerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.md,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  photographerName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  sessionMeta: {
    flexDirection: "row",
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  ordersSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  orderInfo: {
    flex: 1,
  },
});

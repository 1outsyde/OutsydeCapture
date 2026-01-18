import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import Card from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications, Notification } from "@/context/NotificationContext";
import { Spacing, FontSizes, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {
    isEnabled,
    notifications,
    unreadCount,
    enableNotifications,
    disableNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const success = await enableNotifications();
      if (!success && Platform.OS !== "web") {
        console.log("Failed to enable notifications");
      }
    } else {
      disableNotifications();
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.metadata?.sessionId) {
      navigation.navigate("SessionDetail", {
        sessionId: notification.metadata.sessionId as string,
      });
    }
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const getNotificationIcon = (
    type: Notification["type"]
  ): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "booking":
        return "check-circle";
      case "reminder":
        return "clock";
      case "promotion":
        return "tag";
      case "admin":
        return "shield";
      case "follow":
        return "user-plus";
      case "system":
      default:
        return "bell";
    }
  };

  const styles = StyleSheet.create({
    container: {
      padding: Spacing.md,
      gap: Spacing.lg,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      marginBottom: Spacing.xs,
    },
    settingCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: Spacing.md,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      flex: 1,
    },
    settingIconContainer: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primaryTransparent,
      alignItems: "center",
      justifyContent: "center",
    },
    settingContent: {
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.xs,
    },
    actionButtons: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    actionButton: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: BorderRadius.sm,
    },
    actionButtonText: {
      fontSize: FontSizes.xs,
    },
    notificationList: {
      gap: Spacing.sm,
    },
    notificationCard: {
      padding: Spacing.md,
    },
    notificationPressable: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    notificationIconContainer: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.round,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationContent: {
      flex: 1,
    },
    notificationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: Spacing.xxs,
    },
    notificationTitle: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    notificationTime: {
      fontSize: FontSizes.xs,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
      marginLeft: Spacing.xs,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.xxl,
      gap: Spacing.md,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: BorderRadius.round,
      backgroundColor: theme.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    webNotice: {
      padding: Spacing.md,
      backgroundColor: theme.warningBackground,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
  });

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Settings
        </ThemedText>
        <Card style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconContainer}>
              <Feather name="bell" size={20} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="bodyBold">Push Notifications</ThemedText>
              <ThemedText type="caption" color="secondary">
                {Platform.OS === "web"
                  ? "In-app notifications only"
                  : isEnabled
                    ? "Receive booking reminders"
                    : "Enable to receive reminders"}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{
              false: theme.surfaceSecondary,
              true: theme.primaryLight,
            }}
            thumbColor={isEnabled ? theme.primary : theme.textSecondary}
          />
        </Card>

        {Platform.OS === "web" ? (
          <ThemedView style={styles.webNotice}>
            <ThemedText type="caption" color="secondary">
              Push notifications are not available on web. Use Expo Go on your
              mobile device to receive push notifications.
            </ThemedText>
          </ThemedView>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.headerRow}>
          <ThemedText type="subtitle">
            Notifications{" "}
            {unreadCount > 0 ? (
              <ThemedText type="body" color="secondary">
                ({unreadCount} unread)
              </ThemedText>
            ) : null}
          </ThemedText>
          {notifications.length > 0 ? (
            <View style={styles.actionButtons}>
              {unreadCount > 0 ? (
                <Pressable
                  style={styles.actionButton}
                  onPress={markAllAsRead}
                >
                  <ThemedText
                    type="caption"
                    color="primary"
                    style={styles.actionButtonText}
                  >
                    Mark all read
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.actionButton}
                onPress={clearNotifications}
              >
                <ThemedText type="caption" style={styles.actionButtonText}>
                  Clear all
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>

        {notifications.length === 0 ? (
          <Card>
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="bell-off" size={32} color={theme.textSecondary} />
              </View>
              <ThemedText type="body" color="secondary">
                No notifications yet
              </ThemedText>
              <ThemedText
                type="caption"
                color="secondary"
                style={{ textAlign: "center" }}
              >
                {isEnabled
                  ? "You'll receive notifications about your upcoming sessions here"
                  : "Enable notifications to receive booking reminders"}
              </ThemedText>
            </View>
          </Card>
        ) : (
          <View style={styles.notificationList}>
            {notifications.map((notification) => (
              <Card key={notification.id} style={styles.notificationCard}>
                <Pressable
                  style={styles.notificationPressable}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View
                    style={[
                      styles.notificationIconContainer,
                      {
                        backgroundColor: notification.read
                          ? theme.surfaceSecondary
                          : theme.primaryTransparent,
                      },
                    ]}
                  >
                    <Feather
                      name={getNotificationIcon(notification.type)}
                      size={20}
                      color={
                        notification.read ? theme.textSecondary : theme.primary
                      }
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <ThemedText
                        type={notification.read ? "body" : "bodyBold"}
                        style={styles.notificationTitle}
                        numberOfLines={1}
                      >
                        {notification.title}
                      </ThemedText>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <ThemedText
                          type="caption"
                          color="secondary"
                          style={styles.notificationTime}
                        >
                          {formatTimestamp(new Date(notification.date))}
                        </ThemedText>
                        {!notification.read ? (
                          <View style={styles.unreadDot} />
                        ) : null}
                      </View>
                    </View>
                    <ThemedText
                      type="caption"
                      color="secondary"
                      numberOfLines={2}
                    >
                      {notification.body}
                    </ThemedText>
                  </View>
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScreenScrollView>
  );
}

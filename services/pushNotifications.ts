import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") {
    console.log("[PushNotifications] Push notifications not available on web");
    return null;
  }

  if (!Device.isDevice) {
    console.log("[PushNotifications] Must use physical device for push notifications");
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[PushNotifications] Permission not granted");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.log("[PushNotifications] No project ID found");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("[PushNotifications] Push token:", token);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#D4A752",
      });
    }

    return token;
  } catch (error) {
    console.error("[PushNotifications] Error registering:", error);
    return null;
  }
}

export async function scheduleBookingConfirmationNotification(
  photographerName: string,
  date: string,
  time: string
): Promise<string | null> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Booking Confirmed!",
        body: `Your session with ${photographerName} on ${date} at ${time} is confirmed.`,
        data: { type: "booking_confirmation" },
        sound: true,
      },
      trigger: null,
    });
    console.log("[PushNotifications] Booking confirmation scheduled:", identifier);
    return identifier;
  } catch (error) {
    console.error("[PushNotifications] Failed to schedule booking confirmation:", error);
    return null;
  }
}

export async function scheduleBookingReminderNotification(
  photographerName: string,
  date: string,
  time: string,
  sessionDate: Date,
  reminderType: "24h" | "1h"
): Promise<string | null> {
  try {
    const now = new Date();
    let triggerDate: Date;

    if (reminderType === "24h") {
      triggerDate = new Date(sessionDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      triggerDate = new Date(sessionDate.getTime() - 60 * 60 * 1000);
    }

    if (triggerDate <= now) {
      console.log("[PushNotifications] Reminder time has passed, skipping");
      return null;
    }

    const reminderText = reminderType === "24h" 
      ? "tomorrow" 
      : "in 1 hour";

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Session Reminder`,
        body: `Your session with ${photographerName} is ${reminderText} at ${time}.`,
        data: { type: "booking_reminder", reminderType },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    console.log(`[PushNotifications] ${reminderType} reminder scheduled for:`, triggerDate);
    return identifier;
  } catch (error) {
    console.error("[PushNotifications] Failed to schedule reminder:", error);
    return null;
  }
}

export async function cancelScheduledNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log("[PushNotifications] Cancelled notification:", identifier);
  } catch (error) {
    console.error("[PushNotifications] Failed to cancel notification:", error);
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("[PushNotifications] Cancelled all scheduled notifications");
  } catch (error) {
    console.error("[PushNotifications] Failed to cancel all notifications:", error);
  }
}

export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log("[PushNotifications] Scheduled notifications:", scheduled.length);
    return scheduled;
  } catch (error) {
    console.error("[PushNotifications] Failed to get scheduled notifications:", error);
    return [];
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string | null> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null,
    });
    return identifier;
  } catch (error) {
    console.error("[PushNotifications] Failed to send local notification:", error);
    return null;
  }
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("[PushNotifications] Failed to set badge count:", error);
  }
}

export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error("[PushNotifications] Failed to get badge count:", error);
    return 0;
  }
}

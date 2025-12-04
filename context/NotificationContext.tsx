import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useData, Session } from "@/context/DataContext";

const NOTIFICATIONS_ENABLED_KEY = "@outsyde_notifications_enabled";
const NOTIFICATION_HISTORY_KEY = "@outsyde_notification_history";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: "booking_confirmation" | "booking_reminder" | "session_update" | "message";
  data?: Record<string, unknown>;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  isEnabled: boolean;
  expoPushToken: string | null;
  notifications: AppNotification[];
  unreadCount: number;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => void;
  scheduleBookingConfirmation: (session: Session) => Promise<void>;
  scheduleSessionReminder: (session: Session, reminderDate: Date) => Promise<void>;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { sessions } = useData();
  const [isEnabled, setIsEnabled] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    loadNotificationSettings();
    loadNotificationHistory();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const newNotification: AppNotification = {
          id: notification.request.identifier,
          title: notification.request.content.title || "",
          body: notification.request.content.body || "",
          type: (notification.request.content.data?.type as AppNotification["type"]) || "session_update",
          data: notification.request.content.data as Record<string, unknown> | undefined,
          timestamp: new Date(),
          read: false,
        };
        addNotification(newNotification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const notificationId = response.notification.request.identifier;
        markAsRead(notificationId);
      });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user && isEnabled) {
      scheduleUpcomingSessionReminders();
    }
  }, [user, sessions, isEnabled]);

  const loadNotificationSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      if (enabled === "true") {
        const token = await registerForPushNotifications();
        if (token) {
          setIsEnabled(true);
          setExpoPushToken(token);
        }
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  };

  const loadNotificationHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
      if (history) {
        const parsed = JSON.parse(history);
        setNotifications(
          parsed.map((n: AppNotification) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to load notification history:", error);
    }
  };

  const saveNotificationHistory = async (
    notificationList: AppNotification[]
  ) => {
    try {
      await AsyncStorage.setItem(
        NOTIFICATION_HISTORY_KEY,
        JSON.stringify(notificationList)
      );
    } catch (error) {
      console.error("Failed to save notification history:", error);
    }
  };

  const addNotification = (notification: AppNotification) => {
    setNotifications((prev) => {
      const updated = [notification, ...prev].slice(0, 50);
      saveNotificationHistory(updated);
      return updated;
    });
  };

  const registerForPushNotifications = async (): Promise<string | null> => {
    if (Platform.OS === "web") {
      return null;
    }

    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return null;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF9500",
        });
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: "outsyde-photography",
      });
      return tokenResponse.data;
    } catch (error) {
      console.error("Failed to register for push notifications:", error);
      return null;
    }
  };

  const enableNotifications = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setIsEnabled(true);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
      return true;
    }

    const token = await registerForPushNotifications();
    if (token) {
      setIsEnabled(true);
      setExpoPushToken(token);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
      return true;
    }
    return false;
  };

  const disableNotifications = async () => {
    setIsEnabled(false);
    setExpoPushToken(null);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const scheduleBookingConfirmation = async (session: Session) => {
    const title = "Booking Confirmed!";
    const body = `Your session with ${session.photographerName} on ${formatDate(session.date)} at ${session.time} is confirmed.`;

    const notification: AppNotification = {
      id: `booking-${session.id}`,
      title,
      body,
      type: "booking_confirmation",
      data: { sessionId: session.id },
      timestamp: new Date(),
      read: false,
    };
    addNotification(notification);

    if (Platform.OS !== "web" && isEnabled) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "booking_confirmation", sessionId: session.id },
        },
        trigger: null,
      });
    }
  };

  const scheduleSessionReminder = async (
    session: Session,
    reminderDate: Date
  ) => {
    if (Platform.OS === "web") {
      return;
    }

    const now = new Date();
    if (reminderDate <= now) {
      return;
    }

    const title = "Session Reminder";
    const body = `Your photo session with ${session.photographerName} is coming up ${getTimeUntil(session.date, session.time)}!`;

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${session.id}`,
      content: {
        title,
        body,
        data: { type: "booking_reminder", sessionId: session.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
  };

  const scheduleUpcomingSessionReminders = useCallback(async () => {
    if (Platform.OS === "web" || !isEnabled) {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const upcomingSessions = sessions.filter((s) => {
      if (s.status !== "upcoming" && s.status !== "confirmed") return false;
      const sessionDate = new Date(`${s.date}T${s.time}`);
      return sessionDate > now;
    });

    for (const session of upcomingSessions) {
      const sessionDate = new Date(`${session.date}T${session.time}`);

      const oneDayBefore = new Date(sessionDate);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);
      if (oneDayBefore > now) {
        await scheduleSessionReminder(session, oneDayBefore);
      }

      const oneHourBefore = new Date(sessionDate);
      oneHourBefore.setHours(oneHourBefore.getHours() - 1);
      if (oneHourBefore > now) {
        await scheduleSessionReminder(session, oneHourBefore);
      }
    }
  }, [sessions, isEnabled]);

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      saveNotificationHistory(updated);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotificationHistory(updated);
      return updated;
    });
  };

  const clearNotifications = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getTimeUntil = (dateStr: string, timeStr: string): string => {
    const sessionDate = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    const diffMs = sessionDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      return `in ${diffDays} days`;
    } else if (diffDays === 1) {
      return "tomorrow";
    } else if (diffHours > 1) {
      return `in ${diffHours} hours`;
    } else {
      return "soon";
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        isEnabled,
        expoPushToken,
        notifications,
        unreadCount,
        enableNotifications,
        disableNotifications,
        scheduleBookingConfirmation,
        scheduleSessionReminder,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}

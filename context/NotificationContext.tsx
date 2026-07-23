import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { useAuth } from "./AuthContext";
import api from "@/services/api";
import { apiPost } from "@/api/client";
import {
  registerForPushNotificationsAsync,
  scheduleBookingConfirmationNotification,
  scheduleBookingReminderNotification,
  sendLocalNotification,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  setBadgeCount,
} from "@/services/pushNotifications";

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "booking" | "reminder" | "promotion" | "system" | "admin" | "follow" | "business_pending" | "new_vendor_application" | "vendor_approved" | "vendor_rejected"
    | "booking_confirmed" | "payment_succeeded" | "payment_failed" | "subscription_activated" | "subscription_canceled" | "addon_charged" | "refund_issued" | "new_order" | "order_shipped" | "photographer_assigned" | "subscription_tier_changed" | "stripe_onboarding_complete" | "new_photographer_application" | "new_follower";
  date: string;
  read: boolean;
  metadata?: Record<string, string>;
}

interface NotificationSettings {
  bookingConfirmations: boolean;
  sessionReminders: boolean;
  promotions: boolean;
  messages: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  settings: NotificationSettings;
  unreadCount: number;
  isEnabled: boolean;
  pendingBusinessCount: number;
  pushToken: string | null;
  addNotification: (notification: Omit<Notification, "id" | "date" | "read">) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  clearNotifications: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => void;
  refreshAdminNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  sendBookingConfirmation: (photographerName: string, date: string, time: string) => Promise<void>;
  scheduleBookingReminders: (photographerName: string, date: string, time: string, sessionDate: Date) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const getNotificationsKey = (userId: string) => `@outsyde_notifications_${userId}`;
const getSettingsKey = (userId: string) => `@outsyde_notification_settings_${userId}`;
const getEnabledKey = (userId: string) => `@outsyde_notifications_enabled_${userId}`;
const getSeenBusinessesKey = (userId: string) => `@outsyde_seen_businesses_${userId}`;

const DEFAULT_SETTINGS: NotificationSettings = {
  bookingConfirmations: true,
  sessionReminders: true,
  promotions: false,
  messages: true,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getToken } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isEnabled, setIsEnabled] = useState(true);
  const [pendingBusinessCount, setPendingBusinessCount] = useState(0);
  const [seenBusinessIds, setSeenBusinessIds] = useState<string[]>([]);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationListenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadNotificationData();
      initializePushNotifications();
      if (user.isAdmin) {
        startAdminPolling();
      }
      startUserPolling();
    } else {
      setNotifications([]);
      setSettings(DEFAULT_SETTINGS);
      setIsEnabled(true);
      setPendingBusinessCount(0);
      setPushToken(null);
      stopAdminPolling();
      stopUserPolling();
    }
    return () => {
      stopAdminPolling();
      stopUserPolling();
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
    };
  }, [isAuthenticated, user]);

  const initializePushNotifications = async () => {
    if (Platform.OS === "web") return;
    
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setPushToken(token);
        console.log("[NotificationContext] Push token obtained:", token);
        // Register token with backend so push notifications can be delivered
        try {
          const authToken = await getToken();
          if (authToken) {
            await apiPost("/api/push/expo-token", { expoPushToken: token }, authToken);
          }
        } catch (err) {
          console.warn("[Push] Failed to register token with backend:", err);
        }
      }

      notificationListenerRef.current = addNotificationReceivedListener(notification => {
        console.log("[NotificationContext] Notification received:", notification);
        const { title, body, data } = notification.request.content;
        if (title && body) {
          addNotification({
            title,
            body,
            type: (data?.type as any) || "system",
            metadata: data as Record<string, string>,
          });
        }
      });

      responseListenerRef.current = addNotificationResponseReceivedListener(response => {
        console.log("[NotificationContext] Notification response:", response);
      });
    } catch (error) {
      console.error("[NotificationContext] Failed to initialize push notifications:", error);
    }
  };

  const loadNotificationData = async () => {
    if (!user) return;
    try {
      const [storedNotifications, storedSettings, storedEnabled, storedSeenBusinesses] = await Promise.all([
        AsyncStorage.getItem(getNotificationsKey(user.id)),
        AsyncStorage.getItem(getSettingsKey(user.id)),
        AsyncStorage.getItem(getEnabledKey(user.id)),
        AsyncStorage.getItem(getSeenBusinessesKey(user.id)),
      ]);
      if (storedNotifications) setNotifications(JSON.parse(storedNotifications));
      if (storedSettings) setSettings(JSON.parse(storedSettings));
      if (storedEnabled !== null) setIsEnabled(storedEnabled === "true");
      if (storedSeenBusinesses) setSeenBusinessIds(JSON.parse(storedSeenBusinesses));
    } catch (err) {
      console.error("Failed to load notification data:", err);
    }
  };

  const startAdminPolling = () => {
    stopAdminPolling();
    fetchAdminNotifications();
    pollingRef.current = setInterval(() => {
      fetchAdminNotifications();
    }, 30000);
  };

  const stopAdminPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const fetchAdminNotifications = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      const token = await getToken();
      if (!token) return;

      const [serverNotifications, pendingBusinesses] = await Promise.all([
        api.getNotifications(token),
        api.getAdminBusinesses(token, "pending"),
      ]);

      const pendingCount = Array.isArray(pendingBusinesses) ? pendingBusinesses.length : 0;
      setPendingBusinessCount(pendingCount);

      const vendorNotifications = serverNotifications.filter(
        n => n.type === "new_vendor_application" || n.type === "business_pending"
      );

      const newNotifications: Notification[] = vendorNotifications
        .filter(n => !seenBusinessIds.includes(n.businessId || n.id))
        .map(n => ({
          id: n.id,
          title: n.title || "New Business Application",
          body: n.body || n.message || `${n.businessName || "A business"} is pending approval`,
          type: "business_pending" as const,
          date: n.createdAt || new Date().toISOString(),
          read: n.read || false,
          metadata: n.businessId ? { businessId: n.businessId } : undefined,
        }));

      if (newNotifications.length > 0) {
        const existingIds = new Set(notifications.map(n => n.id));
        const uniqueNewNotifications = newNotifications.filter(n => !existingIds.has(n.id));
        
        if (uniqueNewNotifications.length > 0) {
          const updated = [...uniqueNewNotifications, ...notifications];
          await AsyncStorage.setItem(getNotificationsKey(user.id), JSON.stringify(updated));
          setNotifications(updated);

          const newSeenIds = [...seenBusinessIds, ...newNotifications.map(n => n.metadata?.businessId || n.id)];
          await AsyncStorage.setItem(getSeenBusinessesKey(user.id), JSON.stringify(newSeenIds));
          setSeenBusinessIds(newSeenIds);
        }
      }
    } catch (error) {
      console.log("Failed to fetch admin notifications (non-critical):", error);
    }
  }, [user, getToken, seenBusinessIds, notifications]);

  const refreshAdminNotifications = async () => {
    await fetchAdminNotifications();
  };

  const stringifyFlat = (metadata?: Record<string, any>): Record<string, string> => {
    if (!metadata) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }
    return result;
  };

  const normalizeServerNotification = (raw: {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, any>;
    createdAt: string;
  }): Notification => ({
    id: raw.id,
    title: raw.title,
    body: raw.message,
    type: raw.type as Notification["type"],
    date: raw.createdAt,
    read: raw.isRead,
    metadata: {
      ...(raw.referenceType ? { referenceType: raw.referenceType } : {}),
      ...(raw.referenceId ? { referenceId: raw.referenceId } : {}),
      ...stringifyFlat(raw.metadata),
    },
  });

  const startUserPolling = () => {
    stopUserPolling();
    fetchUserNotifications();
    userPollingRef.current = setInterval(() => {
      fetchUserNotifications();
    }, 30000);
  };

  const stopUserPolling = () => {
    if (userPollingRef.current) {
      clearInterval(userPollingRef.current);
      userPollingRef.current = null;
    }
  };

  const fetchUserNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;

      const { notifications: raw } = await api.getUserNotifications(token);
      const server = raw.map(normalizeServerNotification);

      const readById = new Map(notifications.map(n => [n.id, n.read]));
      const local = notifications.filter(n => n.id.startsWith("notif_"));
      const merged = [
        ...local,
        ...server.map(n => (readById.get(n.id) === true ? { ...n, read: true } : n)),
      ];

      setNotifications(merged);
      await AsyncStorage.setItem(getNotificationsKey(user.id), JSON.stringify(merged));
    } catch (error) {
      console.log("Failed to fetch user notifications (non-critical):", error);
    }
  }, [user, getToken, notifications]);

  const refreshNotifications = async () => {
    await fetchUserNotifications();
  };

  const addNotification = async (notification: Omit<Notification, "id" | "date" | "read">) => {
    if (!user) return;
    const newNotification: Notification = {
      ...notification,
      id: "notif_" + Date.now(),
      date: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotification, ...notifications];
    await AsyncStorage.setItem(getNotificationsKey(user.id), JSON.stringify(updated));
    setNotifications(updated);
  };

  const markAsRead = async (id: string) => {
    if (!user) return;
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    await AsyncStorage.setItem(getNotificationsKey(user.id), JSON.stringify(updated));
    setNotifications(updated);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const updated = notifications.map((n) => ({ ...n, read: true }));
    await AsyncStorage.setItem(getNotificationsKey(user.id), JSON.stringify(updated));
    setNotifications(updated);
  };

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!user) return;
    const updated = { ...settings, ...updates };
    await AsyncStorage.setItem(getSettingsKey(user.id), JSON.stringify(updated));
    setSettings(updated);
  };

  const clearNotifications = async () => {
    if (!user) return;
    await AsyncStorage.removeItem(getNotificationsKey(user.id));
    setNotifications([]);
  };

  const enableNotifications = async (): Promise<boolean> => {
    if (!user) return false;
    await AsyncStorage.setItem(getEnabledKey(user.id), "true");
    setIsEnabled(true);
    return true;
  };

  const disableNotifications = async () => {
    if (!user) return;
    await AsyncStorage.setItem(getEnabledKey(user.id), "false");
    setIsEnabled(false);
  };

  const sendBookingConfirmation = async (
    photographerName: string,
    date: string,
    time: string
  ): Promise<void> => {
    if (Platform.OS === "web" || !isEnabled) return;
    
    try {
      await scheduleBookingConfirmationNotification(photographerName, date, time);
      await addNotification({
        title: "Booking Confirmed!",
        body: `Your session with ${photographerName} on ${date} at ${time} is confirmed.`,
        type: "booking",
        metadata: { photographerName, date, time },
      });
    } catch (error) {
      console.error("[NotificationContext] Failed to send booking confirmation:", error);
    }
  };

  const scheduleBookingReminders = async (
    photographerName: string,
    date: string,
    time: string,
    sessionDate: Date
  ): Promise<void> => {
    if (Platform.OS === "web" || !isEnabled) return;
    
    try {
      await Promise.all([
        scheduleBookingReminderNotification(photographerName, date, time, sessionDate, "24h"),
        scheduleBookingReminderNotification(photographerName, date, time, sessionDate, "1h"),
      ]);
      console.log("[NotificationContext] Booking reminders scheduled for", sessionDate);
    } catch (error) {
      console.error("[NotificationContext] Failed to schedule booking reminders:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  console.log("[NOTIF-DEBUG] context unreadCount =", unreadCount, "| total notifications =", notifications.length, "| unread ids =", notifications.filter(n=>!n.read).map(n=>n.id));

  useEffect(() => {
    if (Platform.OS !== "web") {
      setBadgeCount(unreadCount);
    }
  }, [unreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        settings,
        unreadCount,
        isEnabled,
        pendingBusinessCount,
        pushToken,
        addNotification,
        markAsRead,
        markAllAsRead,
        updateSettings,
        clearNotifications,
        enableNotifications,
        disableNotifications,
        refreshAdminNotifications,
        refreshNotifications,
        sendBookingConfirmation,
        scheduleBookingReminders,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

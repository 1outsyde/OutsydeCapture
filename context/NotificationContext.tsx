import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import api from "@/services/api";

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "booking" | "reminder" | "promotion" | "system" | "admin" | "follow" | "business_pending" | "new_vendor_application" | "vendor_approved" | "vendor_rejected";
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
  addNotification: (notification: Omit<Notification, "id" | "date" | "read">) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  clearNotifications: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => void;
  refreshAdminNotifications: () => Promise<void>;
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadNotificationData();
      if (user.isAdmin) {
        startAdminPolling();
      }
    } else {
      setNotifications([]);
      setSettings(DEFAULT_SETTINGS);
      setIsEnabled(true);
      setPendingBusinessCount(0);
      stopAdminPolling();
    }
    return () => stopAdminPolling();
  }, [isAuthenticated, user]);

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

      const pendingBusinesses = await api.getAdminBusinesses(token, "pending");
      console.log("[NotificationContext] API response type:", typeof pendingBusinesses, "isArray:", Array.isArray(pendingBusinesses));
      console.log("[NotificationContext] API response:", JSON.stringify(pendingBusinesses)?.slice(0, 500));
      
      // Handle various response formats - could be array directly or nested in object
      let pendingList: Array<{ id: string; businessName?: string; name?: string }> = [];
      if (Array.isArray(pendingBusinesses)) {
        pendingList = pendingBusinesses;
      } else if (pendingBusinesses && typeof pendingBusinesses === 'object') {
        // Check common nested properties
        const nested = (pendingBusinesses as Record<string, unknown>);
        if (Array.isArray(nested.businesses)) {
          pendingList = nested.businesses;
        } else if (Array.isArray(nested.data)) {
          pendingList = nested.data;
        }
      }
      setPendingBusinessCount(pendingList.length);

      const newBusinesses = pendingList.filter(
        (b: { id: string }) => !seenBusinessIds.includes(b.id)
      );

      if (newBusinesses.length > 0) {
        const newNotifications: Notification[] = newBusinesses.map((business: { id: string; businessName?: string; name?: string }) => ({
          id: `business_pending_${business.id}`,
          title: "New Business Application",
          body: `${business.businessName || business.name || "A business"} is pending approval`,
          type: "business_pending" as const,
          date: new Date().toISOString(),
          read: false,
          metadata: { businessId: business.id },
        }));

        const existingIds = new Set(notifications.map(n => n.id));
        const uniqueNewNotifications = newNotifications.filter(n => !existingIds.has(n.id));
        
        if (uniqueNewNotifications.length > 0) {
          const updated = [...uniqueNewNotifications, ...notifications];
          await AsyncStorage.setItem(getNotificationsKey(user.id), JSON.stringify(updated));
          setNotifications(updated);

          const newSeenIds = [...seenBusinessIds, ...newBusinesses.map((b: { id: string }) => b.id)];
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        settings,
        unreadCount,
        isEnabled,
        pendingBusinessCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        updateSettings,
        clearNotifications,
        enableNotifications,
        disableNotifications,
        refreshAdminNotifications,
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

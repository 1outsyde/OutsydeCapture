import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "booking" | "reminder" | "promotion" | "system";
  date: string;
  read: boolean;
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
  addNotification: (notification: Omit<Notification, "id" | "date" | "read">) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const getNotificationsKey = (userId: string) => `@outsyde_notifications_${userId}`;
const getSettingsKey = (userId: string) => `@outsyde_notification_settings_${userId}`;

const DEFAULT_SETTINGS: NotificationSettings = {
  bookingConfirmations: true,
  sessionReminders: true,
  promotions: false,
  messages: true,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadNotificationData();
    } else {
      setNotifications([]);
      setSettings(DEFAULT_SETTINGS);
    }
  }, [isAuthenticated, user]);

  const loadNotificationData = async () => {
    if (!user) return;
    try {
      const [storedNotifications, storedSettings] = await Promise.all([
        AsyncStorage.getItem(getNotificationsKey(user.id)),
        AsyncStorage.getItem(getSettingsKey(user.id)),
      ]);
      if (storedNotifications) setNotifications(JSON.parse(storedNotifications));
      if (storedSettings) setSettings(JSON.parse(storedSettings));
    } catch (err) {
      console.error("Failed to load notification data:", err);
    }
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        settings,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        updateSettings,
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
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { Platform } from "react-native";

interface CalendarSettings {
  syncEnabled: boolean;
  selectedCalendarId: string;
  addReminders: boolean;
  invitePhotographer: boolean;
}

interface CalendarContextType {
  isConnected: boolean;
  isLoading: boolean;
  settings: CalendarSettings;
  calendars: { id: string; summary: string }[];
  updateSettings: (updates: Partial<CalendarSettings>) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  syncSessionToCalendar: (sessionData: SessionCalendarData) => Promise<string | null>;
  cancelCalendarEvent: (eventId: string) => Promise<boolean>;
  refreshCalendars: () => Promise<void>;
}

export interface SessionCalendarData {
  photographerName: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes?: string;
  photographerEmail?: string;
  clientEmail?: string;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

const getSettingsKey = (userId: string) => `@outsyde_calendar_settings_${userId}`;

const DEFAULT_SETTINGS: CalendarSettings = {
  syncEnabled: true,
  selectedCalendarId: "primary",
  addReminders: true,
  invitePhotographer: false,
};

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { user, getToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>([]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "web") {
      setIsConnected(false);
      setIsLoading(false);
      return false;
    }

    try {
      const token = await getToken();
      if (!token) {
        setIsConnected(false);
        return false;
      }

      const response = await fetch("/api/calendar/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        return data.connected;
      }
      setIsConnected(false);
      return false;
    } catch {
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const refreshCalendars = useCallback(async () => {
    if (!isConnected || Platform.OS !== "web") return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/calendar/calendars", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCalendars(data.calendars || []);
      }
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
    }
  }, [getToken, isConnected]);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const stored = await AsyncStorage.getItem(getSettingsKey(user.id));
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error("Failed to load calendar settings:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSettings();
      checkConnection();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setIsConnected(false);
      setCalendars([]);
    }
  }, [user, loadSettings, checkConnection]);

  useEffect(() => {
    if (isConnected) {
      refreshCalendars();
    }
  }, [isConnected, refreshCalendars]);

  const updateSettings = async (updates: Partial<CalendarSettings>) => {
    if (!user) return;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem(getSettingsKey(user.id), JSON.stringify(newSettings));
    } catch (error) {
      console.error("Failed to save calendar settings:", error);
    }
  };

  const syncSessionToCalendar = async (sessionData: SessionCalendarData): Promise<string | null> => {
    if (!isConnected || !settings.syncEnabled || Platform.OS !== "web") {
      return null;
    }

    try {
      const token = await getToken();
      if (!token) return null;

      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...sessionData,
          calendarId: settings.selectedCalendarId,
          addReminders: settings.addReminders,
          invitePhotographer: settings.invitePhotographer,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.eventId || null;
      }
      return null;
    } catch (error) {
      console.error("Failed to sync session to calendar:", error);
      return null;
    }
  };

  const cancelCalendarEvent = async (eventId: string): Promise<boolean> => {
    if (!isConnected || Platform.OS !== "web") return false;

    try {
      const token = await getToken();
      if (!token) return false;

      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to cancel calendar event:", error);
      return false;
    }
  };

  return (
    <CalendarContext.Provider
      value={{
        isConnected,
        isLoading,
        settings,
        calendars,
        updateSettings,
        checkConnection,
        syncSessionToCalendar,
        cancelCalendarEvent,
        refreshCalendars,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within a CalendarProvider");
  }
  return context;
}

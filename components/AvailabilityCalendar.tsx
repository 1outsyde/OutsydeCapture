import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import api, {
  AvailabilityCalendarDay,
  AvailabilitySlot,
} from "@/services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_SIZE = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.xs * 6) / 7;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface AvailabilityCalendarProps {
  providerId: string;
  providerType: "photographer" | "business";
}

export default function AvailabilityCalendar({
  providerId,
  providerType,
}: AvailabilityCalendarProps) {
  const { theme } = useTheme();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calendarDays, setCalendarDays] = useState<AvailabilityCalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const monthDate = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [currentMonth]);

  const monthDisplay = useMemo(() => {
    return `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  }, [monthDate]);

  const calendarGrid = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const grid: Array<{
      date: string | null;
      dayNum: number | null;
      status: "available" | "partial" | "unavailable" | "past" | null;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < firstDay; i++) {
      grid.push({ date: null, dayNum: null, status: null, isToday: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(year, month, day);
      const isPast = dateObj < today;
      const isToday = dateObj.getTime() === today.getTime();
      
      const calendarDay = calendarDays.find((d) => d.date === dateStr);
      const status = isPast ? "past" : calendarDay?.status || "unavailable";

      grid.push({ date: dateStr, dayNum: day, status, isToday });
    }

    return grid;
  }, [monthDate, calendarDays]);

  const fetchCalendar = useCallback(async () => {
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const response = await api.getAvailabilityCalendar(providerId, providerType, currentMonth);
      setCalendarDays(response.days || []);
    } catch (err: any) {
      setCalendarError(err.message || "Failed to load calendar");
      setCalendarDays([]);
    } finally {
      setLoadingCalendar(false);
    }
  }, [providerId, providerType, currentMonth]);

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlotId(null);
    try {
      const response = await api.getAvailabilitySlots(providerId, providerType, date);
      setSlots(response.slots || []);
    } catch (err: any) {
      setSlotsError(err.message || "Failed to load slots");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [providerId, providerType]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    } else {
      setSlots([]);
    }
  }, [selectedDate, fetchSlots]);

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    const [year, month] = currentMonth.split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    setCurrentMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync();
    const [year, month] = currentMonth.split("-").map(Number);
    const next = new Date(year, month, 1);
    const threeMonthsAhead = new Date();
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);
    if (next <= threeMonthsAhead) {
      setCurrentMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
      setSelectedDate(null);
    }
  };

  const handleDayPress = (date: string, status: string) => {
    if (status === "past" || status === "unavailable") return;
    Haptics.selectionAsync();
    setSelectedDate(selectedDate === date ? null : date);
  };

  const handleSlotPress = (slotId: string, status: string) => {
    if (status !== "available") return;
    Haptics.selectionAsync();
    setSelectedSlotId(selectedSlotId === slotId ? null : slotId);
  };

  const getCountdown = (expiresAt: string): string => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expiring";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const getDayStyle = (status: string | null, isSelected: boolean, isToday: boolean) => {
    const base: any = {
      width: DAY_SIZE,
      height: DAY_SIZE,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
    };

    if (isSelected) {
      base.backgroundColor = theme.primary;
    } else if (status === "available") {
      base.backgroundColor = theme.success + "30";
    } else if (status === "partial") {
      base.backgroundColor = theme.warning + "30";
    } else if (status === "unavailable" || status === "past") {
      base.backgroundColor = theme.backgroundSecondary;
    }

    if (isToday && !isSelected) {
      base.borderWidth = 2;
      base.borderColor = theme.primary;
    }

    return base;
  };

  const getDayTextColor = (status: string | null, isSelected: boolean) => {
    if (isSelected) return "#FFFFFF";
    if (status === "past" || status === "unavailable") return theme.textMuted;
    return theme.text;
  };

  const getSlotStyle = (status: string, isSelected: boolean) => {
    const base: any = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    };

    if (isSelected && status === "available") {
      base.backgroundColor = theme.primary;
    } else if (status === "available") {
      base.backgroundColor = theme.success + "20";
      base.borderWidth = 1;
      base.borderColor = theme.success;
    } else if (status === "held") {
      base.backgroundColor = theme.warning + "20";
      base.borderWidth = 1;
      base.borderColor = theme.warning;
    } else if (status === "booked") {
      base.backgroundColor = theme.backgroundSecondary;
      base.borderWidth = 1;
      base.borderColor = theme.border;
    }

    return base;
  };

  const selectedDateDisplay = useMemo(() => {
    if (!selectedDate) return "";
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }, [selectedDate]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="h3" style={styles.header}>
        Availability
      </ThemedText>
      <ThemedText style={[styles.subtext, { color: theme.textSecondary }]}>
        Live availability updates automatically based on bookings.
      </ThemedText>

      <View style={[styles.monthNav, { borderColor: theme.border }]}>
        <Pressable onPress={handlePrevMonth} hitSlop={12}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="body" style={[styles.monthText, { fontWeight: "600" }]}>
          {monthDisplay}
        </ThemedText>
        <Pressable onPress={handleNextMonth} hitSlop={12}>
          <Feather name="chevron-right" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={[styles.weekdayCell, { width: DAY_SIZE }]}>
            <ThemedText style={[styles.weekdayText, { color: theme.textSecondary }]}>
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      {loadingCalendar ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : calendarError ? (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={32} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {calendarError}
          </ThemedText>
          <Pressable onPress={fetchCalendar} style={[styles.retryButton, { backgroundColor: theme.primary }]}>
            <ThemedText style={{ color: "#FFFFFF" }}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.calendarGrid}>
          {calendarGrid.map((cell, index) => (
            <Pressable
              key={index}
              onPress={() => cell.date && cell.status && handleDayPress(cell.date, cell.status)}
              disabled={!cell.date || cell.status === "past" || cell.status === "unavailable"}
              style={getDayStyle(cell.status, selectedDate === cell.date, cell.isToday)}
            >
              {cell.dayNum && (
                <ThemedText
                  style={{
                    color: getDayTextColor(cell.status, selectedDate === cell.date),
                    fontWeight: cell.isToday ? "700" : "400",
                  }}
                >
                  {cell.dayNum}
                </ThemedText>
              )}
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.success + "30" }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Available</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.warning + "30" }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Partial</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.backgroundSecondary }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Unavailable</ThemedText>
        </View>
      </View>

      {selectedDate && (
        <View style={styles.slotsSection}>
          <ThemedText type="body" style={[styles.slotsHeader, { fontWeight: "600" }]}>
            {selectedDateDisplay}
          </ThemedText>

          {loadingSlots ? (
            <View style={styles.slotsLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : slotsError ? (
            <View style={styles.slotsError}>
              <ThemedText style={{ color: theme.error }}>{slotsError}</ThemedText>
            </View>
          ) : slots.length === 0 ? (
            <View style={styles.slotsEmpty}>
              <Feather name="calendar" size={24} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                No availability for this date.
              </ThemedText>
            </View>
          ) : (
            slots.map((slot) => (
              <Pressable
                key={slot.id}
                onPress={() => handleSlotPress(slot.id, slot.status)}
                disabled={slot.status !== "available"}
                style={getSlotStyle(slot.status, selectedSlotId === slot.id)}
              >
                <View style={styles.slotTimeRow}>
                  <Feather
                    name="clock"
                    size={16}
                    color={selectedSlotId === slot.id ? "#FFFFFF" : theme.text}
                  />
                  <ThemedText
                    style={[
                      styles.slotTime,
                      { color: selectedSlotId === slot.id ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {slot.startTime} - {slot.endTime}
                  </ThemedText>
                </View>
                <View style={styles.slotStatusRow}>
                  {slot.status === "available" && (
                    <ThemedText
                      style={{
                        color: selectedSlotId === slot.id ? "#FFFFFF" : theme.success,
                        fontWeight: "600",
                      }}
                    >
                      Available
                    </ThemedText>
                  )}
                  {slot.status === "held" && (
                    <View style={styles.heldBadge}>
                      <Feather name="clock" size={12} color={theme.warning} />
                      <ThemedText style={[styles.heldText, { color: theme.warning }]}>
                        Held {slot.holdExpiresAt && `(${getCountdown(slot.holdExpiresAt)})`}
                      </ThemedText>
                    </View>
                  )}
                  {slot.status === "booked" && (
                    <ThemedText style={{ color: theme.textMuted }}>Booked</ThemedText>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  header: {
    marginBottom: Spacing.xs,
  },
  subtext: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  monthText: {
    fontSize: 16,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  loadingContainer: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  errorText: {
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
  slotsSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  slotsHeader: {
    marginBottom: Spacing.md,
  },
  slotsLoading: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  slotsError: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  slotsEmpty: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
  },
  slotTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  slotTime: {
    fontWeight: "500",
  },
  slotStatusRow: {
    alignItems: "flex-end",
  },
  heldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  heldText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

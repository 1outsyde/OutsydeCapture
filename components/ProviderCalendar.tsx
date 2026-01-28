import React, { useState, useMemo } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface CalendarBooking {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  clientName: string;
  serviceName: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "declined";
  amount: number;
}

export interface CalendarBlockedDate {
  id?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  reason?: string;
}

export interface DayAvailability {
  dayOfWeek: number;
  isAvailable: boolean;
  windows: { startTime: string; endTime: string }[];
}

interface ProviderCalendarProps {
  bookings: CalendarBooking[];
  blockedDates: CalendarBlockedDate[];
  weeklyAvailability: DayAvailability[];
  onBlockDate: (date: string, isFullDay: boolean, startTime?: string, endTime?: string, reason?: string) => void;
  onUnblockDate: (blockId: string) => void;
  onBookingPress?: (booking: CalendarBooking) => void;
  monthsAhead?: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_OPTIONS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];

export default function ProviderCalendar({
  bookings,
  blockedDates,
  weeklyAvailability,
  onBlockDate,
  onUnblockDate,
  onBookingPress,
  monthsAhead = 3,
}: ProviderCalendarProps) {
  const { theme } = useTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [blockMode, setBlockMode] = useState<"full" | "partial">("full");
  const [blockStartTime, setBlockStartTime] = useState("9:00 AM");
  const [blockEndTime, setBlockEndTime] = useState("5:00 PM");

  const maxDate = useMemo(() => {
    const max = new Date(today);
    max.setMonth(max.getMonth() + monthsAhead);
    return max;
  }, [monthsAhead]);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, CalendarBooking[]> = {};
    bookings.forEach(b => {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    return map;
  }, [bookings]);

  const blockedByDate = useMemo(() => {
    const map: Record<string, CalendarBlockedDate[]> = {};
    blockedDates.forEach(b => {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    return map;
  }, [blockedDates]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateStr = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextDate = new Date(nextYear, nextMonth, 1);
    
    if (nextDate <= maxDate) {
      setCurrentMonth(nextMonth);
      setCurrentYear(nextYear);
    }
  };

  const canGoNext = () => {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    return new Date(nextYear, nextMonth, 1) <= maxDate;
  };

  const canGoPrev = () => {
    if (currentYear < today.getFullYear()) return false;
    if (currentYear === today.getFullYear() && currentMonth <= today.getMonth()) return false;
    return true;
  };

  const handleDayPress = (dateStr: string) => {
    const date = new Date(dateStr);
    if (date < today) return;
    setSelectedDate(dateStr);
    setShowDayModal(true);
  };

  const handleBlockConfirm = () => {
    if (!selectedDate) return;
    
    if (blockMode === "full") {
      onBlockDate(selectedDate, true);
    } else {
      onBlockDate(selectedDate, false, blockStartTime, blockEndTime);
    }
    setShowDayModal(false);
    setBlockMode("full");
  };

  const handleUnblock = (blockId: string) => {
    Alert.alert(
      "Unblock Date",
      "Are you sure you want to remove this block?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unblock", style: "destructive", onPress: () => onUnblockDate(blockId) },
      ]
    );
  };

  const getDayStatus = (dateStr: string, dayOfWeek: number) => {
    const date = new Date(dateStr);
    const dayBookings = bookingsByDate[dateStr] || [];
    const dayBlocks = blockedByDate[dateStr] || [];
    const weekdayAvail = weeklyAvailability.find(w => w.dayOfWeek === dayOfWeek);
    
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const hasConfirmed = dayBookings.some(b => b.status === "confirmed");
    const hasPending = dayBookings.some(b => b.status === "pending");
    const isFullyBlocked = dayBlocks.some(b => b.isFullDay);
    const hasPartialBlock = dayBlocks.some(b => !b.isFullDay);
    const isAvailableDay = weekdayAvail?.isAvailable ?? false;

    return { isPast, isToday, hasConfirmed, hasPending, isFullyBlocked, hasPartialBlock, isAvailableDay };
  };

  const renderDay = (day: number) => {
    const dateStr = formatDateStr(currentYear, currentMonth, day);
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const status = getDayStatus(dateStr, dayOfWeek);
    
    let bgColor = "transparent";
    let textColor = theme.text;
    let borderColor = "transparent";
    
    if (status.isPast) {
      textColor = theme.textSecondary;
    } else if (status.isFullyBlocked) {
      bgColor = theme.error + "20";
      borderColor = theme.error;
    } else if (status.hasConfirmed) {
      bgColor = theme.success + "20";
      borderColor = theme.success;
    } else if (status.hasPending) {
      bgColor = theme.warning + "20";
      borderColor = theme.warning;
    } else if (status.hasPartialBlock) {
      bgColor = theme.warning + "10";
    } else if (!status.isAvailableDay) {
      textColor = theme.textSecondary;
      bgColor = theme.backgroundSecondary;
    }

    if (status.isToday) {
      borderColor = theme.primary;
    }

    return (
      <Pressable
        key={day}
        style={[
          styles.dayCell,
          { backgroundColor: bgColor, borderColor, borderWidth: borderColor !== "transparent" ? 2 : 0 },
        ]}
        onPress={() => handleDayPress(dateStr)}
        disabled={status.isPast}
      >
        <ThemedText style={[styles.dayText, { color: textColor }]}>{day}</ThemedText>
        <View style={styles.indicators}>
          {status.hasConfirmed && <View style={[styles.dot, { backgroundColor: theme.success }]} />}
          {status.hasPending && <View style={[styles.dot, { backgroundColor: theme.warning }]} />}
          {status.isFullyBlocked && <Feather name="x" size={10} color={theme.error} />}
        </View>
      </Pressable>
    );
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const rows: React.ReactNode[] = [];
    let cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(renderDay(day));
      if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
        while (cells.length < 7) {
          cells.push(<View key={`empty-end-${cells.length}`} style={styles.dayCell} />);
        }
        rows.push(
          <View key={`row-${day}`} style={styles.weekRow}>
            {cells}
          </View>
        );
        cells = [];
      }
    }

    return rows;
  };

  const selectedDateBookings = selectedDate ? bookingsByDate[selectedDate] || [] : [];
  const selectedDateBlocks = selectedDate ? blockedByDate[selectedDate] || [] : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <Pressable onPress={goToPrevMonth} disabled={!canGoPrev()} style={styles.navButton}>
          <Feather name="chevron-left" size={24} color={canGoPrev() ? theme.text : theme.textSecondary} />
        </Pressable>
        <ThemedText style={styles.monthTitle}>
          {MONTHS[currentMonth]} {currentYear}
        </ThemedText>
        <Pressable onPress={goToNextMonth} disabled={!canGoNext()} style={styles.navButton}>
          <Feather name="chevron-right" size={24} color={canGoNext() ? theme.text : theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.weekdayHeader}>
        {WEEKDAYS.map(day => (
          <View key={day} style={styles.weekdayCell}>
            <ThemedText style={[styles.weekdayText, { color: theme.textSecondary }]}>{day}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {renderCalendarGrid()}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Confirmed</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Pending</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.error }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Blocked</ThemedText>
        </View>
      </View>

      <Modal visible={showDayModal} transparent animationType="slide" onRequestClose={() => setShowDayModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ""}
              </ThemedText>
              <Pressable onPress={() => setShowDayModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {selectedDateBookings.length > 0 && (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Bookings</ThemedText>
                  {selectedDateBookings.map(booking => (
                    <Pressable
                      key={booking.id}
                      style={[styles.bookingCard, { backgroundColor: theme.backgroundSecondary }]}
                      onPress={() => onBookingPress?.(booking)}
                    >
                      <View style={styles.bookingInfo}>
                        <ThemedText style={styles.bookingClient}>{booking.clientName}</ThemedText>
                        <ThemedText style={[styles.bookingService, { color: theme.textSecondary }]}>
                          {booking.serviceName} - {booking.startTime}
                        </ThemedText>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: booking.status === "confirmed" ? theme.success : booking.status === "pending" ? theme.warning : theme.textSecondary }
                      ]}>
                        <ThemedText style={styles.statusText}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {selectedDateBlocks.length > 0 && (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Blocked Times</ThemedText>
                  {selectedDateBlocks.map((block, idx) => (
                    <View key={block.id || idx} style={[styles.blockCard, { backgroundColor: theme.error + "10" }]}>
                      <View style={styles.blockInfo}>
                        <ThemedText style={styles.blockTime}>
                          {block.isFullDay ? "All Day" : `${block.startTime} - ${block.endTime}`}
                        </ThemedText>
                        {block.reason && (
                          <ThemedText style={[styles.blockReason, { color: theme.textSecondary }]}>
                            {block.reason}
                          </ThemedText>
                        )}
                      </View>
                      {block.id && (
                        <Pressable onPress={() => handleUnblock(block.id!)}>
                          <Feather name="trash-2" size={18} color={theme.error} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Block This Date</ThemedText>
                
                <View style={styles.blockOptions}>
                  <Pressable
                    style={[
                      styles.blockOption,
                      { borderColor: blockMode === "full" ? theme.primary : theme.border },
                      blockMode === "full" && { backgroundColor: theme.primary + "10" }
                    ]}
                    onPress={() => setBlockMode("full")}
                  >
                    <Feather name={blockMode === "full" ? "check-circle" : "circle"} size={18} color={blockMode === "full" ? theme.primary : theme.textSecondary} />
                    <ThemedText>Full Day</ThemedText>
                  </Pressable>
                  
                  <Pressable
                    style={[
                      styles.blockOption,
                      { borderColor: blockMode === "partial" ? theme.primary : theme.border },
                      blockMode === "partial" && { backgroundColor: theme.primary + "10" }
                    ]}
                    onPress={() => setBlockMode("partial")}
                  >
                    <Feather name={blockMode === "partial" ? "check-circle" : "circle"} size={18} color={blockMode === "partial" ? theme.primary : theme.textSecondary} />
                    <ThemedText>Specific Hours</ThemedText>
                  </Pressable>
                </View>

                {blockMode === "partial" && (
                  <View style={styles.timeSelectors}>
                    <View style={styles.timeSelector}>
                      <ThemedText style={[styles.timeSelectorLabel, { color: theme.textSecondary }]}>From</ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {TIME_OPTIONS.map(time => (
                          <Pressable
                            key={time}
                            style={[
                              styles.timeChip,
                              { borderColor: blockStartTime === time ? theme.primary : theme.border },
                              blockStartTime === time && { backgroundColor: theme.primary + "20" }
                            ]}
                            onPress={() => setBlockStartTime(time)}
                          >
                            <ThemedText style={{ fontSize: 12 }}>{time}</ThemedText>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.timeSelector}>
                      <ThemedText style={[styles.timeSelectorLabel, { color: theme.textSecondary }]}>To</ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {TIME_OPTIONS.map(time => (
                          <Pressable
                            key={time}
                            style={[
                              styles.timeChip,
                              { borderColor: blockEndTime === time ? theme.primary : theme.border },
                              blockEndTime === time && { backgroundColor: theme.primary + "20" }
                            ]}
                            onPress={() => setBlockEndTime(time)}
                          >
                            <ThemedText style={{ fontSize: 12 }}>{time}</ThemedText>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                <Pressable
                  style={[styles.blockButton, { backgroundColor: theme.error }]}
                  onPress={handleBlockConfirm}
                >
                  <Feather name="x-circle" size={18} color="#FFF" />
                  <ThemedText style={styles.blockButtonText}>Block {blockMode === "full" ? "All Day" : "Selected Hours"}</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  navButton: {
    padding: Spacing.xs,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekdayHeader: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  calendarGrid: {
    gap: 2,
  },
  weekRow: {
    flexDirection: "row",
    gap: 2,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
  },
  indicators: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: 10,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalScroll: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingClient: {
    fontSize: 15,
    fontWeight: "500",
  },
  bookingService: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFF",
  },
  blockCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  blockInfo: {
    flex: 1,
  },
  blockTime: {
    fontSize: 14,
    fontWeight: "500",
  },
  blockReason: {
    fontSize: 12,
    marginTop: 2,
  },
  blockOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  blockOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  timeSelectors: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  timeSelector: {
    gap: Spacing.xs,
  },
  timeSelectorLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  blockButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
});

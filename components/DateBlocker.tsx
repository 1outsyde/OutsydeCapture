import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export interface BlockedDate {
  id?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  reason?: string;
}

interface DateBlockerProps {
  blockedDates: BlockedDate[];
  onAdd: (blockedDate: BlockedDate) => void;
  onRemove: (index: number) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const QUICK_BLOCK_OPTIONS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "This Weekend", days: "weekend" },
  { label: "Next Week", days: "week" },
];

const TIME_OPTIONS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];

const convertTo24Hour = (time12: string): string => {
  const [time, period] = time12.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const convertTo12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export default function DateBlocker({
  blockedDates,
  onAdd,
  onRemove,
  onSave,
  isSaving = false,
}: DateBlockerProps) {
  const { theme } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [blockReason, setBlockReason] = useState("");
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");
  const [showTimePicker, setShowTimePicker] = useState<"start" | "end" | null>(null);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleQuickBlock = (option: typeof QUICK_BLOCK_OPTIONS[0]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (option.days === "weekend") {
      const dayOfWeek = today.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(today);
      saturday.setDate(today.getDate() + daysUntilSaturday);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      
      onAdd({
        date: saturday.toISOString().split("T")[0],
        isFullDay: true,
        reason: "Weekend blocked",
      });
      onAdd({
        date: sunday.toISOString().split("T")[0],
        isFullDay: true,
        reason: "Weekend blocked",
      });
    } else if (option.days === "week") {
      const nextMonday = new Date(today);
      const dayOfWeek = today.getDay();
      const daysUntilMonday = ((1 - dayOfWeek + 7) % 7) || 7;
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      
      for (let i = 0; i < 5; i++) {
        const date = new Date(nextMonday);
        date.setDate(nextMonday.getDate() + i);
        onAdd({
          date: date.toISOString().split("T")[0],
          isFullDay: true,
          reason: "Week blocked",
        });
      }
    } else {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + (option.days as number));
      onAdd({
        date: targetDate.toISOString().split("T")[0],
        isFullDay: true,
        reason: option.label,
      });
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleAddSelectedDates = () => {
    selectedDays.forEach(day => {
      const date = new Date(selectedYear, selectedMonth, day);
      const dateStr = date.toISOString().split("T")[0];
      const alreadyBlocked = blockedDates.some(b => b.date === dateStr && b.isFullDay);
      if (!alreadyBlocked) {
        if (isFullDay) {
          onAdd({
            date: dateStr,
            isFullDay: true,
            reason: blockReason || "Blocked",
          });
        } else {
          onAdd({
            date: dateStr,
            isFullDay: false,
            startTime: convertTo24Hour(startTime),
            endTime: convertTo24Hour(endTime),
            reason: blockReason || `Blocked ${startTime} - ${endTime}`,
          });
        }
      }
    });
    setSelectedDays([]);
    setBlockReason("");
    setIsFullDay(true);
    setStartTime("9:00 AM");
    setEndTime("5:00 PM");
    setShowDatePicker(false);
  };

  const isDateBlocked = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    const dateStr = date.toISOString().split("T")[0];
    return blockedDates.some(b => b.date === dateStr);
  };

  const isPastDate = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isBlocked = isDateBlocked(day);
      const isPast = isPastDate(day);
      const isSelected = selectedDays.includes(day);
      
      days.push(
        <Pressable
          key={day}
          onPress={() => !isPast && !isBlocked && toggleDay(day)}
          disabled={isPast || isBlocked}
          style={[
            styles.calendarDay,
            { backgroundColor: theme.backgroundSecondary },
            isSelected && { backgroundColor: theme.primary },
            isBlocked && { backgroundColor: "#FF3B3020" },
            isPast && { opacity: 0.3 },
          ]}
        >
          <Text
            style={[
              styles.calendarDayText,
              { color: theme.text },
              isSelected && { color: "#FFFFFF" },
              isBlocked && { color: "#FF3B30" },
            ]}
          >
            {day}
          </Text>
          {isBlocked && (
            <View style={styles.blockedIndicator}>
              <Feather name="x" size={8} color="#FF3B30" />
            </View>
          )}
        </Pressable>
      );
    }
    
    return days;
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    header: {
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.h4,
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    description: {
      ...Typography.caption,
      color: theme.textSecondary,
    },
    quickBlockSection: {
      marginBottom: Spacing.lg,
    },
    sectionLabel: {
      ...Typography.caption,
      color: theme.textSecondary,
      marginBottom: Spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    quickBlockRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    quickBlockButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: theme.backgroundSecondary,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickBlockText: {
      ...Typography.caption,
      color: theme.text,
      fontWeight: "500",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.lg,
    },
    addButtonText: {
      ...Typography.button,
      color: "#FFFFFF",
      marginLeft: Spacing.xs,
    },
    blockedList: {
      marginBottom: Spacing.lg,
    },
    blockedItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.backgroundSecondary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    blockedItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    blockedIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#FF3B3020",
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.sm,
    },
    blockedItemText: {
      ...Typography.body,
      color: theme.text,
    },
    blockedItemReason: {
      ...Typography.caption,
      color: theme.textSecondary,
    },
    removeButton: {
      padding: Spacing.xs,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: Spacing.xl,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    emptyText: {
      ...Typography.caption,
      color: theme.textSecondary,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      ...Typography.button,
      color: "#FFFFFF",
      marginLeft: Spacing.xs,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    pickerContainer: {
      backgroundColor: theme.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      maxHeight: "80%",
    },
    pickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    pickerTitle: {
      ...Typography.h4,
      color: theme.text,
    },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    monthNavButton: {
      padding: Spacing.sm,
    },
    monthLabel: {
      ...Typography.subtitle,
      color: theme.text,
      marginHorizontal: Spacing.lg,
      minWidth: 150,
      textAlign: "center",
    },
    weekdayRow: {
      flexDirection: "row",
      marginBottom: Spacing.sm,
    },
    weekdayLabel: {
      flex: 1,
      textAlign: "center",
      ...Typography.caption,
      color: theme.textSecondary,
      fontWeight: "600",
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    calendarDay: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.sm,
      marginBottom: 4,
      position: "relative",
    },
    calendarDayText: {
      ...Typography.body,
      fontWeight: "500",
    },
    blockedIndicator: {
      position: "absolute",
      top: 2,
      right: 2,
    },
    selectionInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: Spacing.md,
    },
    selectionText: {
      ...Typography.body,
      color: theme.text,
    },
    confirmButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
    },
    confirmButtonText: {
      ...Typography.button,
      color: "#FFFFFF",
      marginLeft: Spacing.xs,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Block Dates</Text>
        <Text style={styles.description}>
          Block specific dates when you're unavailable for bookings (vacations, personal time, external shoots)
        </Text>
      </View>

      <View style={styles.quickBlockSection}>
        <Text style={styles.sectionLabel}>Quick Block</Text>
        <View style={styles.quickBlockRow}>
          {QUICK_BLOCK_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={styles.quickBlockButton}
              onPress={() => handleQuickBlock(option)}
            >
              <Text style={styles.quickBlockText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={styles.addButton} onPress={() => setShowDatePicker(true)}>
        <Feather name="calendar" size={18} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Select Dates to Block</Text>
      </Pressable>

      <View style={styles.blockedList}>
        <Text style={styles.sectionLabel}>Blocked Dates</Text>
        {blockedDates.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="calendar" size={24} color={theme.textSecondary} />
            </View>
            <Text style={styles.emptyText}>No dates blocked yet</Text>
          </View>
        ) : (
          blockedDates.map((blocked, index) => (
            <View key={blocked.id || `${blocked.date}-${blocked.startTime || 'full'}`} style={styles.blockedItem}>
              <View style={styles.blockedItemLeft}>
                <View style={[styles.blockedIcon, !blocked.isFullDay && { backgroundColor: "#f9731620" }]}>
                  <Feather 
                    name={blocked.isFullDay ? "x-circle" : "clock"} 
                    size={16} 
                    color={blocked.isFullDay ? "#FF3B30" : "#f97316"} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockedItemText}>
                    {formatDate(blocked.date)}
                    {!blocked.isFullDay && blocked.startTime && blocked.endTime && (
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {" "}({convertTo12Hour(blocked.startTime)} - {convertTo12Hour(blocked.endTime)})
                      </Text>
                    )}
                  </Text>
                  {blocked.reason && (
                    <Text style={styles.blockedItemReason}>
                      {blocked.isFullDay ? blocked.reason : `Hourly: ${blocked.reason}`}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable style={styles.removeButton} onPress={() => onRemove(index)}>
                <Feather name="trash-2" size={18} color="#FF3B30" />
              </Pressable>
            </View>
          ))
        )}
      </View>

      {onSave && (
        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="save" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving..." : "Save Blocked Dates"}
          </Text>
        </Pressable>
      )}

      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Dates</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable
                style={styles.monthNavButton}
                onPress={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(prev => prev - 1);
                  } else {
                    setSelectedMonth(prev => prev - 1);
                  }
                }}
              >
                <Feather name="chevron-left" size={24} color={theme.text} />
              </Pressable>
              <Text style={styles.monthLabel}>
                {MONTHS[selectedMonth]} {selectedYear}
              </Text>
              <Pressable
                style={styles.monthNavButton}
                onPress={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(prev => prev + 1);
                  } else {
                    setSelectedMonth(prev => prev + 1);
                  }
                }}
              >
                <Feather name="chevron-right" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <Text key={i} style={styles.weekdayLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {renderCalendar()}
            </View>

            {selectedDays.length > 0 && (
              <View style={{ marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: Spacing.md }}>
                <Text style={{ ...Typography.caption, color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  {selectedDays.length} date{selectedDays.length > 1 ? "s" : ""} selected
                </Text>

                <View style={{ flexDirection: "row", marginBottom: Spacing.md, gap: 8 }}>
                  <Pressable
                    onPress={() => setIsFullDay(true)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: Spacing.sm,
                      borderRadius: BorderRadius.md,
                      backgroundColor: isFullDay ? theme.primary : theme.backgroundSecondary,
                    }}
                  >
                    <Feather name="calendar" size={16} color={isFullDay ? "#fff" : theme.text} />
                    <Text style={{ marginLeft: 6, fontWeight: "600", color: isFullDay ? "#fff" : theme.text }}>
                      Full Day
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsFullDay(false)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: Spacing.sm,
                      borderRadius: BorderRadius.md,
                      backgroundColor: !isFullDay ? theme.primary : theme.backgroundSecondary,
                    }}
                  >
                    <Feather name="clock" size={16} color={!isFullDay ? "#fff" : theme.text} />
                    <Text style={{ marginLeft: 6, fontWeight: "600", color: !isFullDay ? "#fff" : theme.text }}>
                      Specific Hours
                    </Text>
                  </Pressable>
                </View>

                {!isFullDay && (
                  <View style={{ marginBottom: Spacing.md }}>
                    <Text style={{ ...Typography.caption, color: theme.textSecondary, marginBottom: Spacing.xs }}>
                      Block from:
                    </Text>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Pressable
                        onPress={() => setShowTimePicker("start")}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: theme.backgroundSecondary,
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: BorderRadius.md,
                          borderWidth: 1,
                          borderColor: theme.border,
                        }}
                      >
                        <Text style={{ color: theme.text, fontWeight: "500" }}>{startTime}</Text>
                        <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                      </Pressable>
                      <Text style={{ alignSelf: "center", color: theme.textSecondary }}>to</Text>
                      <Pressable
                        onPress={() => setShowTimePicker("end")}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: theme.backgroundSecondary,
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: BorderRadius.md,
                          borderWidth: 1,
                          borderColor: theme.border,
                        }}
                      >
                        <Text style={{ color: theme.text, fontWeight: "500" }}>{endTime}</Text>
                        <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                )}

                <Pressable style={styles.confirmButton} onPress={handleAddSelectedDates}>
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>
                    {isFullDay ? "Block Full Day" : `Block ${startTime} - ${endTime}`}
                  </Text>
                </Pressable>
              </View>
            )}

            {showTimePicker && (
              <View style={{ 
                position: "absolute", 
                bottom: 0, 
                left: 0, 
                right: 0, 
                backgroundColor: theme.card, 
                borderTopWidth: 1, 
                borderTopColor: theme.border,
                padding: Spacing.md,
              }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm }}>
                  <Text style={{ ...Typography.subtitle, color: theme.text }}>
                    Select {showTimePicker === "start" ? "Start" : "End"} Time
                  </Text>
                  <Pressable onPress={() => setShowTimePicker(null)}>
                    <Feather name="x" size={24} color={theme.text} />
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 200 }}>
                  {TIME_OPTIONS.map((time) => (
                    <Pressable
                      key={time}
                      onPress={() => {
                        if (showTimePicker === "start") {
                          setStartTime(time);
                        } else {
                          setEndTime(time);
                        }
                        setShowTimePicker(null);
                      }}
                      style={{
                        paddingVertical: Spacing.sm,
                        paddingHorizontal: Spacing.md,
                        backgroundColor: 
                          (showTimePicker === "start" && startTime === time) || 
                          (showTimePicker === "end" && endTime === time)
                            ? theme.primary + "20"
                            : "transparent",
                        borderRadius: BorderRadius.sm,
                      }}
                    >
                      <Text style={{ 
                        color: 
                          (showTimePicker === "start" && startTime === time) || 
                          (showTimePicker === "end" && endTime === time)
                            ? theme.primary
                            : theme.text,
                        fontWeight: "500",
                      }}>
                        {time}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

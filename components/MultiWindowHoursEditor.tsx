import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export interface TimeWindow {
  startTime: string;
  endTime: string;
}

export interface DayAvailability {
  dayOfWeek: number;
  isAvailable: boolean;
  windows: TimeWindow[];
}

interface MultiWindowHoursEditorProps {
  availability: DayAvailability[];
  onChange: (availability: DayAvailability[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
  title?: string;
  description?: string;
  showSaveButton?: boolean;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIME_OPTIONS = [
  "12:00 AM", "12:30 AM",
  "1:00 AM", "1:30 AM",
  "2:00 AM", "2:30 AM",
  "3:00 AM", "3:30 AM",
  "4:00 AM", "4:30 AM",
  "5:00 AM", "5:30 AM",
  "6:00 AM", "6:30 AM",
  "7:00 AM", "7:30 AM",
  "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM",
  "7:00 PM", "7:30 PM",
  "8:00 PM", "8:30 PM",
  "9:00 PM", "9:30 PM",
  "10:00 PM", "10:30 PM",
  "11:00 PM", "11:30 PM",
];

export function getDefaultMultiWindowAvailability(): DayAvailability[] {
  return DAYS_OF_WEEK.map((_, index) => ({
    dayOfWeek: index,
    isAvailable: index >= 1 && index <= 5,
    windows: [{ startTime: "9:00 AM", endTime: "5:00 PM" }],
  }));
}

export function convertLegacyHoursToMultiWindow(
  legacyHours: { dayOfWeek: number; isAvailable: boolean; startTime: string; endTime: string }[]
): DayAvailability[] {
  return legacyHours.map(day => ({
    dayOfWeek: day.dayOfWeek,
    isAvailable: day.isAvailable,
    windows: day.isAvailable ? [{ startTime: day.startTime, endTime: day.endTime }] : [],
  }));
}

export default function MultiWindowHoursEditor({
  availability,
  onChange,
  onSave,
  isSaving = false,
  title = "Weekly Availability",
  description = "Set your recurring weekly hours. These will repeat every week.",
  showSaveButton = true,
}: MultiWindowHoursEditorProps) {
  const { theme } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"start" | "end">("start");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedWindowIndex, setSelectedWindowIndex] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const toggleAvailable = useCallback((dayIndex: number) => {
    const newAvailability = [...availability];
    const day = newAvailability[dayIndex];
    const newIsAvailable = !day.isAvailable;
    newAvailability[dayIndex] = {
      ...day,
      isAvailable: newIsAvailable,
      windows: newIsAvailable && day.windows.length === 0 
        ? [{ startTime: "9:00 AM", endTime: "5:00 PM" }]
        : day.windows,
    };
    onChange(newAvailability);
  }, [availability, onChange]);

  const addWindow = useCallback((dayIndex: number) => {
    const newAvailability = [...availability];
    const day = newAvailability[dayIndex];
    const lastWindow = day.windows[day.windows.length - 1];
    const newStartTime = lastWindow ? lastWindow.endTime : "9:00 AM";
    const startIdx = TIME_OPTIONS.indexOf(newStartTime);
    const newEndIdx = Math.min(startIdx + 4, TIME_OPTIONS.length - 1);
    
    newAvailability[dayIndex] = {
      ...day,
      windows: [...day.windows, { startTime: newStartTime, endTime: TIME_OPTIONS[newEndIdx] }],
    };
    onChange(newAvailability);
  }, [availability, onChange]);

  const removeWindow = useCallback((dayIndex: number, windowIndex: number) => {
    const newAvailability = [...availability];
    const day = newAvailability[dayIndex];
    
    if (day.windows.length === 1) {
      Alert.alert("Cannot Remove", "At least one time window is required for available days.");
      return;
    }
    
    newAvailability[dayIndex] = {
      ...day,
      windows: day.windows.filter((_, idx) => idx !== windowIndex),
    };
    onChange(newAvailability);
  }, [availability, onChange]);

  const openTimePicker = useCallback((dayIndex: number, windowIndex: number, type: "start" | "end") => {
    setSelectedDayIndex(dayIndex);
    setSelectedWindowIndex(windowIndex);
    setPickerType(type);
    setPickerVisible(true);
  }, []);

  const selectTime = useCallback((time: string) => {
    const newAvailability = [...availability];
    const day = newAvailability[selectedDayIndex];
    const newWindows = [...day.windows];
    
    if (pickerType === "start") {
      newWindows[selectedWindowIndex] = { ...newWindows[selectedWindowIndex], startTime: time };
    } else {
      newWindows[selectedWindowIndex] = { ...newWindows[selectedWindowIndex], endTime: time };
    }
    
    newAvailability[selectedDayIndex] = { ...day, windows: newWindows };
    onChange(newAvailability);
    setPickerVisible(false);
  }, [availability, onChange, pickerType, selectedDayIndex, selectedWindowIndex]);

  const copyToWeekdays = useCallback(() => {
    const monday = availability.find(h => h.dayOfWeek === 1);
    if (!monday) return;
    
    const newAvailability = availability.map(day => {
      if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
        return {
          ...day,
          isAvailable: monday.isAvailable,
          windows: [...monday.windows],
        };
      }
      return day;
    });
    onChange(newAvailability);
  }, [availability, onChange]);

  const formatWindowsPreview = (day: DayAvailability): string => {
    if (!day.isAvailable || day.windows.length === 0) return "Closed";
    if (day.windows.length === 1) {
      return `${day.windows[0].startTime} - ${day.windows[0].endTime}`;
    }
    return `${day.windows.length} time windows`;
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
    dayRow: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      overflow: "hidden",
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
    },
    dayName: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.text,
      width: 80,
    },
    dayPreview: {
      flex: 1,
      fontSize: 14,
      color: theme.textSecondary,
    },
    toggleSwitch: {
      width: 44,
      height: 24,
      borderRadius: 12,
      justifyContent: "center",
      padding: 2,
    },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#FFF",
    },
    expandButton: {
      padding: Spacing.xs,
      marginLeft: Spacing.sm,
    },
    windowsContainer: {
      padding: Spacing.md,
      paddingTop: 0,
      gap: Spacing.sm,
    },
    windowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    windowLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      width: 60,
    },
    timeButton: {
      flex: 1,
      backgroundColor: theme.card,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    timeButtonText: {
      fontSize: 14,
      color: theme.text,
      textAlign: "center",
    },
    removeWindowButton: {
      padding: Spacing.xs,
    },
    addWindowButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.primary,
    },
    addWindowText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "500",
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    copyButtonText: {
      fontSize: 13,
      color: theme.text,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.primary,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#000",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: BorderRadius.lg,
      width: "80%",
      maxHeight: "70%",
      padding: Spacing.md,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: Spacing.md,
      textAlign: "center",
    },
    timeOption: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    timeOptionText: {
      fontSize: 16,
      color: theme.text,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {availability.map((day, dayIndex) => (
        <View key={day.dayOfWeek} style={styles.dayRow}>
          <Pressable style={styles.dayHeader} onPress={() => setExpandedDay(expandedDay === dayIndex ? null : dayIndex)}>
            <Text style={styles.dayName}>{DAYS_OF_WEEK[day.dayOfWeek]}</Text>
            <Text style={styles.dayPreview}>{formatWindowsPreview(day)}</Text>
            <Pressable
              style={[
                styles.toggleSwitch,
                { backgroundColor: day.isAvailable ? theme.success : theme.backgroundSecondary }
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                toggleAvailable(dayIndex);
              }}
            >
              <View style={[styles.toggleKnob, { alignSelf: day.isAvailable ? "flex-end" : "flex-start" }]} />
            </Pressable>
            {day.isAvailable && (
              <Pressable style={styles.expandButton}>
                <Feather 
                  name={expandedDay === dayIndex ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={theme.textSecondary} 
                />
              </Pressable>
            )}
          </Pressable>

          {day.isAvailable && expandedDay === dayIndex && (
            <View style={styles.windowsContainer}>
              {day.windows.map((window, windowIndex) => (
                <View key={windowIndex} style={styles.windowRow}>
                  <Text style={styles.windowLabel}>Window {windowIndex + 1}</Text>
                  <Pressable
                    style={styles.timeButton}
                    onPress={() => openTimePicker(dayIndex, windowIndex, "start")}
                  >
                    <Text style={styles.timeButtonText}>{window.startTime}</Text>
                  </Pressable>
                  <Text style={{ color: theme.textSecondary }}>to</Text>
                  <Pressable
                    style={styles.timeButton}
                    onPress={() => openTimePicker(dayIndex, windowIndex, "end")}
                  >
                    <Text style={styles.timeButtonText}>{window.endTime}</Text>
                  </Pressable>
                  {day.windows.length > 1 && (
                    <Pressable
                      style={styles.removeWindowButton}
                      onPress={() => removeWindow(dayIndex, windowIndex)}
                    >
                      <Feather name="trash-2" size={16} color={theme.error} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable style={styles.addWindowButton} onPress={() => addWindow(dayIndex)}>
                <Feather name="plus" size={16} color={theme.primary} />
                <Text style={styles.addWindowText}>Add Time Window</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      <View style={styles.actionsRow}>
        <Pressable style={styles.copyButton} onPress={copyToWeekdays}>
          <Feather name="copy" size={16} color={theme.text} />
          <Text style={styles.copyButtonText}>Copy Mon to Weekdays</Text>
        </Pressable>
        {showSaveButton && onSave && (
          <Pressable style={styles.saveButton} onPress={onSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Feather name="check" size={16} color="#000" />
                <Text style={styles.saveButtonText}>Save Hours</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {pickerType === "start" ? "Start" : "End"} Time</Text>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable style={styles.timeOption} onPress={() => selectTime(item)}>
                  <Text style={styles.timeOptionText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

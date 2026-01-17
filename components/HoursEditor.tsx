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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export interface DayHours {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}

export interface HoursOfOperation {
  monday?: { open: string; close: string; closed: boolean };
  tuesday?: { open: string; close: string; closed: boolean };
  wednesday?: { open: string; close: string; closed: boolean };
  thursday?: { open: string; close: string; closed: boolean };
  friday?: { open: string; close: string; closed: boolean };
  saturday?: { open: string; close: string; closed: boolean };
  sunday?: { open: string; close: string; closed: boolean };
}

interface HoursEditorProps {
  hours: DayHours[];
  onChange: (hours: DayHours[]) => void;
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

export function getDefaultHours(): DayHours[] {
  return DAYS_OF_WEEK.map((_, index) => ({
    dayOfWeek: index,
    isAvailable: index >= 1 && index <= 5,
    startTime: "9:00 AM",
    endTime: "5:00 PM",
  }));
}

export function hoursArrayToObject(hours: DayHours[]): HoursOfOperation {
  const dayKeys: (keyof HoursOfOperation)[] = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
  ];
  
  const result: HoursOfOperation = {};
  hours.forEach((day) => {
    const key = dayKeys[day.dayOfWeek];
    result[key] = {
      open: day.startTime,
      close: day.endTime,
      closed: !day.isAvailable,
    };
  });
  return result;
}

export function hoursObjectToArray(hours: HoursOfOperation | null | undefined): DayHours[] {
  if (!hours) return getDefaultHours();
  
  const dayKeys: (keyof HoursOfOperation)[] = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
  ];
  
  return dayKeys.map((key, index) => {
    const dayHours = hours[key];
    if (dayHours) {
      return {
        dayOfWeek: index,
        isAvailable: !dayHours.closed,
        startTime: dayHours.open || "9:00 AM",
        endTime: dayHours.close || "5:00 PM",
      };
    }
    return {
      dayOfWeek: index,
      isAvailable: index >= 1 && index <= 5,
      startTime: "9:00 AM",
      endTime: "5:00 PM",
    };
  });
}

export default function HoursEditor({
  hours,
  onChange,
  onSave,
  isSaving = false,
  title = "Business Hours",
  description = "Set your operating hours for each day of the week",
  showSaveButton = true,
}: HoursEditorProps) {
  const { theme } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<"start" | "end">("start");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const toggleAvailable = useCallback((index: number) => {
    const newHours = [...hours];
    newHours[index] = {
      ...newHours[index],
      isAvailable: !newHours[index].isAvailable,
    };
    onChange(newHours);
  }, [hours, onChange]);

  const openTimePicker = useCallback((index: number, type: "start" | "end") => {
    setSelectedDayIndex(index);
    setPickerType(type);
    setPickerVisible(true);
  }, []);

  const selectTime = useCallback((time: string) => {
    const newHours = [...hours];
    if (pickerType === "start") {
      newHours[selectedDayIndex] = { ...newHours[selectedDayIndex], startTime: time };
    } else {
      newHours[selectedDayIndex] = { ...newHours[selectedDayIndex], endTime: time };
    }
    onChange(newHours);
    setPickerVisible(false);
  }, [hours, onChange, pickerType, selectedDayIndex]);

  const copyToWeekdays = useCallback(() => {
    const monday = hours.find(h => h.dayOfWeek === 1);
    if (!monday) return;
    
    const newHours = hours.map(day => {
      if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
        return {
          ...day,
          isAvailable: monday.isAvailable,
          startTime: monday.startTime,
          endTime: monday.endTime,
        };
      }
      return day;
    });
    onChange(newHours);
  }, [hours, onChange]);

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
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      backgroundColor: theme.backgroundSecondary,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    dayLabel: {
      width: 90,
      ...Typography.body,
      fontWeight: "500",
      color: theme.text,
    },
    toggleButton: {
      width: 44,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.sm,
    },
    toggleButtonActive: {
      backgroundColor: theme.success,
    },
    timesContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    timeButton: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 85,
      alignItems: "center",
    },
    timeText: {
      ...Typography.caption,
      color: theme.text,
    },
    timeSeparator: {
      ...Typography.caption,
      color: theme.textSecondary,
      marginHorizontal: Spacing.xs,
    },
    closedText: {
      flex: 1,
      ...Typography.caption,
      color: theme.textSecondary,
      fontStyle: "italic",
      textAlign: "right",
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    copyButtonText: {
      ...Typography.caption,
      color: theme.primary,
      marginLeft: Spacing.xs,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
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
      maxHeight: "50%",
    },
    pickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    pickerTitle: {
      ...Typography.subtitle,
      color: theme.text,
    },
    pickerCloseButton: {
      padding: Spacing.xs,
    },
    timeOption: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    timeOptionSelected: {
      backgroundColor: theme.primaryTransparent,
    },
    timeOptionText: {
      ...Typography.body,
      color: theme.text,
      textAlign: "center",
    },
    timeOptionTextSelected: {
      color: theme.primary,
      fontWeight: "600",
    },
  });

  const currentTime = pickerType === "start" 
    ? hours[selectedDayIndex]?.startTime 
    : hours[selectedDayIndex]?.endTime;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {hours.map((day, index) => (
        <View key={day.dayOfWeek} style={styles.dayRow}>
          <Text style={styles.dayLabel}>{DAYS_OF_WEEK[day.dayOfWeek]}</Text>
          
          <Pressable
            onPress={() => toggleAvailable(index)}
            style={[
              styles.toggleButton,
              day.isAvailable && styles.toggleButtonActive,
            ]}
          >
            <Feather
              name={day.isAvailable ? "check" : "x"}
              size={16}
              color={day.isAvailable ? "#FFFFFF" : theme.textSecondary}
            />
          </Pressable>

          {day.isAvailable ? (
            <View style={styles.timesContainer}>
              <Pressable
                style={styles.timeButton}
                onPress={() => openTimePicker(index, "start")}
              >
                <Text style={styles.timeText}>{day.startTime}</Text>
              </Pressable>
              <Text style={styles.timeSeparator}>to</Text>
              <Pressable
                style={styles.timeButton}
                onPress={() => openTimePicker(index, "end")}
              >
                <Text style={styles.timeText}>{day.endTime}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.closedText}>Closed</Text>
          )}
        </View>
      ))}

      <View style={styles.actionsRow}>
        <Pressable style={styles.copyButton} onPress={copyToWeekdays}>
          <Feather name="copy" size={14} color={theme.primary} />
          <Text style={styles.copyButtonText}>Copy Monday to weekdays</Text>
        </Pressable>

        {showSaveButton && onSave && (
          <Pressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="save" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? "Saving..." : "Save Hours"}
            </Text>
          </Pressable>
        )}
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setPickerVisible(false)}
        >
          <Pressable style={styles.pickerContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                Select {pickerType === "start" ? "Opening" : "Closing"} Time
              </Text>
              <Pressable
                style={styles.pickerCloseButton}
                onPress={() => setPickerVisible(false)}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.timeOption,
                    currentTime === item && styles.timeOptionSelected,
                  ]}
                  onPress={() => selectTime(item)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      currentTime === item && styles.timeOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
              initialScrollIndex={TIME_OPTIONS.indexOf(currentTime || "9:00 AM")}
              getItemLayout={(_, index) => ({
                length: 52,
                offset: 52 * index,
                index,
              })}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

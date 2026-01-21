import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, Pressable, ScrollView, TextInput, Alert, Platform, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useNotifications } from "@/context/NotificationContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { PhotographyCategory, CATEGORY_LABELS, TimeSlot, AvailabilitySlot } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";
import { computeAvailableDates } from "@/utils/availabilityUtils";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Booking">;

type BookingStep = "date" | "time" | "details" | "review";

const SESSION_TYPES: PhotographyCategory[] = ["wedding", "portrait", "events", "product", "nature", "fashion"];

export default function BookingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { photographer } = route.params;
  const { createSession } = useData();
  const { scheduleBookingConfirmation } = useNotifications();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<BookingStep>("date");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [location, setLocation] = useState("");
  const [sessionType, setSessionType] = useState<PhotographyCategory>(photographer.specialty);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookedSessionId, setBookedSessionId] = useState<string>("");
  
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [computedAvailability, setComputedAvailability] = useState<AvailabilitySlot[]>([]);
  
  const [viewingMonth, setViewingMonth] = useState(() => new Date());

  useEffect(() => {
    fetchAvailability();
  }, [photographer.id]);

  const fetchAvailability = async () => {
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    
    try {
      const [availResponse, blockedResponse] = await Promise.all([
        api.getPhotographerPublicAvailability(photographer.id).catch(() => ({ availability: [] })),
        api.getPhotographerPublicBlockedDates(photographer.id).catch(() => ({ blockedDates: [] })),
      ]);
      
      const computed = computeAvailableDates(
        availResponse.availability,
        blockedResponse.blockedDates,
        60,
        60
      );
      
      setComputedAvailability(computed);
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      setAvailabilityError("Unable to load availability. Please try again.");
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const availableDates = useMemo(() => {
    return computedAvailability.map(a => a.date);
  }, [computedAvailability]);
  
  const availableTimeSlots = useMemo(() => {
    const dayAvailability = computedAvailability.find(a => a.date === selectedDate);
    return dayAvailability?.timeSlots.filter(s => s.available) || [];
  }, [selectedDate, computedAvailability]);

  const currentMonthLabel = useMemo(() => {
    return viewingMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [viewingMonth]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: Array<{ day: number; date: string; isAvailable: boolean; isPast: boolean }> = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, date: "", isAvailable: false, isPast: false });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split("T")[0];
      const isAvailable = availableDates.includes(dateStr);
      const isPast = date < now;
      days.push({ day: i, date: dateStr, isAvailable, isPast });
    }
    
    return days;
  }, [viewingMonth, availableDates]);

  const handlePrevMonth = () => {
    const now = new Date();
    const prev = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1);
    if (prev >= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setViewingMonth(prev);
    }
  };

  const handleNextMonth = () => {
    const maxMonth = new Date();
    maxMonth.setMonth(maxMonth.getMonth() + 2);
    const next = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 1);
    if (next <= maxMonth) {
      setViewingMonth(next);
    }
  };

  const canGoPrev = useMemo(() => {
    const now = new Date();
    const prev = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1);
    return prev >= new Date(now.getFullYear(), now.getMonth(), 1);
  }, [viewingMonth]);

  const canGoNext = useMemo(() => {
    const maxMonth = new Date();
    maxMonth.setMonth(maxMonth.getMonth() + 2);
    const next = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 1);
    return next <= maxMonth;
  }, [viewingMonth]);

  const getPriceValue = (range: string) => {
    switch (range) {
      case "$": return 150;
      case "$$": return 300;
      case "$$$": return 500;
      case "$$$$": return 800;
      default: return 250;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleNext = () => {
    switch (step) {
      case "date":
        if (!selectedDate) {
          Alert.alert("Select Date", "Please select a date for your session");
          return;
        }
        setStep("time");
        break;
      case "time":
        if (!selectedTimeSlot) {
          Alert.alert("Select Time", "Please select a time slot");
          return;
        }
        setStep("details");
        break;
      case "details":
        if (!location.trim()) {
          Alert.alert("Location Required", "Please enter a location for your session");
          return;
        }
        setStep("review");
        break;
      case "review":
        handleConfirmBooking();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "time":
        setStep("date");
        break;
      case "details":
        setStep("time");
        break;
      case "review":
        setStep("details");
        break;
      default:
        navigation.goBack();
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedTimeSlot) return;
    
    setIsSubmitting(true);
    try {
      const session = await createSession(
        {
          photographerId: photographer.id,
          date: selectedDate,
          timeSlotId: selectedTimeSlot.id,
          location,
          sessionType,
          notes,
        },
        photographer,
        { startTime: selectedTimeSlot.startTime, endTime: selectedTimeSlot.endTime }
      );
      
      await scheduleBookingConfirmation(session);
      setBookedSessionId(session.id);
      setShowSuccessModal(true);
    } catch (error) {
      if (Platform.OS === "web") {
        window.alert("Failed to create booking. Please try again.");
      } else {
        Alert.alert("Error", "Failed to create booking. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayLater = () => {
    setShowSuccessModal(false);
    navigation.goBack();
    navigation.goBack();
  };

  const handlePayNow = () => {
    const sessionPrice = getPriceValue(photographer.priceRange);
    setShowSuccessModal(false);
    navigation.goBack();
    navigation.goBack();
    navigation.navigate("Payment", {
      sessionId: bookedSessionId,
      amount: sessionPrice,
      photographerName: photographer.name,
      sessionDate: formatDate(selectedDate),
    });
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {["date", "time", "details", "review"].map((s, index) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor:
                  step === s
                    ? theme.primary
                    : ["date", "time", "details", "review"].indexOf(step) > index
                    ? theme.success
                    : theme.backgroundSecondary,
              },
            ]}
          >
            {["date", "time", "details", "review"].indexOf(step) > index ? (
              <Feather name="check" size={14} color="#FFFFFF" />
            ) : (
              <ThemedText
                type="caption"
                style={{ color: step === s ? "#FFFFFF" : theme.textSecondary }}
              >
                {index + 1}
              </ThemedText>
            )}
          </View>
          {index < 3 ? (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    ["date", "time", "details", "review"].indexOf(step) > index
                      ? theme.success
                      : theme.backgroundSecondary,
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderDateStep = () => {
    if (isLoadingAvailability) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
            Loading availability...
          </ThemedText>
        </View>
      );
    }

    if (availabilityError) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary, textAlign: "center" }}>
            {availabilityError}
          </ThemedText>
          <Pressable
            onPress={fetchAvailability}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="button" style={{ color: "#FFFFFF" }}>
              Try Again
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>
          Select Date & Time
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Choose an available date for your session
        </ThemedText>

        <View style={styles.monthHeader}>
          <Pressable
            onPress={handlePrevMonth}
            disabled={!canGoPrev}
            style={[styles.monthArrow, { opacity: canGoPrev ? 1 : 0.3 }]}
          >
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4" style={styles.monthTitle}>
            {currentMonthLabel}
          </ThemedText>
          <Pressable
            onPress={handleNextMonth}
            disabled={!canGoNext}
            style={[styles.monthArrow, { opacity: canGoNext ? 1 : 0.3 }]}
          >
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekDays}>
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => (
            <ThemedText
              key={day}
              type="caption"
              style={[styles.weekDay, { color: theme.textSecondary }]}
            >
              {day}
            </ThemedText>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((item, index) => (
            <Pressable
              key={index}
              disabled={!item.isAvailable || item.isPast}
              onPress={() => setSelectedDate(item.date)}
              style={({ pressed }) => [
                styles.calendarDay,
                {
                  backgroundColor:
                    selectedDate === item.date
                      ? theme.primary
                      : item.isAvailable && !item.isPast
                      ? theme.backgroundDefault
                      : "transparent",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {item.day > 0 ? (
                <ThemedText
                  type="body"
                  style={{
                    color:
                      selectedDate === item.date
                        ? "#FFFFFF"
                        : item.isPast || !item.isAvailable
                        ? theme.textSecondary
                        : theme.text,
                    opacity: item.isPast || !item.isAvailable ? 0.4 : 1,
                  }}
                >
                  {item.day}
                </ThemedText>
              ) : null}
            </Pressable>
          ))}
        </View>

        {availableDates.length === 0 ? (
          <View style={styles.noAvailabilityMessage}>
            <Feather name="calendar" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              No availability set for this photographer.{"\n"}Please contact them directly.
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  };

  const renderTimeStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>
        Select Time
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        {formatDate(selectedDate)}
      </ThemedText>

      <View style={styles.timeSlots}>
        {availableTimeSlots.map(slot => (
          <Pressable
            key={slot.id}
            onPress={() => setSelectedTimeSlot(slot)}
            style={({ pressed }) => [
              styles.timeSlot,
              {
                backgroundColor:
                  selectedTimeSlot?.id === slot.id
                    ? theme.primary
                    : theme.backgroundDefault,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText
              type="body"
              style={{
                color: selectedTimeSlot?.id === slot.id ? "#FFFFFF" : theme.text,
              }}
            >
              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {availableTimeSlots.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="clock" size={32} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No available time slots for this date
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderDetailsStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>
        Session Details
      </ThemedText>
      <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Tell us about your session
      </ThemedText>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Location
        </ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
          value={location}
          onChangeText={setLocation}
          placeholder="Where should the session take place?"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Session Type
        </ThemedText>
        <View style={styles.sessionTypes}>
          {SESSION_TYPES.map(type => (
            <Pressable
              key={type}
              onPress={() => setSessionType(type)}
              style={({ pressed }) => [
                styles.sessionTypeChip,
                {
                  backgroundColor:
                    sessionType === type ? theme.primary : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: sessionType === type ? "#FFFFFF" : theme.text,
                }}
              >
                {CATEGORY_LABELS[type]}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <ThemedText type="small" style={styles.label}>
          Notes (Optional)
        </ThemedText>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special requests or details..."
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderReviewStep = () => {
    const sessionPrice = getPriceValue(photographer.priceRange);
    
    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>
          Review Booking
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Confirm your session details
        </ThemedText>

        <View style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.reviewHeader}>
            <Image
              source={{ uri: photographer.avatar }}
              style={styles.reviewAvatar}
              contentFit="cover"
            />
            <View>
              <ThemedText type="h4">{photographer.name}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {photographer.specialty ? CATEGORY_LABELS[photographer.specialty] : "Photography"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.reviewDivider} />

          <View style={styles.reviewItem}>
            <Feather name="calendar" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.reviewItemText}>
              {formatDate(selectedDate)}
            </ThemedText>
          </View>

          <View style={styles.reviewItem}>
            <Feather name="clock" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.reviewItemText}>
              {selectedTimeSlot ? `${formatTime(selectedTimeSlot.startTime)} - ${formatTime(selectedTimeSlot.endTime)}` : ""}
            </ThemedText>
          </View>

          <View style={styles.reviewItem}>
            <Feather name="map-pin" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.reviewItemText}>
              {location}
            </ThemedText>
          </View>

          <View style={styles.reviewItem}>
            <Feather name="camera" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.reviewItemText}>
              {CATEGORY_LABELS[sessionType]} Session
            </ThemedText>
          </View>

          <View style={styles.reviewDivider} />

          <View style={styles.reviewTotal}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Estimated Total
            </ThemedText>
            <ThemedText type="h3" style={{ color: theme.primary }}>
              ${sessionPrice}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case "date":
        return renderDateStep();
      case "time":
        return renderTimeStep();
      case "details":
        return renderDetailsStep();
      case "review":
        return renderReviewStep();
    }
  };

  const getNextButtonText = () => {
    switch (step) {
      case "date":
        return "NEXT";
      case "time":
        return "NEXT";
      case "details":
        return "REVIEW";
      case "review":
        return "CONFIRM BOOKING";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">Book Appointment</ThemedText>
        <View style={styles.headerButton} />
      </View>

      {renderStepIndicator()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { 
            backgroundColor: theme.background, 
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + Spacing.lg 
          },
        ]}
      >
        <View style={styles.footerContent}>
          <View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Starting at
            </ThemedText>
            <ThemedText type="h3" style={{ color: theme.primary }}>
              ${getPriceValue(photographer.priceRange).toFixed(2)}
            </ThemedText>
          </View>
          <Pressable
            onPress={handleNext}
            disabled={isSubmitting || isLoadingAvailability}
            style={({ pressed }) => [
              styles.nextButton,
              {
                backgroundColor: theme.primary,
                opacity: pressed || isSubmitting || isLoadingAvailability ? 0.8 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                {getNextButtonText()}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handlePayLater}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check-circle" size={40} color={theme.success} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Booking Confirmed!
            </ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Your session with {photographer.name} has been booked for {selectedDate ? formatDate(selectedDate) : ""}.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={handlePayLater}
                style={[
                  styles.modalButton,
                  styles.modalButtonSecondary,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText type="button" style={{ color: theme.text }}>
                  Pay Later
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handlePayNow}
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.primary },
                ]}
              >
                <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                  Pay Now
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  retryButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  monthArrow: {
    padding: Spacing.sm,
  },
  monthTitle: {
    textAlign: "center",
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  noAvailabilityMessage: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  timeSlots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  timeSlot: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  fieldContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  textArea: {
    height: 120,
    paddingTop: Spacing.md,
  },
  sessionTypes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  sessionTypeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  reviewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: Spacing.lg,
  },
  reviewItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  reviewItemText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  reviewTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 120,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
  },
  modalButtonSecondary: {},
  modalButtonPrimary: {},
});

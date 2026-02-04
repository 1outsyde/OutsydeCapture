import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import api, {
  BookingService,
  AvailabilityCalendarDay,
  AvailabilitySlot,
  BookingHoldResponse,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_SIZE = (SCREEN_WIDTH - Spacing.md * 2 - Spacing.xs * 6) / 7;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface BookingFlowProps {
  providerId: string;
  providerType: "photographer" | "business";
  providerName: string;
}

type Step = 1 | 2 | 3 | 4;

const formatPrice = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default function BookingFlow({
  providerId,
  providerType,
  providerName,
}: BookingFlowProps) {
  const { theme } = useTheme();
  const { getToken, isAuthenticated } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calendarDays, setCalendarDays] = useState<AvailabilityCalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [validatedEndTime, setValidatedEndTime] = useState<string | null>(null);
  const [hold, setHold] = useState<BookingHoldResponse | null>(null);
  const [holdTimeRemaining, setHoldTimeRemaining] = useState<number>(0);

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [validating, setValidating] = useState(false);
  const [creatingHold, setCreatingHold] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showIncompatibleModal, setShowIncompatibleModal] = useState(false);
  const [incompatibleReason, setIncompatibleReason] = useState<string>("");

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const selectedDateDisplay = useMemo(() => {
    if (!selectedDate) return "";
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }, [selectedDate]);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (step === 2 && selectedService) {
      fetchCalendar();
    }
  }, [step, currentMonth, selectedService]);

  useEffect(() => {
    if (step === 3 && selectedDate) {
      fetchSlots();
    }
  }, [step, selectedDate]);

  useEffect(() => {
    if (hold) {
      const updateTimer = () => {
        const remaining = Math.max(0, new Date(hold.expiresAt).getTime() - Date.now());
        setHoldTimeRemaining(remaining);
        if (remaining <= 0) {
          handleHoldExpired();
        }
      };
      updateTimer();
      holdTimerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      };
    }
  }, [hold]);

  const fetchServices = async () => {
    setLoadingServices(true);
    setError(null);
    try {
      const data = await api.getProviderServices(providerId, providerType);
      const activeServices = data.filter((s) => s.status === "live" || s.status === "active" || !s.status);
      setServices(activeServices);
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchCalendar = async () => {
    // Parse year and month from currentMonth (format: YYYY-MM)
    const [yearStr, monthStr] = currentMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // HARD GUARD: Do NOT call API unless ALL required params are defined
    if (!providerId || !providerType || !year || !month) {
      return;
    }

    setLoadingCalendar(true);
    try {
      console.log("[BookingFlow] Fetching calendar for:", { providerId, providerType, year, month });
      const response = await api.getAvailabilityCalendar(providerId, providerType, year, month);
      console.log("[BookingFlow] Calendar response:", JSON.stringify(response, null, 2));
      setCalendarDays(response.days || []);
    } catch (err: any) {
      console.error("[BookingFlow] Calendar fetch error:", err);
      setError(err.message || "Failed to load calendar");
    } finally {
      setLoadingCalendar(false);
    }
  };

  const fetchSlots = async () => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    try {
      const response = await api.getAvailabilitySlots(providerId, providerType, selectedDate);
      setSlots(response.slots?.filter((s) => s.status === "available") || []);
    } catch (err: any) {
      setError(err.message || "Failed to load time slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  const validateSlot = async (slot: AvailabilitySlot) => {
    if (!selectedService || !selectedDate) return;
    
    const token = await getToken();
    if (!token) {
      setError("Please sign in to book");
      return;
    }

    setValidating(true);
    try {
      const response = await api.validateBookingSlot(token, {
        providerId,
        providerType,
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: slot.startTime,
      });

      if (response.valid) {
        setSelectedSlot(slot);
        setValidatedEndTime(response.endTime || null);
        await createHold(slot);
      } else {
        setIncompatibleReason(response.reason || "This service requires more time than this slot allows.");
        setShowIncompatibleModal(true);
      }
    } catch (err: any) {
      setIncompatibleReason(err.message || "This slot is not compatible with the selected service.");
      setShowIncompatibleModal(true);
    } finally {
      setValidating(false);
    }
  };

  const createHold = async (slot: AvailabilitySlot) => {
    if (!selectedService || !selectedDate) return;
    
    const token = await getToken();
    if (!token) return;

    setCreatingHold(true);
    try {
      const response = await api.createBookingHold(token, {
        providerId,
        providerType,
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: slot.startTime,
      });

      if (response.success) {
        setHold(response);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep(4);
      }
    } catch (err: any) {
      setError(err.message || "Failed to hold slot");
    } finally {
      setCreatingHold(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!hold) return;
    
    const token = await getToken();
    if (!token) return;

    setConfirming(true);
    try {
      const baseUrl = Platform.OS === "web" 
        ? window.location.origin 
        : "outsyde://";
      const successUrl = `${baseUrl}/booking-success`;
      const cancelUrl = `${baseUrl}/booking-cancel`;

      const response = await api.confirmBooking(token, hold.holdId, successUrl, cancelUrl);

      if (response.checkoutUrl) {
        if (Platform.OS === "web") {
          window.location.href = response.checkoutUrl;
        } else {
          await WebBrowser.openBrowserAsync(response.checkoutUrl);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to confirm booking");
    } finally {
      setConfirming(false);
    }
  };

  const handleHoldExpired = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setHold(null);
    setSelectedSlot(null);
    setStep(3);
    setError("Your hold has expired. Please select a new time slot.");
  };

  const handleRequestAccommodation = () => {
    setShowIncompatibleModal(false);
    const message = `Hi! I'd like to book ${selectedService?.name} on ${selectedDateDisplay}. Is there any way to accommodate this service at a time that works?`;
    
    navigation.dispatch(
      CommonActions.navigate({
        name: "Messages",
        params: {
          prefilledMessage: message,
          recipientId: providerId,
          recipientType: providerType,
          recipientName: providerName,
        },
      })
    );
  };

  const handleServiceSelect = (service: BookingService) => {
    Haptics.selectionAsync();
    setSelectedService(service);
    setStep(2);
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const handleDateSelect = (date: string, status: string) => {
    if (status === "past" || status === "unavailable") return;
    Haptics.selectionAsync();
    setSelectedDate(date);
    setSlots([]);
    setStep(3);
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    Haptics.selectionAsync();
    validateSlot(slot);
  };

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    const [year, month] = currentMonth.split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    const now = new Date();
    if (prev >= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setCurrentMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
    }
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync();
    const [year, month] = currentMonth.split("-").map(Number);
    const next = new Date(year, month, 1);
    const threeMonthsAhead = new Date();
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);
    if (next <= threeMonthsAhead) {
      setCurrentMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
    }
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (step === 2) {
      setStep(1);
      setSelectedService(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedDate(null);
      setSlots([]);
    } else if (step === 4 && hold) {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      setHold(null);
      setStep(3);
    }
  };

  const formatHoldTime = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
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

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.authPrompt}>
          <Feather name="lock" size={32} color={theme.textMuted} />
          <ThemedText style={[styles.authText, { color: theme.textMuted }]}>
            Sign in to book appointments
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="h3" style={styles.header}>
        Book Appointment
      </ThemedText>

      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                {
                  backgroundColor: step >= s ? theme.primary : theme.backgroundSecondary,
                  borderColor: step >= s ? theme.primary : theme.border,
                },
              ]}
            >
              {step > s ? (
                <Feather name="check" size={12} color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: step >= s ? "#FFFFFF" : theme.textMuted, fontSize: 12 }}>
                  {s}
                </ThemedText>
              )}
            </View>
            <ThemedText style={[styles.progressLabel, { color: step >= s ? theme.text : theme.textMuted }]}>
              {s === 1 ? "Service" : s === 2 ? "Date" : s === 3 ? "Time" : "Confirm"}
            </ThemedText>
          </View>
        ))}
      </View>

      {step > 1 && !hold && (
        <Pressable onPress={goBack} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color={theme.primary} />
          <ThemedText style={{ color: theme.primary, marginLeft: Spacing.xs }}>Back</ThemedText>
        </Pressable>
      )}

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.error + "20" }]}>
          <Feather name="alert-circle" size={16} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
          <Pressable onPress={() => setError(null)}>
            <Feather name="x" size={16} color={theme.error} />
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepContent}>
          <ThemedText type="body" style={[styles.stepTitle, { fontWeight: "600" }]}>
            Select a Service
          </ThemedText>
          {loadingServices ? (
            <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
          ) : services.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={32} color={theme.textMuted} />
              <ThemedText style={{ color: theme.textMuted, marginTop: Spacing.sm }}>
                No services available
              </ThemedText>
            </View>
          ) : (
            services.map((service) => (
              <Pressable
                key={service.id}
                onPress={() => handleServiceSelect(service)}
                style={[
                  styles.serviceCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.serviceInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {service.name}
                  </ThemedText>
                  {service.description ? (
                    <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.xs }} numberOfLines={2}>
                      {service.description}
                    </ThemedText>
                  ) : null}
                  <View style={styles.serviceMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={14} color={theme.textSecondary} />
                      <ThemedText style={{ color: theme.textSecondary, marginLeft: 4 }}>
                        {formatDuration(service.durationMinutes)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <View style={styles.servicePrice}>
                  <ThemedText type="body" style={{ fontWeight: "700", color: theme.primary }}>
                    {formatPrice(service.priceCents)}
                  </ThemedText>
                  <Feather name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContent}>
          <ThemedText type="body" style={[styles.stepTitle, { fontWeight: "600" }]}>
            Select a Date
          </ThemedText>
          <View style={[styles.selectedServiceSummary, { backgroundColor: theme.primaryTransparent }]}>
            <ThemedText style={{ fontWeight: "600" }}>{selectedService?.name}</ThemedText>
            <ThemedText style={{ color: theme.textSecondary }}>
              {formatDuration(selectedService?.durationMinutes || 0)} • {formatPrice(selectedService?.priceCents || 0)}
            </ThemedText>
          </View>

          <View style={styles.monthNav}>
            <Pressable onPress={handlePrevMonth} hitSlop={12}>
              <Feather name="chevron-left" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{monthDisplay}</ThemedText>
            <Pressable onPress={handleNextMonth} hitSlop={12}>
              <Feather name="chevron-right" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={[styles.weekdayCell, { width: DAY_SIZE }]}>
                <ThemedText style={[styles.weekdayText, { color: theme.textSecondary }]}>{day}</ThemedText>
              </View>
            ))}
          </View>

          {loadingCalendar ? (
            <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
          ) : (
            <View style={styles.calendarGrid}>
              {calendarGrid.map((cell, index) => (
                <Pressable
                  key={index}
                  onPress={() => cell.date && cell.status && handleDateSelect(cell.date, cell.status)}
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
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <ThemedText type="body" style={[styles.stepTitle, { fontWeight: "600" }]}>
            Select a Time
          </ThemedText>
          <View style={[styles.selectedServiceSummary, { backgroundColor: theme.primaryTransparent }]}>
            <ThemedText style={{ fontWeight: "600" }}>{selectedService?.name}</ThemedText>
            <ThemedText style={{ color: theme.textSecondary }}>
              {selectedDateDisplay} • {formatPrice(selectedService?.priceCents || 0)}
            </ThemedText>
          </View>

          {loadingSlots || validating || creatingHold ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {validating ? "Validating..." : creatingHold ? "Holding slot..." : "Loading..."}
              </ThemedText>
            </View>
          ) : slots.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="clock" size={32} color={theme.textMuted} />
              <ThemedText style={{ color: theme.textMuted, marginTop: Spacing.sm }}>
                No available time slots
              </ThemedText>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => (
                <Pressable
                  key={slot.id}
                  onPress={() => handleSlotSelect(slot)}
                  style={[
                    styles.slotButton,
                    {
                      backgroundColor: theme.success + "20",
                      borderColor: theme.success,
                    },
                  ]}
                >
                  <ThemedText style={{ fontWeight: "600" }}>{slot.startTime}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {step === 4 && hold && (
        <View style={styles.stepContent}>
          <View style={[styles.holdBanner, { backgroundColor: theme.warning + "20" }]}>
            <Feather name="clock" size={16} color={theme.warning} />
            <ThemedText style={{ color: theme.warning, marginLeft: Spacing.xs, fontWeight: "600" }}>
              Slot held for {formatHoldTime(holdTimeRemaining)}
            </ThemedText>
          </View>

          <ThemedText type="body" style={[styles.stepTitle, { fontWeight: "600" }]}>
            Confirm Booking
          </ThemedText>

          <View style={[styles.confirmationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.confirmRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Service</ThemedText>
              <ThemedText style={{ fontWeight: "600" }}>{hold.service.name}</ThemedText>
            </View>
            <View style={styles.confirmRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Duration</ThemedText>
              <ThemedText>{formatDuration(hold.service.durationMinutes)}</ThemedText>
            </View>
            <View style={styles.confirmRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Date</ThemedText>
              <ThemedText>{new Date(hold.slot.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</ThemedText>
            </View>
            <View style={styles.confirmRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Time</ThemedText>
              <ThemedText>{hold.slot.startTime} - {hold.slot.endTime}</ThemedText>
            </View>
            <View style={[styles.confirmRow, styles.totalRow, { borderTopColor: theme.border }]}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>Total</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: theme.primary, fontSize: 18 }}>
                {formatPrice(hold.service.priceCents)}
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={handleConfirmBooking}
            disabled={confirming || holdTimeRemaining <= 0}
            style={[
              styles.confirmButton,
              {
                backgroundColor: holdTimeRemaining <= 0 ? theme.textMuted : theme.primary,
                opacity: confirming ? 0.7 : 1,
              },
            ]}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="credit-card" size={20} color="#FFFFFF" />
                <ThemedText style={styles.confirmButtonText}>
                  {holdTimeRemaining <= 0 ? "Hold Expired" : "Pay Now"}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      )}

      <Modal
        visible={showIncompatibleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIncompatibleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Feather name="alert-circle" size={40} color={theme.warning} />
            <ThemedText type="body" style={[styles.modalTitle, { fontWeight: "600" }]}>
              Slot Unavailable
            </ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.textSecondary }]}>
              {incompatibleReason}
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowIncompatibleModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText>Find Another Time</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleRequestAccommodation}
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF" }}>Request Accommodation</ThemedText>
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
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  progressItem: {
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  progressLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  stepContent: {
    minHeight: 200,
  },
  stepTitle: {
    marginBottom: Spacing.md,
  },
  loader: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  authPrompt: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  authText: {
    textAlign: "center",
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceMeta: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  servicePrice: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  selectedServiceSummary: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
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
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  slotButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  holdBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  confirmationCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    width: "100%",
    gap: Spacing.sm,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});

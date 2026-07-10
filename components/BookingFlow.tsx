import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStripe } from "@stripe/stripe-react-native";
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
import { Spacing, BorderRadius, Typography, FontSizes } from "@/constants/theme";
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
  staffMemberId?: string | null;
  accentColor?: string;
}

type Step = 1 | 2 | 3 | 4;

const formatPrice = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

const formatAmount = (dollars: number): string => {
  return `$${dollars.toFixed(2)}`;
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
  staffMemberId,
  accentColor,
}: BookingFlowProps) {
  const { theme } = useTheme();
  const accent = accentColor || theme.brandGold;
  const accentDim = accentColor ? accentColor + "CC" : theme.brandGoldDim;
  const accentSoft = accentColor ? accentColor + "25" : theme.brandGold + "25";
  const { getToken, isAuthenticated } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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

    // Leading offset cells: show real previous-month dates, dimmed and non-selectable
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      const prevDay = daysInPrevMonth - (firstDay - 1 - i);
      grid.push({ date: null, dayNum: prevDay, status: "past", isToday: false });
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

    // Trailing overflow cells: fill remainder of last row with next-month dates
    const trailingCells = (firstDay + daysInMonth) % 7 === 0
      ? 0
      : 7 - ((firstDay + daysInMonth) % 7);
    for (let i = 1; i <= trailingCells; i++) {
      grid.push({ date: null, dayNum: i, status: "past", isToday: false });
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
      const response = await api.getAvailabilityCalendar(providerId, providerType, year, month, selectedService?.durationMinutes ?? 60);
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
    if (!selectedDate || !selectedService) return;
    setLoadingSlots(true);
    try {
      const serviceDuration = selectedService.durationMinutes || 60;
      console.log("[BookingFlow] Fetching slots for:", { providerId, providerType, selectedDate, serviceDuration });
      const response = await api.getAvailabilitySlots(providerId, providerType, selectedDate, serviceDuration);
      console.log("[BookingFlow] Slots response:", JSON.stringify(response, null, 2));
      const availableSlots = response.slots?.filter((s) => s.status === "available") || [];
      console.log("[BookingFlow] Available slots count:", availableSlots.length);
      setSlots(availableSlots);
    } catch (err: any) {
      console.error("[BookingFlow] Slots fetch error:", err);
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
        ...(staffMemberId ? { staffMemberId } : {}),
      } as Parameters<typeof api.createBookingHold>[1]);

      if (response.success) {
        setHold(response);

        const paymentData = await api.createHoldPaymentIntent(response.holdId);

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "Outsyde",
          paymentIntentClientSecret: paymentData.clientSecret,
          defaultBillingDetails: { name: providerName },
        });
        if (initError) throw new Error(initError.message);

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === "Canceled") return;
          throw new Error(presentError.message);
        }

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
      base.backgroundColor = accent;
    } else if (status === "available") {
      base.backgroundColor = theme.brandSuccess + "25";
    } else if (status === "partial") {
      base.backgroundColor = accentSoft;
    } else if (status === "unavailable" || status === "past") {
      base.backgroundColor = theme.brandSurfaceBorder;
    }

    if (isToday && !isSelected) {
      base.borderWidth = 2;
      base.borderColor = accent;
    }

    return base;
  };

  const getDayTextColor = (status: string | null, isSelected: boolean) => {
    if (isSelected) return theme.brandBg;
    if (status === "past" || status === "unavailable") return theme.brandTextDim;
    return theme.brandCream;
  };

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.brandBg }]}>
        <View style={styles.authPrompt}>
          <Feather name="lock" size={32} color={theme.brandTextDim} />
          <ThemedText style={[styles.authText, { color: theme.brandTextDim }]}>
            Sign in to book appointments
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.brandBg }]}>
      <View style={[styles.headerBar, { backgroundColor: theme.brandBgElevated, borderBottomColor: theme.brandSurfaceBorder }]}>
        <ThemedText type="h3" style={{ color: theme.brandCream }}>
          Book Appointment
        </ThemedText>
      </View>

      <View style={styles.stepperRow}>
        {[1, 2, 3, 4].map((s, i) => (
          <View key={s} style={styles.stepperItem}>
            {i > 0 && (
              <View style={[styles.stepConnector, { backgroundColor: step >= s ? accentDim : theme.brandSurfaceBorder }]} />
            )}
            <View style={styles.stepDotWrap}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: step >= s ? accent : theme.brandSurfaceBorder,
                  },
                ]}
              >
                {step > s ? (
                  <Feather name="check" size={12} color={theme.brandBg} />
                ) : (
                  <ThemedText style={{ color: step >= s ? theme.brandBg : theme.brandTextDim, fontSize: FontSizes.xs, fontWeight: "700" }}>
                    {s}
                  </ThemedText>
                )}
              </View>
              <ThemedText style={[styles.stepLabel, { color: step >= s ? accent : theme.brandTextDim }]}>
                {s === 1 ? "Service" : s === 2 ? "Date" : s === 3 ? "Time" : "Confirm"}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {step > 1 && !hold && (
        <Pressable onPress={goBack} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color={accent} />
          <ThemedText style={{ color: accent, marginLeft: Spacing.xs }}>Back</ThemedText>
        </Pressable>
      )}

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.brandError + "20", borderColor: theme.brandError }]}>
          <Feather name="alert-circle" size={16} color={theme.brandError} />
          <ThemedText style={[styles.errorText, { color: theme.brandError }]}>{error}</ThemedText>
          <Pressable onPress={() => setError(null)}>
            <Feather name="x" size={16} color={theme.brandError} />
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepContent}>
          <ThemedText style={[styles.stepTitle, { color: theme.brandCream }]}>
            Select a Service
          </ThemedText>
          {loadingServices ? (
            <ActivityIndicator size="large" color={accent} style={styles.loader} />
          ) : services.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={32} color={theme.brandTextDim} />
              <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
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
                    backgroundColor: theme.brandBgElevated,
                    borderColor: theme.brandSurfaceBorder,
                  },
                ]}
              >
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceName, { color: theme.brandCream }]}>
                    {service.name}
                  </ThemedText>
                  {service.description ? (
                    <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.xs }} numberOfLines={2}>
                      {service.description}
                    </ThemedText>
                  ) : null}
                  <View style={styles.serviceMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={14} color={theme.brandTextDim} />
                      <ThemedText style={{ color: theme.brandTextDim, marginLeft: Spacing.xs }}>
                        {formatDuration(service.durationMinutes)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <View style={styles.servicePrice}>
                  <ThemedText style={[styles.priceText, { color: accent }]}>
                    {formatPrice(service.priceCents)}
                  </ThemedText>
                  <Feather name="chevron-right" size={20} color={theme.brandTextDim} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContent}>
          <ThemedText style={[styles.stepTitle, { color: theme.brandCream }]}>
            Select a Date
          </ThemedText>
          <View style={[styles.selectedServiceSummary, { backgroundColor: accentSoft }]}>
            <ThemedText style={{ fontWeight: "600", color: theme.brandCream }}>{selectedService?.name}</ThemedText>
            <ThemedText style={{ color: theme.brandTextDim }}>
              {formatDuration(selectedService?.durationMinutes || 0)} • {formatPrice(selectedService?.priceCents || 0)}
            </ThemedText>
          </View>

          <View style={styles.monthNav}>
            <Pressable onPress={handlePrevMonth} hitSlop={12}>
              <Feather name="chevron-left" size={24} color={theme.brandCream} />
            </Pressable>
            <ThemedText style={[styles.monthTitle, { color: theme.brandCream }]}>{monthDisplay}</ThemedText>
            <Pressable onPress={handleNextMonth} hitSlop={12}>
              <Feather name="chevron-right" size={24} color={theme.brandCream} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={[styles.weekdayCell, { width: DAY_SIZE }]}>
                <ThemedText style={[styles.weekdayText, { color: theme.brandTextDim }]}>{day}</ThemedText>
              </View>
            ))}
          </View>

          {loadingCalendar ? (
            <ActivityIndicator size="large" color={accent} style={styles.loader} />
          ) : (
            <View style={styles.calendarGrid}>
              {calendarGrid.map((cell, index) => {
                if (cell.date === null) {
                  return (
                    <View
                      key={index}
                      pointerEvents="none"
                      style={{
                        width: DAY_SIZE,
                        height: DAY_SIZE,
                        borderRadius: BorderRadius.sm,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {cell.dayNum !== null && (
                        <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm }}>
                          {cell.dayNum}
                        </ThemedText>
                      )}
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={index}
                    onPress={() => cell.date && cell.status && handleDateSelect(cell.date, cell.status)}
                    disabled={!cell.date || cell.status === "past" || cell.status === "unavailable"}
                    style={getDayStyle(cell.status, selectedDate === cell.date, cell.isToday)}
                  >
                    {cell.dayNum !== null && (
                      <ThemedText
                        style={{
                          color: getDayTextColor(cell.status, selectedDate === cell.date),
                          fontWeight: cell.isToday ? "700" : "400",
                          fontSize: FontSizes.sm,
                        }}
                      >
                        {cell.dayNum}
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <ThemedText style={[styles.stepTitle, { color: theme.brandCream }]}>
            Select a Time
          </ThemedText>
          <View style={[styles.selectedServiceSummary, { backgroundColor: accentSoft }]}>
            <ThemedText style={{ fontWeight: "600", color: theme.brandCream }}>{selectedService?.name}</ThemedText>
            <ThemedText style={{ color: theme.brandTextDim }}>
              {selectedDateDisplay} • {formatPrice(selectedService?.priceCents || 0)}
            </ThemedText>
          </View>

          {loadingSlots || validating || creatingHold ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={accent} />
              <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
                {validating ? "Validating..." : creatingHold ? "Holding slot..." : "Loading..."}
              </ThemedText>
            </View>
          ) : slots.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="clock" size={32} color={theme.brandTextDim} />
              <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
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
                      backgroundColor: theme.brandBgElevated,
                      borderColor: theme.brandSurfaceBorder,
                    },
                  ]}
                >
                  <ThemedText style={{ fontWeight: "600", color: theme.brandCream }}>{slot.startTime}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {step === 4 && (
        <View style={[styles.stepContent, styles.successContainer]}>
          <Feather name="check-circle" size={64} color={theme.brandSuccess} />
          <ThemedText style={[styles.successTitle, { color: theme.brandCream }]}>
            Booking confirmed!
          </ThemedText>
          <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.sm, textAlign: "center" }}>
            Your appointment has been booked and payment processed.
          </ThemedText>
          <Pressable
            onPress={() => navigation.dispatch(CommonActions.navigate({ name: "Sessions" }))}
            style={[styles.primaryButton, { backgroundColor: theme.brandPrimary, marginTop: Spacing.xl }]}
          >
            <ThemedText style={[styles.primaryButtonText, { color: theme.brandPrimaryText }]}>Done</ThemedText>
          </Pressable>
        </View>
      )}

      <Modal
        visible={showIncompatibleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIncompatibleModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.brandBgElevated }]}>
            <Feather name="alert-circle" size={40} color={theme.brandGold} />
            <ThemedText type="body" style={[styles.modalTitle, { fontWeight: "600", color: theme.brandCream }]}>
              Slot Unavailable
            </ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.brandTextDim }]}>
              {incompatibleReason}
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowIncompatibleModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.brandSurfaceBorder }]}
              >
                <ThemedText style={{ color: theme.brandCream }}>Find Another Time</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleRequestAccommodation}
                style={[styles.modalButton, { backgroundColor: theme.brandPrimary }]}
              >
                <ThemedText style={{ color: theme.brandPrimaryText }}>Request Accommodation</ThemedText>
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
    padding: Spacing.md,
  },
  headerBar: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    marginHorizontal: -Spacing.md,
    marginTop: -Spacing.md,
    marginBottom: Spacing.md,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  stepperItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  stepConnector: {
    height: 2,
    flex: 1,
  },
  stepDotWrap: {
    alignItems: "center",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xxs,
    fontWeight: "600",
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
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
  },
  stepContent: {
    minHeight: 200,
  },
  stepTitle: {
    ...Typography.h4,
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
    ...Typography.body,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    ...Typography.h4,
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
  priceText: {
    ...Typography.h4,
    fontWeight: "700",
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
  monthTitle: {
    ...Typography.h3,
  },
  weekdayRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    alignItems: "center",
  },
  weekdayText: {
    ...Typography.small,
    fontWeight: "600",
    textTransform: "uppercase",
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  successTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    minHeight: Spacing.buttonHeight,
  },
  primaryButtonText: {
    ...Typography.button,
  },
  modalOverlay: {
    flex: 1,
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
    ...Typography.body,
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

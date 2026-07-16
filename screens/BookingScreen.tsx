import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  StyleSheet, View, Pressable, ScrollView, TextInput,
  Alert, Modal, ActivityIndicator, useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripePayment } from "@/hooks/useStripePayment";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useNotifications } from "@/context/NotificationContext";
import { Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { resolveBrandColor, parseBrandColorSpec } from "@/constants/colorOptions";
import api, {
  BookingService,
  AvailabilityCalendarDay,
  AvailabilitySlot,
  BookingHoldResponse,
} from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Booking">;
type Step = 1 | 2 | 3 | 4 | 5;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type PhotographerData = {
  id: string;
  name: string;
  avatar?: string;
  specialty?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  bio?: string;
  studioAddress?: string | null;
  vendorTermsAndConditions?: string | null;
  autoAcceptBookings?: boolean;
  brandColors?: string;
};

type CalendarGridCell = {
  date: string | null;
  dayNum: number | null;
  status: "available" | "partial" | "unavailable" | "past" | null;
  isToday: boolean;
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const formatTime = (time24: string): string => {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minuteStr} ${period}`;
};

const formatDate = (dateString: string): string => {
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const groupSlots = (slots: AvailabilitySlot[]) => ({
  morning: slots.filter((s) => parseInt(s.startTime.split(":")[0], 10) < 12),
  afternoon: slots.filter((s) => parseInt(s.startTime.split(":")[0], 10) >= 12),
});

// ─── Cancellation policy helpers ──────────────────────────────────────────────

const CANCELLATION_WINDOW_HOURS: Record<string, number> = {
  "1_week": 168, "48_hours": 48, "24_hours": 24, "1_hour": 1,
};

function cancellationWindowLabel(w: string): string {
  switch (w) {
    case "1_week": return "1 week";
    case "48_hours": return "48 hours";
    case "24_hours": return "24 hours";
    case "1_hour": return "1 hour";
    default: return w;
  }
}

function cancellationFeeLabel(type?: string | null, amount?: number | null): string {
  if (!type || amount == null) return "a cancellation fee";
  if (type === "flat") {
    const dollars = amount / 100;
    return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  }
  return `${amount}% of the booking total`;
}

function formatCancellationCutoff(apptDate: string, apptTime: string, windowHours: number): string {
  const timeStr = apptTime.length === 5 ? `${apptTime}:00` : apptTime;
  const apptMs = new Date(`${apptDate}T${timeStr}`).getTime();
  return new Date(apptMs - windowHours * 3_600_000).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function shortCancellationSummary(service: BookingService): string {
  const fullWindow = service.fullRefundWindow ?? "never";
  const hasFee = !!service.hasCancellationFee;
  if (fullWindow === "never") return hasFee ? "Non-refundable · cancellation fee applies" : "Non-refundable";
  const label = cancellationWindowLabel(fullWindow);
  return hasFee
    ? `Free cancellation until ${label} before · fee after`
    : `Free cancellation until ${label} before appointment`;
}

function describeCancellationPolicyForService(
  service: BookingService,
  selectedDate: string,
  slotStartTime: string,
): string {
  const fullWindow = service.fullRefundWindow ?? "never";
  const hasPartial = !!service.hasPartialRefund;
  const hasFee = !!service.hasCancellationFee;
  const fee = hasFee ? cancellationFeeLabel(service.cancellationFeeType, service.cancellationFeeAmount) : null;

  if (fullWindow === "never") {
    return hasFee
      ? `This booking is non-refundable. A ${fee} cancellation fee applies if you cancel.`
      : "This booking is non-refundable.";
  }

  const fullHours = CANCELLATION_WINDOW_HOURS[fullWindow] ?? 0;
  const fullCutoff = formatCancellationCutoff(selectedDate, slotStartTime, fullHours);

  if (hasPartial && service.partialRefundWindow && service.partialRefundPercentage != null) {
    const partHours = CANCELLATION_WINDOW_HOURS[service.partialRefundWindow] ?? 0;
    const partCutoff = formatCancellationCutoff(selectedDate, slotStartTime, partHours);
    const pct = service.partialRefundPercentage;
    if (hasFee) {
      return (
        `Full refund until ${cancellationWindowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
        `Between then and ${cancellationWindowLabel(service.partialRefundWindow)} before, you'll receive a ${pct}% refund — ` +
        `a ${fee} cancellation fee applies once you're past the full-refund window. ` +
        `No refund after ${partCutoff}, and the ${fee} fee still applies.`
      );
    }
    return (
      `Full refund until ${cancellationWindowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
      `Between then and ${cancellationWindowLabel(service.partialRefundWindow)} before (by ${partCutoff}), ` +
      `you'll receive a ${pct}% refund. No refund after that.`
    );
  }

  if (hasFee) {
    return (
      `Free cancellation until ${cancellationWindowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
      `After that, a ${fee} cancellation fee applies and no refund is given.`
    );
  }
  return (
    `Free cancellation until ${cancellationWindowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
    `No refund after that.`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingScreen() {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { photographer: routePhotographer, photographerId, preselectedServiceId } = route.params;
  const { getToken } = useAuth();
  const { refreshSessions } = useData();
  const { addNotification, sendBookingConfirmation, scheduleBookingReminders } = useNotifications();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

  const resolvedPhotographerId = photographerId || (routePhotographer as any)?.id || "";

  // ─── Photographer state ────────────────────────────────────────────────────
  const [photographer, setPhotographer] = useState<PhotographerData | null>(
    routePhotographer
      ? {
          id: (routePhotographer as any).id,
          name: (routePhotographer as any).displayName || (routePhotographer as any).name || "Photographer",
          avatar: (routePhotographer as any).logoImage || (routePhotographer as any).avatar,
          specialty: (routePhotographer as any).specialty,
          location: (routePhotographer as any).location,
          rating: (routePhotographer as any).rating,
          reviewCount: (routePhotographer as any).reviewCount,
          priceRange: (routePhotographer as any).priceRange,
          bio: (routePhotographer as any).bio || (routePhotographer as any).description,
          studioAddress: (routePhotographer as any).studioAddress ?? null,
          vendorTermsAndConditions: (routePhotographer as any).vendorTermsAndConditions ?? null,
          autoAcceptBookings: (routePhotographer as any).autoAcceptBookings ?? false,
          brandColors: (routePhotographer as any).brandColors,
        }
      : null
  );
  const [isLoadingPhotographer, setIsLoadingPhotographer] = useState(
    !routePhotographer && !!resolvedPhotographerId
  );

  // ─── Booking flow state ────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(preselectedServiceId ? 2 : 1);
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

  // ─── Loading / error ───────────────────────────────────────────────────────
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreatingHold, setIsCreatingHold] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Review step acknowledgment state ─────────────────────────────────────
  const [businessLocationAcknowledged, setBusinessLocationAcknowledged] = useState(false);
  const [alternateAcknowledged, setAlternateAcknowledged] = useState(false);
  const [customerServiceAddress, setCustomerServiceAddress] = useState("");
  const [customerServiceCity, setCustomerServiceCity] = useState("");
  const [customerServiceState, setCustomerServiceState] = useState("");
  const [customerServiceZipCode, setCustomerServiceZipCode] = useState("");
  const [customerReadinessConfirmed, setCustomerReadinessConfirmed] = useState(false);
  const [virtualLinkAcknowledged, setVirtualLinkAcknowledged] = useState(false);
  const [cancellationPolicyAcknowledged, setCancellationPolicyAcknowledged] = useState(false);
  const [platformTermsAcknowledged, setPlatformTermsAcknowledged] = useState(false);
  const [vendorTermsAcknowledged, setVendorTermsAcknowledged] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showVendorTermsModal, setShowVendorTermsModal] = useState(false);
  const [showIncompatibleModal, setShowIncompatibleModal] = useState(false);
  const [incompatibleReason, setIncompatibleReason] = useState("");

  // ─── Step 5 state ──────────────────────────────────────────────────────────
  const [bookedSessionId, setBookedSessionId] = useState<string>("");
  const [bookingPending, setBookingPending] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Accent color ─────────────────────────────────────────────────────────
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const accent = resolveBrandColor(parseBrandColorSpec(photographer?.brandColors ?? null), colorMode);
  const accentSoft = accent + "25";
  const accentDim = accent + "CC";

  // ─── Calendar grid ─────────────────────────────────────────────────────────
  const monthDate = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [currentMonth]);

  const monthDisplay = useMemo(
    () => `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`,
    [monthDate]
  );

  const calendarGrid = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const grid: CalendarGridCell[] = [];

    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      grid.push({ date: null, dayNum: daysInPrevMonth - (firstDay - 1 - i), status: "past", isToday: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(year, month, day);
      const isPast = dateObj < today;
      const isToday = dateObj.getTime() === today.getTime();
      const calDay = calendarDays.find((d: AvailabilityCalendarDay) => d.date === dateStr);
      const status = isPast ? "past" : calDay?.status || "unavailable";
      grid.push({ date: dateStr, dayNum: day, status, isToday });
    }

    const trailing = (firstDay + daysInMonth) % 7 === 0 ? 0 : 7 - ((firstDay + daysInMonth) % 7);
    for (let i = 1; i <= trailing; i++) {
      grid.push({ date: null, dayNum: i, status: "past", isToday: false });
    }
    return grid;
  }, [monthDate, calendarDays]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    // Always fetch the photographer from API to ensure we have studioAddress,
    // vendorTermsAndConditions, and autoAcceptBookings (not in older route data).
    // If routePhotographer was provided we use it as initial state and update
    // silently once the fetch completes.
    if (resolvedPhotographerId) fetchPhotographer();
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (photographer) fetchServices();
  }, [photographer?.id]);

  useEffect(() => {
    if (step === 2 && selectedService) fetchCalendar();
  }, [step, currentMonth, selectedService?.id]);

  useEffect(() => {
    if (step === 3 && selectedDate) fetchSlots();
  }, [step, selectedDate]);

  useEffect(() => {
    if (!hold) return;
    const updateTimer = () => {
      const remaining = Math.max(0, new Date(hold.expiresAt).getTime() - Date.now());
      setHoldTimeRemaining(remaining);
      if (remaining <= 0) handleHoldExpired();
    };
    updateTimer();
    holdTimerRef.current = setInterval(updateTimer, 1000);
    return () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current); };
  }, [hold]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchPhotographer = async () => {
    if (!resolvedPhotographerId) return;
    if (!routePhotographer) setIsLoadingPhotographer(true);
    try {
      const data = await api.getPhotographer(resolvedPhotographerId) as any;
      setPhotographer({
        id: data.id,
        name: data.displayName || data.name || "Photographer",
        avatar: data.logoImage || data.avatar,
        specialty: data.specialty,
        location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : undefined),
        rating: data.rating,
        reviewCount: data.reviewCount,
        priceRange: data.priceRange,
        bio: data.bio || data.description,
        studioAddress: data.studioAddress ?? null,
        vendorTermsAndConditions: data.vendorTermsAndConditions ?? null,
        autoAcceptBookings: data.autoAcceptBookings ?? false,
        brandColors: data.brandColors,
      });
    } catch (e) {
      console.error("Failed to fetch photographer:", e);
      if (!routePhotographer) setError("Unable to load photographer details. Please try again.");
    } finally {
      if (!routePhotographer) setIsLoadingPhotographer(false);
    }
  };

  const fetchServices = async () => {
    if (!photographer) return;
    setIsLoadingServices(true);
    setError(null);
    try {
      const data = await api.getProviderServices(photographer.id, "photographer");
      const active = data.filter((s) => s.status === "live" || s.status === "active" || !s.status);
      setServices(active);

      if (preselectedServiceId && active.length > 0) {
        const match = active.find((s) => s.id === preselectedServiceId)
          || (active.length === 1 ? active[0] : null);
        if (match) {
          setSelectedService(match);
          setStep(2);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setIsLoadingServices(false);
    }
  };

  const fetchCalendar = async () => {
    const [yearStr, monthStr] = currentMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (!photographer?.id || !year || !month) return;

    setIsLoadingCalendar(true);
    try {
      const response = await api.getAvailabilityCalendar(
        photographer.id, "photographer", year, month, selectedService?.durationMinutes ?? 60
      );
      setCalendarDays(response.days || []);
    } catch (err: any) {
      setError(err.message || "Failed to load calendar");
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const fetchSlots = async () => {
    if (!selectedDate || !selectedService || !photographer) return;
    setIsLoadingSlots(true);
    setError(null);
    try {
      const response = await api.getAvailabilitySlots(
        photographer.id, "photographer", selectedDate, selectedService.durationMinutes || 60
      );
      setSlots(response.slots?.filter((s) => s.status === "available") || []);
    } catch (err: any) {
      setError(err.message || "Failed to load time slots");
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // ─── Slot validation ──────────────────────────────────────────────────────

  const validateSlot = async (slot: AvailabilitySlot) => {
    if (!selectedService || !selectedDate || !photographer) return;
    const token = await getToken();
    if (!token) {
      Alert.alert("Sign In Required", "Please sign in to book an appointment.");
      return;
    }

    setIsValidating(true);
    try {
      const response = await api.validateBookingSlot(token, {
        providerId: photographer.id,
        providerType: "photographer",
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: slot.startTime,
      });
      if (response.valid) {
        Haptics.selectionAsync();
        setSelectedSlot(slot);
        setValidatedEndTime(response.endTime || null);
        resetReviewState();
        setStep(4);
      } else {
        setIncompatibleReason(response.reason || "This service requires more time than this slot allows.");
        setShowIncompatibleModal(true);
      }
    } catch (err: any) {
      setIncompatibleReason(err.message || "This slot is not compatible with the selected service.");
      setShowIncompatibleModal(true);
    } finally {
      setIsValidating(false);
    }
  };

  const resetReviewState = () => {
    setBusinessLocationAcknowledged(false);
    setAlternateAcknowledged(false);
    setCustomerReadinessConfirmed(false);
    setVirtualLinkAcknowledged(false);
    setCancellationPolicyAcknowledged(false);
    setPlatformTermsAcknowledged(false);
    setVendorTermsAcknowledged(false);
  };

  // ─── Location string for addSession ───────────────────────────────────────

  const deriveLocationString = (): string => {
    if (!selectedService) return "";
    const locType = selectedService.serviceLocationType;
    if (!locType || locType === "business") {
      return photographer?.studioAddress
        || photographer?.location
        || `${photographer?.name || "Photographer"}'s Studio`;
    }
    if (locType === "alternate") {
      return [
        selectedService.alternateAddress,
        [selectedService.alternateCity, selectedService.alternateState].filter(Boolean).join(", "),
        selectedService.alternateZipCode,
      ].filter(Boolean).join(" · ");
    }
    if (locType === "customer") {
      return [
        customerServiceAddress,
        [customerServiceCity, customerServiceState].filter(Boolean).join(", "),
        customerServiceZipCode,
      ].filter(Boolean).join(" · ");
    }
    if (locType === "virtual") return selectedService.virtualLink || "Virtual";
    return photographer?.location || "";
  };

  // ─── Hold + payment ───────────────────────────────────────────────────────

  const createHoldAndPay = async () => {
    if (!selectedService || !selectedDate || !selectedSlot || !photographer) return;
    const token = await getToken();
    if (!token) return;

    setIsCreatingHold(true);
    try {
      const holdResponse = await api.createBookingHold(token, {
        providerId: photographer.id,
        providerType: "photographer",
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: selectedSlot.startTime,
      });
      if (!holdResponse.success) throw new Error("Failed to hold slot");
      setHold(holdResponse);

      const customerAddress = selectedService.serviceLocationType === "customer"
        ? { customerServiceAddress, customerServiceCity, customerServiceState, customerServiceZipCode }
        : undefined;

      const paymentData = await api.createHoldPaymentIntent(holdResponse.holdId, customerAddress);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentData.clientSecret,
        merchantDisplayName: "Outsyde",
        allowsDelayedPaymentMethods: false,
      });
      if (initError) throw new Error(initError.message || "Failed to initialize payment");

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if ((presentError as any).code === "Canceled") {
          setIsCreatingHold(false);
          return;
        }
        throw new Error((presentError as any).message || "Payment failed");
      }

      // Payment succeeded
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);

      const isPending = !(photographer.autoAcceptBookings);
      setBookingPending(isPending);

      const locationStr = deriveLocationString();
      const endTime = validatedEndTime || holdResponse.slot.endTime || selectedSlot.endTime;
      const price = holdResponse.feeBreakdown?.grossChargeAmount ?? selectedService.priceCents / 100;
      const photographerName = photographer.name || "the photographer";
      const formattedDate = formatDate(selectedDate);
      const formattedTime = selectedSlot.startTime;

      try {
        await refreshSessions();

        await addNotification({
          type: "booking",
          title: isPending ? "Booking Submitted" : "Booking Confirmed",
          body: isPending
            ? `Your booking request with ${photographerName} on ${formattedDate} has been submitted. Awaiting provider approval (up to 24h).`
            : `Your session with ${photographerName} on ${formattedDate} has been confirmed.`,
        });

        if (!isPending) {
          await sendBookingConfirmation(photographerName, formattedDate, formattedTime);
          const [yr, mo, dy] = selectedDate.split("-").map(Number);
          const [hr, min] = selectedSlot.startTime.split(":").map(Number);
          await scheduleBookingReminders(
            photographerName, formattedDate, formattedTime,
            new Date(yr, mo - 1, dy, hr, min)
          );
        }
      } catch (sessionErr) {
        console.error("Failed to record session:", sessionErr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(5);
    } catch (err: any) {
      Alert.alert("Booking Error", err.message || "Something went wrong. Please try again.");
    } finally {
      setIsCreatingHold(false);
    }
  };

  const handleHoldExpired = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setHold(null);
    setSelectedSlot(null);
    setStep(3);
    Alert.alert("Slot Expired", "Your held slot has expired. Please select a new time slot.");
  };

  // ─── Navigation handlers ──────────────────────────────────────────────────

  const handleServiceSelect = (service: BookingService) => {
    Haptics.selectionAsync();
    setSelectedService(service);
    setSelectedDate(null);
    setSelectedSlot(null);
    setCalendarDays([]);
    setStep(2);
  };

  const handleDateSelect = (date: string, status: string) => {
    if (status === "past" || status === "unavailable") return;
    Haptics.selectionAsync();
    setSelectedDate(date);
    setSlots([]);
    setSelectedSlot(null);
    setStep(3);
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    validateSlot(slot);
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    if (step === 1) {
      navigation.goBack();
    } else if (step === 2) {
      setStep(1);
      setSelectedService(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedDate(null);
      setSlots([]);
    } else if (step === 4) {
      resetReviewState();
      setStep(3);
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    const now = new Date();
    if (prev >= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setCurrentMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
    }
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const next = new Date(year, month, 1);
    const maxAhead = new Date();
    maxAhead.setMonth(maxAhead.getMonth() + 3);
    if (next <= maxAhead) {
      setCurrentMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    if (step === 5) return null;
    const labels = ["Service", "Date", "Time", "Review"];
    return (
      <View style={styles.stepperRow}>
        {([1, 2, 3, 4] as Step[]).map((s, i) => (
          <View key={s} style={styles.stepperItem}>
            {i > 0 && (
              <View style={[styles.stepConnector, { backgroundColor: step >= s ? accentDim : theme.backgroundSecondary }]} />
            )}
            <View style={styles.stepDotWrap}>
              <View style={[styles.stepDot, { backgroundColor: step >= s ? accent : theme.backgroundSecondary }]}>
                {step > s
                  ? <Feather name="check" size={12} color={theme.background} />
                  : <ThemedText style={{ color: step >= s ? theme.background : theme.textSecondary, fontSize: FontSizes.xs, fontWeight: "700" }}>{s}</ThemedText>
                }
              </View>
              <ThemedText style={[styles.stepLabel, { color: step >= s ? accent : theme.textSecondary }]}>
                {labels[i]}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderServiceStep = () => {
    if (isLoadingServices) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Loading services...</ThemedText>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center" }}>{error}</ThemedText>
          <Pressable onPress={fetchServices} style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.xl }]}>
            <ThemedText style={{ color: theme.background }}>Try Again</ThemedText>
          </Pressable>
        </View>
      );
    }
    if (services.length === 0) {
      return (
        <View style={styles.centered}>
          <Feather name="camera-off" size={48} color={theme.textSecondary} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center" }}>
            No services available.{"\n"}Please contact the photographer directly.
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>Select Service</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Choose the type of session you need
        </ThemedText>
        {services.map((service: BookingService) => (
          <Pressable
            key={service.id}
            onPress={() => handleServiceSelect(service)}
            style={({ pressed }: { pressed: boolean }) => [
              styles.serviceCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: selectedService?.id === service.id ? accent : "transparent",
                borderWidth: 2,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.serviceHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">{service.name}</ThemedText>
                {service.description ? (
                  <ThemedText style={{ color: theme.textSecondary, marginTop: 4 }}>{service.description}</ThemedText>
                ) : null}
                <ThemedText style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {formatDuration(service.durationMinutes)}
                </ThemedText>
              </View>
              <ThemedText type="h4" style={{ color: accent }}>{formatPrice(service.priceCents)}</ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderDateStep = () => (
    <View>
      <ThemedText type="h3" style={styles.stepTitle}>Select Date</ThemedText>
      <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        {selectedService?.name} — choose an available date
      </ThemedText>

      <View style={styles.monthHeader}>
        <Pressable onPress={handlePrevMonth} style={styles.monthArrow}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">{monthDisplay}</ThemedText>
        <Pressable onPress={handleNextMonth} style={styles.monthArrow}>
          <Feather name="chevron-right" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekDays}>
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <ThemedText key={d} style={[styles.weekDay, { color: theme.textSecondary }]}>{d}</ThemedText>
        ))}
      </View>

      {isLoadingCalendar ? (
        <View style={[styles.centered, { paddingVertical: Spacing["2xl"] }]}>
          <ActivityIndicator size="small" color={accent} />
        </View>
      ) : (
        <View style={styles.calendarGrid}>
          {calendarGrid.map((item: CalendarGridCell, index: number) => {
            const isSelected = !!item.date && selectedDate === item.date;
            const isAvailable = item.status === "available" || item.status === "partial";
            const bgColor = isSelected ? accent
              : item.status === "available" ? theme.success + "25"
              : item.status === "partial" ? accentSoft
              : "transparent";
            return (
              <Pressable
                key={index}
                disabled={!isAvailable || !item.date}
                onPress={() => item.date && handleDateSelect(item.date, item.status || "unavailable")}
                style={[
                  styles.calendarDay,
                  { backgroundColor: bgColor, opacity: item.status === "past" || !item.date ? 0.35 : 1 },
                  item.isToday && !isSelected && { borderWidth: 2, borderColor: accent },
                ]}
              >
                {item.dayNum !== null ? (
                  <ThemedText style={{
                    color: isSelected ? theme.background : item.status === "past" || !isAvailable ? theme.textSecondary : theme.text,
                    fontSize: FontSizes.sm,
                    fontWeight: isSelected ? "700" : "400",
                  }}>
                    {item.dayNum}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {!isLoadingCalendar && calendarDays.every((d: AvailabilityCalendarDay) => d.status === "unavailable") && calendarDays.length > 0 && (
        <View style={[styles.centered, { paddingVertical: Spacing.xl }]}>
          <Feather name="calendar" size={32} color={theme.textSecondary} />
          <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            No availability for this service.{"\n"}Please contact the photographer.
          </ThemedText>
        </View>
      )}
    </View>
  );

  const renderSlotStep = () => {
    if (isLoadingSlots) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Loading available times...</ThemedText>
        </View>
      );
    }

    const { morning, afternoon } = groupSlots(slots);

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>Select Time</ThemedText>
        <ThemedText style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          {selectedDate ? formatDate(selectedDate) : ""}
        </ThemedText>

        {slots.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: Spacing.xl }]}>
            <Feather name="clock" size={32} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              No available time slots for this date.{"\n"}Please select another date.
            </ThemedText>
            <Pressable
              onPress={() => { setStep(2); setSelectedDate(null); setSlots([]); }}
              style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.xl }]}
            >
              <ThemedText style={{ color: theme.background }}>Choose Another Date</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {morning.length > 0 && (
              <>
                <ThemedText style={[styles.slotGroupLabel, { color: theme.textSecondary }]}>Morning</ThemedText>
                <View style={styles.slotsRow}>
                  {morning.map((slot, i) => (
                    <Pressable
                      key={`m-${i}`}
                      onPress={() => handleSlotSelect(slot)}
                      disabled={isValidating}
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.slotPill,
                        { backgroundColor: theme.backgroundDefault, opacity: pressed || isValidating ? 0.6 : 1 },
                      ]}
                    >
                      <ThemedText style={{ color: theme.text }}>{formatTime(slot.startTime)}</ThemedText>
                      <ThemedText style={{ color: theme.textSecondary, fontSize: FontSizes.xs }}>
                        → {formatTime(slot.endTime)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {afternoon.length > 0 && (
              <>
                <ThemedText style={[styles.slotGroupLabel, { color: theme.textSecondary }]}>Afternoon / Evening</ThemedText>
                <View style={styles.slotsRow}>
                  {afternoon.map((slot, i) => (
                    <Pressable
                      key={`a-${i}`}
                      onPress={() => handleSlotSelect(slot)}
                      disabled={isValidating}
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.slotPill,
                        { backgroundColor: theme.backgroundDefault, opacity: pressed || isValidating ? 0.6 : 1 },
                      ]}
                    >
                      <ThemedText style={{ color: theme.text }}>{formatTime(slot.startTime)}</ThemedText>
                      <ThemedText style={{ color: theme.textSecondary, fontSize: FontSizes.xs }}>
                        → {formatTime(slot.endTime)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {isValidating && (
              <View style={[styles.centered, { flexDirection: "row", paddingVertical: Spacing.md }]}>
                <ActivityIndicator size="small" color={accent} />
                <ThemedText style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>Checking slot...</ThemedText>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderReviewStep = () => {
    if (!selectedService || !selectedSlot || !selectedDate) {
      return (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center" }}>
            No slot selected. Please select a time slot.
          </ThemedText>
          <Pressable onPress={() => setStep(3)} style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.xl }]}>
            <ThemedText style={{ color: theme.background }}>Go Back</ThemedText>
          </Pressable>
        </View>
      );
    }

    const locType = selectedService.serviceLocationType;
    const hasCancellationPolicy = !!selectedService.fullRefundWindow;
    const hasVendorTerms = !!(photographer?.vendorTermsAndConditions?.trim());

    // ── Booking summary ───────────────────────────────────────────────────
    const summarySection = (
      <View style={[styles.reviewSection, { backgroundColor: accentSoft }]}>
        <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Service</ThemedText>
        <ThemedText style={[styles.reviewValue, { color: theme.text, fontWeight: "600" }]}>{selectedService.name}</ThemedText>
        <ThemedText style={{ color: theme.textSecondary, marginTop: 2 }}>
          {formatDate(selectedDate)} at {formatTime(selectedSlot.startTime)}
          {" · "}{formatDuration(selectedService.durationMinutes)}
          {" · "}{formatPrice(selectedService.priceCents)}
        </ThemedText>
      </View>
    );

    // ── Location section ──────────────────────────────────────────────────
    const locationSection = (
      <View style={[styles.reviewSection, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: theme.border }]}>
        <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Location</ThemedText>

        {(!locType || locType === "business") && (
          <>
            <ThemedText style={[styles.reviewValue, { color: theme.text }]}>
              {photographer?.studioAddress
                || photographer?.location
                || `${photographer?.name || "Photographer"}'s location`}
            </ThemedText>
            <Pressable
              onPress={() => setBusinessLocationAcknowledged(!businessLocationAcknowledged)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, {
                borderColor: businessLocationAcknowledged ? accent : theme.textSecondary,
                backgroundColor: businessLocationAcknowledged ? accentSoft : "transparent",
              }]}>
                {businessLocationAcknowledged ? <Feather name="check" size={13} color={accent} /> : null}
              </View>
              <ThemedText style={{ color: theme.text, flex: 1 }}>
                I understand this appointment takes place at the address above
              </ThemedText>
            </Pressable>
          </>
        )}

        {locType === "alternate" && (
          <>
            <ThemedText style={[styles.reviewValue, { color: theme.text }]}>
              {[
                selectedService.alternateAddress,
                selectedService.alternateCity && selectedService.alternateState
                  ? `${selectedService.alternateCity}, ${selectedService.alternateState}`
                  : selectedService.alternateCity || selectedService.alternateState,
                selectedService.alternateZipCode,
              ].filter(Boolean).join(" · ")}
            </ThemedText>
            <Pressable
              onPress={() => setAlternateAcknowledged(!alternateAcknowledged)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, {
                borderColor: alternateAcknowledged ? accent : theme.textSecondary,
                backgroundColor: alternateAcknowledged ? accentSoft : "transparent",
              }]}>
                {alternateAcknowledged ? <Feather name="check" size={13} color={accent} /> : null}
              </View>
              <ThemedText style={{ color: theme.text, flex: 1 }}>
                I understand this service takes place at the address above
              </ThemedText>
            </Pressable>
          </>
        )}

        {locType === "customer" && (
          <>
            <ThemedText style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              Where should this service take place?
            </ThemedText>
            <TextInput
              style={[styles.reviewInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="Street address"
              placeholderTextColor={theme.textSecondary}
              value={customerServiceAddress}
              onChangeText={setCustomerServiceAddress}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.reviewInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="City"
              placeholderTextColor={theme.textSecondary}
              value={customerServiceCity}
              onChangeText={setCustomerServiceCity}
              autoCapitalize="words"
            />
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <TextInput
                style={[styles.reviewInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, flex: 1 }]}
                placeholder="State"
                placeholderTextColor={theme.textSecondary}
                value={customerServiceState}
                onChangeText={setCustomerServiceState}
                autoCapitalize="characters"
                maxLength={2}
              />
              <TextInput
                style={[styles.reviewInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, flex: 2 }]}
                placeholder="ZIP code"
                placeholderTextColor={theme.textSecondary}
                value={customerServiceZipCode}
                onChangeText={setCustomerServiceZipCode}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <Pressable
              onPress={() => setCustomerReadinessConfirmed(!customerReadinessConfirmed)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, {
                borderColor: customerReadinessConfirmed ? accent : theme.textSecondary,
                backgroundColor: customerReadinessConfirmed ? accentSoft : "transparent",
              }]}>
                {customerReadinessConfirmed ? <Feather name="check" size={13} color={accent} /> : null}
              </View>
              <ThemedText style={{ color: theme.text, flex: 1 }}>
                I confirm I will be ready for this service at the scheduled appointment time
              </ThemedText>
            </Pressable>
          </>
        )}

        {locType === "virtual" && (
          <>
            <ThemedText style={[styles.reviewValue, { color: theme.text }]}>
              You'll join this meeting link at your appointment time:
            </ThemedText>
            <ThemedText style={{ color: accent, marginTop: Spacing.xs, fontWeight: "500" }}>
              {selectedService.virtualLink || "Meeting link not set"}
            </ThemedText>
          </>
        )}
      </View>
    );

    // ── Acknowledgment card ───────────────────────────────────────────────
    const ackRows: React.ReactElement[] = [];

    if (locType === "virtual") {
      ackRows.push(
        <Pressable key="virtual" onPress={() => setVirtualLinkAcknowledged(!virtualLinkAcknowledged)} style={styles.checkboxRow}>
          <View style={[styles.checkbox, { borderColor: virtualLinkAcknowledged ? accent : theme.textSecondary, backgroundColor: virtualLinkAcknowledged ? accent : "transparent" }]}>
            {virtualLinkAcknowledged ? <Feather name="check" size={13} color={theme.background} /> : null}
          </View>
          <ThemedText style={{ color: theme.text, flex: 1 }}>
            I understand I will join this meeting link at my scheduled appointment time.
          </ThemedText>
        </Pressable>
      );
    }

    if (hasCancellationPolicy) {
      ackRows.push(
        <View key="cancellation">
          {ackRows.length > 0 ? <View style={{ height: 1, backgroundColor: theme.border, marginVertical: Spacing.sm }} /> : null}
          <Pressable onPress={() => setCancellationPolicyAcknowledged(!cancellationPolicyAcknowledged)} style={styles.checkboxRow}>
            <View style={[styles.checkbox, { borderColor: cancellationPolicyAcknowledged ? accent : theme.textSecondary, backgroundColor: cancellationPolicyAcknowledged ? accent : "transparent" }]}>
              {cancellationPolicyAcknowledged ? <Feather name="check" size={13} color={theme.background} /> : null}
            </View>
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {"I agree to the "}
              <ThemedText onPress={() => setShowCancellationModal(true)} style={{ color: accent, textDecorationLine: "underline" }}>
                Cancellation Policy
              </ThemedText>
            </ThemedText>
          </Pressable>
          <ThemedText style={{ color: theme.textSecondary, fontSize: FontSizes.xs, marginTop: 4, marginLeft: 22 + Spacing.sm }}>
            {shortCancellationSummary(selectedService)}
          </ThemedText>
        </View>
      );
    }

    ackRows.push(
      <View key="platform">
        {ackRows.length > 0 ? <View style={{ height: 1, backgroundColor: theme.border, marginVertical: Spacing.sm }} /> : null}
        <Pressable onPress={() => setPlatformTermsAcknowledged(!platformTermsAcknowledged)} style={styles.checkboxRow}>
          <View style={[styles.checkbox, { borderColor: platformTermsAcknowledged ? accent : theme.textSecondary, backgroundColor: platformTermsAcknowledged ? accent : "transparent" }]}>
            {platformTermsAcknowledged ? <Feather name="check" size={13} color={theme.background} /> : null}
          </View>
          <ThemedText style={{ color: theme.text, flex: 1 }}>
            {"I agree to the "}
            <ThemedText onPress={() => navigation.navigate("TermsOfService")} style={{ color: accent, textDecorationLine: "underline" }}>
              Terms and Conditions
            </ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    );

    if (hasVendorTerms) {
      ackRows.push(
        <View key="vendorterms">
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: Spacing.sm }} />
          <Pressable onPress={() => setVendorTermsAcknowledged(!vendorTermsAcknowledged)} style={styles.checkboxRow}>
            <View style={[styles.checkbox, { borderColor: vendorTermsAcknowledged ? accent : theme.textSecondary, backgroundColor: vendorTermsAcknowledged ? accent : "transparent" }]}>
              {vendorTermsAcknowledged ? <Feather name="check" size={13} color={theme.background} /> : null}
            </View>
            <ThemedText style={{ color: theme.text, flex: 1 }}>
              {"I agree to "}
              <ThemedText onPress={() => setShowVendorTermsModal(true)} style={{ color: accent, textDecorationLine: "underline" }}>
                {`${photographer?.name || "the photographer"}'s Terms and Conditions`}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    // ── canConfirm ────────────────────────────────────────────────────────
    const universalReady =
      (!hasCancellationPolicy || cancellationPolicyAcknowledged) &&
      platformTermsAcknowledged &&
      (!hasVendorTerms || vendorTermsAcknowledged);

    const locationReady =
      !locType || locType === "business" ? businessLocationAcknowledged
      : locType === "alternate" ? alternateAcknowledged
      : locType === "customer"
        ? customerServiceAddress.trim().length > 0 &&
          customerServiceCity.trim().length > 0 &&
          customerServiceState.trim().length > 0 &&
          customerServiceZipCode.trim().length > 0 &&
          customerReadinessConfirmed
      : locType === "virtual" ? virtualLinkAcknowledged
      : true;

    const canConfirm = locationReady && universalReady && !isCreatingHold;

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>Review & Confirm</ThemedText>
        {summarySection}
        {locationSection}
        <View style={[styles.reviewSection, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: theme.border, marginTop: Spacing.sm }]}>
          {ackRows}
        </View>

        {isCreatingHold ? (
          <View style={[styles.centered, { paddingVertical: Spacing.lg }]}>
            <ActivityIndicator size="small" color={accent} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>Processing payment...</ThemedText>
          </View>
        ) : (
          <>
            <Pressable
              onPress={createHoldAndPay}
              disabled={!canConfirm}
              style={[styles.primaryButton, { backgroundColor: canConfirm ? accent : theme.backgroundSecondary, marginTop: Spacing.lg }]}
            >
              <ThemedText style={{ color: canConfirm ? theme.background : theme.textSecondary, fontWeight: "600" }}>
                Confirm & Pay
              </ThemedText>
            </Pressable>
            {!canConfirm ? (
              <ThemedText style={{ color: theme.textSecondary, fontSize: FontSizes.xs, textAlign: "center", marginTop: Spacing.sm }}>
                Complete all required items above to continue
              </ThemedText>
            ) : null}
            <View style={{ marginBottom: Spacing.xl }} />
          </>
        )}
      </View>
    );
  };

  const renderStep5 = () => (
    <View style={[styles.centered, { paddingVertical: Spacing["3xl"] }]}>
      <Feather
        name={bookingPending ? "clock" : "check-circle"}
        size={64}
        color={bookingPending ? "#FF9500" : theme.success}
      />
      <ThemedText type="h3" style={{ marginTop: Spacing.xl, textAlign: "center" }}>
        {bookingPending ? "Booking Submitted!" : "Booking Confirmed!"}
      </ThemedText>
      <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center", paddingHorizontal: Spacing.xl }}>
        {bookingPending
          ? `Your booking request with ${photographer?.name || "the photographer"} has been submitted. You'll be notified within 24 hours once confirmed.`
          : `Your session with ${photographer?.name || "the photographer"} has been booked for ${selectedDate ? formatDate(selectedDate) : ""}.`}
      </ThemedText>
      {bookingPending ? (
        <View style={{ backgroundColor: "#FF950015", padding: 12, borderRadius: BorderRadius.md, marginTop: Spacing.lg, marginHorizontal: Spacing.xl }}>
          <ThemedText style={{ color: "#FF9500", fontSize: FontSizes.sm, textAlign: "center" }}>
            Payment will only be processed after the provider confirms your booking.
          </ThemedText>
        </View>
      ) : null}
      <Pressable
        onPress={() => navigation.dispatch(CommonActions.navigate({ name: "Sessions" }))}
        style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.xl, minWidth: 200 }]}
      >
        <ThemedText style={{ color: theme.background, fontWeight: "600" }}>View My Sessions</ThemedText>
      </Pressable>
      <Pressable onPress={() => navigation.goBack()} style={{ marginTop: Spacing.lg }}>
        <ThemedText style={{ color: theme.textSecondary }}>Go Back</ThemedText>
      </Pressable>
    </View>
  );

  // ─── Loading / error guard screens ───────────────────────────────────────

  if (isLoadingPhotographer) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Loading photographer...</ThemedText>
      </ThemedView>
    );
  }

  if (!photographer) {
    return (
      <ThemedView style={[styles.container, styles.centered, { padding: Spacing.xl }]}>
        <Feather name="alert-circle" size={48} color={theme.error || "#EF4444"} />
        <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>Photographer Not Found</ThemedText>
        <ThemedText style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center" }}>
          {error || "Unable to load photographer details."}
        </ThemedText>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: Spacing.xl }]}
        >
          <ThemedText style={{ color: "#FFFFFF" }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>
      {step < 5 ? (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={handleBack} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4">Book Appointment</ThemedText>
          <View style={styles.headerButton} />
        </View>
      ) : null}

      {renderStepIndicator()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? renderServiceStep() : null}
        {step === 2 ? renderDateStep() : null}
        {step === 3 ? renderSlotStep() : null}
        {step === 4 ? renderReviewStep() : null}
        {step === 5 ? renderStep5() : null}
      </ScrollView>

      {/* Cancellation policy modal */}
      <Modal
        visible={showCancellationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancellationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Cancellation Policy</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, lineHeight: 22 }}>
              {selectedService && selectedDate && selectedSlot
                ? describeCancellationPolicyForService(selectedService, selectedDate, selectedSlot.startTime)
                : ""}
            </ThemedText>
            <Pressable
              onPress={() => setShowCancellationModal(false)}
              style={[styles.primaryButton, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.xl, width: "100%" }]}
            >
              <ThemedText style={{ color: theme.text }}>Got it</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Vendor terms modal */}
      <Modal
        visible={showVendorTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVendorTermsModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: "flex-end", padding: 0 }]}>
          <View style={{ backgroundColor: theme.backgroundDefault, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.xl, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
              <ThemedText type="h4">{`${photographer.name}'s Terms & Conditions`}</ThemedText>
              <Pressable onPress={() => setShowVendorTermsModal(false)}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator>
              <ThemedText style={{ color: theme.textSecondary, lineHeight: 22 }}>
                {photographer.vendorTermsAndConditions || ""}
              </ThemedText>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Incompatible slot modal */}
      <Modal
        visible={showIncompatibleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIncompatibleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="alert-circle" size={40} color={accent} />
            <ThemedText type="h4" style={{ marginTop: Spacing.md, marginBottom: Spacing.sm, textAlign: "center" }}>
              Slot Unavailable
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center" }}>
              {incompatibleReason}
            </ThemedText>
            <Pressable
              onPress={() => setShowIncompatibleModal(false)}
              style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.xl, width: "100%" }]}
            >
              <ThemedText style={{ color: theme.background }}>Find Another Time</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  stepperItem: { flexDirection: "row", alignItems: "center" },
  stepConnector: { width: 32, height: 2, marginTop: 12 },
  stepDotWrap: { alignItems: "center", width: 48 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { fontSize: 10, marginTop: 4, textAlign: "center" },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  stepTitle: { marginBottom: Spacing.xs },
  stepSubtitle: { marginBottom: Spacing.xl },
  serviceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  monthArrow: { padding: Spacing.sm },
  weekDays: { flexDirection: "row", marginBottom: Spacing.sm },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  slotGroupLabel: { marginBottom: Spacing.sm, fontWeight: "600" },
  slotsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.xl },
  slotPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  reviewSection: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  reviewLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reviewValue: { fontSize: 15, marginBottom: Spacing.sm },
  reviewInput: {
    height: 44,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
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
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
});

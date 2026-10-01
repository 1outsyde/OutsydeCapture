import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  StyleSheet, View, Pressable, ScrollView, TextInput,
  Alert, Modal, ActivityIndicator, useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripePayment } from "@/hooks/useStripePayment";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
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

// ─── Hold / payment ───────────────────────────────────────────────────────────

// Matches the backend hold TTL; the countdown runs on the device clock from
// when the hold was requested.
const HOLD_TTL_MS = 10 * 60 * 1000;

type HoldStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "expired"
  | "expiredAfterPayment";

type HoldPaymentIntentResponse = Awaited<
  ReturnType<typeof api.createHoldPaymentIntent>
>;

// Amounts captured when the customer taps Pay; the confirmation screen reads
// these so a hold expiring during the Payment Sheet cannot blank them.
interface PaidSnapshot {
  serviceTotalCents: number | undefined;
  dueNowCents: number;
  dueAtAppointmentCents: number | undefined;
  depositAmountCents: number | null;
}

// Customer-facing copy for hold errors. Raw messages go to the console only.
const mapHoldError = (err: any): string => {
  const code = err?.body?.errorCode;
  if (code === "HOLD_EXPIRED") return "Your hold on this time expired.";
  if (code === "SLOT_UNAVAILABLE") {
    return "This time was just taken. Please choose another time.";
  }
  if (!err?.status) {
    return "Couldn't reach Outsyde. Check your connection and try again.";
  }
  return "Something went wrong holding this time.";
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const formatHoldTime = (ms: number): string => {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

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
  const [failedServiceImages, setFailedServiceImages] = useState<Set<string>>(
    new Set(),
  );
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
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [holdErrorCopy, setHoldErrorCopy] = useState<string | null>(null);
  const [paymentData, setPaymentData] =
    useState<HoldPaymentIntentResponse | null>(null);
  const [paidSnapshot, setPaidSnapshot] = useState<PaidSnapshot | null>(null);

  // ─── Loading / error ───────────────────────────────────────────────────────
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [paying, setPaying] = useState(false);
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
  // holdRef always mirrors `hold` (set only through applyHold) so cleanup and
  // async callbacks see the current hold.
  const holdRef = useRef<BookingHoldResponse | null>(null);
  const holdLocalExpiresAtRef = useRef<number>(0);
  // Holds that create-payment-intent was called for: never released, since
  // the backend has already created a booking for them.
  const piCalledHoldIdsRef = useRef<Set<string>>(new Set());
  // Holds that have a PaymentIntent (create-payment-intent returned).
  const piCreatedHoldIdsRef = useRef<Set<string>>(new Set());
  // create-payment-intent attempts per hold. Only a HOLD_EXPIRED on the first
  // attempt proves nothing was created for the hold.
  const piAttemptsRef = useRef<Map<string, number>>(new Map());
  // Bumped on every hold request and on back/unmount; a hold response from an
  // older request is released instead of used.
  const holdReqSeqRef = useRef(0);
  const mountedRef = useRef(true);
  const stepRef = useRef<Step>(step);
  const payingRef = useRef(false);

  const invalidateHoldRequests = () => {
    holdReqSeqRef.current++;
  };

  const applyHold = (h: BookingHoldResponse | null) => {
    holdRef.current = h;
    setHold(h);
  };

  const releaseHoldIfSafe = (h: BookingHoldResponse | null) => {
    if (!h || piCalledHoldIdsRef.current.has(h.holdId)) return;
    getToken()
      .then((token) => {
        if (token) return api.releaseBookingHold(token, h.holdId);
      })
      .catch(() => {});
  };

  // Payment was started for the current hold: the countdown stops.
  const paymentStarted = !!hold && piCalledHoldIdsRef.current.has(hold.holdId);
  // A PaymentIntent exists for the current hold: only Pay or leaving remain.
  const paymentIntentExists =
    !!hold && piCreatedHoldIdsRef.current.has(hold.holdId);

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
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Leaving the screen releases a hold that has not reached payment; late
      // hold responses are dropped.
      mountedRef.current = false;
      invalidateHoldRequests();
      releaseHoldIfSafe(holdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create the hold when the customer reaches the review step.
  useEffect(() => {
    if (step === 4 && selectedSlot && !hold && holdStatus === "idle") {
      requestHold();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedSlot, hold, holdStatus]);

  useEffect(() => {
    // Once payment has started for this hold the countdown stops; the backend
    // decides expiry from then on.
    if (!hold || paymentStarted) return;
    const updateTimer = () => {
      const remaining = Math.max(0, holdLocalExpiresAtRef.current - Date.now());
      setHoldTimeRemaining(remaining);
      if (remaining <= 0) handleHoldExpired();
    };
    updateTimer();
    holdTimerRef.current = setInterval(updateTimer, 1000);
    return () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current); };
  }, [hold, paymentStarted]);

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

  // Holds the selected slot for the review step. A response that arrives after
  // the customer went back or left is released straight away.
  const requestHold = async () => {
    if (!selectedService || !selectedDate || !selectedSlot || !photographer) return;
    const seq = ++holdReqSeqRef.current;
    setHoldStatus("loading");
    setHoldErrorCopy(null);
    const requestStartedAt = Date.now();
    try {
      const token = await getToken();
      if (!token) throw { status: 401, message: "Not signed in" };
      const response = await api.createBookingHold(token, {
        providerId: photographer.id,
        providerType: "photographer",
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: selectedSlot.startTime,
      });

      const stale =
        !mountedRef.current ||
        stepRef.current !== 4 ||
        seq !== holdReqSeqRef.current;
      if (stale) {
        releaseHoldIfSafe(response);
        return;
      }
      if (!response.success) throw { status: 500, message: "Hold failed" };

      holdLocalExpiresAtRef.current = requestStartedAt + HOLD_TTL_MS;
      applyHold(response);
      setHoldStatus("ready");
    } catch (err: any) {
      if (!mountedRef.current || seq !== holdReqSeqRef.current) return;
      console.warn("[BookingScreen] hold failed", err?.message);
      setHoldErrorCopy(mapHoldError(err));
      setHoldStatus("error");
    }
  };

  const handlePay = async () => {
    // Guard before any await so a double tap cannot start two payments.
    if (payingRef.current) return;
    const currentHold = holdRef.current;
    if (
      !currentHold ||
      holdStatus !== "ready" ||
      typeof currentHold.dueNowCents !== "number" ||
      !selectedService ||
      !selectedDate ||
      !selectedSlot ||
      !photographer
    ) {
      return;
    }
    payingRef.current = true;
    setPaying(true);

    const snapshot: PaidSnapshot = {
      serviceTotalCents: currentHold.serviceTotalCents,
      dueNowCents: currentHold.dueNowCents,
      dueAtAppointmentCents: currentHold.dueAtAppointmentCents,
      depositAmountCents: currentHold.depositAmountCents ?? null,
    };
    let attempt = 0;

    try {
      const customerAddress = selectedService.serviceLocationType === "customer"
        ? { customerServiceAddress, customerServiceCity, customerServiceState, customerServiceZipCode }
        : undefined;

      // From here on the backend has a booking for this hold, so it is never
      // released; a retry reuses the same hold and PaymentIntent.
      piCalledHoldIdsRef.current.add(currentHold.holdId);
      attempt = (piAttemptsRef.current.get(currentHold.holdId) ?? 0) + 1;
      piAttemptsRef.current.set(currentHold.holdId, attempt);
      const pd = await api.createHoldPaymentIntent(
        currentHold.holdId,
        customerAddress,
      );
      piCreatedHoldIdsRef.current.add(currentHold.holdId);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: pd.clientSecret,
        merchantDisplayName: "Outsyde",
        allowsDelayedPaymentMethods: false,
      });
      if (initError) throw new Error(initError.message || "Failed to initialize payment");

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if ((presentError as any).code === "Canceled") return;
        throw new Error((presentError as any).message || "Payment failed");
      }

      // Payment succeeded
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);

      const isPending = Boolean(
        pd.requiresApproval ?? !photographer.autoAcceptBookings,
      );
      setBookingPending(isPending);
      setPaidSnapshot(snapshot);
      setPaymentData(pd);

      const locationStr = deriveLocationString();
      const endTime =
        validatedEndTime || currentHold.slot?.endTime || selectedSlot.endTime;
      const photographerName = photographer.name || "the photographer";
      const formattedDate = formatDate(selectedDate);
      const formattedTime = selectedSlot.startTime;

      try {
        await refreshSessions();

        await addNotification({
          type: "booking",
          title: isPending ? "Booking Submitted" : "Booking Confirmed",
          body: isPending
            ? `Your booking request with ${photographerName} on ${formattedDate} has been submitted. Awaiting provider approval (up to 48h).`
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
      if (err?.body?.errorCode === "HOLD_EXPIRED") {
        // The backend rejects an expired hold before it looks for or creates
        // a booking, so HOLD_EXPIRED on the first attempt proves nothing was
        // created and the customer may hold again. After any earlier attempt
        // (which may have created a booking) only leaving is offered.
        if (attempt === 1) {
          applyHold(null);
          setHoldStatus("expired");
        } else {
          setHoldStatus("expiredAfterPayment");
        }
      } else {
        Alert.alert(
          "Booking Error",
          err.message || "Something went wrong. Please try again.",
        );
      }
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const handleHoldExpired = () => {
    const current = holdRef.current;
    // After payment starts the backend decides whether the hold is still good.
    if (current && piCalledHoldIdsRef.current.has(current.holdId)) return;
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    applyHold(null);
    setHoldStatus("expired");
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
      if (payingRef.current) return;
      // Once a PaymentIntent exists the hold belongs to a booking; back leaves
      // the screen instead of choosing another time.
      if (paymentIntentExists || holdStatus === "expiredAfterPayment") {
        navigation.goBack();
        return;
      }
      resetReviewState();
      // Drop any in-flight hold request and release the current hold.
      invalidateHoldRequests();
      releaseHoldIfSafe(holdRef.current);
      applyHold(null);
      setHoldStatus("idle");
      setHoldErrorCopy(null);
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
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  overflow: "hidden",
                  marginRight: 12,
                }}
              >
                {service.imageUrl && !failedServiceImages.has(service.id) ? (
                  <Image
                    source={{ uri: service.imageUrl }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    onError={() =>
                      setFailedServiceImages((prev) =>
                        new Set(prev).add(service.id),
                      )
                    }
                  />
                ) : (
                  <LinearGradient
                    colors={["#2a2a2a", "#111111"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
              </View>
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

  const renderAmountRow = (
    label: string,
    cents: number,
    emphasized: boolean = false,
  ) => (
    <View key={label} style={styles.amountRow}>
      <ThemedText
        style={{
          color: emphasized ? theme.text : theme.textSecondary,
          fontWeight: emphasized ? "600" : "400",
        }}
      >
        {label}
      </ThemedText>
      <ThemedText
        style={[
          styles.amountValue,
          {
            color: emphasized ? theme.text : theme.textSecondary,
            fontWeight: emphasized ? "600" : "400",
          },
        ]}
      >
        {formatPrice(cents)}
      </ThemedText>
    </View>
  );

  const renderHoldActions = (primaryLabel: string | null) => (
    <View style={{ marginTop: Spacing.md }}>
      {primaryLabel && (
        <Pressable
          onPress={requestHold}
          style={[styles.primaryButton, { backgroundColor: accent }]}
          accessibilityRole="button"
        >
          <ThemedText style={{ color: theme.background, fontWeight: "600" }}>
            {primaryLabel}
          </ThemedText>
        </Pressable>
      )}
      <Pressable
        onPress={handleBack}
        style={styles.secondaryAction}
        accessibilityRole="button"
      >
        <ThemedText style={{ color: accent }}>Choose another time</ThemedText>
      </Pressable>
    </View>
  );

  const renderCountdown = () => {
    if (!hold || paymentStarted) return null;
    const endingSoon = holdTimeRemaining <= 120_000;
    return (
      <ThemedText
        style={{
          color: theme.textSecondary,
          fontSize: FontSizes.xs,
          marginTop: Spacing.sm,
        }}
      >
        {`Time held: ${formatHoldTime(holdTimeRemaining)}${endingSoon ? " · ending soon" : ""}`}
      </ThemedText>
    );
  };

  // All amounts come from the hold; nothing is computed on the device.
  const renderAmountsBlock = () => {
    if (holdStatus === "idle" || holdStatus === "loading") {
      return (
        <View accessibilityLabel="Holding your time" accessible>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.amountSkeleton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            />
          ))}
          <ThemedText
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          >
            Holding your time…
          </ThemedText>
        </View>
      );
    }
    if (holdStatus === "error") {
      return (
        <>
          <ThemedText style={{ color: theme.text }}>
            {holdErrorCopy || "Something went wrong holding this time."}
          </ThemedText>
          {renderHoldActions("Retry")}
        </>
      );
    }
    if (holdStatus === "expired") {
      return (
        <>
          <ThemedText style={{ color: theme.text }}>
            Your hold on this time expired.
          </ThemedText>
          {renderHoldActions("Hold this time again")}
        </>
      );
    }
    if (holdStatus === "expiredAfterPayment") {
      return (
        <ThemedText style={{ color: theme.text }}>
          This booking session timed out. Close and start again.
        </ThemedText>
      );
    }
    if (!hold || typeof hold.dueNowCents !== "number") {
      return (
        <>
          <ThemedText style={{ color: theme.text }}>
            Something went wrong holding this time.
          </ThemedText>
          {renderHoldActions("Retry")}
        </>
      );
    }

    const hasDeposit =
      typeof hold.depositAmountCents === "number" &&
      hold.depositAmountCents > 0;
    const feeCents = hold.dueNowFeeBreakdown?.consumerServiceFeeAmount;
    return (
      <>
        {typeof hold.serviceTotalCents === "number" &&
          renderAmountRow("Service total", hold.serviceTotalCents)}
        {!hasDeposit &&
          typeof feeCents === "number" &&
          renderAmountRow("Service fee", feeCents)}
        {renderAmountRow("Due now", hold.dueNowCents, true)}
        {hasDeposit && typeof feeCents === "number" && (
          <ThemedText
            style={{
              color: theme.textSecondary,
              fontSize: FontSizes.xs,
              textAlign: "right",
            }}
          >
            {`${formatPrice(hold.depositAmountCents as number)} deposit + ${formatPrice(feeCents)} service fee`}
          </ThemedText>
        )}
        {hasDeposit &&
          typeof hold.dueAtAppointmentCents === "number" &&
          renderAmountRow("Due at appointment", hold.dueAtAppointmentCents)}
        {renderCountdown()}
      </>
    );
  };

  // Confirmation amounts come from the snapshot taken at Pay time; the
  // PaymentIntent total is only used to cross-check what was charged.
  const renderConfirmationDetails = () => {
    const name = photographer?.name || "the photographer";
    const dimCenter = {
      color: theme.textSecondary,
      marginTop: Spacing.sm,
      textAlign: "center" as const,
      paddingHorizontal: Spacing.xl,
    };
    if (!paidSnapshot) {
      return (
        <ThemedText style={dimCenter}>
          {bookingPending
            ? `Your card has been authorized but not charged. ${name} has 48 hours to accept or decline your request. You'll be notified either way.`
            : `Your session with ${name} has been booked for ${selectedDate ? formatDate(selectedDate) : ""}.`}
        </ThemedText>
      );
    }

    let nowCents = paidSnapshot.dueNowCents;
    const piGross = paymentData?.feeBreakdown?.grossChargeAmount;
    if (typeof piGross === "number" && piGross !== nowCents) {
      console.warn(
        "[BookingScreen] hold due-now differs from PaymentIntent amount",
        nowCents,
        piGross,
      );
      nowCents = piGross;
    }
    const deposit = paidSnapshot.depositAmountCents;
    const hasDeposit = typeof deposit === "number" && deposit > 0;
    const atAppointment = paidSnapshot.dueAtAppointmentCents;
    const bookingNumber = paymentData?.bookingNumber;

    return (
      <View
        style={{
          alignSelf: "stretch",
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xl,
        }}
      >
        {renderAmountRow(
          bookingPending ? "Authorized now" : "Paid now",
          nowCents,
          true,
        )}
        {typeof atAppointment === "number" &&
          atAppointment > 0 &&
          renderAmountRow("Due at appointment", atAppointment)}
        {typeof paidSnapshot.serviceTotalCents === "number" &&
          renderAmountRow("Service total", paidSnapshot.serviceTotalCents)}
        {bookingPending ? (
          <>
            <ThemedText style={dimCenter}>
              {`${formatPrice(nowCents)} is authorized on your card, not charged. You're only charged if ${name} accepts.`}
            </ThemedText>
            {hasDeposit && (
              <ThemedText style={dimCenter}>
                {`If ${name} accepts, your deposit becomes non-refundable.`}
              </ThemedText>
            )}
            <ThemedText style={dimCenter}>
              {`${name} has 48 hours to accept or decline your request. You'll be notified either way.`}
            </ThemedText>
          </>
        ) : hasDeposit && typeof atAppointment === "number" ? (
          <ThemedText style={dimCenter}>
            {`Your ${formatPrice(deposit as number)} deposit is non-refundable if you cancel. Pay the remaining ${formatPrice(atAppointment)} at your appointment.`}
          </ThemedText>
        ) : (
          <ThemedText style={dimCenter}>
            {`Your session with ${name} has been booked for ${selectedDate ? formatDate(selectedDate) : ""}.`}
          </ThemedText>
        )}
        {typeof bookingNumber === "number" && (
          <ThemedText
            style={dimCenter}
          >{`Booking #${bookingNumber}`}</ThemedText>
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
        </ThemedText>
      </View>
    );

    const amountsSection = (
      <View
        style={[
          styles.reviewSection,
          {
            backgroundColor: theme.backgroundDefault,
            borderWidth: 1,
            borderColor: theme.border,
          },
        ]}
      >
        {renderAmountsBlock()}
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
            <AddressAutocompleteInput
              line1={customerServiceAddress}
              city={customerServiceCity}
              state={customerServiceState}
              zipCode={customerServiceZipCode}
              onChange={(f) => {
                setCustomerServiceAddress(f.line1);
                setCustomerServiceCity(f.city);
                setCustomerServiceState(f.state);
                setCustomerServiceZipCode(f.zipCode);
              }}
              label="Service Address"
              required
            />
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

    // Pay stays disabled until the hold's amounts have loaded.
    const dueNowCents =
      typeof hold?.dueNowCents === "number" ? hold.dueNowCents : null;
    const amountsReady = holdStatus === "ready" && dueNowCents !== null;
    const canConfirm =
      amountsReady && locationReady && universalReady && !paying;
    const holdFailed =
      holdStatus === "error" ||
      holdStatus === "expired" ||
      holdStatus === "expiredAfterPayment";
    const showNonRefundable = amountsReady && !!hold?.depositNonRefundable;

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>Review & Confirm</ThemedText>
        {summarySection}
        {amountsSection}
        {locationSection}
        <View style={[styles.reviewSection, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: theme.border, marginTop: Spacing.sm }]}>
          {ackRows}
        </View>

        {paying ? (
          <View style={[styles.centered, { paddingVertical: Spacing.lg }]}>
            <ActivityIndicator size="small" color={accent} />
            <ThemedText
              style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
            >
              Starting payment...
            </ThemedText>
          </View>
        ) : holdFailed ? (
          <View style={{ marginBottom: Spacing.xl }} />
        ) : (
          <>
            {showNonRefundable ? (
              <ThemedText
                style={{
                  color: theme.text,
                  textAlign: "center",
                  marginTop: Spacing.lg,
                }}
              >
                Deposit is non-refundable once your booking is confirmed.
              </ThemedText>
            ) : null}
            <Pressable
              onPress={() => canConfirm && handlePay()}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm }}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: canConfirm
                    ? accent
                    : theme.backgroundSecondary,
                  marginTop: showNonRefundable ? Spacing.sm : Spacing.lg,
                },
              ]}
            >
              <ThemedText style={{ color: canConfirm ? theme.background : theme.textSecondary, fontWeight: "600" }}>
                {amountsReady && dueNowCents !== null
                  ? `Pay ${formatPrice(dueNowCents)}`
                  : "Pay"}
              </ThemedText>
            </Pressable>
            {!canConfirm ? (
              <ThemedText style={{ color: theme.textSecondary, fontSize: FontSizes.xs, textAlign: "center", marginTop: Spacing.sm }}>
                {amountsReady
                  ? "Complete all required items above to continue"
                  : "Holding your time…"}
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
      {renderConfirmationDetails()}
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

      <ScreenKeyboardAwareScrollView
        style={styles.content}
        contentContainerStyle={{ paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? renderServiceStep() : null}
        {step === 2 ? renderDateStep() : null}
        {step === 3 ? renderSlotStep() : null}
        {step === 4 ? renderReviewStep() : null}
        {step === 5 ? renderStep5() : null}
      </ScreenKeyboardAwareScrollView>

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
  secondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginTop: Spacing.xs,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  amountValue: {
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  amountSkeleton: {
    height: 16,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.sm,
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

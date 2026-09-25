import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  TextInput,
  AccessibilityInfo,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
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
  providerAddress?: string | null;
  providerCity?: string | null;
  providerState?: string | null;
  providerShowAddress?: boolean;
  providerVendorTerms?: string | null;
  staffMemberId?: string | null;
  accentColor?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const formatPrice = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

// Backend default hold length (availabilityService DEFAULT_HOLD_DURATION_MINUTES).
// The countdown is measured on the device clock from when the hold was
// requested, so device/server clock differences do not matter.
const HOLD_TTL_MS = 10 * 60 * 1000;

// Fixed height for the review amounts block so the Pay button does not jump
// between the loading placeholder and the loaded amounts.
const AMOUNTS_BLOCK_MIN_HEIGHT = 190;

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
  if (code === "STAFF_NOT_BOOKABLE") {
    return "This team member isn't taking bookings right now.";
  }
  if (!err?.status) {
    return "Couldn't reach Outsyde. Check your connection and try again.";
  }
  return "Something went wrong holding this time.";
};

const mapPayError = (err: any): string => {
  if (err?.status === 409) {
    return "A payment for this booking is already in progress. Close and check your bookings.";
  }
  if (!err?.status && !err?.body) {
    return "Couldn't reach Outsyde. Check your connection and try again.";
  }
  return "Something went wrong starting payment.";
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

const formatTime = (time24: string): string => {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === "00" ? `${hour12}:00 ${period}` : `${hour12}:${minute} ${period}`;
};

const groupSlots = (slots: AvailabilitySlot[]) => {
  const morning = slots.filter((s) => parseInt(s.startTime.split(":")[0], 10) < 12);
  const afternoon = slots.filter((s) => parseInt(s.startTime.split(":")[0], 10) >= 12);
  return { morning, afternoon };
};

// ─── Cancellation-policy helpers (local, mirrors AppointmentDetailScreen) ────

const CANCELLATION_WINDOW_HOURS: Record<string, number> = {
  "1_week": 168,
  "48_hours": 48,
  "24_hours": 24,
  "1_hour": 1,
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
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Deposit bookings: the backend keeps the deposit when a confirmed booking is
// cancelled and charges no other cancellation fee.
const DEPOSIT_POLICY_TEXT =
  "Deposit is non-refundable once your booking is confirmed. No other cancellation fee applies.";

function describeCancellationPolicyForService(
  service: BookingService,
  selectedDate: string,
  slotStartTime: string,
  hasDeposit: boolean = false,
): string {
  if (hasDeposit) return DEPOSIT_POLICY_TEXT;
  const fullWindow = service.fullRefundWindow ?? "never";
  const hasPartial = !!service.hasPartialRefund;
  const hasFee = !!service.hasCancellationFee;
  const fee = hasFee ? cancellationFeeLabel(service.cancellationFeeType, service.cancellationFeeAmount) : null;

  if (fullWindow === "never") {
    return hasFee
      ? `This booking is non-refundable. A ${fee} cancellation fee applies if you cancel a confirmed booking.`
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
        `if you cancel a confirmed booking after the full-refund window, a ${fee} cancellation fee applies. ` +
        `No refund after ${partCutoff}, and the ${fee} fee still applies to a confirmed booking.`
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
      `After that, no refund is given and a ${fee} cancellation fee applies if you cancel a confirmed booking.`
    );
  }
  return (
    `Free cancellation until ${cancellationWindowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
    `No refund after that.`
  );
}

function shortCancellationSummary(
  service: BookingService,
  hasDeposit: boolean = false,
): string {
  if (hasDeposit) return DEPOSIT_POLICY_TEXT;
  const fullWindow = service.fullRefundWindow ?? "never";
  const hasFee = !!service.hasCancellationFee;
  if (fullWindow === "never") {
    return hasFee ? "Non-refundable · cancellation fee applies" : "Non-refundable";
  }
  const label = cancellationWindowLabel(fullWindow);
  return hasFee
    ? `Free cancellation until ${label} before · fee after`
    : `Free cancellation until ${label} before appointment`;
}

export default function BookingFlow({
  providerId,
  providerType,
  providerName,
  providerAddress,
  providerCity,
  providerState,
  providerShowAddress,
  providerVendorTerms,
  staffMemberId,
  accentColor,
}: BookingFlowProps) {
  const { theme } = useTheme();
  const accent = accentColor || theme.brandGold;
  const accentDim = accentColor ? accentColor + "CC" : theme.brandGoldDim;
  const accentSoft = accentColor ? accentColor + "25" : theme.brandGold + "25";
  const { getToken, isAuthenticated } = useAuth();
  const { refreshSessions } = useData();
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
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [holdErrorCopy, setHoldErrorCopy] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentData, setPaymentData] =
    useState<HoldPaymentIntentResponse | null>(null);
  const [paidSnapshot, setPaidSnapshot] = useState<PaidSnapshot | null>(null);
  // Known before payment only for businesses (public profile); null = unknown.
  const [autoAcceptBookings, setAutoAcceptBookings] = useState<boolean | null>(
    null,
  );

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [bookingPending, setBookingPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showIncompatibleModal, setShowIncompatibleModal] = useState(false);
  const [incompatibleReason, setIncompatibleReason] = useState<string>("");

  // Review step state
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

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  // holdRef always mirrors `hold` (set only through applyHold) so cleanup and
  // async callbacks see the current hold.
  const holdRef = useRef<BookingHoldResponse | null>(null);
  // Device-clock expiry of the current hold (see HOLD_TTL_MS).
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
  const stepRef = useRef<Step>(1);
  const payingRef = useRef(false);
  const announcedThresholdRef = useRef<number | null>(null);

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
  // A PaymentIntent exists for the current hold: only Pay or Close remain.
  const paymentIntentExists =
    !!hold && piCreatedHoldIdsRef.current.has(hold.holdId);
  // Deposit policy wording comes from the hold only; the policy is not shown
  // until the hold is ready.
  const serviceHasDeposit = hold?.depositNonRefundable === true;
  const policyReady = holdStatus === "ready" && !!hold;

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
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Leaving BookingFlow (modal close, back arrow, tab switch) releases a
      // hold that has not reached payment; late hold responses are dropped.
      mountedRef.current = false;
      invalidateHoldRequests();
      releaseHoldIfSafe(holdRef.current);
    };
  }, []);

  // Create the hold when the customer reaches the review step.
  useEffect(() => {
    if (step === 4 && selectedSlot && !hold && holdStatus === "idle") {
      requestHold();
    }
  }, [step, selectedSlot, hold, holdStatus]);

  useEffect(() => {
    // Once payment has started for this hold the countdown stops; the backend
    // decides expiry from then on.
    if (hold && !paymentStarted) {
      const updateTimer = () => {
        const remaining = Math.max(
          0,
          holdLocalExpiresAtRef.current - Date.now(),
        );
        setHoldTimeRemaining(remaining);
        const threshold =
          remaining <= 60_000 ? 60_000 : remaining <= 120_000 ? 120_000 : null;
        if (
          threshold !== null &&
          remaining > 0 &&
          announcedThresholdRef.current !== threshold
        ) {
          announcedThresholdRef.current = threshold;
          if (Platform.OS === "ios") {
            AccessibilityInfo.announceForAccessibility(
              threshold === 60_000
                ? "About 1 minute left to pay"
                : "About 2 minutes left to pay",
            );
          }
        }
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
  }, [hold, paymentStarted]);

  // Whether the business confirms bookings manually; only changes the Pay
  // button label, never blocks it.
  useEffect(() => {
    if (providerType !== "business" || !providerId) return;
    let active = true;
    api
      .getBusiness(providerId)
      .then((b) => {
        if (active && typeof b?.autoAcceptBookings === "boolean") {
          setAutoAcceptBookings(b.autoAcceptBookings);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [providerId, providerType]);

  const fetchServices = async () => {
    setLoadingServices(true);
    setError(null);
    try {
      let data: BookingService[];
      if (staffMemberId) {
        const result = await api.getStaffPublicServices(providerId, staffMemberId);
        data = result.services || [];
      } else {
        data = await api.getProviderServices(providerId, providerType);
      }
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
      const response = await api.getAvailabilityCalendar(providerId, providerType, year, month, selectedService?.durationMinutes ?? 60, staffMemberId ?? undefined);
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
      const response = await api.getAvailabilitySlots(providerId, providerType, selectedDate, serviceDuration, staffMemberId ?? undefined);
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
        ...(staffMemberId ? { staffMemberId } : {}),
      });

      if (response.valid) {
        setSelectedSlot(slot);
        setValidatedEndTime(response.endTime || null);
        setStep(4);
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

  // Holds the selected slot for the review step. A response that arrives after
  // the customer went back or left is released straight away.
  const requestHold = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    const seq = ++holdReqSeqRef.current;
    setHoldStatus("loading");
    setHoldErrorCopy(null);
    const requestStartedAt = Date.now();
    try {
      const token = await getToken();
      if (!token) throw { status: 401, message: "Not signed in" };
      const response = await api.createBookingHold(token, {
        providerId,
        providerType,
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        ...(staffMemberId ? { staffMemberId } : {}),
      } as Parameters<typeof api.createBookingHold>[1]);

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
      announcedThresholdRef.current = null;
      applyHold(response);
      setHoldStatus("ready");
    } catch (err: any) {
      if (!mountedRef.current || seq !== holdReqSeqRef.current) return;
      console.warn("[BookingFlow] hold failed", err?.message);
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
      !selectedService
    ) {
      return;
    }
    payingRef.current = true;
    setPaying(true);
    setError(null);

    const snapshot: PaidSnapshot = {
      serviceTotalCents: currentHold.serviceTotalCents,
      dueNowCents: currentHold.dueNowCents,
      dueAtAppointmentCents: currentHold.dueAtAppointmentCents,
      depositAmountCents: currentHold.depositAmountCents ?? null,
    };
    let attempt = 0;

    try {
      const customerAddress =
        selectedService.serviceLocationType === "customer"
          ? {
              customerServiceAddress,
              customerServiceCity,
              customerServiceState,
              customerServiceZipCode,
            }
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
        merchantDisplayName: "Outsyde",
        paymentIntentClientSecret: pd.clientSecret,
        defaultBillingDetails: { name: providerName },
      });
      if (initError) throw { sheetError: true, message: initError.message };

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === "Canceled") return;
        throw { sheetError: true, message: presentError.message };
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshSessions().catch(() => {});
      setPaidSnapshot(snapshot);
      setPaymentData(pd);
      setBookingPending(Boolean(pd.requiresApproval));
      setStep(5);
    } catch (err: any) {
      console.warn("[BookingFlow] payment failed", err?.message);
      if (err?.body?.errorCode === "HOLD_EXPIRED") {
        // The backend rejects an expired hold before it looks for or creates
        // a booking, so HOLD_EXPIRED on the first attempt proves nothing was
        // created and the customer may hold again. After any earlier attempt
        // (which may have created a booking) only Close is offered.
        if (attempt === 1) {
          applyHold(null);
          setHoldStatus("expired");
        } else {
          setHoldStatus("expiredAfterPayment");
        }
      } else if (err?.sheetError) {
        setError(
          "Payment didn't go through. Please try again or use another card.",
        );
      } else {
        setError(mapPayError(err));
      }
    } finally {
      payingRef.current = false;
      setPaying(false);
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
    const current = holdRef.current;
    // After payment starts the backend decides whether the hold is still good.
    if (current && piCalledHoldIdsRef.current.has(current.holdId)) return;
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    applyHold(null);
    setHoldStatus("expired");
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
    } else if (step === 4) {
      setBusinessLocationAcknowledged(false);
      setAlternateAcknowledged(false);
      setCustomerReadinessConfirmed(false);
      setVirtualLinkAcknowledged(false);
      setCancellationPolicyAcknowledged(false);
      setPlatformTermsAcknowledged(false);
      setVendorTermsAcknowledged(false);
      // Drop any in-flight hold request and release the current hold (only
      // possible before payment; back is hidden once a PaymentIntent exists).
      invalidateHoldRequests();
      releaseHoldIfSafe(holdRef.current);
      applyHold(null);
      setHoldStatus("idle");
      setHoldErrorCopy(null);
      setError(null);
      setStep(3);
    }
  };

  const formatHoldTime = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const renderAmountRow = (
    label: string,
    cents: number,
    emphasized: boolean = false,
  ) => (
    <View key={label} style={styles.amountRow}>
      <ThemedText
        style={{
          color: emphasized ? theme.brandCream : theme.brandTextDim,
          fontWeight: emphasized ? "600" : "400",
        }}
      >
        {label}
      </ThemedText>
      <ThemedText
        style={[
          styles.amountValue,
          {
            color: emphasized ? theme.brandCream : theme.brandTextDim,
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
          <ThemedText
            style={[styles.primaryButtonText, { color: theme.brandBg }]}
          >
            {primaryLabel}
          </ThemedText>
        </Pressable>
      )}
      <Pressable
        onPress={goBack}
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
    const accessibleText =
      holdTimeRemaining <= 60_000
        ? "About 1 minute left to pay"
        : endingSoon
          ? "About 2 minutes left to pay"
          : "Your time is held";
    return (
      <ThemedText
        accessibilityLiveRegion="polite"
        accessibilityLabel={accessibleText}
        style={{
          color: theme.brandTextDim,
          fontSize: FontSizes.xs,
          marginTop: Spacing.sm,
        }}
      >
        {`Time held: ${formatHoldTime(holdTimeRemaining)}${endingSoon ? " · ending soon" : ""}`}
      </ThemedText>
    );
  };

  // Stands in for the cancellation-policy checkbox until the hold is ready, so
  // no policy text is shown before the deposit rule is known.
  const renderPolicyPlaceholder = (withDivider: boolean) => (
    <View
      key="cancellation"
      accessible
      accessibilityLabel="Loading cancellation policy"
    >
      {withDivider && (
        <View
          style={{
            height: 1,
            backgroundColor: theme.brandSurfaceBorder,
            marginVertical: Spacing.sm,
          }}
        />
      )}
      <View
        style={[
          styles.amountSkeleton,
          { backgroundColor: theme.brandSurfaceBorder },
        ]}
      />
      <View
        style={[
          styles.amountSkeleton,
          { backgroundColor: theme.brandSurfaceBorder, width: "60%" },
        ]}
      />
    </View>
  );

  const renderPaySection = () => {
    if (!selectedService) return null;
    if (paying) {
      return (
        <View style={[styles.loader, { paddingVertical: Spacing.md }]}>
          <ActivityIndicator size="small" color={accent} />
          <ThemedText
            style={{ color: theme.brandTextDim, marginTop: Spacing.xs }}
          >
            Starting payment...
          </ThemedText>
        </View>
      );
    }
    if (
      holdStatus === "error" ||
      holdStatus === "expired" ||
      holdStatus === "expiredAfterPayment"
    ) {
      return <View style={{ marginBottom: Spacing.xl }} />;
    }

    const locType = selectedService.serviceLocationType;
    const hasCancellationPolicy = !!selectedService.fullRefundWindow;
    const hasVendorTerms = !!(
      providerVendorTerms && providerVendorTerms.trim()
    );

    const universalReady =
      (!hasCancellationPolicy || cancellationPolicyAcknowledged) &&
      platformTermsAcknowledged &&
      (!hasVendorTerms || vendorTermsAcknowledged);

    const locationReady =
      !locType || locType === "business"
        ? businessLocationAcknowledged
        : locType === "alternate"
          ? alternateAcknowledged
          : locType === "customer"
            ? customerServiceAddress.trim().length > 0 &&
              customerServiceCity.trim().length > 0 &&
              customerServiceState.trim().length > 0 &&
              customerServiceZipCode.trim().length > 0 &&
              customerReadinessConfirmed
            : locType === "virtual"
              ? virtualLinkAcknowledged
              : true;

    // Pay stays disabled until the hold's amounts have loaded.
    const amountsReady =
      holdStatus === "ready" && typeof hold?.dueNowCents === "number";
    const disabled = !amountsReady || !locationReady || !universalReady;
    const dueNowLabel =
      typeof hold?.dueNowCents === "number"
        ? formatPrice(hold.dueNowCents)
        : "";
    const payLabel =
      autoAcceptBookings === false
        ? `Request booking · ${dueNowLabel}`
        : `Pay ${dueNowLabel}`;
    const showNonRefundable = amountsReady && !!hold?.depositNonRefundable;

    return (
      <>
        {showNonRefundable && (
          <ThemedText
            style={{
              color: theme.brandCream,
              textAlign: "center",
              marginTop: Spacing.lg,
            }}
          >
            Deposit is non-refundable once your booking is confirmed.
          </ThemedText>
        )}
        <Pressable
          onPress={() => !disabled && handlePay()}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={[
            styles.primaryButton,
            {
              backgroundColor: disabled ? theme.brandSurfaceBorder : accent,
              marginTop: showNonRefundable ? Spacing.sm : Spacing.lg,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.primaryButtonText,
              { color: disabled ? theme.brandTextDim : theme.brandBg },
            ]}
          >
            {amountsReady ? payLabel : "Pay"}
          </ThemedText>
        </Pressable>
        {disabled && (
          <ThemedText
            style={{
              color: theme.brandTextDim,
              fontSize: FontSizes.xs,
              textAlign: "center",
              marginTop: Spacing.sm,
              marginBottom: Spacing.xl,
            }}
          >
            {amountsReady
              ? "Complete all required items above to continue"
              : "Holding your time…"}
          </ThemedText>
        )}
        {!disabled && <View style={{ marginBottom: Spacing.xl }} />}
      </>
    );
  };

  // Confirmation amounts come from the snapshot taken at Pay time; the
  // PaymentIntent total is only used to cross-check what was charged.
  const renderConfirmationDetails = () => {
    const dimCenter = {
      color: theme.brandTextDim,
      marginTop: Spacing.sm,
      textAlign: "center" as const,
    };
    if (!paidSnapshot) {
      return (
        <ThemedText style={dimCenter}>
          {bookingPending
            ? `Your card has been authorized but not charged. ${providerName} has 48 hours to accept or decline your request. You'll be notified either way.`
            : "Your appointment has been booked and payment processed."}
        </ThemedText>
      );
    }

    let nowCents = paidSnapshot.dueNowCents;
    const piGross = paymentData?.feeBreakdown?.grossChargeAmount;
    if (typeof piGross === "number" && piGross !== nowCents) {
      console.warn(
        "[BookingFlow] hold due-now differs from PaymentIntent amount",
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
      <View style={{ alignSelf: "stretch", marginTop: Spacing.md }}>
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
              {`${formatPrice(nowCents)} is authorized on your card, not charged. You're only charged if ${providerName} accepts.`}
            </ThemedText>
            {hasDeposit && (
              <ThemedText style={dimCenter}>
                {`If ${providerName} accepts, your deposit becomes non-refundable.`}
              </ThemedText>
            )}
            <ThemedText style={dimCenter}>
              {`${providerName} has 48 hours to accept or decline your request. You'll be notified either way.`}
            </ThemedText>
          </>
        ) : hasDeposit && typeof atAppointment === "number" ? (
          <ThemedText style={dimCenter}>
            {`Your ${formatPrice(deposit as number)} deposit is non-refundable if you cancel. Pay the remaining ${formatPrice(atAppointment)} at your appointment.`}
          </ThemedText>
        ) : (
          <ThemedText style={dimCenter}>
            Your appointment has been booked and payment processed.
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

  const renderAmountsBlock = () => {
    if (holdStatus === "idle" || holdStatus === "loading") {
      return (
        <View accessibilityLabel="Holding your time" accessible>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.amountSkeleton,
                { backgroundColor: theme.brandSurfaceBorder },
              ]}
            />
          ))}
          <ThemedText
            style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}
          >
            Holding your time…
          </ThemedText>
        </View>
      );
    }
    if (holdStatus === "error") {
      return (
        <>
          <ThemedText style={{ color: theme.brandCream }}>
            {holdErrorCopy || "Something went wrong holding this time."}
          </ThemedText>
          {renderHoldActions("Retry")}
        </>
      );
    }
    if (holdStatus === "expired") {
      return (
        <>
          <ThemedText style={{ color: theme.brandCream }}>
            Your hold on this time expired.
          </ThemedText>
          {renderHoldActions("Hold this time again")}
        </>
      );
    }
    if (holdStatus === "expiredAfterPayment") {
      return (
        <ThemedText style={{ color: theme.brandCream }}>
          This booking session timed out. Close and start again.
        </ThemedText>
      );
    }
    if (!hold || typeof hold.dueNowCents !== "number") {
      return (
        <>
          <ThemedText style={{ color: theme.brandCream }}>
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
              color: theme.brandTextDim,
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
        {[1, 2, 3, 4, 5].map((s, i) => (
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
                {s === 1 ? "Service" : s === 2 ? "Date" : s === 3 ? "Time" : s === 4 ? "Review" : "Confirm"}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {step > 1 && step < 5 && !paying && !paymentIntentExists && (
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
                    {typeof service.depositAmountCents === "number" &&
                    service.depositAmountCents > 0
                      ? ` · ${formatPrice(service.depositAmountCents)} deposit`
                      : ""}
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

          {loadingSlots || validating ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={accent} />
              <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
                {validating ? "Validating..." : "Loading..."}
              </ThemedText>
            </View>
          ) : (() => {
            const displaySlots = slots.filter((slot) => {
              const minutes = parseInt(slot.startTime.split(":")[1], 10);
              return minutes === 0 || minutes === 30;
            });
            const { morning, afternoon } = groupSlots(displaySlots);
            return (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {morning.length > 0 && (
                  <>
                    <ThemedText style={[styles.slotGroupLabel, { color: theme.brandTextDim }]}>
                      Morning
                    </ThemedText>
                    {morning.map((slot) => (
                      <Pressable
                        key={slot.id}
                        onPress={() => handleSlotSelect(slot)}
                        disabled={slot.status !== "available"}
                        style={[
                          styles.slotListRow,
                          {
                            backgroundColor: selectedSlot?.id === slot.id ? accentSoft : theme.brandBgElevated,
                            borderColor: selectedSlot?.id === slot.id ? accent : theme.brandSurfaceBorder,
                          },
                          slot.status !== "available" && styles.slotListRowUnavailable,
                        ]}
                      >
                        <View>
                          <ThemedText
                            style={[
                              styles.slotListTime,
                              { color: selectedSlot?.id === slot.id ? accent : theme.brandCream },
                            ]}
                          >
                            {formatTime(slot.startTime)}
                          </ThemedText>
                          <ThemedText style={[styles.slotListEnd, { color: theme.brandTextDim }]}>
                            → {formatTime(slot.endTime)}
                          </ThemedText>
                        </View>
                        {selectedSlot?.id === slot.id ? (
                          <View style={[styles.slotCheckCircle, { backgroundColor: accent }]}>
                            <Feather name="check" size={12} color={theme.brandBg} />
                          </View>
                        ) : slot.status === "available" ? (
                          <View style={[styles.slotDotOpen, { backgroundColor: theme.brandSuccess }]} />
                        ) : (
                          <View style={[styles.slotDotTaken, { backgroundColor: theme.brandSurfaceBorder }]} />
                        )}
                      </Pressable>
                    ))}
                  </>
                )}

                {afternoon.length > 0 && (
                  <>
                    <ThemedText
                      style={[styles.slotGroupLabel, { color: theme.brandTextDim, marginTop: Spacing.sm }]}
                    >
                      Afternoon
                    </ThemedText>
                    {afternoon.map((slot) => (
                      <Pressable
                        key={slot.id}
                        onPress={() => handleSlotSelect(slot)}
                        disabled={slot.status !== "available"}
                        style={[
                          styles.slotListRow,
                          {
                            backgroundColor: selectedSlot?.id === slot.id ? accentSoft : theme.brandBgElevated,
                            borderColor: selectedSlot?.id === slot.id ? accent : theme.brandSurfaceBorder,
                          },
                          slot.status !== "available" && styles.slotListRowUnavailable,
                        ]}
                      >
                        <View>
                          <ThemedText
                            style={[
                              styles.slotListTime,
                              { color: selectedSlot?.id === slot.id ? accent : theme.brandCream },
                            ]}
                          >
                            {formatTime(slot.startTime)}
                          </ThemedText>
                          <ThemedText style={[styles.slotListEnd, { color: theme.brandTextDim }]}>
                            → {formatTime(slot.endTime)}
                          </ThemedText>
                        </View>
                        {selectedSlot?.id === slot.id ? (
                          <View style={[styles.slotCheckCircle, { backgroundColor: accent }]}>
                            <Feather name="check" size={12} color={theme.brandBg} />
                          </View>
                        ) : slot.status === "available" ? (
                          <View style={[styles.slotDotOpen, { backgroundColor: theme.brandSuccess }]} />
                        ) : (
                          <View style={[styles.slotDotTaken, { backgroundColor: theme.brandSurfaceBorder }]} />
                        )}
                      </Pressable>
                    ))}
                  </>
                )}

                {displaySlots.length === 0 && (
                  <ThemedText style={[styles.slotEmptyText, { color: theme.brandTextDim }]}>
                    No available times for this date.
                  </ThemedText>
                )}

                {selectedSlot && (
                  <Pressable
                    onPress={() => handleSlotSelect(selectedSlot)}
                    style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.lg }]}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: theme.brandBg }]}>
                      {`Confirm ${formatTime(selectedSlot.startTime)} →`}
                    </ThemedText>
                  </Pressable>
                )}
                {!selectedSlot && displaySlots.length > 0 && (
                  <Pressable
                    disabled
                    style={[styles.primaryButton, { backgroundColor: theme.brandSurfaceBorder, marginTop: Spacing.lg }]}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: theme.brandTextDim }]}>
                      Select a time
                    </ThemedText>
                  </Pressable>
                )}
              </ScrollView>
            );
          })()}
        </View>
      )}

      {step === 4 && selectedSlot && selectedService && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={[styles.stepTitle, { color: theme.brandCream }]}>
            Review & Confirm
          </ThemedText>

          {/* Booking summary */}
          <View style={[styles.reviewSection, { backgroundColor: accentSoft, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md }]}>
            <ThemedText style={[styles.reviewLabel, { color: theme.brandTextDim }]}>Service</ThemedText>
            <ThemedText style={[styles.reviewValue, { color: theme.brandCream, fontWeight: "600" }]}>{selectedService.name}</ThemedText>
            <ThemedText style={{ color: theme.brandTextDim, marginTop: 2 }}>
              {selectedDateDisplay} at {formatTime(selectedSlot.startTime)} · {formatDuration(selectedService.durationMinutes)}
            </ThemedText>
          </View>

          {/* Amounts — every value comes from the hold (no math here) */}
          <View
            style={[
              styles.reviewSection,
              {
                backgroundColor: theme.brandBgElevated,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: theme.brandSurfaceBorder,
                minHeight: AMOUNTS_BLOCK_MIN_HEIGHT,
              },
            ]}
          >
            {renderAmountsBlock()}
          </View>

          {/* Location section */}
          <View style={[styles.reviewSection, { backgroundColor: theme.brandBgElevated, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: theme.brandSurfaceBorder }]}>
            <ThemedText style={[styles.reviewLabel, { color: theme.brandTextDim }]}>Location</ThemedText>

            {(!selectedService.serviceLocationType || selectedService.serviceLocationType === 'business') && (
              <>
                {providerShowAddress !== false && providerAddress ? (
                  <ThemedText style={[styles.reviewValue, { color: theme.brandCream }]}>
                    {[
                      providerAddress,
                      providerCity && providerState
                        ? `${providerCity}, ${providerState}`
                        : providerCity || providerState,
                    ].filter(Boolean).join(" · ")}
                  </ThemedText>
                ) : providerShowAddress === false ? (
                  <>
                    <ThemedText style={[styles.reviewValue, { color: theme.brandCream }]}>
                      {providerCity && providerState
                        ? `${providerCity}, ${providerState}`
                        : providerCity || providerState || `${providerName}'s location`}
                    </ThemedText>
                    <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.xs, fontSize: FontSizes.xs }}>
                      The exact address will be provided once your booking is confirmed.
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText style={[styles.reviewValue, { color: theme.brandCream }]}>
                    {`${providerName}'s location`}
                  </ThemedText>
                )}
                <Pressable
                  onPress={() => setBusinessLocationAcknowledged(!businessLocationAcknowledged)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkbox, {
                    borderColor: businessLocationAcknowledged ? accent : theme.brandTextDim,
                    backgroundColor: businessLocationAcknowledged ? accentSoft : "transparent",
                  }]}>
                    {businessLocationAcknowledged && <Feather name="check" size={13} color={accent} />}
                  </View>
                  <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                    {providerShowAddress === false
                      ? "I understand this appointment takes place in the listed city"
                      : "I understand this appointment takes place at the address above"}
                  </ThemedText>
                </Pressable>
              </>
            )}

            {selectedService.serviceLocationType === 'virtual' && (
              <>
                <ThemedText style={[styles.reviewValue, { color: theme.brandCream }]}>
                  You'll join this meeting link at your appointment time:
                </ThemedText>
                <ThemedText style={{ color: accent, marginTop: Spacing.xs, fontWeight: "500" }}>
                  {selectedService.virtualLink || "Meeting link not set"}
                </ThemedText>
              </>
            )}

            {selectedService.serviceLocationType === 'alternate' && (
              <>
                <ThemedText style={[styles.reviewValue, { color: theme.brandCream }]}>
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
                    borderColor: alternateAcknowledged ? accent : theme.brandTextDim,
                    backgroundColor: alternateAcknowledged ? accentSoft : "transparent",
                  }]}>
                    {alternateAcknowledged && <Feather name="check" size={13} color={accent} />}
                  </View>
                  <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                    I understand this service takes place at the address above
                  </ThemedText>
                </Pressable>
              </>
            )}

            {selectedService.serviceLocationType === 'customer' && (
              <>
                <ThemedText style={{ color: theme.brandTextDim, marginBottom: Spacing.sm }}>
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
                    borderColor: customerReadinessConfirmed ? accent : theme.brandTextDim,
                    backgroundColor: customerReadinessConfirmed ? accentSoft : "transparent",
                  }]}>
                    {customerReadinessConfirmed && <Feather name="check" size={13} color={accent} />}
                  </View>
                  <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                    I confirm I will be ready for this service at the scheduled appointment time
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>

          {/* ── Grouped acknowledgment card ── */}
          {(() => {
            const locType = selectedService.serviceLocationType;
            const hasCancellationPolicy = !!selectedService.fullRefundWindow;
            const hasVendorTerms = !!(providerVendorTerms && providerVendorTerms.trim());

            const rows: React.ReactElement[] = [];

            // Virtual link row — only for virtual services
            if (locType === 'virtual') {
              rows.push(
                <Pressable
                  key="virtual"
                  onPress={() => setVirtualLinkAcknowledged(!virtualLinkAcknowledged)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkbox, {
                    borderColor: virtualLinkAcknowledged ? accent : theme.brandTextDim,
                    backgroundColor: virtualLinkAcknowledged ? accent : "transparent",
                  }]}>
                    {virtualLinkAcknowledged && <Feather name="check" size={13} color={theme.brandBg} />}
                  </View>
                  <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                    I understand I will join this meeting link at my scheduled appointment time.
                  </ThemedText>
                </Pressable>
              );
            }

            // Cancellation policy row — shown when service has a policy
            if (hasCancellationPolicy && !policyReady) {
              rows.push(renderPolicyPlaceholder(rows.length > 0));
            } else if (hasCancellationPolicy) {
              rows.push(
                <View key="cancellation">
                  {rows.length > 0 && <View style={{ height: 1, backgroundColor: theme.brandSurfaceBorder, marginVertical: Spacing.sm }} />}
                  <Pressable
                    onPress={() => setCancellationPolicyAcknowledged(!cancellationPolicyAcknowledged)}
                    style={styles.checkboxRow}
                  >
                    <View style={[styles.checkbox, {
                      borderColor: cancellationPolicyAcknowledged ? accent : theme.brandTextDim,
                      backgroundColor: cancellationPolicyAcknowledged ? accent : "transparent",
                    }]}>
                      {cancellationPolicyAcknowledged && <Feather name="check" size={13} color={theme.brandBg} />}
                    </View>
                    <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                      {"I agree to the "}
                      <ThemedText
                        onPress={() => setShowCancellationModal(true)}
                        style={{ color: accent, textDecorationLine: "underline" }}
                      >
                        Cancellation Policy
                      </ThemedText>
                    </ThemedText>
                  </Pressable>
                  <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs, marginTop: 4, marginLeft: 22 + Spacing.sm }}>
                    {shortCancellationSummary(selectedService, serviceHasDeposit)}
                  </ThemedText>
                </View>
              );
            }

            // Platform T&C row — always shown
            {
              rows.push(
                <View key="platform">
                  {rows.length > 0 && <View style={{ height: 1, backgroundColor: theme.brandSurfaceBorder, marginVertical: Spacing.sm }} />}
                  <Pressable
                    onPress={() => setPlatformTermsAcknowledged(!platformTermsAcknowledged)}
                    style={styles.checkboxRow}
                  >
                    <View style={[styles.checkbox, {
                      borderColor: platformTermsAcknowledged ? accent : theme.brandTextDim,
                      backgroundColor: platformTermsAcknowledged ? accent : "transparent",
                    }]}>
                      {platformTermsAcknowledged && <Feather name="check" size={13} color={theme.brandBg} />}
                    </View>
                    <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                      {"I agree to the "}
                      <ThemedText
                        onPress={() => navigation.navigate("TermsOfService")}
                        style={{ color: accent, textDecorationLine: "underline" }}
                      >
                        Terms and Conditions
                      </ThemedText>
                    </ThemedText>
                  </Pressable>
                </View>
              );
            }

            // Vendor T&C row — only when vendor has set terms
            if (hasVendorTerms) {
              rows.push(
                <View key="vendorterms">
                  {<View style={{ height: 1, backgroundColor: theme.brandSurfaceBorder, marginVertical: Spacing.sm }} />}
                  <Pressable
                    onPress={() => setVendorTermsAcknowledged(!vendorTermsAcknowledged)}
                    style={styles.checkboxRow}
                  >
                    <View style={[styles.checkbox, {
                      borderColor: vendorTermsAcknowledged ? accent : theme.brandTextDim,
                      backgroundColor: vendorTermsAcknowledged ? accent : "transparent",
                    }]}>
                      {vendorTermsAcknowledged && <Feather name="check" size={13} color={theme.brandBg} />}
                    </View>
                    <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                      {"I agree to "}
                      <ThemedText
                        onPress={() => setShowVendorTermsModal(true)}
                        style={{ color: accent, textDecorationLine: "underline" }}
                      >
                        {`${providerName}'s Terms and Conditions`}
                      </ThemedText>
                    </ThemedText>
                  </Pressable>
                </View>
              );
            }

            return rows.length > 0 ? (
              <View style={[styles.reviewSection, {
                backgroundColor: theme.brandBgElevated,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: theme.brandSurfaceBorder,
                marginTop: Spacing.sm,
              }]}>
                {rows}
              </View>
            ) : null;
          })()}

          {renderPaySection()}
        </ScrollView>
      )}

      {step === 5 && (
        <View style={[styles.stepContent, styles.successContainer]}>
          <Feather
            name={bookingPending ? "clock" : "check-circle"}
            size={64}
            color={bookingPending ? theme.warning : theme.brandSuccess}
          />
          <ThemedText style={[styles.successTitle, { color: theme.brandCream }]}>
            {bookingPending ? "Request Submitted!" : "Booking Confirmed!"}
          </ThemedText>
          {renderConfirmationDetails()}
          <Pressable
            onPress={() => navigation.dispatch(CommonActions.navigate({ name: "Sessions" }))}
            style={[styles.primaryButton, { backgroundColor: theme.brandPrimary, marginTop: Spacing.xl }]}
          >
            <ThemedText style={[styles.primaryButtonText, { color: theme.brandPrimaryText }]}>Done</ThemedText>
          </Pressable>
        </View>
      )}

      {/* Cancellation policy detail modal */}
      <Modal
        visible={showCancellationModal && policyReady}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancellationModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.brandBgElevated, maxWidth: 360 }]}>
            <ThemedText type="body" style={[styles.modalTitle, { fontWeight: "600", color: theme.brandCream }]}>
              Cancellation Policy
            </ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.brandTextDim, textAlign: "left" }]}>
              {selectedService && selectedDate && selectedSlot
                ? describeCancellationPolicyForService(selectedService, selectedDate, selectedSlot.startTime, serviceHasDeposit)
                : ""}
            </ThemedText>
            <Pressable
              onPress={() => setShowCancellationModal(false)}
              style={[styles.modalButton, { backgroundColor: theme.brandSurfaceBorder, width: "100%" }]}
            >
              <ThemedText style={{ color: theme.brandCream }}>Got it</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Vendor terms detail modal */}
      <Modal
        visible={showVendorTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVendorTermsModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay, justifyContent: "flex-end", padding: 0 }]}>
          <View style={{ backgroundColor: theme.brandBgElevated, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.xl, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
              <ThemedText style={{ color: theme.brandCream, fontWeight: "600", fontSize: FontSizes.md }}>
                {`${providerName}'s Terms & Conditions`}
              </ThemedText>
              <Pressable onPress={() => setShowVendorTermsModal(false)}>
                <Feather name="x" size={22} color={theme.brandTextDim} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator>
              <ThemedText style={{ color: theme.brandTextDim, lineHeight: 22 }}>
                {providerVendorTerms || ""}
              </ThemedText>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    flex: 1,
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
  slotGroupLabel: {
    fontSize: FontSizes.xs,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    paddingLeft: 2,
  },
  slotListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 4,
    marginBottom: Spacing.xs + 2,
    borderWidth: 1,
  },
  slotListRowUnavailable: {
    opacity: 0.28,
  },
  slotListTime: {
    fontSize: FontSizes.md,
    fontWeight: "500",
  },
  slotListEnd: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  slotCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  slotDotOpen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  slotDotTaken: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  slotEmptyText: {
    fontSize: FontSizes.sm,
    textAlign: "center",
    marginTop: Spacing.xl,
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
  reviewSection: {
    marginBottom: Spacing.md,
  },
  reviewLabel: {
    fontSize: FontSizes.xs,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  reviewValue: {
    fontSize: FontSizes.md,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    marginBottom: Spacing.sm,
    minHeight: 44,
  },
});

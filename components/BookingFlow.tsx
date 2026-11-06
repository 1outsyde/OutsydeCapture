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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { useNotifications } from "@/context/NotificationContext";
import { Spacing, BorderRadius, Typography, FontSizes } from "@/constants/theme";
import api, {
  BookingService,
  AvailabilityCalendarDay,
  AvailabilitySlot,
  BookingHoldResponse,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import UsePointsPicker, { SelectedPointsCode } from "@/components/UsePointsPicker";
import { formatDuration } from "@/utils/duration";
import { sheetOptions } from "@/utils/paymentSheetOptions";
import { readableTextOn } from "@/constants/colorOptions";
import { needsCalendarPermission } from "@/utils/ticketCheckoutLogic";
import {
  bookedCalendarEvent,
  bookedPlaceLine,
  canAddToCalendar,
  pendingPointsLine,
} from "@/utils/bookingBookedLogic";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  agreementParts,
  agreementPayload,
  agreementText,
  isAddressComplete,
  payBlockReason,
  type ServiceLocationType,
} from "@/utils/bookingReviewLogic";
import {
  visibleSlots,
  groupByPeriod,
  weekWindow,
  weekStartFor,
  previousWeekStart,
  monthsTouched,
  monthOf,
  dayStatus,
  isBookableStatus,
  firstBookableDay,
  priceLine,
  toISODate,
  fromISODate,
  addDays,
} from "@/utils/bookingTimeLogic";

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
  // The service the customer tapped on the profile: the flow opens on its
  // date step (Back still reaches the service list). Ignored when the service
  // isn't in the bookable list.
  preselectedServiceId?: string;
  // Leaves booking mode and shows the provider's profile again. Called from
  // the hold-expired pop-up; without it the flow resets to its first step.
  onExit?: () => void;
  // Done on the confirmation step. Without it, Done opens Sessions directly.
  onDone?: () => void;
  // Message on the Booked screen (step 4): closes booking, then opens the chat
  // with the provider. Without it the button is hidden.
  onMessage?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const formatPrice = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

// Backend default hold length (availabilityService DEFAULT_HOLD_DURATION_MINUTES).
// Fallback only: the countdown uses the server's expiry (create-payment-intent
// holdExpiresAt, else the hold's expiresAt) and falls back to the device clock
// from when the hold was requested.
const HOLD_TTL_MS = 10 * 60 * 1000;

// Server expiry when it parses and is still in the future on this device,
// otherwise the fallback (old backend, or a device clock far off the server's).
const resolveHoldExpiry = (
  serverIso: string | null | undefined,
  fallbackMs: number,
): number => {
  if (typeof serverIso === "string") {
    const ms = Date.parse(serverIso);
    if (Number.isFinite(ms) && ms > Date.now()) return ms;
  }
  return fallbackMs;
};

// Stripe errors that mean the PaymentIntent can no longer be paid, e.g. the
// backend cancelled it after the hold expired.
const isPaymentIntentGoneError = (
  e:
    | {
        message?: string;
        localizedMessage?: string;
        stripeErrorCode?: string;
      }
    | null
    | undefined,
): boolean => {
  if (!e) return false;
  if (e.stripeErrorCode === "payment_intent_unexpected_state") return true;
  const text = `${e.message ?? ""} ${e.localizedMessage ?? ""}`;
  return /payment_intent_unexpected_state|unexpected state|status of cancell?ed|payment ?intent.*\bcancell?ed\b|\bcancell?ed\b.*payment ?intent/i.test(
    text,
  );
};

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
  addons?: { id: string; name: string; priceCents: number }[] | null;
  // Outsyde loyalty rewards taken off what was paid now (0 = none).
  rewardsCents?: number;
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

// Points code refusals from create-payment-intent (backend #314) carry their own copy.
const PROMO_ERROR_CODES = new Set(["INVALID_PROMO", "PROMO_TOO_LARGE", "PROMO_IN_USE", "PROMO_UPDATE_FAILED", "PROMO_CHECK_FAILED"]);
const isPromoError = (err: any): boolean => PROMO_ERROR_CODES.has(err?.body?.code);

const mapPayError = (err: any): string => {
  if (isPromoError(err) && typeof err?.body?.error === "string") {
    return err.body.error;
  }
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

const formatTime = (time24: string): string => {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === "00" ? `${hour12}:00 ${period}` : `${hour12}:${minute} ${period}`;
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

// Service image tile; falls back to the gradient placeholder when there is no
// image or it failed to load.
function ServiceThumb({
  service,
  showImage,
  size,
  radius,
  onFail,
}: {
  service: BookingService;
  showImage: boolean;
  size: number;
  radius: number;
  onFail: (serviceId: string) => void;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        marginRight: Spacing.md,
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: service.imageUrl! }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => onFail(service.id)}
        />
      ) : (
        <LinearGradient
          colors={["#2a2a2a", "#111111"]}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

// Wraps a summary box's content in a row with a 56px thumbnail, only when the
// service has a usable image; otherwise renders the children unchanged.
function ServiceSummaryRow({
  service,
  showImage,
  onFail,
  children,
}: {
  service: BookingService | null;
  showImage: boolean;
  onFail: (serviceId: string) => void;
  children: React.ReactNode;
}) {
  if (!service || !showImage) return <>{children}</>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <ServiceThumb service={service} showImage size={56} radius={8} onFail={onFail} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
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
  preselectedServiceId,
  onExit,
  onDone,
  onMessage,
}: BookingFlowProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = accentColor || theme.brandGold;
  const accentDim = accentColor ? accentColor + "CC" : theme.brandGoldDim;
  const accentSoft = accentColor ? accentColor + "25" : theme.brandGold + "25";
  // Black or white text on the store color, whichever reads better (any wheel
  // shade, light or dark mode). Booking redesign step 2.
  const onAccent = readableTextOn(accent);
  const { getToken, isAuthenticated } = useAuth();
  const { refreshSessions } = useData();
  const { addNotification, sendBookingConfirmation, scheduleBookingReminders } = useNotifications();
  const navigation = useNavigation<NavigationProp>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [failedServiceImages, setFailedServiceImages] = useState<Set<string>>(new Set());
  const hasServiceImage = (s?: BookingService | null) =>
    !!s?.imageUrl && !failedServiceImages.has(s.id);
  const showServiceImages = useMemo(() => services.some((s) => !!s.imageUrl), [services]);
  const markServiceImageFailed = (id: string) =>
    setFailedServiceImages((prev) => new Set(prev).add(id));
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  // Calendar days per service and month ("serviceId|YYYY-MM"): the week row can
  // span two months and the month sheet can browse ahead (step 2 redesign).
  const [calendarByKey, setCalendarByKey] = useState<Record<string, AvailabilityCalendarDay[]>>({});
  const calendarInFlightRef = useRef<Set<string>>(new Set());
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [weekStart, setWeekStart] = useState<string>(() => toISODate(new Date()));
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const calendarFor = useCallback(
    (ym: string): AvailabilityCalendarDay[] | undefined =>
      selectedService ? calendarByKey[`${selectedService.id}|${ym}`] : undefined,
    [calendarByKey, selectedService],
  );
  // The month sheet reads the month it is showing.
  const calendarDays = calendarFor(currentMonth) ?? [];
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
  // "Use my points": the code applied to this booking (sent on every Pay).
  const [pointsCode, setPointsCode] = useState<SelectedPointsCode | null>(null);
  const [pointsRefreshKey, setPointsRefreshKey] = useState(0);
  const [refusedCodeIds, setRefusedCodeIds] = useState<Set<string>>(() => new Set());
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
  const [showHoldExpiredModal, setShowHoldExpiredModal] = useState(false);

  // Add-ons step (business, no staff member, service has add-ons)
  const [showAddonsStep, setShowAddonsStep] = useState(false);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [addonFitError, setAddonFitError] = useState<string | null>(null);
  const [checkingAddonFit, setCheckingAddonFit] = useState(false);
  const [bookingCustomerDetails, setBookingCustomerDetails] = useState<string>("");

  // Review step state
  const [customerServiceAddress, setCustomerServiceAddress] = useState("");
  const [customerServiceCity, setCustomerServiceCity] = useState("");
  const [customerServiceState, setCustomerServiceState] = useState("");
  const [customerServiceZipCode, setCustomerServiceZipCode] = useState("");
  // Step 3 (Legend 2026-11-06): one agreement box (policy, vendor terms,
  // Outsyde Terms and the place) instead of up to five. Sent to the backend (#422).
  const [agreed, setAgreed] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showVendorTermsModal, setShowVendorTermsModal] = useState(false);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  // holdRef always mirrors `hold` (set only through applyHold) so cleanup and
  // async callbacks see the current hold.
  const holdRef = useRef<BookingHoldResponse | null>(null);
  // Expiry of the current hold in device-clock ms (see HOLD_TTL_MS).
  const holdExpiresAtRef = useRef<number>(0);
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
  // preselectedServiceId is applied once, on the first service list load.
  const preselectAppliedRef = useRef(false);
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

  // Choose a time (step 2): load the months the week row shows, plus the
  // month the calendar sheet is on while it is open.
  useEffect(() => {
    if (step !== 2 || !selectedService) return;
    const months = monthsTouched(weekWindow(weekStart));
    if (monthSheetOpen && !months.includes(currentMonth)) months.push(currentMonth);
    months.forEach((ym) => fetchCalendarMonth(ym));
  }, [step, selectedService, weekStart, monthSheetOpen, currentMonth]);

  // Open on the first day with openings in the week row, until the customer
  // picks a day themselves.
  useEffect(() => {
    if (step !== 2 || !selectedService || selectedDate) return;
    const first = firstBookableDay(weekWindow(weekStart), todayISO, calendarFor);
    if (first) setSelectedDate(first);
  }, [step, selectedService, selectedDate, weekStart, calendarFor, todayISO]);

  useEffect(() => {
    if (step === 2 && selectedDate) {
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
    // The countdown runs on the review step, before and after payment starts,
    // until the hold expires or the booking is paid.
    if (hold && step === 4 && holdStatus === "ready") {
      const updateTimer = () => {
        const remaining = Math.max(
          0,
          holdExpiresAtRef.current - Date.now(),
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
  }, [hold, step, holdStatus]);

  // Whether the business confirms bookings manually; only changes the Pay
  // button label, never blocks it.
  useEffect(() => {
    if (!providerId) return;
    let active = true;
    // Step 5: photographers too (their manual accept is locked off on the
    // server today, but the label should be right once it unlocks).
    const load: Promise<{ autoAcceptBookings?: boolean } | null | undefined> =
      providerType === "photographer"
        ? (api.getPhotographer(providerId) as Promise<any>)
        : api.getBusiness(providerId);
    load
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
      // Quotes 6c-2b: contact for pricing services are never booked here (they open the request form).
      const activeServices = data.filter((s) => (s.status === "live" || s.status === "active" || !s.status) && (s as { requestOnly?: boolean | null }).requestOnly !== true);
      setServices(activeServices);
      // Open on the tapped service once, only if the customer hasn't moved on.
      if (preselectedServiceId && !preselectAppliedRef.current) {
        preselectAppliedRef.current = true;
        const match = activeServices.find((s) => s.id === preselectedServiceId);
        if (match && stepRef.current === 1) {
          setSelectedService(match);
          setSelectedDate(null);
          setSelectedSlot(null);
          setShowAddonsStep(false);
          setSelectedAddonIds([]);
          setBookingCustomerDetails("");
          setAddonFitError(null);
          setStep(2);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoadingServices(false);
    }
  };

  // One month of day statuses for the selected service (same request as
  // before; cached per service and month so the week row and month sheet share it).
  const fetchCalendarMonth = async (ym: string) => {
    const [yearStr, monthStr] = ym.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const service = selectedService;

    // HARD GUARD: Do NOT call API unless ALL required params are defined
    if (!providerId || !providerType || !year || !month || !service) {
      return;
    }
    const key = `${service.id}|${ym}`;
    if (calendarByKey[key] || calendarInFlightRef.current.has(key)) return;
    calendarInFlightRef.current.add(key);

    setLoadingCalendar(true);
    try {
      const response = await api.getAvailabilityCalendar(providerId, providerType, year, month, service.durationMinutes ?? 60, staffMemberId ?? undefined);
      if (!mountedRef.current) return;
      setCalendarByKey((prev) => ({ ...prev, [key]: response.days || [] }));
    } catch (err: any) {
      console.error("[BookingFlow] Calendar fetch error:", err);
      if (mountedRef.current) setError(err.message || "Failed to load calendar");
    } finally {
      calendarInFlightRef.current.delete(key);
      if (mountedRef.current) setLoadingCalendar(calendarInFlightRef.current.size > 0);
    }
  };

  // Drops time lists that arrive after the customer picked another day.
  const slotsReqSeqRef = useRef(0);

  const fetchSlots = async () => {
    if (!selectedDate || !selectedService) return;
    const seq = ++slotsReqSeqRef.current;
    setLoadingSlots(true);
    try {
      const serviceDuration = selectedService.durationMinutes || 60;
      console.log("[BookingFlow] Fetching slots for:", { providerId, providerType, selectedDate, serviceDuration });
      const response = await api.getAvailabilitySlots(providerId, providerType, selectedDate, serviceDuration, staffMemberId ?? undefined);
      console.log("[BookingFlow] Slots response:", JSON.stringify(response, null, 2));
      if (seq !== slotsReqSeqRef.current || !mountedRef.current) return;
      const availableSlots = response.slots?.filter((s) => s.status === "available") || [];
      setSlots(availableSlots);
    } catch (err: any) {
      console.error("[BookingFlow] Slots fetch error:", err);
      if (seq === slotsReqSeqRef.current && mountedRef.current) {
        setError(err.message || "Failed to load time slots");
      }
    } finally {
      if (seq === slotsReqSeqRef.current && mountedRef.current) setLoadingSlots(false);
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
        // Step 2 redesign: tapping a time selects it; Continue moves on.
        setSelectedSlot(slot);
        setValidatedEndTime(response.endTime || null);
        setAddonFitError(null);
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

  // The add-ons step runs after a time is picked:
  //  - business-owned services (no staff member) that have add-ons;
  //  - every photographer service, so the customer always gets the
  //    "Details for your provider" box (add-on list only when there are any).
  const showsAddonsStep = (service: BookingService | null | undefined): boolean => {
    if (!service) return false;
    if (providerType === "photographer") return true;
    return providerType === "business" && !staffMemberId && (service.addons?.length ?? 0) > 0;
  };

  const handleAddonsContinue = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return;
    const timeAdding = selectedAddonIds.reduce((sum, id) => {
      const addon = selectedService.addons?.find((a) => a.id === id);
      return sum + (addon?.durationMinutes ?? 0);
    }, 0);
    if (timeAdding > 0) {
      setCheckingAddonFit(true);
      setAddonFitError(null);
      try {
        const serviceDuration = selectedService.durationMinutes || 60;
        const response = await api.getAvailabilitySlots(
          providerId, providerType, selectedDate,
          serviceDuration, undefined, selectedService.id, selectedAddonIds
        );
        const available = (response.slots || []).filter((s) => s.status === "available");
        const stillAvailable = available.some((s) => s.startTime === selectedSlot.startTime);
        if (!stillAvailable) {
          const totalMins = serviceDuration + timeAdding;
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          const durationStr = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
          setAddonFitError(
            `With these add-ons this service takes ${durationStr}, which doesn't fit at ${formatTime(selectedSlot.startTime)}. Please pick another time.`
          );
          return;
        }
      } catch {
        setAddonFitError("Couldn't check the time, try again.");
        return;
      } finally {
        setCheckingAddonFit(false);
      }
    }
    setShowAddonsStep(false);
    setStep(4);
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
        ...(selectedAddonIds.length ? { addonIds: selectedAddonIds } : {}),
        ...(bookingCustomerDetails.trim() ? { customerDetails: bookingCustomerDetails.trim() } : {}),
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

      holdExpiresAtRef.current = resolveHoldExpiry(
        response.expiresAt,
        requestStartedAt + HOLD_TTL_MS,
      );
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

  // Photographer bookings (step 5): copied from the old BookingScreen
  // (≈:900-917) so the wording and timing stay the same.
  const notifyPhotographerBooked = async (isPending: boolean) => {
    if (!selectedDate || !selectedSlot) return;
    const name = providerName || "the photographer";
    const d = new Date(selectedDate + "T00:00:00");
    const formattedDate = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const formattedTime = selectedSlot.startTime;
    await addNotification({
      type: "booking",
      title: isPending ? "Booking Submitted" : "Booking Confirmed",
      body: isPending
        ? `Your booking request with ${name} on ${formattedDate} has been submitted. Awaiting provider approval (up to 48h).`
        : `Your session with ${name} on ${formattedDate} has been confirmed.`,
    });
    if (!isPending) {
      await sendBookingConfirmation(name, formattedDate, formattedTime);
      const [yr, mo, dy] = selectedDate.split("-").map(Number);
      const [hr, min] = selectedSlot.startTime.split(":").map(Number);
      await scheduleBookingReminders(name, formattedDate, formattedTime, new Date(yr, mo - 1, dy, hr, min));
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
      addons: currentHold.addons ?? null,
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

      // Read the token before the hold is marked as paid for, so a signed-out
      // customer's hold can still be released.
      const token = await getToken();
      if (!token) throw { status: 401, message: "Not signed in" };

      // From here on the backend has a booking for this hold, so it is never
      // released; a retry reuses the same hold and PaymentIntent.
      piCalledHoldIdsRef.current.add(currentHold.holdId);
      attempt = (piAttemptsRef.current.get(currentHold.holdId) ?? 0) + 1;
      piAttemptsRef.current.set(currentHold.holdId, attempt);
      const pd = await api.createHoldPaymentIntent(
        token,
        currentHold.holdId,
        customerAddress,
        pointsCode?.id ?? null,
        agreementPayload(agreed),
      );
      piCreatedHoldIdsRef.current.add(currentHold.holdId);
      // Newer backends send the hold's expiry with the PaymentIntent.
      holdExpiresAtRef.current = resolveHoldExpiry(
        pd.holdExpiresAt,
        holdExpiresAtRef.current,
      );

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Outsyde",
        paymentIntentClientSecret: pd.clientSecret,
        defaultBillingDetails: { name: providerName },
        // Apple Pay on iPhone; saved cards and the Save box when the backend sent a session.
        ...sheetOptions(pd, Platform.OS),
      });
      if (initError) {
        if (isHoldExpiredNow() || isPaymentIntentGoneError(initError)) {
          throw { holdExpired: true, message: initError.message };
        }
        throw { sheetError: true, message: initError.message };
      }

      // The Payment Sheet closes itself when the hold expires.
      const msLeft = holdExpiresAtRef.current - Date.now();
      if (msLeft <= 0) throw { holdExpired: true, message: "Hold expired" };
      const { error: presentError } = await presentPaymentSheet({
        timeout: Math.max(1, Math.floor(msLeft)),
      });
      if (presentError) {
        const code = presentError.code as string;
        if (
          code === "Timeout" ||
          isHoldExpiredNow() ||
          (code !== "Canceled" && isPaymentIntentGoneError(presentError))
        ) {
          throw { holdExpired: true, message: presentError.message };
        }
        if (code === "Canceled") return;
        throw { sheetError: true, message: presentError.message };
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshSessions().catch(() => {});
      if (typeof pd.amountChargedNowCents === "number") {
        snapshot.dueNowCents = pd.amountChargedNowCents;
      }
      snapshot.rewardsCents = typeof pd.discountCents === "number" ? pd.discountCents : 0;
      setPaidSnapshot(snapshot);
      setPaymentData(pd);
      setBookingPending(Boolean(pd.requiresApproval));
      if (providerType === "photographer") {
        // Step 5: same phone alert, reminders and notification the old
        // photographer screen gave. The server only emails reminders for
        // business appointments, never shoots. Best effort, never blocks.
        notifyPhotographerBooked(Boolean(pd.requiresApproval)).catch((e) =>
          console.warn("[BookingFlow] booking notifications failed", e?.message),
        );
      }
      setStep(5);
    } catch (err: any) {
      console.warn("[BookingFlow] payment failed", err?.message);
      const backendHoldExpired = err?.body?.errorCode === "HOLD_EXPIRED";
      if (backendHoldExpired || err?.holdExpired || isHoldExpiredNow()) {
        // The backend rejects an expired hold before it looks for or creates
        // a booking, so HOLD_EXPIRED on the first attempt proves nothing was
        // created and the customer may hold again. After any earlier attempt
        // (which may have created a booking) only leaving is offered.
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        if (backendHoldExpired && attempt === 1) {
          applyHold(null);
          setHoldStatus("expired");
        } else {
          setHoldStatus("expiredAfterPayment");
        }
        setShowHoldExpiredModal(true);
      } else if (isPromoError(err)) {
        const refusedId = pointsCode?.id;
        if (refusedId && err?.body?.code === "PROMO_IN_USE") setRefusedCodeIds((prev) => new Set(prev).add(refusedId));
        setPointsCode(null);
        setPointsRefreshKey((k) => k + 1);
        setError(mapPayError(err));
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

  const isHoldExpiredNow = () =>
    holdExpiresAtRef.current > 0 && Date.now() >= holdExpiresAtRef.current;

  const handleHoldExpired = () => {
    if (stepRef.current !== 4) return;
    // While a payment is running handlePay decides: the Payment Sheet closes
    // itself at expiry, and anything still in flight checks expiry on return.
    if (payingRef.current) return;
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    const current = holdRef.current;
    if (current && piCalledHoldIdsRef.current.has(current.holdId)) {
      // A booking may exist for this hold, so it is kept, not cleared.
      setHoldStatus("expiredAfterPayment");
    } else {
      applyHold(null);
      setHoldStatus("expired");
    }
    setShowHoldExpiredModal(true);
  };

  // Clears the flow back to its first step (hold-expired pop-up).
  const resetFlow = () => {
    invalidateHoldRequests();
    releaseHoldIfSafe(holdRef.current);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    applyHold(null);
    setHoldStatus("idle");
    setHoldErrorCopy(null);
    setError(null);
    setAgreed(false);
    setShowAddonsStep(false);
    setSelectedAddonIds([]);
    setBookingCustomerDetails("");
    setAddonFitError(null);
    setSelectedSlot(null);
    setValidatedEndTime(null);
    setSelectedDate(null);
    setSlots([]);
    setSelectedService(null);
    setStep(1);
  };

  // "Back to {provider}": leave booking mode and show the provider's profile.
  const handleHoldExpiredBack = () => {
    setShowHoldExpiredModal(false);
    resetFlow();
    onExit?.();
  };

  // X: close and go to the home screen.
  const handleHoldExpiredClose = () => {
    setShowHoldExpiredModal(false);
    resetFlow();
    onExit?.();
    navigation.dispatch(
      CommonActions.navigate({
        name: "Main",
        params: { screen: "DiscoverTab", params: { screen: "Discover" } },
      }),
    );
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
    setWeekStart(todayISO);
    setMonthSheetOpen(false);
    setSelectedSlot(null);
    setShowAddonsStep(false);
    setSelectedAddonIds([]);
    setBookingCustomerDetails("");
    setAddonFitError(null);
  };

  // Step 2 redesign: picking a day stays on the same screen and keeps the
  // add-ons and note; only the time is cleared.
  const handleDateSelect = (date: string, status: string) => {
    if (!isBookableStatus(status as any)) return;
    Haptics.selectionAsync();
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSlots([]);
    setSelectedSlot(null);
    setValidatedEndTime(null);
    setAddonFitError(null);
  };

  // Picking a day in the month sheet also moves the week row to it.
  const handleMonthDayPick = (date: string, status: string) => {
    if (!isBookableStatus(status as any)) return;
    handleDateSelect(date, status);
    setWeekStart(weekStartFor(date, todayISO));
    setMonthSheetOpen(false);
  };

  const openMonthSheet = () => {
    Haptics.selectionAsync();
    setCurrentMonth(monthOf(selectedDate ?? weekStart));
    setMonthSheetOpen(true);
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
    if (showAddonsStep) {
      setShowAddonsStep(false);
      setSelectedAddonIds([]);
      setBookingCustomerDetails("");
      setAddonFitError(null);
      return;
    }
    if (step === 2) {
      setStep(1);
      setSelectedService(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedDate(null);
      setSlots([]);
    } else if (step === 4) {
      setAgreed(false);
      // Drop any in-flight hold request and release the current hold (only
      // possible before payment; back is hidden once a PaymentIntent exists).
      invalidateHoldRequests();
      releaseHoldIfSafe(holdRef.current);
      applyHold(null);
      setHoldStatus("idle");
      setHoldErrorCopy(null);
      setError(null);
      setAddonFitError(null);
      // Step 2 redesign: back to Choose a time with the day, time, add-ons
      // and note still picked.
      setStep(2);
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
            style={[styles.primaryButtonText, { color: onAccent }]}
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
    if (!hold) return null;
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
        <View style={[styles.bottomBar, styles.loader, { paddingVertical: Spacing.md, backgroundColor: theme.brandBgElevated, borderTopColor: theme.brandSurfaceBorder }]}>
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
      // The amounts card shows what happened and how to hold the time again.
      return null;
    }

    const locType = selectedService.serviceLocationType;
    const hasCancellationPolicy = !!selectedService.fullRefundWindow;
    // Pay stays disabled until the hold's amounts have loaded.
    const amountsReady =
      holdStatus === "ready" && typeof hold?.dueNowCents === "number";
    const reason = payBlockReason({
      amountsReady,
      needsAddress: locType === "customer",
      addressComplete: isAddressComplete({
        line1: customerServiceAddress,
        city: customerServiceCity,
        state: customerServiceState,
        zipCode: customerServiceZipCode,
      }),
      policyLoading: hasCancellationPolicy && !policyReady,
      agreed,
    });
    const disabled = reason !== null;
    const dueNowLabel =
      typeof hold?.dueNowCents === "number"
        ? formatPrice(hold.dueNowCents - (pointsCode?.discountCents ?? 0))
        : "";
    const isRequest = autoAcceptBookings === false;
    const showNonRefundable = amountsReady && !!hold?.depositNonRefundable;

    return (
      <View style={[styles.bottomBar, { backgroundColor: theme.brandBgElevated, borderTopColor: theme.brandSurfaceBorder }]}>
        {showNonRefundable && (
          <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs, textAlign: "center", marginBottom: Spacing.sm }}>
            Deposit is non-refundable once your booking is confirmed.
          </ThemedText>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs }}>Due today</ThemedText>
            <ThemedText style={{ color: theme.brandCream, fontWeight: "800", fontSize: FontSizes.lg }}>
              {amountsReady ? dueNowLabel : "…"}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => !disabled && handlePay()}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityHint={reason ?? undefined}
            style={[
              styles.primaryButton,
              { flex: 1.2, marginTop: 0, backgroundColor: disabled ? theme.brandSurfaceBorder : accent },
            ]}
          >
            <ThemedText style={[styles.primaryButtonText, { color: disabled ? theme.brandTextDim : onAccent }]}>
              {isRequest ? "Request booking" : amountsReady ? `Pay ${dueNowLabel}` : "Pay"}
            </ThemedText>
          </Pressable>
        </View>
        {reason && (
          <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs, textAlign: "center", marginTop: Spacing.sm }}>
            {reason}
          </ThemedText>
        )}
      </View>
    );
  };

  // Booking redesign step 4 (Legend 2026-11-06): the Booked screen. Details,
  // amounts, pending points from the server, Add to calendar (not for requests
  // still waiting), Message and Done, all in the store color.
  const [calendarNote, setCalendarNote] = useState("");
  const bookedEvent = useMemo(() => {
    if (!selectedService || !selectedDate || !selectedSlot) return null;
    const svc = selectedService;
    const place = bookedPlaceLine({
      locationType: svc.serviceLocationType,
      businessAddress: providerAddress,
      businessShowAddress: providerShowAddress,
      businessCity: providerCity,
      businessState: providerState,
      alternateLine: [
        svc.alternateAddress,
        [svc.alternateCity, svc.alternateState].filter(Boolean).join(", "),
        svc.alternateZipCode,
      ].filter(Boolean).join(", "),
      customerLine: [
        customerServiceAddress,
        [customerServiceCity, customerServiceState].filter((x) => x.trim()).join(", "),
        customerServiceZipCode,
      ].filter((x) => x && x.trim()).join(", "),
      virtualLink: svc.virtualLink,
    });
    const addonMinutes = selectedAddonIds.reduce((m, id) => {
      const a = svc.addons?.find((x) => x.id === id) as { durationMinutes?: number } | undefined;
      return m + (a?.durationMinutes ?? 0);
    }, 0);
    return {
      place,
      event: bookedCalendarEvent({
        serviceName: svc.name,
        providerName,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: validatedEndTime || selectedSlot.endTime,
        durationMinutes: (svc.durationMinutes ?? 0) + addonMinutes,
        place,
        virtualLink: svc.serviceLocationType === "virtual" ? svc.virtualLink : null,
        bookingNumber: paymentData?.bookingNumber ?? null,
      }),
    };
  }, [selectedService, selectedDate, selectedSlot, validatedEndTime, providerAddress, providerShowAddress,
      providerCity, providerState, providerName, customerServiceAddress, customerServiceCity,
      customerServiceState, customerServiceZipCode, selectedAddonIds, paymentData]);

  const addBookingToCalendar = async () => {
    const e = bookedEvent?.event;
    if (!e) return;
    setCalendarNote("");
    try {
      const Calendar = await import("expo-calendar/legacy");
      // Below iOS 17 the system editor needs calendar permission first (same as tickets).
      if (needsCalendarPermission(Platform.OS, Platform.Version)) {
        const { granted } = await Calendar.requestCalendarPermissionsAsync();
        if (!granted) {
          setCalendarNote("Allow calendar access for Outsyde in Settings to add this booking.");
          return;
        }
      }
      await Calendar.createEventInCalendarAsync({
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: e.notes,
        ...(e.location ? { location: e.location } : {}),
        ...(e.url ? { url: e.url } : {}),
      });
    } catch {
      setCalendarNote("Couldn't open your calendar.");
    }
  };

  const renderBookedScreen = () => {
    if (!selectedService) return null;
    const isRequest = bookingPending;
    const points = pendingPointsLine(paymentData?.pendingPoints, isRequest);
    const endTime = validatedEndTime || selectedSlot?.endTime;
    const whenLine =
      selectedDate && selectedSlot
        ? `${selectedDateDisplay} · ${formatTime(selectedSlot.startTime)}${endTime ? ` to ${formatTime(endTime)}` : ""}`
        : selectedDateDisplay;
    const showCalendar = canAddToCalendar(isRequest, bookedEvent?.event ?? null);
    const outline = [styles.secondaryButton, { borderColor: accent }];
    return (
      <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: Spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", marginTop: Spacing.lg }}>
          <View style={[styles.bookedMark, { backgroundColor: isRequest ? accentSoft : accent }]}>
            <Feather name={isRequest ? "clock" : "check"} size={30} color={isRequest ? accent : onAccent} />
          </View>
          <ThemedText style={[styles.successTitle, { color: theme.brandCream }]}>
            {isRequest ? "Request sent" : "You're booked"}
          </ThemedText>
        </View>

        <View style={[styles.reviewSection, { backgroundColor: theme.brandBgElevated, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: theme.brandSurfaceBorder }]}>
          <ThemedText style={[styles.reviewValue, { color: theme.brandCream, fontWeight: "600" }]}>{selectedService.name}</ThemedText>
          <ThemedText style={{ color: theme.brandTextDim, marginTop: 2 }}>{whenLine}</ThemedText>
          {bookedEvent?.place ? (
            <ThemedText style={{ color: theme.brandTextDim, marginTop: 2 }}>{bookedEvent.place}</ThemedText>
          ) : selectedService.serviceLocationType === "virtual" ? (
            <ThemedText style={{ color: theme.brandTextDim, marginTop: 2 }}>Online, link in your booking</ThemedText>
          ) : null}
          {renderConfirmationDetails()}
          {points ? (
            <View style={[styles.amountRow, { marginTop: Spacing.sm }]}>
              <ThemedText style={{ color: theme.brandGold, fontWeight: "700" }}>{points.label}</ThemedText>
              <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs }}>{points.when}</ThemedText>
            </View>
          ) : null}
        </View>

        {showCalendar ? (
          <Pressable onPress={addBookingToCalendar} style={outline} accessibilityRole="button" accessibilityLabel="Add to calendar">
            <Feather name="calendar" size={16} color={accent} />
            <ThemedText style={{ color: accent, fontWeight: "600", marginLeft: Spacing.sm }}>Add to calendar</ThemedText>
          </Pressable>
        ) : null}
        {calendarNote ? (
          <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs, textAlign: "center", marginTop: Spacing.xs }}>{calendarNote}</ThemedText>
        ) : null}
        {onMessage ? (
          <Pressable onPress={onMessage} style={outline} accessibilityRole="button" accessibilityLabel={`Message ${providerName}`}>
            <Feather name="message-circle" size={16} color={accent} />
            <ThemedText style={{ color: accent, fontWeight: "600", marginLeft: Spacing.sm }} numberOfLines={1}>
              {`Message ${providerName}`}
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() =>
            onDone ? onDone() : navigation.dispatch(CommonActions.navigate({ name: "Sessions" }))
          }
          accessibilityRole="button"
          style={[styles.primaryButton, { backgroundColor: accent, marginTop: Spacing.md }]}
        >
          <ThemedText style={[styles.primaryButtonText, { color: onAccent }]}>Done</ThemedText>
        </Pressable>
      </ScrollView>
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
    const chargedNow = paymentData?.amountChargedNowCents;
    if (typeof chargedNow === "number") {
      // Backend #314: what the card was charged now, after any points code.
      nowCents = chargedNow;
    } else if (typeof piGross === "number" && piGross !== nowCents) {
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
        {(paidSnapshot.rewardsCents ?? 0) > 0 && (
          <View style={styles.amountRow}>
            <ThemedText style={{ color: theme.brandTextDim }}>Outsyde rewards</ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.brandTextDim }]}>
              {`${formatPrice(paidSnapshot.rewardsCents as number)} off`}
            </ThemedText>
          </View>
        )}
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
        {(paidSnapshot.addons ?? []).length > 0 && (
          <ThemedText style={{ color: theme.brandTextDim, marginTop: Spacing.xs, fontSize: FontSizes.sm }}>
            {(paidSnapshot.addons ?? []).map((a) => a.name).join(", ")}
          </ThemedText>
        )}
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
        {(hold.addons ?? []).length > 0 ? (
          <>
            {typeof hold.servicePriceCents === "number" &&
              renderAmountRow("Service", hold.servicePriceCents)}
            {(hold.addons ?? []).map((addon) =>
              renderAmountRow(`+ ${addon.name}`, addon.priceCents)
            )}
            {typeof hold.serviceTotalCents === "number" &&
              renderAmountRow("Subtotal", hold.serviceTotalCents)}
          </>
        ) : (
          typeof hold.serviceTotalCents === "number" &&
            renderAmountRow("Service total", hold.serviceTotalCents)
        )}
        {!hasDeposit &&
          typeof feeCents === "number" &&
          renderAmountRow("Service fee", feeCents)}
        {renderAmountRow("Due now", hold.dueNowCents, !pointsCode)}
        {pointsCode && (
          <>
            <View style={styles.amountRow}>
              <ThemedText style={{ color: theme.brandTextDim }}>Outsyde rewards</ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.brandTextDim }]}>
                {`${formatPrice(pointsCode.discountCents)} off`}
              </ThemedText>
            </View>
            {renderAmountRow("Pay now", hold.dueNowCents - pointsCode.discountCents, true)}
          </>
        )}
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


  // ─── Choose a time (booking redesign step 2, 2026-11-05) ──────────────────
  const lastBookableMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return monthOf(toISODate(d));
  }, []);

  const shortDay = (iso: string) =>
    fromISODate(iso).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const longDay = (iso: string) =>
    fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const renderTimeButtons = (label: string, list: AvailabilitySlot[]) => {
    if (list.length === 0) return null;
    return (
      <View style={{ marginBottom: Spacing.sm }}>
        <ThemedText style={[styles.slotGroupLabel, { color: theme.brandTextDim }]}>{label}</ThemedText>
        <View style={styles.timeGrid}>
          {list.map((slot) => {
            const isSel = selectedSlot?.id === slot.id;
            return (
              <Pressable
                key={slot.id}
                onPress={() => handleSlotSelect(slot)}
                disabled={validating}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${formatTime(slot.startTime)}${isSel ? ", selected" : ""}`}
                style={[
                  styles.timeButton,
                  {
                    backgroundColor: isSel ? accent : theme.brandBgElevated,
                    borderColor: isSel ? accent : theme.brandSurfaceBorder,
                  },
                ]}
              >
                <ThemedText style={{ color: isSel ? onAccent : theme.brandCream, fontWeight: "700" }}>
                  {formatTime(slot.startTime)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderChooseTime = () => {
    if (!selectedService) return null;
    const days = weekWindow(weekStart);
    const canGoEarlier = weekStart > todayISO;
    const canGoLater = monthOf(addDays(weekStart, days.length)) <= lastBookableMonth;
    const firstMonth = monthOf(days[0]);
    const lastMonth = monthOf(days[days.length - 1]);
    const monthShort = (ym: string) =>
      fromISODate(`${ym}-01`).toLocaleDateString("en-US", { month: "short" });
    const weekLabel =
      firstMonth === lastMonth
        ? `${monthShort(firstMonth)} ${firstMonth.slice(0, 4)}`
        : `${monthShort(firstMonth)} to ${monthShort(lastMonth)}`;
    const visible = visibleSlots(slots);
    const { morning, afternoon, evening } = groupByPeriod(visible);
    const showExtras = showsAddonsStep(selectedService);
    const hasAddons = (selectedService.addons?.length ?? 0) > 0;
    const dayLoading = days.some((d) => dayStatus(d, todayISO, calendarFor(monthOf(d))) === "unknown");
    const weekHasOpening = days.some((d) =>
      isBookableStatus(dayStatus(d, todayISO, calendarFor(monthOf(d)))),
    );

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.serviceCard, { backgroundColor: theme.brandBgElevated, borderColor: theme.brandSurfaceBorder, marginBottom: Spacing.lg }]}>
          {showServiceImages ? (
            <ServiceThumb
              service={selectedService}
              showImage={hasServiceImage(selectedService)}
              size={56}
              radius={12}
              onFail={markServiceImageFailed}
            />
          ) : null}
          <View style={styles.serviceInfo}>
            <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs }}>{providerName}</ThemedText>
            <ThemedText style={[styles.serviceName, { color: theme.brandCream }]}>{selectedService.name}</ThemedText>
            <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm }}>
              {[formatDuration(selectedService.durationMinutes), priceLine(selectedService.priceCents, selectedService.depositAmountCents)]
                .filter(Boolean)
                .join(" · ")}
            </ThemedText>
          </View>
          <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change service" style={{ paddingVertical: Spacing.sm, paddingLeft: Spacing.sm }}>
            <ThemedText style={{ color: accent, fontWeight: "700" }}>Change</ThemedText>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <ThemedText style={[styles.sectionTitle, { color: theme.brandCream }]}>Pick a Day</ThemedText>
          <View style={styles.weekNav}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setWeekStart(previousWeekStart(weekStart, todayISO, days.length)); }}
              disabled={!canGoEarlier}
              accessibilityRole="button"
              accessibilityLabel="Earlier days"
              style={[styles.navButton, { backgroundColor: theme.brandBgElevated, borderColor: theme.brandSurfaceBorder, opacity: canGoEarlier ? 1 : 0.4 }]}
            >
              <Feather name="chevron-left" size={18} color={theme.brandCream} />
            </Pressable>
            <Pressable
              onPress={openMonthSheet}
              accessibilityRole="button"
              accessibilityLabel="Open the full month calendar"
              style={[styles.navButton, styles.monthButton, { backgroundColor: theme.brandBgElevated, borderColor: theme.brandSurfaceBorder }]}
            >
              <Feather name="calendar" size={16} color={accent} />
              <ThemedText style={{ color: theme.brandCream, fontWeight: "700", fontSize: FontSizes.sm, marginLeft: 6 }}>{weekLabel}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setWeekStart(addDays(weekStart, days.length)); }}
              disabled={!canGoLater}
              accessibilityRole="button"
              accessibilityLabel="Later days"
              style={[styles.navButton, { backgroundColor: theme.brandBgElevated, borderColor: theme.brandSurfaceBorder, opacity: canGoLater ? 1 : 0.4 }]}
            >
              <Feather name="chevron-right" size={18} color={theme.brandCream} />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekRow}>
          {days.map((iso) => {
            const status = dayStatus(iso, todayISO, calendarFor(monthOf(iso)));
            const open = isBookableStatus(status);
            const isSel = selectedDate === iso;
            const isToday = iso === todayISO;
            return (
              <Pressable
                key={iso}
                onPress={() => handleDateSelect(iso, status)}
                disabled={!open}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: !open }}
                accessibilityLabel={`${longDay(iso)}${open ? "" : ", no openings"}${isSel ? ", selected" : ""}`}
                style={[
                  styles.weekDay,
                  {
                    backgroundColor: isSel ? accent : open ? theme.brandBgElevated : "transparent",
                    borderColor: isSel ? accent : isToday ? accent : theme.brandSurfaceBorder,
                    opacity: status === "unknown" ? 0.5 : 1,
                  },
                ]}
              >
                <ThemedText style={{ fontSize: FontSizes.xs, fontWeight: "700", color: isSel ? onAccent : open ? theme.brandTextDim : theme.brandTextDim }}>
                  {shortDay(iso)}
                </ThemedText>
                <ThemedText
                  style={{
                    fontSize: 19,
                    lineHeight: 24,
                    fontWeight: "800",
                    color: isSel ? onAccent : open ? theme.brandCream : theme.brandTextDim,
                    textDecorationLine: open || status === "unknown" ? "none" : "line-through",
                  }}
                >
                  {fromISODate(iso).getDate()}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {!dayLoading && !weekHasOpening ? (
          <ThemedText style={[styles.slotEmptyText, { color: theme.brandTextDim }]}>
            No openings these days. Try later days or the calendar.
          </ThemedText>
        ) : null}

        <ThemedText style={[styles.sectionTitle, { color: theme.brandCream, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
          Pick a Time
        </ThemedText>
        {!selectedDate ? (
          <ThemedText style={[styles.slotEmptyText, { color: theme.brandTextDim }]}>
            {dayLoading ? "Loading days..." : "Pick a day to see times."}
          </ThemedText>
        ) : loadingSlots ? (
          <ActivityIndicator size="small" color={accent} style={{ marginVertical: Spacing.lg }} />
        ) : visible.length === 0 ? (
          <ThemedText style={[styles.slotEmptyText, { color: theme.brandTextDim }]}>
            No times left on this day. Please pick another day.
          </ThemedText>
        ) : (
          <>
            {renderTimeButtons("Morning", morning)}
            {renderTimeButtons("Afternoon", afternoon)}
            {renderTimeButtons("Evening", evening)}
          </>
        )}
        {validating ? (
          <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm }}>Checking this time...</ThemedText>
        ) : null}

        {showExtras ? (
          <View style={{ marginTop: Spacing.lg }}>
            {hasAddons ? (
              <>
                <ThemedText style={[styles.sectionTitle, { color: theme.brandCream, marginBottom: Spacing.sm }]}>Add-ons</ThemedText>
                {(selectedService.addons ?? []).map((addon) => {
                  const isSelected = selectedAddonIds.includes(addon.id);
                  return (
                    <Pressable
                      key={addon.id}
                      onPress={() => {
                        setAddonFitError(null);
                        setSelectedAddonIds((prev) =>
                          isSelected ? prev.filter((id) => id !== addon.id) : [...prev, addon.id]
                        );
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      style={[
                        styles.slotListRow,
                        {
                          backgroundColor: isSelected ? accentSoft : theme.brandBgElevated,
                          borderColor: isSelected ? accent : theme.brandSurfaceBorder,
                          marginBottom: Spacing.xs,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: "600", color: theme.brandCream }}>{addon.name}</ThemedText>
                        {addon.description ? (
                          <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm }}>{addon.description}</ThemedText>
                        ) : null}
                        <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm }}>
                          {formatPrice(addon.priceCents)}{addon.durationMinutes > 0 ? ` · +${formatDuration(addon.durationMinutes)}` : ""}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.slotCheckCircle,
                          { backgroundColor: isSelected ? accent : "transparent", borderWidth: 2, borderColor: isSelected ? accent : theme.brandSurfaceBorder },
                        ]}
                      >
                        {isSelected && <Feather name="check" size={14} color={onAccent} />}
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            <ThemedText style={{ color: theme.brandCream, fontWeight: "600", marginTop: Spacing.md, marginBottom: Spacing.xs }}>
              Note for {providerName || "your provider"}{" "}
              <ThemedText style={{ fontWeight: "400", color: theme.brandTextDim }}>(optional)</ThemedText>
            </ThemedText>
            <TextInput
              value={bookingCustomerDetails}
              onChangeText={(t) => setBookingCustomerDetails(t.slice(0, 1000))}
              placeholder="Allergy notes, prep instructions, preferences…"
              placeholderTextColor={theme.brandTextDim}
              multiline
              numberOfLines={3}
              maxLength={1000}
              style={{
                backgroundColor: theme.brandBgElevated,
                borderWidth: 1,
                borderColor: theme.brandSurfaceBorder,
                borderRadius: BorderRadius.md,
                color: theme.brandCream,
                padding: Spacing.sm,
                minHeight: 80,
                textAlignVertical: "top",
                marginBottom: Spacing.xs,
              }}
            />
            <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs, textAlign: "right" }}>
              {bookingCustomerDetails.length}/1000
            </ThemedText>
          </View>
        ) : null}

        {addonFitError ? (
          <View style={{ backgroundColor: theme.brandError + "22", borderRadius: BorderRadius.sm, padding: Spacing.sm, marginTop: Spacing.md }}>
            <ThemedText style={{ color: theme.brandError }}>{addonFitError}</ThemedText>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const renderChooseTimeBar = () => {
    if (!selectedService) return null;
    const addonsCents = selectedAddonIds.reduce((sum, id) => {
      const a = selectedService.addons?.find((x) => x.id === id);
      return sum + (a?.priceCents ?? 0);
    }, 0);
    const ready = !!selectedSlot && !validating && !checkingAddonFit;
    const endTime = validatedEndTime || selectedSlot?.endTime;
    const whenLine =
      selectedDate && selectedSlot
        ? `${longDay(selectedDate)} · ${formatTime(selectedSlot.startTime)}${endTime ? ` to ${formatTime(endTime)}` : ""}`
        : selectedDate
          ? `${longDay(selectedDate)} · pick a time`
          : "Pick a day and time";
    return (
      <View style={[styles.bottomBar, { backgroundColor: theme.brandBgElevated, borderTopColor: theme.brandSurfaceBorder }]}>
        <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm, textAlign: "center", marginBottom: Spacing.sm }}>
          {whenLine}
        </ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs }}>Total</ThemedText>
            <ThemedText style={{ color: theme.brandCream, fontWeight: "800", fontSize: FontSizes.lg }}>
              {priceLine(selectedService.priceCents + addonsCents, selectedService.depositAmountCents)}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => ready && handleAddonsContinue()}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            style={[styles.primaryButton, { flex: 1.2, marginTop: 0, backgroundColor: ready ? accent : theme.brandSurfaceBorder }]}
          >
            {checkingAddonFit ? (
              <ActivityIndicator color={onAccent} />
            ) : (
              <ThemedText style={[styles.primaryButtonText, { color: ready ? onAccent : theme.brandTextDim }]}>Continue</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderMonthSheet = () => (
    <Modal
      visible={monthSheetOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setMonthSheetOpen(false)}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={() => setMonthSheetOpen(false)} accessibilityLabel="Close calendar" />
        <View style={[styles.monthSheet, { backgroundColor: theme.brandBgElevated, borderColor: theme.brandSurfaceBorder }]}>
          <View style={[styles.sheetGrabber, { backgroundColor: theme.brandSurfaceBorder }]} />
          <View style={styles.monthNav}>
            <Pressable onPress={handlePrevMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous month">
              <Feather name="chevron-left" size={24} color={theme.brandCream} />
            </Pressable>
            <ThemedText style={[styles.monthTitle, { color: theme.brandCream }]}>{monthDisplay}</ThemedText>
            <Pressable onPress={handleNextMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next month">
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
          {loadingCalendar && calendarFor(currentMonth) === undefined ? (
            <ActivityIndicator size="large" color={accent} style={styles.loader} />
          ) : (
            <View style={styles.calendarGrid}>
              {calendarGrid.map((cell, index) => {
                if (cell.date === null) {
                  return <View key={index} pointerEvents="none" style={{ width: DAY_SIZE, height: DAY_SIZE }} />;
                }
                const open = cell.status === "available" || cell.status === "partial";
                const isSel = selectedDate === cell.date;
                return (
                  <Pressable
                    key={index}
                    onPress={() => cell.date && cell.status && handleMonthDayPick(cell.date, cell.status)}
                    disabled={!open}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel, disabled: !open }}
                    accessibilityLabel={`${cell.date ? longDay(cell.date) : ""}${open ? "" : ", no openings"}`}
                    style={{
                      width: DAY_SIZE,
                      height: DAY_SIZE,
                      borderRadius: DAY_SIZE / 2,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSel ? accent : "transparent",
                      borderWidth: cell.isToday && !isSel ? 1.5 : 0,
                      borderColor: accent,
                    }}
                  >
                    <ThemedText
                      style={{
                        color: isSel ? onAccent : open ? theme.brandCream : theme.brandTextDim,
                        fontWeight: open ? "700" : "400",
                        fontSize: FontSizes.sm,
                        textDecorationLine: open ? "none" : "line-through",
                      }}
                    >
                      {cell.dayNum}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

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
      {accentColor ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: accent + "28" }]} />
      ) : null}

      {(step === 2 || step === 4) && (
        <View style={styles.stepLabelRow}>
          {step === 4 && !paying && !paymentIntentExists ? (
            <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to times" style={styles.backButton}>
              <Feather name="arrow-left" size={20} color={accent} />
              <ThemedText style={{ color: accent, marginLeft: Spacing.xs }}>Back</ThemedText>
            </Pressable>
          ) : (
            <View />
          )}
          <ThemedText style={[styles.stepLabelText, { color: theme.brandTextDim }]}>
            {step === 2 ? "STEP 1 OF 2" : "STEP 2 OF 2"}
          </ThemedText>
        </View>
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
                {showServiceImages ? (
                  <ServiceThumb
                    service={service}
                    showImage={hasServiceImage(service)}
                    size={72}
                    radius={10}
                    onFail={markServiceImageFailed}
                  />
                ) : null}
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

      {step === 2 && renderChooseTime()}
      {step === 2 && renderChooseTimeBar()}
      {renderMonthSheet()}

      {!showAddonsStep && step === 4 && selectedSlot && selectedService && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={[styles.stepTitle, { color: theme.brandCream }]}>
            Review and pay
          </ThemedText>

          {/* Booking summary */}
          <View style={[styles.reviewSection, { backgroundColor: accentSoft, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md }]}>
            <ServiceSummaryRow service={selectedService} showImage={hasServiceImage(selectedService)} onFail={markServiceImageFailed}>
              <ThemedText style={[styles.reviewLabel, { color: theme.brandTextDim }]}>Service</ThemedText>
              <ThemedText style={[styles.reviewValue, { color: theme.brandCream, fontWeight: "600" }]}>{selectedService.name}</ThemedText>
              <ThemedText style={{ color: theme.brandTextDim, marginTop: 2 }}>
                {selectedDateDisplay} at {formatTime(selectedSlot.startTime)} · {formatDuration(selectedService.durationMinutes)}
              </ThemedText>
            </ServiceSummaryRow>
            {bookingCustomerDetails.trim() ? (
              <View style={{ marginTop: Spacing.sm }}>
                <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm, fontStyle: "italic" }}>
                  {bookingCustomerDetails.trim()}
                </ThemedText>
              </View>
            ) : null}
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

          {/* Use my points (Outsyde loyalty rewards) */}
          {holdStatus === "ready" && typeof hold?.dueNowCents === "number" && (
            <UsePointsPicker
              kind="booking"
              amountCents={hold.dueNowCents}
              selected={pointsCode}
              onChange={setPointsCode}
              disabled={paying}
              accentColor={accent}
              refreshKey={pointsRefreshKey}
              refusedCodeIds={refusedCodeIds}
            />
          )}

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
              </>
            )}
          </View>

          {/* ── One agreement (step 3): policy, vendor terms, Outsyde Terms and the place ── */}
          {(() => {
            const hasCancellationPolicy = !!selectedService.fullRefundWindow;
            const hasVendorTerms = !!(providerVendorTerms && providerVendorTerms.trim());
            const policyLoading = hasCancellationPolicy && !policyReady;
            const parts = agreementParts({
              hasPolicy: hasCancellationPolicy,
              hasVendorTerms,
              providerName,
              locationType: selectedService.serviceLocationType as ServiceLocationType,
              addressHidden: providerShowAddress === false,
            });
            const openLink = (target: "policy" | "vendorTerms" | "outsydeTerms") => {
              if (target === "policy") setShowCancellationModal(true);
              else if (target === "vendorTerms") setShowVendorTermsModal(true);
              else navigation.navigate("TermsOfService");
            };
            return (
              <View style={[styles.reviewSection, {
                backgroundColor: theme.brandBgElevated,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: theme.brandSurfaceBorder,
                marginTop: Spacing.sm,
                marginBottom: Spacing.lg,
              }]}>
                {hasCancellationPolicy && policyLoading ? (
                  renderPolicyPlaceholder(false)
                ) : (
                  <>
                    {hasCancellationPolicy ? (
                      <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs, marginBottom: Spacing.sm }}>
                        {shortCancellationSummary(selectedService, serviceHasDeposit)}
                      </ThemedText>
                    ) : null}
                    <Pressable
                      onPress={() => setAgreed(!agreed)}
                      style={styles.checkboxRow}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: agreed }}
                      accessibilityLabel={agreementText(parts)}
                    >
                      <View style={[styles.checkbox, {
                        borderColor: agreed ? accent : theme.brandTextDim,
                        backgroundColor: agreed ? accent : "transparent",
                      }]}>
                        {agreed && <Feather name="check" size={13} color={onAccent} />}
                      </View>
                      <ThemedText style={{ color: theme.brandCream, flex: 1 }}>
                        {parts.map((part, i) =>
                          part.kind === "link" ? (
                            <ThemedText
                              key={i}
                              onPress={() => openLink(part.target)}
                              style={{ color: accent, textDecorationLine: "underline" }}
                            >
                              {part.text}
                            </ThemedText>
                          ) : (
                            part.text
                          ),
                        )}
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })()}
        </ScrollView>
      )}
      {!showAddonsStep && step === 4 && selectedSlot && selectedService && renderPaySection()}

      {step === 5 && selectedService && renderBookedScreen()}

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

      {/* Vendor terms: full screen (no tall sheets, Legend 2026-11-05) */}
      <Modal
        visible={showVendorTermsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowVendorTermsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.brandBg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={[styles.termsHeader, { borderBottomColor: theme.brandSurfaceBorder }]}>
            <ThemedText style={{ color: theme.brandCream, fontWeight: "600", fontSize: FontSizes.md, flex: 1 }} numberOfLines={2}>
              {`${providerName}'s terms`}
            </ThemedText>
            <Pressable
              onPress={() => setShowVendorTermsModal(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close terms"
            >
              <ThemedText style={{ color: accent, fontWeight: "600" }}>Close</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.lg }} showsVerticalScrollIndicator>
            <ThemedText style={{ color: theme.brandCream, lineHeight: 22 }}>
              {providerVendorTerms || ""}
            </ThemedText>
          </ScrollView>
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

      {/* Hold expired pop-up */}
      <Modal
        visible={showHoldExpiredModal}
        transparent
        animationType="fade"
        onRequestClose={handleHoldExpiredBack}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View
            accessibilityViewIsModal
            style={[styles.modalContent, { backgroundColor: theme.brandBgElevated }]}
          >
            <Pressable
              onPress={handleHoldExpiredClose}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Feather name="x" size={22} color={theme.brandTextDim} />
            </Pressable>
            <Feather name="clock" size={40} color={theme.brandGold} />
            <ThemedText
              type="body"
              accessibilityRole="header"
              style={[styles.modalTitle, { fontWeight: "600", color: theme.brandCream }]}
            >
              Your booking hold expired
            </ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.brandTextDim }]}>
              We held this time for 10 minutes, so it has been released. Please book again.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={handleHoldExpiredBack}
                style={[styles.modalButton, { backgroundColor: theme.brandPrimary }]}
                accessibilityRole="button"
              >
                <ThemedText style={{ color: theme.brandPrimaryText }}>
                  {providerName?.trim() ? `Back to ${providerName.trim()}` : "Back"}
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
    padding: Spacing.md,
  },
  // ── Choose a time (booking redesign step 2) ──
  stepLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
    marginBottom: Spacing.sm,
  },
  stepLabelText: {
    fontSize: FontSizes.xs,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "800",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthButton: {
    flexDirection: "row",
    paddingHorizontal: 10,
  },
  weekRow: {
    flexDirection: "row",
    gap: 6,
  },
  weekDay: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  timeButton: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2) / 3 - 0.5,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  termsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  bookedMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  bottomBar: {
    borderTopWidth: 1,
    marginHorizontal: -Spacing.md,
    marginBottom: -Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  monthSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  sheetGrabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: Spacing.sm,
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
  modalCloseButton: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
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

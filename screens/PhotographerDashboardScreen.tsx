import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  AppState,
  AppStateStatus,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { FullScreenSheet } from "@/components/FullScreenSheet";
import { parseBrandColorSpec, specToHex } from "@/constants/colorOptions";
import { useAuth } from "@/context/AuthContext";
import api, {
  PhotographerDashboardStats,
  PhotographerDashboardProfile,
  PhotographerBooking,
  PhotographerService,
  PhotographerHours,
  BlockedDate,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { displayRating } from "@/types/ratings";
import { DayHours, getDefaultHours, convertTo24Hour, convertTo12Hour } from "@/components/HoursEditor";
import BookingExtrasBlock from "@/components/BookingExtrasBlock";
import AutoAcceptToggle from "@/components/AutoAcceptToggle";
import RefundModal from "@/components/RefundModal";
import { fullRefundDollars, refundedDollars } from "@/utils/refundAmount";
import ProviderCalendar, { CalendarBooking, CalendarBlockedDate, DayAvailability } from "@/components/ProviderCalendar";
import { mapProviderBlockToBlockedDate } from "@/utils/availabilityUtils";
import { VideoView } from "expo-video";
import { useVideoPlayerRecreate } from "@/hooks/useVideoPlayerRecreate";
import {
  bookingStatusLabel,
  filterVisibleBookings,
  isActiveProviderStatus,
  isCanceledStatus,
  isExpiredStatus,
  isPendingRequestStatus,
} from "@/utils/bookingStatus";
import { syncMyTimeZoneOnce } from "@/utils/timeZoneSync";
import { dashboardCounts } from "@/utils/businessQuotesLogic";
import OutsydeLoader from "@/components/OutsydeLoader";

// Shared dark palette — matches BusinessDashboardScreen & StaffDashboardScreen exactly
const DASHBOARD_COLORS = {
  background: "#080C08",
  surface: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  greenBright: "#2D7A2D",
  greenAccent: "#3A9E3A",
  gold: "#C9933A",
  goldLight: "#E8B86D",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
};


// Editing lives on PhotographerManageBusinessScreen (Manage business, 2026-11-06).
// The dashboard keeps the bookings sheet only.
type ModalType = "bookings" | null;

export default function PhotographerDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, logout, user, isLoading: authLoading } = useAuth();
  // Latest getToken without making it an effect dependency (it is recreated every render).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const route = useRoute<RouteProp<RootStackParamList, "PhotographerDashboard">>();
  useEffect(() => {
    if (route.params?.openModal === "profile") {
      // Older links still ask for the profile sheet: it now lives in Manage business.
      navigation.setParams({ openModal: undefined });
      navigation.navigate("PhotographerManageBusiness", { section: "profile" });
    }
  }, [route.params?.openModal]);

  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const hasFetchedRef = useRef(false);

  const [stats, setStats] = useState<PhotographerDashboardStats>({
    earnings: 0,
    upcomingBookings: 0,
    totalBookings: 0,
    unreadMessages: 0,
    rating: 0,
    reviewCount: 0,
    profileViews: 0,
    completedShoots: 0,
  });
  const [profile, setProfile] = useState<PhotographerDashboardProfile | null>(null);
  const [bookings, setBookings] = useState<PhotographerBooking[]>([]);
  const [services, setServices] = useState<PhotographerService[]>([]);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  
  // Auto-accept and refund state
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [autoAcceptLoading, setAutoAcceptLoading] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedBookingForRefund, setSelectedBookingForRefund] = useState<PhotographerBooking | null>(null);

  const VideoPreview = ({ uri }: { uri: string }) => {
    const player = useVideoPlayerRecreate(uri, (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    });

    return (
      <View style={{ flex: 1, position: "relative" }}>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="cover"
          nativeControls={false}
        />
        <View 
          style={{ 
            position: "absolute", 
            top: 4, 
            right: 4, 
            backgroundColor: "rgba(0,0,0,0.6)", 
            paddingHorizontal: 6, 
            paddingVertical: 2, 
            borderRadius: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Feather name="video" size={10} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10 }}>Video</Text>
        </View>
      </View>
    );
  };

  const fetchDashboard = useCallback(async (opts?: { quiet?: boolean }) => {
    const token = await getToken();
    if (!token) {
      setAuthError("Please sign in to access your dashboard");
      setLoading(false);
      return;
    }

    try {
      if (!opts?.quiet) setLoading(true);
      setAuthError(null);
      setNeedsProfileSetup(false);
      const photographer = await api.getPhotographerMe(token) as any;
      console.log("[Dashboard] Raw photographer from API:", JSON.stringify(photographer, null, 2));
      
      setStats((prev) => ({
        ...prev,
        rating: photographer.rating || 0,
        reviewCount: photographer.reviewCount || 0,
        completedShoots: photographer.completedShoots || 0,
      }));
      
      // Parse brandColors — new shape { type, id }
      const parsedBrandColors = parseBrandColorSpec(photographer.brandColors);
      // Wheel starts on the stored color: a wheel color, a preset's own shade, or gold.
      const originalThemeId = specToHex(parsedBrandColors);
      
      setProfile({
        id: photographer.id,
        name: photographer.displayName || "",
        avatar: photographer.logoImage,
        hourlyRate: photographer.hourlyRate ? photographer.hourlyRate / 100 : 0,
        bio: photographer.bio,
        city: photographer.city,
        state: photographer.state,
        portfolioUrl: photographer.portfolioUrl,
        specialties: photographer.specialties || [],
        stripeConnected: photographer.stripeOnboardingComplete || false,
        profileTheme: originalThemeId,
        autoAcceptBookings: photographer.autoAcceptBookings ?? false,
      });
      setAutoAcceptBookings(photographer.autoAcceptBookings ?? false);

      try {
        const { bookings: bookingsData } = await api.getPhotographerMeBookings(token);
        const mappedBookings = bookingsData.map((b: any) => {
          // The /api/photographers/me/bookings endpoint returns booking RECORDS
          // with different field names than the generic PhotographerBooking type.
          // Field mapping (backend field → what we need):
          //   recordId        → id
          //   firstName/lastName → clientName (must be concatenated)
          //   bookingDateTime → split into date + time (format: "YYYY-MM-DD HH:mm")
          //   totalPaid       → amount           (integer CENTS — divide by 100)
          //   vendorNet       → vendorNetAmount  (integer CENTS — divide by 100)
          //   platformFee     → bookingFeeAmount (integer CENTS — divide by 100)
          //   shootType/serviceName → sessionType
          //
          // MONEY UNITS: these three arrive as integer cents. The serializer at
          // server/storage.ts:1636-1638 passes shoot_bookings.total_price /
          // platform_fee / vendor_net straight through undivided, unlike the
          // business endpoint at server/storage.ts:1800-1803 which divides by
          // 100 server-side. So the two endpoints emit different units and only
          // this one needs client-side conversion.
          // Verified against shoot_bookings on 2026-08-08:
          //   total_price 205000 = $2,050.00, platform_fee 4100 = $41.00 (2%),
          //   vendor_net 200900 = $2,009.00.

          // Support both the booking-record shape AND the legacy generic shape
          const id = b.recordId || b.id || "";
          const firstName = b.firstName || "";
          const lastName = b.lastName || "";
          const clientName =
            b.clientName ||
            b.customerName ||
            (firstName || lastName ? `${firstName} ${lastName}`.trim() : "Client");

          // bookingDateTime is "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
          const bookingDateTime: string = b.bookingDateTime || "";
          const datePart = b.date || bookingDateTime.split(" ")[0] || "";
          const timePart = b.startTime || b.time || bookingDateTime.split(" ")[1] || "";

          // Decide on shape, not on value: the booking-record fields are cents
          // and the legacy generic fields are already dollars.
          const isRecordShape =
            typeof b.totalPaid === "number" ||
            typeof b.vendorNet === "number" ||
            typeof b.platformFee === "number";

          const centsToDollars = (v: unknown): number | undefined =>
            typeof v === "number" ? v / 100 : undefined;

          const amount = isRecordShape
            ? centsToDollars(b.totalPaid) ?? 0
            : typeof b.totalAmount === "number"
            ? b.totalAmount / 100
            : b.amount || 0;

          const vendorNetAmount = isRecordShape
            ? centsToDollars(b.vendorNet)
            : typeof b.vendorNetAmount === "number"
            ? b.vendorNetAmount
            : undefined;

          const bookingFeeAmount = isRecordShape
            ? centsToDollars(b.platformFee)
            : typeof b.bookingFeeAmount === "number"
            ? b.bookingFeeAmount
            : undefined;

          const sessionType =
            b.serviceName || b.sessionType || b.shootType || "Session";

          return {
            id,
            clientName,
            clientAvatar: b.customerAvatar || b.clientAvatar,
            date: datePart,
            time: timePart,
            sessionType,
            // Use the real value. A missing status must never turn into a pending request.
            status: (typeof b.status === "string" ? b.status : "") as PhotographerBooking["status"],
            amount,
            // The record shape carries no subtotal field, so mirror what the
            // business serializer does (server/storage.ts:1799-1800) and set it
            // equal to the gross amount. Without this the modal's "Subtotal:"
            // line never renders and the fee breakdown reads incomplete.
            subtotalAmount: isRecordShape ? amount : b.subtotalAmount ?? undefined,
            bookingFeeAmount,
            vendorNetAmount,
            influencerCommissionAmount: b.influencerCommissionAmount ?? undefined,
            isInfluencerAttributed: b.isInfluencerAttributed ?? false,
            // Add-ons, customer notes and in-person remainder (cents); absent
            // on older backends.
            addons: Array.isArray(b.addons) ? b.addons : null,
            customerDetails: typeof b.customerDetails === "string" ? b.customerDetails : null,
            inPersonDueCents: typeof b.inPersonDueCents === "number" ? b.inPersonDueCents : null,
            // Deposit charged online (cents): a full refund returns this, not the price.
            depositAmountCents: typeof b.depositAmountCents === "number" ? b.depositAmountCents : null,
          };
        });
        // Unpaid checkouts (draft, pending_payment) are never shown or counted.
        const visibleBookings: PhotographerBooking[] = filterVisibleBookings(mappedBookings);
        setBookings(visibleBookings);

        // Derive all stats from real booking data — never rely on totalEarnings from profile
        const confirmedOrCompleted = visibleBookings.filter(
          (b) => b.status === "confirmed" || b.status === "completed",
        );
        const totalEarnings = confirmedOrCompleted.reduce(
          (sum, b) => sum + (b.vendorNetAmount ?? b.amount ?? 0),
          0,
        );
        // totalBookings: every real booking that was not cancelled, declined
        // or expired, regardless of date. This is what the "Bookings" stat
        // tile shows. draft and pending_payment were already dropped above.
        const totalBookingCount = visibleBookings.filter(
          (b) =>
            !isCanceledStatus(b.status) &&
            b.status !== "declined" &&
            !isExpiredStatus(b.status),
        ).length;

        // upcomingBookings: dated today or later AND still going to happen:
        // confirmed, or a real request (pending_provider, legacy pending). Excludes completed (a
        // finished shoot is not upcoming even if it is dated today) and
        // cancelled / declined / expired / no_show. A booking with a missing or
        // malformed date does not count.
        //
        // Dates are compared as YYYY-MM-DD strings against a locally computed
        // today. Do not switch this to `new Date(b.date)` — a bare date string
        // parses as UTC midnight, which shifts the boundary a day for every
        // user west of Greenwich.
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const upcomingBookingCount = visibleBookings.filter(
          (b) =>
            typeof b.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
            b.date >= todayStr &&
            isActiveProviderStatus(b.status),
        ).length;

        setStats((prev) => ({
          ...prev,
          earnings: totalEarnings,
          totalBookings: totalBookingCount,
          upcomingBookings: upcomingBookingCount,
          completedShoots: confirmedOrCompleted.length,
          rating: photographer.rating || prev.rating,
          reviewCount: photographer.reviewCount || prev.reviewCount,
        }));
      } catch {
        setBookings([]);
      }

      try {
        const { services: servicesData } = await api.getPhotographerMeServices(token);
        setServices((servicesData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || "",
          duration: s.estimatedDurationMinutes || s.durationMinutes || 60,
          // Hourly services show the rate (hourlyRateCents); legacy hourly rows that
          // only have priceCents, and package services, show priceCents.
          price:
            s.pricingModel === "hourly" && typeof s.hourlyRateCents === "number"
              ? s.hourlyRateCents / 100
              : s.priceCents
                ? s.priceCents / 100
                : 0,
          isActive: s.status === "active",
          status: s.status || "draft",
          pricingModel: s.pricingModel || "package",
          category: s.category || "Other",
          depositAmountCents: s.depositAmountCents ?? null,
          imageUrl: s.imageUrl ?? null,
        })));

      } catch {
        setServices([]);
      }

      try {
        const availabilityData = await api.getPhotographerMeAvailability(token);
        if (availabilityData.hoursOfOperation) {
          const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const parsedHours = dayNames.map((dayName, index) => {
            const dayData = availabilityData.hoursOfOperation[dayName] as { open: boolean; start?: string; end?: string } | undefined;
            if (dayData && dayData.open === true && dayData.start && dayData.end) {
              return {
                dayOfWeek: index,
                isAvailable: true,
                startTime: convertTo12Hour(dayData.start),
                endTime: convertTo12Hour(dayData.end),
              };
            }
            return {
              dayOfWeek: index,
              isAvailable: false,
              startTime: "9:00 AM",
              endTime: "5:00 PM",
            };
          });
          setHours(parsedHours);
        }
      } catch {
        // Keep default hours
      }

      // Fetch blocked dates from new blocks endpoint
      try {
        const blocks = await api.getBlocks(token, "photographer");
        setBlockedDates(
          blocks
            .map(mapProviderBlockToBlockedDate)
            .filter((b): b is NonNullable<typeof b> => b !== null)
        );
      } catch (err) {
        console.error("[Dashboard] Failed to load blocked dates:", err);
        setBlockedDates([]);
      }

    } catch (error: any) {
      console.error("Failed to fetch photographer dashboard:", error);
      
      const status = error?.status || error?.response?.status;
      const message = error?.message || "";
      const is401 = status === 401 || message.includes("401") || message.toLowerCase().includes("unauthorized");
      const is404 = status === 404 || message.includes("404") || message.toLowerCase().includes("not found");
      
      if (is401) {
        setAuthError("Your session has expired. Please sign in again.");
        await logout();
        return;
      }
      
      if (is404) {
        // Profile doesn't exist yet in backend - use data from auth context
        // Don't block dashboard access, just show setup prompts
        console.log("[Dashboard] No photographer profile found (404), using user data from context");
        const defaultProfile = {
          id: "",
          name: user?.displayName || user?.firstName || "Photographer",
          hourlyRate: user?.hourlyRate ? user.hourlyRate / 100 : 0,
          bio: user?.bio,
          city: user?.city,
          state: user?.state,
          portfolioUrl: user?.portfolioUrl,
          specialties: user?.specialties || [],
          stripeConnected: false,
        };
        setProfile(defaultProfile);
        // Don't set needsProfileSetup - allow dashboard access
      } else if (status === 403 || message.includes("403") || message.toLowerCase().includes("forbidden")) {
        setAuthError("You don't have permission to access this dashboard.");
      } else if (opts?.quiet) {
        // A failed quiet reload (coming back from Manage business) keeps what is on screen.
        console.log("[Dashboard] Quiet reload failed, keeping the loaded data");
      } else {
        // Other errors - still allow dashboard access with default data
        console.log("[Dashboard] Error fetching profile, using default data");
        setProfile({
          id: "",
          name: user?.displayName || user?.firstName || "Photographer",
          hourlyRate: user?.hourlyRate ? user.hourlyRate / 100 : 0,
          specialties: user?.specialties || [],
          stripeConnected: false,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, logout, user]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setAuthError("Please sign in to access your dashboard");
      setLoading(false);
      return;
    }
    
    if (user.role !== "photographer") {
      setAuthError("This dashboard is only available for photographers");
      setLoading(false);
      return;
    }
    
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboard();
      // Once per launch: fill in the photographer time zone if it is still empty. Fire and forget.
      syncMyTimeZoneOnce("photographer", () => getTokenRef.current());
    }
  }, [authLoading, user?.id, user?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  // Editing moved to Manage business (2026-11-06), which saves on its own screen.
  // Coming back here reloads quietly so services, hours and the profile card are current.
  // The first visit is loaded by the effect above.
  const fetchDashboardRef = useRef(fetchDashboard);
  useEffect(() => {
    fetchDashboardRef.current = fetchDashboard;
  });
  const seenFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!seenFocusRef.current) {
        seenFocusRef.current = true;
        return;
      }
      if (hasFetchedRef.current) fetchDashboardRef.current({ quiet: true });
    }, []),
  );

  // Request forms F2b: the photographer's request count, read again on every visit (null until read).
  const [newRequests, setNewRequests] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const token = await getTokenRef.current();
          if (!token) return;
          const rows = await api.getPhotographerRequests(token);
          if (alive) setNewRequests(dashboardCounts(rows, null).newRequests);
        } catch {
          // The card still opens the list, which shows the error.
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const openManage = (section?: "services" | "profile" | "hours" | "blocked") =>
    navigation.navigate("PhotographerManageBusiness", section ? { section } : undefined);

  const [stripeError, setStripeError] = useState<string | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [loadingPayoutLink, setLoadingPayoutLink] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);
  
  const STRIPE_RETURN_URL = "outsyde://stripe-return";
  
  const refreshStripeStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    
    try {
      console.log("[Dashboard] Fetching fresh Stripe status...");
      const stripeStatus = await api.getPhotographerStripeStatus(token);
      console.log("[Dashboard] Stripe status response:", stripeStatus);
      
      const isConnected = stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled;
      
      setProfile(prev => prev ? { ...prev, stripeConnected: isConnected } : prev);
      
      // Only the screen in front says so (Manage business, on top of this one, checks too).
      if (isConnected && navigation.isFocused()) {
        Alert.alert("Success", "Your Stripe account is now connected! You can start accepting bookings.");
      }
    } catch (error) {
      console.error("[Dashboard] Failed to fetch Stripe status:", error);
    }
  }, [getToken, navigation]);
  
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes("stripe-return")) {
        console.log("[Dashboard] Stripe return deep link received, refreshing status...");
        await refreshStripeStatus();
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    
    Linking.getInitialURL().then((url) => {
      if (url && url.includes("stripe-return")) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshStripeStatus]);
  
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        console.log("[Dashboard] App came to foreground, checking Stripe status...");
        await refreshStripeStatus();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshStripeStatus]);
  
  const handleConnectStripe = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setConnectingStripe(true);
      setStripeError(null);
      const { url } = await api.startPhotographerStripeOnboarding(token, STRIPE_RETURN_URL);
      if (url) {
        Linking.openURL(url);
      }
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to connect Stripe. Please try again.";
      setStripeError(errorMsg);
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleManagePayouts = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setLoadingPayoutLink(true);
      const { url } = await api.getPhotographerStripeDashboardLink(token);
      Linking.openURL(url);
    } catch (error: any) {
      if (error?.status === 403 && error?.body?.requiresOnboarding) {
        Alert.alert("Stripe Setup Required", "Please complete your Stripe setup before accessing payouts");
      } else {
        Alert.alert("Error", "Unable to open payout dashboard. Please try again.");
      }
    } finally {
      setLoadingPayoutLink(false);
    }
  };

  const handleAddBlockedDate = async (blockedDate: BlockedDate) => {
    const exists = blockedDates.some(b => b.date === blockedDate.date && b.isFullDay === blockedDate.isFullDay);
    if (exists && blockedDate.isFullDay) {
      Alert.alert("Already Blocked", "This date is already blocked.");
      return;
    }
    
    const token = await getToken();
    if (!token) return;
    
    try {
      // The backend requires startAt/endAt and has no is_full_day column, so
      // full day is expressed as a midnight-to-end-of-day span. Callers pass
      // times in either format (DateBlocker sends 24h, ProviderCalendar sends
      // 12h), so normalise before interpolating; convertTo24Hour returns a
      // 24-hour string unchanged.
      const startAt = blockedDate.isFullDay
        ? `${blockedDate.date}T00:00:00`
        : `${blockedDate.date}T${convertTo24Hour(blockedDate.startTime || "00:00")}:00`;
      const endAt = blockedDate.isFullDay
        ? `${blockedDate.date}T23:59:59`
        : `${blockedDate.date}T${convertTo24Hour(blockedDate.endTime || "23:59")}:00`;

      const result = await api.createBlock(token, "photographer", {
        startAt,
        endAt,
        reason: blockedDate.reason,
      } as any);
      setBlockedDates(prev => [...prev, {
        id: result.id,
        date: blockedDate.date,
        isFullDay: blockedDate.isFullDay,
        startTime: blockedDate.isFullDay ? undefined : startAt.split("T")[1]?.substring(0, 5),
        endTime: blockedDate.isFullDay ? undefined : endAt.split("T")[1]?.substring(0, 5),
        reason: blockedDate.reason,
      }]);
    } catch (error: any) {
      console.error("[Dashboard] Failed to add blocked date:", error);
      Alert.alert("Error", error.message || "Failed to add blocked date");
    }
  };

  const handleRemoveBlockedDate = async (index: number) => {
    const dateToRemove = blockedDates[index];
    if (!dateToRemove) return;
    
    const token = await getToken();
    if (!token) return;
    
    if (dateToRemove.id) {
      try {
        // Use new blocks endpoint for deletion
        await api.deleteBlock(token, "photographer", dateToRemove.id);
        setBlockedDates(prev => prev.filter((_, i) => i !== index));
      } catch (error: any) {
        console.error("[Dashboard] Failed to remove blocked date:", error);
        Alert.alert("Error", error.message || "Failed to remove blocked date");
      }
    } else {
      setBlockedDates(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Same accept / decline calls as PhotographerBookingsScreen, with a guard against double taps.
  const bookingActionInFlight = useRef<string | null>(null);
  const handleBookingAction = async (bookingId: string, action: "confirm" | "cancel") => {
    if (bookingActionInFlight.current) return;
    bookingActionInFlight.current = bookingId;
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      if (action === "confirm") {
        await api.acceptBooking(token, "photographer", bookingId);
      } else {
        await api.declineBooking(token, "photographer", bookingId);
      }
      Alert.alert("Success", action === "confirm" ? "Booking accepted." : "Booking declined.");
      fetchDashboard();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ||
          (action === "confirm"
            ? "Failed to accept booking. Please try again."
            : "Failed to decline booking. Please try again."),
      );
    } finally {
      bookingActionInFlight.current = null;
    }
  };

  const handleAutoAcceptChange = async (value: boolean) => {
    const token = await getToken();
    if (!token) return;
    const previous = autoAcceptBookings;
    setAutoAcceptBookings(value);
    setAutoAcceptLoading(true);
    try {
      await api.updatePhotographerSettings(token, { autoAcceptBookings: value });
      setProfile(prev => prev ? { ...prev, autoAcceptBookings: value } : prev);
    } catch (error) {
      console.error("Failed to update auto-accept setting:", error);
      setAutoAcceptBookings(previous);
      Alert.alert("Error", "Failed to update booking settings. Please try again.");
    } finally {
      setAutoAcceptLoading(false);
    }
  };

  const handleRefundPress = (booking: PhotographerBooking) => {
    setSelectedBookingForRefund(booking);
    setRefundModalVisible(true);
  };

  const handleRefundConfirm = async (amount?: number) => {
    if (!selectedBookingForRefund) return;
    
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    const result = await api.issueRefund(token, "photographer", selectedBookingForRefund.id, amount);
    if (result.success) {
      Alert.alert("Refund Issued", `$${refundedDollars(result, amount, fullRefundDollars(selectedBookingForRefund)).toFixed(2)} has been refunded to the customer.`);
      fetchDashboard();
    } else {
      throw new Error(result.message || "Failed to issue refund");
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const hasAvailabilitySet = hours.some(h => h.isAvailable);
  const hasProfileDetails = Boolean(profile?.name && profile?.hourlyRate);
  const hasStripeConnected = profile?.stripeConnected;

  const profileSetupItems = [
    { 
      key: "profile", 
      label: "Profile details", 
      complete: hasProfileDetails,
      action: () => openManage("profile"),
    },
    { 
      key: "availability", 
      label: "Availability", 
      complete: hasAvailabilitySet,
      action: () => openManage("hours"),
    },
  ];

  const stripeSetupItem = { 
    key: "stripe", 
    label: "Connect Stripe", 
    complete: hasStripeConnected,
    action: handleConnectStripe,
    isOptional: true,
    description: hasStripeConnected ? "Connected" : "Required to accept bookings & receive payments",
  };

  const setupItems = [...profileSetupItems, stripeSetupItem];

  const profileComplete = profileSetupItems.every(item => item.complete);
  const allSetupComplete = profileComplete;
  const statusText = hasStripeConnected ? "Active" : (profileComplete ? "Ready (Stripe pending)" : "Pending Setup");
  const statusColor = allSetupComplete ? "#34C759" : "#FF9500";

  const styles = StyleSheet.create({
    // ── Layout ────────────────────────────────────────────────────────────
    container: {
      flex: 1,
      backgroundColor: DASHBOARD_COLORS.background,
    },
    scrollContent: {
      paddingBottom: insets.bottom + 24,
    },

    // ── Header ────────────────────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 12,
    },
    headerLeft: { flex: 1 },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: DASHBOARD_COLORS.cream,
      letterSpacing: -0.3,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(52,199,89,0.15)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: "flex-start",
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#34C759",
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#34C759",
    },
    backButton: { padding: 8, marginRight: 8 },
    logoutButton: { padding: 8 },

    // ── Section headers (gold accent bar — matches Business/Staff) ─────────
    section: {
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    sectionHeaderAccent: {
      width: 4,
      height: 14,
      borderRadius: 2,
      backgroundColor: DASHBOARD_COLORS.gold,
    },
    sectionHeaderText: {
      fontSize: 14,
      letterSpacing: 1.5,
      fontWeight: "700",
      color: DASHBOARD_COLORS.cream,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: DASHBOARD_COLORS.cream,
      letterSpacing: -0.3,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: DASHBOARD_COLORS.creamDim,
      marginTop: 2,
    },

    // ── Stripe card (matches Business) ────────────────────────────────────
    setupCard: {
      backgroundColor: "rgba(201,147,58,0.08)",
      borderRadius: 16,
      padding: 20,
      borderLeftWidth: 3,
      borderLeftColor: DASHBOARD_COLORS.gold,
    },
    setupItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.06)",
    },
    setupItemLast: { borderBottomWidth: 0 },
    setupIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    setupIconComplete: { backgroundColor: "rgba(52,199,89,0.15)" },
    setupIconIncomplete: {
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.12)",
    },
    setupLabel: {
      flex: 1,
      fontSize: 15,
      color: DASHBOARD_COLORS.cream,
    },
    setupLabelComplete: { color: DASHBOARD_COLORS.creamDim },

    // ── Stats grid (matches Business/Staff) ───────────────────────────────
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    statsRow: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 10,
    },
    statsRowTop: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    statsRowBottom: {
      flexDirection: "row",
      gap: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: "#111411",
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      alignItems: "flex-start",
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      backgroundColor: "rgba(201,147,58,0.15)",
    },
    statLabel: {
      fontSize: 11,
      color: DASHBOARD_COLORS.creamDim,
      marginTop: 2,
      textAlign: "left",
    },
    statValue: {
      fontSize: 24,
      fontWeight: "700",
      color: DASHBOARD_COLORS.cream,
      letterSpacing: -0.5,
    },

    // ── Profile card ──────────────────────────────────────────────────────
    profileCard: {
      backgroundColor: DASHBOARD_COLORS.surface,
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
    },
    profileHeader: { flexDirection: "row", alignItems: "center" },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: DASHBOARD_COLORS.gold,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    profileAvatarImage: { width: 64, height: 64, borderRadius: 32 },
    profileAvatarText: {
      fontSize: 24,
      fontWeight: "600",
      color: DASHBOARD_COLORS.background,
    },
    profileInfo: { flex: 1 },
    profileName: {
      fontSize: 18,
      fontWeight: "600",
      color: DASHBOARD_COLORS.cream,
    },
    profileRate: {
      fontSize: 14,
      color: DASHBOARD_COLORS.gold,
      fontWeight: "500",
      marginTop: 2,
    },
    profileLocation: {
      fontSize: 13,
      color: DASHBOARD_COLORS.creamDim,
      marginTop: 2,
    },
    profileBio: {
      fontSize: 14,
      color: DASHBOARD_COLORS.creamDim,
      lineHeight: 20,
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.06)",
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: DASHBOARD_COLORS.gold,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 16,
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: DASHBOARD_COLORS.background,
      marginLeft: 8,
    },

    // ── Up Next card ───────────────────────────────────────────────────────
    upNextCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(201,147,58,0.28)",
      backgroundColor: "rgba(201,147,58,0.07)",
      padding: 14,
    },
    upNextLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    upNextLabelDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DASHBOARD_COLORS.gold },
    upNextLabelText: { color: DASHBOARD_COLORS.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
    upNextBody: { flexDirection: "row", alignItems: "center", gap: 12 },
    upNextIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    upNextTextWrap: { flex: 1 },
    upNextTitle: { color: DASHBOARD_COLORS.cream, fontSize: 14, fontWeight: "600" },
    upNextSubtext: { color: DASHBOARD_COLORS.creamDim, fontSize: 11.5, marginTop: 2 },
    upNextUrgency: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
    // ── Activity nav cards ─────────────────────────────────────────────────
    navCard: {
      backgroundColor: DASHBOARD_COLORS.surface,
      borderWidth: 1,
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navCardLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
    navCardIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    navCardTextWrap: { flex: 1 },
    navCardTitle: { color: DASHBOARD_COLORS.cream, fontSize: 15, fontWeight: "600" },
    navCardSubtitle: { color: DASHBOARD_COLORS.creamDim, fontSize: 12, marginTop: 2 },
    navCardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    navBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    navBadgeText: { fontSize: 12, fontWeight: "700" },
    // ── Quick actions (kept for legacy reference — no longer rendered) ──────
    quickActionsRow: {
      flexDirection: "row",
      gap: 12,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: DASHBOARD_COLORS.surface,
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
      backgroundColor: "rgba(201,147,58,0.15)",
    },
    quickActionLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: DASHBOARD_COLORS.cream,
      textAlign: "center",
    },
    quickActionCount: {
      fontSize: 11,
      color: DASHBOARD_COLORS.creamDim,
      marginTop: 2,
    },

    // ── Empty state ────────────────────────────────────────────────────────
    emptyCard: {
      backgroundColor: DASHBOARD_COLORS.surface,
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 14,
      padding: 24,
      alignItems: "center",
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(201,147,58,0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 14,
      color: DASHBOARD_COLORS.creamDim,
      textAlign: "center",
    },

    // ── Booking cards (inside modal) ───────────────────────────────────────
    serviceThumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      marginRight: 10,
      backgroundColor: DASHBOARD_COLORS.cardBorder,
    },
    bookingCard: {
      backgroundColor: DASHBOARD_COLORS.surface,
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    bookingHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    bookingAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(201,147,58,0.2)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    bookingAvatarText: {
      fontSize: 16,
      fontWeight: "600",
      color: DASHBOARD_COLORS.gold,
    },
    bookingInfo: { flex: 1 },
    bookingClient: {
      fontSize: 15,
      fontWeight: "600",
      color: DASHBOARD_COLORS.cream,
    },
    bookingService: {
      fontSize: 13,
      color: DASHBOARD_COLORS.creamDim,
      marginTop: 2,
    },
    bookingAmount: {
      fontSize: 15,
      fontWeight: "600",
      color: DASHBOARD_COLORS.gold,
    },
    bookingDetails: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.06)",
    },
    bookingDate: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 16,
    },
    bookingDateText: {
      fontSize: 13,
      color: DASHBOARD_COLORS.creamDim,
      marginLeft: 6,
    },
    bookingActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    bookingActionButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    bookingConfirmButton: { backgroundColor: "#34C759" },
    bookingDeclineButton: { backgroundColor: "rgba(255,255,255,0.08)" },
    bookingActionText: {
      fontSize: 14,
      fontWeight: "600",
    },
    bookingStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    bookingStatusText: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "capitalize",
    },

    // ── Error screen ───────────────────────────────────────────────────────
    errorContainer: {
      flex: 1,
      backgroundColor: DASHBOARD_COLORS.background,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContent: {
      alignItems: "center",
      paddingHorizontal: 32,
      maxWidth: 320,
    },
    errorIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "rgba(201,147,58,0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: DASHBOARD_COLORS.cream,
      textAlign: "center",
      marginBottom: 8,
    },
    errorMessage: {
      fontSize: 15,
      color: DASHBOARD_COLORS.creamDim,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 32,
    },
    errorActions: { flexDirection: "row", gap: 12 },
    errorButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: DASHBOARD_COLORS.gold,
    },
    errorButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: DASHBOARD_COLORS.background,
    },
    errorButtonOutline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: DASHBOARD_COLORS.cardBorder,
    },
    errorButtonOutlineText: {
      fontSize: 15,
      fontWeight: "600",
      color: DASHBOARD_COLORS.cream,
    },

    // ── Modal shells (internal content keeps theme — only outer shell changes) ──
    modalScroll: { padding: 20 },

    // ── Form fields (modal-internal — keep theme tokens) ──────────────────
    formGroup: { marginBottom: 20 },
    formLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.brandTextDim,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.brandSurface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.brandCream,
    },
    formTextarea: { minHeight: 100, textAlignVertical: "top" },
    formRow: { flexDirection: "row", gap: 12 },
    formHalf: { flex: 1 },
    specialtiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    specialtyChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
    },
    specialtyChipActive: {
      backgroundColor: theme.brandGold + "20",
      borderColor: theme.brandGold,
    },
    specialtyChipText: { fontSize: 14, color: theme.brandTextDim },
    specialtyChipTextActive: { color: theme.brandGold, fontWeight: "500" },
    formHint: {
      fontSize: 13,
      color: theme.brandTextDim,
      marginTop: 2,
      marginBottom: 12,
    },
  });

  const renderBookingsModal = () => (
    <FullScreenSheet
      visible={activeModal === "bookings"}
      onClose={() => setActiveModal(null)}
      title="Bookings"
      backgroundColor={theme.brandBgElevated}
      tintColor={theme.brandCream}
      borderColor={theme.brandSurfaceBorder}
    >
      <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
        {bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="calendar" size={24} color={DASHBOARD_COLORS.creamDim} />
            </View>
            <Text style={styles.emptyText}>No bookings yet</Text>
          </View>
        ) : (
          bookings.map(booking => {
            const isPending = isPendingRequestStatus(booking.status);
            const getStatusColor = (status: string) => {
              if (status === "confirmed") return "#34C759";
              if (isPendingRequestStatus(status)) return "#FF9500";
              if (isCanceledStatus(status) || status === "declined") return "#FF3B30";
              if (status === "completed") return DASHBOARD_COLORS.gold;
              if (isExpiredStatus(status) || status === "no_show") return "#8E8E93";
              return DASHBOARD_COLORS.creamDim;
            };
            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingAvatar}>
                    <Text style={styles.bookingAvatarText}>
                      {booking.clientName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingClient}>{booking.clientName}</Text>
                    <Text style={styles.bookingService}>{booking.sessionType}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {booking.subtotalAmount != null ? (
                      <Text style={[styles.bookingAmount, { color: DASHBOARD_COLORS.creamDim, fontSize: 12 }]}>
                        Subtotal: ${booking.subtotalAmount.toFixed(2)}
                      </Text>
                    ) : null}
                    {booking.bookingFeeAmount != null ? (
                      <Text style={[styles.bookingAmount, { color: DASHBOARD_COLORS.creamDim, fontSize: 12 }]}>
                        Booking Fee: -${booking.bookingFeeAmount.toFixed(2)}
                      </Text>
                    ) : null}
                    {booking.isInfluencerAttributed && booking.influencerCommissionAmount != null ? (
                      <Text style={[styles.bookingAmount, { color: DASHBOARD_COLORS.creamDim, fontSize: 12 }]}>
                        Influencer: -${booking.influencerCommissionAmount.toFixed(2)}
                      </Text>
                    ) : null}
                    {booking.vendorNetAmount != null ? (
                      <Text style={[styles.bookingAmount, { fontWeight: "700" }]}>
                        You Earn: ${booking.vendorNetAmount.toFixed(2)}
                      </Text>
                    ) : (
                      <Text style={styles.bookingAmount}>${booking.amount.toFixed(2)}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.bookingDetails}>
                  <View style={styles.bookingDate}>
                    <Feather name="calendar" size={14} color={DASHBOARD_COLORS.creamDim} />
                    <Text style={styles.bookingDateText}>{booking.date}</Text>
                  </View>
                  <View style={styles.bookingDate}>
                    <Feather name="clock" size={14} color={DASHBOARD_COLORS.creamDim} />
                    <Text style={styles.bookingDateText}>{booking.time}</Text>
                  </View>
                  <View style={[styles.bookingStatusBadge, { backgroundColor: getStatusColor(booking.status) + "20" }]}>
                    <Text style={[styles.bookingStatusText, { color: getStatusColor(booking.status) }]}>
                      {bookingStatusLabel(booking.status)}
                    </Text>
                  </View>
                </View>
                <BookingExtrasBlock
                  addons={booking.addons}
                  customerDetails={booking.customerDetails}
                  inPersonDueCents={booking.inPersonDueCents}
                  inPersonLabel="Collect in person"
                  textColor={DASHBOARD_COLORS.cream}
                  dimColor={DASHBOARD_COLORS.creamDim}
                  accentColor={DASHBOARD_COLORS.gold}
                  borderColor={DASHBOARD_COLORS.cardBorder}
                />
                {isPending && (
                  <View style={styles.bookingActions}>
                    <Pressable
                      onPress={() => handleBookingAction(booking.id, "confirm")}
                      style={[styles.bookingActionButton, styles.bookingConfirmButton]}
                    >
                      <Text style={[styles.bookingActionText, { color: "#FFFFFF" }]}>Accept</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleBookingAction(booking.id, "cancel")}
                      style={[styles.bookingActionButton, styles.bookingDeclineButton]}
                    >
                      <Text style={[styles.bookingActionText, { color: DASHBOARD_COLORS.cream }]}>Decline</Text>
                    </Pressable>
                  </View>
                )}
                {booking.status === "confirmed" && (
                  <View style={styles.bookingActions}>
                    <Pressable
                      onPress={() => handleRefundPress(booking)}
                      style={[styles.bookingActionButton, { backgroundColor: theme.error + "15", borderColor: theme.error }]}
                    >
                      <Text style={[styles.bookingActionText, { color: theme.error }]}>Issue Refund</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </FullScreenSheet>
  );

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Main", { screen: "AccountTab", params: { screen: "Account" } });
    }
  };

  // Auth error screen with back navigation
  if (authError) {
    return (
      <View style={[styles.container, styles.errorContainer, { paddingTop: insets.top + 20 }]}>
        <View style={styles.errorContent}>
          <View style={styles.errorIconContainer}>
            <Feather name="alert-circle" size={48} color={DASHBOARD_COLORS.gold} />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorMessage}>{authError}</Text>
          <View style={styles.errorActions}>
            <Pressable
              style={styles.errorButton}
              onPress={handleGoBack}
            >
              <Feather name="arrow-left" size={18} color={DASHBOARD_COLORS.background} />
              <Text style={styles.errorButtonText}>Go Back</Text>
            </Pressable>
            <Pressable
              style={styles.errorButtonOutline}
              onPress={() => {
                setAuthError(null);
                setLoading(true);
                fetchDashboard();
              }}
            >
              <Feather name="refresh-cw" size={18} color={DASHBOARD_COLORS.cream} />
              <Text style={styles.errorButtonOutlineText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Note: Removed the blocking needsProfileSetup screen
  // Dashboard now shows with whatever data is available, with setup prompts instead of blocking access

  if (loading || authLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <OutsydeLoader />
      </View>
    );
  }

  // ── UP NEXT computation ────────────────────────────────────────────────
  // Computed at render time from already-mapped bookings state.
  const DAY_MS = 24 * 60 * 60 * 1000;

  type UpNextItem = {
    title: string;
    subtext?: string;
    iconName: string;
    urgency?: "red" | "amber" | "green";
  };
  let upNextItem: UpNextItem | null = null;

  // Priority 1: next confirmed booking today or tomorrow
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const tomorrowMs = todayMs + DAY_MS;
  const confirmedSoon = bookings
    .filter((b) => {
      if (b.status !== "confirmed") return false;
      const d = new Date(b.date).setHours(0, 0, 0, 0);
      return d >= todayMs && d <= tomorrowMs + DAY_MS;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (confirmedSoon.length > 0) {
    const c = confirmedSoon[0];
    const isToday = new Date(c.date).setHours(0, 0, 0, 0) === todayMs;
    upNextItem = {
      title: `${c.sessionType || "Session"} — ${c.clientName}`,
      subtext: `${c.date}${c.time ? " at " + c.time : ""}`,
      iconName: "calendar",
      urgency: isToday ? "green" : "amber",
    };
  }

  // Priority 2: oldest pending booking awaiting confirmation
  if (!upNextItem) {
    const pendingBks = bookings
      .filter((b) => isPendingRequestStatus(b.status))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (pendingBks.length > 0) {
      upNextItem = {
        title: "Booking awaiting confirmation",
        subtext: `Requested by ${pendingBks[0].clientName}`,
        iconName: "clock",
        urgency: "amber",
      };
    }
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DASHBOARD_COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={DASHBOARD_COLORS.cream} />
          </Pressable>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{profile?.name || "Photographer"}</Text>
            {(profile?.city || profile?.state) && (
              <Text style={[styles.sectionSubtitle, { marginTop: 2 }]}>
                {[profile.city, profile.state].filter(Boolean).join(", ")}
              </Text>
            )}
            <View style={styles.headerRow}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {profile?.stripeConnected ? "Active" : "Stripe Pending"}
                </Text>
              </View>
            </View>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Feather name="log-out" size={22} color={DASHBOARD_COLORS.creamDim} />
          </Pressable>
        </View>

        {/* Stripe: show connect banner OR manage payouts row — never both */}
        {!profile?.stripeConnected ? (
          <View style={[styles.setupCard, { marginHorizontal: 16, marginBottom: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Feather name="credit-card" size={20} color={DASHBOARD_COLORS.gold} />
              <Text style={[styles.sectionTitle, { fontSize: 16, marginLeft: 10 }]}>Connect Stripe</Text>
            </View>
            <Text style={{ color: DASHBOARD_COLORS.creamDim, fontSize: 13, marginBottom: 14 }}>
              Connect your Stripe account to accept bookings and receive payments.
            </Text>
            {stripeError ? (
              <View style={{ backgroundColor: "rgba(255,59,48,0.1)", padding: 10, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ color: "#FF3B30", fontSize: 13 }}>{stripeError}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleConnectStripe}
              disabled={connectingStripe}
              style={{ backgroundColor: DASHBOARD_COLORS.gold, paddingVertical: 13, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", opacity: connectingStripe ? 0.7 : 1 }}
            >
              {connectingStripe
                ? <ActivityIndicator size="small" color={DASHBOARD_COLORS.background} />
                : <><Feather name="link" size={18} color={DASHBOARD_COLORS.background} /><Text style={{ color: DASHBOARD_COLORS.background, fontWeight: "700", fontSize: 15, marginLeft: 8 }}>Connect Stripe</Text></>}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleManagePayouts}
            disabled={loadingPayoutLink}
            style={[
              { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(201,147,58,0.08)", marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: DASHBOARD_COLORS.gold },
              { opacity: loadingPayoutLink ? 0.7 : 1 },
            ]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(201,147,58,0.2)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Feather name="dollar-sign" size={20} color={DASHBOARD_COLORS.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: DASHBOARD_COLORS.cream }}>Manage Payouts</Text>
              <Text style={{ fontSize: 13, color: DASHBOARD_COLORS.creamDim, marginTop: 2 }}>View your balance and payout history</Text>
            </View>
            {loadingPayoutLink
              ? <ActivityIndicator size="small" color={DASHBOARD_COLORS.gold} />
              : <Feather name="chevron-right" size={20} color={DASHBOARD_COLORS.gold} />}
          </Pressable>
        )}

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statsRowTop}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}><Feather name="dollar-sign" size={14} color={DASHBOARD_COLORS.gold} /></View>
              <Text style={styles.statValue}>${stats.earnings.toFixed(0)}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}><Feather name="calendar" size={14} color={DASHBOARD_COLORS.gold} /></View>
              <Text style={styles.statValue}>{stats.totalBookings ?? 0}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Bookings</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}><Feather name="check-circle" size={14} color={DASHBOARD_COLORS.gold} /></View>
              <Text style={styles.statValue}>{stats.completedShoots}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Completed</Text>
            </View>
          </View>
          <View style={styles.statsRowBottom}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}><Feather name="star" size={14} color={DASHBOARD_COLORS.gold} /></View>
              <Text style={styles.statValue}>{stats.rating > 0 ? displayRating(stats.rating) : "—"}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}><Feather name="message-circle" size={14} color={DASHBOARD_COLORS.gold} /></View>
              <Text style={styles.statValue}>{stats.reviewCount}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Reviews</Text>
            </View>
          </View>
        </View>

        {/* Booking Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>BOOKING SETTINGS</Text>
          </View>
          {/* Inline booking toggle — matches dark palette; replaces AutoAcceptToggle
              which uses theme.card (white in dark mode) internally */}
          <View style={{
            backgroundColor: DASHBOARD_COLORS.surface,
            borderColor: DASHBOARD_COLORS.cardBorder,
            borderWidth: 1,
            borderRadius: 16,
            overflow: "hidden",
          }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 14,
              gap: 12,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: autoAcceptBookings
                  ? "rgba(52,199,89,0.15)"
                  : "rgba(201,147,58,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Feather
                  name={autoAcceptBookings ? "check-circle" : "clock"}
                  size={20}
                  color={autoAcceptBookings ? "#34C759" : DASHBOARD_COLORS.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: DASHBOARD_COLORS.cream,
                  fontSize: 15,
                  fontWeight: "600",
                  marginBottom: 2,
                }}>
                  Auto-Accept Bookings
                </Text>
                <Text style={{
                  color: DASHBOARD_COLORS.creamDim,
                  fontSize: 12,
                  lineHeight: 17,
                }}>
                  {autoAcceptBookings
                    ? "New bookings are confirmed immediately after payment"
                    : "New bookings require your approval within 48 hours"}
                </Text>
              </View>
              {autoAcceptLoading ? (
                <ActivityIndicator size="small" color={DASHBOARD_COLORS.gold} />
              ) : (
                <Switch
                  value={autoAcceptBookings}
                  onValueChange={handleAutoAcceptChange}
                  trackColor={{
                    false: "rgba(255,255,255,0.2)",
                    true: "rgba(52,199,89,0.55)",
                  }}
                  thumbColor={autoAcceptBookings ? "#34C759" : DASHBOARD_COLORS.creamDim}
                />
              )}
            </View>
            {!autoAcceptBookings && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
                paddingHorizontal: 14,
                gap: 6,
                backgroundColor: "rgba(201,147,58,0.08)",
                borderTopWidth: 1,
                borderTopColor: DASHBOARD_COLORS.cardBorder,
              }}>
                <Feather name="alert-circle" size={13} color={DASHBOARD_COLORS.gold} />
                <Text style={{
                  color: DASHBOARD_COLORS.gold,
                  fontSize: 12,
                  flex: 1,
                }}>
                  Pending bookings expire after 48 hours if not accepted
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Profile Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>PROFILE</Text>
          </View>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              {profile?.avatar
                ? <Image source={{ uri: profile.avatar }} style={styles.profileAvatarImage} />
                : <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{profile?.name?.charAt(0)?.toUpperCase() || "P"}</Text>
                  </View>}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.name || "Your Name"}</Text>
                <Text style={styles.profileRate}>
                  {profile?.hourlyRate ? `$${profile.hourlyRate}/hour` : "Set your rate"}
                </Text>
                {profile?.city && profile?.state && (
                  <Text style={styles.profileLocation}>{profile.city}, {profile.state}</Text>
                )}
              </View>
            </View>
            {profile?.bio ? (
              <Text style={styles.profileBio} numberOfLines={3}>{profile.bio}</Text>
            ) : null}
            <Pressable onPress={() => openManage("profile")} style={styles.editButton}>
              <Feather name="edit-2" size={16} color={DASHBOARD_COLORS.background} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>

        {/* UP NEXT card */}
        {upNextItem && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <View style={styles.upNextCard}>
              <View style={styles.upNextLabelRow}>
                <View style={styles.upNextLabelDot} />
                <Text style={styles.upNextLabelText}>UP NEXT</Text>
              </View>
              <View style={styles.upNextBody}>
                <View style={styles.upNextIconBox}>
                  <Feather name={upNextItem.iconName as any} size={18} color={DASHBOARD_COLORS.gold} />
                </View>
                <View style={styles.upNextTextWrap}>
                  <Text style={styles.upNextTitle}>{upNextItem.title}</Text>
                  {upNextItem.subtext ? <Text style={styles.upNextSubtext}>{upNextItem.subtext}</Text> : null}
                </View>
                {upNextItem.urgency ? (
                  <Text style={[styles.upNextUrgency, { color: upNextItem.urgency === "red" ? "#E85D5D" : upNextItem.urgency === "amber" ? "#E0A93B" : "#3FCB6E" }]}>
                    {upNextItem.urgency === "red" ? "OVERDUE" : upNextItem.urgency === "amber" ? "SOON" : "TODAY"}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* ACTIVITY section */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>ACTIVITY</Text>
          </View>

          <Pressable
            style={styles.navCard}
            onPress={() => openManage()}
            accessibilityRole="button"
            accessibilityLabel="Manage business"
          >
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
                <Feather name="sliders" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Manage business</Text>
                <Text style={styles.navCardSubtitle}>Services, profile, hours and payouts</Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
            </View>
          </Pressable>

          <Pressable style={styles.navCard} onPress={() => navigation.navigate("PhotographerBookingsScreen")}>
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
                <Feather name="calendar" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Bookings</Text>
                <Text style={styles.navCardSubtitle}>{stats.upcomingBookings} upcoming</Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              {stats.upcomingBookings > 0 && (
                <View style={[styles.navBadge, { backgroundColor: "rgba(224,169,59,0.15)" }]}>
                  <Text style={[styles.navBadgeText, { color: "#E0A93B" }]}>{stats.upcomingBookings}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
            </View>
          </Pressable>

          <Pressable
            style={styles.navCard}
            onPress={() =>
              navigation.navigate("BusinessRequests", { side: "photographer" })
            }
            accessibilityRole="button"
            accessibilityLabel={`Requests${newRequests ? `, ${newRequests} new` : ""}`}
          >
            <View style={styles.navCardLeft}>
              <View
                style={[
                  styles.navCardIconBg,
                  { backgroundColor: "rgba(201,147,58,0.12)" },
                ]}
              >
                <Feather name="inbox" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Requests</Text>
                <Text style={styles.navCardSubtitle}>
                  {newRequests
                    ? `${newRequests} new`
                    : "Request forms customers sent you"}
                </Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              {newRequests ? (
                <View
                  style={[
                    styles.navBadge,
                    { backgroundColor: "rgba(224,169,59,0.15)" },
                  ]}
                >
                  <Text style={[styles.navBadgeText, { color: "#E0A93B" }]}>
                    {newRequests}
                  </Text>
                </View>
              ) : null}
              <Feather
                name="chevron-right"
                size={18}
                color={DASHBOARD_COLORS.creamDim}
              />
            </View>
          </Pressable>

          <Pressable style={styles.navCard} onPress={() => openManage("services")}>
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
                <Feather name="camera" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Services</Text>
                <Text style={styles.navCardSubtitle}>{services.length} active</Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
            </View>
          </Pressable>

          <Pressable style={styles.navCard} onPress={() => openManage("hours")}>
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
                <Feather name="clock" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Base Hours</Text>
                <Text style={styles.navCardSubtitle}>{hasAvailabilitySet ? "Set" : "Not set"}</Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
            </View>
          </Pressable>

          <Pressable style={styles.navCard} onPress={() => openManage("blocked")}>
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
                <Feather name="x-circle" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Block Dates</Text>
                <Text style={styles.navCardSubtitle}>{blockedDates.length} blocked</Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
            </View>
          </Pressable>
        </View>

        {/* Calendar Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>CALENDAR</Text>
          </View>
          <View style={{ marginTop: 12 }}>
            <Pressable onPress={() => navigation.navigate("PhotographerCalendarScreen")}>
            <ProviderCalendar
              bookings={bookings.map(b => ({
                id: b.id,
                date: b.date,
                startTime: b.time || "9:00 AM",
                clientName: b.clientName,
                serviceName: b.sessionType,
                status: b.status as CalendarBooking["status"],
                amount: b.amount,
              }))}
              blockedDates={blockedDates.map(bd => ({
                id: bd.id,
                date: bd.date,
                startTime: bd.startTime,
                endTime: bd.endTime,
                isFullDay: bd.isFullDay,
                reason: bd.reason,
              }))}
              weeklyAvailability={hours.map((h, idx) => ({
                dayOfWeek: idx,
                isAvailable: h.isAvailable,
                windows: h.isAvailable ? [{ startTime: h.startTime, endTime: h.endTime }] : [],
              }))}
              onBlockDate={async (date, isFullDay, startTime, endTime, reason) => {
                await handleAddBlockedDate({
                  id: `temp-${Date.now()}`,
                  date,
                  isFullDay,
                  startTime,
                  endTime,
                  reason,
                });
              }}
              onUnblockDate={async (blockId) => {
                const index = blockedDates.findIndex(b => b.id === blockId);
                if (index >= 0) await handleRemoveBlockedDate(index);
              }}
              onBookingPress={() => setActiveModal("bookings")}
              monthsAhead={3}
            />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {renderBookingsModal()}

      <RefundModal
        visible={refundModalVisible}
        onClose={() => {
          setRefundModalVisible(false);
          setSelectedBookingForRefund(null);
        }}
        onConfirm={handleRefundConfirm}
        bookingAmount={selectedBookingForRefund ? fullRefundDollars(selectedBookingForRefund) : 0}
        clientName={selectedBookingForRefund?.clientName || ""}
        serviceName={selectedBookingForRefund?.sessionType || ""}
      />
    </>
  );
}

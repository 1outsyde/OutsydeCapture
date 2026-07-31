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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, {
  BusinessDashboardStats,
  BusinessDashboardProfile,
  VendorEligibility,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { DayHours, getDefaultHours } from "@/components/HoursEditor";
import ProviderCalendar, { CalendarBooking, CalendarBlockedDate, DayAvailability } from "@/components/ProviderCalendar";
import BusinessEligibilityGate from "@/components/BusinessEligibilityGate";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";

type BusinessType = "service" | "product" | "both";

const DASHBOARD_COLORS = {
  background: "#080C08",
  surface: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  gold: "#C9933A",
  goldLight: "#E8B86D",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
};

const convertTo12Hour = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
};

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 4 }}>
      <View style={{ width: 3, height: 11, backgroundColor: DASHBOARD_COLORS.gold, borderRadius: 2 }} />
      <Text style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: DASHBOARD_COLORS.creamDim, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}

export default function BusinessDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, logout, user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [eligibility, setEligibility] = useState<VendorEligibility | null>(null);

  const [stats, setStats] = useState<BusinessDashboardStats>({
    earnings: 0,
    upcomingOrders: 0,
    upcomingBookings: 0,
    unreadMessages: 0,
    rating: 0,
    reviewCount: 0,
    profileViews: 0,
  });
  const [profile, setProfile] = useState<BusinessDashboardProfile | null>(null);
  const [seatStatus, setSeatStatus] = useState<{
    activeCount: number;
    maxStaff: number | null;
    tierName: string;
  } | null>(null);

  const [bookings, setBookings] = useState<any[]>([]);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());
  const [blockedDates, setBlockedDates] = useState<CalendarBlockedDate[]>([]);

  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [autoAcceptLoading, setAutoAcceptLoading] = useState(false);
  const [loadingPayoutLink, setLoadingPayoutLink] = useState(false);

  // Up Next data — fetched lightly on mount when profile is ready
  const [upNextOrders, setUpNextOrders] = useState<any[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);

  const businessType: BusinessType = profile?.businessType || "both";

  // ─── Fetch dashboard ────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setAuthError("Please sign in to access your dashboard");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      const { business } = await api.getVendorMyBusiness(token);

      setStats({
        earnings: (business as any).totalEarnings || 0,
        upcomingOrders: 0,
        upcomingBookings: 0,
        unreadMessages: 0,
        rating: business.rating || 0,
        reviewCount: business.reviewCount || 0,
        profileViews: 0,
      });

      try {
        const { stats: businessStats } = await api.getBusinessStats(token);
        setStats((prev) => ({
          ...prev,
          earnings: businessStats.monthlyRevenueCents / 100,
          upcomingOrders: businessStats.orderCount,
          upcomingBookings: businessStats.bookingCount,
        }));
      } catch (statsError) {
        console.warn("[Dashboard] Failed to load business stats:", statsError);
      }

      const businessTypeValue = business.hasProducts && business.hasServices
        ? "both"
        : business.hasProducts
          ? "product"
          : "service";

      setProfile({
        id: business.id,
        name: business.name || "",
        avatar: business.logoImage || undefined,
        category: business.category || "",
        bio: business.description || undefined,
        city: business.city || undefined,
        state: business.state || undefined,
        website: business.websiteUrl || undefined,
        stripeConnected: business.stripeOnboardingComplete || false,
        businessType: businessTypeValue,
        autoAcceptBookings: (business as any).autoAcceptBookings ?? false,
        isMultiStaff: Boolean((business as any).isMultiStaff),
      });
      setAutoAcceptBookings((business as any).autoAcceptBookings ?? false);

      if ((business as any).isMultiStaff) {
        try {
          const seatRes = await api.getStaffSeatStatus(token);
          setSeatStatus(seatRes);
        } catch (seatError) {
          console.error("[Dashboard] Failed to load seat status:", seatError);
          setSeatStatus(null);
        }
      } else {
        setSeatStatus(null);
      }

      // Load weekly hours to power the calendar preview
      try {
        const weeklyRes = await api.getWeeklyAvailability(token, "business");
        const rawWeekly: any[] = (weeklyRes as any)?.availability || (Array.isArray(weeklyRes) ? weeklyRes : []);
        if (rawWeekly.length > 0) {
          const loadedMap = new Map(rawWeekly.map((s: any) => [s.dayOfWeek, s]));
          setHours(getDefaultHours().map((d) => {
            const slot = loadedMap.get(d.dayOfWeek) as any;
            if (slot) {
              return {
                dayOfWeek: d.dayOfWeek,
                isAvailable: slot.isActive,
                startTime: convertTo12Hour(slot.startTime),
                endTime: convertTo12Hour(slot.endTime),
              };
            }
            return d;
          }));
        }
      } catch (hoursErr) {
        console.warn("[Dashboard] Could not load weekly hours for calendar:", hoursErr);
      }

      // Load blocked dates to power the calendar red indicators
      try {
        const blocksResponse = await api.getBlocks(token, "business");
        const blocks: any[] = Array.isArray(blocksResponse)
          ? blocksResponse
          : (blocksResponse as any)?.blocks ?? [];
        setBlockedDates(
          blocks.map((b: any) => ({
            id: b.id,
            date: b.startDate?.split("T")[0] ?? b.startAt?.split("T")[0],
            isFullDay: b.isFullDay,
            startTime: b.isFullDay ? undefined : (b.startDate ?? b.startAt)?.split("T")[1]?.substring(0, 5),
            endTime: b.isFullDay ? undefined : (b.endDate ?? b.endAt)?.split("T")[1]?.substring(0, 5),
            reason: b.reason,
          }))
        );
      } catch (blocksErr) {
        console.warn("[Dashboard] Could not load blocked dates for calendar:", blocksErr);
      }
    } catch (error: any) {
      console.error("Failed to fetch business dashboard:", error);

      const status = error?.status || error?.response?.status;
      const message = error?.message || "";
      const is401 = status === 401 || message.includes("401") || message.toLowerCase().includes("unauthorized");

      if (is401) {
        setAuthError("Your session has expired. Please sign in again.");
        await logout();
        return;
      }

      setStats({
        earnings: 0,
        upcomingOrders: 0,
        upcomingBookings: 0,
        unreadMessages: 0,
        rating: 0,
        reviewCount: 0,
        profileViews: 0,
      });
      setProfile({
        id: "",
        name: "Business",
        category: "General",
        stripeConnected: false,
        businessType: "both",
      });
      setSeatStatus(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, logout]);

  const fetchEligibility = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const e = await api.getVendorEligibility(token);
      setEligibility(e);
    } catch (err) {
      console.warn("[Dashboard] Failed to fetch eligibility:", err);
    }
  }, [getToken]);

  const fetchBookingsForCalendar = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await api.getBusinessBookings(token) as any;
      setBookings(Array.isArray(res) ? res : res?.bookings || []);
    } catch (err) {
      console.warn("[Dashboard] Could not load bookings for calendar:", err);
    }
  }, [getToken]);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;

      if (!user) {
        setAuthError("Please sign in to access your dashboard");
        setLoading(false);
        return;
      }

      if (user.role !== "business") {
        setAuthError("This dashboard is only available for businesses");
        setLoading(false);
        return;
      }

      fetchDashboard();
      fetchEligibility();
    }, [authLoading, user?.id, user?.role, fetchDashboard, fetchEligibility])
  );

  // Preload bookings for the calendar preview
  useEffect(() => {
    if (!profile?.id) return;
    fetchBookingsForCalendar();
  }, [profile?.id]);

  // Fetch up-next orders + credit balance when profile is ready
  useEffect(() => {
    if (!profile?.id) return;
    const fetchUpNextData = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const ordersRes = await api.getBusinessOrders(token);
        setUpNextOrders(ordersRes.orders as any[]);
      } catch { /* silent */ }
      try {
        const creditsRes = await api.getBusinessProductionCredits(token, profile.id);
        setCreditBalance(creditsRes.balance);
      } catch { /* silent */ }
    };
    fetchUpNextData();
  }, [profile?.id]);

  // ─── Stripe / AppState / Deep-link ─────────────────────────────────────────

  const STRIPE_RETURN_URL = "outsyde://stripe-return";
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshStripeStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const stripeStatus = await api.getVendorStripeStatus(token);
      const isConnected = stripeStatus.onboardingComplete || (stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled);
      setProfile(prev => prev ? { ...prev, stripeConnected: isConnected } : prev);
      if (isConnected) {
        Alert.alert("Success", "Your Stripe account is now connected! You can start accepting payments.");
      }
    } catch (error) {
      console.error("[Dashboard] Failed to fetch Stripe status:", error);
    }
  }, [getToken]);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (event.url.includes("stripe-return")) {
        await refreshStripeStatus();
      }
    };
    const subscription = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url && url.includes("stripe-return")) handleDeepLink({ url });
    });
    return () => { subscription.remove(); };
  }, [refreshStripeStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        await Promise.all([fetchEligibility(), refreshStripeStatus()]);
      }
      appStateRef.current = nextAppState;
    });
    return () => { subscription.remove(); };
  }, [fetchEligibility, refreshStripeStatus]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleConnectStripe = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const { url } = await api.startVendorStripeOnboarding(token, STRIPE_RETURN_URL);
      if (url) Linking.openURL(url);
    } catch (error) {
      Alert.alert("Error", "Failed to connect Stripe. Please try again.");
    }
  };

  const handleManagePayouts = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setLoadingPayoutLink(true);
      const { url } = await api.getVendorStripeDashboardLink(token);
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

  const handleBlockDate = async (
    date: string,
    isFullDay: boolean,
    startTime?: string,
    endTime?: string,
    reason?: string
  ) => {
    const token = await getToken();
    if (!token) return;
    try {
      const startDate = isFullDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
      const endDate = isFullDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
      const newBlock = await api.createBlock(token, "business", {
        startAt: startDate,
        endAt: endDate,
        isFullDay,
        reason,
      } as any);
      setBlockedDates((prev) => [
        ...prev,
        { id: newBlock.id, date, isFullDay, startTime: isFullDay ? undefined : startTime, endTime: isFullDay ? undefined : endTime, reason },
      ]);
    } catch (err) {
      console.error("[Dashboard] Failed to block date:", err);
    }
  };

  const handleUnblockDate = async (blockId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteBlock(token, "business", blockId);
      setBlockedDates((prev) => prev.filter((b) => b.id !== blockId));
    } catch (err) {
      console.error("[Dashboard] Failed to unblock date:", err);
    }
  };

  const handleAutoAcceptChange = async (value: boolean) => {
    const token = await getToken();
    if (!token) return;
    const prev = autoAcceptBookings;
    setAutoAcceptBookings(value);
    setAutoAcceptLoading(true);
    try {
      await api.updateBusinessSettings(token, { autoAcceptBookings: value });
      setProfile(prev => prev ? { ...prev, autoAcceptBookings: value } : prev);
    } catch (error) {
      console.error("Failed to update auto-accept setting:", error);
      setAutoAcceptBookings(prev);
      Alert.alert("Error", "Failed to update booking settings.");
    } finally {
      setAutoAcceptLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboard(), fetchBookingsForCalendar()]);
    setRefreshing(false);
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: DASHBOARD_COLORS.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 12,
    },
    headerLeft: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: "700", color: DASHBOARD_COLORS.cream },
    headerSubtitle: { fontSize: 13, color: DASHBOARD_COLORS.creamDim, marginTop: 2 },
    backButton: { padding: 8, marginRight: 8 },
    tierBadge: {
      backgroundColor: DASHBOARD_COLORS.gold,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginLeft: 10,
      alignSelf: "flex-start",
    },
    tierBadgeText: { color: DASHBOARD_COLORS.background, fontSize: 12, fontWeight: "700" },
    stripeCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(201,147,58,0.08)",
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: DASHBOARD_COLORS.gold,
    },
    stripeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(201,147,58,0.2)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    stripeContent: { flex: 1 },
    stripeTitle: { fontSize: 16, fontWeight: "600", color: DASHBOARD_COLORS.cream },
    stripeDescription: { fontSize: 13, color: DASHBOARD_COLORS.creamDim, marginTop: 2 },
    setupLink: { fontSize: 13, fontWeight: "600", color: DASHBOARD_COLORS.gold, alignSelf: "flex-end", marginTop: 12 },
    // Stats 2×2
    statsRow: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
    statsGridRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: "#111411",
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      alignItems: "flex-start",
    },
    statValue: { fontSize: 24, fontWeight: "700", color: DASHBOARD_COLORS.cream },
    statLabel: { fontSize: 11, color: DASHBOARD_COLORS.creamDim, marginTop: 2 },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      backgroundColor: "rgba(201,147,58,0.15)",
    },
    // Section cards
    autoAcceptCard: {
      backgroundColor: DASHBOARD_COLORS.surface,
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
    },
    autoAcceptRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    autoAcceptIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "rgba(201,147,58,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    autoAcceptTextWrap: { flex: 1 },
    autoAcceptTitle: { color: DASHBOARD_COLORS.cream, fontSize: 15, fontWeight: "600", marginBottom: 2 },
    autoAcceptDescription: { color: DASHBOARD_COLORS.creamDim, fontSize: 12, lineHeight: 17 },
    // Up Next card
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
    // Activity nav cards
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
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
    emptyIcon: { width: 48, height: 48, borderRadius: 20, backgroundColor: "rgba(201,147,58,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: DASHBOARD_COLORS.cream, marginBottom: 4 },
    emptySubtitle: { fontSize: 13, color: DASHBOARD_COLORS.creamDim, textAlign: "center" },
  });

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Main", { screen: "AccountTab", params: { screen: "Account" } });
    }
  };

  const locationDisplay =
    [profile?.city, profile?.state].filter(Boolean).join(", ") || "Location not set";
  const rawTier = String(
    user?.subscriptionTier || profile?.subscriptionTier || ""
  ).toLowerCase();
  const tierLabel = rawTier.includes("pro")
    ? "Pro"
    : rawTier.includes("growth") || rawTier.includes("premium")
      ? "Growth"
      : "Starter";

  const calendarBookings: CalendarBooking[] = bookings.map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.time ? convertTo12Hour(b.time) : "9:00 AM",
    endTime: undefined,
    clientName: b.customerName || "Client",
    serviceName: b.serviceName || "Service",
    status: b.status as CalendarBooking["status"],
    amount: b.amount,
  }));

  const calendarWeeklyAvailability: DayAvailability[] = hours.map((h, idx) => ({
    dayOfWeek: idx,
    isAvailable: h.isAvailable,
    windows: h.isAvailable ? [{ startTime: h.startTime, endTime: h.endTime }] : [],
  }));

  // ─── Up Next computation ────────────────────────────────────────────────────

  const NOW = Date.now();
  const DAY_MS = 86400000;
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

  type UpNextItem = { title: string; subtext?: string; iconName: string; urgency?: "red" | "amber" | "green" };
  let upNextItem: UpNextItem | null = null;

  const p1 = upNextOrders.find((o: any) => o.status === "paid" && !o.shipment && new Date(o.orderDate).getTime() + 4 * DAY_MS < NOW);
  if (p1) {
    const orderNum = p1.id ? String(p1.id).slice(-6) : "";
    upNextItem = { title: "Overdue — ship immediately", subtext: `Order #${orderNum} · Paid ${new Date(p1.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, iconName: "package", urgency: "red" };
  }

  if (!upNextItem) {
    const p2 = upNextOrders.find((o: any) => {
      if (o.status !== "paid" || o.shipment) return false;
      const deadline = new Date(o.orderDate).getTime() + 4 * DAY_MS;
      return deadline >= NOW && deadline < NOW + 2 * DAY_MS;
    });
    if (p2) {
      const orderNum = p2.id ? String(p2.id).slice(-6) : "";
      const deadline = new Date(new Date(p2.orderDate).getTime() + 4 * DAY_MS);
      upNextItem = { title: `Order #${orderNum} — ships soon`, subtext: `Paid ${new Date(p2.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ship by ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, iconName: "package", urgency: "amber" };
    }
  }

  if (!upNextItem) {
    const p3 = bookings.find((b: any) => b.status === "confirmed" && (b.date === todayStr || b.date === tomorrowStr));
    if (p3) {
      upNextItem = { title: `${p3.serviceName} — ${p3.customerName}`, subtext: `${p3.date} at ${p3.time}`, iconName: "calendar", urgency: "green" };
    }
  }

  if (!upNextItem) {
    const pendingBks = [...bookings].filter((b: any) => b.status === "pending").sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (pendingBks.length > 0) {
      upNextItem = { title: "Booking awaiting confirmation", subtext: `Requested by ${pendingBks[0].customerName}`, iconName: "clock", urgency: "amber" };
    }
  }

  if (!upNextItem) {
    const paidUnshipped = [...upNextOrders].filter((o: any) => o.status === "paid" && !o.shipment).sort((a: any, b: any) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    if (paidUnshipped.length > 0) {
      const o = paidUnshipped[0];
      upNextItem = { title: `Order #${o.id ? String(o.id).slice(-6) : ""} — needs shipping`, subtext: `Paid ${new Date(o.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, iconName: "package" };
    }
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <ScreenKeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DASHBOARD_COLORS.gold} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={DASHBOARD_COLORS.cream} />
        </Pressable>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{profile?.name || "Business"}</Text>
          <Text style={styles.headerSubtitle}>{locationDisplay}</Text>
        </View>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{tierLabel}</Text>
        </View>
      </View>

      {/* Eligibility banner */}
      {eligibility && !eligibility.canPublishProducts && !eligibility.canPublishServices && !eligibility.requiresApproval && (
        <View style={styles.stripeCard}>
          <View style={styles.stripeIcon}>
            <Feather name="alert-circle" size={20} color={DASHBOARD_COLORS.gold} />
          </View>
          <View style={styles.stripeContent}>
            <Text style={styles.stripeTitle}>Complete Your Setup</Text>
            <Text style={styles.stripeDescription}>Add your first product or service to go live</Text>
            <Text style={styles.setupLink}>Get Started →</Text>
          </View>
        </View>
      )}

      {/* Manage Payouts banner */}
      {profile?.stripeConnected && (
        <Pressable
          onPress={handleManagePayouts}
          disabled={loadingPayoutLink}
          style={[styles.stripeCard, { opacity: loadingPayoutLink ? 0.7 : 1 }]}
        >
          <View style={styles.stripeIcon}>
            <Feather name="dollar-sign" size={20} color={DASHBOARD_COLORS.gold} />
          </View>
          <View style={styles.stripeContent}>
            <Text style={styles.stripeTitle}>Manage Payouts</Text>
            <Text style={styles.stripeDescription}>View your balance and payout history</Text>
          </View>
          {loadingPayoutLink ? (
            <ActivityIndicator size="small" color={DASHBOARD_COLORS.gold} />
          ) : (
            <Feather name="chevron-right" size={20} color={DASHBOARD_COLORS.gold} />
          )}
        </Pressable>
      )}

      {/* Stats 2×2 grid */}
      <View style={styles.statsRow}>
        <View style={styles.statsGridRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Feather name="dollar-sign" size={14} color={DASHBOARD_COLORS.gold} />
            </View>
            <Text style={styles.statValue}>${stats.earnings}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Feather name="shopping-bag" size={14} color={DASHBOARD_COLORS.gold} />
            </View>
            <Text style={styles.statValue}>{stats.upcomingOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
        </View>
        <View style={[styles.statsGridRow, { marginTop: 10 }]}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Feather name="calendar" size={14} color={DASHBOARD_COLORS.gold} />
            </View>
            <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Feather name="star" size={14} color={DASHBOARD_COLORS.gold} />
            </View>
            <Text style={styles.statValue}>{stats.reviewCount > 0 ? stats.rating.toFixed(1) : "—"}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </View>

      {/* Team — multi-staff only */}
      {profile?.isMultiStaff && (
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <SectionLabel text="TEAM" />
          <View style={styles.autoAcceptCard}>
            <View style={styles.autoAcceptRow}>
              <View style={styles.autoAcceptIcon}>
                <Feather name="users" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.autoAcceptTextWrap}>
                <Text style={styles.autoAcceptTitle}>Staff Seats</Text>
                <Text
                  style={[
                    styles.autoAcceptDescription,
                    seatStatus && seatStatus.maxStaff !== null && seatStatus.activeCount >= seatStatus.maxStaff
                      ? { color: "#FF3B30" }
                      : null,
                  ]}
                >
                  {seatStatus
                    ? seatStatus.maxStaff === null
                      ? `${seatStatus.activeCount} seat${seatStatus.activeCount === 1 ? "" : "s"} used · Unlimited on ${seatStatus.tierName}`
                      : `${seatStatus.activeCount} of ${seatStatus.maxStaff} seats used · ${seatStatus.tierName}`
                    : "Loading seat usage…"}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => navigation.navigate("StaffManagement")}>
              <Text style={styles.setupLink}>Manage Team →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Booking Settings — service-based only */}
      {(businessType === "service" || businessType === "both") && (
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <SectionLabel text="BOOKING SETTINGS" />
          <View style={styles.autoAcceptCard}>
            <View style={styles.autoAcceptRow}>
              <View style={styles.autoAcceptIcon}>
                <Feather name={autoAcceptBookings ? "check-circle" : "clock"} size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.autoAcceptTextWrap}>
                <Text style={styles.autoAcceptTitle}>Auto-Accept Bookings</Text>
                <Text style={styles.autoAcceptDescription}>
                  {autoAcceptBookings
                    ? "New bookings are confirmed immediately after payment"
                    : "New bookings require your approval within 24 hours"}
                </Text>
              </View>
              {autoAcceptLoading ? (
                <ActivityIndicator size="small" color={DASHBOARD_COLORS.gold} />
              ) : (
                <Switch
                  value={autoAcceptBookings}
                  onValueChange={handleAutoAcceptChange}
                  trackColor={{ false: "rgba(255,255,255,0.2)", true: "rgba(201,147,58,0.55)" }}
                  thumbColor={autoAcceptBookings ? DASHBOARD_COLORS.gold : DASHBOARD_COLORS.creamDim}
                />
              )}
            </View>
          </View>
        </View>
      )}

      {/* Calendar preview — service-based only */}
      {(businessType === "service" || businessType === "both") && (
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <SectionLabel text="CALENDAR" />
          <Pressable onPress={() => navigation.navigate("DashboardCalendarScreen")}>
            <ProviderCalendar
              bookings={calendarBookings}
              blockedDates={blockedDates}
              weeklyAvailability={calendarWeeklyAvailability}
              onBlockDate={handleBlockDate}
              onUnblockDate={handleUnblockDate}
              onBookingPress={() => navigation.navigate("DashboardBookingsScreen")}
              monthsAhead={3}
            />
          </Pressable>
        </View>
      )}

      {/* Up Next card */}
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

      {/* Activity nav cards */}
      <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
        <SectionLabel text="ACTIVITY" />

        {(businessType === "product" || businessType === "both") && (
          <Pressable style={styles.navCard} onPress={() => navigation.navigate("DashboardOrdersScreen")}>
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
                <Feather name="shopping-bag" size={20} color={DASHBOARD_COLORS.gold} />
              </View>
              <View style={styles.navCardTextWrap}>
                <Text style={styles.navCardTitle}>Orders</Text>
                <Text style={styles.navCardSubtitle}>{stats.upcomingOrders} need attention</Text>
              </View>
            </View>
            <View style={styles.navCardRight}>
              {stats.upcomingOrders > 0 && (
                <View style={[styles.navBadge, { backgroundColor: "rgba(232,93,93,0.15)" }]}>
                  <Text style={[styles.navBadgeText, { color: "#E85D5D" }]}>{stats.upcomingOrders}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
            </View>
          </Pressable>
        )}

        {(businessType === "service" || businessType === "both") && (
          <Pressable style={styles.navCard} onPress={() => navigation.navigate("DashboardBookingsScreen")}>
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
        )}

        <Pressable style={styles.navCard} onPress={() => navigation.navigate("DashboardCreditsScreen")}>
          <View style={styles.navCardLeft}>
            <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
              <Feather name="star" size={20} color={DASHBOARD_COLORS.gold} />
            </View>
            <View style={styles.navCardTextWrap}>
              <Text style={styles.navCardTitle}>Credits</Text>
              <Text style={styles.navCardSubtitle}>Production shoot credits</Text>
            </View>
          </View>
          <View style={styles.navCardRight}>
            {creditBalance > 0 && (
              <View style={[styles.navBadge, { backgroundColor: "rgba(201,147,58,0.15)" }]}>
                <Text style={[styles.navBadgeText, { color: DASHBOARD_COLORS.gold }]}>{creditBalance}</Text>
              </View>
            )}
            <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
          </View>
        </Pressable>

        <Pressable style={styles.navCard} onPress={() => navigation.navigate("DashboardAnalytics")}>
          <View style={styles.navCardLeft}>
            <View style={[styles.navCardIconBg, { backgroundColor: "rgba(201,147,58,0.12)" }]}>
              <Ionicons name="bar-chart-outline" size={20} color={DASHBOARD_COLORS.gold} />
            </View>
            <View style={styles.navCardTextWrap}>
              <Text style={styles.navCardTitle}>Analytics</Text>
              <Text style={styles.navCardSubtitle}>Track your growth & insights</Text>
            </View>
          </View>
          <View style={styles.navCardRight}>
            <Feather name="chevron-right" size={18} color={DASHBOARD_COLORS.creamDim} />
          </View>
        </Pressable>
      </View>

      <View style={{ height: insets.bottom + 20 }} />

      <BusinessEligibilityGate
        eligibility={eligibility}
        onRefreshEligibility={fetchEligibility}
      />
    </ScreenKeyboardAwareScrollView>
  );
}

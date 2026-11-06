import React, { useState, useEffect, useCallback, useMemo, useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  BackHandler,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { AdminStats, AdminUser, AdminBusiness, AdminPhotographer, AdminInfluencer, AdminOrder, AdminBooking, AdminConversation } from "@/services/api";
import { RootStackParamList, AdminSection } from "@/navigation/types";

type TabType = AdminSection;
type StatusFilter = "pending" | "approved" | "rejected" | "all";
// Refunds is hidden until the refund request routes are decided (vault open decision 2, R33).
type PaymentSubTab = "orders" | "bookings";

// Admin home rows, in the order shown. Pending work first.
const SECTIONS: { key: TabType; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "businesses", label: "Businesses", sub: "Applications, approve or reject", icon: "briefcase" },
  { key: "users", label: "Users", sub: "Find, disable or enable accounts", icon: "users" },
  { key: "photographers", label: "Photographers", sub: "Visibility, ban, deletion", icon: "camera" },
  { key: "payments", label: "Payments", sub: "Revenue, orders and bookings", icon: "credit-card" },
  { key: "influencers", label: "Influencers", sub: "Review applications", icon: "trending-up" },
  { key: "messages", label: "Messages", sub: "All conversations", icon: "message-square" },
];

const sectionLabels = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label])) as Record<TabType, string>;

// "Nov 5, 2026" from an ISO date; null when missing or unreadable so the row hides the line.
const formatAppliedDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  // A bare "YYYY-MM-DD" would parse as UTC midnight and show the day before in US time zones.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getBusinessStatus = (business: AdminBusiness): "pending" | "approved" | "rejected" => {
  return business.approvalStatus || business.status || "pending";
};

export default function AdminDashboardScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AdminDashboard">>();
  const { getToken, isLoading: authLoading } = useAuth();

  // Outsyde brand v1 tokens (constants/theme.ts), light and dark. Dim text is cream at 70%
  // (brandTextDim is too faint for 12px labels in dark). Gold text uses goldDim in light mode
  // so it stays readable on white; icons and badges use brandGold.
  const C = useMemo(() => ({
    bg: theme.brandBg,
    card: theme.brandBgElevated,
    border: theme.brandSurfaceBorder,
    text: theme.brandCream,
    dim: theme.brandCream + "B3",
    gold: theme.brandGold,
    goldText: isDark ? theme.brandGold : theme.brandGoldDim,
    onGold: isDark ? theme.brandBg : theme.brandCream, // dark text on a gold fill, both modes
    primary: theme.brandPrimary,
    primaryText: theme.brandPrimaryText,
    success: theme.brandSuccess,
    pending: theme.brandPending,
    error: theme.brandError,
  }), [theme, isDark]);

  // null = Admin home. A section opens on its own with a back arrow to home.
  const [activeTab, setActiveTab] = useState<TabType | null>(route.params?.section ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<AdminStats>({ users: 0, businesses: 0, photographers: 0, orders: 0, bookings: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [photographers, setPhotographers] = useState<AdminPhotographer[]>([]);
  const [influencers, setInfluencers] = useState<AdminInfluencer[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);

  const [businessFilter, setBusinessFilter] = useState<StatusFilter>("all");
  const [influencerFilter, setInfluencerFilter] = useState<StatusFilter>("pending");
  const [paymentSubTab, setPaymentSubTab] = useState<PaymentSubTab>("orders");
  const [selectedConversation, setSelectedConversation] = useState<AdminConversation | null>(null);
  const [pendingBusinessCount, setPendingBusinessCount] = useState(0);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    
    try {
      setLoading(true);
      const [statsData, pendingBusinessesResponse] = await Promise.all([
        api.getAdminStats(token),
        api.getAdminBusinesses(token, "pending"),
      ]);
      setStats(statsData);
      let pendingList: unknown[] = [];
      if (Array.isArray(pendingBusinessesResponse)) {
        pendingList = pendingBusinessesResponse;
      } else if (pendingBusinessesResponse && typeof pendingBusinessesResponse === 'object') {
        const nested = pendingBusinessesResponse as Record<string, unknown>;
        if (Array.isArray(nested.businesses)) {
          pendingList = nested.businesses;
        } else if (Array.isArray(nested.data)) {
          pendingList = nested.data;
        }
      }
      setPendingBusinessCount(pendingList.length);
    } catch (error) {
      console.error("Failed to fetch admin stats:", error);
      setStats({ users: 0, businesses: 0, photographers: 0, orders: 0, bookings: 0 });
      setPendingBusinessCount(0);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchTabData = useCallback(async () => {
    if (!activeTab) return; // Admin home only needs fetchData (stats + pending count).
    const token = await getToken();
    if (!token) return;

    try {
      switch (activeTab) {
        case "users":
          const usersData = await api.getAdminUsers(token);
          setUsers(usersData || []);
          break;
        case "businesses":
          const statusParam = businessFilter !== "all" ? businessFilter : undefined;
          const businessesData = await api.getAdminBusinesses(token, statusParam, searchQuery || undefined);
          console.log("[AdminDashboard] Businesses API response:", JSON.stringify(businessesData)?.slice(0, 500));
          let businessesList: AdminBusiness[] = [];
          if (Array.isArray(businessesData)) {
            businessesList = businessesData;
          } else if (businessesData && typeof businessesData === 'object') {
            const nested = businessesData as Record<string, unknown>;
            if (Array.isArray(nested.businesses)) {
              businessesList = nested.businesses as AdminBusiness[];
            } else if (Array.isArray(nested.data)) {
              businessesList = nested.data as AdminBusiness[];
            }
          }
          setBusinesses(businessesList);
          break;
        case "photographers":
          const photographersData = await api.getAdminPhotographers(token, searchQuery || undefined);
          if (photographersData && photographersData.length > 0) {
            console.log("[AdminDashboard] First photographer item:", JSON.stringify(photographersData[0]));
          }
          setPhotographers(photographersData || []);
          break;
        case "influencers":
          const influencerStatusParam = influencerFilter !== "all" ? influencerFilter : undefined;
          const influencersData = await api.getAdminInfluencers(token, influencerStatusParam);
          setInfluencers(influencersData || []);
          break;
        case "payments":
          // The header numbers come from /api/admin/stats (loaded in fetchData). One failing
          // list must not blank the other.
          const settled = await Promise.allSettled([
            api.getAdminOrders(token),
            api.getAdminBookings(token),
          ]);
          const valueOf = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);
          setOrders(valueOf(settled[0]) || []);
          setBookings(valueOf(settled[1]) || []);
          break;
        case "messages":
          const conversationsData = await api.getAdminConversations(token);
          setConversations(conversationsData || []);
          break;
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} data:`, error);
    }
  }, [getToken, activeTab, searchQuery, businessFilter, influencerFilter]);

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading, fetchData]);

  useEffect(() => {
    if (authLoading) return;
    fetchTabData();
  }, [authLoading, fetchTabData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchTabData()]);
    setRefreshing(false);
  };

  const openSection = useCallback((key: TabType) => {
    setSearchQuery("");
    setActiveTab(key);
  }, []);

  const goHome = useCallback(() => {
    setSearchQuery("");
    setActiveTab(null);
  }, []);

  // One header bar (RootNavigator sets the X to close): "Admin" on home, the section name with
  // a back arrow inside a section.
  useLayoutEffect(() => {
    const label = activeTab ? sectionLabels[activeTab] : "Admin";
    navigation.setOptions({
      headerTitle: label,
      headerTintColor: C.text,
      headerStyle: { backgroundColor: C.bg },
      headerLeft: activeTab
        ? () => (
            <Pressable
              onPress={goHome}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Back to Admin"
            >
              <Feather name="arrow-left" size={24} color={C.text} />
            </Pressable>
          )
        : () => null,
    });
  }, [navigation, activeTab, C, goHome]);

  // Android back from a section returns to Admin home instead of closing the admin.
  useEffect(() => {
    if (!activeTab) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goHome();
      return true;
    });
    return () => sub.remove();
  }, [activeTab, goHome]);

  // Coming back from a detail screen (business review, user, photographer, influencer) reloads
  // the counts and the open section, so a badge drops right after an approve. Skips the first
  // focus because the effects above already load on open.
  // The callback stays stable (a changing callback would re-run on every search keystroke);
  // it reads the latest loaders from a ref.
  const hasFocusedOnce = useRef(false);
  const latest = useRef({ authLoading, fetchData, fetchTabData });
  useEffect(() => {
    latest.current = { authLoading, fetchData, fetchTabData };
  }, [authLoading, fetchData, fetchTabData]);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      if (latest.current.authLoading) return;
      latest.current.fetchData();
      latest.current.fetchTabData();
    }, [])
  );

  const handleApprove = async (type: "business" | "influencer", id: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      console.log(`[AdminDashboard] Approving ${type} with id: ${id}`);
      await api.approveApplication(token, type, id);
      Alert.alert("Success", `${type === "business" ? "Business" : "Influencer"} approved successfully`);
      fetchTabData();
    } catch (error: any) {
      console.log("[AdminDashboard] Approve error:", error?.message || error);
      const errorMessage = error?.message?.toLowerCase() || "";
      if (errorMessage.includes("already approved")) {
        Alert.alert("Already Approved", "This business has already been approved.");
        fetchTabData();
      } else if (errorMessage.includes("already rejected")) {
        Alert.alert("Already Rejected", "This business has already been rejected.");
        fetchTabData();
      } else {
        Alert.alert("Error", `Failed to approve application: ${error?.message || "Unknown error"}`);
      }
    }
  };

  // Reject always goes through the review / detail screen, where a typed reason is required and
  // saved (the quick buttons used to send a canned reason, or drop it for influencers).
  const navigateToUserDetail = useCallback((userId: string) => {
    if (!userId) {
      console.warn("[Admin] navigateToUserDetail called without userId");
      return;
    }
    console.log("[Admin] Navigating to user detail:", userId);
    navigation.navigate("AdminUserDetail", { userId });
  }, [navigation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
    },
    homeContent: {
      padding: 16,
      paddingBottom: insets.bottom + 40,
      gap: 16,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statTile: {
      flexBasis: "30%",
      flexGrow: 1,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      padding: 12,
    },
    statTileValue: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
      fontVariant: ["tabular-nums"],
    },
    statTileLabel: {
      fontSize: 13,
      color: C.dim,
      marginTop: 2,
    },
    needsCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.primary,
      borderRadius: 14,
      padding: 14,
    },
    needsIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.gold + "2E",
      alignItems: "center",
      justifyContent: "center",
    },
    needsText: {
      flex: 1,
      minWidth: 0,
    },
    needsTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: C.primaryText,
    },
    needsSub: {
      fontSize: 13,
      color: C.primaryText + "BF",
      marginTop: 2,
    },
    needsButton: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: C.gold,
      alignItems: "center",
      justifyContent: "center",
    },
    needsButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: C.onGold,
    },
    sectionHeading: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: C.dim,
      marginTop: 4,
    },
    sectionList: {
      gap: 8,
    },
    sectionRow: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
    },
    sectionRowPressed: {
      opacity: 0.7,
    },
    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: C.gold + "1F",
      alignItems: "center",
      justifyContent: "center",
    },
    sectionText: {
      flex: 1,
      minWidth: 0,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: C.text,
    },
    sectionSub: {
      fontSize: 13,
      color: C.dim,
      marginTop: 1,
    },
    rowBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 11,
      backgroundColor: C.gold,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.onGold,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.card,
      borderRadius: 10,
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: C.text,
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      marginBottom: 8,
      gap: 6,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: "transparent",
    },
    activeFilterChip: {
      backgroundColor: C.gold + "20",
      borderColor: C.gold,
    },
    filterText: {
      fontSize: 12,
      color: C.dim,
      fontWeight: "500",
    },
    activeFilterText: {
      color: C.goldText,
    },
    countBadge: {
      marginLeft: 12,
      marginBottom: 6,
      fontSize: 12,
      color: C.dim,
    },
    contentArea: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 12,
      paddingBottom: 40,
    },
    content: {
      flex: 1,
      paddingHorizontal: 12,
    },
    listItem: {
      backgroundColor: C.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    cardTouchArea: {
      flex: 1,
    },
    listItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 6,
    },
    listItemName: {
      fontSize: 16,
      fontWeight: "600",
      color: C.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    pendingBadge: {
      backgroundColor: C.pending + "30",
    },
    approvedBadge: {
      backgroundColor: C.success + "30",
    },
    rejectedBadge: {
      backgroundColor: C.error + "30",
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
    },
    pendingText: {
      color: C.pending,
    },
    approvedText: {
      color: C.success,
    },
    rejectedText: {
      color: C.error,
    },
    pendingCountBadge: {
      backgroundColor: C.gold,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
    },
    pendingCountText: {
      color: C.onGold,
      fontSize: 11,
      fontWeight: "700",
    },
    listItemInfo: {
      fontSize: 13,
      color: C.dim,
      marginBottom: 2,
    },
    actionRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 10,
      gap: 10,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    approveButton: {
      backgroundColor: C.success + "20",
    },
    rejectButton: {
      backgroundColor: C.error + "20",
    },
    viewDetailsButton: {
      backgroundColor: `${C.gold}20`,
    },
    viewDetailsButtonText: {
      color: C.goldText,
      fontSize: 13,
      fontWeight: "600",
    },
    approveButtonText: {
      color: C.success,
      fontSize: 13,
      fontWeight: "600",
    },
    rejectButtonText: {
      color: C.error,
      fontSize: 13,
      fontWeight: "600",
    },
    paymentStatsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 0,
      marginBottom: 16,
      gap: 8,
    },
    paymentStatCard: {
      width: "48%",
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      padding: 14,
    },
    revenueCard: {
      width: "100%",
      backgroundColor: C.primary,
      borderRadius: 14,
      padding: 16,
    },
    revenueLabel: {
      fontSize: 13,
      color: C.primaryText + "CC",
    },
    revenueValue: {
      fontSize: 30,
      fontWeight: "700",
      color: isDark ? C.gold : C.primaryText,
      fontVariant: ["tabular-nums"],
      marginVertical: 4,
    },
    revenueNote: {
      fontSize: 13,
      color: C.primaryText + "BF",
    },
    paymentStatLabel: {
      fontSize: 12,
      color: C.dim,
      marginBottom: 4,
    },
    paymentStatValue: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
    },
    subTabRow: {
      flexDirection: "row",
      marginBottom: 12,
      gap: 8,
    },
    subTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: C.card,
    },
    activeSubTab: {
      backgroundColor: C.gold + "20",
    },
    subTabText: {
      fontSize: 13,
      color: C.dim,
      fontWeight: "500",
    },
    activeSubTabText: {
      color: C.goldText,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyIcon: {
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: C.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 14,
      color: C.dim,
      textAlign: "center",
    },
    messagesContainer: {
      flex: 1,
      flexDirection: "row",
    },
    conversationList: {
      width: "40%",
      borderRightWidth: 1,
      borderRightColor: C.border,
    },
    conversationListHeader: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    conversationListTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: C.text,
    },
    conversationCount: {
      fontSize: 12,
      color: C.dim,
      marginTop: 2,
    },
    conversationItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    selectedConversation: {
      backgroundColor: C.gold + "10",
    },
    conversationName: {
      fontSize: 14,
      fontWeight: "600",
      color: C.text,
      marginBottom: 4,
    },
    conversationPreview: {
      fontSize: 12,
      color: C.dim,
    },
    messagePreviewContainer: {
      flex: 1,
      padding: 16,
    },
    messagePreviewHeader: {
      fontSize: 18,
      fontWeight: "600",
      color: C.text,
      marginBottom: 8,
    },
    messagePreviewEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    messagePreviewEmptyText: {
      fontSize: 14,
      color: C.dim,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  const renderHome = () => {
    const tiles: { label: string; value: string }[] = [
      { label: "Users", value: String(stats.users) },
      { label: "Businesses", value: String(stats.businesses) },
      { label: "Photographers", value: String(stats.photographers) },
      { label: "Orders", value: String(stats.orders) },
      { label: "Bookings", value: String(stats.bookings) },
      { label: "Revenue", value: `$${Math.round(stats.revenue ?? 0).toLocaleString("en-US")}` },
    ];
    return (
      <ScrollView
        contentContainerStyle={styles.homeContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
      >
        <View style={styles.statGrid}>
          {tiles.map((s) => (
            <View key={s.label} style={styles.statTile} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
              <Text style={styles.statTileValue}>{s.value}</Text>
              <Text style={styles.statTileLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {pendingBusinessCount > 0 ? (
          <View style={styles.needsCard}>
            <View style={styles.needsIcon}>
              <Feather name="clock" size={18} color={C.gold} />
            </View>
            <View style={styles.needsText}>
              <Text style={styles.needsTitle}>
                {pendingBusinessCount === 1
                  ? "1 business application waiting"
                  : `${pendingBusinessCount} business applications waiting`}
              </Text>
              <Text style={styles.needsSub}>Approve or reject from Businesses</Text>
            </View>
            <Pressable
              style={styles.needsButton}
              accessibilityRole="button"
              accessibilityLabel="Review pending business applications"
              onPress={() => {
                setBusinessFilter("pending");
                openSection("businesses");
              }}
            >
              <Text style={styles.needsButtonText}>Review</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionHeading} accessibilityRole="header">Manage</Text>
        <View style={styles.sectionList}>
          {SECTIONS.map((s) => {
            const badge = s.key === "businesses" ? pendingBusinessCount : 0;
            return (
              <Pressable
                key={s.key}
                style={({ pressed }) => [styles.sectionRow, pressed && styles.sectionRowPressed]}
                onPress={() => openSection(s.key)}
                accessibilityRole="button"
                accessibilityLabel={badge > 0 ? `${s.label}, ${badge} pending` : s.label}
                accessibilityHint={s.sub}
              >
                <View style={styles.sectionIcon}>
                  <Feather name={s.icon} size={17} color={C.gold} />
                </View>
                <View style={styles.sectionText}>
                  <Text style={styles.sectionTitle}>{s.label}</Text>
                  <Text style={styles.sectionSub}>{s.sub}</Text>
                </View>
                {badge > 0 ? (
                  <View style={styles.rowBadge}>
                    <Text style={styles.rowBadgeText}>{badge}</Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={18} color={C.dim} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderSearchBar = () => {
    if (!activeTab || activeTab === "messages" || activeTab === "payments") return null;
    
    const placeholders: Record<TabType, string> = {
      users: "Search users by name or email...",
      businesses: "Search businesses...",
      photographers: "Search photographers...",
      influencers: "Search influencers...",
      payments: "",
      messages: "",
    };

    return (
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={C.dim} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholders[activeTab]}
          placeholderTextColor={C.dim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={C.dim} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderStatusFilter = (currentFilter: StatusFilter, setFilter: (f: StatusFilter) => void) => (
    <View style={styles.filterRow}>
      {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((status) => (
        <Pressable
          key={status}
          style={[styles.filterChip, currentFilter === status && styles.activeFilterChip]}
          onPress={() => setFilter(status)}
        >
          <Text style={[styles.filterText, currentFilter === status && styles.activeFilterText]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderEmptyState = (title: string, subtitle: string, icon: keyof typeof Feather.glyphMap) => (
    <View style={styles.emptyState}>
      <Feather name={icon} size={48} color={C.dim} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderUserItem = ({ item }: { item: AdminUser }) => (
    <TouchableOpacity
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={() => {
        console.log("[Admin] Tapped user:", item.id, item.name);
        navigateToUserDetail(item.id);
      }}
    >
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>{item.name}</Text>
        <View style={[styles.statusBadge, item.status === "active" ? styles.approvedBadge : styles.rejectedBadge]}>
          <Text style={[styles.statusText, item.status === "active" ? styles.approvedText : styles.rejectedText]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.listItemInfo}>{item.email}</Text>
      {item.username ? <Text style={styles.listItemInfo}>@{item.username}</Text> : null}
      <Text style={styles.listItemInfo}>Account: {item.accountType}</Text>
    </TouchableOpacity>
  );

  const renderBusinessItem = useCallback(({ item }: { item: AdminBusiness }) => {
    const status = getBusinessStatus(item);
    
    const navigateToDetail = () => {
      navigation.navigate("AdminBusinessReview", { businessId: item.id });
    };
    
    return (
      <TouchableOpacity 
        style={styles.listItem}
        activeOpacity={0.7}
        onPress={navigateToDetail}
      >
        <View style={styles.listItemHeader}>
          <Text style={styles.listItemName}>{item.name}</Text>
          <View style={[
            styles.statusBadge,
            status === "pending" ? styles.pendingBadge :
            status === "approved" ? styles.approvedBadge : styles.rejectedBadge
          ]}>
            <Text style={[
              styles.statusText,
              status === "pending" ? styles.pendingText :
              status === "approved" ? styles.approvedText : styles.rejectedText
            ]}>
              {status}
            </Text>
          </View>
        </View>
        <Text style={styles.listItemInfo}>{item.category}</Text>
        <Text style={styles.listItemInfo}>{item.city}, {item.state}</Text>
        {item.email ? <Text style={styles.listItemInfo}>{item.email}</Text> : null}
        {item.earnings !== undefined ? (
          <Text style={styles.listItemInfo}>Earnings: ${item.earnings.toFixed(2)}</Text>
        ) : null}
        <View style={styles.actionRow} pointerEvents="box-none">
          <TouchableOpacity 
            style={[styles.actionButton, styles.viewDetailsButton]} 
            activeOpacity={0.7}
            onPress={navigateToDetail}
          >
            <Feather name="eye" size={14} color={C.gold} />
            <Text style={styles.viewDetailsButtonText}>View Details</Text>
          </TouchableOpacity>
          {status === "pending" ? (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.approveButton]} 
                activeOpacity={0.7}
                onPress={() => handleApprove("business", item.id)}
              >
                <Feather name="check" size={14} color={C.success} />
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.rejectButton]} 
                activeOpacity={0.7}
                onPress={() => navigation.navigate("AdminBusinessReview", { businessId: item.id })}
              >
                <Feather name="x" size={14} color={C.error} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [styles, C, navigation, handleApprove]);

  const businessKeyExtractor = useCallback((item: AdminBusiness) => item.id, []);

  const filteredBusinesses = useMemo(() => {
    if (businessFilter === "all") return businesses;
    return businesses.filter(b => getBusinessStatus(b) === businessFilter);
  }, [businesses, businessFilter]);

  const BusinessListHeader = useMemo(() => (
    <View>
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={C.dim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search businesses..."
          placeholderTextColor={C.dim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={C.dim} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filterRow}>
        {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((status) => (
          <Pressable
            key={status}
            style={[styles.filterChip, businessFilter === status && styles.activeFilterChip]}
            onPress={() => setBusinessFilter(status)}
          >
            <Text style={[styles.filterText, businessFilter === status && styles.activeFilterText]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.countBadge}>{filteredBusinesses.length} businesses</Text>
    </View>
  ), [styles, C, searchQuery, businessFilter, filteredBusinesses.length]);

  const BusinessEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Feather name="briefcase" size={48} color={C.dim} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No Businesses</Text>
      <Text style={styles.emptySubtitle}>No businesses found</Text>
    </View>
  ), [styles, C]);

  const renderPhotographerItem = ({ item }: { item: AdminPhotographer }) => {
    const displayName = item.displayName || item.name || "(No Name)";
    const location = item.city && item.state ? `${item.city}, ${item.state}` : item.city || item.state || null;
    const specialties = item.specialtyLabels?.length ? item.specialtyLabels.join(", ") : item.specialty;
    const email = item.ownerEmail || item.email;
    const phone = item.ownerPhone || item.phone;
    const flags = [
      item.visibilityStatus && item.visibilityStatus !== "public" ? (item.visibilityStatus === "flagged" ? "Flagged" : "Hidden") : null,
      item.ownerIsActive === false ? "Banned" : null,
      item.ownerDeletionStatus === "pending_deletion" ? "Deletion scheduled" : null,
    ].filter(Boolean).join(" · ");
    return (
      // The id here is the photographer's, not the user's: open the photographer detail screen.
      <Pressable style={styles.listItem} onPress={() => navigation.navigate("AdminPhotographerDetail", { photographerId: item.id })}>
        <Text style={styles.listItemName}>{displayName}</Text>
        {flags ? <Text style={[styles.listItemInfo, { color: C.error, fontWeight: "600" }]}>{flags}</Text> : null}
        {specialties ? <Text style={styles.listItemInfo}>{specialties}</Text> : null}
        {location ? <Text style={styles.listItemInfo}>{location}</Text> : null}
        {email ? <Text style={styles.listItemInfo}>{email}</Text> : null}
        {phone ? <Text style={styles.listItemInfo}>{phone}</Text> : null}
        {item.earnings !== undefined ? (
          <Text style={styles.listItemInfo}>Earnings: ${item.earnings.toFixed(2)}</Text>
        ) : null}
      </Pressable>
    );
  };

  // The backend list ignores the search text, so photographers are filtered here.
  const photographerQuery = searchQuery.trim().toLowerCase();
  const filteredPhotographers = photographerQuery
    ? photographers.filter((p) =>
        [p.displayName, p.name, p.ownerName, p.ownerEmail, p.email, p.ownerPhone, p.phone, p.ownerUsername, p.city, p.state, ...(p.specialtyLabels ?? [])]
          .some((v) => typeof v === "string" && v.toLowerCase().includes(photographerQuery)),
      )
    : photographers;

  const renderInfluencerItem = ({ item }: { item: AdminInfluencer }) => (
    <Pressable style={styles.listItem} onPress={() => navigation.navigate("AdminInfluencerDetail", { applicationId: item.id })}>
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>{item.name}</Text>
        <View style={[
          styles.statusBadge,
          item.status === "pending" ? styles.pendingBadge :
          item.status === "approved" ? styles.approvedBadge : styles.rejectedBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.status === "pending" ? styles.pendingText :
            item.status === "approved" ? styles.approvedText : styles.rejectedText
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
      {item.email ? <Text style={styles.listItemInfo}>{item.email}</Text> : null}
      {item.phone ? <Text style={styles.listItemInfo}>{item.phone}</Text> : null}
      {[item.instagram && "Instagram", item.tiktok && "TikTok", item.youtube && "YouTube", item.twitter && "X"].filter(Boolean).length ? (
        <Text style={styles.listItemInfo}>{[item.instagram && "Instagram", item.tiktok && "TikTok", item.youtube && "YouTube", item.twitter && "X"].filter(Boolean).join(", ")}</Text>
      ) : null}
      {typeof item.followers === "number" ? <Text style={styles.listItemInfo}>{item.followers.toLocaleString()} followers</Text> : null}
      {item.contentCategoryLabels?.length ? <Text style={styles.listItemInfo}>{item.contentCategoryLabels.join(", ")}</Text> : null}
      {item.status === "pending" ? (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionButton, styles.approveButton]} onPress={() => handleApprove("influencer", item.id)}>
            <Feather name="check" size={14} color={C.success} />
            <Text style={styles.approveButtonText}>Approve</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => navigation.navigate("AdminInfluencerDetail", { applicationId: item.id })}>
            <Feather name="x" size={14} color={C.error} />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );

  const renderOrderItem = ({ item }: { item: AdminOrder }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>Order {item.orderNumber != null ? `#${String(item.orderNumber).padStart(4, '0')}` : `#${item.id.slice(0, 8)}`}</Text>
        <View style={[
          styles.statusBadge,
          item.status === "pending" ? styles.pendingBadge :
          item.status === "completed" ? styles.approvedBadge : styles.rejectedBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.status === "pending" ? styles.pendingText :
            item.status === "completed" ? styles.approvedText : styles.rejectedText
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.listItemInfo}>Customer: {item.userName}</Text>
      <Text style={styles.listItemInfo}>Business: {item.businessName}</Text>
      <Text style={styles.listItemInfo}>Amount: ${item.amount.toFixed(2)}</Text>
      {(item.discountAmountCents ?? 0) > 0 && (
        <Text style={styles.listItemInfo}>{`Outsyde rewards used: $${((item.discountAmountCents ?? 0) / 100).toFixed(2)}`}</Text>
      )}
    </View>
  );

  const renderBookingItem = ({ item }: { item: AdminBooking }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>Booking {item.bookingNumber != null ? `#S${String(item.bookingNumber).padStart(4, '0')}` : `#${item.id.slice(0, 8)}`}</Text>
        <View style={[
          styles.statusBadge,
          item.status === "pending" ? styles.pendingBadge :
          item.status === "confirmed" || item.status === "completed" ? styles.approvedBadge : styles.rejectedBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.status === "pending" ? styles.pendingText :
            item.status === "confirmed" || item.status === "completed" ? styles.approvedText : styles.rejectedText
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.listItemInfo}>Customer: {item.userName}</Text>
      <Text style={styles.listItemInfo}>Photographer: {item.photographerName}</Text>
      <Text style={styles.listItemInfo}>Date: {new Date(item.date).toLocaleDateString()}</Text>
      <Text style={styles.listItemInfo}>Amount: ${item.amount.toFixed(2)}</Text>
      {(item.discountAmountCents ?? 0) > 0 && (
        <Text style={styles.listItemInfo}>{`Outsyde rewards used: $${((item.discountAmountCents ?? 0) / 100).toFixed(2)}`}</Text>
      )}
    </View>
  );

  const renderPaymentsContent = () => (
    <View style={styles.content}>
      <View style={styles.paymentStatsRow}>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total revenue</Text>
          <Text style={styles.revenueValue}>${(stats.revenue ?? 0).toFixed(2)}</Text>
          <Text style={styles.revenueNote}>Paid orders and bookings through Outsyde, all time</Text>
        </View>
        <View style={styles.paymentStatCard}>
          <Feather name="shopping-bag" size={20} color={C.gold} />
          <Text style={styles.paymentStatLabel}>Total Orders</Text>
          <Text style={styles.paymentStatValue}>{stats.orders}</Text>
        </View>
        <View style={styles.paymentStatCard}>
          <Feather name="calendar" size={20} color={C.gold} />
          <Text style={styles.paymentStatLabel}>Total Bookings</Text>
          <Text style={styles.paymentStatValue}>{stats.bookings}</Text>
        </View>
      </View>

      <View style={styles.subTabRow}>
        {(["orders", "bookings"] as PaymentSubTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.subTab, paymentSubTab === tab && styles.activeSubTab]}
            onPress={() => setPaymentSubTab(tab)}
          >
            <Text style={[styles.subTabText, paymentSubTab === tab && styles.activeSubTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({
                tab === "orders" ? orders.length : bookings.length
              })
            </Text>
          </Pressable>
        ))}
      </View>

      {paymentSubTab === "orders" ? (
        orders.length === 0 
          ? renderEmptyState("No Orders", "No orders to display", "shopping-bag")
          : <FlatList data={orders} renderItem={renderOrderItem} keyExtractor={(item) => item.id} />
      ) : null}
      {paymentSubTab === "bookings" ? (
        bookings.length === 0 
          ? renderEmptyState("No Bookings", "No bookings to display", "calendar")
          : <FlatList data={bookings} renderItem={renderBookingItem} keyExtractor={(item) => item.id} />
      ) : null}
    </View>
  );

  const renderMessagesContent = () => (
    <View style={styles.messagesContainer}>
      <View style={styles.conversationList}>
        <View style={styles.conversationListHeader}>
          <Text style={styles.conversationListTitle}>All Conversations</Text>
          <Text style={styles.conversationCount}>{conversations.length} total conversations</Text>
        </View>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.conversationItem,
                selectedConversation?.id === item.id && styles.selectedConversation
              ]}
              onPress={() => setSelectedConversation(item)}
            >
              <Text style={styles.conversationName}>
                {item.participants.map(p => p.name).join(", ")}
              </Text>
              {item.lastMessage ? (
                <Text style={styles.conversationPreview} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={() => renderEmptyState("No Conversations", "No conversations to display", "message-square")}
        />
      </View>
      <View style={styles.messagePreviewContainer}>
        <Text style={styles.messagePreviewHeader}>Select a conversation</Text>
        {selectedConversation ? (
          <View>
            <Text style={styles.listItemName}>
              {selectedConversation.participants.map(p => p.name).join(" & ")}
            </Text>
            <Text style={styles.listItemInfo}>{selectedConversation.messageCount} messages</Text>
          </View>
        ) : (
          <View style={styles.messagePreviewEmpty}>
            <Feather name="message-square" size={32} color={C.dim} />
            <Text style={styles.messagePreviewEmptyText}>Select a conversation to view messages</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      );
    }

    switch (activeTab) {
      case "users":
        return (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
          >
            <Text style={styles.countBadge}>{filteredUsers.length} users</Text>
            {filteredUsers.length === 0
              ? renderEmptyState("No Users", "No users found matching your search", "users")
              : filteredUsers.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.listItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log("[Admin] Tapped user:", item.id, item.name);
                      navigateToUserDetail(item.id);
                    }}
                  >
                    <View style={styles.listItemHeader}>
                      <Text style={styles.listItemName}>{item.name}</Text>
                      <View style={[styles.statusBadge, item.status === "active" ? styles.approvedBadge : styles.rejectedBadge]}>
                        <Text style={[styles.statusText, item.status === "active" ? styles.approvedText : styles.rejectedText]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.listItemInfo}>{item.email}</Text>
                    {item.username ? <Text style={styles.listItemInfo}>@{item.username}</Text> : null}
                    <Text style={styles.listItemInfo}>Account: {item.accountType}</Text>
                  </TouchableOpacity>
                ))}
          </ScrollView>
        );
      case "businesses":
        return (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
          >
            {BusinessListHeader}
            {filteredBusinesses.length === 0 ? (
              BusinessEmptyComponent
            ) : (
              filteredBusinesses.map((item) => {
                const status = getBusinessStatus(item);
                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.listItem}
                    activeOpacity={0.7}
                    onPress={() => { 
                      console.log("Tapped business:", item.id, item.name); 
                      navigation.navigate("AdminBusinessReview", { businessId: item.id }); 
                    }}
                  >
                    <View style={styles.listItemHeader}>
                      <Text style={styles.listItemName}>{item.name}</Text>
                      <View style={[
                        styles.statusBadge,
                        status === "pending" ? styles.pendingBadge :
                        status === "approved" ? styles.approvedBadge : styles.rejectedBadge
                      ]}>
                        <Text style={[
                          styles.statusText,
                          status === "pending" ? styles.pendingText :
                          status === "approved" ? styles.approvedText : styles.rejectedText
                        ]}>
                          {status}
                        </Text>
                      </View>
                    </View>
                    {item.ownerName ? <Text style={styles.listItemInfo}>Owner: {item.ownerName}</Text> : null}
                    <Text style={styles.listItemInfo}>{item.category}</Text>
                    <Text style={styles.listItemInfo}>{item.city}, {item.state}</Text>
                    {item.email ? <Text style={styles.listItemInfo}>{item.email}</Text> : null}
                    {formatAppliedDate(item.createdAt) ? (
                      <Text style={styles.listItemInfo}>Applied {formatAppliedDate(item.createdAt)}</Text>
                    ) : null}
                    {item.earnings !== undefined ? (
                      <Text style={styles.listItemInfo}>Earnings: ${item.earnings.toFixed(2)}</Text>
                    ) : null}
                    <View style={styles.actionRow} pointerEvents="box-none">
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.viewDetailsButton]}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate("AdminBusinessReview", { businessId: item.id })}
                      >
                        <Feather name="eye" size={14} color={C.gold} />
                        <Text style={styles.viewDetailsButtonText}>View Details</Text>
                      </TouchableOpacity>
                      {status === "pending" ? (
                        <>
                          <TouchableOpacity 
                            style={[styles.actionButton, styles.approveButton]}
                            activeOpacity={0.7}
                            onPress={() => handleApprove("business", item.id)}
                          >
                            <Feather name="check" size={14} color={C.success} />
                            <Text style={styles.approveButtonText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.actionButton, styles.rejectButton]}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate("AdminBusinessReview", { businessId: item.id })}
                          >
                            <Feather name="x" size={14} color={C.error} />
                            <Text style={styles.rejectButtonText}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        );
      case "photographers":
        return (
          <FlatList
            data={filteredPhotographers}
            renderItem={renderPhotographerItem}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
            ListHeaderComponent={() => (
              <Text style={styles.countBadge}>{filteredPhotographers.length} photographers</Text>
            )}
            ListEmptyComponent={() => renderEmptyState("No Photographers", "No photographers found", "camera")}
          />
        );
      case "payments":
        return renderPaymentsContent();
      case "messages":
        return renderMessagesContent();
      case "influencers":
        return (
          <>
            {renderStatusFilter(influencerFilter, setInfluencerFilter)}
            <FlatList
              data={influencers}
              renderItem={renderInfluencerItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.content}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
              ListHeaderComponent={() => (
                <Text style={styles.countBadge}>{influencers.length} applications</Text>
              )}
              ListEmptyComponent={() => renderEmptyState(
                influencerFilter === "pending" ? "No pending Applications" : "No Applications",
                influencerFilter === "pending" ? "No pending influencer applications to review." : "No influencer applications found.",
                "trending-up"
              )}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {activeTab === null ? (
        renderHome()
      ) : (
        <View style={styles.contentArea}>
          {activeTab !== "businesses" ? renderSearchBar() : null}
          {renderContent()}
        </View>
      )}
    </View>
  );
}

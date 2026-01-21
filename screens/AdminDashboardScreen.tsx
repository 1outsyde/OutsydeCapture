import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { AdminStats, AdminUser, AdminBusiness, AdminPhotographer, AdminInfluencer, AdminOrder, AdminBooking, AdminRefund, AdminConversation, PaymentStats } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

type TabType = "users" | "businesses" | "photographers" | "payments" | "messages" | "influencers";
type StatusFilter = "pending" | "approved" | "rejected" | "all";
type PaymentSubTab = "orders" | "bookings" | "refunds";

const getBusinessStatus = (business: AdminBusiness): "pending" | "approved" | "rejected" => {
  return business.approvalStatus || business.status || "pending";
};

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("users");
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
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats>({ totalOrders: 0, orderRevenue: 0, totalBookings: 0, pendingRefunds: 0 });

  const [businessFilter, setBusinessFilter] = useState<StatusFilter>("all");
  const [influencerFilter, setInfluencerFilter] = useState<StatusFilter>("pending");
  const [paymentSubTab, setPaymentSubTab] = useState<PaymentSubTab>("orders");
  const [selectedConversation, setSelectedConversation] = useState<AdminConversation | null>(null);
  const [pendingBusinessCount, setPendingBusinessCount] = useState(0);

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
    const token = await getToken();
    if (!token) return;

    try {
      switch (activeTab) {
        case "users":
          const usersData = await api.getAdminUsers(token, searchQuery || undefined);
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
          setPhotographers(photographersData || []);
          break;
        case "influencers":
          const influencerStatusParam = influencerFilter !== "all" ? influencerFilter : undefined;
          const influencersData = await api.getAdminInfluencers(token, influencerStatusParam);
          setInfluencers(influencersData || []);
          break;
        case "payments":
          const [paymentStatsData, ordersData, bookingsData, refundsData] = await Promise.all([
            api.getPaymentStats(token),
            api.getAdminOrders(token),
            api.getAdminBookings(token),
            api.getAdminRefunds(token),
          ]);
          setPaymentStats(paymentStatsData || { totalOrders: 0, orderRevenue: 0, totalBookings: 0, pendingRefunds: 0 });
          setOrders(ordersData || []);
          setBookings(bookingsData || []);
          setRefunds(refundsData || []);
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
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchTabData()]);
    setRefreshing(false);
  };

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

  const handleReject = async (type: "business" | "influencer", id: string, reason?: string) => {
    const token = await getToken();
    if (!token) return;
    
    const rejectionReason = reason || "Application did not meet requirements";
    
    Alert.alert(
      "Confirm Rejection",
      `Are you sure you want to reject this ${type}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              console.log(`[AdminDashboard] Rejecting ${type} with id: ${id}`);
              await api.rejectApplication(token, type, id, rejectionReason);
              Alert.alert("Success", `${type === "business" ? "Business" : "Influencer"} rejected`);
              fetchTabData();
            } catch (error: any) {
              console.log("[AdminDashboard] Reject error:", error?.message || error);
              const errorMessage = error?.message?.toLowerCase() || "";
              if (errorMessage.includes("already approved")) {
                Alert.alert("Already Approved", "This business has already been approved.");
                fetchTabData();
              } else if (errorMessage.includes("already rejected")) {
                Alert.alert("Already Rejected", "This business has already been rejected.");
                fetchTabData();
              } else {
                Alert.alert("Error", `Failed to reject application: ${error?.message || "Unknown error"}`);
              }
            }
          },
        },
      ]
    );
  };

  const navigateToUserDetail = (userId: string) => {
    navigation.navigate("AdminUserDetail", { userId });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 12,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      flex: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 6,
    },
    statCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      fontSize: 10,
      color: theme.textSecondary,
    },
    statValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    tabsContainer: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      marginHorizontal: 12,
      marginBottom: 12,
      padding: 4,
    },
    tabsRow: {
      flexDirection: "row",
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 8,
      gap: 4,
    },
    activeTab: {
      backgroundColor: theme.backgroundRoot,
    },
    tabText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    activeTabText: {
      color: theme.primary,
      fontWeight: "600",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.backgroundRoot,
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
      color: theme.text,
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
      backgroundColor: theme.backgroundRoot,
      borderWidth: 1,
      borderColor: "transparent",
    },
    activeFilterChip: {
      backgroundColor: theme.primary + "20",
      borderColor: theme.primary,
    },
    filterText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    activeFilterText: {
      color: theme.primary,
    },
    countBadge: {
      marginLeft: 12,
      marginBottom: 6,
      fontSize: 12,
      color: theme.textSecondary,
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
      backgroundColor: theme.backgroundRoot,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
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
      color: theme.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    pendingBadge: {
      backgroundColor: "#FFA50030",
    },
    approvedBadge: {
      backgroundColor: "#34C75930",
    },
    rejectedBadge: {
      backgroundColor: "#FF3B3030",
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
    },
    pendingText: {
      color: "#FFA500",
    },
    approvedText: {
      color: "#34C759",
    },
    rejectedText: {
      color: "#FF3B30",
    },
    pendingCountBadge: {
      backgroundColor: "#FF3B30",
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
    },
    pendingCountText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    listItemInfo: {
      fontSize: 13,
      color: theme.textSecondary,
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
      backgroundColor: "#34C75920",
    },
    rejectButton: {
      backgroundColor: "#FF3B3020",
    },
    approveButtonText: {
      color: "#34C759",
      fontSize: 13,
      fontWeight: "600",
    },
    rejectButtonText: {
      color: "#FF3B30",
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
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 14,
    },
    paymentStatLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    paymentStatValue: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
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
      backgroundColor: theme.backgroundDefault,
    },
    activeSubTab: {
      backgroundColor: theme.primary + "20",
    },
    subTabText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: "500",
    },
    activeSubTabText: {
      color: theme.primary,
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
      color: theme.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    messagesContainer: {
      flex: 1,
      flexDirection: "row",
    },
    conversationList: {
      width: "40%",
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    conversationListHeader: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    conversationListTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    conversationCount: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    conversationItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    selectedConversation: {
      backgroundColor: theme.primary + "10",
    },
    conversationName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    conversationPreview: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    messagePreviewContainer: {
      flex: 1,
      padding: 16,
    },
    messagePreviewHeader: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    messagePreviewEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    messagePreviewEmptyText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  const tabs: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "users", label: "Users", icon: "users" },
    { key: "businesses", label: "Businesses", icon: "briefcase" },
    { key: "photographers", label: "Photographers", icon: "camera" },
    { key: "payments", label: "Payments", icon: "credit-card" },
    { key: "messages", label: "Messages", icon: "message-square" },
    { key: "influencers", label: "Influencers", icon: "trending-up" },
  ];

  const renderStatsCards = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Feather name="users" size={12} color={theme.primary} />
        </View>
        <View>
          <Text style={styles.statValue}>{stats.users}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Feather name="briefcase" size={12} color={theme.primary} />
        </View>
        <View>
          <Text style={styles.statValue}>{stats.businesses}</Text>
          <Text style={styles.statLabel}>Businesses</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Feather name="camera" size={12} color={theme.primary} />
        </View>
        <View>
          <Text style={styles.statValue}>{stats.photographers}</Text>
          <Text style={styles.statLabel}>Photographers</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Feather name="shopping-bag" size={12} color={theme.primary} />
        </View>
        <View>
          <Text style={styles.statValue}>{stats.orders}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Feather name="calendar" size={12} color={theme.primary} />
        </View>
        <View>
          <Text style={styles.statValue}>{stats.bookings}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tabsRow}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => {
                setActiveTab(tab.key);
                setSearchQuery("");
              }}
            >
              <Feather
                name={tab.icon}
                size={14}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
              {tab.key === "businesses" && pendingBusinessCount > 0 && (
                <View style={styles.pendingCountBadge}>
                  <Text style={styles.pendingCountText}>{pendingBusinessCount}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderSearchBar = () => {
    if (activeTab === "messages" || activeTab === "payments") return null;
    
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
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholders[activeTab]}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
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
      <Feather name={icon} size={48} color={theme.textSecondary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderUserItem = ({ item }: { item: AdminUser }) => (
    <Pressable style={styles.listItem} onPress={() => navigateToUserDetail(item.id)}>
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
    </Pressable>
  );

  const renderBusinessItem = useCallback(({ item }: { item: AdminBusiness }) => {
    const status = getBusinessStatus(item);
    return (
      <TouchableOpacity 
        style={styles.listItem} 
        activeOpacity={0.7}
        onPress={() => { 
          console.log("Tapped business (FlatList):", item.id, item.name); 
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
        <Text style={styles.listItemInfo}>{item.category}</Text>
        <Text style={styles.listItemInfo}>{item.city}, {item.state}</Text>
        {item.email ? <Text style={styles.listItemInfo}>{item.email}</Text> : null}
        {item.earnings !== undefined ? (
          <Text style={styles.listItemInfo}>Earnings: ${item.earnings.toFixed(2)}</Text>
        ) : null}
        {status === "pending" ? (
          <View style={styles.actionRow}>
            <Pressable 
              style={[styles.actionButton, styles.approveButton]} 
              onPress={(e) => { e.stopPropagation(); handleApprove("business", item.id); }}
            >
              <Feather name="check" size={14} color="#34C759" />
              <Text style={styles.approveButtonText}>Approve</Text>
            </Pressable>
            <Pressable 
              style={[styles.actionButton, styles.rejectButton]} 
              onPress={(e) => { e.stopPropagation(); handleReject("business", item.id); }}
            >
              <Feather name="x" size={14} color="#FF3B30" />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </Pressable>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [styles, theme, navigation, handleApprove, handleReject]);

  const businessKeyExtractor = useCallback((item: AdminBusiness) => item.id, []);

  const filteredBusinesses = useMemo(() => {
    if (businessFilter === "all") return businesses;
    return businesses.filter(b => getBusinessStatus(b) === businessFilter);
  }, [businesses, businessFilter]);

  const BusinessListHeader = useMemo(() => (
    <View>
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search businesses..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
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
  ), [styles, theme, searchQuery, businessFilter, filteredBusinesses.length]);

  const BusinessEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Feather name="briefcase" size={48} color={theme.textSecondary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No Businesses</Text>
      <Text style={styles.emptySubtitle}>No businesses found</Text>
    </View>
  ), [styles, theme]);

  const renderPhotographerItem = ({ item }: { item: AdminPhotographer }) => (
    <Pressable style={styles.listItem} onPress={() => navigateToUserDetail(item.id)}>
      <Text style={styles.listItemName}>{item.name}</Text>
      <Text style={styles.listItemInfo}>{item.specialty}</Text>
      <Text style={styles.listItemInfo}>{item.city}, {item.state}</Text>
      {item.email ? <Text style={styles.listItemInfo}>{item.email}</Text> : null}
      {item.earnings !== undefined ? (
        <Text style={styles.listItemInfo}>Earnings: ${item.earnings.toFixed(2)}</Text>
      ) : null}
    </Pressable>
  );

  const renderInfluencerItem = ({ item }: { item: AdminInfluencer }) => (
    <View style={styles.listItem}>
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
      {item.instagram ? <Text style={styles.listItemInfo}>@{item.instagram}</Text> : null}
      {item.followers ? <Text style={styles.listItemInfo}>{item.followers.toLocaleString()} followers</Text> : null}
      {item.status === "pending" ? (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionButton, styles.approveButton]} onPress={() => handleApprove("influencer", item.id)}>
            <Feather name="check" size={14} color="#34C759" />
            <Text style={styles.approveButtonText}>Approve</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => handleReject("influencer", item.id)}>
            <Feather name="x" size={14} color="#FF3B30" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderOrderItem = ({ item }: { item: AdminOrder }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>Order #{item.id.slice(0, 8)}</Text>
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
    </View>
  );

  const renderBookingItem = ({ item }: { item: AdminBooking }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>Booking #{item.id.slice(0, 8)}</Text>
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
    </View>
  );

  const renderRefundItem = ({ item }: { item: AdminRefund }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemHeader}>
        <Text style={styles.listItemName}>Refund #{item.id.slice(0, 8)}</Text>
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
      <Text style={styles.listItemInfo}>Customer: {item.userName}</Text>
      <Text style={styles.listItemInfo}>Amount: ${item.amount.toFixed(2)}</Text>
      <Text style={styles.listItemInfo}>Reason: {item.reason}</Text>
    </View>
  );

  const renderPaymentsContent = () => (
    <View style={styles.content}>
      <View style={styles.paymentStatsRow}>
        <View style={styles.paymentStatCard}>
          <Feather name="shopping-bag" size={20} color={theme.primary} />
          <Text style={styles.paymentStatLabel}>Total Orders</Text>
          <Text style={styles.paymentStatValue}>{paymentStats.totalOrders}</Text>
        </View>
        <View style={styles.paymentStatCard}>
          <Feather name="dollar-sign" size={20} color={theme.primary} />
          <Text style={styles.paymentStatLabel}>Order Revenue</Text>
          <Text style={styles.paymentStatValue}>${paymentStats.orderRevenue.toFixed(2)}</Text>
        </View>
        <View style={styles.paymentStatCard}>
          <Feather name="calendar" size={20} color={theme.primary} />
          <Text style={styles.paymentStatLabel}>Total Bookings</Text>
          <Text style={styles.paymentStatValue}>{paymentStats.totalBookings}</Text>
        </View>
        <View style={styles.paymentStatCard}>
          <Feather name="refresh-cw" size={20} color="#FF9500" />
          <Text style={styles.paymentStatLabel}>Pending Refunds</Text>
          <Text style={styles.paymentStatValue}>{paymentStats.pendingRefunds}</Text>
        </View>
      </View>

      <View style={styles.subTabRow}>
        {(["orders", "bookings", "refunds"] as PaymentSubTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.subTab, paymentSubTab === tab && styles.activeSubTab]}
            onPress={() => setPaymentSubTab(tab)}
          >
            <Text style={[styles.subTabText, paymentSubTab === tab && styles.activeSubTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({
                tab === "orders" ? orders.length :
                tab === "bookings" ? bookings.length :
                refunds.length
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
      {paymentSubTab === "refunds" ? (
        refunds.length === 0 
          ? renderEmptyState("No Refunds", "No refunds to display", "refresh-cw")
          : <FlatList data={refunds} renderItem={renderRefundItem} keyExtractor={(item) => item.id} />
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
            <Feather name="message-square" size={32} color={theme.textSecondary} />
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
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    switch (activeTab) {
      case "users":
        return (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            ListHeaderComponent={() => (
              <Text style={styles.countBadge}>{users.length} users</Text>
            )}
            ListEmptyComponent={() => renderEmptyState("No Users", "No users found matching your search", "users")}
          />
        );
      case "businesses":
        return (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          >
            {BusinessListHeader}
            {filteredBusinesses.length === 0 ? (
              BusinessEmptyComponent
            ) : (
              filteredBusinesses.map((item) => {
                const status = getBusinessStatus(item);
                return (
                  <TouchableOpacity key={item.id} style={styles.listItem} activeOpacity={0.7} onPress={() => { console.log("Tapped business:", item.id, item.name); navigation.navigate("AdminBusinessReview", { businessId: item.id }); }}>
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
                    {status === "pending" ? (
                      <View style={styles.actionRow}>
                        <Pressable 
                          style={[styles.actionButton, styles.approveButton]} 
                          onPress={(e) => { e.stopPropagation(); handleApprove("business", item.id); }}
                        >
                          <Feather name="check" size={14} color="#34C759" />
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </Pressable>
                        <Pressable 
                          style={[styles.actionButton, styles.rejectButton]} 
                          onPress={(e) => { e.stopPropagation(); handleReject("business", item.id); }}
                        >
                          <Feather name="x" size={14} color="#FF3B30" />
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        );
      case "photographers":
        return (
          <FlatList
            data={photographers}
            renderItem={renderPhotographerItem}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            ListHeaderComponent={() => (
              <Text style={styles.countBadge}>{photographers.length} photographers</Text>
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
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
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
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Platform management and oversight</Text>
        </View>
      </View>

      {renderTabs()}
      <View style={styles.contentArea}>
        {activeTab !== "businesses" ? renderSearchBar() : null}
        {renderContent()}
      </View>
    </View>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, {
  BusinessDashboardStats,
  BusinessDashboardProfile,
  BusinessOrder,
  BusinessBooking,
  BusinessService,
  BusinessProduct,
  BillingAddress,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

type BusinessType = "service" | "product" | "both";
type TabType = "orders" | "bookings" | "products" | "services" | "hours" | "storefront" | "profile";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BusinessDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("orders");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [bookings, setBookings] = useState<BusinessBooking[]>([]);
  const [products, setProducts] = useState<BusinessProduct[]>([]);
  const [services, setServices] = useState<BusinessService[]>([]);

  const [editProfile, setEditProfile] = useState({
    name: "",
    category: "",
    bio: "",
    city: "",
    state: "",
    website: "",
  });

  const businessType: BusinessType = profile?.businessType || "both";

  const getAvailableTabs = (): TabType[] => {
    switch (businessType) {
      case "product":
        return ["orders", "products", "storefront", "profile"];
      case "service":
        return ["bookings", "services", "hours", "storefront", "profile"];
      case "both":
      default:
        return ["orders", "bookings", "products", "services", "hours", "storefront", "profile"];
    }
  };

  const fetchDashboard = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setLoading(true);
      const { business } = await api.getVendorMyBusiness(token);
      
      setStats({
        earnings: business.totalEarnings || 0,
        upcomingOrders: 0,
        upcomingBookings: 0,
        unreadMessages: 0,
        rating: business.rating || 0,
        reviewCount: business.reviewCount || 0,
        profileViews: 0,
      });
      
      const businessTypeValue = business.hasProducts && business.hasServices 
        ? "both" 
        : business.hasProducts 
          ? "product" 
          : "service";
      
      setProfile({
        id: business.id,
        name: business.name || "",
        avatar: business.logoImage,
        category: business.category || "",
        bio: business.description,
        city: business.city,
        state: business.state,
        website: business.websiteUrl,
        stripeConnected: business.stripeOnboardingComplete || false,
        businessType: businessTypeValue,
      });
      
      setEditProfile({
        name: business.name || "",
        category: business.category || "",
        bio: business.description || "",
        city: business.city || "",
        state: business.state || "",
        website: business.websiteUrl || "",
      });
      
      const tabs = getAvailableTabs();
      if (!tabs.includes(activeTab)) {
        setActiveTab(tabs[0]);
      }
    } catch (error) {
      console.error("Failed to fetch business dashboard:", error);
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
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchTabData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      switch (activeTab) {
        case "orders":
          const ordersData = await api.getBusinessOrders(token);
          setOrders(ordersData || []);
          break;
        case "bookings":
          const bookingsData = await api.getBusinessBookings(token);
          setBookings(bookingsData || []);
          break;
        case "products":
          const productsData = await api.getBusinessProducts(token);
          setProducts(productsData || []);
          break;
        case "services":
          const servicesData = await api.getBusinessServices(token);
          setServices(servicesData || []);
          break;
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} data:`, error);
    }
  }, [getToken, activeTab]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboard(), fetchTabData()]);
    setRefreshing(false);
  };

  const handleConnectStripe = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const { url } = await api.startVendorStripeOnboarding(token);
      if (url) {
        Linking.openURL(url);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to connect Stripe. Please try again.");
    }
  };

  const handleSaveProfile = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      await api.updateVendorMyBusiness(token, {
        name: editProfile.name,
        category: editProfile.category,
        description: editProfile.bio || undefined,
        city: editProfile.city || undefined,
        state: editProfile.state || undefined,
        websiteUrl: editProfile.website || undefined,
      });
      Alert.alert("Success", "Profile updated successfully");
      fetchDashboard();
    } catch (error) {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleOrderAction = async (orderId: string, status: string) => {
    const token = await getToken();
    if (!token) return;

    try {
      await api.updateOrderStatus(token, orderId, status);
      Alert.alert("Success", `Order updated successfully`);
      fetchTabData();
    } catch (error) {
      Alert.alert("Error", "Failed to update order");
    }
  };

  const handleBookingAction = async (bookingId: string, action: "confirm" | "cancel") => {
    const token = await getToken();
    if (!token) return;

    try {
      await api.updateBookingStatus(token, "business", bookingId, action === "confirm" ? "confirmed" : "cancelled");
      Alert.alert("Success", `Booking ${action}ed successfully`);
      fetchTabData();
    } catch (error) {
      Alert.alert("Error", `Failed to ${action} booking`);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 12,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    logoutButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.backgroundDefault,
      borderRadius: 8,
    },
    logoutText: {
      fontSize: 14,
      color: theme.text,
    },
    stripeCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.backgroundDefault,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: "#FF9500",
    },
    stripeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#FF950020",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    stripeContent: {
      flex: 1,
    },
    stripeTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    stripeDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    stripeButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginTop: 12,
    },
    stripeButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 6,
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingBottom: 16,
      gap: 8,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    },
    statValue: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
      textAlign: "center",
    },
    statIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    contentRow: {
      flexDirection: "row",
      flex: 1,
    },
    leftColumn: {
      width: "40%",
      paddingHorizontal: 16,
    },
    rightColumn: {
      flex: 1,
      paddingRight: 16,
    },
    profileCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 12,
    },
    profileInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    profileAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    profileAvatarText: {
      fontSize: 20,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    profileName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    profileCategory: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    websiteLink: {
      flexDirection: "row",
      alignItems: "center",
    },
    websiteLinkText: {
      fontSize: 13,
      color: theme.primary,
      marginLeft: 4,
    },
    statsGrid: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    miniStatCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 10,
      padding: 12,
    },
    miniStatIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    miniStatValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    miniStatLabel: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    billingCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 16,
    },
    billingHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    billingTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      marginLeft: 8,
    },
    input: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: "row",
      gap: 8,
    },
    inputHalf: {
      flex: 1,
    },
    tabsContainer: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      overflow: "hidden",
    },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    activeTabText: {
      color: theme.primary,
      fontWeight: "600",
    },
    tabContent: {
      padding: 16,
      minHeight: 200,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
    },
    orderCard: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    orderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    orderCustomer: {
      flexDirection: "row",
      alignItems: "center",
    },
    orderAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + "40",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    orderName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    orderDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    orderStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    orderStatusText: {
      fontSize: 11,
      fontWeight: "600",
    },
    orderItems: {
      marginBottom: 8,
    },
    orderItem: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    orderFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    orderTotal: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    orderActions: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: "600",
    },
    bookingCard: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    bookingHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    bookingClient: {
      flexDirection: "row",
      alignItems: "center",
    },
    bookingAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary + "40",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    bookingName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    bookingDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    bookingStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    bookingStatusText: {
      fontSize: 11,
      fontWeight: "600",
    },
    bookingDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    bookingInfo: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    bookingAmount: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    bookingActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    productCard: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    productHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    productName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
    },
    productDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    productInventory: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    serviceCard: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    serviceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    serviceName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    servicePrice: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
    },
    serviceDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    serviceDuration: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    profileForm: {
      gap: 12,
    },
    formGroup: {
      marginBottom: 4,
    },
    formLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    formInput: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
    },
    formTextarea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 6,
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return { bg: "#FF950020", text: "#FF9500" };
      case "processing": return { bg: "#007AFF20", text: "#007AFF" };
      case "confirmed": return { bg: "#34C75920", text: "#34C759" };
      case "shipped": return { bg: "#5856D620", text: "#5856D6" };
      case "delivered":
      case "completed": return { bg: theme.primary + "20", text: theme.primary };
      case "cancelled": return { bg: "#FF3B3020", text: "#FF3B30" };
      default: return { bg: theme.backgroundSecondary, text: theme.textSecondary };
    }
  };

  const renderOrdersTab = () => {
    if (orders.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="shopping-bag" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>Orders will appear here once customers make purchases</Text>
        </View>
      );
    }

    return orders.map(order => {
      const statusColor = getStatusColor(order.status);
      return (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={styles.orderCustomer}>
              <View style={styles.orderAvatar}>
                <Feather name="user" size={16} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.orderName}>{order.customerName}</Text>
                <Text style={styles.orderDate}>{order.orderDate}</Text>
              </View>
            </View>
            <View style={[styles.orderStatus, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.orderStatusText, { color: statusColor.text }]}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Text>
            </View>
          </View>
          <View style={styles.orderItems}>
            {order.items.slice(0, 2).map((item, i) => (
              <Text key={i} style={styles.orderItem}>
                {item.quantity}x {item.name} - ${item.price}
              </Text>
            ))}
            {order.items.length > 2 && (
              <Text style={styles.orderItem}>+{order.items.length - 2} more items</Text>
            )}
          </View>
          <View style={styles.orderFooter}>
            <Text style={styles.orderTotal}>Total: ${order.totalAmount}</Text>
            {order.status === "pending" && (
              <View style={styles.orderActions}>
                <Pressable
                  onPress={() => handleOrderAction(order.id, "processing")}
                  style={[styles.actionButton, { backgroundColor: "#34C759" }]}
                >
                  <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Process</Text>
                </Pressable>
              </View>
            )}
            {order.status === "processing" && (
              <View style={styles.orderActions}>
                <Pressable
                  onPress={() => handleOrderAction(order.id, "shipped")}
                  style={[styles.actionButton, { backgroundColor: "#5856D6" }]}
                >
                  <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Ship</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      );
    });
  };

  const renderBookingsTab = () => {
    if (bookings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="calendar" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>Bookings will appear here once customers book your services</Text>
        </View>
      );
    }

    return bookings.map(booking => {
      const statusColor = getStatusColor(booking.status);
      return (
        <View key={booking.id} style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <View style={styles.bookingClient}>
              <View style={styles.bookingAvatar}>
                <Feather name="user" size={16} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.bookingName}>{booking.customerName}</Text>
                <Text style={styles.bookingDate}>{booking.date} at {booking.time}</Text>
              </View>
            </View>
            <View style={[styles.bookingStatus, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.bookingStatusText, { color: statusColor.text }]}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Text>
            </View>
          </View>
          <View style={styles.bookingDetails}>
            <Text style={styles.bookingInfo}>{booking.serviceName}</Text>
            <Text style={styles.bookingAmount}>${booking.amount}</Text>
          </View>
          {booking.status === "pending" && (
            <View style={styles.bookingActions}>
              <Pressable
                onPress={() => handleBookingAction(booking.id, "confirm")}
                style={[styles.actionButton, { backgroundColor: "#34C759", flex: 1 }]}
              >
                <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => handleBookingAction(booking.id, "cancel")}
                style={[styles.actionButton, { backgroundColor: "#FF3B3020", flex: 1 }]}
              >
                <Text style={[styles.actionButtonText, { color: "#FF3B30" }]}>Decline</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    });
  };

  const renderProductsTab = () => {
    if (products.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="box" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptySubtitle}>Add products for customers to purchase</Text>
        </View>
      );
    }

    return products.map(product => (
      <View key={product.id} style={styles.productCard}>
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>${product.price}</Text>
        </View>
        <Text style={styles.productDescription}>{product.description}</Text>
        <Text style={styles.productInventory}>In stock: {product.inventory}</Text>
      </View>
    ));
  };

  const renderServicesTab = () => {
    if (services.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="package" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No services yet</Text>
          <Text style={styles.emptySubtitle}>Add services that customers can book</Text>
        </View>
      );
    }

    return services.map(service => (
      <View key={service.id} style={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.servicePrice}>${service.price}</Text>
        </View>
        <Text style={styles.serviceDescription}>{service.description}</Text>
        <Text style={styles.serviceDuration}>{service.duration} minutes</Text>
      </View>
    ));
  };

  const renderProfileTab = () => (
    <View style={styles.profileForm}>
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Business Name</Text>
        <TextInput
          style={styles.formInput}
          value={editProfile.name}
          onChangeText={(text) => setEditProfile({ ...editProfile, name: text })}
          placeholder="Your business name"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Category</Text>
        <TextInput
          style={styles.formInput}
          value={editProfile.category}
          onChangeText={(text) => setEditProfile({ ...editProfile, category: text })}
          placeholder="e.g. Restaurant, Salon, etc."
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Bio</Text>
        <TextInput
          style={[styles.formInput, styles.formTextarea]}
          value={editProfile.bio}
          onChangeText={(text) => setEditProfile({ ...editProfile, bio: text })}
          placeholder="Tell customers about your business..."
          placeholderTextColor={theme.textSecondary}
          multiline
        />
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.formGroup, styles.inputHalf]}>
          <Text style={styles.formLabel}>City</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.city}
            onChangeText={(text) => setEditProfile({ ...editProfile, city: text })}
            placeholder="City"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        <View style={[styles.formGroup, styles.inputHalf]}>
          <Text style={styles.formLabel}>State</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.state}
            onChangeText={(text) => setEditProfile({ ...editProfile, state: text })}
            placeholder="State"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Website</Text>
        <TextInput
          style={styles.formInput}
          value={editProfile.website}
          onChangeText={(text) => setEditProfile({ ...editProfile, website: text })}
          placeholder="https://yourbusiness.com"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <Pressable onPress={handleSaveProfile} style={styles.saveButton} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Feather name="save" size={16} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Save Profile</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "orders":
        return renderOrdersTab();
      case "bookings":
        return renderBookingsTab();
      case "products":
        return renderProductsTab();
      case "services":
        return renderServicesTab();
      case "hours":
        return (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="clock" size={24} color={theme.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Hours coming soon</Text>
            <Text style={styles.emptySubtitle}>Set your business operating hours</Text>
          </View>
        );
      case "storefront":
        return (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="shopping-bag" size={24} color={theme.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Storefront coming soon</Text>
            <Text style={styles.emptySubtitle}>Customize how customers see your business</Text>
          </View>
        );
      case "profile":
        return renderProfileTab();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const availableTabs = getAvailableTabs();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{profile?.name || "Business"}</Text>
          <Text style={styles.headerSubtitle}>{profile?.city}, {profile?.state}</Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      {!profile?.stripeConnected && (
        <View style={styles.stripeCard}>
          <View style={styles.stripeIcon}>
            <Feather name="alert-circle" size={20} color="#FF9500" />
          </View>
          <View style={styles.stripeContent}>
            <Text style={styles.stripeTitle}>Complete Your Payment Setup</Text>
            <Text style={styles.stripeDescription}>
              Connect your Stripe account to start receiving payments. This is required before customers can make purchases.
            </Text>
            <Pressable onPress={handleConnectStripe} style={styles.stripeButton}>
              <Feather name="external-link" size={14} color="#FFFFFF" />
              <Text style={styles.stripeButtonText}>Connect with Stripe</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="dollar-sign" size={14} color={theme.primary} />
          </View>
          <Text style={styles.statValue}>${stats.earnings}</Text>
          <Text style={styles.statLabel}>This month</Text>
        </View>
        {(businessType === "product" || businessType === "both") && (
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#34C75920" }]}>
              <Feather name="shopping-bag" size={14} color="#34C759" />
            </View>
            <Text style={styles.statValue}>{stats.upcomingOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
        )}
        {(businessType === "service" || businessType === "both") && (
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#5856D620" }]}>
              <Feather name="calendar" size={14} color="#5856D6" />
            </View>
            <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
        )}
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#007AFF20" }]}>
            <Feather name="message-circle" size={14} color="#007AFF" />
          </View>
          <Text style={styles.statValue}>{stats.unreadMessages}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#FF950020" }]}>
            <Feather name="star" size={14} color="#FF9500" />
          </View>
          <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : "N/A"}</Text>
          <Text style={styles.statLabel}>{stats.reviewCount} reviews</Text>
        </View>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>Business Overview</Text>
            <View style={styles.profileInfo}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {profile?.name?.charAt(0)?.toUpperCase() || "B"}
                </Text>
              </View>
              <View>
                <Text style={styles.profileName}>{profile?.name}</Text>
                <Text style={styles.profileCategory}>{profile?.category}</Text>
              </View>
            </View>
            {profile?.website && (
              <Pressable style={styles.websiteLink} onPress={() => profile.website && Linking.openURL(profile.website)}>
                <Feather name="external-link" size={14} color={theme.primary} />
                <Text style={styles.websiteLinkText}>View Website</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.miniStatCard}>
              <View style={[styles.miniStatIcon, { backgroundColor: "#007AFF20" }]}>
                <Feather name="eye" size={14} color="#007AFF" />
              </View>
              <View>
                <Text style={styles.miniStatValue}>{stats.profileViews}</Text>
                <Text style={styles.miniStatLabel}>Profile Views</Text>
              </View>
            </View>
          </View>

          <View style={styles.billingCard}>
            <View style={styles.billingHeader}>
              <Feather name="credit-card" size={18} color={theme.text} />
              <Text style={styles.billingTitle}>Billing Address</Text>
            </View>
            <TextInput
              style={styles.input}
              value={billingAddress.addressLine1}
              onChangeText={(text) => setBillingAddress({ ...billingAddress, addressLine1: text })}
              placeholder="Address Line 1"
              placeholderTextColor={theme.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={billingAddress.addressLine2}
              onChangeText={(text) => setBillingAddress({ ...billingAddress, addressLine2: text })}
              placeholder="Address Line 2 (Optional)"
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={billingAddress.city}
                onChangeText={(text) => setBillingAddress({ ...billingAddress, city: text })}
                placeholder="City"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={billingAddress.state}
                onChangeText={(text) => setBillingAddress({ ...billingAddress, state: text })}
                placeholder="State"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tabBar}>
                {availableTabs.map(tab => (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.tab, activeTab === tab && styles.activeTab]}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.tabContent}>
              {renderTabContent()}
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: insets.bottom + 20 }} />
    </ScrollView>
  );
}

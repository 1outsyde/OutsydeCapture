import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, {
  PhotographerDashboardStats,
  PhotographerDashboardProfile,
  PhotographerBooking,
  PhotographerService,
  PhotographerHours,
  BillingAddress,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import HoursEditor, { DayHours, getDefaultHours } from "@/components/HoursEditor";

type TabType = "bookings" | "services" | "hours" | "storefront" | "profile";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SPECIALTIES = [
  "Portraits",
  "Weddings",
  "Events",
  "Products",
  "Fashion",
  "Real Estate",
  "Concerts",
  "Sports",
];

export default function PhotographerDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("bookings");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState<PhotographerDashboardStats>({
    earnings: 0,
    upcomingBookings: 0,
    unreadMessages: 0,
    rating: 0,
    reviewCount: 0,
    profileViews: 0,
    completedShoots: 0,
  });
  const [profile, setProfile] = useState<PhotographerDashboardProfile | null>(null);
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [bookings, setBookings] = useState<PhotographerBooking[]>([]);
  const [services, setServices] = useState<PhotographerService[]>([]);
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());

  const [editProfile, setEditProfile] = useState({
    name: "",
    hourlyRate: "",
    bio: "",
    city: "",
    state: "",
    portfolioUrl: "",
    specialties: [] as string[],
  });

  const fetchDashboard = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setLoading(true);
      const { photographer } = await api.getPhotographerMe(token);
      
      setStats({
        earnings: photographer.totalEarnings || 0,
        upcomingBookings: 0,
        unreadMessages: 0,
        rating: photographer.rating || 0,
        reviewCount: photographer.reviewCount || 0,
        profileViews: 0,
        completedShoots: photographer.completedShoots || 0,
      });
      
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
      });
      
      setEditProfile({
        name: photographer.displayName || "",
        hourlyRate: photographer.hourlyRate ? (photographer.hourlyRate / 100).toString() : "",
        bio: photographer.bio || "",
        city: photographer.city || "",
        state: photographer.state || "",
        portfolioUrl: photographer.portfolioUrl || "",
        specialties: photographer.specialties || [],
      });
    } catch (error) {
      console.error("Failed to fetch photographer dashboard:", error);
      setStats({
        earnings: 0,
        upcomingBookings: 0,
        unreadMessages: 0,
        rating: 0,
        reviewCount: 0,
        profileViews: 0,
        completedShoots: 0,
      });
      setProfile({
        id: "",
        name: "Photographer",
        hourlyRate: 150,
        specialties: [],
        stripeConnected: false,
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
        case "bookings":
          const { bookings: bookingsData } = await api.getPhotographerMeBookings(token);
          setBookings(bookingsData.map((b: any) => ({
            id: b.id,
            clientName: b.customerName || "Client",
            clientAvatar: b.customerAvatar,
            date: b.date,
            time: b.startTime,
            service: b.serviceName,
            status: b.status,
            amount: b.totalAmount ? b.totalAmount / 100 : 0,
          })) || []);
          break;
        case "services":
          const { services: servicesData } = await api.getPhotographerMeServices(token);
          setServices(servicesData.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            duration: s.durationMinutes,
            price: s.priceInCents ? s.priceInCents / 100 : 0,
          })) || []);
          break;
        case "hours":
          const { availability } = await api.getPhotographerMeAvailability(token);
          setHours(availability.length > 0 
            ? availability.map((a: any) => ({
                dayOfWeek: a.dayOfWeek,
                isAvailable: a.isAvailable,
                startTime: a.startTime,
                endTime: a.endTime,
              }))
            : DAYS_OF_WEEK.map((_, i) => ({
                dayOfWeek: i,
                isAvailable: i !== 0 && i !== 6,
                startTime: "09:00",
                endTime: "17:00",
              })));
          break;
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} data:`, error);
      if (activeTab === "hours") {
        setHours(DAYS_OF_WEEK.map((_, i) => ({
          dayOfWeek: i,
          isAvailable: i !== 0 && i !== 6,
          startTime: "09:00",
          endTime: "17:00",
        })));
      }
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
      const { url } = await api.startPhotographerStripeOnboarding(token);
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
      await api.updatePhotographerMe(token, {
        displayName: editProfile.name,
        hourlyRate: Math.round((parseFloat(editProfile.hourlyRate) || 0) * 100),
        bio: editProfile.bio || undefined,
        city: editProfile.city || undefined,
        state: editProfile.state || undefined,
        portfolioUrl: editProfile.portfolioUrl || undefined,
        specialties: editProfile.specialties,
      });
      Alert.alert("Success", "Profile updated successfully");
      fetchDashboard();
    } catch (error) {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBillingAddress = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      await api.updatePhotographerBillingAddress(token, billingAddress);
      Alert.alert("Success", "Billing address updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to save billing address");
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setEditProfile(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const handleBookingAction = async (bookingId: string, action: "confirm" | "cancel") => {
    const token = await getToken();
    if (!token) return;

    try {
      await api.updateBookingStatus(token, "photographer", bookingId, action === "confirm" ? "confirmed" : "cancelled");
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
    profileRate: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    portfolioLink: {
      flexDirection: "row",
      alignItems: "center",
    },
    portfolioLinkText: {
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
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 13,
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
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: "center",
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "600",
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
    specialtiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    specialtyChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.backgroundSecondary,
    },
    specialtyChipActive: {
      backgroundColor: theme.primary,
    },
    specialtyChipText: {
      fontSize: 13,
      color: theme.text,
    },
    specialtyChipTextActive: {
      color: "#FFFFFF",
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
    hoursRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    hoursDay: {
      width: 100,
      fontSize: 14,
      color: theme.text,
    },
    hoursToggle: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    hoursToggleActive: {
      backgroundColor: theme.primary,
    },
    hoursTimes: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    hoursTimeInput: {
      flex: 1,
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: theme.text,
      textAlign: "center",
    },
    hoursTimeSeparator: {
      fontSize: 13,
      color: theme.textSecondary,
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
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return { bg: "#FF950020", text: "#FF9500" };
      case "confirmed": return { bg: "#34C75920", text: "#34C759" };
      case "completed": return { bg: theme.primary + "20", text: theme.primary };
      case "cancelled": return { bg: "#FF3B3020", text: "#FF3B30" };
      default: return { bg: theme.backgroundSecondary, text: theme.textSecondary };
    }
  };

  const renderBookingsTab = () => {
    if (bookings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="calendar" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>Bookings will appear here once clients book your services</Text>
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
                <Text style={styles.bookingName}>{booking.clientName}</Text>
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
            <Text style={styles.bookingInfo}>{booking.sessionType}</Text>
            <Text style={styles.bookingAmount}>${booking.amount}</Text>
          </View>
          {booking.status === "pending" && (
            <View style={styles.bookingActions}>
              <Pressable
                onPress={() => handleBookingAction(booking.id, "confirm")}
                style={[styles.actionButton, { backgroundColor: "#34C759" }]}
              >
                <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => handleBookingAction(booking.id, "cancel")}
                style={[styles.actionButton, { backgroundColor: "#FF3B3020" }]}
              >
                <Text style={[styles.actionButtonText, { color: "#FF3B30" }]}>Decline</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    });
  };

  const renderServicesTab = () => {
    if (services.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="package" size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No services yet</Text>
          <Text style={styles.emptySubtitle}>Add services that clients can book</Text>
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

  const handleSaveHours = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setSaving(true);
      const photographerHours: PhotographerHours[] = hours.map(h => ({
        dayOfWeek: h.dayOfWeek,
        isAvailable: h.isAvailable,
        startTime: h.startTime,
        endTime: h.endTime,
      }));
      await api.updatePhotographerHours(token, photographerHours);
      Alert.alert("Success", "Your availability has been updated");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save hours");
    } finally {
      setSaving(false);
    }
  };

  const renderHoursTab = () => (
    <HoursEditor
      hours={hours}
      onChange={setHours}
      onSave={handleSaveHours}
      isSaving={saving}
      title="Availability"
      description="Set your available hours for bookings"
    />
  );

  const renderProfileTab = () => (
    <View style={styles.profileForm}>
      <View style={styles.inputRow}>
        <View style={[styles.formGroup, styles.inputHalf]}>
          <Text style={styles.formLabel}>Display Name</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.name}
            onChangeText={(text) => setEditProfile({ ...editProfile, name: text })}
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        <View style={[styles.formGroup, styles.inputHalf]}>
          <Text style={styles.formLabel}>Hourly Rate ($)</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.hourlyRate}
            onChangeText={(text) => setEditProfile({ ...editProfile, hourlyRate: text })}
            placeholder="150"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Bio</Text>
        <TextInput
          style={[styles.formInput, styles.formTextarea]}
          value={editProfile.bio}
          onChangeText={(text) => setEditProfile({ ...editProfile, bio: text })}
          placeholder="Tell clients about yourself and your photography style..."
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
            placeholder="New York"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        <View style={[styles.formGroup, styles.inputHalf]}>
          <Text style={styles.formLabel}>State</Text>
          <TextInput
            style={styles.formInput}
            value={editProfile.state}
            onChangeText={(text) => setEditProfile({ ...editProfile, state: text })}
            placeholder="NY"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Portfolio URL</Text>
        <TextInput
          style={styles.formInput}
          value={editProfile.portfolioUrl}
          onChangeText={(text) => setEditProfile({ ...editProfile, portfolioUrl: text })}
          placeholder="https://yourportfolio.com"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Specialties</Text>
        <View style={styles.specialtiesGrid}>
          {SPECIALTIES.map(specialty => (
            <Pressable
              key={specialty}
              onPress={() => toggleSpecialty(specialty)}
              style={[
                styles.specialtyChip,
                editProfile.specialties.includes(specialty) && styles.specialtyChipActive,
              ]}
            >
              <Text style={[
                styles.specialtyChipText,
                editProfile.specialties.includes(specialty) && styles.specialtyChipTextActive,
              ]}>
                {specialty}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={handleSaveProfile} style={styles.saveButton} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Feather name="user" size={16} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Save Profile</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "bookings":
        return renderBookingsTab();
      case "services":
        return renderServicesTab();
      case "hours":
        return renderHoursTab();
      case "storefront":
        return (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="shopping-bag" size={24} color={theme.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Storefront coming soon</Text>
            <Text style={styles.emptySubtitle}>Customize how clients see your profile</Text>
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{profile?.name || "Photographer"}</Text>
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
              Connect your Stripe account to start receiving payments from bookings. This is required before clients can book your services.
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
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#34C75920" }]}>
            <Feather name="calendar" size={14} color="#34C759" />
          </View>
          <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
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
            <Text style={styles.sectionTitle}>Profile Overview</Text>
            <View style={styles.profileInfo}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {profile?.name?.charAt(0)?.toUpperCase() || "P"}
                </Text>
              </View>
              <View>
                <Text style={styles.profileName}>{profile?.name}</Text>
                <Text style={styles.profileRate}>${profile?.hourlyRate}/hour</Text>
              </View>
            </View>
            <Pressable style={styles.portfolioLink}>
              <Feather name="external-link" size={14} color={theme.primary} />
              <Text style={styles.portfolioLinkText}>View Portfolio</Text>
            </Pressable>
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
            <View style={styles.miniStatCard}>
              <View style={[styles.miniStatIcon, { backgroundColor: "#34C75920" }]}>
                <Feather name="camera" size={14} color="#34C759" />
              </View>
              <View>
                <Text style={styles.miniStatValue}>{stats.completedShoots}</Text>
                <Text style={styles.miniStatLabel}>Completed Shoots</Text>
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
            <View style={styles.tabBar}>
              {(["bookings", "services", "hours", "storefront", "profile"] as TabType[]).map(tab => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, activeTab === tab && styles.activeTab]}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {tab === "hours" ? (
                      <Feather name="clock" size={12} color={activeTab === tab ? theme.primary : theme.textSecondary} />
                    ) : null}
                    {" "}{tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
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

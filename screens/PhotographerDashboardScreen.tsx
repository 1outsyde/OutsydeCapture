import React, { useState, useEffect, useCallback } from "react";
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
  Modal,
  TextInput,
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
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import HoursEditor, { DayHours, getDefaultHours } from "@/components/HoursEditor";

const SPECIALTIES = [
  "Portraits", "Weddings", "Events", "Products",
  "Fashion", "Real Estate", "Concerts", "Sports",
];

type ModalType = "profile" | "hours" | "services" | "bookings" | null;

export default function PhotographerDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, logout, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

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
      const photographer = await api.getPhotographerMe(token) as any;
      
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

      try {
        const { bookings: bookingsData } = await api.getPhotographerMeBookings(token);
        setBookings(bookingsData.map((b: any) => ({
          id: b.id,
          clientName: b.customerName || b.clientName || "Client",
          clientAvatar: b.customerAvatar || b.clientAvatar,
          date: b.date,
          time: b.startTime || b.time,
          sessionType: b.serviceName || b.sessionType || "Session",
          status: b.status,
          amount: b.totalAmount ? b.totalAmount / 100 : (b.amount || 0),
        })));
      } catch {
        setBookings([]);
      }

      try {
        const { services: servicesData } = await api.getPhotographerMeServices(token);
        setServices(servicesData.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || "",
          duration: s.durationMinutes || s.estimatedDurationMinutes || 60,
          price: s.priceInCents ? s.priceInCents / 100 : (s.priceCents ? s.priceCents / 100 : 0),
          isActive: s.status === "active" || s.isActive || true,
        })));
      } catch {
        setServices([]);
      }

      try {
        const { availability } = await api.getPhotographerMeAvailability(token);
        if (availability && availability.length > 0) {
          setHours(availability.map((a: any) => ({
            dayOfWeek: a.dayOfWeek,
            isAvailable: a.isAvailable !== false,
            startTime: a.startTime,
            endTime: a.endTime,
          })));
        }
      } catch {
        // Keep default hours
      }

    } catch (error) {
      console.error("Failed to fetch photographer dashboard:", error);
      setProfile({
        id: "",
        name: user?.firstName || "Photographer",
        hourlyRate: 0,
        specialties: [],
        stripeConnected: false,
      });
    } finally {
      setLoading(false);
    }
  }, [getToken, user?.firstName]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
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
    } catch {
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
      setActiveModal(null);
      fetchDashboard();
    } catch {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
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
      setActiveModal(null);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save hours");
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
      fetchDashboard();
    } catch {
      Alert.alert("Error", `Failed to ${action} booking`);
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

  const setupItems = [
    { 
      key: "profile", 
      label: "Profile details", 
      complete: hasProfileDetails,
      action: () => setActiveModal("profile"),
    },
    { 
      key: "availability", 
      label: "Availability", 
      complete: hasAvailabilitySet,
      action: () => setActiveModal("hours"),
    },
    { 
      key: "stripe", 
      label: "Stripe payments", 
      complete: hasStripeConnected,
      action: handleConnectStripe,
    },
  ];

  const allSetupComplete = setupItems.every(item => item.complete);
  const statusText = allSetupComplete ? "Active" : "Pending Setup";
  const statusColor = allSetupComplete ? "#34C759" : "#FF9500";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollContent: {
      paddingBottom: insets.bottom + 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + 16,
      paddingBottom: 20,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
      letterSpacing: -0.5,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: statusColor + "20",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: statusColor,
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
      color: statusColor,
    },
    logoutButton: {
      padding: 8,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.text,
      letterSpacing: -0.3,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    setupCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 16,
      padding: 20,
    },
    setupItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + "40",
    },
    setupItemLast: {
      borderBottomWidth: 0,
    },
    setupIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    setupIconComplete: {
      backgroundColor: "#34C75920",
    },
    setupIconIncomplete: {
      backgroundColor: theme.backgroundSecondary,
      borderWidth: 2,
      borderColor: theme.border,
    },
    setupLabel: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
    },
    setupLabelComplete: {
      color: theme.textSecondary,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    statCard: {
      width: "48%",
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 16,
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    statLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    statValue: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
      letterSpacing: -0.5,
    },
    profileCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 16,
      padding: 20,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    profileAvatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    profileAvatarText: {
      fontSize: 24,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    profileRate: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: "500",
      marginTop: 2,
    },
    profileLocation: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    profileBio: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border + "40",
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 20,
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 8,
    },
    quickActionsRow: {
      flexDirection: "row",
      gap: 12,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    quickActionLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.text,
      textAlign: "center",
    },
    quickActionCount: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    emptyCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 24,
      alignItems: "center",
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
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.backgroundRoot,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + "40",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalScroll: {
      padding: 20,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
    },
    formTextarea: {
      minHeight: 100,
      textAlignVertical: "top",
    },
    formRow: {
      flexDirection: "row",
      gap: 12,
    },
    formHalf: {
      flex: 1,
    },
    specialtiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    specialtyChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.border,
    },
    specialtyChipActive: {
      backgroundColor: theme.primary + "20",
      borderColor: theme.primary,
    },
    specialtyChipText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    specialtyChipTextActive: {
      color: theme.primary,
      fontWeight: "500",
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 8,
      marginBottom: insets.bottom + 20,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 8,
    },
    bookingCard: {
      backgroundColor: theme.backgroundDefault,
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
      backgroundColor: theme.primary + "30",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    bookingAvatarText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.primary,
    },
    bookingInfo: {
      flex: 1,
    },
    bookingClient: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    bookingService: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    bookingAmount: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.primary,
    },
    bookingDetails: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border + "30",
    },
    bookingDate: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 16,
    },
    bookingDateText: {
      fontSize: 13,
      color: theme.textSecondary,
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
    bookingConfirmButton: {
      backgroundColor: "#34C759",
    },
    bookingDeclineButton: {
      backgroundColor: theme.backgroundSecondary,
    },
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
  });

  const renderProfileModal = () => (
    <Modal visible={activeModal === "profile"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.formLabel}>Display Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editProfile.name}
                  onChangeText={(text) => setEditProfile({ ...editProfile, name: text })}
                  placeholder="Your name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.formGroup, styles.formHalf]}>
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
                placeholder="Tell clients about yourself..."
                placeholderTextColor={theme.textSecondary}
                multiline
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.formLabel}>City</Text>
                <TextInput
                  style={styles.formInput}
                  value={editProfile.city}
                  onChangeText={(text) => setEditProfile({ ...editProfile, city: text })}
                  placeholder="New York"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={[styles.formGroup, styles.formHalf]}>
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
                autoCapitalize="none"
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
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderHoursModal = () => (
    <Modal visible={activeModal === "hours"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Availability</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <HoursEditor
              hours={hours}
              onChange={setHours}
              onSave={handleSaveHours}
              isSaving={saving}
              title=""
              description="Set your available hours for client bookings"
            />
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderBookingsModal = () => (
    <Modal visible={activeModal === "bookings"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bookings</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {bookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="calendar" size={24} color={theme.textSecondary} />
                </View>
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              bookings.map(booking => {
                const isPending = booking.status === "pending";
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case "confirmed": return "#34C759";
                    case "pending": return "#FF9500";
                    case "cancelled": return "#FF3B30";
                    default: return theme.textSecondary;
                  }
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
                      <Text style={styles.bookingAmount}>${booking.amount}</Text>
                    </View>
                    <View style={styles.bookingDetails}>
                      <View style={styles.bookingDate}>
                        <Feather name="calendar" size={14} color={theme.textSecondary} />
                        <Text style={styles.bookingDateText}>{booking.date}</Text>
                      </View>
                      <View style={styles.bookingDate}>
                        <Feather name="clock" size={14} color={theme.textSecondary} />
                        <Text style={styles.bookingDateText}>{booking.time}</Text>
                      </View>
                      <View style={[styles.bookingStatusBadge, { backgroundColor: getStatusColor(booking.status) + "20" }]}>
                        <Text style={[styles.bookingStatusText, { color: getStatusColor(booking.status) }]}>
                          {booking.status}
                        </Text>
                      </View>
                    </View>
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
                          <Text style={[styles.bookingActionText, { color: theme.text }]}>Decline</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderServicesModal = () => (
    <Modal visible={activeModal === "services"} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Services</Text>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {services.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="camera" size={24} color={theme.textSecondary} />
                </View>
                <Text style={styles.emptyText}>No services added yet</Text>
              </View>
            ) : (
              services.map(service => (
                <View key={service.id} style={styles.bookingCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingClient}>{service.name}</Text>
                      <Text style={[styles.bookingService, { marginTop: 4 }]}>{service.description}</Text>
                    </View>
                    <Text style={styles.bookingAmount}>${service.price}</Text>
                  </View>
                  <View style={[styles.bookingDetails, { marginTop: 12 }]}>
                    <View style={styles.bookingDate}>
                      <Feather name="clock" size={14} color={theme.textSecondary} />
                      <Text style={styles.bookingDateText}>{service.duration} min</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{profile?.name || "Photographer"}</Text>
            <View style={styles.headerRow}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Feather name="log-out" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Setup Progress */}
        {!allSetupComplete && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Setup Progress</Text>
                <Text style={styles.sectionSubtitle}>Complete these to start receiving bookings</Text>
              </View>
            </View>
            <View style={styles.setupCard}>
              {setupItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={item.action}
                  style={[
                    styles.setupItem,
                    index === setupItems.length - 1 && styles.setupItemLast,
                  ]}
                >
                  <View style={[
                    styles.setupIcon,
                    item.complete ? styles.setupIconComplete : styles.setupIconIncomplete,
                  ]}>
                    {item.complete ? (
                      <Feather name="check" size={14} color="#34C759" />
                    ) : null}
                  </View>
                  <Text style={[
                    styles.setupLabel,
                    item.complete && styles.setupLabelComplete,
                  ]}>
                    {item.label}
                  </Text>
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={[styles.statsGrid, { marginTop: 12 }]}>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="dollar-sign" size={16} color={theme.primary} />
                </View>
                <Text style={styles.statLabel}>Earnings</Text>
              </View>
              <Text style={styles.statValue}>${stats.earnings}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: "#34C75920" }]}>
                  <Feather name="calendar" size={16} color="#34C759" />
                </View>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: "#007AFF20" }]}>
                  <Feather name="message-circle" size={16} color="#007AFF" />
                </View>
                <Text style={styles.statLabel}>Messages</Text>
              </View>
              <Text style={styles.statValue}>{stats.unreadMessages}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: "#FF950020" }]}>
                  <Feather name="star" size={16} color="#FF9500" />
                </View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : "N/A"}</Text>
            </View>
          </View>
        </View>

        {/* Profile Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={[styles.profileCard, { marginTop: 12 }]}>
            <View style={styles.profileHeader}>
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.profileAvatarImage} />
              ) : (
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {profile?.name?.charAt(0)?.toUpperCase() || "P"}
                  </Text>
                </View>
              )}
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
            {profile?.bio && (
              <Text style={styles.profileBio} numberOfLines={3}>{profile.bio}</Text>
            )}
            <Pressable onPress={() => setActiveModal("profile")} style={styles.editButton}>
              <Feather name="edit-2" size={16} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={[styles.quickActionsRow, { marginTop: 12 }]}>
            <Pressable onPress={() => setActiveModal("bookings")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: "#34C75920" }]}>
                <Feather name="calendar" size={22} color="#34C759" />
              </View>
              <Text style={styles.quickActionLabel}>Bookings</Text>
              <Text style={styles.quickActionCount}>{bookings.length} total</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("services")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="camera" size={22} color={theme.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Services</Text>
              <Text style={styles.quickActionCount}>{services.length} active</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("hours")} style={styles.quickActionCard}>
              <View style={[styles.quickActionIcon, { backgroundColor: "#007AFF20" }]}>
                <Feather name="clock" size={22} color="#007AFF" />
              </View>
              <Text style={styles.quickActionLabel}>Hours</Text>
              <Text style={styles.quickActionCount}>
                {hasAvailabilitySet ? "Set" : "Not set"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {renderProfileModal()}
      {renderHoursModal()}
      {renderBookingsModal()}
      {renderServicesModal()}
    </>
  );
}

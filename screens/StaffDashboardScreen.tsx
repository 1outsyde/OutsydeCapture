import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import api, {
  StaffMemberProfile,
  StaffBooking,
  StaffAvailabilitySlot,
  VendorService,
} from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import ProviderCalendar, {
  CalendarBooking,
  CalendarBlockedDate,
  DayAvailability,
} from "@/components/ProviderCalendar";
import DateBlocker, { BlockedDate } from "@/components/DateBlocker";

type ModalType = "bookings" | "services" | "hours" | "blocked" | null;

const TIME_OPTIONS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];

// Matches BusinessDashboardScreen.tsx's DASHBOARD_COLORS exactly (kept as a local,
// self-contained copy per the earlier decision not to extract/import from or
// touch BusinessDashboardScreen.tsx).
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

const convertTo24Hour = (time12: string): string => {
  const [time, period] = time12.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const convertTo12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatCurrency = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

export default function StaffDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const [staff, setStaff] = useState<StaffMemberProfile | null>(null);
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [availability, setAvailability] = useState<StaffAvailabilitySlot[]>([]);
  const [services, setServices] = useState<VendorService[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, thisMonth: 0, pending: 0 });

  // "Base Hours" add-slot form state (a specific date marked available — this
  // backend has no weekly-recurring hours concept for staff, unlike the
  // business/photographer HoursEditor, so this is a simple per-date add).
  const [addingHours, setAddingHours] = useState(false);
  const [hoursDate, setHoursDate] = useState("");
  const [hoursStartTime, setHoursStartTime] = useState("9:00 AM");
  const [hoursEndTime, setHoursEndTime] = useState("5:00 PM");
  const [showHoursTimePicker, setShowHoursTimePicker] = useState<"start" | "end" | null>(null);
  const [savingHours, setSavingHours] = useState(false);
  const [savingBlocked, setSavingBlocked] = useState(false);

  const businessId = staff?.businessId || user?.staffBusinessId;

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const staffRes = await api.getStaffMe(token, user?.staffBusinessId);
      const staffData = staffRes.staff;
      setStaff(staffData);

      const [bookingsRes, availabilityRes, earningsRes, servicesRes] = await Promise.all([
        api.getStaffMyBookings(token, staffData.businessId).catch(() => ({ bookings: [] })),
        api.getStaffMyAvailability(token, undefined, undefined, staffData.businessId).catch(() => ({ availability: [] })),
        api.getStaffMyEarnings(token, staffData.businessId).catch(() => ({ total: 0, thisMonth: 0, pending: 0 })),
        api.getStaffMyServices(token, staffData.businessId).catch(() => ({ services: [] })),
      ]);

      setBookings(bookingsRes.bookings || []);
      setAvailability(availabilityRes.availability || []);
      setEarnings(earningsRes);
      setServices(servicesRes.services || []);
    } catch (error) {
      console.error("[StaffDashboard] Failed to load:", error);
      Alert.alert("Unable to load dashboard", "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, user?.staffBusinessId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const serviceNameFor = (serviceId: string): string =>
    services.find((s) => String(s.id) === String(serviceId))?.name || "Service";

  const upcomingBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "pending",
  );

  // Base-hours slots — this backend has no weekly-recurring model for staff, only
  // specific-date "available" rows, so this approximates ProviderCalendar's
  // day-of-week weeklyAvailability prop from whichever dates currently have an
  // "available" row (first match per weekday). Real per-date detail lives in
  // the Base Hours modal list below, not the calendar's weekly grid.
  const availableSlots = availability.filter((a) => a.slotType === "available");
  const blockedSlots = availability.filter((a) => a.slotType === "blocked");

  const weeklyAvailability: DayAvailability[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const match = availableSlots.find((a) => new Date(`${a.date}T00:00:00`).getDay() === dayOfWeek);
    return {
      dayOfWeek,
      isAvailable: !!match,
      windows: match ? [{ startTime: match.startTime, endTime: match.endTime }] : [],
    };
  });

  const calendarBookings: CalendarBooking[] = bookings.map((b) => ({
    id: b.id,
    date: b.appointmentDate,
    startTime: b.appointmentTime,
    endTime: b.appointmentEndTime || undefined,
    clientName: "Client",
    serviceName: serviceNameFor(b.serviceId),
    status: b.status as CalendarBooking["status"],
    amount: b.totalPrice,
  }));

  const calendarBlockedDates: CalendarBlockedDate[] = blockedSlots.map((slot) => ({
    id: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    isFullDay: slot.startTime === "00:00" && slot.endTime === "23:59",
    reason: slot.notes || undefined,
  }));

  const dateBlockerBlockedDates: BlockedDate[] = blockedSlots.map((slot) => ({
    id: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    isFullDay: slot.startTime === "00:00" && slot.endTime === "23:59",
    reason: slot.notes || undefined,
  }));

  const handleAddBlockedDate = async (blocked: BlockedDate) => {
    const token = await getToken();
    if (!token || !businessId) return;
    setSavingBlocked(true);
    try {
      const { availability: created } = await api.createStaffAvailability(token, {
        date: blocked.date,
        startTime: blocked.isFullDay ? "00:00" : blocked.startTime || "00:00",
        endTime: blocked.isFullDay ? "23:59" : blocked.endTime || "23:59",
        slotType: "blocked",
        businessId,
      });
      setAvailability((prev) => [...prev, { ...created, notes: blocked.reason || created.notes }]);
    } catch (error) {
      console.error("[StaffDashboard] Failed to block date:", error);
      Alert.alert("Error", "Failed to block that date. Please try again.");
    } finally {
      setSavingBlocked(false);
    }
  };

  const handleRemoveBlockedDate = async (index: number) => {
    const slot = blockedSlots[index];
    if (!slot) return;
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteStaffAvailability(token, slot.id, businessId);
      setAvailability((prev) => prev.filter((a) => a.id !== slot.id));
    } catch (error) {
      console.error("[StaffDashboard] Failed to unblock date:", error);
      Alert.alert("Error", "Failed to remove that block. Please try again.");
    }
  };

  const handleAddAvailability = async () => {
    if (!hoursDate) {
      Alert.alert("Date required", "Please enter a date (YYYY-MM-DD).");
      return;
    }
    const token = await getToken();
    if (!token || !businessId) return;
    setSavingHours(true);
    try {
      const { availability: created } = await api.createStaffAvailability(token, {
        date: hoursDate,
        startTime: convertTo24Hour(hoursStartTime),
        endTime: convertTo24Hour(hoursEndTime),
        slotType: "available",
        businessId,
      });
      setAvailability((prev) => [...prev, created]);
      setAddingHours(false);
      setHoursDate("");
    } catch (error) {
      console.error("[StaffDashboard] Failed to add availability:", error);
      Alert.alert("Error", "Failed to add that availability. Please try again.");
    } finally {
      setSavingHours(false);
    }
  };

  const handleRemoveAvailability = async (slotId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteStaffAvailability(token, slotId, businessId);
      setAvailability((prev) => prev.filter((a) => a.id !== slotId));
    } catch (error) {
      console.error("[StaffDashboard] Failed to remove availability:", error);
      Alert.alert("Error", "Failed to remove that slot. Please try again.");
    }
  };

  const styles = createStyles(theme, insets);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={DASHBOARD_COLORS.gold} />
      </View>
    );
  }

  if (!staff) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: Spacing.xl }]}>
        <Text style={{ color: DASHBOARD_COLORS.cream, fontSize: 16, fontWeight: "600", textAlign: "center" }}>
          Staff account not found
        </Text>
        <Text style={{ color: DASHBOARD_COLORS.creamDim, fontSize: 14, textAlign: "center", marginTop: 8 }}>
          Please contact your business owner if you believe this is a mistake.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DASHBOARD_COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={DASHBOARD_COLORS.cream} />
          </Pressable>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{staff.displayName || "Staff Dashboard"}</Text>
            <Text style={styles.headerSubtitle}>
              {staff.stripeOnboardingComplete ? "Payouts connected" : "Payouts not connected"}
            </Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Feather name="log-out" size={22} color={DASHBOARD_COLORS.creamDim} />
          </Pressable>
        </View>

        {!staff.stripeOnboardingComplete ? (
          <View style={styles.section}>
            <View style={styles.setupCard}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Feather name="credit-card" size={20} color={DASHBOARD_COLORS.gold} />
                <Text style={[styles.sectionTitle, { fontSize: 16, marginLeft: 10 }]}>Connect Stripe</Text>
              </View>
              <Text style={{ color: DASHBOARD_COLORS.creamDim, fontSize: 13 }}>
                Finish payout setup from the Stripe onboarding screen to receive direct payments for your bookings.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>OVERVIEW</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Feather name="calendar" size={14} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.statValue}>{upcomingBookings.length}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Bookings</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Feather name="dollar-sign" size={14} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.statValue}>{formatCurrency(earnings.thisMonth)}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>This Month</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Feather name="clock" size={14} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.statValue}>{formatCurrency(earnings.pending)}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Feather name="star" size={14} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.statValue}>
                {staff.rating && staff.rating > 0 ? staff.rating.toFixed(1) : "N/A"}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>Rating</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>QUICK ACTIONS</Text>
          </View>
          <View style={styles.quickActionsRow}>
            <Pressable onPress={() => setActiveModal("bookings")} style={styles.quickActionCard}>
              <View style={styles.quickActionIcon}>
                <Feather name="calendar" size={22} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.quickActionLabel}>Bookings</Text>
              <Text style={styles.quickActionCount}>{bookings.length} total</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("services")} style={styles.quickActionCard}>
              <View style={styles.quickActionIcon}>
                <Feather name="scissors" size={22} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.quickActionLabel}>Services</Text>
              <Text style={styles.quickActionCount}>{services.length} assigned</Text>
            </Pressable>
          </View>
          <View style={[styles.quickActionsRow, { marginTop: 12 }]}>
            <Pressable onPress={() => setActiveModal("hours")} style={styles.quickActionCard}>
              <View style={styles.quickActionIcon}>
                <Feather name="clock" size={22} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.quickActionLabel}>Base Hours</Text>
              <Text style={styles.quickActionCount}>{availableSlots.length} set</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal("blocked")} style={styles.quickActionCard}>
              <View style={styles.quickActionIcon}>
                <Feather name="x-circle" size={22} color={DASHBOARD_COLORS.gold} />
              </View>
              <Text style={styles.quickActionLabel}>Block Dates</Text>
              <Text style={styles.quickActionCount}>{blockedSlots.length} blocked</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderAccent} />
            <Text style={styles.sectionHeaderText}>CALENDAR</Text>
          </View>
          <View style={{ marginTop: 12 }}>
            <ProviderCalendar
              bookings={calendarBookings}
              blockedDates={calendarBlockedDates}
              weeklyAvailability={weeklyAvailability}
              onBlockDate={(date, isFullDay, startTime, endTime, reason) =>
                handleAddBlockedDate({ date, isFullDay, startTime, endTime, reason })
              }
              onUnblockDate={(blockId) => {
                const index = blockedSlots.findIndex((s) => s.id === blockId);
                if (index >= 0) handleRemoveBlockedDate(index);
              }}
              onBookingPress={() => setActiveModal("bookings")}
              monthsAhead={3}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bookings modal */}
      <Modal
        visible={activeModal === "bookings"}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActiveModal(null)} />
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Bookings</Text>
              <Pressable onPress={() => setActiveModal(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: Spacing.xl }}>
              {bookings.length === 0 ? (
                <Text style={styles.emptyText}>No bookings yet</Text>
              ) : (
                bookings.map((booking) => (
                  <View key={booking.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listRowTitle}>
                        {formatDateLabel(booking.appointmentDate)} · {booking.appointmentTime}
                      </Text>
                      <Text style={styles.listRowSubtitle}>{serviceNameFor(booking.serviceId)}</Text>
                      {booking.staffPayout ? (
                        <Text style={[styles.listRowSubtitle, { color: "#34C759" }]}>
                          Your payout: {formatCurrency(booking.staffPayout)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{booking.status}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Services modal (read-only) */}
      <Modal
        visible={activeModal === "services"}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActiveModal(null)} />
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Services</Text>
              <Pressable onPress={() => setActiveModal(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: Spacing.xl }}>
              {services.length === 0 ? (
                <Text style={styles.emptyText}>
                  No services assigned yet — ask your business owner to assign services to your profile.
                </Text>
              ) : (
                services.map((service) => (
                  <View key={service.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listRowTitle}>{service.name}</Text>
                      {service.durationMinutes ? (
                        <Text style={styles.listRowSubtitle}>{service.durationMinutes} min</Text>
                      ) : null}
                    </View>
                    <Text style={styles.listRowTitle}>{formatCurrency(service.priceCents)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Base Hours modal */}
      <Modal
        visible={activeModal === "hours"}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActiveModal(null)} />
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + Spacing.lg, maxHeight: "85%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Base Hours</Text>
              <Pressable onPress={() => setActiveModal(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: Spacing.xl }}>
              <Text style={styles.modalDescription}>
                Add the specific dates you're available for bookings.
              </Text>

              {!addingHours ? (
                <Pressable style={styles.addButton} onPress={() => setAddingHours(true)}>
                  <Feather name="plus" size={18} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Add Availability</Text>
                </Pressable>
              ) : (
                <View style={styles.addForm}>
                  <Text style={styles.formLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={hoursDate}
                    onChangeText={setHoursDate}
                    placeholder="2026-08-15"
                    placeholderTextColor={theme.textSecondary}
                    style={styles.textInput}
                  />
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                    <Pressable
                      style={[styles.timeButton, { flex: 1 }]}
                      onPress={() => setShowHoursTimePicker("start")}
                    >
                      <Text style={{ color: theme.text, fontWeight: "500" }}>{hoursStartTime}</Text>
                      <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                    </Pressable>
                    <Text style={{ alignSelf: "center", color: theme.textSecondary }}>to</Text>
                    <Pressable
                      style={[styles.timeButton, { flex: 1 }]}
                      onPress={() => setShowHoursTimePicker("end")}
                    >
                      <Text style={{ color: theme.text, fontWeight: "500" }}>{hoursEndTime}</Text>
                      <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  {showHoursTimePicker ? (
                    <ScrollView style={{ maxHeight: 160, marginTop: 12 }}>
                      {TIME_OPTIONS.map((time) => (
                        <Pressable
                          key={time}
                          onPress={() => {
                            if (showHoursTimePicker === "start") setHoursStartTime(time);
                            else setHoursEndTime(time);
                            setShowHoursTimePicker(null);
                          }}
                          style={styles.timeOptionRow}
                        >
                          <Text style={{ color: theme.text }}>{time}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}

                  <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                    <Pressable
                      style={[styles.secondaryButton, { flex: 1 }]}
                      onPress={() => {
                        setAddingHours(false);
                        setHoursDate("");
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.addButton, { flex: 1, marginTop: 0 }]}
                      onPress={handleAddAvailability}
                      disabled={savingHours}
                    >
                      {savingHours ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.addButtonText}>Save</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              <Text style={[styles.formLabel, { marginTop: 20 }]}>Upcoming Availability</Text>
              {availableSlots.length === 0 ? (
                <Text style={styles.emptyText}>No availability set yet</Text>
              ) : (
                availableSlots.map((slot) => (
                  <View key={slot.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listRowTitle}>{formatDateLabel(slot.date)}</Text>
                      <Text style={styles.listRowSubtitle}>
                        {convertTo12Hour(slot.startTime)} - {convertTo12Hour(slot.endTime)}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRemoveAvailability(slot.id)}>
                      <Feather name="trash-2" size={18} color="#FF3B30" />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Block Dates modal — reuses the same DateBlocker component as Photographer Dashboard */}
      <Modal
        visible={activeModal === "blocked"}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActiveModal(null)} />
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + Spacing.lg, maxHeight: "90%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Block Dates</Text>
              <Pressable onPress={() => setActiveModal(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: Spacing.xl }}>
              <DateBlocker
                blockedDates={dateBlockerBlockedDates}
                onAdd={handleAddBlockedDate}
                onRemove={handleRemoveBlockedDate}
                isSaving={savingBlocked}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(theme: any, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    // Container/header/stat-card/section-header/quick-action styling below matches
    // BusinessDashboardScreen.tsx's DASHBOARD_COLORS palette exactly (gold/cream on a
    // warm dark background) — modal-internal styles further down stay theme-adaptive,
    // since Business Dashboard has no equivalent modals to match against.
    container: {
      flex: 1,
      backgroundColor: DASHBOARD_COLORS.background,
    },
    scrollContent: {
      paddingBottom: insets.bottom + 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 12,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    logoutButton: {
      padding: 8,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: DASHBOARD_COLORS.cream,
    },
    headerSubtitle: {
      fontSize: 13,
      color: DASHBOARD_COLORS.creamDim,
      marginTop: 2,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: DASHBOARD_COLORS.cream,
      letterSpacing: -0.3,
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
    setupCard: {
      backgroundColor: "rgba(201,147,58,0.08)",
      borderRadius: 12,
      borderLeftWidth: 3,
      borderLeftColor: DASHBOARD_COLORS.gold,
      padding: 16,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      width: "48%",
      backgroundColor: "#111411",
      borderColor: DASHBOARD_COLORS.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      alignItems: "flex-start",
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
    },
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
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalContainer: {
      backgroundColor: theme.backgroundRoot,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: "80%",
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    modalDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      paddingVertical: Spacing.lg,
      textAlign: "center",
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    listRowTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    listRowSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    statusPill: {
      backgroundColor: theme.primary + "20",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.primary,
      textTransform: "capitalize",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 8,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
      marginLeft: 8,
    },
    secondaryButton: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundSecondary,
      paddingVertical: 14,
      borderRadius: 12,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    addForm: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 14,
      padding: 16,
    },
    formLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: theme.backgroundSecondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
    },
    timeButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.backgroundSecondary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    timeOptionRow: {
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
  });
}

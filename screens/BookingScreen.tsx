import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { StyleSheet, View, Pressable, ScrollView, TextInput, Alert, Platform, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useNotifications } from "@/context/NotificationContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { AvailableSlot, BookingDraft, PhotographerService } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Booking">;

type BookingStep = "service" | "date" | "slot" | "review";

const HOLD_DURATION_SECONDS = 600;

// Type for photographer data that can come from route or API
type PhotographerData = {
  id: string;
  name: string;
  avatar?: string;
  specialty?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  bio?: string;
};

export default function BookingScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { photographer: routePhotographer, photographerId, preselectedServiceId } = route.params;
  const { getToken, isAuthenticated } = useAuth();
  const { addSession } = useData();
  const { addNotification } = useNotifications();
  const insets = useSafeAreaInsets();

  // State for photographer data (may need to be fetched)
  const [photographer, setPhotographer] = useState<PhotographerData | null>(
    routePhotographer || null
  );
  const [isLoadingPhotographer, setIsLoadingPhotographer] = useState(!routePhotographer && !!photographerId);

  const [step, setStep] = useState<BookingStep>(preselectedServiceId ? "date" : "service");
  const [selectedService, setSelectedService] = useState<PhotographerService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  
  const [services, setServices] = useState<PhotographerService[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [countdown, setCountdown] = useState<number>(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookedSessionId, setBookedSessionId] = useState<string>("");
  
  const [viewingMonth, setViewingMonth] = useState(() => new Date());

  // Fetch photographer data if not provided in route params
  useEffect(() => {
    const fetchPhotographerData = async () => {
      if (!routePhotographer && photographerId) {
        setIsLoadingPhotographer(true);
        try {
          const data = await api.getPhotographer(photographerId);
          setPhotographer({
            id: data.id,
            name: data.name || "Photographer",
            avatar: data.avatar,
            specialty: data.specialty,
            location: data.location || (data.city && data.state ? `${data.city}, ${data.state}` : undefined),
            rating: data.rating,
            reviewCount: data.reviewCount,
            priceRange: data.priceRange,
            bio: data.description,
          });
        } catch (e) {
          console.error("Failed to fetch photographer:", e);
          setError("Unable to load photographer details. Please try again.");
        } finally {
          setIsLoadingPhotographer(false);
        }
      }
    };
    fetchPhotographerData();
  }, [routePhotographer, photographerId]);

  // Fetch services once photographer data is available
  useEffect(() => {
    if (photographer) {
      fetchServices();
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [photographer?.id]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        cancelDraftIfExists();
      };
    }, [bookingDraft])
  );

  useEffect(() => {
    if (bookingDraft && bookingDraft.status === "held") {
      const expiresAt = new Date(bookingDraft.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remaining);

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            handleDraftExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [bookingDraft]);

  const cancelDraftIfExists = async () => {
    if (bookingDraft && bookingDraft.status === "held") {
      try {
        const token = await getToken();
        if (token) {
          await api.cancelBookingDraft(token, bookingDraft.id);
        }
      } catch (e) {
        console.log("Failed to cancel draft:", e);
      }
    }
  };

  const handleDraftExpired = () => {
    setBookingDraft(null);
    setSelectedSlot(null);
    setStep("slot");
    if (Platform.OS === "web") {
      window.alert("Your held slot has expired. Please select another time.");
    } else {
      Alert.alert("Slot Expired", "Your held slot has expired. Please select another time.");
    }
  };

  const fetchServices = async () => {
    if (!photographer) return;
    setIsLoadingServices(true);
    setError(null);
    try {
      const response = await api.getPhotographerPublicServices(photographer.id);
      const servicesList = Array.isArray(response) ? response : [];
      const activeServices = servicesList.filter(
        (s: any) => s.isActive && s.status === "active"
      );
      const mappedServices = activeServices.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        duration: s.durationMinutes || s.duration || 60,
        price: s.price || 0,
        isActive: s.isActive,
        status: s.status,
        category: s.category,
      }));
      setServices(mappedServices);
      
      // Auto-select service if preselectedServiceId is provided
      if (preselectedServiceId && mappedServices.length > 0) {
        const preselected = mappedServices.find((s: PhotographerService) => s.id === preselectedServiceId);
        if (preselected) {
          setSelectedService(preselected);
          // Fetch available dates for preselected service
          fetchAvailableDates(preselected.id);
        } else if (mappedServices.length === 1) {
          // If service not found but only one service exists, use that
          setSelectedService(mappedServices[0]);
          fetchAvailableDates(mappedServices[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch services:", e);
      setError("Unable to load services. Please try again.");
    } finally {
      setIsLoadingServices(false);
    }
  };

  const fetchAvailableDates = async (serviceId: string) => {
    if (!photographer) return;
    setIsLoadingDates(true);
    setError(null);
    try {
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const response = await api.getPhotographerAvailableDates(photographer.id, startDate, endDate);
      setAvailableDates(response.dates || []);
    } catch (e) {
      console.error("Failed to fetch available dates:", e);
      setError("Unable to load available dates. Please try again.");
    } finally {
      setIsLoadingDates(false);
    }
  };

  const fetchAvailableSlots = async (date: string) => {
    if (!photographer) return;
    setIsLoadingSlots(true);
    setError(null);
    setAvailableSlots([]);
    try {
      const response = await api.getPhotographerAvailableSlots(
        photographer.id,
        date,
        selectedService?.id
      );
      const openSlots = (response.slots || []).filter((s: AvailableSlot) => s.available);
      setAvailableSlots(openSlots);
    } catch (e) {
      console.error("Failed to fetch slots:", e);
      setError("Unable to load time slots. Please try again.");
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const createDraft = async (slot: AvailableSlot) => {
    if (!selectedService || !selectedDate) return;
    
    const token = await getToken();
    if (!token) {
      if (Platform.OS === "web") {
        window.alert("Please sign in to book an appointment.");
      } else {
        Alert.alert("Sign In Required", "Please sign in to book an appointment.");
      }
      return;
    }

    if (!photographer) return;
    setIsCreatingDraft(true);
    setError(null);
    try {
      const response = await api.createBookingDraft(token, {
        photographerId: photographer.id,
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        location,
        notes,
      });
      setBookingDraft(response.draft);
      setSelectedSlot(slot);
      setStep("review");
    } catch (e: any) {
      console.error("Failed to create draft:", e);
      const message = e?.message || "Unable to hold this slot. It may have been taken.";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Slot Unavailable", message);
      }
      fetchAvailableSlots(selectedDate);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const confirmBooking = async () => {
    if (!bookingDraft || !selectedService || !selectedSlot) return;

    const token = await getToken();
    if (!token) return;

    setIsConfirming(true);
    try {
      const response = await api.confirmBookingDraft(token, bookingDraft.id);
      
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      const session = await addSession({
        photographerId: photographer?.id || "",
        photographerName: photographer?.name || "Photographer",
        photographerAvatar: photographer?.avatar || "",
        date: selectedDate,
        time: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        location,
        sessionType: selectedService.category || "portrait",
        notes,
        status: "upcoming",
        price: selectedService.price || bookingDraft.totalAmount,
      });

      await addNotification({
        type: "booking",
        title: "Booking Confirmed",
        body: `Your session with ${photographer?.name || "the photographer"} on ${formatDate(selectedDate)} has been confirmed.`,
      });

      setBookedSessionId(session.id);
      setShowSuccessModal(true);
    } catch (e: any) {
      console.error("Failed to confirm booking:", e);
      const message = e?.message || "Failed to confirm booking. Please try again.";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSelectService = (service: PhotographerService) => {
    setSelectedService(service);
    setSelectedDate("");
    setSelectedSlot(null);
    setBookingDraft(null);
    fetchAvailableDates(service.id);
    setStep("date");
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setBookingDraft(null);
    fetchAvailableSlots(date);
    setStep("slot");
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    createDraft(slot);
  };

  const handleBack = async () => {
    switch (step) {
      case "service":
        navigation.goBack();
        break;
      case "date":
        setStep("service");
        break;
      case "slot":
        setStep("date");
        break;
      case "review":
        await cancelDraftIfExists();
        setBookingDraft(null);
        setSelectedSlot(null);
        setStep("slot");
        break;
    }
  };

  const handlePayLater = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const handlePayNow = () => {
    const sessionPrice = selectedService?.price || bookingDraft?.totalAmount || 0;
    setShowSuccessModal(false);
    navigation.goBack();
    navigation.navigate("Payment", {
      sessionId: bookedSessionId,
      amount: sessionPrice,
      photographerName: photographer?.name || "Photographer",
      sessionDate: formatDate(selectedDate),
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentMonthLabel = useMemo(() => {
    return viewingMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [viewingMonth]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: Array<{ day: number; date: string; isAvailable: boolean; isPast: boolean }> = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, date: "", isAvailable: false, isPast: false });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split("T")[0];
      const isAvailable = availableDates.includes(dateStr);
      const isPast = date < now;
      days.push({ day: i, date: dateStr, isAvailable, isPast });
    }
    
    return days;
  }, [viewingMonth, availableDates]);

  const handlePrevMonth = () => {
    const now = new Date();
    const prev = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1);
    if (prev >= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setViewingMonth(prev);
    }
  };

  const handleNextMonth = () => {
    const maxMonth = new Date();
    maxMonth.setMonth(maxMonth.getMonth() + 2);
    const next = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 1);
    if (next <= maxMonth) {
      setViewingMonth(next);
    }
  };

  const canGoPrev = useMemo(() => {
    const now = new Date();
    const prev = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1);
    return prev >= new Date(now.getFullYear(), now.getMonth(), 1);
  }, [viewingMonth]);

  const canGoNext = useMemo(() => {
    const maxMonth = new Date();
    maxMonth.setMonth(maxMonth.getMonth() + 2);
    const next = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 1);
    return next <= maxMonth;
  }, [viewingMonth]);

  const renderStepIndicator = () => {
    const steps: BookingStep[] = ["service", "date", "slot", "review"];
    const stepIndex = steps.indexOf(step);
    
    return (
      <View style={styles.stepIndicator}>
        {steps.map((s, index) => (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor:
                    step === s
                      ? theme.primary
                      : stepIndex > index
                      ? theme.success
                      : theme.backgroundSecondary,
                },
              ]}
            >
              {stepIndex > index ? (
                <Feather name="check" size={14} color="#FFFFFF" />
              ) : (
                <ThemedText
                  type="caption"
                  style={{ color: step === s ? "#FFFFFF" : theme.textSecondary }}
                >
                  {index + 1}
                </ThemedText>
              )}
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor:
                      stepIndex > index ? theme.success : theme.backgroundSecondary,
                  },
                ]}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderServiceStep = () => {
    if (isLoadingServices) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
            Loading services...
          </ThemedText>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary, textAlign: "center" }}>
            {error}
          </ThemedText>
          <Pressable
            onPress={fetchServices}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="button" style={{ color: "#FFFFFF" }}>
              Try Again
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    if (services.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="camera-off" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary, textAlign: "center" }}>
            No services available.{"\n"}Please contact the photographer directly.
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>
          Select Service
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Choose the type of session you need
        </ThemedText>

        {services.map(service => (
          <Pressable
            key={service.id}
            onPress={() => handleSelectService(service)}
            style={({ pressed }) => [
              styles.serviceCard,
              {
                backgroundColor: selectedService?.id === service.id 
                  ? theme.primary + "15" 
                  : theme.backgroundDefault,
                borderColor: selectedService?.id === service.id 
                  ? theme.primary 
                  : "transparent",
                borderWidth: 2,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.serviceHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">{service.name}</ThemedText>
                {service.description && (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                    {service.description}
                  </ThemedText>
                )}
              </View>
              <View style={styles.servicePrice}>
                <ThemedText type="h4" style={{ color: theme.primary }}>
                  ${service.price}
                </ThemedText>
                {service.duration && (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {service.duration} min
                  </ThemedText>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderDateStep = () => {
    if (isLoadingDates) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
            Loading available dates...
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>
          Select Date
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          {selectedService?.name} - Choose an available date
        </ThemedText>

        <View style={styles.monthHeader}>
          <Pressable
            onPress={handlePrevMonth}
            disabled={!canGoPrev}
            style={[styles.monthArrow, { opacity: canGoPrev ? 1 : 0.3 }]}
          >
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4" style={styles.monthTitle}>
            {currentMonthLabel}
          </ThemedText>
          <Pressable
            onPress={handleNextMonth}
            disabled={!canGoNext}
            style={[styles.monthArrow, { opacity: canGoNext ? 1 : 0.3 }]}
          >
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekDays}>
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => (
            <ThemedText
              key={day}
              type="caption"
              style={[styles.weekDay, { color: theme.textSecondary }]}
            >
              {day}
            </ThemedText>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((item, index) => (
            <Pressable
              key={index}
              disabled={!item.isAvailable || item.isPast}
              onPress={() => handleSelectDate(item.date)}
              style={({ pressed }) => [
                styles.calendarDay,
                {
                  backgroundColor:
                    selectedDate === item.date
                      ? theme.primary
                      : item.isAvailable && !item.isPast
                      ? theme.backgroundDefault
                      : "transparent",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {item.day > 0 && (
                <ThemedText
                  type="body"
                  style={{
                    color:
                      selectedDate === item.date
                        ? "#FFFFFF"
                        : item.isPast || !item.isAvailable
                        ? theme.textSecondary
                        : theme.text,
                    opacity: item.isPast || !item.isAvailable ? 0.4 : 1,
                  }}
                >
                  {item.day}
                </ThemedText>
              )}
            </Pressable>
          ))}
        </View>

        {availableDates.length === 0 && (
          <View style={styles.noAvailabilityMessage}>
            <Feather name="calendar" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              No availability for this service.{"\n"}Please contact the photographer.
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  const renderSlotStep = () => {
    if (isLoadingSlots) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
            Loading available times...
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>
          Select Time
        </ThemedText>
        <ThemedText type="body" style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          {formatDate(selectedDate)}
        </ThemedText>

        {availableSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="clock" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              No available time slots for this date.{"\n"}Please select another date.
            </ThemedText>
            <Pressable
              onPress={() => setStep("date")}
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                Choose Another Date
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.timeSlots}>
            {availableSlots.map((slot, index) => (
              <Pressable
                key={`${slot.startTime}-${index}`}
                onPress={() => handleSelectSlot(slot)}
                disabled={isCreatingDraft}
                style={({ pressed }) => [
                  styles.timeSlot,
                  {
                    backgroundColor: theme.backgroundDefault,
                    opacity: pressed || isCreatingDraft ? 0.6 : 1,
                  },
                ]}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {isCreatingDraft && (
          <View style={styles.holdingOverlay}>
            <ActivityIndicator size="small" color={theme.primary} />
            <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
              Holding your slot...
            </ThemedText>
          </View>
        )}

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>
            Location (Optional)
          </ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Where should the session take place?"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.fieldContainer}>
          <ThemedText type="small" style={styles.label}>
            Notes (Optional)
          </ThemedText>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special requests or details..."
            placeholderTextColor={theme.textSecondary}
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  };

  const renderReviewStep = () => {
    if (!bookingDraft || !selectedService || !selectedSlot) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary, textAlign: "center" }}>
            No booking draft found. Please select a time slot again.
          </ThemedText>
          <Pressable
            onPress={() => setStep("slot")}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="button" style={{ color: "#FFFFFF" }}>
              Go Back
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View>
        <ThemedText type="h3" style={styles.stepTitle}>
          Review & Confirm
        </ThemedText>
        
        <View style={[styles.countdownBanner, { backgroundColor: countdown < 60 ? theme.error + "20" : theme.primary + "20" }]}>
          <Feather 
            name="clock" 
            size={20} 
            color={countdown < 60 ? theme.error : theme.primary} 
          />
          <ThemedText 
            type="body" 
            style={{ 
              marginLeft: Spacing.sm, 
              color: countdown < 60 ? theme.error : theme.primary,
              fontWeight: "600",
            }}
          >
            Slot held for {formatCountdown(countdown)}
          </ThemedText>
        </View>

        <View style={[styles.reviewCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.reviewHeader}>
            <Image
              source={{ uri: photographer?.avatar || "" }}
              style={styles.reviewAvatar}
              contentFit="cover"
            />
            <View>
              <ThemedText type="h4">{photographer?.name || "Photographer"}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {selectedService.name}
              </ThemedText>
            </View>
          </View>

          <View style={styles.reviewDivider} />

          <View style={styles.reviewItem}>
            <Feather name="calendar" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.reviewItemText}>
              {formatDate(selectedDate)}
            </ThemedText>
          </View>

          <View style={styles.reviewItem}>
            <Feather name="clock" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.reviewItemText}>
              {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
            </ThemedText>
          </View>

          {location && (
            <View style={styles.reviewItem}>
              <Feather name="map-pin" size={20} color={theme.primary} />
              <ThemedText type="body" style={styles.reviewItemText}>
                {location}
              </ThemedText>
            </View>
          )}

          {notes && (
            <View style={styles.reviewItem}>
              <Feather name="file-text" size={20} color={theme.primary} />
              <ThemedText type="body" style={styles.reviewItemText}>
                {notes}
              </ThemedText>
            </View>
          )}

          <View style={styles.reviewDivider} />

          <View style={styles.reviewTotal}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Total
            </ThemedText>
            <ThemedText type="h3" style={{ color: theme.primary }}>
              ${bookingDraft.totalAmount || selectedService.price}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case "service":
        return renderServiceStep();
      case "date":
        return renderDateStep();
      case "slot":
        return renderSlotStep();
      case "review":
        return renderReviewStep();
    }
  };

  const canConfirm = bookingDraft && bookingDraft.status === "held" && countdown > 0;

  // Show loading screen while fetching photographer data
  if (isLoadingPhotographer) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Loading photographer...
        </ThemedText>
      </ThemedView>
    );
  }

  // Show error state if photographer couldn't be loaded
  if (!photographer) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center", alignItems: "center", padding: Spacing.xl }]}>
        <Feather name="alert-circle" size={48} color={theme.error || "#EF4444"} />
        <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
          Photographer Not Found
        </ThemedText>
        <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center" }}>
          {error || "Unable to load photographer details. They may no longer be available."}
        </ThemedText>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            marginTop: Spacing.xl,
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.md,
            backgroundColor: theme.primary,
            borderRadius: BorderRadius.md,
          }}
        >
          <ThemedText type="body" style={{ color: "#FFFFFF" }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">Book Appointment</ThemedText>
        <View style={styles.headerButton} />
      </View>

      {renderStepIndicator()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>

      {step === "review" && (
        <View
          style={[
            styles.footer,
            { 
              backgroundColor: theme.background, 
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + Spacing.lg 
            },
          ]}
        >
          <View style={styles.footerContent}>
            <View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Total
              </ThemedText>
              <ThemedText type="h3" style={{ color: theme.primary }}>
                ${bookingDraft?.totalAmount || selectedService?.price || 0}
              </ThemedText>
            </View>
            <Pressable
              onPress={confirmBooking}
              disabled={!canConfirm || isConfirming}
              style={({ pressed }) => [
                styles.nextButton,
                {
                  backgroundColor: canConfirm ? theme.primary : theme.backgroundSecondary,
                  opacity: pressed || isConfirming ? 0.8 : 1,
                },
              ]}
            >
              {isConfirming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText type="button" style={{ color: canConfirm ? "#FFFFFF" : theme.textSecondary }}>
                  CONFIRM BOOKING
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handlePayLater}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check-circle" size={40} color={theme.success} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Booking Confirmed!
            </ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Your session with {photographer?.name || "the photographer"} has been booked for {selectedDate ? formatDate(selectedDate) : ""}.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={handlePayLater}
                style={[
                  styles.modalButton,
                  styles.modalButtonSecondary,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText type="button" style={{ color: theme.text }}>
                  Pay Later
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handlePayNow}
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.primary },
                ]}
              >
                <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                  Pay Now
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  retryButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  serviceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  servicePrice: {
    alignItems: "flex-end",
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  monthArrow: {
    padding: Spacing.sm,
  },
  monthTitle: {
    textAlign: "center",
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  noAvailabilityMessage: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  timeSlots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  timeSlot: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  holdingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  fieldContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  textArea: {
    height: 120,
    paddingTop: Spacing.md,
  },
  countdownBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  reviewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: Spacing.lg,
  },
  reviewItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  reviewItemText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  reviewTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 140,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
  },
  modalButtonSecondary: {},
  modalButtonPrimary: {},
});

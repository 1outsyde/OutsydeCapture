import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { VendorBookerAvailabilitySlot, BlockedDate } from "@/services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface PhotographerService {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  category?: string;
  isPromo?: boolean;
  promoPrice?: number;
  promoEndDate?: string;
}

export interface PhotographerProfile {
  id: string;
  name: string;
  avatar?: string;
  rating?: number;
  reviewCount?: number;
  hourlyRate?: number;
  brandColors?: string;
}

interface BookingFlowProps {
  photographer: PhotographerProfile;
  services: PhotographerService[];
  availabilitySlots: VendorBookerAvailabilitySlot[];
  blockedDates: BlockedDate[];
  bookedSlots?: { date: string; startTime: string; endTime: string }[];
  onBookingComplete?: (booking: {
    serviceId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => void;
  accentColor?: string;
}

type BookingStep = "service" | "datetime" | "confirm";

const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function BookingFlow({
  photographer,
  services,
  availabilitySlots,
  blockedDates,
  bookedSlots = [],
  onBookingComplete,
  accentColor,
}: BookingFlowProps) {
  const { theme, isDark } = useTheme();
  const brandColor = accentColor || theme.primary;

  const [currentStep, setCurrentStep] = useState<BookingStep>("service");
  const [selectedService, setSelectedService] = useState<PhotographerService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const cardBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const borderColor = isDark ? "#333" : "#E5E5E5";

  const getNext30Days = useMemo(() => {
    const days: Date[] = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  const isDateBlocked = (date: Date): boolean => {
    const dateStr = date.toISOString().split("T")[0];
    return blockedDates.some((blocked) => blocked.date === dateStr);
  };

  const isDateBooked = (date: Date, time: string): boolean => {
    const dateStr = date.toISOString().split("T")[0];
    return bookedSlots.some(
      (slot) => slot.date === dateStr && slot.startTime === time
    );
  };

  const getDayAvailability = (date: Date): VendorBookerAvailabilitySlot | null => {
    const dayIndex = date.getDay();
    return availabilitySlots.find((s) => s.dayOfWeek === dayIndex && s.isRecurring) || null;
  };

  const generateTimeSlots = (date: Date): { morning: string[]; afternoon: string[]; evening: string[] } => {
    const availability = getDayAvailability(date);
    if (!availability) return { morning: [], afternoon: [], evening: [] };

    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + (minutes || 0);
    };

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
    };

    const startMinutes = parseTime(availability.startTime);
    const endMinutes = parseTime(availability.endTime);
    const slotDuration = selectedService?.durationMinutes || 60;

    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];

    for (let time = startMinutes; time + slotDuration <= endMinutes; time += slotDuration) {
      const formattedTime = formatTime(time);
      const hours = Math.floor(time / 60);

      if (hours < 12) {
        morning.push(formattedTime);
      } else if (hours < 17) {
        afternoon.push(formattedTime);
      } else {
        evening.push(formattedTime);
      }
    }

    return { morning, afternoon, evening };
  };

  const getCalendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentMonth]);

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const hasAvailability = (date: Date): boolean => {
    if (isPastDate(date) || isDateBlocked(date)) return false;
    return getDayAvailability(date) !== null;
  };

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    return selectedService.isPromo && selectedService.promoPrice
      ? selectedService.promoPrice
      : selectedService.price;
  }, [selectedService]);

  const formatPrice = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "service":
        return selectedService !== null;
      case "datetime":
        return selectedDate !== null && selectedTime !== null;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep === "service" && selectedService) {
      setCurrentStep("datetime");
    } else if (currentStep === "datetime" && selectedDate && selectedTime) {
      setCurrentStep("confirm");
    } else if (currentStep === "confirm") {
      onBookingComplete?.({
        serviceId: selectedService!.id,
        date: selectedDate!.toISOString().split("T")[0],
        startTime: selectedTime!,
        endTime: selectedTime!,
      });
    }
  };

  const handleBack = () => {
    if (currentStep === "datetime") {
      setCurrentStep("service");
    } else if (currentStep === "confirm") {
      setCurrentStep("datetime");
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, currentStep === "service" && { backgroundColor: brandColor }]} />
      <View style={[styles.stepLine, { backgroundColor: currentStep !== "service" ? brandColor : borderColor }]} />
      <View style={[styles.stepDot, currentStep === "datetime" && { backgroundColor: brandColor }]} />
      <View style={[styles.stepLine, { backgroundColor: currentStep === "confirm" ? brandColor : borderColor }]} />
      <View style={[styles.stepDot, currentStep === "confirm" && { backgroundColor: brandColor }]} />
    </View>
  );

  const renderServiceStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <ThemedText type="h3" style={styles.stepTitle}>Select Service</ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Choose a photography package
      </ThemedText>

      {services.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
          <Feather name="camera-off" size={32} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            No services available yet
          </ThemedText>
        </View>
      ) : (
        services.map((service) => {
          const isSelected = selectedService?.id === service.id;
          return (
            <Pressable
              key={service.id}
              onPress={() => setSelectedService(service)}
              style={[
                styles.serviceCard,
                {
                  backgroundColor: cardBg,
                  borderColor: isSelected ? brandColor : borderColor,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <View style={styles.serviceCardLeft}>
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: isSelected ? brandColor : theme.textSecondary },
                  ]}
                >
                  {isSelected && (
                    <View style={[styles.radioInner, { backgroundColor: brandColor }]} />
                  )}
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText type="h4">{service.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {formatDuration(service.durationMinutes)}
                  </ThemedText>
                  {service.description && (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, marginTop: 4 }}
                      numberOfLines={2}
                    >
                      {service.description}
                    </ThemedText>
                  )}
                </View>
              </View>
              <View style={styles.serviceCardRight}>
                {service.isPromo && service.promoPrice ? (
                  <>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, textDecorationLine: "line-through" }}
                    >
                      {formatPrice(service.price)}
                    </ThemedText>
                    <ThemedText type="h4" style={{ color: "#34C759" }}>
                      {formatPrice(service.promoPrice)}
                    </ThemedText>
                    <View style={[styles.promoBadge, { backgroundColor: "#34C75920" }]}>
                      <ThemedText type="small" style={{ color: "#34C759", fontSize: 10 }}>
                        PROMO
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  <ThemedText type="h4">{formatPrice(service.price)}</ThemedText>
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );

  const renderDateTimeStep = () => {
    const timeSlots = selectedDate ? generateTimeSlots(selectedDate) : { morning: [], afternoon: [], evening: [] };
    const hasTimeSlots = timeSlots.morning.length > 0 || timeSlots.afternoon.length > 0 || timeSlots.evening.length > 0;

    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <ThemedText type="h3" style={styles.stepTitle}>Select Date & Time</ThemedText>

        <View style={[styles.calendarHeader, { borderBottomColor: borderColor }]}>
          <Pressable onPress={() => {
            const prev = new Date(currentMonth);
            prev.setMonth(prev.getMonth() - 1);
            setCurrentMonth(prev);
          }}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </ThemedText>
          <Pressable onPress={() => {
            const next = new Date(currentMonth);
            next.setMonth(next.getMonth() + 1);
            setCurrentMonth(next);
          }}>
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekDaysRow}>
          {DAYS_OF_WEEK.map((day) => (
            <ThemedText key={day} type="small" style={[styles.weekDayLabel, { color: theme.textSecondary }]}>
              {day}
            </ThemedText>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {getCalendarDays.map((date, index) => {
            if (!date) {
              return <View key={`empty-${index}`} style={styles.calendarDay} />;
            }

            const available = hasAvailability(date);
            const past = isPastDate(date);
            const blocked = isDateBlocked(date);
            const today = isToday(date);
            const isSelectedDate = selectedDate?.toDateString() === date.toDateString();

            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => {
                  if (available && !past && !blocked) {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }
                }}
                disabled={!available || past || blocked}
                style={[
                  styles.calendarDay,
                  isSelectedDate && { backgroundColor: brandColor, borderRadius: 20 },
                ]}
              >
                <ThemedText
                  type="body"
                  style={[
                    styles.calendarDayText,
                    (past || blocked || !available) && { color: theme.textSecondary, opacity: 0.4 },
                    isSelectedDate && { color: "#FFFFFF", fontWeight: "700" },
                    today && !isSelectedDate && { color: brandColor, fontWeight: "700" },
                  ]}
                >
                  {date.getDate()}
                </ThemedText>
                {available && !past && !blocked && !isSelectedDate && (
                  <View style={[styles.availabilityDot, { backgroundColor: "#FFD700" }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        {selectedDate && (
          <View style={styles.timeSlotsSection}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </ThemedText>

            {!hasTimeSlots ? (
              <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
                <Feather name="clock" size={24} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                  No available time slots
                </ThemedText>
              </View>
            ) : (
              <>
                {timeSlots.morning.length > 0 && (
                  <View style={styles.timeSection}>
                    <ThemedText type="body" style={[styles.timeSectionTitle, { color: theme.textSecondary }]}>
                      Morning
                    </ThemedText>
                    <View style={styles.timePillsRow}>
                      {timeSlots.morning.map((time) => {
                        const booked = isDateBooked(selectedDate, time);
                        const isSelectedTime = selectedTime === time;
                        return (
                          <Pressable
                            key={time}
                            onPress={() => !booked && setSelectedTime(time)}
                            disabled={booked}
                            style={[
                              styles.timePill,
                              {
                                backgroundColor: isSelectedTime ? brandColor : cardBg,
                                borderColor: isSelectedTime ? brandColor : borderColor,
                                opacity: booked ? 0.5 : 1,
                              },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={[
                                styles.timePillText,
                                isSelectedTime && { color: "#FFFFFF" },
                                booked && { textDecorationLine: "line-through" },
                              ]}
                            >
                              {time}
                            </ThemedText>
                            {booked && (
                              <View style={styles.bookedIndicator}>
                                <View style={[styles.bookedDot, { backgroundColor: "#FF3B30" }]} />
                                <ThemedText type="small" style={{ color: "#FF3B30", fontSize: 9 }}>
                                  booked
                                </ThemedText>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {timeSlots.afternoon.length > 0 && (
                  <View style={styles.timeSection}>
                    <ThemedText type="body" style={[styles.timeSectionTitle, { color: theme.textSecondary }]}>
                      Afternoon
                    </ThemedText>
                    <View style={styles.timePillsRow}>
                      {timeSlots.afternoon.map((time) => {
                        const booked = isDateBooked(selectedDate, time);
                        const isSelectedTime = selectedTime === time;
                        return (
                          <Pressable
                            key={time}
                            onPress={() => !booked && setSelectedTime(time)}
                            disabled={booked}
                            style={[
                              styles.timePill,
                              {
                                backgroundColor: isSelectedTime ? brandColor : cardBg,
                                borderColor: isSelectedTime ? brandColor : borderColor,
                                opacity: booked ? 0.5 : 1,
                              },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={[
                                styles.timePillText,
                                isSelectedTime && { color: "#FFFFFF" },
                                booked && { textDecorationLine: "line-through" },
                              ]}
                            >
                              {time}
                            </ThemedText>
                            {booked && (
                              <View style={styles.bookedIndicator}>
                                <View style={[styles.bookedDot, { backgroundColor: "#FF3B30" }]} />
                                <ThemedText type="small" style={{ color: "#FF3B30", fontSize: 9 }}>
                                  booked
                                </ThemedText>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {timeSlots.evening.length > 0 && (
                  <View style={styles.timeSection}>
                    <ThemedText type="body" style={[styles.timeSectionTitle, { color: theme.textSecondary }]}>
                      Evening
                    </ThemedText>
                    <View style={styles.timePillsRow}>
                      {timeSlots.evening.map((time) => {
                        const booked = isDateBooked(selectedDate, time);
                        const isSelectedTime = selectedTime === time;
                        return (
                          <Pressable
                            key={time}
                            onPress={() => !booked && setSelectedTime(time)}
                            disabled={booked}
                            style={[
                              styles.timePill,
                              {
                                backgroundColor: isSelectedTime ? brandColor : cardBg,
                                borderColor: isSelectedTime ? brandColor : borderColor,
                                opacity: booked ? 0.5 : 1,
                              },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={[
                                styles.timePillText,
                                isSelectedTime && { color: "#FFFFFF" },
                                booked && { textDecorationLine: "line-through" },
                              ]}
                            >
                              {time}
                            </ThemedText>
                            {booked && (
                              <View style={styles.bookedIndicator}>
                                <View style={[styles.bookedDot, { backgroundColor: "#FF3B30" }]} />
                                <ThemedText type="small" style={{ color: "#FF3B30", fontSize: 9 }}>
                                  booked
                                </ThemedText>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderConfirmStep = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <ThemedText type="h3" style={styles.stepTitle}>Confirm Booking</ThemedText>

      <View style={[styles.confirmCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.providerRow}>
          {photographer.avatar ? (
            <Image source={{ uri: photographer.avatar }} style={styles.providerAvatar} />
          ) : (
            <View style={[styles.providerAvatarPlaceholder, { backgroundColor: brandColor }]}>
              <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                {photographer.name?.charAt(0)?.toUpperCase() || "P"}
              </ThemedText>
            </View>
          )}
          <View style={styles.providerInfo}>
            <ThemedText type="h4">{photographer.name}</ThemedText>
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color="#FFD700" />
              <ThemedText type="small" style={{ marginLeft: 4 }}>
                {photographer.rating?.toFixed(1) || "5.0"} ({photographer.reviewCount || 0} Reviews)
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.confirmCard, { backgroundColor: cardBg, borderColor }]}>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
          SERVICE
        </ThemedText>
        <ThemedText type="h4">{selectedService?.name}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
          {formatDuration(selectedService?.durationMinutes || 60)}
        </ThemedText>
      </View>

      <View style={[styles.confirmCard, { backgroundColor: cardBg, borderColor }]}>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
          DATE & TIME
        </ThemedText>
        <ThemedText type="h4">
          {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </ThemedText>
        <ThemedText type="body" style={{ color: brandColor, marginTop: 4 }}>
          {selectedTime}
        </ThemedText>
      </View>

      <View style={[styles.confirmCard, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.priceRow}>
          <ThemedText type="body">Subtotal</ThemedText>
          <ThemedText type="body">{formatPrice(totalPrice)}</ThemedText>
        </View>
        <View style={[styles.priceRow, { marginTop: 8 }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Processing Fee
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {formatPrice(Math.round(totalPrice * 0.029 + 30))}
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: borderColor }]} />
        <View style={styles.priceRow}>
          <ThemedText type="h4">Total</ThemedText>
          <ThemedText type="h3" style={{ color: brandColor }}>
            {formatPrice(totalPrice + Math.round(totalPrice * 0.029 + 30))}
          </ThemedText>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        {currentStep !== "service" ? (
          <Pressable onPress={handleBack} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        <ThemedText type="h4">Book Appointment</ThemedText>
        <View style={styles.headerButton} />
      </View>

      {renderStepIndicator()}

      {currentStep === "service" && renderServiceStep()}
      {currentStep === "datetime" && renderDateTimeStep()}
      {currentStep === "confirm" && renderConfirmStep()}

      <View style={[styles.bottomBar, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
        <View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {currentStep === "confirm" ? "Total" : "Starting at"}
          </ThemedText>
          <ThemedText type="h3" style={{ color: brandColor }}>
            {formatPrice(currentStep === "confirm" ? totalPrice + Math.round(totalPrice * 0.029 + 30) : totalPrice)}
          </ThemedText>
        </View>
        <Pressable
          onPress={handleNext}
          disabled={!canProceed()}
          style={[
            styles.nextButton,
            { backgroundColor: canProceed() ? brandColor : theme.textSecondary },
          ]}
        >
          <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
            {currentStep === "confirm" ? "BOOK NOW" : "NEXT"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#666",
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  stepTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  serviceCardLeft: {
    flexDirection: "row",
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceCardRight: {
    alignItems: "flex-end",
  },
  promoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayText: {
    fontSize: 16,
  },
  availabilityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  timeSlotsSection: {
    marginTop: Spacing.lg,
  },
  timeSection: {
    marginBottom: Spacing.lg,
  },
  timeSectionTitle: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  timePillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  timePillText: {
    fontWeight: "600",
  },
  bookedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  bookedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  confirmCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  providerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  providerInfo: {
    marginLeft: Spacing.md,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
  },
  nextButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});

export default BookingFlow;

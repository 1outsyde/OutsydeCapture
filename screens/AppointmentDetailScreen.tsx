import React from "react";
import { Alert, StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { BusinessAppointment } from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "AppointmentDetail">;

// ─── Policy helpers ────────────────────────────────────────────────────────────

const WINDOW_HOURS: Record<string, number> = {
  "1_week": 168,
  "48_hours": 48,
  "24_hours": 24,
  "1_hour": 1,
};

function windowLabel(w: string): string {
  switch (w) {
    case "1_week": return "1 week";
    case "48_hours": return "48 hours";
    case "24_hours": return "24 hours";
    case "1_hour": return "1 hour";
    default: return w;
  }
}

function feeLabel(type?: string | null, amount?: number | null): string {
  if (!type || amount == null) return "a cancellation fee";
  if (type === "flat") {
    const dollars = amount / 100;
    return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  }
  return `${amount}% of the booking total`;
}

function formatCutoff(apptDate: string, apptTime: string, windowHours: number): string {
  const apptMs = new Date(`${apptDate}T${apptTime}`).getTime();
  return new Date(apptMs - windowHours * 3_600_000).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function describeCancellationPolicy(appt: BusinessAppointment): string {
  const fullWindow = appt.serviceFullRefundWindow ?? "never";
  const hasPartial = !!appt.serviceHasPartialRefund;
  const hasFee = !!appt.serviceHasCancellationFee;
  const fee = hasFee ? feeLabel(appt.serviceCancellationFeeType, appt.serviceCancellationFeeAmount) : null;

  if (fullWindow === "never") {
    return hasFee
      ? `This booking is non-refundable. A ${fee} cancellation fee applies if you cancel.`
      : "This booking is non-refundable.";
  }

  const fullHours = WINDOW_HOURS[fullWindow] ?? 0;
  const fullCutoff = formatCutoff(appt.appointmentDate, appt.appointmentTime, fullHours);

  if (hasPartial && appt.servicePartialRefundWindow && appt.servicePartialRefundPercentage != null) {
    const partHours = WINDOW_HOURS[appt.servicePartialRefundWindow] ?? 0;
    const partCutoff = formatCutoff(appt.appointmentDate, appt.appointmentTime, partHours);
    const pct = appt.servicePartialRefundPercentage;
    if (hasFee) {
      return (
        `Full refund until ${windowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
        `Between then and ${windowLabel(appt.servicePartialRefundWindow)} before, you'll receive a ${pct}% refund — ` +
        `a ${fee} cancellation fee applies once you're past the full-refund window. ` +
        `No refund after ${partCutoff}, and the ${fee} fee still applies.`
      );
    }
    return (
      `Full refund until ${windowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
      `Between then and ${windowLabel(appt.servicePartialRefundWindow)} before (by ${partCutoff}), ` +
      `you'll receive a ${pct}% refund. No refund after that.`
    );
  }

  if (hasFee) {
    return (
      `Free cancellation until ${windowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
      `After that, a ${fee} cancellation fee applies and no refund is given.`
    );
  }
  return (
    `Free cancellation until ${windowLabel(fullWindow)} before your appointment (by ${fullCutoff}). ` +
    `No refund after that.`
  );
}

// ─── Date/time helpers ─────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeStr(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  return `${h % 12 || 12}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
}

// ─── Status helpers ────────────────────────────────────────────────────────────

const BUSINESS_UPCOMING_STATUSES = new Set(["confirmed", "pending_provider"]);
const BUSINESS_PAST_STATUSES = new Set(["completed", "canceled", "no_show", "declined", "expired"]);

function getBusinessStatusColor(status: string, theme: any): string {
  if (BUSINESS_UPCOMING_STATUSES.has(status)) return theme.success;
  if (status === "completed") return theme.brandGold;
  if (BUSINESS_PAST_STATUSES.has(status)) return theme.error;
  return theme.textSecondary;
}

// ─── Row sub-component ────────────────────────────────────────────────────────

function Row({ icon, label }: { icon: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Feather name={icon as any} size={16} color={theme.textSecondary} style={styles.rowIcon} />
      <ThemedText type="body" style={{ flex: 1 }}>
        {label}
      </ThemedText>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function AppointmentDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { getToken } = useAuth();
  const appt = route.params.appointment;

  const statusColor = getBusinessStatusColor(appt.status, theme);
  const statusLabel =
    appt.status === "pending_provider"
      ? "Pending"
      : appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
  const initials = (appt.businessName ?? "?").slice(0, 2).toUpperCase();
  const timeStr = appt.appointmentEndTime
    ? `${formatTimeStr(appt.appointmentTime)} – ${formatTimeStr(appt.appointmentEndTime)}`
    : formatTimeStr(appt.appointmentTime);
  const policyText = describeCancellationPolicy(appt);

  const doCancel = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.cancelAppointment(token, appt.id);
      const lines: string[] = [];
      if (result.refundAmountCents > 0) {
        lines.push(`Refunded: $${(result.refundAmountCents / 100).toFixed(2)}`);
      }
      if (result.feeAmountCents > 0 && result.feeCharged) {
        lines.push(`Cancellation fee charged: $${(result.feeAmountCents / 100).toFixed(2)}`);
      } else if (result.feeAmountCents > 0 && result.feeNeedsManualCollection) {
        lines.push(
          `A $${(result.feeAmountCents / 100).toFixed(2)} cancellation fee applies — the business will collect this separately`
        );
      }
      Alert.alert(
        "Appointment canceled",
        lines.length > 0 ? lines.join("\n") : "Appointment canceled",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to cancel appointment");
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel this appointment?",
      "Depending on this business's cancellation policy, you may be charged a fee or receive a partial/no refund. This can't be undone.",
      [
        { text: "Keep appointment", style: "cancel" },
        { text: "Cancel appointment", style: "destructive", onPress: doCancel },
      ],
    );
  };

  return (
    <ScreenScrollView>
      {/* Business header */}
      <View style={[styles.headerCard, { backgroundColor: theme.backgroundDefault }]}>
        {appt.businessLogoImage ? (
          <Image
            source={{ uri: appt.businessLogoImage }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.initialsCircle, { backgroundColor: theme.brandGold + "30" }]}>
            <ThemedText type="h4" style={{ color: theme.brandGold, fontWeight: "700" }}>
              {initials}
            </ThemedText>
          </View>
        )}
        <View style={styles.headerInfo}>
          <ThemedText type="h3" numberOfLines={2}>
            {appt.businessName ?? "Business"}
          </ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20", marginTop: Spacing.xs }]}>
            <ThemedText type="caption" style={{ color: statusColor }}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Booking details */}
      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Booking Details
        </ThemedText>
        <Row icon="scissors" label={appt.serviceName ?? "Service"} />
        {appt.staffDisplayName ? (
          <Row icon="user" label={`with ${appt.staffDisplayName}`} />
        ) : null}
        {appt.serviceDurationMinutes ? (
          <Row icon="clock" label={`${appt.serviceDurationMinutes} min`} />
        ) : null}
        <Row icon="calendar" label={formatDate(appt.appointmentDate)} />
        <Row icon="clock" label={timeStr} />
        <Row icon="dollar-sign" label={`$${(appt.totalPrice / 100).toFixed(2)}`} />
      </View>

      {/* Location */}
      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Location
        </ThemedText>
        {appt.businessHasPhysicalLocation === false ? (
          <View style={styles.row}>
            <Feather name="video" size={16} color={theme.textSecondary} style={styles.rowIcon} />
            <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1 }}>
              This service is not at a physical location — the business will share details with you directly.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.row}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} style={styles.rowIcon} />
            <ThemedText type="body" style={{ flex: 1 }}>
              {[appt.businessAddress, appt.businessCity, appt.businessState]
                .filter(Boolean)
                .join(", ") || "Address on file with the business"}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Cancellation policy */}
      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Cancellation Policy
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22 }}>
          {policyText}
        </ThemedText>
      </View>

      {/* Cancel button — only when confirmed */}
      {appt.status === "confirmed" ? (
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            { borderColor: theme.error, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x-circle" size={18} color={theme.error} style={{ marginRight: Spacing.sm }} />
          <ThemedText type="button" style={{ color: theme.error }}>
            Cancel Appointment
          </ThemedText>
        </Pressable>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.md,
  },
  initialsCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  rowIcon: {
    marginRight: Spacing.sm,
    marginTop: 3,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
});

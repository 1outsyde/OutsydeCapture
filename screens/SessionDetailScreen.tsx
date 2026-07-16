import React from "react";
import { Alert, StyleSheet, View, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useData, Session } from "@/context/DataContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { CATEGORY_LABELS } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import api from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "SessionDetail">;

const PHOTO_THUMBNAIL_SIZE =
  (Dimensions.get("window").width - Spacing.lg * 2 - Spacing.sm * 2) / 3;

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

function formatCutoff(date: string, time: string, windowHours: number): string {
  const apptMs = new Date(`${date}T${time}`).getTime();
  return new Date(apptMs - windowHours * 3_600_000).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function describeCancellationPolicy(session: Session): string {
  const fullWindow = session.serviceFullRefundWindow ?? "never";
  const hasPartial = !!session.serviceHasPartialRefund;
  const hasFee = !!session.serviceHasCancellationFee;
  const fee = hasFee
    ? feeLabel(session.serviceCancellationFeeType, session.serviceCancellationFeeAmount)
    : null;

  if (fullWindow === "never") {
    return hasFee
      ? `This booking is non-refundable. A ${fee} cancellation fee applies if you cancel.`
      : "This booking is non-refundable.";
  }

  const fullHours = WINDOW_HOURS[fullWindow] ?? 0;
  const fullCutoff = formatCutoff(session.date, session.time, fullHours);

  if (
    hasPartial &&
    session.servicePartialRefundWindow &&
    session.servicePartialRefundPercentage != null
  ) {
    const partHours = WINDOW_HOURS[session.servicePartialRefundWindow] ?? 0;
    const partCutoff = formatCutoff(session.date, session.time, partHours);
    const pct = session.servicePartialRefundPercentage;
    if (hasFee) {
      return (
        `Full refund until ${windowLabel(fullWindow)} before your session (by ${fullCutoff}). ` +
        `Between then and ${windowLabel(session.servicePartialRefundWindow)} before, you'll receive a ${pct}% refund — ` +
        `a ${fee} cancellation fee applies once you're past the full-refund window. ` +
        `No refund after ${partCutoff}, and the ${fee} fee still applies.`
      );
    }
    return (
      `Full refund until ${windowLabel(fullWindow)} before your session (by ${fullCutoff}). ` +
      `Between then and ${windowLabel(session.servicePartialRefundWindow)} before (by ${partCutoff}), ` +
      `you'll receive a ${pct}% refund. No refund after that.`
    );
  }

  if (hasFee) {
    return (
      `Free cancellation until ${windowLabel(fullWindow)} before your session (by ${fullCutoff}). ` +
      `After that, a ${fee} cancellation fee applies and no refund is given.`
    );
  }
  return (
    `Free cancellation until ${windowLabel(fullWindow)} before your session (by ${fullCutoff}). ` +
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

function getStatusColor(status: Session["status"], theme: any): string {
  if (status === "upcoming") return theme.success;
  if (status === "completed") return theme.brandGold;
  if (status === "cancelled") return theme.error;
  return theme.textSecondary;
}

// ─── Row sub-component ─────────────────────────────────────────────────────────

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

export default function SessionDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { getToken } = useAuth();
  const { sessions, refreshSessions } = useData();

  const { sessionId } = route.params;
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <ScreenScrollView>
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ marginTop: Spacing.lg }}>
            Session not found
          </ThemedText>
        </View>
      </ScreenScrollView>
    );
  }

  const statusColor = getStatusColor(session.status, theme);
  const statusLabel = session.status.charAt(0).toUpperCase() + session.status.slice(1);
  const initials = (session.photographerName ?? "?").slice(0, 2).toUpperCase();
  const timeStr = session.endTime
    ? `${formatTimeStr(session.time)} – ${formatTimeStr(session.endTime)}`
    : formatTimeStr(session.time);
  const policyText = describeCancellationPolicy(session);

  const doCancel = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.cancelShootBooking(token, session.id);
      const lines: string[] = [];
      if (result.refundAmountCents > 0) {
        lines.push(`Refunded: $${(result.refundAmountCents / 100).toFixed(2)}`);
      }
      if (result.feeAmountCents > 0 && result.feeCharged) {
        lines.push(`Cancellation fee charged: $${(result.feeAmountCents / 100).toFixed(2)}`);
      } else if (result.feeAmountCents > 0 && result.feeNeedsManualCollection) {
        lines.push(
          `A $${(result.feeAmountCents / 100).toFixed(2)} cancellation fee applies — the photographer will collect this separately`
        );
      }
      await refreshSessions();
      Alert.alert(
        "Session canceled",
        lines.length > 0 ? lines.join("\n") : "Session canceled",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to cancel session");
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel this session?",
      "Depending on the photographer's cancellation policy, you may be charged a fee or receive a partial/no refund. This can't be undone.",
      [
        { text: "Keep session", style: "cancel" },
        { text: "Cancel session", style: "destructive", onPress: doCancel },
      ],
    );
  };

  return (
    <ScreenScrollView>
      {/* Photographer header */}
      <View style={[styles.headerCard, { backgroundColor: theme.backgroundDefault }]}>
        {session.photographerAvatar ? (
          <Image
            source={{ uri: session.photographerAvatar }}
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
            {session.photographerName ?? "Photographer"}
          </ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20", marginTop: Spacing.xs }]}>
            <ThemedText type="caption" style={{ color: statusColor }}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Session details */}
      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Session Details
        </ThemedText>
        <Row icon="camera" label={session.serviceName ?? (CATEGORY_LABELS[session.sessionType as keyof typeof CATEGORY_LABELS] ?? session.sessionType)} />
        {session.serviceDurationMinutes ? (
          <Row icon="clock" label={`${session.serviceDurationMinutes} min`} />
        ) : null}
        <Row icon="calendar" label={formatDate(session.date)} />
        <Row icon="clock" label={timeStr} />
        <Row icon="map-pin" label={session.location} />
        <Row icon="dollar-sign" label={`$${Number(session.price).toFixed(2)}`} />
      </View>

      {/* Notes */}
      {session.notes ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Notes
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22 }}>
            {session.notes}
          </ThemedText>
        </View>
      ) : null}

      {/* Photos */}
      {session.photos && session.photos.length > 0 ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Photos ({session.photos.length})
          </ThemedText>
          <View style={styles.photoGrid}>
            {session.photos.slice(0, 6).map((photoUrl, index) => (
              <View
                key={index}
                style={styles.photoThumbnail}
              >
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                  transition={200}
                />
                {index === 5 && session.photos && session.photos.length > 6 ? (
                  <View style={styles.morePhotosOverlay}>
                    <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                      +{session.photos.length - 6}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Cancellation policy */}
      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Cancellation Policy
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22 }}>
          {policyText}
        </ThemedText>
      </View>

      {/* Cancel button — only when upcoming */}
      {session.status === "upcoming" ? (
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            { borderColor: theme.error, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x-circle" size={18} color={theme.error} style={{ marginRight: Spacing.sm }} />
          <ThemedText type="button" style={{ color: theme.error }}>
            Cancel Session
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["2xl"],
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  photoThumbnail: {
    width: PHOTO_THUMBNAIL_SIZE,
    height: PHOTO_THUMBNAIL_SIZE,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  morePhotosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
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

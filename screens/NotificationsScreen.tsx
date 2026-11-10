// Activity (Inbox › Activity, the Notifications screen and Account › Notifications).
// Redesign step 2 (Legend 2026-11-10): chips, Today / This week / Earlier, filled icons and buttons,
// settings moved to NotificationSettingsScreen (gear), Clear all removed. Logic: utils/activityLogic.ts.
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { activityTarget } from "@/utils/ticketCheckoutLogic";
import { activityQuoteId } from "@/utils/requestLogic";
import { openTicketTarget } from "@/hooks/useTicketPushLinks";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import {
  useNotifications,
  Notification,
  NotificationTriggeringUser,
} from "@/context/NotificationContext";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import {
  bookingPushTarget,
  isBookingPushType,
  openBookingPushTarget,
} from "@/services/bookingPush";
import { openPlanOffer } from "@/utils/planOfferNav";
import { openPointsFromReward } from "@/utils/friendReferral";
import { openAnnouncement } from "@/services/announcementPush";
import { api } from "@/services/api";
import {
  activityAction,
  activityChips,
  activityIcon,
  activityTime,
  filterByChip,
  groupByWhen,
  type ActivityChip,
} from "@/utils/activityLogic";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// CartOrders switches tab when _ts changes, so each tap needs a new one.
const ordersTabParams = () => ({ openTab: "orders" as const, _ts: Date.now() });

// Follow back: checked once per follower, at most this many per screen visit.
const FOLLOW_CHECK_LIMIT = 30;
type FollowState = "following" | "not_following" | "saving";

function resolveNotificationAvatar(
  triggeringUser?: NotificationTriggeringUser | null,
): string | null {
  if (!triggeringUser) return null;
  const url = triggeringUser.profilePhotoUrl || triggeringUser.profileImageUrl;
  if (url && url.startsWith("http")) return url;
  return null;
}

function resolveNotificationInitial(
  triggeringUser?: NotificationTriggeringUser | null,
): string {
  if (!triggeringUser) return "?";
  // Array.from splits by code point, so astral characters stay whole.
  const first = Array.from((triggeringUser.displayName || "").trim())[0];
  return first ? first.toUpperCase() : "?";
}

export default function NotificationsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const isAdmin = !!user?.isAdmin;
  const [chip, setChip] = useState<ActivityChip>("all");

  // Notification id -> the avatar URL that failed to load for that row. Keyed
  // by URL too so a row retries if its actor's image later changes.
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<
    Record<string, string>
  >({});

  const markAvatarFailed = useCallback(
    (notificationId: string, url: string) => {
      setFailedAvatarUrls((prev) =>
        prev[notificationId] === url
          ? prev
          : { ...prev, [notificationId]: url },
      );
    },
    [],
  );

  const chips = useMemo(() => activityChips(isAdmin), [isAdmin]);
  const sections = useMemo(
    () => groupByWhen(filterByChip(notifications, chip)),
    [notifications, chip],
  );

  // ── Follow back ────────────────────────────────────────────────────────────
  // userId -> state. No entry = not checked yet; the button shows only for "not_following".
  const [follow, setFollow] = useState<Record<string, FollowState>>({});
  // Followers already asked about for the signed-in user, so each is checked once per visit.
  const requestedRef = useRef<{ userId: string | null; ids: Set<string> }>({
    userId: null,
    ids: new Set(),
  });

  useEffect(() => {
    if (!user || user.isGuest) return;
    if (requestedRef.current.userId !== user.id) {
      requestedRef.current = { userId: user.id, ids: new Set() };
    }
    const asked = requestedRef.current.ids;
    const ids: string[] = [];
    for (const n of notifications) {
      if (asked.size + ids.length >= FOLLOW_CHECK_LIMIT) break;
      const a = activityAction(n, isAdmin);
      if (
        a?.kind === "follow" &&
        a.userId !== user.id &&
        !asked.has(a.userId) &&
        !ids.includes(a.userId)
      ) {
        ids.push(a.userId);
      }
    }
    if (!ids.length) return;
    for (const id of ids) asked.add(id);
    (async () => {
      const token = await getToken();
      const results = await Promise.all(
        ids.map(
          async (id) =>
            [id, (await api.checkFollowStatus(id, token)).isFollowing] as const,
        ),
      );
      setFollow((prev) => {
        const next = { ...prev };
        for (const [id, isFollowing] of results)
          next[id] = isFollowing ? "following" : "not_following";
        return next;
      });
    })();
  }, [notifications, user, isAdmin, getToken]);

  const handleFollowBack = async (
    notification: Notification,
    userId: string,
  ) => {
    if (follow[userId] !== "not_following") return;
    markAsRead(notification.id);
    setFollow((prev) => ({ ...prev, [userId]: "saving" }));
    try {
      const token = await getToken();
      await api.followUser(userId, "user", token);
      setFollow((prev) => ({ ...prev, [userId]: "following" }));
    } catch {
      setFollow((prev) => ({ ...prev, [userId]: "not_following" }));
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    // Booking request types: same screen a tap on the push opens.
    const bookingTarget = isBookingPushType(notification.type)
      ? bookingPushTarget({
          type: notification.type,
          screen: notification.metadata?.screen,
        })
      : null;
    // Quotes 6c-2b (call 5): every quote row opens its quote.
    const quoteId = activityQuoteId(
      notification as { type: string; metadata?: Record<string, unknown> },
    );
    if (quoteId) {
      navigation.navigate("Quote", { quoteId });
    } else if (bookingTarget) {
      openBookingPushTarget(navigation, user, bookingTarget);
    } else if (notification.type === "plan_offer") {
      // Same as tapping the offer push: back to the main tabs, where the popup opens.
      openPlanOffer(navigation, user);
    } else if (
      notification.type === "referral_reward" ||
      notification.type === "business_referral_reward"
    ) {
      // Referral reward (friend points or business $25): same as tapping its push, the Points screen.
      openPointsFromReward(navigation, user);
    } else if (notification.type === "announcement") {
      // Admin announcement: the same screen a tap on its push opens, or Activity.
      openAnnouncement(navigation, user, {
        screen: notification.metadata?.screen,
        url: notification.metadata?.url,
      });
    } else if (activityTarget(notification as any)) {
      // Event team, ticket and host items (invites, team pay, reminders, sales, payouts; p4-team 9c-2, calls 60,
      // 73, 78): the same screen their push opens. A team message opens their event.
      openTicketTarget(navigation, activityTarget(notification as any)!);
    } else if (
      notification.type === "business_pending" &&
      notification.metadata?.businessId
    ) {
      navigation.navigate("AdminDashboard", { section: "businesses" });
    } else if (notification.metadata?.sessionId) {
      navigation.navigate("SessionDetail", {
        sessionId: notification.metadata.sessionId as string,
      });
    } else if (
      notification.type === "new_follower" &&
      notification.metadata?.referenceId
    ) {
      navigation.navigate("UserProfile", {
        userId: notification.metadata.referenceId,
      });
    } else if (
      notification.type === "order_confirmed" ||
      notification.type === "order_shipped"
    ) {
      // Activity step 2 (Legend 2026-11-10): a customer's order rows open the Orders tab.
      navigation.navigate("CartOrders", ordersTabParams());
    } else if (notification.type === "new_order") {
      // A business's new order opens its Orders screen; the announcement map checks the role
      // (business only, anyone else lands back on Activity).
      openAnnouncement(navigation, user, { screen: "business_orders" });
    }
    // All other backend types: mark-read-only for now, no confirmed target screen yet.
  };

  // Color pass step 1: neutral circles; the icon carries the hint (gold in dark mode, green in light).
  const iconBackground = (_n: Notification): string => theme.brandChip;
  const accentIcon = isDark ? theme.brandGold : theme.brandPrimary;

  const renderAvatar = (notification: Notification) => {
    const resolvedAvatarUrl = resolveNotificationAvatar(
      notification.triggeringUser,
    );
    const avatarUrl =
      resolvedAvatarUrl &&
      failedAvatarUrls[notification.id] !== resolvedAvatarUrl
        ? resolvedAvatarUrl
        : null;
    const initial = notification.triggeringUser
      ? resolveNotificationInitial(notification.triggeringUser)
      : null;
    // resolveNotificationInitial returns "?" when there is no displayName.
    const hasInitial = !!initial && initial.trim() !== "" && initial !== "?";
    const icon = activityIcon(notification);
    const badge = (
      <View
        style={[
          styles.badge,
          {
            backgroundColor: iconBackground(notification),
            borderColor: theme.brandScreen,
          },
        ]}
      >
        <Ionicons name={icon} size={10} color={accentIcon} />
      </View>
    );

    if (avatarUrl) {
      return (
        <View style={styles.avatarWrap}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
            onError={() => markAvatarFailed(notification.id, avatarUrl)}
          />
          {badge}
        </View>
      );
    }
    if (hasInitial) {
      return (
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatar,
              styles.center,
              { backgroundColor: theme.brandGold },
            ]}
          >
            <ThemedText style={[styles.initial, { color: theme.brandScreen }]}>
              {initial}
            </ThemedText>
          </View>
          {badge}
        </View>
      );
    }
    return (
      <View
        style={[
          styles.avatar,
          styles.center,
          { backgroundColor: iconBackground(notification) },
        ]}
      >
        <Ionicons name={icon} size={20} color={accentIcon} />
      </View>
    );
  };

  const renderAction = (notification: Notification) => {
    const action = activityAction(notification, isAdmin);
    if (!action) return null;
    if (action.kind === "follow") {
      const state = follow[action.userId];
      if (
        action.userId === user?.id ||
        (state !== "not_following" && state !== "saving")
      )
        return null;
      return (
        <Pressable
          onPress={() => handleFollowBack(notification, action.userId)}
          disabled={state === "saving"}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.brandGold,
              opacity: state === "saving" ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.actionText, { color: theme.brandScreen }]}>
            Follow back
          </ThemedText>
        </Pressable>
      );
    }
    return (
      <Pressable
        onPress={() => handleNotificationPress(notification)}
        style={[styles.actionButton, { backgroundColor: theme.brandGold }]}
        accessibilityRole="button"
      >
        <ThemedText style={[styles.actionText, { color: theme.brandScreen }]}>
          {action.label}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.brandScreen }}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {chips.map((c) => {
          const on = c.key === chip;
          return (
            <Pressable
              key={c.key}
              onPress={() => setChip(c.key)}
              style={[
                styles.chip,
                { backgroundColor: on ? theme.text : theme.brandChip },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: on ? theme.backgroundDefault : theme.text },
                ]}
              >
                {c.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <View
            style={[styles.emptyIcon, { backgroundColor: theme.brandCard }]}
          >
            <Ionicons name="notifications" size={28} color={accentIcon} />
          </View>
          <ThemedText type="h4">
            {chip === "all" ? "No notifications yet" : "You're all caught up"}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            {chip === "all"
              ? "Bookings, orders, follows and updates from Outsyde will show up here."
              : "Updates in this category will show up here."}
          </ThemedText>
        </View>
      ) : (
        sections.map((section, i) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                {section.title.toUpperCase()}
              </ThemedText>
              {i === 0 && unreadCount > 0 ? (
                <Pressable
                  onPress={markAllAsRead}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <ThemedText
                    style={[styles.markAll, { color: theme.brandGold }]}
                  >
                    Mark all read
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {section.rows.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.row,
                  {
                    backgroundColor: notification.read
                      ? "transparent"
                      : theme.brandCardUnread,
                    borderBottomColor: theme.brandChip,
                  },
                ]}
              >
                {renderAvatar(notification)}
                <View style={styles.rowMiddle}>
                  <Pressable
                    onPress={() => handleNotificationPress(notification)}
                    accessibilityRole="button"
                  >
                    <ThemedText
                      type="body"
                      style={{ fontWeight: notification.read ? "500" : "700" }}
                      numberOfLines={2}
                    >
                      {notification.title}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                      numberOfLines={3}
                    >
                      {notification.body}
                    </ThemedText>
                  </Pressable>
                  {renderAction(notification)}
                </View>
                <View style={styles.rowRight}>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary }}
                  >
                    {activityTime(notification.date)}
                  </ThemedText>
                  {!notification.read ? (
                    <View
                      style={[
                        styles.unreadDot,
                        { backgroundColor: theme.brandGold },
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: "center",
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  section: { paddingTop: Spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    minHeight: 36,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.8 },
  markAll: { fontSize: 14, fontWeight: "600" },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMiddle: { flex: 1, minWidth: 0, gap: 8 },
  rowRight: { alignItems: "flex-end", gap: 8, paddingTop: 2 },
  center: { alignItems: "center", justifyContent: "center" },
  avatarWrap: { width: 44, height: 44, position: "relative", flexShrink: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, flexShrink: 0 },
  initial: { fontSize: 16, fontWeight: "700" },
  badge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    alignSelf: "flex-start",
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    justifyContent: "center",
  },
  actionText: { fontSize: 14, fontWeight: "700" },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

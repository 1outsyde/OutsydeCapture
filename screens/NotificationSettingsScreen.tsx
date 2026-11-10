// Notification settings (Activity redesign step 2, Legend 2026-11-10): opened by the gear in Inbox,
// on the Notifications screen and from Account › Notifications. Full screen, not a sheet.
// Only switches that really work today: the phone's push permission, reminders this phone schedules
// (BookingFlow) and "Outsyde news and offers" (backend /api/push/preferences).
// Step 3b (2026-11-10): per-category switches (Bookings, Messages, Orders, Events) from the same route
// (backend #438). Hidden on an older backend that only answers news.
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { Spacing } from "@/constants/theme";
import { api } from "@/services/api";
import {
  pushCategoryRows,
  type PushCategories,
  type PushCategoryKey,
} from "@/utils/pushPreferencesLogic";

const CATEGORY_ICONS: Record<
  PushCategoryKey,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  bookings: "calendar",
  messages: "chatbubble",
  orders: "bag-handle",
  events: "ticket",
};

type Permission = "on" | "off" | "unknown";

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, getToken } = useAuth();
  const { isEnabled, enableNotifications, disableNotifications } =
    useNotifications();
  const signedIn = !!user && !user.isGuest;
  const isWeb = Platform.OS === "web";

  // ── Phone permission (read only; changing it happens in the phone's Settings) ──
  const [permission, setPermission] = useState<Permission>("unknown");
  const readPermission = useCallback(() => {
    if (isWeb) return Promise.resolve();
    return Notifications.getPermissionsAsync()
      .then(({ status }) => setPermission(status === "granted" ? "on" : "off"))
      .catch(() => setPermission("unknown"));
  }, [isWeb]);

  useEffect(() => {
    void readPermission();
    // Coming back from the phone's Settings: read it again.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void readPermission();
    });
    return () => sub.remove();
  }, [readPermission]);

  // ── "Outsyde news and offers" (moved from the Activity screen, same calls) ──
  // null = not loaded (row hidden), so a failed load never shows a wrong value.
  const [news, setNews] = useState<boolean | null>(null);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  // Category switches: null = not loaded or older backend (rows hidden).
  const [categories, setCategories] = useState<PushCategories | null>(null);
  const [categorySaving, setCategorySaving] = useState<PushCategoryKey | null>(
    null,
  );
  const [categoryError, setCategoryError] = useState<PushCategoryKey | null>(
    null,
  );

  useEffect(() => {
    if (!signedIn || isWeb) return;
    let off = false;
    (async () => {
      const token = await getToken();
      if (!token || off) return;
      const r = await api.getPushPreferences(token);
      if (!off && r) {
        setNews(r.news);
        setCategories(r.categories);
      }
    })();
    return () => {
      off = true;
    };
  }, [signedIn, isWeb, getToken]);

  const handleToggleNews = async (value: boolean) => {
    if (newsSaving) return;
    const before = news;
    setNews(value);
    setNewsSaving(true);
    setNewsError(null);
    const token = await getToken();
    const r = token
      ? await api.setPushPreferences(token, { news: value })
      : null;
    setNewsSaving(false);
    if (!r) {
      setNews(before);
      setNewsError("Couldn't save. Try again.");
      return;
    }
    setNews(r.news);
    if (r.categories) setCategories(r.categories);
  };

  const handleToggleCategory = async (key: PushCategoryKey, value: boolean) => {
    if (categorySaving || !categories) return;
    const before = categories;
    setCategories({ ...categories, [key]: value });
    setCategorySaving(key);
    setCategoryError(null);
    const token = await getToken();
    const r = token
      ? await api.setPushPreferences(token, { [key]: value })
      : null;
    setCategorySaving(null);
    if (!r || !r.categories) {
      setCategories(before);
      setCategoryError(key);
      return;
    }
    setCategories(r.categories);
    setNews(r.news);
  };

  const handleToggleReminders = (value: boolean) => {
    if (value) enableNotifications();
    else disableNotifications();
  };

  const switchColors = (on: boolean) => ({
    trackColor: { false: theme.brandChip, true: theme.brandGold },
    thumbColor: on ? theme.brandPrimaryText : theme.textSecondary,
  });

  const iconBox = (name: keyof typeof Ionicons.glyphMap) => (
    <View style={[styles.iconBox, { backgroundColor: theme.brandPrimary }]}>
      <Ionicons name={name} size={20} color={theme.brandGold} />
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.brandScreen }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      {isWeb ? (
        <View style={[styles.card, { backgroundColor: theme.brandCard }]}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Push notifications are only available in the Outsyde app on your
            phone.
          </ThemedText>
        </View>
      ) : (
        <Pressable
          onPress={() => Linking.openSettings()}
          style={[
            styles.card,
            styles.rowCard,
            { backgroundColor: theme.brandPrimary },
          ]}
          accessibilityRole="button"
          accessibilityHint="Opens your phone's settings"
        >
          <View
            style={[styles.iconBox, { backgroundColor: theme.brandScreen }]}
          >
            <Ionicons name="notifications" size={20} color={theme.brandGold} />
          </View>
          <View style={styles.rowText}>
            <ThemedText
              type="body"
              style={[styles.rowTitle, { color: theme.brandPrimaryText }]}
            >
              Push notifications
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.brandPrimaryText, opacity: 0.85 }}
            >
              {permission === "on"
                ? "On for this phone. Turn them off in your phone's settings."
                : permission === "off"
                  ? "Off for this phone. Turn them on in your phone's settings."
                  : "Manage them in your phone's settings."}
            </ThemedText>
          </View>
          <View style={styles.statusWrap}>
            {permission !== "unknown" ? (
              <ThemedText style={[styles.status, { color: theme.brandGold }]}>
                {permission === "on" ? "On" : "Off"}
              </ThemedText>
            ) : null}
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.brandPrimaryText}
            />
          </View>
        </Pressable>
      )}

      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        NOTIFY ME ABOUT
      </ThemedText>
      <View
        style={[
          styles.card,
          styles.listCard,
          { backgroundColor: theme.brandCard },
        ]}
      >
        {!isWeb && categories
          ? pushCategoryRows(user?.role).map((row) => (
              <View
                key={row.key}
                style={[styles.listRow, { borderBottomColor: theme.brandChip }]}
              >
                {iconBox(CATEGORY_ICONS[row.key])}
                <View style={styles.rowText}>
                  <ThemedText type="body" style={styles.rowTitle}>
                    {row.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color:
                        categoryError === row.key
                          ? theme.error
                          : theme.textSecondary,
                    }}
                  >
                    {categoryError === row.key
                      ? "Couldn't save. Try again."
                      : row.description}
                  </ThemedText>
                  {row.note && !categories[row.key] ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.brandGold }}
                    >
                      {row.note}
                    </ThemedText>
                  ) : null}
                </View>
                <Switch
                  value={categories[row.key]}
                  onValueChange={(v) => handleToggleCategory(row.key, v)}
                  disabled={categorySaving !== null}
                  accessibilityLabel={row.label}
                  {...switchColors(categories[row.key])}
                />
              </View>
            ))
          : null}

        {!isWeb ? (
          <View
            style={[styles.listRow, { borderBottomColor: theme.brandChip }]}
          >
            {iconBox("calendar")}
            <View style={styles.rowText}>
              <ThemedText type="body" style={styles.rowTitle}>
                Booking reminders on this phone
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Reminders this phone sets for sessions you book in the app.
              </ThemedText>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={handleToggleReminders}
              accessibilityLabel="Booking reminders on this phone"
              {...switchColors(isEnabled)}
            />
          </View>
        ) : null}

        {!isWeb && news !== null ? (
          <View style={styles.listRow}>
            {iconBox("megaphone")}
            <View style={styles.rowText}>
              <ThemedText type="body" style={styles.rowTitle}>
                Outsyde news and offers
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: newsError ? theme.error : theme.textSecondary }}
              >
                {newsError ??
                  (categories
                    ? "Updates and offers from Outsyde."
                    : "Updates and offers from Outsyde. Booking and message alerts still come through.")}
              </ThemedText>
            </View>
            <Switch
              value={news}
              onValueChange={handleToggleNews}
              disabled={newsSaving}
              accessibilityLabel="Outsyde news and offers"
              {...switchColors(news)}
            />
          </View>
        ) : null}
      </View>

      <ThemedText
        type="caption"
        style={[styles.footer, { color: theme.textSecondary }]}
      >
        Everything still shows up in your Activity tab, whatever you turn off
        here. Alerts about payments, payouts and your account always come
        through.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { borderRadius: 20, padding: 18 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  listCard: { paddingVertical: 0, paddingHorizontal: 0, overflow: "hidden" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontWeight: "600" },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  status: { fontSize: 15, fontWeight: "700" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginHorizontal: 4,
  },
  footer: { marginHorizontal: 4, lineHeight: 19 },
});

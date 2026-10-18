// Admin: one photographer, every signup answer (GET /api/admin/photographers/:id, backend #320),
// with Hide, Flag, Restore (same route as goutsyde.com), Ban / Unban and Delete / Cancel deletion
// (backend #324). Every action asks to confirm first; the backend writes each one to the audit log.

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { AdminPhotographerDetail, AdminPhotographerAction } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteParams = RouteProp<RootStackParamList, "AdminPhotographerDetail">;
type Visibility = "public" | "hidden" | "flagged";

/** Only http(s) links and images from signup answers are opened or loaded. */
function safeHttpUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value.includes("T") || value.endsWith("Z") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AdminPhotographerDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteParams>();
  const { photographerId } = route.params;
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<AdminPhotographerDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setFetchError("Not signed in. Please sign out and back in.");
      setLoading(false);
      return;
    }
    try {
      const data = await api.getAdminPhotographerDetail(token, photographerId);
      setDetail(data);
      setFetchError(null);
    } catch (error: any) {
      if (error?.status === 404) setFetchError("Photographer not found.");
      else setFetchError(`Could not load this photographer. ${error?.message || ""}`.trim());
    } finally {
      setLoading(false);
    }
  }, [getToken, photographerId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const run = async (key: string, work: (token: string) => Promise<unknown>, done: string) => {
    const token = await getToken();
    if (!token) return;
    setBusy(key);
    try {
      await work(token);
      await load();
      Alert.alert("Done", done);
    } catch (error: any) {
      Alert.alert("Couldn't do that", error?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirm = (title: string, message: string, actionLabel: string, destructive: boolean, onYes: () => void) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: actionLabel, style: destructive ? "destructive" : "default", onPress: onYes },
    ]);
  };

  const setVisibility = (next: Visibility) => {
    const name = detail?.photographer.displayName || "this photographer";
    const copy: Record<Visibility, [string, string, string, string]> = {
      hidden: ["Hide photographer", `Hide ${name}? Customers won't see their profile until you restore it.`, "Hide", `${name} is hidden.`],
      flagged: ["Flag photographer", `Flag ${name} for review? Their profile is taken off public view until you restore it.`, "Flag", `${name} is flagged.`],
      public: ["Restore to public", `Make ${name} public again? Customers will be able to find and book them.`, "Restore", `${name} is public.`],
    };
    const [title, message, label, done] = copy[next];
    confirm(title, message, label, next !== "public", () =>
      run(next, (token) => api.setAdminPhotographerVisibility(token, photographerId, next), done),
    );
  };

  const doAction = (action: AdminPhotographerAction) => {
    const name = detail?.photographer.displayName || "this photographer";
    const copy: Record<AdminPhotographerAction, [string, string, string, boolean, string]> = {
      ban: [
        "Ban photographer",
        `Ban ${name}? Their account is turned off, they're signed out on every device and their profile is hidden. Their whole account is banned, including anything else on it.`,
        "Ban", true, `${name} is banned.`,
      ],
      unban: [
        "Unban photographer",
        `Turn ${name}'s account back on? They can sign in again. Their profile stays hidden until you restore it.`,
        "Unban", false, `${name} can sign in again. Restore the profile when you're ready.`,
      ],
      "schedule-deletion": [
        "Delete photographer",
        `Delete ${name}'s account? It's removed in 30 days, and you can cancel before then. Their profile is hidden right away, they're signed out, and they get an email about it.`,
        "Delete", true, `${name}'s account will be deleted in 30 days.`,
      ],
      "cancel-deletion": [
        "Cancel deletion",
        `Stop the deletion of ${name}'s account? Their profile stays hidden until you restore it.`,
        "Stop deletion", false, `The deletion of ${name}'s account was cancelled.`,
      ],
    };
    const [title, message, label, destructive, done] = copy[action];
    confirm(title, message, label, destructive, () =>
      run(action, (token) => api.adminPhotographerAction(token, photographerId, action), done),
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundRoot },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 80 + insets.bottom },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.lg },
    section: { backgroundColor: theme.background, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
    sectionTitle: {
      fontSize: 14, fontWeight: "600", color: theme.textSecondary, textTransform: "uppercase",
      letterSpacing: 0.5, marginBottom: Spacing.md,
    },
    headRow: { flexDirection: "row", alignItems: "center" },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.backgroundSecondary, marginRight: Spacing.md },
    name: { fontSize: 22, fontWeight: "700", color: theme.text },
    sub: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
    badge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
    badgeText: { fontSize: 12, fontWeight: "600" },
    infoRow: { marginBottom: Spacing.sm },
    infoLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
    infoValue: { fontSize: 15, color: theme.text },
    linkText: { color: theme.primary, textDecorationLine: "underline" },
    photo: { width: 72, height: 72, borderRadius: 10, marginTop: 4 },
    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    actionButton: {
      flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 10,
      borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundDefault,
    },
    actionText: { fontSize: 14, fontWeight: "600", color: theme.text },
    dangerButton: { borderColor: "#FF3B30" },
    dangerText: { color: "#FF3B30" },
    note: { fontSize: 12, color: theme.textSecondary, marginTop: Spacing.sm, lineHeight: 17 },
    errorText: { fontSize: 15, color: theme.text, textAlign: "center", marginBottom: Spacing.md },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (fetchError || !detail) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{fetchError || "Photographer not found."}</Text>
        <Pressable style={styles.actionButton} onPress={() => { setLoading(true); load(); }}>
          <Feather name="refresh-cw" size={14} color={theme.text} />
          <Text style={styles.actionText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const p = detail.photographer;
  const visibility = (p.visibilityStatus || "public") as Visibility;
  const banned = p.ownerIsActive === false;
  const pendingDeletion = p.ownerDeletionStatus === "pending_deletion";
  const deleted = p.ownerDeletionStatus === "deleted";
  const photo = p.logoImage ? safeHttpUrl(p.logoImage) : null;

  const badge = (label: string, bg: string, color: string) => (
    <View style={[styles.badge, { backgroundColor: bg }]} key={label}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );

  const actionButton = (key: string, label: string, icon: keyof typeof Feather.glyphMap, onPress: () => void, danger = false) => (
    <Pressable
      key={key}
      style={[styles.actionButton, danger && styles.dangerButton, busy !== null && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={busy !== null}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy === key ? <ActivityIndicator size="small" color={danger ? "#FF3B30" : theme.text} /> : <Feather name={icon} size={14} color={danger ? "#FF3B30" : theme.text} />}
      <Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.section}>
          <View style={styles.headRow}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { alignItems: "center", justifyContent: "center" }]}>
                <Feather name="camera" size={26} color={theme.textSecondary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.displayName || p.ownerName || "(No name)"}</Text>
              {p.ownerUsername ? <Text style={styles.sub}>@{p.ownerUsername}</Text> : null}
              <View style={styles.badges}>
                {visibility === "public" ? badge("Public", "#E8F5E9", "#2E7D32")
                  : visibility === "flagged" ? badge("Flagged", "#FFF3E0", "#E65100")
                  : badge("Hidden", "#ECEFF1", "#455A64")}
                {banned ? badge("Banned", "#FFEBEE", "#C62828") : null}
                {pendingDeletion ? badge(`Deleting ${shortDate(p.ownerScheduledDeletionAt)}`, "#FFEBEE", "#C62828") : null}
                {deleted ? badge("Deleted", "#FFEBEE", "#C62828") : null}
              </View>
            </View>
          </View>
        </View>

        {!deleted ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionGrid}>
              {visibility !== "hidden" ? actionButton("hidden", "Hide", "eye-off", () => setVisibility("hidden")) : null}
              {visibility !== "flagged" ? actionButton("flagged", "Flag", "flag", () => setVisibility("flagged")) : null}
              {visibility !== "public" ? actionButton("public", "Restore to public", "eye", () => setVisibility("public")) : null}
              {banned
                ? actionButton("unban", "Unban", "unlock", () => doAction("unban"))
                : actionButton("ban", "Ban", "slash", () => doAction("ban"), true)}
              {pendingDeletion
                ? actionButton("cancel-deletion", "Cancel deletion", "rotate-ccw", () => doAction("cancel-deletion"))
                : actionButton("schedule-deletion", "Delete", "trash-2", () => doAction("schedule-deletion"), true)}
            </View>
            <Text style={styles.note}>
              Photographers are public as soon as they sign up. Ban turns off the whole account and signs them out. Delete removes the account after 30 days, and it can't start while a customer has a shoot booked with them.
            </Text>
          </View>
        ) : null}

        {detail.signupDetails.sections.map((section) => (
          <View style={styles.section} key={`signup-${section.title}`}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.rows.map((row) => {
              const url = row.kind === "image" || row.kind === "link" ? safeHttpUrl(row.value) : null;
              const empty = row.value === "Not provided";
              return (
                <View style={styles.infoRow} key={`${section.title}-${row.label}`}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  {row.kind === "image" && url ? (
                    <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                  ) : row.kind === "link" && url ? (
                    <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open link"))}>
                      {row.label === "Look them up" ? "Search Google" : row.value}
                    </Text>
                  ) : row.label === "Email" && !empty ? (
                    <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(`mailto:${row.value}`)}>{row.value}</Text>
                  ) : row.label === "Phone" && !empty ? (
                    <Text style={[styles.infoValue, styles.linkText]} onPress={() => Linking.openURL(`tel:${row.value.replace(/[^\d+]/g, "")}`)}>{row.value}</Text>
                  ) : (
                    <Text style={[styles.infoValue, empty && { opacity: 0.5 }]}>{row.value}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { type AdminInfluencerDetail } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

// Every answer an influencer applicant gave (backend GET /api/admin/influencers/:id, 2026-10-18),
// the same rows as the admin email and goutsyde.com. Approve gives a promo code; Reject needs a note.

type RouteType = RouteProp<RootStackParamList, "AdminInfluencerDetail">;

function safeHttpUrl(value: string): string | null {
  return /^https?:\/\/[^\s]+$/i.test(value) ? value : null;
}

export default function AdminInfluencerDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { applicationId } = useRoute<RouteType>().params;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AdminInfluencerDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      setDetail(await api.getAdminInfluencerDetail(token, applicationId));
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not load this application");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, applicationId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (status: "approved" | "rejected") => {
    if (status === "rejected" && !note.trim()) {
      Alert.alert("Add a note", "Add a note before rejecting.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setBusy(true);
    try {
      const res = await api.decideInfluencerApplication(token, applicationId, status, status === "rejected" ? note.trim() : undefined);
      Alert.alert(
        status === "approved" ? "Approved" : "Rejected",
        status === "approved" && res?.promoCode ? `Their promo code is ${res.promoCode}.` : status === "approved" ? "The application was approved." : "The application was rejected.",
      );
      setRejecting(false);
      setNote("");
      await load();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not update the application");
    } finally {
      setBusy(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundRoot },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: Math.max(32, insets.bottom + 16) },
    section: { backgroundColor: theme.backgroundDefault, borderRadius: 12, padding: 16, marginBottom: 12 },
    title: { fontSize: 20, fontWeight: "700", color: theme.text },
    status: { marginTop: 4, fontSize: 13, fontWeight: "600", textTransform: "uppercase", color: theme.primary },
    sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, color: theme.textSecondary, marginBottom: 12 },
    row: { marginBottom: 12 },
    label: { fontSize: 13, color: theme.textSecondary },
    value: { marginTop: 2, fontSize: 14, fontWeight: "600", color: theme.text },
    muted: { color: theme.textSecondary, fontWeight: "400" },
    link: { color: theme.primary },
    actions: { flexDirection: "row", gap: 10, marginTop: 12 },
    btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1 },
    approve: { backgroundColor: "#34C75920", borderColor: "#34C759" },
    reject: { backgroundColor: "#FF3B3020", borderColor: "#FF3B30" },
    note: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, color: theme.text, padding: 12, minHeight: 80, textAlignVertical: "top", marginTop: 8 },
    emptyText: { color: theme.textSecondary, fontSize: 14 },
  });

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>;
  }
  if (!detail?.application) {
    return <View style={styles.center}><Text style={styles.emptyText}>Application not found.</Text></View>;
  }

  const app = detail.application;
  const name = app.user?.name || (app.user?.username ? `@${app.user.username}` : "") || app.user?.email || "Applicant";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.status}>{app.status}{app.promoCode ? `  ·  ${app.promoCode}` : ""}</Text>
          {app.status === "pending" ? (
            rejecting ? (
              <>
                <TextInput
                  style={styles.note}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Why are you rejecting this application?"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => decide("rejected")} disabled={busy}>
                    {busy ? <ActivityIndicator color="#FF3B30" /> : <Text style={{ color: "#FF3B30", fontWeight: "700" }}>Confirm reject</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { borderColor: theme.border }]} onPress={() => { setRejecting(false); setNote(""); }} disabled={busy}>
                    <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.approve]}
                  disabled={busy}
                  onPress={() => Alert.alert("Approve", `Approve ${name} as an Outsyde influencer? They get a promo code.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Approve", onPress: () => decide("approved") },
                  ])}
                >
                  {busy ? <ActivityIndicator color="#34C759" /> : <Text style={{ color: "#34C759", fontWeight: "700" }}>Approve</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => setRejecting(true)} disabled={busy}>
                  <Text style={{ color: "#FF3B30", fontWeight: "700" }}>Reject</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>

        {detail.signupDetails.sections.map((section) => (
          <View style={styles.section} key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.rows.map((row) => {
              const url = row.kind === "link" ? safeHttpUrl(row.value) : null;
              const empty = row.value === "Not provided";
              return (
                <View style={styles.row} key={`${section.title}-${row.label}`}>
                  <Text style={styles.label}>{row.label}</Text>
                  {url ? (
                    <Text style={[styles.value, styles.link]} onPress={() => Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open link"))}>{row.value}</Text>
                  ) : row.label === "Email" && !empty ? (
                    <Text style={[styles.value, styles.link]} onPress={() => Linking.openURL(`mailto:${row.value}`)}>{row.value}</Text>
                  ) : row.label === "Phone" && !empty ? (
                    <Text style={[styles.value, styles.link]} onPress={() => Linking.openURL(`tel:${row.value.replace(/[^\d+]/g, "")}`)}>{row.value}</Text>
                  ) : (
                    <Text style={[styles.value, empty && styles.muted]}>{row.value}</Text>
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

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

// ─── Color system — matches BusinessDashboardScreen exactly ─────────────────

const DASHBOARD_COLORS = {
  background: "#080C08",
  surface: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  gold: "#C9933A",
  goldLight: "#E8B86D",
  cream: "#F0EAD6",
  creamDim: "rgba(200,191,168,0.6)",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function BusinessBillingAddressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [prefillLoading, setPrefillLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — local names for clarity; mapped to backend field names on save
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // ─── Prefill ───────────────────────────────────────────────────────────────

  useEffect(() => {
    prefillForm();
  }, []);

  const prefillForm = async () => {
    setPrefillLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const { billingAddress } = await api.getBusinessDashboard(token);
      if (billingAddress) {
        setLine1(billingAddress.line1 ?? "");
        setLine2(billingAddress.line2 ?? "");
        setCity(billingAddress.city ?? "");
        setState(billingAddress.state ?? "");
        setPostalCode(billingAddress.postalCode ?? "");
      }
    } catch {
      // Non-fatal — user can fill in fields manually
    } finally {
      setPrefillLoading(false);
    }
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      Alert.alert("Required Fields", "Please fill in all required fields to continue.");
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert("Error", "Could not save billing address. Please try again.");
        return;
      }

      // Backend billingAddressSchema requires: line1, city, state, postalCode, country
      // country is not collected in the UI — defaults to "United States"
      await api.updateBusinessBillingAddress(token, {
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: "United States",
      });

      Alert.alert("Saved", "Your billing address has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save billing address. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (prefillLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={DASHBOARD_COLORS.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={DASHBOARD_COLORS.cream} />
        </Pressable>
        <Text style={styles.headerTitle}>Billing Address</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionNote}>
          Used for Stripe payout verification only. Not shown publicly.
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Street Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={line1}
              onChangeText={setLine1}
              placeholder="123 Main Street"
              placeholderTextColor={DASHBOARD_COLORS.creamDim}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Apt / Suite</Text>
            <TextInput
              style={styles.input}
              value={line2}
              onChangeText={setLine2}
              placeholder="Apt 4B"
              placeholderTextColor={DASHBOARD_COLORS.creamDim}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              City <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="New York"
              placeholderTextColor={DASHBOARD_COLORS.creamDim}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>
                State <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={(v) => setState(v.toUpperCase().slice(0, 2))}
                placeholder="NY"
                placeholderTextColor={DASHBOARD_COLORS.creamDim}
                autoCapitalize="characters"
                maxLength={2}
                returnKeyType="next"
              />
            </View>

            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>
                Zip Code <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="10001"
                placeholderTextColor={DASHBOARD_COLORS.creamDim}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Save Button ───────────────────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.saveButton, (saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#0A0A0A" />
          ) : (
            <Text style={styles.saveButtonText}>Save Billing Address</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DASHBOARD_COLORS.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: DASHBOARD_COLORS.cardBorder,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: DASHBOARD_COLORS.cream,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 36,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionNote: {
    fontSize: 13,
    color: DASHBOARD_COLORS.creamDim,
    marginBottom: 24,
    lineHeight: 19,
  },

  // Form
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: DASHBOARD_COLORS.cream,
    letterSpacing: 0.2,
  },
  required: {
    color: DASHBOARD_COLORS.gold,
  },
  input: {
    backgroundColor: DASHBOARD_COLORS.surface,
    borderWidth: 1,
    borderColor: DASHBOARD_COLORS.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: DASHBOARD_COLORS.cream,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DASHBOARD_COLORS.cardBorder,
    backgroundColor: DASHBOARD_COLORS.background,
  },
  saveButton: {
    backgroundColor: DASHBOARD_COLORS.gold,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

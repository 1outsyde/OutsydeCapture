import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  InputAccessoryView,
  Platform,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import type { ServiceAddon, ServiceAddonPayload } from "@/services/api";
import { formatDuration } from "@/utils/duration";

// Add-on list + editor sheet + "Use on other services" sheet for one saved
// service. Same rules and limits as the business editor in
// StorefrontEditorScreen (name 1–80, description ≤300, price $0–$1,000,
// "Adds time" 5–480 min, max 20, copies are one-time and skip duplicates by
// name). The API calls are passed in so the same UI can talk to any add-on
// route (photographer: /api/photographers/me/services/:id/addons).
//
// Render it INSIDE the parent <Modal>: its own sheets are nested Modals, and
// iOS can't present a second sibling Modal while one is up.

export interface ServiceAddonsApi {
  list: (token: string, serviceId: string) => Promise<ServiceAddon[]>;
  create: (token: string, serviceId: string, payload: ServiceAddonPayload) => Promise<ServiceAddon>;
  update: (
    token: string,
    serviceId: string,
    addonId: string,
    payload: Partial<ServiceAddonPayload & { isActive?: boolean }>,
  ) => Promise<ServiceAddon>;
  remove: (token: string, serviceId: string, addonId: string) => Promise<{ success: boolean }>;
}

interface ServiceAddonsEditorProps {
  // Saved service id; undefined while creating a new service.
  serviceId?: string;
  // Services an add-on can be copied to (already filtered by the caller).
  copyTargets: { id: string; name: string }[];
  api: ServiceAddonsApi;
  accentColor: string;
}

const MAX_ADDONS = 20;
const KEYBOARD_DONE_ID = "serviceAddonsKeyboardDone";

const EMPTY_FORM = { name: "", description: "", price: "", durationMinutes: "", sortOrder: "" };

const errorMessage = (e: any, fallback: string): string =>
  e?.body?.error || e?.body?.message || e?.message || fallback;

export default function ServiceAddonsEditor({
  serviceId,
  copyTargets,
  api,
  accentColor,
}: ServiceAddonsEditorProps) {
  const { theme } = useTheme();
  const { getToken } = useAuth();

  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addsTime, setAddsTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [copySource, setCopySource] = useState<ServiceAddon | null>(null);
  const [copyTargetIds, setCopyTargetIds] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [copyPrompt, setCopyPrompt] = useState<ServiceAddon | null>(null);

  // A load that finishes after the service changed must not show the old list.
  const loadSeqRef = useRef(0);

  const sortAddons = (list: ServiceAddon[]) => list.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    const seq = ++loadSeqRef.current;
    setAddons([]);
    setLoadError(null);
    setCopyPrompt(null);
    if (!serviceId) return;
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const list = await api.list(token, serviceId);
        if (seq === loadSeqRef.current) setAddons(sortAddons(list));
      } catch {
        if (seq === loadSeqRef.current) setLoadError("Couldn't load add-ons.");
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const openNew = () => {
    setEditingAddon(null);
    setAddsTime(false);
    setForm({ ...EMPTY_FORM, sortOrder: String(addons.length + 1) });
    setFormError(null);
    setEditorVisible(true);
  };

  const openEdit = (addon: ServiceAddon) => {
    setEditingAddon(addon);
    setAddsTime(addon.durationMinutes > 0);
    setForm({
      name: addon.name,
      description: addon.description ?? "",
      price: (addon.priceCents / 100).toFixed(2),
      durationMinutes: addon.durationMinutes > 0 ? String(addon.durationMinutes) : "",
      sortOrder: String(addon.sortOrder),
    });
    setFormError(null);
    setEditorVisible(true);
  };

  const handleSave = async () => {
    setFormError(null);
    const name = form.name.trim();
    if (!name || name.length > 80) { setFormError("Name is required (max 80 characters)."); return; }
    const desc = form.description.trim();
    if (desc.length > 300) { setFormError("Description must be 300 characters or fewer."); return; }
    const priceVal = parseFloat(form.price);
    if (isNaN(priceVal) || priceVal < 0 || priceVal > 1000) { setFormError("Price must be between $0 and $1,000."); return; }
    const priceCents = Math.round(priceVal * 100);
    let durationMinutes = 0;
    if (addsTime) {
      const durationVal = parseInt(form.durationMinutes, 10);
      if (isNaN(durationVal) || durationVal < 5 || durationVal > 480) { setFormError("Duration must be between 5 and 480 minutes."); return; }
      durationMinutes = durationVal;
    }
    const sortOrder = parseInt(form.sortOrder, 10) || (addons.length + 1);
    setSaving(true);
    try {
      const token = await getToken();
      if (!token || !serviceId) throw new Error("Not authenticated");
      const payload = { name, description: desc || null, priceCents, durationMinutes, sortOrder };
      if (editingAddon) {
        const updated = await api.update(token, serviceId, editingAddon.id, payload);
        setAddons((prev) => sortAddons(prev.map((a) => (a.id === editingAddon.id ? updated : a))));
      } else {
        const created = await api.create(token, serviceId, payload);
        setAddons((prev) => sortAddons([...prev, created]));
        setCopyPrompt(created);
      }
      setEditorVisible(false);
    } catch (e: any) {
      setFormError(errorMessage(e, "Failed to save add-on"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addon: ServiceAddon) => {
    Alert.alert("Delete Add-on", `Delete "${addon.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token || !serviceId) return;
          try {
            await api.remove(token, serviceId, addon.id);
            setAddons((prev) => prev.filter((a) => a.id !== addon.id));
            setCopyPrompt((p) => (p?.id === addon.id ? null : p));
          } catch (e: any) {
            Alert.alert("Error", errorMessage(e, "Failed to delete add-on"));
          }
        },
      },
    ]);
  };

  const openCopySheet = (addon: ServiceAddon) => {
    setCopyPrompt(null);
    setCopySource(addon);
    setCopyTargetIds(copyTargets.map((s) => s.id));
  };

  const handleCopy = async () => {
    const source = copySource;
    if (!source || copyTargetIds.length === 0) return;
    const token = await getToken();
    if (!token) return;
    setCopying(true);
    const added: string[] = [];
    const alreadyHas: string[] = [];
    const atLimit: string[] = [];
    const failed: string[] = [];
    const sourceName = source.name.trim().toLowerCase();
    // One at a time so a failure on one service doesn't stop the rest.
    for (const targetId of copyTargetIds) {
      const label = copyTargets.find((s) => s.id === targetId)?.name || "Service";
      try {
        const existing = await api.list(token, targetId);
        if (existing.some((a) => a.name.trim().toLowerCase() === sourceName)) {
          alreadyHas.push(label);
          continue;
        }
        if (existing.length >= MAX_ADDONS) {
          atLimit.push(label);
          continue;
        }
        await api.create(token, targetId, {
          name: source.name,
          description: source.description ?? null,
          priceCents: source.priceCents,
          durationMinutes: source.durationMinutes,
          sortOrder: existing.length + 1,
          // Keep a switched-off add-on switched off in the copies.
          ...(source.isActive === false ? { isActive: false } : {}),
        });
        added.push(label);
      } catch {
        failed.push(label);
      }
    }
    setCopying(false);
    setCopySource(null);
    const lines = [
      `Added to ${added.length} service${added.length === 1 ? "" : "s"}.`,
      alreadyHas.length ? `Skipped (already has it): ${alreadyHas.join(", ")}` : "",
      atLimit.length ? `Skipped (20 add-on limit): ${atLimit.join(", ")}` : "",
      failed.length ? `Couldn't add, try again: ${failed.join(", ")}` : "",
    ].filter(Boolean);
    Alert.alert(failed.length ? "Partly done" : "Done", lines.join("\n"));
  };

  const priceLine = (a: ServiceAddon) =>
    `$${(a.priceCents / 100).toFixed(2)}${a.durationMinutes > 0 ? ` · +${formatDuration(a.durationMinutes)}` : ""}`;

  const inputStyle = [styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }];

  return (
    <View style={styles.field}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.text, marginBottom: 0 }]}>Add-ons</Text>
        {serviceId ? (
          addons.length < MAX_ADDONS ? (
            <Pressable onPress={openNew} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add add-on">
              <Feather name="plus" size={16} color={accentColor} />
              <Text style={{ color: accentColor, fontSize: 13, fontWeight: "600" }}>Add</Text>
            </Pressable>
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Max 20</Text>
          )
        ) : null}
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 10 }}>
        Optional extras customers can pick when they book.
      </Text>

      {!serviceId ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Save the service first to add add-ons.</Text>
      ) : loading ? (
        <ActivityIndicator size="small" color={accentColor} />
      ) : loadError ? (
        <Text style={{ color: "#FF3B30", fontSize: 13 }}>{loadError}</Text>
      ) : addons.length === 0 ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>No add-ons yet.</Text>
      ) : (
        addons.map((addon) => (
          <View key={addon.id} style={[styles.addonRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: "600", fontSize: 14 }}>
                {addon.name}
                {addon.isActive === false ? <Text style={{ color: theme.textSecondary, fontWeight: "400" }}> (off)</Text> : null}
              </Text>
              {addon.description ? (
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{addon.description}</Text>
              ) : null}
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{priceLine(addon)}</Text>
              {copyTargets.length > 0 ? (
                <Pressable
                  onPress={() => openCopySheet(addon)}
                  hitSlop={8}
                  style={{ alignSelf: "flex-start", marginTop: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${addon.name} on other services`}
                >
                  <Text style={{ color: accentColor, fontSize: 13, fontWeight: "600" }}>Use on other services</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => openEdit(addon)} style={{ padding: 8 }} accessibilityLabel={`Edit ${addon.name}`}>
              <Feather name="edit-2" size={16} color={theme.textSecondary} />
            </Pressable>
            <Pressable onPress={() => handleDelete(addon)} style={{ padding: 8 }} accessibilityLabel={`Delete ${addon.name}`}>
              <Feather name="trash-2" size={16} color="#FF3B30" />
            </Pressable>
          </View>
        ))
      )}

      {copyPrompt && copyTargets.length > 0 && addons.some((a) => a.id === copyPrompt.id) ? (
        <View style={[styles.promptBox, { borderColor: accentColor }]}>
          <Text style={{ color: theme.text, fontSize: 14, marginBottom: 10 }}>
            {`Use "${copyPrompt.name}" on your other services too?`}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => setCopyPrompt(null)}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text, fontWeight: "600" }}>Not now</Text>
            </Pressable>
            <Pressable
              onPress={() => openCopySheet(copyPrompt)}
              style={[styles.primaryButton, { backgroundColor: accentColor }]}
            >
              <Text style={{ color: "#000", fontWeight: "700" }}>Choose services</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Add-on editor sheet (nested in the parent Modal) */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditorVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetOverlay}
        >
          {/* Tapping the dimmed area only hides the keyboard, so nothing typed is lost. */}
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false} />
          <View style={[styles.sheet, { backgroundColor: theme.background }]}>
            <View style={styles.sheetHeader}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 17 }}>
                {editingAddon ? "Edit Add-on" : "New Add-on"}
              </Text>
              <Pressable onPress={Keyboard.dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                <Text style={{ color: accentColor, fontSize: 15, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ flexGrow: 0 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            >
              {formError ? <Text style={{ color: "#FF3B30", fontSize: 13, marginBottom: 10 }}>{formError}</Text> : null}
              <Text style={[styles.label, { color: theme.text }]}>Name *</Text>
              <TextInput
                style={inputStyle}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Extra 30 minutes, Drone shots"
                placeholderTextColor={theme.textSecondary}
                maxLength={80}
                returnKeyType="done"
              />
              <Text style={[styles.label, { color: theme.text, marginTop: 12 }]}>Description</Text>
              <TextInput
                style={[inputStyle, { height: undefined, minHeight: 60, paddingTop: 12, textAlignVertical: "top" }]}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Optional details"
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={300}
                inputAccessoryViewID={KEYBOARD_DONE_ID}
              />
              <Text style={[styles.label, { color: theme.text, marginTop: 12 }]}>Price ($) *</Text>
              <TextInput
                style={inputStyle}
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                inputAccessoryViewID={KEYBOARD_DONE_ID}
              />
              <View style={styles.switchRow}>
                <Text style={{ color: theme.text, fontSize: 14 }}>Adds time to the appointment</Text>
                <Switch
                  value={addsTime}
                  onValueChange={(v) => {
                    setAddsTime(v);
                    if (!v) setForm((f) => ({ ...f, durationMinutes: "" }));
                  }}
                  trackColor={{ false: theme.border, true: accentColor }}
                />
              </View>
              {addsTime ? (
                <>
                  <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>Duration (minutes) *</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.durationMinutes}
                    onChangeText={(v) => setForm((f) => ({ ...f, durationMinutes: v.replace(/\D/g, "") }))}
                    placeholder="e.g. 30"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    inputAccessoryViewID={KEYBOARD_DONE_ID}
                  />
                </>
              ) : null}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => { setEditorVisible(false); setFormError(null); }}
                style={[styles.secondaryButton, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[styles.primaryButton, { backgroundColor: accentColor, opacity: saving ? 0.6 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: "#000", fontWeight: "700" }}>Save</Text>}
              </Pressable>
            </View>
          </View>
          {Platform.OS === "ios" ? (
            <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
              <View style={[styles.accessoryBar, { backgroundColor: theme.card }]}>
                <Pressable onPress={Keyboard.dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                  <Text style={{ color: accentColor, fontSize: 16, fontWeight: "600" }}>Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>

      {/* "Add to other services" sheet (also nested) */}
      <Modal
        visible={copySource !== null}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!copying) setCopySource(null); }}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: theme.background, maxHeight: "80%" }]}>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 17, marginBottom: 4 }}>
              {`Add "${copySource?.name ?? ""}" to other services`}
            </Text>
            {copySource ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>
                ${(copySource.priceCents / 100).toFixed(2)}
                {copySource.durationMinutes > 0 ? ` · +${formatDuration(copySource.durationMinutes)}` : " · doesn't add time"}
              </Text>
            ) : null}
            <View style={styles.headerRow}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}>
                {copyTargetIds.length} of {copyTargets.length} selected
              </Text>
              <Pressable
                disabled={copying}
                onPress={() =>
                  setCopyTargetIds(copyTargetIds.length === copyTargets.length ? [] : copyTargets.map((s) => s.id))
                }
                style={{ paddingVertical: 6, paddingHorizontal: 4 }}
              >
                <Text style={{ color: accentColor, fontSize: 13, fontWeight: "600" }}>
                  {copyTargetIds.length === copyTargets.length ? "Select none" : "Select all"}
                </Text>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0, marginBottom: 12 }}>
              {copyTargets.map((svc) => {
                const checked = copyTargetIds.includes(svc.id);
                return (
                  <Pressable
                    key={svc.id}
                    disabled={copying}
                    onPress={() =>
                      setCopyTargetIds((prev) => (prev.includes(svc.id) ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]))
                    }
                    style={[styles.checkRow, { backgroundColor: theme.card }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                  >
                    <Feather name={checked ? "check-square" : "square"} size={20} color={checked ? accentColor : theme.textSecondary} />
                    <Text style={{ color: theme.text, fontSize: 14, marginLeft: 12, flex: 1 }} numberOfLines={1}>
                      {svc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 16 }}>
              {"Each service gets its own copy. Changing this add-on later won't change the copies."}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                disabled={copying}
                onPress={() => setCopySource(null)}
                style={[styles.secondaryButton, { borderColor: theme.border, opacity: copying ? 0.6 : 1 }]}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={copying || copyTargetIds.length === 0}
                onPress={handleCopy}
                style={[
                  styles.primaryButton,
                  { backgroundColor: accentColor, opacity: copying || copyTargetIds.length === 0 ? 0.6 : 1 },
                ]}
              >
                {copying ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={{ color: "#000", fontWeight: "700" }}>
                    Add to {copyTargetIds.length} service{copyTargetIds.length === 1 ? "" : "s"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  promptBox: { marginTop: 4, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: "90%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  primaryButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  secondaryButton: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
  accessoryBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
});

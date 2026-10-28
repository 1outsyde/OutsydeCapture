// Add-ons tab in Edit Storefront: the vendor's add-on library.
// Create an add-on once, then choose which services offer it. Every attachment
// is still that service's own add-on, so bookings and payments never change.
// Backend: /api/vendor/addon-library* (outsyde-backend #297, migration 046).
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import {
  attachLibraryAddon,
  createLibraryAddon,
  deleteLibraryAddon,
  getAddonLibrary,
  reviewServiceAddonPrice,
  setLibraryAddonActive,
  updateLibraryAddon,
  type LibraryAddon,
  type LibraryAddonService,
  type VendorService,
} from "@/services/api";
import { readableApiError } from "@/utils/apiError";
import {
  countPriceReviews,
  describeAttach,
  keepsLibraryOnAfterTurnOff,
  money,
} from "@/utils/addonLibrary";
import { formatDuration } from "@/utils/duration";

interface Props {
  services: VendorService[];
  getToken: () => Promise<string | null>;
}

type FormState = {
  name: string;
  description: string;
  price: string;
  addsTime: boolean;
  minutes: string;
};
const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  addsTime: false,
  minutes: "",
};

type Sheet =
  | { kind: "attach"; addon: LibraryAddon }
  | { kind: "off"; addon: LibraryAddon }
  | { kind: "on"; addon: LibraryAddon }
  | { kind: "delete"; addon: LibraryAddon }
  | null;

function readForm(f: FormState): {
  fields?: {
    name: string;
    description: string | null;
    priceCents: number;
    durationMinutes: number;
  };
  error?: string;
} {
  const name = f.name.trim();
  if (!name || name.length > 80)
    return { error: "Name is required (max 80 characters)." };
  const description = f.description.trim() || null;
  if (description && description.length > 300)
    return { error: "Description must be 300 characters or fewer." };
  const price = parseFloat(f.price);
  if (isNaN(price) || price < 0 || price > 1000)
    return { error: "Price must be between $0 and $1,000." };
  let minutes = 0;
  if (f.addsTime) {
    minutes = parseInt(f.minutes.trim(), 10);
    if (isNaN(minutes) || minutes < 5 || minutes > 480)
      return { error: "Extra minutes must be between 5 and 480." };
  }
  return {
    fields: {
      name,
      description,
      priceCents: Math.round(price * 100),
      durationMinutes: minutes,
    },
  };
}

// Products a library add-on is on (backend #373). The library is still managed per service here;
// products are edited in each product's form. Deleting removes it from those products too.
function productNamesOf(a: LibraryAddon): string[] {
  return Array.from(new Set((a.products ?? []).map((p) => p.productName)));
}

function deleteMessage(serviceCount: number, products: string[]): string {
  const parts: string[] = [];
  if (serviceCount > 0) parts.push(serviceCount === 1 ? "this service" : `these ${serviceCount} services`);
  if (products.length > 0) parts.push(products.length === 1 ? products[0] : `${products.length} products`);
  if (parts.length === 0) return "It will be removed from your add-ons. Past bookings and orders keep it.";
  return `It will be removed from your add-ons and from ${parts.join(" and ")}. Past bookings and orders keep it.`;
}

export default function AddonLibraryTab({
  services,
  getToken: getTokenProp,
}: Props) {
  const { theme } = useTheme();
  // AuthContext recreates getToken on every render; keep the latest in a ref so
  // loading the list does not re-run on unrelated re-renders.
  const getTokenRef = useRef(getTokenProp);
  getTokenRef.current = getTokenProp;
  const getToken = useCallback(() => getTokenRef.current(), []);
  const [addons, setAddons] = useState<LibraryAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<LibraryAddon | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      setAddons(await getAddonLibrary(token));
    } catch (e) {
      setLoadError(readableApiError(e, "Could not load your add-ons."));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name ??
    addons.flatMap((a) => a.services).find((s) => s.serviceId === id)
      ?.serviceName ??
    "a service";

  // ── create / edit ───────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormVisible(true);
  };

  const openEdit = (a: LibraryAddon) => {
    setEditing(a);
    setForm({
      name: a.name,
      description: a.description ?? "",
      price: (a.priceCents / 100).toFixed(2),
      addsTime: a.durationMinutes > 0,
      minutes: a.durationMinutes > 0 ? String(a.durationMinutes) : "",
    });
    setFormError(null);
    setFormVisible(true);
  };

  const saveForm = async () => {
    const { fields, error } = readForm(form);
    if (!fields) {
      setFormError(error ?? null);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      let message: string;
      if (editing) {
        const result = await updateLibraryAddon(token, editing.id, fields);
        const parts = [`Saved "${fields.name}".`];
        if (fields.priceCents !== editing.priceCents) {
          const n = editing.services.filter((s) => s.priceSynced).length;
          parts.push(
            `New price ${money(fields.priceCents)} applied to ${n} service${n === 1 ? "" : "s"}.`,
          );
          for (const s of result.customPriceServices)
            parts.push(
              `${s.serviceName} kept its own price of ${money(s.priceCents)}.`,
            );
        }
        message = parts.join(" ");
      } else {
        await createLibraryAddon(token, fields);
        message = `"${fields.name}" is in your add-ons. Tap "Add to services" to choose where it's offered.`;
      }
      await load();
      setFormVisible(false);
      setNotice(message);
    } catch (e) {
      setFormError(readableApiError(e, "Could not save the add-on."));
    } finally {
      setSaving(false);
    }
  };

  // ── which-services sheet (attach, on/off, delete) ───────────────────────
  const sheetServices = (
    s: NonNullable<Sheet>,
  ): { id: string; name: string }[] => {
    const a = s.addon;
    if (s.kind === "attach") {
      const attached = new Set(a.services.map((x) => x.serviceId));
      return services
        .filter((x) => x.status !== "archived" && !attached.has(x.id))
        .map((x) => ({ id: x.id, name: x.name }));
    }
    if (s.kind === "off")
      return a.services
        .filter((x) => x.isActive)
        .map((x) => ({ id: x.serviceId, name: x.serviceName }));
    if (s.kind === "on")
      return a.services
        .filter((x) => !x.isActive)
        .map((x) => ({ id: x.serviceId, name: x.serviceName }));
    return a.services.map((x) => ({ id: x.serviceId, name: x.serviceName }));
  };

  const openSheet = (s: NonNullable<Sheet>) => {
    setSheetError(null);
    setSelected(sheetServices(s).map((x) => x.id)); // everything starts ticked
    setSheet(s);
  };

  const toggleNoServices = async (a: LibraryAddon) => {
    try {
      const token = await getToken();
      if (!token) return;
      await setLibraryAddonActive(token, a.id, !a.isActive, []);
      await load();
    } catch (e) {
      setNotice(readableApiError(e));
    }
  };

  const confirmSheet = async () => {
    if (!sheet) return;
    setSheetBusy(true);
    setSheetError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const a = sheet.addon;
      let message = "";
      if (sheet.kind === "attach") {
        const result = await attachLibraryAddon(token, a.id, selected);
        message = `${a.name}: ${describeAttach(result, serviceName)}`;
      } else if (sheet.kind === "off" || sheet.kind === "on") {
        const turnOn = sheet.kind === "on";
        await setLibraryAddonActive(token, a.id, turnOn, selected);
        if (!turnOn && keepsLibraryOnAfterTurnOff(a, selected)) {
          await setLibraryAddonActive(token, a.id, true, []);
        }
        const n = selected.length;
        message = `${a.name} is ${turnOn ? "on" : "off"}${n > 0 ? ` for ${n} service${n === 1 ? "" : "s"}` : " in your add-ons"}.`;
      } else {
        const result = await deleteLibraryAddon(token, a.id);
        const n = result.removedFromServiceIds.length;
        const p = productNamesOf(a).length;
        const where = [
          n > 0 ? `${n} service${n === 1 ? "" : "s"}` : null,
          p > 0 ? `${p} product${p === 1 ? "" : "s"}` : null,
        ].filter(Boolean).join(" and ");
        message = `Deleted ${a.name}${where ? ` and removed it from ${where}` : ""}.`;
      }
      await load();
      setSheet(null);
      setNotice(message);
    } catch (e) {
      setSheetError(readableApiError(e));
    } finally {
      setSheetBusy(false);
    }
  };

  // ── price prompt (Use / Keep) ───────────────────────────────────────────
  const review = async (
    a: LibraryAddon,
    s: LibraryAddonService,
    action: "sync" | "keep",
  ) => {
    setReviewBusy(s.addonId);
    try {
      const token = await getToken();
      if (!token) return;
      await reviewServiceAddonPrice(token, s.serviceId, s.addonId, action);
      await load();
      setNotice(
        action === "sync"
          ? `${s.serviceName} now charges ${money(a.priceCents)} for ${a.name} and follows your add-on price.`
          : `${s.serviceName} keeps ${money(s.priceCents)} for ${a.name}.`,
      );
    } catch (e) {
      setNotice(readableApiError(e));
    } finally {
      setReviewBusy(null);
    }
  };

  const reviewCount = countPriceReviews(addons);
  const outlineBtn = {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.brandSurfaceBorder,
  } as const;
  const smallText = { color: theme.brandTextDim, fontSize: 12 } as const;

  const renderSheet = () => {
    if (!sheet) return null;
    const list = sheetServices(sheet);
    const a = sheet.addon;
    const selectable = sheet.kind !== "delete";
    const count = selectable ? selected.length : list.length;
    const title =
      sheet.kind === "attach"
        ? `Add "${a.name}" to services`
        : sheet.kind === "off"
          ? `Turn off "${a.name}"?`
          : sheet.kind === "on"
            ? `Turn on "${a.name}"?`
            : `Delete "${a.name}"?`;
    const message =
      sheet.kind === "attach"
        ? "Choose the services that should offer this add-on. Nothing is added anywhere else."
        : sheet.kind === "off"
          ? "Choose the services where customers should stop seeing it. Untick any service that should keep it."
          : sheet.kind === "on"
            ? "Choose the services where customers should see it again."
            : deleteMessage(list.length, productNamesOf(a));
    const confirmLabel =
      sheet.kind === "attach"
        ? `Add to ${count} service${count === 1 ? "" : "s"}`
        : sheet.kind === "delete"
          ? "Delete"
          : count === 0
            ? `Turn ${sheet.kind} in add-ons only`
            : `Turn ${sheet.kind} for ${count} service${count === 1 ? "" : "s"}`;
    const canConfirm = !sheetBusy && (sheet.kind !== "attach" || count > 0);
    const allSelected = list.length > 0 && selected.length === list.length;

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!sheetBusy) setSheet(null);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <View
            style={{
              backgroundColor: theme.brandBg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
              paddingBottom: 36,
              maxHeight: "80%",
            }}
          >
            <Text
              style={{
                color: theme.brandCream,
                fontWeight: "700",
                fontSize: 17,
                marginBottom: 4,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: theme.brandTextDim,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {message}
            </Text>
            {selectable && list.length > 1 ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: theme.brandCream,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {selected.length} of {list.length} selected
                </Text>
                <Pressable
                  disabled={sheetBusy}
                  onPress={() =>
                    setSelected(allSelected ? [] : list.map((x) => x.id))
                  }
                  style={{ paddingVertical: 6, paddingHorizontal: 4 }}
                >
                  <Text
                    style={{
                      color: theme.brandGold,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {allSelected ? "Select none" : "Select all"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <ScrollView style={{ flexGrow: 0, marginBottom: 12 }}>
              {list.length === 0 ? (
                <Text style={{ color: theme.brandTextDim, fontSize: 13 }}>
                  {sheet.kind === "attach"
                    ? "All your active services already offer this add-on."
                    : "No services to show."}
                </Text>
              ) : (
                list.map((x) => {
                  const checked = selected.includes(x.id);
                  return (
                    <Pressable
                      key={x.id}
                      disabled={!selectable || sheetBusy}
                      onPress={() =>
                        setSelected((prev) =>
                          prev.includes(x.id)
                            ? prev.filter((id) => id !== x.id)
                            : [...prev, x.id],
                        )
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: theme.brandSurface,
                        marginBottom: 8,
                      }}
                      accessibilityRole={selectable ? "checkbox" : "text"}
                      accessibilityState={selectable ? { checked } : undefined}
                    >
                      {selectable ? (
                        <Feather
                          name={checked ? "check-square" : "square"}
                          size={20}
                          color={checked ? theme.brandGold : theme.brandTextDim}
                        />
                      ) : null}
                      <Text
                        style={{
                          color: theme.brandCream,
                          fontSize: 14,
                          marginLeft: selectable ? 12 : 0,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {x.name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            {sheetError ? (
              <Text
                style={{
                  color: theme.brandError,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {sheetError}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                disabled={sheetBusy}
                onPress={() => setSheet(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.brandTextDim,
                  alignItems: "center",
                  opacity: sheetBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: theme.brandCream, fontWeight: "600" }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={!canConfirm}
                onPress={confirmSheet}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor:
                    sheet.kind === "delete"
                      ? theme.brandError
                      : theme.brandGold,
                  opacity: canConfirm ? 1 : 0.6,
                }}
              >
                {sheetBusy ? (
                  <ActivityIndicator color={theme.brandBg} />
                ) : (
                  <Text
                    style={{
                      color:
                        sheet.kind === "delete" ? "#FFFFFF" : theme.brandBg,
                      fontWeight: "700",
                    }}
                  >
                    {confirmLabel}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderForm = () => (
    <Modal
      visible={formVisible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!saving) setFormVisible(false);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
      >
        <View
          style={{
            backgroundColor: theme.brandBg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20,
            paddingBottom: 36,
            maxHeight: "85%",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text
              style={{
                color: theme.brandCream,
                fontWeight: "700",
                fontSize: 17,
                marginBottom: 12,
              }}
            >
              {editing ? "Edit add-on" : "New add-on"}
            </Text>
            {editing && editing.services.length > 0 ? (
              <Text style={{ ...smallText, marginBottom: 12 }}>
                {
                  "Changes reach every service it's on. A new price skips services that charge their own price."
                }
              </Text>
            ) : null}
            <Text
              style={{
                color: theme.brandCream,
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 6,
              }}
            >
              Name
            </Text>
            <TextInput
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              maxLength={80}
              placeholder="Add-on name"
              placeholderTextColor={theme.brandTextDim}
              style={{
                backgroundColor: theme.brandSurface,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: theme.brandCream,
                marginBottom: 12,
              }}
              accessibilityLabel="Add-on name"
            />
            <Text
              style={{
                color: theme.brandCream,
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 6,
              }}
            >
              Description (optional)
            </Text>
            <TextInput
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
              maxLength={300}
              multiline
              placeholder="Description"
              placeholderTextColor={theme.brandTextDim}
              style={{
                backgroundColor: theme.brandSurface,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: theme.brandCream,
                marginBottom: 12,
                minHeight: 60,
              }}
            />
            <Text
              style={{
                color: theme.brandCream,
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 6,
              }}
            >
              Price ($)
            </Text>
            <TextInput
              value={form.price}
              onChangeText={(t) => setForm({ ...form, price: t })}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.brandTextDim}
              style={{
                backgroundColor: theme.brandSurface,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: theme.brandCream,
                marginBottom: 12,
              }}
              accessibilityLabel="Price"
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ color: theme.brandCream, fontSize: 14 }}>
                Adds time to the appointment
              </Text>
              <Switch
                value={form.addsTime}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    addsTime: v,
                    minutes: v ? form.minutes : "",
                  })
                }
                trackColor={{
                  true: theme.brandGold,
                  false: theme.brandSurfaceBorder,
                }}
              />
            </View>
            {form.addsTime ? (
              <TextInput
                value={form.minutes}
                onChangeText={(t) => setForm({ ...form, minutes: t })}
                keyboardType="number-pad"
                placeholder="Extra minutes (5 to 480)"
                placeholderTextColor={theme.brandTextDim}
                style={{
                  backgroundColor: theme.brandSurface,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  color: theme.brandCream,
                  marginBottom: 12,
                }}
                accessibilityLabel="Extra minutes"
              />
            ) : null}
            {formError ? (
              <Text
                style={{
                  color: theme.brandError,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {formError}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <Pressable
                disabled={saving}
                onPress={() => setFormVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.brandTextDim,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.brandCream, fontWeight: "600" }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={saveForm}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: theme.brandGold,
                  alignItems: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color={theme.brandBg} />
                ) : (
                  <Text style={{ color: theme.brandBg, fontWeight: "700" }}>
                    {editing ? "Save changes" : "Create add-on"}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ padding: 16 }}>
        <Text
          style={{ color: theme.brandTextDim, fontSize: 13, marginBottom: 12 }}
        >
          Create an add-on once, then choose which services offer it.
        </Text>
        <Pressable
          onPress={openCreate}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.brandPrimary,
            paddingVertical: 12,
            borderRadius: 10,
            gap: 8,
            marginBottom: 16,
          }}
          accessibilityRole="button"
        >
          <Feather name="plus" size={20} color={theme.brandPrimaryText} />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: theme.brandPrimaryText,
            }}
          >
            New add-on
          </Text>
        </Pressable>

        {notice ? (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "flex-start",
              backgroundColor: theme.brandSurface,
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: theme.brandCream,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {notice}
            </Text>
            <Pressable
              onPress={() => setNotice(null)}
              hitSlop={10}
              accessibilityLabel="Dismiss"
            >
              <Feather name="x" size={16} color={theme.brandTextDim} />
            </Pressable>
          </View>
        ) : null}

        {reviewCount > 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: theme.brandGold,
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text
              style={{ color: theme.brandCream, fontSize: 13, lineHeight: 18 }}
            >
              {reviewCount === 1
                ? "One service charges its own price"
                : `${reviewCount} services charge their own price`}{" "}
              for an add-on whose price changed. Choose to use the new price or
              keep the old one below.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator
            color={theme.brandGold}
            style={{ marginTop: 24 }}
          />
        ) : loadError ? (
          <Text style={{ color: theme.brandError, fontSize: 14 }}>
            {loadError}
          </Text>
        ) : addons.length === 0 ? (
          <View style={{ alignItems: "center", padding: 32 }}>
            <Feather name="plus-circle" size={48} color={theme.brandTextDim} />
            <Text
              style={{
                fontSize: 16,
                color: theme.brandTextDim,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              No add-ons yet
            </Text>
            <Text style={{ ...smallText, marginTop: 6, textAlign: "center" }}>
              Create one here, or add one while editing a service. Either way it
              shows up in this list.
            </Text>
          </View>
        ) : (
          addons.map((a) => {
            const anyOn = a.services.some((s) => s.isActive);
            const anyOff = a.services.some((s) => !s.isActive);
            return (
              <View
                key={a.id}
                style={{
                  backgroundColor: theme.brandBgElevated,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: a.isActive ? theme.brandCream : theme.brandTextDim,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {a.name}
                </Text>
                <Text style={{ ...smallText, marginTop: 2 }}>
                  {money(a.priceCents)}
                  {a.durationMinutes > 0
                    ? ` · +${formatDuration(a.durationMinutes)}`
                    : " · doesn't add time"}
                  {!a.isActive ? " · off" : ""}
                </Text>
                {a.description ? (
                  <Text style={{ ...smallText, marginTop: 4 }}>
                    {a.description}
                  </Text>
                ) : null}

                <View style={{ marginTop: 10 }}>
                  {productNamesOf(a).length > 0 ? (
                    <Text style={{ ...smallText, marginBottom: 6 }}>
                      On {productNamesOf(a).length === 1 ? "product" : "products"}: {productNamesOf(a).join(", ")}
                    </Text>
                  ) : null}
                  {a.services.length === 0 ? (
                    <Text style={smallText}>Not on any service yet.</Text>
                  ) : (
                    a.services.map((s) => (
                      <View
                        key={s.addonId}
                        style={{
                          backgroundColor: theme.brandSurface,
                          borderRadius: 8,
                          padding: 10,
                          marginBottom: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: s.isActive
                                ? theme.brandCream
                                : theme.brandTextDim,
                              fontSize: 14,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {s.serviceName}
                            {s.serviceStatus === "archived"
                              ? " (archived)"
                              : ""}
                            {!s.isActive ? " (off)" : ""}
                          </Text>
                          <Text style={smallText}>
                            {!s.priceSynced && s.priceCents !== a.priceCents
                              ? `Own price ${money(s.priceCents)}`
                              : money(s.priceCents)}
                          </Text>
                        </View>
                        {s.needsPriceReview ? (
                          <View style={{ marginTop: 8 }}>
                            <Text
                              style={{
                                color: theme.brandCream,
                                fontSize: 12,
                                marginBottom: 6,
                              }}
                            >
                              Charges {money(s.priceCents)}. Your add-on price
                              is now {money(a.priceCents)}.
                            </Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <Pressable
                                disabled={reviewBusy === s.addonId}
                                onPress={() => review(a, s, "sync")}
                                style={{
                                  ...outlineBtn,
                                  borderColor: theme.brandGold,
                                }}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color: theme.brandGold,
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  Use {money(a.priceCents)}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={reviewBusy === s.addonId}
                                onPress={() => review(a, s, "keep")}
                                style={outlineBtn}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color: theme.brandTextDim,
                                    fontSize: 12,
                                    fontWeight: "600",
                                  }}
                                >
                                  Keep {money(s.priceCents)}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <Pressable
                    onPress={() => openSheet({ kind: "attach", addon: a })}
                    style={{ ...outlineBtn, borderColor: theme.brandGold }}
                    accessibilityRole="button"
                  >
                    <Text
                      style={{
                        color: theme.brandGold,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Add to services
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openEdit(a)}
                    style={outlineBtn}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: theme.brandCream, fontSize: 13 }}>
                      Edit
                    </Text>
                  </Pressable>
                  {a.services.length === 0 ? (
                    <Pressable
                      onPress={() => toggleNoServices(a)}
                      style={outlineBtn}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: theme.brandCream, fontSize: 13 }}>
                        {a.isActive ? "Turn off" : "Turn on"}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      {anyOn ? (
                        <Pressable
                          onPress={() => openSheet({ kind: "off", addon: a })}
                          style={outlineBtn}
                          accessibilityRole="button"
                        >
                          <Text
                            style={{ color: theme.brandCream, fontSize: 13 }}
                          >
                            Turn off
                          </Text>
                        </Pressable>
                      ) : null}
                      {anyOff ? (
                        <Pressable
                          onPress={() => openSheet({ kind: "on", addon: a })}
                          style={outlineBtn}
                          accessibilityRole="button"
                        >
                          <Text
                            style={{ color: theme.brandCream, fontSize: 13 }}
                          >
                            Turn on
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                  <Pressable
                    onPress={() => openSheet({ kind: "delete", addon: a })}
                    style={{ ...outlineBtn, borderColor: theme.brandError }}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: theme.brandError, fontSize: 13 }}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
      {renderForm()}
      {renderSheet()}
    </ScrollView>
  );
}

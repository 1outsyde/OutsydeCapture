/**
 * Product options editor (vendor side) — mockups "Vendor 1 · Add options" and
 * "Vendor 2 · Price every variant".
 *
 * The vendor names up to 3 options (Length, Size, Color) and adds values as
 * chips. Every combination becomes a variation with its own price, stock,
 * on/off switch and (per value of the first option) a photo. A blank price
 * means "use the product price", so 15 colors at one price are entered once.
 *
 * Saved by the parent through the ref: getSaveBody() → PUT
 * /api/business/products/:id/options (backend #310). Nothing is sent unless
 * the vendor changed something here, so products with older label-only
 * variations are left untouched until the vendor sets up options.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/hooks/useTheme";
import { uploadImage } from "@/services/mediaUpload";
import type {
  ProductOptionValue,
  ProductOptionsResponse,
  SaveProductOptionsBody,
} from "@/services/api";

import {
  MAX_OPTIONS,
  MAX_NAME,
  QUICK_FILLS,
  OptionDraft,
  RowDraft,
  norm,
  keyOf,
  centsToInput,
  formatCents,
  newKey,
  initialState,
  buildSaveBody,
  combosOf,
  liveOptionsOf,
} from "./productOptionsLogic";

export { MAX_OPTIONS };

export interface ProductOptionsEditorHandle {
  /**
   * null      → nothing changed here, don't call the options route
   * { error } → show this message, don't save
   * { body }  → send to PUT /api/business/products/:id/options
   */
  getSaveBody(): null | { error: string } | { body: SaveProductOptionsBody };
}

interface Props {
  /** what GET /api/business/products/:id/options returned; null for a new product */
  initial: ProductOptionsResponse | null;
  /** product price from the form, for placeholders and the "From" summary */
  productPriceCents: number;
  /** product stock from the form, for placeholders */
  productInventory: number | null;
  authToken: string;
}

const ProductOptionsEditor = forwardRef<ProductOptionsEditorHandle, Props>(
  function ProductOptionsEditor(
    { initial, productPriceCents, productInventory, authToken },
    ref,
  ) {
    const { theme } = useTheme();
    const start = useMemo(() => initialState(initial), [initial]);
    const [options, setOptions] = useState<OptionDraft[]>(start.options);
    const [rows, setRows] = useState<Record<string, RowDraft>>(start.rows);
    const [dirty, setDirty] = useState(false);
    const [bulkPrice, setBulkPrice] = useState("");
    const [bulkStock, setBulkStock] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [uploadingGroup, setUploadingGroup] = useState<string | null>(null);
    const legacyLabels = start.legacyLabels;

    const touch = () => setDirty(true);

    // Options that count: a name and at least one value.
    const liveOptions = liveOptionsOf(options);
    const combos = useMemo(
      () => combosOf(options),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [JSON.stringify(liveOptions.map((o) => o.values.map((v) => v.value)))],
    );
    const rowFor = (combo: string[]): RowDraft =>
      rows[keyOf(combo)] ?? {
        priceInput: "",
        stockInput: "",
        isActive: true,
        imageUrl: null,
      };
    const updateRow = (combo: string[], patch: Partial<RowDraft>) => {
      touch();
      setRows((prev) => ({
        ...prev,
        [keyOf(combo)]: { ...rowFor(combo), ...prev[keyOf(combo)], ...patch },
      }));
    };

    // ── options ──────────────────────────────────────────────────────────────
    const updateOption = (i: number, patch: Partial<OptionDraft>) => {
      touch();
      setOptions((prev) =>
        prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
      );
    };
    const addValues = (i: number, raw: string[]) => {
      const o = options[i];
      const existing = new Set(o.values.map((v) => v.value.toLowerCase()));
      const add: ProductOptionValue[] = [];
      for (const r of raw) {
        const value = norm(r).slice(0, MAX_NAME);
        if (value && !existing.has(value.toLowerCase())) {
          existing.add(value.toLowerCase());
          add.push({ value, swatchHex: null });
        }
      }
      updateOption(i, { values: [...o.values, ...add], newValue: "" });
    };
    const removeValue = (i: number, value: string) =>
      updateOption(i, {
        values: options[i].values.filter((v) => v.value !== value),
      });
    const addOption = () => {
      if (options.length >= MAX_OPTIONS) return;
      touch();
      setOptions((prev) => [
        ...prev,
        { key: newKey(), name: "", values: [], newValue: "" },
      ]);
    };
    const removeOption = (i: number) => {
      touch();
      setOptions((prev) => prev.filter((_, idx) => idx !== i));
    };
    const quickFill = (i: number, fill: (typeof QUICK_FILLS)[number]) => {
      if (!norm(options[i].name)) updateOption(i, { name: fill.name });
      addValues(i, fill.values);
    };

    // ── bulk ─────────────────────────────────────────────────────────────────
    const applyBulkPrice = () => {
      const parsed = bulkPrice.trim() === "" ? null : Number(bulkPrice);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
        Alert.alert(
          "Check the price",
          "Enter a price above $0, or leave it blank to use the product price.",
        );
        return;
      }
      touch();
      setRows((prev) => {
        const next = { ...prev };
        for (const c of combos)
          next[keyOf(c)] = {
            ...rowFor(c),
            ...prev[keyOf(c)],
            priceInput: parsed === null ? "" : parsed.toFixed(2),
          };
        return next;
      });
      setBulkPrice("");
    };
    const applyBulkStock = () => {
      const parsed = bulkStock.trim() === "" ? null : Number(bulkStock);
      if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
        Alert.alert("Check the stock", "Enter a whole number, 0 or more.");
        return;
      }
      touch();
      setRows((prev) => {
        const next = { ...prev };
        for (const c of combos)
          next[keyOf(c)] = {
            ...rowFor(c),
            ...prev[keyOf(c)],
            stockInput: parsed === null ? "" : String(parsed),
          };
        return next;
      });
      setBulkStock("");
    };

    // ── photo per value of the first option ──────────────────────────────────
    const pickGroupPhoto = async (groupValue: string) => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to upload images.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      try {
        setUploadingGroup(groupValue);
        const uploaded = await uploadImage(
          result.assets[0].uri,
          "image/jpeg",
          "products",
          authToken,
        );
        touch();
        setRows((prev) => {
          const next = { ...prev };
          for (const c of combos)
            if (c[0] === groupValue)
              next[keyOf(c)] = {
                ...rowFor(c),
                ...prev[keyOf(c)],
                imageUrl: uploaded.url,
              };
          return next;
        });
      } catch (e: any) {
        Alert.alert("Upload Error", e?.message || "Failed to upload photo");
      } finally {
        setUploadingGroup(null);
      }
    };
    const clearGroupPhoto = (groupValue: string) => {
      touch();
      setRows((prev) => {
        const next = { ...prev };
        for (const c of combos)
          if (c[0] === groupValue)
            next[keyOf(c)] = {
              ...rowFor(c),
              ...prev[keyOf(c)],
              imageUrl: null,
            };
        return next;
      });
    };

    // ── save body for the parent ─────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        getSaveBody() {
          if (!dirty) return null;
          return buildSaveBody(options, rows);
        },
      }),
      [dirty, options, rows],
    );

    // ── render helpers ───────────────────────────────────────────────────────
    const styles = makeStyles(theme);
    const priceFor = (r: RowDraft) =>
      r.priceInput.trim() !== ""
        ? Math.round(Number(r.priceInput) * 100)
        : productPriceCents;
    const stockFor = (r: RowDraft) =>
      r.stockInput.trim() !== "" ? Number(r.stockInput) : productInventory;
    const groups = useMemo(() => {
      if (liveOptions.length < 2) return [];
      return liveOptions[0].values.map((v) => ({
        value: v.value,
        combos: combos.filter((c) => c[0] === v.value),
      }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combos]);

    const renderRow = (combo: string[], label: string, showPhoto: boolean) => {
      const r = rowFor(combo);
      return (
        <View
          key={keyOf(combo)}
          style={[styles.row, !r.isActive && { opacity: 0.5 }]}
        >
          {showPhoto && renderPhoto(combo[0], r.imageUrl, 40)}
          <Text style={styles.rowLabel} numberOfLines={1}>
            {label}
          </Text>
          <TextInput
            style={styles.cellInput}
            value={r.priceInput}
            onChangeText={(t) =>
              updateRow(combo, { priceInput: t.replace(/[^0-9.]/g, "") })
            }
            placeholder={
              productPriceCents > 0 ? centsToInput(productPriceCents) : "Price"
            }
            placeholderTextColor={theme.brandTextDim}
            keyboardType="decimal-pad"
            accessibilityLabel={`Price for ${combo.join(" / ")}, blank uses the product price`}
          />
          <TextInput
            style={[styles.cellInput, { width: 56 }]}
            value={r.stockInput}
            onChangeText={(t) =>
              updateRow(combo, { stockInput: t.replace(/[^0-9]/g, "") })
            }
            placeholder={
              productInventory !== null ? String(productInventory) : "—"
            }
            placeholderTextColor={theme.brandTextDim}
            keyboardType="number-pad"
            accessibilityLabel={`Stock for ${combo.join(" / ")}`}
          />
          <Switch
            value={r.isActive}
            onValueChange={(on) => updateRow(combo, { isActive: on })}
            trackColor={{ true: theme.brandGold }}
            accessibilityLabel={`${combo.join(" / ")} on sale`}
          />
        </View>
      );
    };

    const renderPhoto = (
      groupValue: string,
      url: string | null,
      size: number,
    ) => (
      <Pressable
        onPress={() => pickGroupPhoto(groupValue)}
        onLongPress={() => url && clearGroupPhoto(groupValue)}
        style={[styles.photo, { width: size, height: size }]}
        accessibilityLabel={
          url
            ? `Change photo for ${groupValue}. Long press to remove.`
            : `Add photo for ${groupValue}`
        }
      >
        {uploadingGroup === groupValue ? (
          <ActivityIndicator size="small" color={theme.brandGold} />
        ) : url ? (
          <Image
            source={{ uri: url }}
            style={{ width: size, height: size, borderRadius: 8 }}
          />
        ) : (
          <Feather name="camera" size={16} color={theme.brandGold} />
        )}
      </Pressable>
    );

    const activeCount = combos.filter((c) => rowFor(c).isActive).length;
    const ownPrices = combos
      .map((c) => priceFor(rowFor(c)))
      .filter((p) => p > 0);
    const minPrice = ownPrices.length
      ? Math.min(...ownPrices)
      : productPriceCents;
    const maxPrice = ownPrices.length
      ? Math.max(...ownPrices)
      : productPriceCents;

    return (
      <View style={styles.wrap}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>OPTIONS</Text>
            <Text style={styles.sub}>
              Same item, different size, color or length
            </Text>
          </View>
          <Text style={styles.sub}>
            {options.length} of {MAX_OPTIONS}
          </Text>
        </View>

        {legacyLabels.length > 0 && !dirty && (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              This product has older variations ({legacyLabels.join(", ")}).
              Adding options replaces them, and the old ones stop showing to
              customers.
            </Text>
          </View>
        )}

        {options.map((o, i) => (
          <View key={o.key} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>OPTION NAME</Text>
                <TextInput
                  style={styles.nameInput}
                  value={o.name}
                  onChangeText={(t) =>
                    updateOption(i, { name: t.slice(0, MAX_NAME) })
                  }
                  placeholder={
                    i === 0 ? "Size, Color, Length…" : "Another option"
                  }
                  placeholderTextColor={theme.brandTextDim}
                />
              </View>
              <Pressable
                onPress={() => removeOption(i)}
                style={styles.iconBtn}
                accessibilityLabel={`Remove ${o.name || "option"}`}
              >
                <Feather name="trash-2" size={18} color={theme.brandTextDim} />
              </Pressable>
            </View>

            <View style={styles.chips}>
              {o.values.map((v) => (
                <View key={v.value} style={styles.chip}>
                  {v.swatchHex ? (
                    <View
                      style={[styles.swatch, { backgroundColor: v.swatchHex }]}
                    />
                  ) : null}
                  <Text style={styles.chipText}>{v.value}</Text>
                  <Pressable
                    onPress={() => removeValue(i, v.value)}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${v.value}`}
                  >
                    <Feather name="x" size={14} color={theme.brandTextDim} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.addRow}>
              <TextInput
                style={[styles.nameInput, { flex: 1 }]}
                value={o.newValue}
                onChangeText={(t) =>
                  setOptions((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, newValue: t } : x,
                    ),
                  )
                }
                onSubmitEditing={() => addValues(i, o.newValue.split(","))}
                placeholder={`Add ${norm(o.name) ? norm(o.name).toLowerCase() : "a value"}`}
                placeholderTextColor={theme.brandTextDim}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <Pressable
                onPress={() => addValues(i, o.newValue.split(","))}
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>

            <View style={styles.chips}>
              {QUICK_FILLS.map((f) => (
                <Pressable
                  key={f.label}
                  onPress={() => quickFill(i, f)}
                  style={styles.quick}
                >
                  <Text style={styles.quickText}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {options.length < MAX_OPTIONS && (
          <Pressable onPress={addOption} style={styles.addOption}>
            <Feather name="plus" size={16} color={theme.brandGold} />
            <Text style={styles.addOptionText}>
              {options.length === 0
                ? "Add an option (size, color, length…)"
                : "Add another option"}
            </Text>
          </Pressable>
        )}

        {combos.length > 0 && (
          <>
            <View style={[styles.headRow, { marginTop: 18 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heading}>PRICE & STOCK</Text>
                <Text style={styles.sub}>
                  {combos.length} variations, {activeCount} on sale ·{" "}
                  {minPrice === maxPrice
                    ? formatCents(minPrice)
                    : `${formatCents(minPrice)} to ${formatCents(maxPrice)}`}
                </Text>
              </View>
            </View>
            <Text style={styles.help}>
              Leave a price blank to use the product price. Leave stock blank to
              use the product stock.
            </Text>

            <View style={styles.bulkRow}>
              <TextInput
                style={[styles.cellInput, { flex: 1 }]}
                value={bulkPrice}
                onChangeText={(t) => setBulkPrice(t.replace(/[^0-9.]/g, ""))}
                placeholder="Price for all"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="decimal-pad"
              />
              <Pressable onPress={applyBulkPrice} style={styles.bulkBtn}>
                <Text style={styles.bulkBtnText}>Set all prices</Text>
              </Pressable>
            </View>
            <View style={styles.bulkRow}>
              <TextInput
                style={[styles.cellInput, { flex: 1 }]}
                value={bulkStock}
                onChangeText={(t) => setBulkStock(t.replace(/[^0-9]/g, ""))}
                placeholder="Stock for all"
                placeholderTextColor={theme.brandTextDim}
                keyboardType="number-pad"
              />
              <Pressable onPress={applyBulkStock} style={styles.bulkBtn}>
                <Text style={styles.bulkBtnText}>Set all stock</Text>
              </Pressable>
            </View>

            <View style={styles.colHead}>
              <Text style={[styles.colText, { flex: 1 }]}>
                {liveOptions.length >= 2
                  ? liveOptions
                      .slice(1)
                      .map((o) => norm(o.name))
                      .join(" / ")
                      .toUpperCase()
                  : norm(liveOptions[0].name).toUpperCase()}
              </Text>
              <Text style={[styles.colText, { width: 76 }]}>PRICE</Text>
              <Text style={[styles.colText, { width: 64 }]}>STOCK</Text>
              <Text style={[styles.colText, { width: 52, textAlign: "right" }]}>
                ON
              </Text>
            </View>

            {liveOptions.length === 1
              ? combos.map((c) => renderRow(c, c[0], true))
              : groups.map((g) => {
                  const groupRows = g.combos.map(rowFor);
                  const open = !collapsed[g.value];
                  const stockTotal = groupRows.reduce(
                    (n, r) => n + (stockFor(r) ?? 0),
                    0,
                  );
                  const soldOut = g.combos
                    .filter((c) => stockFor(rowFor(c)) === 0)
                    .map((c) => c.slice(1).join(" / "));
                  return (
                    <View key={g.value} style={styles.card}>
                      <Pressable
                        style={styles.groupHead}
                        onPress={() =>
                          setCollapsed((p) => ({ ...p, [g.value]: open }))
                        }
                      >
                        {renderPhoto(
                          g.value,
                          groupRows[0]?.imageUrl ?? null,
                          48,
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.groupTitle}>{g.value}</Text>
                          <Text
                            style={[
                              styles.sub,
                              soldOut.length
                                ? { color: theme.brandPending }
                                : null,
                            ]}
                          >
                            {soldOut.length
                              ? `${soldOut.join(", ")} sold out · `
                              : ""}
                            {stockTotal} in stock
                          </Text>
                        </View>
                        <Feather
                          name={open ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={theme.brandTextDim}
                        />
                      </Pressable>
                      {open &&
                        g.combos.map((c) =>
                          renderRow(c, c.slice(1).join(" / "), false),
                        )}
                    </View>
                  );
                })}
            <Text style={styles.help}>
              Tap a photo to add one for that{" "}
              {norm(liveOptions[0].name).toLowerCase()}. Customers see it when
              they pick it. Long press to remove.
            </Text>
          </>
        )}

        {dirty &&
          options.length === 0 &&
          (initial?.variants?.some((v) => v.isActive) ?? false) && (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                Saving with no options switches every variation off. Customers
                will see one price.
              </Text>
            </View>
          )}
      </View>
    );
  },
);

export default ProductOptionsEditor;

function makeStyles(theme: any) {
  return StyleSheet.create({
    wrap: { marginTop: 16, gap: 12 },
    headRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    heading: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 1,
      color: theme.brandGold,
    },
    sub: { fontSize: 12, color: theme.brandTextDim },
    help: { fontSize: 12, color: theme.brandTextDim, lineHeight: 17 },
    note: {
      borderRadius: 12,
      padding: 12,
      backgroundColor: "rgba(255,149,0,0.12)",
    },
    noteText: { fontSize: 13, color: theme.brandCream, lineHeight: 18 },
    card: {
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    smallLabel: {
      fontSize: 11,
      letterSpacing: 0.5,
      color: theme.brandTextDim,
      marginBottom: 4,
    },
    nameInput: {
      color: theme.brandCream,
      fontSize: 16,
      fontWeight: "600",
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
      paddingVertical: 6,
    },
    iconBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    chipText: { color: theme.brandCream, fontSize: 14 },
    swatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
    },
    addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    addBtn: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.brandGold,
      justifyContent: "center",
    },
    addBtnText: { color: theme.brandGold, fontWeight: "700" },
    quick: {
      height: 32,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(232,185,48,0.6)",
      justifyContent: "center",
    },
    quickText: { color: theme.brandGold, fontSize: 12, fontWeight: "600" },
    addOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(255,255,255,0.2)",
    },
    addOptionText: { color: theme.brandCream, fontWeight: "600" },
    bulkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    bulkBtn: {
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      backgroundColor: theme.brandSurface,
      justifyContent: "center",
    },
    bulkBtnText: { color: theme.brandCream, fontWeight: "600", fontSize: 13 },
    colHead: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 4,
      gap: 8,
    },
    colText: { fontSize: 10, letterSpacing: 0.6, color: theme.brandTextDim },
    row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
    rowLabel: {
      flex: 1,
      color: theme.brandCream,
      fontWeight: "600",
      fontSize: 14,
    },
    cellInput: {
      width: 76,
      height: 36,
      borderRadius: 8,
      paddingHorizontal: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
      color: theme.brandCream,
      fontSize: 14,
    },
    groupHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    groupTitle: { color: theme.brandCream, fontWeight: "700", fontSize: 15 },
    photo: {
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(232,185,48,0.6)",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
  });
}

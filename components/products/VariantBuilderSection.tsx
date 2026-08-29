import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import api, { ProductVariant, LocalVariant } from "@/services/api";

interface VariantBuilderSectionProps {
  productId?: string;
  initialVariants?: ProductVariant[];
  onVariantsChange: (variants: LocalVariant[]) => void;
  authToken: string;
}

export default function VariantBuilderSection({
  productId,
  initialVariants,
  onVariantsChange,
  authToken,
}: VariantBuilderSectionProps) {
  const { theme } = useTheme();
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<LocalVariant[]>([]);

  useEffect(() => {
    if (initialVariants && initialVariants.length > 0) {
      setHasVariants(true);
      setVariants(
        initialVariants.map((v) => ({
          id: v.id,
          label: v.label,
          priceCents: v.priceCents,
          inventory: v.inventory ?? null,
          isActive: v.isActive,
          sortOrder: v.sortOrder,
          isNew: false,
          isDirty: false,
          isDeleted: false,
        }))
      );
    }
  }, []); // run once on mount only

  useEffect(() => {
    onVariantsChange(variants);
  }, [variants]);

  const updateVariant = (index: number, patch: Partial<LocalVariant>) => {
    setVariants((prev: LocalVariant[]) =>
      prev.map((v: LocalVariant, i: number) => (i === index ? { ...v, ...patch } : v))
    );
  };

  const moveVariant = (index: number, dir: "up" | "down") => {
    setVariants((prev: LocalVariant[]) => {
      const visible = prev.filter((v: LocalVariant) => !v.isDeleted);
      const next = [...prev];
      const target = dir === "up" ? visible[index - 1] : visible[index + 1];
      if (!target) return prev;
      const aIdx = next.indexOf(visible[index]);
      const bIdx = next.indexOf(target);
      [next[aIdx].sortOrder, next[bIdx].sortOrder] = [
        next[bIdx].sortOrder,
        next[aIdx].sortOrder,
      ];
      next[aIdx].isDirty = true;
      next[bIdx].isDirty = true;
      return [...next].sort((a: LocalVariant, b: LocalVariant) => a.sortOrder - b.sortOrder);
    });
  };

  const handleDeleteVariant = async (index: number) => {
    const visible = variants.filter((v: LocalVariant) => !v.isDeleted);
    const variant = visible[index];
    if (variant.isNew) {
      // Not yet saved — remove from local state only
      setVariants((prev: LocalVariant[]) => {
        const allVisible = prev.filter((v: LocalVariant) => !v.isDeleted);
        const target = allVisible[index];
        return prev.filter((v: LocalVariant) => v !== target);
      });
      return;
    }
    // Saved — call soft-delete API immediately
    try {
      await api.deleteProductVariant(authToken, productId!, variant.id!);
      setVariants((prev: LocalVariant[]) =>
        prev.map((v: LocalVariant) => (v.id === variant.id ? { ...v, isDeleted: true } : v))
      );
    } catch {
      Alert.alert("Error", "Could not delete variant. Please try again.");
    }
  };

  const styles = StyleSheet.create({
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.brandCream,
      marginBottom: 6,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 6,
      gap: 8,
    },
    headerText: {
      fontSize: 11,
      color: "rgba(200,191,168,0.55)",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    variantRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 8,
      borderLeftWidth: 3,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.06)",
    },
    input: {
      backgroundColor: theme.brandSurface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.brandCream,
    },
    orderControls: {
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
    },
    orderButton: {
      width: 44,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    infoTip: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 8,
      opacity: 0.6,
    },
  });

  const visibleVariants = variants.filter((v: LocalVariant) => !v.isDeleted);

  const renderVariantRow = ({
    item,
    index,
  }: {
    item: LocalVariant;
    index: number;
  }) => {
    const isFirst = index === 0;
    const isLast = index === visibleVariants.length - 1;
    const dimColor = "rgba(200,191,168,0.3)";
    const dimColorActive = "rgba(200,191,168,0.7)";

    return (
      <View
        style={[
          styles.variantRow,
          {
            borderLeftColor: item.isActive ? "#C9933A" : "transparent",
            backgroundColor: "rgba(255,255,255,0.04)",
          },
        ]}
      >
        {/* Label */}
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="e.g. 10 inch, 1 Hour"
          placeholderTextColor="rgba(200,191,168,0.4)"
          value={item.label}
          onChangeText={(text: string) => updateVariant(index, { label: text, isDirty: true })}
        />

        {/* Price */}
        <TextInput
          style={[styles.input, { flex: 1.5 }]}
          keyboardType="decimal-pad"
          placeholder="$0.00"
          placeholderTextColor="rgba(200,191,168,0.4)"
          value={item.priceCents > 0 ? (item.priceCents / 100).toFixed(2) : ""}
          onChangeText={(text: string) => {
            const dollars = parseFloat(text || "0");
            const cents = Math.round(dollars * 100);
            updateVariant(index, {
              priceCents: isNaN(cents) ? 0 : cents,
              isDirty: true,
            });
          }}
        />

        {/* Stock */}
        <TextInput
          style={[styles.input, { flex: 1 }]}
          keyboardType="number-pad"
          placeholder="∞"
          placeholderTextColor="rgba(200,191,168,0.4)"
          value={item.inventory !== null ? String(item.inventory) : ""}
          onChangeText={(text: string) => {
            if (text === "") {
              updateVariant(index, { inventory: null, isDirty: true });
            } else {
              const qty = parseInt(text, 10);
              updateVariant(index, {
                inventory: isNaN(qty) ? null : qty,
                isDirty: true,
              });
            }
          }}
        />

        {/* Active toggle */}
        <View style={{ flex: 0.8, alignItems: "center" }}>
          <Switch
            value={item.isActive}
            onValueChange={(val: boolean) => updateVariant(index, { isActive: val, isDirty: true })}
            trackColor={{
              false: "rgba(255,255,255,0.2)",
              true: "rgba(201,147,58,0.3)",
            }}
            thumbColor={item.isActive ? "#C9933A" : theme.brandCream}
            style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
          />
        </View>

        {/* Sort order controls */}
        <View style={[styles.orderControls, { flex: 0.6 }]}>
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => moveVariant(index, "up")}
            disabled={isFirst}
          >
            <Text
              style={{
                color: isFirst ? dimColor : dimColorActive,
                fontSize: 16,
                lineHeight: 20,
              }}
            >
              ↑
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => moveVariant(index, "down")}
            disabled={isLast}
          >
            <Text
              style={{
                color: isLast ? dimColor : dimColorActive,
                fontSize: 16,
                lineHeight: 20,
              }}
            >
              ↓
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete */}
        <TouchableOpacity
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          onPress={() => handleDeleteVariant(index)}
        >
          <Ionicons name="trash-outline" size={18} color="rgba(200,191,168,0.5)" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ marginTop: 4, marginBottom: 8 }}>
      {/* Toggle row */}
      <View style={styles.toggleRow}>
        <Text style={styles.inputLabel}>Does this product have variants?</Text>
        <Switch
          value={hasVariants}
          onValueChange={(val: boolean) => {
            setHasVariants(val);
            if (!val) setVariants([]);
          }}
          trackColor={{
            false: "rgba(255,255,255,0.2)",
            true: "rgba(201,147,58,0.3)",
          }}
          thumbColor={hasVariants ? "#C9933A" : theme.brandCream}
        />
      </View>

      {hasVariants && (
        <View>
          {/* Column headers */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerText, { flex: 2 }]}>Label</Text>
            <Text style={[styles.headerText, { flex: 1.5 }]}>Price</Text>
            <Text style={[styles.headerText, { flex: 1 }]}>Stock</Text>
            <Text style={[styles.headerText, { flex: 0.8, textAlign: "center" }]}>On</Text>
            <Text style={[styles.headerText, { flex: 0.6, textAlign: "center" }]}>Order</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Variant rows */}
          <FlatList
            data={visibleVariants}
            keyExtractor={(item: LocalVariant, index: number) => item.id ?? `new-${index}`}
            renderItem={renderVariantRow}
            scrollEnabled={false}
          />

          {/* Add variant button */}
          <TouchableOpacity
            onPress={() => {
              const newSortOrder = visibleVariants.length;
              setVariants((prev: LocalVariant[]) => [
                ...prev,
                {
                  label: "",
                  priceCents: 0,
                  inventory: null,
                  isActive: true,
                  sortOrder: newSortOrder,
                  isNew: true,
                  isDirty: false,
                  isDeleted: false,
                },
              ]);
            }}
            style={styles.addButton}
          >
            <Ionicons name="add-circle-outline" size={20} color="#C9933A" />
            <Text style={{ color: "#C9933A", fontSize: 14, fontWeight: "500" }}>
              Add Variant
            </Text>
          </TouchableOpacity>

          {/* Info tip */}
          <View style={styles.infoTip}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={theme.brandCream}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{ fontSize: 12, color: theme.brandCream, flex: 1, lineHeight: 18 }}
            >
              Variants let customers choose options — like size, length, or
              duration — each with its own price and inventory.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

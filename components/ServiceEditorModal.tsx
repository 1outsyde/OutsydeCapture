import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";

const SERVICE_CATEGORIES = [
  "Portrait",
  "Wedding",
  "Event",
  "Product",
  "Fashion",
  "Real Estate",
  "Headshot",
  "Family",
  "Maternity",
  "Newborn",
  "Engagement",
  "Concert",
  "Sports",
  "Other",
];

const PRICING_MODELS = [
  { value: "package", label: "Package (Fixed Price)" },
  { value: "hourly", label: "Hourly Rate" },
];

export interface ServiceFormData {
  id?: string;
  name: string;
  description: string;
  category: string;
  pricingModel: "package" | "hourly";
  price: string;
  duration: string;
  packageHours?: string;
  status?: string;
}

interface ServiceEditorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ServiceFormData) => Promise<void>;
  initialData?: ServiceFormData | null;
  brandColor?: string;
}

export default function ServiceEditorModal({
  visible,
  onClose,
  onSave,
  initialData,
  brandColor = "#D4A84B",
}: ServiceEditorModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [formData, setFormData] = useState<ServiceFormData>({
    name: "",
    description: "",
    category: "Portrait",
    pricingModel: "package",
    price: "",
    duration: "60",
    packageHours: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        name: initialData.name || "",
        description: initialData.description || "",
        category: initialData.category || "Portrait",
        pricingModel: initialData.pricingModel || "package",
        price: initialData.price || "",
        duration: initialData.duration || "60",
        packageHours: initialData.packageHours || "",
        status: initialData.status,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        category: "Portrait",
        pricingModel: "package",
        price: "",
        duration: "60",
        packageHours: "",
      });
    }
  }, [initialData, visible]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save service:", error);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialData?.id);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.background,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>
              {isEditing ? "Edit Service" : "New Service"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Service Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder="e.g., Wedding Photography Package"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                placeholder="Describe what's included in this service..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Category</Text>
              <Pressable
                style={[
                  styles.picker,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={{ color: theme.text }}>{formData.category}</Text>
                <Feather name="chevron-down" size={20} color={theme.textSecondary} />
              </Pressable>
              {showCategoryPicker && (
                <View
                  style={[
                    styles.pickerOptions,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.pickerOption,
                        formData.category === cat && { backgroundColor: brandColor + "20" },
                      ]}
                      onPress={() => {
                        setFormData((prev) => ({ ...prev, category: cat }));
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          { color: formData.category === cat ? brandColor : theme.text },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Pricing Model</Text>
              <View style={styles.pricingModelRow}>
                {PRICING_MODELS.map((model) => (
                  <Pressable
                    key={model.value}
                    style={[
                      styles.pricingModelButton,
                      {
                        backgroundColor:
                          formData.pricingModel === model.value ? brandColor : theme.card,
                        borderColor:
                          formData.pricingModel === model.value ? brandColor : theme.border,
                      },
                    ]}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        pricingModel: model.value as "package" | "hourly",
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.pricingModelText,
                        {
                          color: formData.pricingModel === model.value ? "#000" : theme.text,
                        },
                      ]}
                    >
                      {model.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: theme.text }]}>
                  {formData.pricingModel === "hourly" ? "Hourly Rate ($) *" : "Price ($) *"}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={formData.price}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, price: text }))}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: theme.text }]}>
                  {formData.pricingModel === "hourly" ? "Min Hours" : "Duration (min)"}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={formData.pricingModel === "hourly" ? formData.packageHours : formData.duration}
                  onChangeText={(text) =>
                    setFormData((prev) => ({
                      ...prev,
                      [formData.pricingModel === "hourly" ? "packageHours" : "duration"]: text,
                    }))
                  }
                  placeholder={formData.pricingModel === "hourly" ? "2" : "60"}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {isEditing && formData.status && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.text }]}>Current Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        formData.status === "active"
                          ? "#22c55e20"
                          : formData.status === "draft"
                          ? "#f9731620"
                          : "#64748b20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          formData.status === "active"
                            ? "#22c55e"
                            : formData.status === "draft"
                            ? "#f97316"
                            : "#64748b",
                      },
                    ]}
                  >
                    {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                { backgroundColor: brandColor },
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditing ? "Save Changes" : "Create Service"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 16,
  },
  picker: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerOptions: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerOptionText: {
    fontSize: 16,
  },
  pricingModelRow: {
    flexDirection: "row",
    gap: 12,
  },
  pricingModelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pricingModelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

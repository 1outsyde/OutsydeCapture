import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/context/AuthContext";
import {
  getSavedAddresses,
  createSavedAddress,
  updateSavedAddress,
  SavedAddress,
} from "@/services/api";
import { AccountStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AccountStackParamList, "AddressForm">;

export default function AddressFormScreen({ route, navigation }: Props) {
  const { mode } = route.params;
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [existingId, setExistingId] = useState<string | null>(null);
  const [line1, setLine1] = useState("");
  const [aptUnit, setAptUnit] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [label, setLabel] = useState(mode === "shipping" ? "Shipping" : "Billing");

  const [sameAsShipping, setSameAsShipping] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<SavedAddress | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    prefillForm();
  }, []);

  const prefillForm = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const { addresses } = await getSavedAddresses(token);

      const shipping = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
      setShippingAddress(shipping);

      if (mode === "shipping") {
        const addr = shipping;
        if (addr) {
          setExistingId(addr.id);
          setLine1(addr.line1 ?? "");
          setCity(addr.city ?? "");
          setState(addr.state ?? "");
          setZipCode(addr.zipCode ?? "");
          setLabel(addr.label ?? "Shipping");
        }
      } else {
        const billing = addresses.find((a) => a.label === "Billing") ?? null;
        if (billing) {
          setExistingId(billing.id);
          setLine1(billing.line1 ?? "");
          setCity(billing.city ?? "");
          setState(billing.state ?? "");
          setZipCode(billing.zipCode ?? "");
        }
      }
    } catch {
      // Non-fatal — form stays empty
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSameAsShipping = () => {
    const next = !sameAsShipping;
    setSameAsShipping(next);
    if (next && shippingAddress) {
      setLine1(shippingAddress.line1 ?? "");
      setCity(shippingAddress.city ?? "");
      setState(shippingAddress.state ?? "");
      setZipCode(shippingAddress.zipCode ?? "");
    }
  };

  const validate = (): boolean => {
    if (!line1 || line1.trim().length < 3) {
      Alert.alert("Invalid Address", "Please enter a valid street address.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const addressData = {
        label,
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        isDefault: mode === "shipping",
      };

      if (existingId) {
        await updateSavedAddress(token, existingId, addressData);
      } else {
        await createSavedAddress(token, addressData);
      }

      Alert.alert("Saved", "Your address has been saved.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save address. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a9fd4" />
      </View>
    );
  }

  const inputsDisabled = mode === "billing" && sameAsShipping;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 72 }]}
      keyboardShouldPersistTaps="handled"
    >
      {mode === "billing" && (
        <Pressable style={styles.sameAsRow} onPress={handleToggleSameAsShipping}>
          <View
            style={[
              styles.checkbox,
              { backgroundColor: sameAsShipping ? "#4a9fd4" : "transparent" },
            ]}
          >
            {sameAsShipping && (
              <ThemedText style={styles.checkmark}>✓</ThemedText>
            )}
          </View>
          <ThemedText style={styles.sameAsLabel}>Same as shipping address</ThemedText>
        </Pressable>
      )}

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Street address *</ThemedText>
        <TextInput
          style={[styles.addressInput, inputsDisabled && styles.disabledInput]}
          value={line1}
          onChangeText={setLine1}
          placeholder="123 Main Street"
          placeholderTextColor="rgba(200,191,168,0.4)"
          autoCorrect={false}
          editable={!inputsDisabled}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Apt / Unit (optional)</ThemedText>
        <TextInput
          style={[styles.addressInput, inputsDisabled && styles.disabledInput]}
          value={aptUnit}
          onChangeText={setAptUnit}
          placeholder="Apt 4B"
          placeholderTextColor="rgba(200,191,168,0.4)"
          autoCorrect={false}
          editable={!inputsDisabled}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>City</ThemedText>
        <TextInput
          style={[styles.addressInput, inputsDisabled && styles.disabledInput]}
          value={city}
          onChangeText={setCity}
          placeholder="Austin"
          placeholderTextColor="rgba(200,191,168,0.4)"
          autoCorrect={false}
          editable={!inputsDisabled}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>State</ThemedText>
        <TextInput
          style={[styles.addressInput, inputsDisabled && styles.disabledInput]}
          value={state}
          onChangeText={setState}
          placeholder="TX"
          placeholderTextColor="rgba(200,191,168,0.4)"
          autoCorrect={false}
          autoCapitalize="characters"
          editable={!inputsDisabled}
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>ZIP code</ThemedText>
        <TextInput
          style={[styles.addressInput, inputsDisabled && styles.disabledInput]}
          value={zipCode}
          onChangeText={setZipCode}
          placeholder="78701"
          placeholderTextColor="rgba(200,191,168,0.4)"
          keyboardType="number-pad"
          editable={!inputsDisabled}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          (saving || inputsDisabled) && styles.saveButtonDisabled,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleSave}
        disabled={saving || inputsDisabled}
      >
        {saving ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <ThemedText style={styles.saveButtonText}>Save Address</ThemedText>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141414",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#141414",
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sameAsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#4a9fd4",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  sameAsLabel: {
    fontSize: 15,
    color: "#f0f0f0",
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(200,191,168,0.8)",
    marginBottom: 6,
  },
  addressInput: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#F0EAD6",
    paddingHorizontal: 16,
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.5,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#E8B930",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
});

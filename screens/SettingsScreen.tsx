import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getSavedAddresses, SavedAddress } from "@/services/api";
import { BASE_URL } from "@/constants/config";
import { AccountStackParamList } from "@/navigation/types";

type SettingsNavigationProp = NativeStackNavigationProp<AccountStackParamList, "Settings">;

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { isDark, toggleTheme } = useTheme();
  const { getToken, logout } = useAuth();

  const [shippingAddress, setShippingAddress] = useState<SavedAddress | null>(null);
  const [billingAddress, setBillingAddress] = useState<SavedAddress | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setAddressesLoading(true);
    setAddressError(false);
    try {
      const token = await getToken();
      if (!token) return;
      const { addresses } = await getSavedAddresses(token);
      setShippingAddress(addresses.find((a) => a.isDefault) ?? addresses[0] ?? null);
      setBillingAddress(addresses.find((a) => a.label === "Billing") ?? null);
    } catch {
      setAddressError(true);
    } finally {
      setAddressesLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log out", "You'll need to sign back in to access your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            Alert.alert(
              "Final Confirmation",
              "Your account will be scheduled for deletion. You have 30 days to cancel before all data is permanently removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete My Account",
                  style: "destructive",
                  onPress: confirmDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      const token = await SecureStore.getItemAsync("outsyde_access_token");
      const response = await fetch(`${BASE_URL}/api/account/delete-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (data.blocked) {
        Alert.alert("Cannot Delete Account", data.reason);
        return;
      }

      if (data.alreadyPending) {
        const date = new Date(data.scheduledDeletionAt).toLocaleDateString();
        Alert.alert(
          "Already Scheduled",
          `Your account is already scheduled for deletion on ${date}.`
        );
        await logout();
        return;
      }

      const date = new Date(data.scheduledDeletionAt).toLocaleDateString();
      Alert.alert(
        "Account Deletion Scheduled",
        `Your account is scheduled for deletion on ${date}. You can cancel this in your account settings before that date.`
      );
      await logout();
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  const renderAddressSubLabel = (address: SavedAddress | null, fallback: string) => {
    if (addressesLoading) {
      return <ActivityIndicator size="small" color="#666" style={{ marginTop: 2 }} />;
    }
    if (addressError) {
      return <ThemedText style={styles.rowSubLabel}>Unable to load</ThemedText>;
    }
    return (
      <ThemedText style={styles.rowSubLabel}>
        {address ? address.line1 : fallback}
      </ThemedText>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ADDRESS */}
      <ThemedText style={styles.sectionLabel}>ADDRESS</ThemedText>
      <View style={styles.sectionContainer}>
        <Pressable
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
          onPress={() => navigation.navigate("AddressForm", { mode: "shipping" })}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: "#102030" }]}>
              <Feather name="package" size={18} color="#4a9fd4" />
            </View>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>Shipping address</ThemedText>
              {renderAddressSubLabel(shippingAddress, "Not set")}
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#444444" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, styles.lastRow, { opacity: pressed ? 0.75 : 1 }]}
          onPress={() => navigation.navigate("AddressForm", { mode: "billing" })}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: "#1e1030" }]}>
              <Feather name="credit-card" size={18} color="#a070e8" />
            </View>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>Billing address</ThemedText>
              {renderAddressSubLabel(billingAddress, "Not set")}
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#444444" />
        </Pressable>
      </View>

      {/* APPEARANCE */}
      <ThemedText style={styles.sectionLabel}>APPEARANCE</ThemedText>
      <View style={styles.sectionContainer}>
        <Pressable
          style={({ pressed }) => [styles.row, styles.lastRow, { opacity: pressed ? 0.75 : 1 }]}
          onPress={toggleTheme}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: "#2a2010" }]}>
              <Feather name={isDark ? "moon" : "sun"} size={18} color="#e8a020" />
            </View>
            <View style={styles.rowTextBlock}>
              <ThemedText style={styles.rowLabel}>Dark mode</ThemedText>
              <ThemedText style={styles.rowSubLabel}>{isDark ? "On" : "Off"}</ThemedText>
            </View>
          </View>
          <View style={[styles.toggleSwitch, { backgroundColor: isDark ? "#e8a020" : "#3a3a3a" }]}>
            <View style={[styles.toggleKnob, { marginLeft: isDark ? 22 : 2 }]} />
          </View>
        </Pressable>
      </View>

      {/* ACCOUNT */}
      <ThemedText style={styles.sectionLabel}>ACCOUNT</ThemedText>
      <View style={styles.sectionContainer}>
        <Pressable
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
          onPress={handleLogout}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: "#202020" }]}>
              <Feather name="log-out" size={18} color="#888" />
            </View>
            <View style={styles.rowTextBlock}>
              <ThemedText style={[styles.rowLabel, { color: "#f0f0f0" }]}>Log out</ThemedText>
              <ThemedText style={[styles.rowSubLabel, { color: "#666" }]}>
                Sign out of your account
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#444444" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, styles.lastRow, { opacity: pressed ? 0.75 : 1 }]}
          onPress={handleDeleteAccount}
        >
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: "#2a1010" }]}>
              <Feather name="trash-2" size={18} color="#e05a4a" />
            </View>
            <View style={styles.rowTextBlock}>
              <ThemedText style={[styles.rowLabel, { color: "#e05a4a" }]}>Delete account</ThemedText>
              <ThemedText style={[styles.rowSubLabel, { color: "#666" }]}>
                Permanently remove your data
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#e05a4a" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141414",
  },
  contentContainer: {
  paddingTop: 32,      // ← add this line
  paddingBottom: 40,
},
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555555",
    letterSpacing: 1.0,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: "#141414",
  },
  sectionContainer: {
    marginHorizontal: 14,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#232323",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    flex: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextBlock: {
    flexDirection: "column",
  },
  rowLabel: {
    color: "#f0f0f0",
    fontSize: 15,
  },
  rowSubLabel: {
    color: "#666666",
    fontSize: 12,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
});

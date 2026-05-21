import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api, { AdminUser, AdminOrder, AdminBooking, AdminConversation } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

type RouteType = RouteProp<RootStackParamList, "AdminUserDetail">;

interface UserDetailData {
  user: AdminUser;
  orders: AdminOrder[];
  bookings: AdminBooking[];
  conversations: AdminConversation[];
  earnings: number;
}

export default function AdminUserDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteType>();
  const { getToken } = useAuth();
  const { userId } = route.params;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserDetailData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    console.log("[AdminUserDetail] Fetching user detail");
    const token = await getToken();
    if (!token) {
      console.warn("[AdminUserDetail] Missing auth token, cannot fetch user detail");
      setData(null);
      setLoading(false);
      return;
    }

    try {
      const result = await api.getAdminUserDetail(token, userId);
      console.log("[AdminUserDetail] User data received:", {
        userId: result?.user?.id,
        email: result?.user?.email,
        status: result?.user?.status,
      });
      setData(result);
    } catch (error: any) {
      console.error("[AdminUserDetail] Fetch error:", error?.message || error);
      Alert.alert("Error", "Could not load user details");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, userId]);

  useEffect(() => {
    console.log("[AdminUserDetail] Screen mounted with userId:", userId);
    setLoading(true);
    fetchUser();
  }, [userId, fetchUser]);

  const handleToggleAccountStatus = useCallback(async () => {
    if (!data) return;
    const token = await getToken();
    if (!token) return;
    const isDisabled = data.user.status === "suspended";
    const identity = data.user.username ? `@${data.user.username}` : data.user.email;
    Alert.alert(
      isDisabled ? "Re-enable Account" : "Disable Account",
      isDisabled
        ? `Are you sure you want to re-enable ${identity}? They will be able to log in again.`
        : `Are you sure you want to disable ${identity}? They will be unable to log in. This can be reversed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isDisabled ? "Re-enable" : "Disable",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              if (isDisabled) {
                await api.enableAdminUser(token, userId);
              } else {
                await api.disableAdminUser(token, userId);
              }
              Alert.alert("Success", isDisabled ? "Account re-enabled" : "Account disabled");
              await fetchUser();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to update account status");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [data, getToken, userId, fetchUser]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    stateContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    stateTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    stateSubtitle: {
      marginTop: 6,
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    backButton: {
      marginTop: 16,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    backButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: Math.max(32, insets.bottom + 16),
    },
    section: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      marginRight: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary + "20",
    },
    name: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    email: {
      marginTop: 2,
      fontSize: 13,
      color: theme.textSecondary,
    },
    statusBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    activeBadge: {
      backgroundColor: "#34C75930",
    },
    suspendedBadge: {
      backgroundColor: "#FF3B3030",
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    activeText: {
      color: "#34C759",
    },
    suspendedText: {
      color: "#FF3B30",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    rowLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    rowValue: {
      flex: 1,
      textAlign: "right",
      marginLeft: 12,
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    accountActionButton: {
      marginTop: 4,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      borderWidth: 1,
    },
    disableButton: {
      backgroundColor: "#FF3B3020",
      borderColor: "#FF3B30",
    },
    enableButton: {
      backgroundColor: "#34C75920",
      borderColor: "#34C759",
    },
    accountActionText: {
      fontSize: 15,
      fontWeight: "700",
    },
  });

  if (loading) {
    console.log("[AdminUserDetail] Rendering: loading state");
    return (
      <View style={[styles.container, styles.stateContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.stateTitle}>Loading user details...</Text>
      </View>
    );
  }

  if (!data?.user) {
    console.log("[AdminUserDetail] Rendering: empty user state");
    return (
      <View style={[styles.container, styles.stateContainer]}>
        <Feather name="user-x" size={42} color={theme.textSecondary} />
        <Text style={styles.stateTitle}>User not found</Text>
        <Text style={styles.stateSubtitle}>Could not load user details for this account.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={16} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  console.log("[AdminUserDetail] Rendering: full user detail");
  const user = data.user;
  const status = user.status === "suspended" ? "suspended" : "active";
  const statusLabel = status === "suspended" ? "DISABLED" : "ACTIVE";
  const displayName = user.name || user.username || user.email || "Unknown User";
  const isDisabled = status === "suspended";
  const accountTypeLabel = user.accountType ? user.accountType.toUpperCase() : "UNKNOWN";
  const createdAtLabel = user.createdAt ? new Date(user.createdAt).toLocaleString() : "Unknown";
  const phoneLabel = (user as AdminUser & { phone?: string }).phone || "Not provided";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </View>
          <View style={[
            styles.statusBadge,
            status === "active" ? styles.activeBadge : styles.suspendedBadge
          ]}>
            <Text style={[
              styles.statusText,
              status === "active" ? styles.activeText : styles.suspendedText
            ]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User info</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Username</Text>
            <Text style={styles.rowValue}>{user.username ? `@${user.username}` : "Not set"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Account type</Text>
            <Text style={styles.rowValue}>{accountTypeLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{phoneLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Created</Text>
            <Text style={styles.rowValue}>{createdAtLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity summary</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Orders</Text>
            <Text style={styles.rowValue}>{data.orders.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Bookings</Text>
            <Text style={styles.rowValue}>{data.bookings.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Conversations</Text>
            <Text style={styles.rowValue}>{data.conversations.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Earnings</Text>
            <Text style={styles.rowValue}>${(Number(data.earnings) || 0).toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.accountActionButton,
              isDisabled ? styles.enableButton : styles.disableButton,
            ]}
            onPress={handleToggleAccountStatus}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={isDisabled ? "#34C759" : "#FF3B30"} />
            ) : (
              <>
                <Feather name={isDisabled ? "check-circle" : "slash"} size={18} color={isDisabled ? "#34C759" : "#FF3B30"} />
                <Text
                  style={[
                    styles.accountActionText,
                    { color: isDisabled ? "#34C759" : "#FF3B30" },
                  ]}
                >
                  {isDisabled ? "Re-enable Account" : "Disable Account"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

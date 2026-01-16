import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from "react-native";
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
  const [activeTab, setActiveTab] = useState<"orders" | "bookings" | "conversations">("orders");

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    
    try {
      setLoading(true);
      const result = await api.getAdminUserDetail(token, userId);
      setData(result);
    } catch (error) {
      console.error("Failed to fetch user detail:", error);
      setData({
        user: {
          id: userId,
          name: "Unknown User",
          email: "",
          accountType: "consumer",
          createdAt: "",
          status: "active",
        },
        orders: [],
        bookings: [],
        conversations: [],
        earnings: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [getToken, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 12,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    profileSection: {
      padding: 20,
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    userName: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
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
    statsRow: {
      flexDirection: "row",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    statCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
    },
    statValue: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: theme.border,
      marginVertical: 8,
    },
    tabsRow: {
      flexDirection: "row",
      padding: 12,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: theme.backgroundDefault,
      alignItems: "center",
    },
    activeTab: {
      backgroundColor: theme.primary + "20",
    },
    tabText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.textSecondary,
    },
    activeTabText: {
      color: theme.primary,
      fontWeight: "600",
    },
    content: {
      flex: 1,
      paddingHorizontal: 12,
    },
    listItem: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    listItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    listItemName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    itemStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    pendingBadge: {
      backgroundColor: "#FFA50030",
    },
    completedBadge: {
      backgroundColor: "#34C75930",
    },
    cancelledBadge: {
      backgroundColor: "#FF3B3030",
    },
    itemStatusText: {
      fontSize: 11,
      fontWeight: "600",
    },
    pendingText: {
      color: "#FFA500",
    },
    completedText: {
      color: "#34C759",
    },
    cancelledText: {
      color: "#FF3B30",
    },
    listItemInfo: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginTop: 12,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    earningsCard: {
      backgroundColor: theme.primary + "15",
      borderRadius: 12,
      padding: 16,
      margin: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    earningsLabel: {
      fontSize: 14,
      color: theme.text,
    },
    earningsValue: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.primary,
    },
  });

  const renderEmptyState = (title: string, subtitle: string, icon: keyof typeof Feather.glyphMap) => (
    <View style={styles.emptyState}>
      <Feather name={icon} size={40} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const getOrderStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { badge: styles.completedBadge, text: styles.completedText };
      case "pending":
        return { badge: styles.pendingBadge, text: styles.pendingText };
      default:
        return { badge: styles.cancelledBadge, text: styles.cancelledText };
    }
  };

  const renderOrderItem = ({ item }: { item: AdminOrder }) => {
    const statusStyle = getOrderStatusStyle(item.status);
    return (
      <View style={styles.listItem}>
        <View style={styles.listItemHeader}>
          <Text style={styles.listItemName}>Order #{item.id.slice(0, 8)}</Text>
          <View style={[styles.itemStatusBadge, statusStyle.badge]}>
            <Text style={[styles.itemStatusText, statusStyle.text]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.listItemInfo}>Business: {item.businessName}</Text>
        <Text style={styles.listItemInfo}>Amount: ${item.amount.toFixed(2)}</Text>
        <Text style={styles.listItemInfo}>Date: {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    );
  };

  const renderBookingItem = ({ item }: { item: AdminBooking }) => {
    const statusStyle = getOrderStatusStyle(item.status === "confirmed" || item.status === "completed" ? "completed" : item.status);
    return (
      <View style={styles.listItem}>
        <View style={styles.listItemHeader}>
          <Text style={styles.listItemName}>Booking #{item.id.slice(0, 8)}</Text>
          <View style={[styles.itemStatusBadge, statusStyle.badge]}>
            <Text style={[styles.itemStatusText, statusStyle.text]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.listItemInfo}>Photographer: {item.photographerName}</Text>
        <Text style={styles.listItemInfo}>Date: {new Date(item.date).toLocaleDateString()}</Text>
        <Text style={styles.listItemInfo}>Amount: ${item.amount.toFixed(2)}</Text>
      </View>
    );
  };

  const renderConversationItem = ({ item }: { item: AdminConversation }) => (
    <View style={styles.listItem}>
      <Text style={styles.listItemName}>
        {item.participants.map(p => p.name).join(" & ")}
      </Text>
      <Text style={styles.listItemInfo}>{item.messageCount} messages</Text>
      {item.lastMessage ? (
        <Text style={styles.listItemInfo} numberOfLines={1}>
          Last: {item.lastMessage}
        </Text>
      ) : null}
    </View>
  );

  const renderContent = () => {
    if (!data) return null;

    switch (activeTab) {
      case "orders":
        return data.orders.length === 0
          ? renderEmptyState("No Orders", "This user has no orders", "shopping-bag")
          : <FlatList data={data.orders} renderItem={renderOrderItem} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 20 }} />;
      case "bookings":
        return data.bookings.length === 0
          ? renderEmptyState("No Bookings", "This user has no bookings", "calendar")
          : <FlatList data={data.bookings} renderItem={renderBookingItem} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 20 }} />;
      case "conversations":
        return data.conversations.length === 0
          ? renderEmptyState("No Conversations", "This user has no conversations", "message-square")
          : <FlatList data={data.conversations} renderItem={renderConversationItem} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 20 }} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.title}>User Details</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.title}>User Not Found</Text>
          </View>
        </View>
        {renderEmptyState("User Not Found", "Could not load user details", "user-x")}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>User Details</Text>
          <Text style={styles.subtitle}>{data.user.email}</Text>
        </View>
      </View>

      <ScrollView>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Feather name="user" size={36} color={theme.primary} />
          </View>
          <Text style={styles.userName}>{data.user.name}</Text>
          <Text style={styles.userEmail}>{data.user.email}</Text>
          <View style={[
            styles.statusBadge,
            data.user.status === "active" ? styles.activeBadge : styles.suspendedBadge
          ]}>
            <Text style={[
              styles.statusText,
              data.user.status === "active" ? styles.activeText : styles.suspendedText
            ]}>
              {data.user.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.orders.length}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.bookings.length}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.conversations.length}</Text>
            <Text style={styles.statLabel}>Chats</Text>
          </View>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsValue}>${data.earnings.toFixed(2)}</Text>
        </View>

        <View style={styles.tabsRow}>
          {(["orders", "bookings", "conversations"] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.content}>
          {renderContent()}
        </View>
      </ScrollView>
    </View>
  );
}

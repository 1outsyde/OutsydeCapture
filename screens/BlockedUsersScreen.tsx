import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";

type BlockedUser = {
  id: string;
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;
};

export default function BlockedUsersScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { getToken } = useAuth();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlockedUsers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.getBlockedUsers(token);
      setBlockedUsers(data.blockedUsers);
    } catch {
      Alert.alert("Error", "Could not load blocked users.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = useCallback(
    async (userId: string) => {
      const token = await getToken();
      if (!token) return;
      try {
        await api.unblockUser(token, userId);
        setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== userId));
      } catch {
        Alert.alert("Error", "Could not unblock user. Please try again.");
      }
    },
    [getToken]
  );

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.info}>
        <Feather name="user-x" size={20} color={theme.textSecondary} />
        <ThemedText style={styles.userId} numberOfLines={1}>
          {item.blockedId}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => handleUnblock(item.blockedId)}
        style={({ pressed }) => [styles.unblockBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <ThemedText style={[styles.unblockText, { color: theme.brandPrimary }]}>
          Unblock
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.brandPrimary} />
      ) : blockedUsers.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="check-circle" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            You haven't blocked anyone.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 48 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16, textAlign: "center" },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  userId: { fontSize: 14, flex: 1 },
  unblockBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  unblockText: { fontSize: 14, fontWeight: "600" },
});

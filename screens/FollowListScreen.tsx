import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import apiClient, { type FollowListRow } from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";

type Kind = "followers" | "following";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 50;

/**
 * Followers / Following lists for any profile (public, like Instagram).
 * Opened by tapping the counts on a profile. Rows show the business / photographer name and logo
 * for pros; tap a row to open that profile, tap Follow to follow back.
 */
export default function FollowListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "FollowList">>();
  const { profileId, initialTab, title, followerCount, followingCount } = route.params;
  const { getToken, isAuthenticated } = useAuth();
  // getToken is a new function on every auth render; read it through a ref so the list doesn't
  // blank and reload whenever auth state refreshes.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [tab, setTab] = useState<Kind>(initialTab ?? "followers");
  const [rows, setRows] = useState<FollowListRow[]>([]);
  const [total, setTotal] = useState<Record<Kind, number | undefined>>({
    followers: followerCount,
    following: followingCount,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Ignore answers from an older tab / request.
  const requestSeq = useRef(0);
  const nextOffset = useRef(0);

  const load = useCallback(
    async (kind: Kind, mode: "first" | "refresh" | "more", offset = 0) => {
      const seq = ++requestSeq.current;
      if (mode === "first") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      setError(null);
      try {
        const token = await getTokenRef.current().catch(() => null);
        const res = await apiClient.getFollowList(profileId, kind, { limit: PAGE_SIZE, offset }, token);
        if (seq !== requestSeq.current) return;
        setRows((prev) => {
          if (mode !== "more") return res.rows;
          const seen = new Set(prev.map((r) => r.userId));
          return [...prev, ...res.rows.filter((r) => !seen.has(r.userId))];
        });
        setHasMore(res.hasMore);
        setTotal((prev) => ({ ...prev, [kind]: res.total }));
        nextOffset.current = offset + PAGE_SIZE;
      } catch (err) {
        if (seq !== requestSeq.current) return;
        console.error("[FollowList] load failed:", err);
        setError("This list could not be loaded.");
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [profileId],
  );

  useEffect(() => {
    setRows([]);
    nextOffset.current = 0;
    load(tab, "first", 0);
  }, [tab, load]);

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    load(tab, "more", nextOffset.current);
  }, [hasMore, loadingMore, loading, load, tab]);

  const openProfile = useCallback(
    (row: FollowListRow) => {
      const vendorId = row.businessId || row.photographerId || row.userId;
      navigation.navigate("VendorDetail", { vendorId });
    },
    [navigation],
  );

  const toggleFollow = useCallback(
    async (row: FollowListRow) => {
      if (busyIds.has(row.userId)) return;
      const token = await getTokenRef.current().catch(() => null);
      if (!token) {
        Alert.alert("Sign In Required", "Please sign in to follow accounts.");
        return;
      }
      const wasFollowing = !!row.isFollowing;
      const setRowFollowing = (value: boolean) =>
        setRows((prev) => prev.map((r) => (r.userId === row.userId ? { ...r, isFollowing: value } : r)));

      setBusyIds((prev) => new Set(prev).add(row.userId));
      setRowFollowing(!wasFollowing);
      try {
        if (wasFollowing) {
          await apiClient.unfollowUser(row.userId, token);
        } else {
          const targetType =
            row.role === "business" ? "business" : row.role === "photographer" ? "photographer" : "user";
          await apiClient.followUser(row.userId, targetType, token);
        }
      } catch (err) {
        console.error("[FollowList] follow toggle failed:", err);
        setRowFollowing(wasFollowing);
        Alert.alert("Unable to update follow", "Please try again.");
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(row.userId);
          return next;
        });
      }
    },
    [busyIds],
  );

  const renderRow = ({ item }: { item: FollowListRow }) => {
    const busy = busyIds.has(item.userId);
    const subtitle =
      item.role === "business" ? "Business" : item.role === "photographer" ? "Photographer" : item.username ? `@${item.username}` : null;
    return (
      <Pressable
        onPress={() => openProfile(item)}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.displayName}`}
      >
        {item.profilePhotoUrl ? (
          <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.avatarInitial}>
              {(item.displayName || "?").replace(/^@/, "").charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={styles.rowText}>
          <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.displayName}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {!item.isSelf && isAuthenticated ? (
          <Pressable
            onPress={() => toggleFollow(item)}
            disabled={busy}
            hitSlop={6}
            style={[
              styles.followButton,
              item.isFollowing
                ? { borderColor: theme.border, backgroundColor: "transparent" }
                : { borderColor: theme.primary, backgroundColor: theme.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.isFollowing ? `Unfollow ${item.displayName}` : `Follow ${item.displayName}`}
          >
            <ThemedText style={[styles.followText, { color: item.isFollowing ? theme.text : "#000000" }]}>
              {item.isFollowing ? "Following" : "Follow"}
            </ThemedText>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  const tabLabel = (kind: Kind) => {
    const n = total[kind];
    const word = kind === "followers" ? "Followers" : "Following";
    return typeof n === "number" ? `${n.toLocaleString()} ${word}` : word;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Feather name="chevron-down" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {title || "Profile"}
        </ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(["followers", "following"] as Kind[]).map((kind) => {
          const active = tab === kind;
          return (
            <Pressable
              key={kind}
              onPress={() => setTab(kind)}
              style={[styles.tab, active && { borderBottomColor: theme.primary }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  { color: active ? theme.text : theme.textSecondary, fontWeight: active ? "700" : "500" },
                ]}
              >
                {tabLabel(kind)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.userId}
          renderItem={renderRow}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(tab, "refresh", 0)} tintColor={theme.primary} />
          }
          contentContainerStyle={[{ paddingBottom: insets.bottom + Spacing.xl }, rows.length === 0 && { flexGrow: 1 }]}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: Spacing.lg }} color={theme.primary} /> : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name={error ? "alert-circle" : "users"} size={44} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {error ?? (tab === "followers" ? "No followers yet" : "Not following anyone yet")}
              </ThemedText>
              {error ? (
                <Pressable onPress={() => load(tab, "first", 0)} style={[styles.retry, { borderColor: theme.primary }]}>
                  <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>Try again</ThemedText>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center", marginHorizontal: Spacing.sm },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#000000", fontWeight: "700", fontSize: 18 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600" },
  subtitle: { fontSize: 13, marginTop: 2 },
  followButton: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 96,
    alignItems: "center",
  },
  followText: { fontSize: 13, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: 15, textAlign: "center" },
  retry: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
});

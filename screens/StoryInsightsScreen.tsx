import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api";
import { Story } from "@/components/StoryRing";
import { RootStackParamList } from "@/navigation/types";

type RouteType = RouteProp<RootStackParamList, "StoryInsights">;

interface ViewerEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  viewedAt: string;
}

interface StoryRow {
  story: Story;
  viewCount: number | null;
  viewers: ViewerEntry[] | null;
  expanded: boolean;
  isHighlighted: boolean;
  highlightId: string | null;
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(diff / 3_600_000));
  const mins = Math.max(0, Math.floor((diff % 3_600_000) / 60_000));
  if (hours >= 1) return `Expires in ${hours}h`;
  if (mins > 0) return `Expires in ${mins}m`;
  return "Expiring soon";
}

function formatTimeAgo(viewedAt: string): string {
  const diff = Date.now() - new Date(viewedAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function StoryInsightsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { userId } = route.params;
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStoryId, setSavingStoryId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/api/stories/${userId}`, { headers });
        if (!res.ok || !active) return;
        const stories: Story[] = await res.json();

        if (active) {
          setRows(stories.map((s) => ({
            story: s,
            viewCount: null,
            viewers: null,
            expanded: false,
            isHighlighted: false,
            highlightId: null,
          })));
          setLoading(false);
        }

        // Pre-populate highlight state for all rows
        if (active && token) {
          try {
            const hlRes = await fetch(`${API_BASE_URL}/api/stories/highlights`, { headers });
            if (hlRes.ok && active) {
              const hlData = await hlRes.json();
              const hlMap = new Map<string, string>(
                (hlData.highlights as { id: string; storyId: string }[]).map((h) => [h.storyId, h.id])
              );
              setRows((prev) =>
                prev.map((r) => ({
                  ...r,
                  isHighlighted: hlMap.has(r.story.id),
                  highlightId: hlMap.get(r.story.id) ?? null,
                }))
              );
            }
          } catch {}
        }

        for (const s of stories) {
          if (!active) break;
          try {
            const vRes = await fetch(`${API_BASE_URL}/api/stories/${s.id}/views`, { headers });
            if (vRes.ok && active) {
              const data = await vRes.json();
              setRows((prev) =>
                prev.map((r) =>
                  r.story.id === s.id ? { ...r, viewCount: data.viewCount, viewers: data.viewers } : r
                )
              );
            }
          } catch {}
        }
      } catch {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, getToken]);

  const handleToggleExpand = useCallback((storyId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.story.id === storyId ? { ...r, expanded: !r.expanded } : r))
    );
  }, []);

  const handleSaveHighlight = useCallback(async (row: StoryRow) => {
    if (savingStoryId === row.story.id) return;
    setSavingStoryId(row.story.id);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/stories/highlights`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          storyId: row.story.id,
          mediaUrl: row.story.mediaUrl,
          mediaType: row.story.mediaType,
          thumbnailUrl: row.story.thumbnailUrl ?? null,
          muxAssetId: row.story.muxAssetId ?? null,
          caption: row.story.caption ?? null,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setRows((prev) =>
          prev.map((r) =>
            r.story.id === row.story.id
              ? { ...r, isHighlighted: true, highlightId: result?.id ?? null }
              : r
          )
        );
      } else if (res.status === 409) {
        // Already exists — reflect saved state without a highlightId
        setRows((prev) =>
          prev.map((r) =>
            r.story.id === row.story.id ? { ...r, isHighlighted: true } : r
          )
        );
      }
    } catch {} finally {
      setSavingStoryId(null);
    }
  }, [getToken, savingStoryId]);

  const handleDeleteHighlight = useCallback(async (row: StoryRow) => {
    if (!row.highlightId) return;
    if (savingStoryId === row.story.id) return;
    setSavingStoryId(row.story.id);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE_URL}/api/stories/highlights/${row.highlightId}`, {
        method: "DELETE",
        headers,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.story.id === row.story.id
            ? { ...r, isHighlighted: false, highlightId: null }
            : r
        )
      );
    } catch {} finally {
      setSavingStoryId(null);
    }
  }, [getToken, savingStoryId]);

  const renderStoryRow = ({ item }: { item: StoryRow }) => (
    <View>
      <View style={styles.storyRowContainer}>
        <Pressable style={styles.storyRowExpand} onPress={() => handleToggleExpand(item.story.id)}>
          <Image
            source={{ uri: item.story.thumbnailUrl ?? item.story.mediaUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          />
          <View style={styles.storyMeta}>
            <Text style={styles.captionText} numberOfLines={1}>
              {item.story.caption || "No caption"}
            </Text>
            <Text style={styles.expiryText}>{formatExpiry(item.story.expiresAt)}</Text>
          </View>
          <View style={styles.viewCountBadge}>
            <Feather name="eye" size={14} color="#D4A94A" />
            <Text style={styles.viewCountText}>{item.viewCount ?? "—"}</Text>
          </View>
          <Feather name={item.expanded ? "chevron-up" : "chevron-down"} size={16} color="#888" />
        </Pressable>
        <Pressable
          style={styles.highlightBtn}
          disabled={savingStoryId === item.story.id}
          onPress={() =>
            item.isHighlighted
              ? handleDeleteHighlight(item)
              : handleSaveHighlight(item)
          }
        >
          <Ionicons
            name={item.isHighlighted ? "star" : "star-outline"}
            size={14}
            color={item.isHighlighted ? "#D4A94A" : "#888"}
          />
          <Text style={[styles.highlightText, item.isHighlighted && styles.highlightTextSaved]}>
            {item.isHighlighted ? "Saved" : "Save"}
          </Text>
        </Pressable>
      </View>

      {item.expanded && (
        <View style={styles.viewerList}>
          {item.viewers == null ? (
            <ActivityIndicator size="small" color="#D4A94A" style={{ marginVertical: 12 }} />
          ) : item.viewers.length === 0 ? (
            <Text style={styles.emptyText}>No views yet</Text>
          ) : (
            item.viewers.map((v) => (
              <View key={v.userId} style={styles.viewerRow}>
                {v.avatarUrl ? (
                  <Image source={{ uri: v.avatarUrl }} style={styles.viewerAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.viewerAvatar, styles.viewerAvatarFallback]}>
                    <Text style={styles.viewerInitial}>{v.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.viewerName} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.viewedAtText}>{formatTimeAgo(v.viewedAt)}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Story Insights</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
          <Feather name="x" size={24} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color="#D4A94A" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.story.id}
          renderItem={renderStoryRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No active stories</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  listContent: { paddingBottom: 32 },
  storyRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  storyRowExpand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  thumbnail: { width: 48, height: 48, borderRadius: 8 },
  storyMeta: { flex: 1 },
  captionText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  expiryText: { color: "#888", fontSize: 12, marginTop: 2 },
  viewCountBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "#1a1a1a" },
  viewCountText: { color: "#D4A94A", fontSize: 13, fontWeight: "600" },
  viewerList: { paddingHorizontal: 16, paddingVertical: 4, backgroundColor: "#0d0d0d" },
  emptyText: { color: "#666", fontSize: 13, textAlign: "center", paddingVertical: 16 },
  viewerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  highlightBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, gap: 4 },
  highlightText: { color: "#888", fontSize: 13, fontWeight: "600" },
  highlightTextSaved: { color: "#D4A94A" },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18 },
  viewerAvatarFallback: { backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  viewerInitial: { color: "#D4A94A", fontSize: 14, fontWeight: "600" },
  viewerName: { flex: 1, color: "#e0e0e0", fontSize: 14 },
  viewedAtText: { color: "#888", fontSize: 12 },
});

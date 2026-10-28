/**
 * One Saved place (Manage Business step 6): saved posts (SavedPostsContext) and saved businesses,
 * photographers and products (FavoritesContext), both on the account. Used by the profile Saved tab and
 * the Saved screen (route "Favorites", opened from Settings and the `favorites` push link).
 *
 * Renders plain Views (no list of its own), so it can sit inside a parent ScrollView.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";
import { useFavorites } from "@/context/FavoritesContext";
import { useSavedPosts } from "@/context/SavedPostsContext";
import type { RootStackParamList } from "@/navigation/types";
import {
  EMPTY_TEXT,
  SAVED_SEGMENTS,
  savedCounts,
  savedOpenTarget,
  type FavoriteItem,
  type SavedSegment,
} from "@/utils/savedFavorites";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICONS: Record<Exclude<SavedSegment, "posts">, keyof typeof Feather.glyphMap> = {
  business: "briefcase",
  photographer: "camera",
  product: "shopping-bag",
};

function postThumb(p: any): string | undefined {
  const isVideo = p?.mediaType === "video" || (!!p?.videoUrl && !p?.imageUrl);
  return isVideo
    ? p?.thumbnailUrl || p?.imageUrl || p?.mediaUrl || p?.images?.[0]
    : p?.imageUrl || p?.thumbnailUrl || p?.mediaUrl || p?.images?.[0];
}

export default function SavedCollection({
  horizontalPadding = 16,
  alwaysDark = false,
}: {
  horizontalPadding?: number;
  /** The profile screen is always dark, whatever the app theme. */
  alwaysDark?: boolean;
}) {
  const { theme: appTheme } = useTheme();
  const theme = alwaysDark ? Colors.dark : appTheme;
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const { savedPosts, refreshSaved } = useSavedPosts();
  const { favorites, removeFavorite, refreshFavorites, isLoading } = useFavorites();
  const [segment, setSegment] = useState<SavedSegment>("posts");

  useEffect(() => {
    refreshSaved();
    refreshFavorites();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => savedCounts(savedPosts.length, favorites), [savedPosts, favorites]);
  const rows = useMemo(() => (segment === "posts" ? [] : favorites.filter((f) => f.type === segment)), [favorites, segment]);
  const cell = (width - horizontalPadding * 2 - 8) / 3;

  const open = (item: FavoriteItem) => {
    const t = savedOpenTarget(item);
    if (t.screen === "ProductDetail") navigation.navigate("ProductDetail", t.params);
    else navigation.navigate("VendorDetail", t.params);
  };

  const empty = (text: string) => (
    <View style={styles.empty} testID="saved-empty">
      <Feather name="bookmark" size={24} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsWrap}
        accessibilityRole="tablist"
      >
        {SAVED_SEGMENTS.map((s) => {
          const active = s.key === segment;
          return (
            <Pressable
              key={s.key}
              testID={`saved-seg-${s.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSegment(s.key)}
              style={[
                styles.chip,
                { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : "transparent" },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? "#0A0A0A" : theme.text }]}>
                {s.label}
                {counts[s.key] > 0 ? ` ${counts[s.key]}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {segment === "posts" ? (
        savedPosts.length === 0 ? (
          empty(EMPTY_TEXT.posts)
        ) : (
          <View style={styles.grid}>
            {savedPosts.map((p: any) => {
              const uri = postThumb(p);
              const authorId = String(p.userId || p.authorId || "");
              return (
                <Pressable
                  key={String(p.id)}
                  testID={`saved-post-${p.id}`}
                  style={[styles.cell, { width: cell, height: cell, backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    if (authorId) navigation.navigate("PostDetail", { userId: authorId, initialPostId: String(p.id) });
                  }}
                >
                  {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </Pressable>
              );
            })}
          </View>
        )
      ) : rows.length === 0 ? (
        empty(isLoading ? "Loading…" : EMPTY_TEXT[segment])
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item) => (
            <Pressable
              key={`${item.type}:${item.id}`}
              testID={`saved-row-${item.type}-${item.id}`}
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.85 : 1 }]}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.rowImage} contentFit="cover" />
              ) : (
                <View style={[styles.rowImage, styles.rowIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name={ICONS[item.type]} size={20} color={theme.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.subtitle ? (
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                testID={`saved-remove-${item.type}-${item.id}`}
                onPress={() => removeFavorite(item.id, item.type)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name} from Saved`}
                style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Feather name="bookmark" size={20} color={theme.primary} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipsWrap: { marginBottom: 14, flexGrow: 0 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, minHeight: 36, justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: { borderRadius: 6, overflow: "hidden" },
  empty: { alignItems: "center", paddingVertical: 36, gap: 8 },
  emptyText: { fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12 },
  rowImage: { width: 52, height: 52, borderRadius: 26 },
  rowIcon: { alignItems: "center", justifyContent: "center" },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowSub: { fontSize: 13, marginTop: 2 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

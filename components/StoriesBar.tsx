import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api";
import { RootStackParamList } from "@/navigation/types";
import { Story } from "@/components/StoryRing";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const AVATAR_SIZE = 56;
const RING_THICKNESS = 3;
const RING_GAP = 2;
const OUTER = AVATAR_SIZE + (RING_THICKNESS + RING_GAP) * 2;
const GAP_SIZE = AVATAR_SIZE + RING_GAP * 2;
const GOLD: [string, string, string] = ["#D4A94A", "#B8860B", "#D4A94A"];
const GRAY: [string, string, string] = ["#555555", "#555555", "#555555"];

interface FeedEntry {
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isFollowing: boolean;
  hasUnseenStory: boolean;
  stories: Story[];
}

export default function StoriesBar() {
  const { theme } = useTheme();
  const { getToken, user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/api/stories/feed`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setFeed(data.feed ?? []);
    } catch {
      // non-critical — bar stays hidden on error
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const ownEntry = user ? feed.find((e) => e.userId === user.id) : null;
  const otherEntries = user ? feed.filter((e) => e.userId !== user.id) : feed;
  const showOwnSlot = !!user;

  if (!loading && !showOwnSlot && feed.length === 0) return null;
  if (!loading && showOwnSlot && !ownEntry && otherEntries.length === 0) return null;

  const truncate = (name: string) =>
    name.length > 8 ? name.slice(0, 8) + "…" : name;

  const renderAvatar = (avatarUrl: string | null, name: string, hasRing: boolean) => (
    <LinearGradient
      colors={hasRing ? GOLD : GRAY}
      style={[styles.ring, { width: OUTER, height: OUTER, borderRadius: OUTER / 2 }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View
        style={[
          styles.gap,
          {
            width: GAP_SIZE,
            height: GAP_SIZE,
            borderRadius: GAP_SIZE / 2,
            backgroundColor: hasRing ? "#000000" : "transparent",
          },
        ]}
      >
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            overflow: "hidden",
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.initial,
                {
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            >
              <ThemedText style={styles.initialText}>
                {(name || "U").charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={styles.item}>
            <View style={[styles.placeholder, { backgroundColor: theme.backgroundDefault }]} />
            <View style={[styles.placeholderLabel, { backgroundColor: theme.backgroundDefault }]} />
          </View>
        ))
      ) : (
        <>
          {showOwnSlot && (
            <Pressable
              style={styles.item}
              onPress={() => {
                if (ownEntry) {
                  navigation.navigate("StoryViewer", {
                    userId: ownEntry.userId,
                    stories: ownEntry.stories,
                    authorName: ownEntry.authorName,
                    authorAvatarUrl: ownEntry.authorAvatarUrl ?? undefined,
                  });
                } else {
                  navigation.navigate("CreatePost");
                }
              }}
            >
              {ownEntry ? (
                renderAvatar(ownEntry.authorAvatarUrl, ownEntry.authorName, true)
              ) : (
                <View
                  style={[
                    styles.ring,
                    styles.addSlot,
                    { width: OUTER, height: OUTER, borderRadius: OUTER / 2, borderColor: theme.border },
                  ]}
                >
                  <Feather name="plus" size={24} color={theme.textSecondary} />
                </View>
              )}
              <ThemedText style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
                You
              </ThemedText>
            </Pressable>
          )}
          {otherEntries.map((entry) => (
            <Pressable
              key={entry.userId}
              style={styles.item}
              onPress={() =>
                navigation.navigate("StoryViewer", {
                  userId: entry.userId,
                  stories: entry.stories,
                  authorName: entry.authorName,
                  authorAvatarUrl: entry.authorAvatarUrl ?? undefined,
                })
              }
            >
              {renderAvatar(entry.authorAvatarUrl, entry.authorName, entry.hasUnseenStory)}
              <ThemedText style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
                {truncate(entry.authorName)}
              </ThemedText>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  item: {
    alignItems: "center",
    gap: 4,
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
  },
  gap: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  addSlot: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    textAlign: "center",
    width: OUTER,
  },
  placeholder: {
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
  },
  placeholderLabel: {
    width: 40,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
  },
});

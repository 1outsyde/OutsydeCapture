import React, { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api";

// ── Story shape ───────────────────────────────────────────────────────────────
// Mirrors the backend row returned by GET /api/stories/:userId.
// viewedByCurrentUser is added by the server when an auth token is present.
export interface Story {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl: string | null;
  muxAssetId: string | null;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  viewedByCurrentUser: boolean;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const RING_THICKNESS = 3; // gradient ring width
const RING_GAP = 2;       // dark gap between ring edge and avatar
const EXTRA = (RING_THICKNESS + RING_GAP) * 2; // total extra pixels vs size prop

const GOLD: [string, string, string] = ["#D4A94A", "#B8860B", "#D4A94A"];
const GRAY: [string, string, string] = ["#555555", "#555555", "#555555"];

// ── Props ─────────────────────────────────────────────────────────────────────
interface StoryRingProps {
  userId: string;
  size: number;             // avatar diameter; total component = size + EXTRA
  children: React.ReactNode;
  isOwnProfile: boolean;
  onAddStory: () => void;
  onViewStory: (stories: Story[]) => void;
}

export default function StoryRing({
  userId,
  size,
  children,
  isOwnProfile,
  onAddStory,
  onViewStory,
}: StoryRingProps) {
  const { getToken } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  // In-session seen tracking — not persisted across restarts (MVP)
  const [localSeenIds, setLocalSeenIds] = useState<Set<string>>(new Set());

  // ── Fetch active stories for this user ────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE_URL}/api/stories/${userId}`, { headers });
        if (res.ok && active) {
          const data: Story[] = await res.json();
          setStories(data);
        }
      } catch {
        // Non-critical — silently degrade to no ring
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasActive = stories.length > 0;
  const allSeen =
    hasActive &&
    stories.every((s) => localSeenIds.has(s.id) || s.viewedByCurrentUser);
  // Ring is only visible after load AND when there are active stories
  const showRing = !loading && hasActive;

  const markAllSeen = useCallback(() => {
    setLocalSeenIds(new Set(stories.map((s) => s.id)));
  }, [stories]);

  // ── Press handler ─────────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (hasActive && isOwnProfile) {
      // Show choice: view existing story OR add another
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ["View My Story", "Add to Story", "Cancel"],
            cancelButtonIndex: 2,
          },
          (idx) => {
            if (idx === 0) {
              markAllSeen();
              onViewStory(stories);
            } else if (idx === 1) {
              onAddStory();
            }
          }
        );
      } else {
        Alert.alert("My Story", undefined, [
          {
            text: "View My Story",
            onPress: () => {
              markAllSeen();
              onViewStory(stories);
            },
          },
          { text: "Add to Story", onPress: onAddStory },
          { text: "Cancel", style: "cancel" },
        ]);
      }
      return;
    }

    if (hasActive && !isOwnProfile) {
      markAllSeen();
      onViewStory(stories);
      return;
    }

    // No active stories + own profile → straight to creator
    if (!hasActive && isOwnProfile) {
      onAddStory();
    }
    // No active stories + not own profile → ring is invisible; no-op
  }, [hasActive, isOwnProfile, stories, onAddStory, onViewStory, markAllSeen]);

  // ── Sizing ────────────────────────────────────────────────────────────────
  const outerSize = size + EXTRA;
  const outerRadius = outerSize / 2;
  const gapSize = size + RING_GAP * 2;
  const gapRadius = gapSize / 2;
  const isTappable = hasActive || isOwnProfile;

  return (
    <Pressable
      onPress={isTappable ? handlePress : undefined}
      hitSlop={isTappable ? 4 : 0}
      style={[styles.wrapper, { width: outerSize, height: outerSize, borderRadius: outerRadius }]}
    >
      {/* Gradient (or solid gray) ring — only rendered when there are active stories */}
      {showRing ? (
        <LinearGradient
          colors={allSeen ? GRAY : GOLD}
          style={[StyleSheet.absoluteFill, { borderRadius: outerRadius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : null}

      {/* Dark gap between ring and avatar content */}
      <View
        style={[
          styles.gap,
          {
            width: gapSize,
            height: gapSize,
            borderRadius: gapRadius,
            // Gap is only dark when ring is showing; transparent otherwise so
            // children render without any surrounding background change.
            backgroundColor: showRing ? "#000000" : "transparent",
          },
        ]}
      >
        {/* Avatar content — clipped to a circle */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
          }}
        >
          {children}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  gap: {
    alignItems: "center",
    justifyContent: "center",
  },
});

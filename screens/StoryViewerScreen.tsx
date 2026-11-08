import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { VideoView } from "expo-video";
import { useVideoPlayerRecreate } from "@/hooks/useVideoPlayerRecreate";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/services/api";
import { Story } from "@/components/StoryRing";
import { FitBackdrop } from "@/components/video/FitBackdrop";
import { normalizeVideoFit, videoBlurUri } from "@/utils/videoFit";
import { FullScreenSheet } from "@/components/FullScreenSheet";
import { remainingStoryMs } from "@/utils/storyPause";

// ── Constants ─────────────────────────────────────────────────────────────────
const IMAGE_MS = 5000;
const { width: SCREEN_W } = Dimensions.get("window");

// ── Viewer entry shape ────────────────────────────────────────────────────────
interface ViewerEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  viewedAt: string;
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

function ViewerRow({ viewer }: { viewer: ViewerEntry }) {
  return (
    <View style={vSheet.row}>
      {viewer.avatarUrl ? (
        <Image source={{ uri: viewer.avatarUrl }} style={vSheet.avatar} contentFit="cover" />
      ) : (
        <View style={[vSheet.avatar, vSheet.avatarFallback]}>
          <Text style={vSheet.initial}>{viewer.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={vSheet.name} numberOfLines={1}>{viewer.name}</Text>
      <Text style={vSheet.time}>{formatTimeAgo(viewer.viewedAt)}</Text>
    </View>
  );
}

const vSheet = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  initial: { color: "#D4A94A", fontSize: 14, fontWeight: "600" },
  name: { flex: 1, color: "#e0e0e0", fontSize: 14 },
  time: { color: "#888", fontSize: 12 },
});

// ── Local param type (wired into RootStackParamList in Step 7) ───────────────
type StoryViewerParams = {
  userId: string;
  stories: Story[];
  initialIndex?: number;
  authorName?: string;
  authorAvatarUrl?: string;
  onStoryDeleted?: (deletedId: string) => void;
};

// ── Segment ───────────────────────────────────────────────────────────────────
// One per story. Lives as its own component so useAnimatedStyle is never
// called inside a .map() loop (hooks must be called at the top level).
interface SegmentProps {
  isCurrent: boolean;
  isDone: boolean;
  progress: Animated.SharedValue<number>;
}

function Segment({ isCurrent, isDone, progress }: SegmentProps) {
  const fill = useAnimatedStyle(() => ({
    width: isDone
      ? "100%"
      : isCurrent
      ? `${progress.value * 100}%`
      : "0%",
  }));
  return (
    <View style={seg.track}>
      <Animated.View style={[seg.fill, fill]} />
    </View>
  );
}

const seg = StyleSheet.create({
  track: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 1,
    overflow: "hidden",
    marginHorizontal: 2,
  },
  fill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 1,
  },
});

// ── ImageStory ────────────────────────────────────────────────────────────────
function ImageStory({ story }: { story: Story }) {
  return (
    <Image
      source={{ uri: story.thumbnailUrl ?? story.mediaUrl }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
    />
  );
}

// ── VideoStory ────────────────────────────────────────────────────────────────
// Keyed by story.id so React remounts (and creates a fresh player) each time
// the active story changes. Mirrors the useVideoPlayer + setInterval polling
// pattern from NativePulseVideo in PulseVideoCard.tsx.
interface VideoStoryProps {
  story: Story;
  onDurationKnown: (durationSeconds: number) => void;
  onVideoEnd: () => void;
  /** True while the viewers page is open: the video holds its place. */
  paused: boolean;
}

function VideoStory({ story, onDurationKnown, onVideoEnd, paused }: VideoStoryProps) {
  const player = useVideoPlayerRecreate(story.mediaUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  const reportedDuration = useRef(false);
  const reportedEnd = useRef(false);

  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch {}
  }, [paused, player]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const dur = player.duration;
        const cur = player.currentTime;
        if (dur && dur > 0) {
          if (!reportedDuration.current) {
            reportedDuration.current = true;
            onDurationKnown(dur);
          }
          if (!reportedEnd.current && cur >= dur - 0.3) {
            reportedEnd.current = true;
            onVideoEnd();
          }
        }
      } catch {}
    }, 250);
    return () => clearInterval(interval);
  }, [player, onDurationKnown, onVideoEnd]);

  // How the story was posted (photo ratios 2d). Old stories have no choice: fill, as before.
  const fit = normalizeVideoFit(story.videoFit);
  return (
    <>
      {fit === "fit" ? <FitBackdrop source={videoBlurUri(story.thumbnailUrl, story.mediaUrl)} /> : null}
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
        contentFit={fit === "fit" ? "contain" : "cover"}
        nativeControls={false}
      />
    </>
  );
}

// ── StoryViewerScreen ─────────────────────────────────────────────────────────
export default function StoryViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ StoryViewer: StoryViewerParams }, "StoryViewer">>();
  const { userId, stories: paramStories, initialIndex = 0, authorName, authorAvatarUrl, onStoryDeleted } = route.params;
  const { user, getToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [stories, setStories] = useState(paramStories);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const progress = useSharedValue(0);

  const currentStory = stories[currentIndex];
  const isAuthor = !!user?.id && user.id === currentStory?.authorId;

  // ── Viewer sheet state (author only) ─────────────────────────────────────
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewerData, setViewerData] = useState<{ viewCount: number; viewers: ViewerEntry[] } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const fetchViewers = useCallback(async (storyId: string) => {
    setViewerLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/stories/${storyId}/views`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setViewerData(await res.json());
    } catch {}
    setViewerLoading(false);
  }, [getToken]);

  const handleOpenViewerSheet = useCallback(() => {
    if (!isAuthor || !currentStory?.id) return;
    setViewersOpen(true);
    fetchViewers(currentStory.id);
  }, [isAuthor, currentStory?.id, fetchViewers]);

  // ── Record view when a story becomes active ──────────────────────────────
  useEffect(() => {
    if (!currentStory) return;
    const storyId = currentStory.id;
    (async () => {
      try {
        const token = await getToken();
        await fetch(`${API_BASE_URL}/api/stories/${storyId}/view`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {}
    })();
  }, [currentStory?.id, getToken]);

  // ── Navigation helpers ───────────────────────────────────────────────────
  const handleDismiss = useCallback(() => navigation.goBack(), [navigation]);

  const advance = useCallback(() => {
    cancelAnimation(progress);
    if (currentIndex < stories.length - 1) {
      progress.value = 0;
      setCurrentIndex((i) => i + 1);
    } else {
      navigation.goBack();
    }
  }, [currentIndex, stories.length, navigation, progress]);

  const goBack = useCallback(() => {
    cancelAnimation(progress);
    if (currentIndex > 0) {
      progress.value = 0;
      setCurrentIndex((i) => i - 1);
    } else {
      navigation.goBack();
    }
  }, [currentIndex, navigation, progress]);

  // ── Story timing ─────────────────────────────────────────────────────────
  // Runs whenever the active story changes. Starts progress animation for
  // images immediately; video timing is started by onDurationKnown once the
  // player reports a duration.
  // While the viewers page is open the story holds its place (progress bar,
  // timer and video); closing it carries on from the same spot.
  const timedStoryId = useRef<string | null>(null);
  const videoDurationMs = useRef<number | null>(null);
  useEffect(() => {
    if (!currentStory) return;
    if (timedStoryId.current !== currentStory.id) {
      timedStoryId.current = currentStory.id;
      videoDurationMs.current = null;
      progress.value = 0;
    }
    if (viewersOpen) {
      cancelAnimation(progress);
      return;
    }

    if (currentStory.mediaType === "image") {
      const remaining = remainingStoryMs(IMAGE_MS, progress.value);
      progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
      const t = setTimeout(advance, remaining);
      return () => {
        clearTimeout(t);
        cancelAnimation(progress);
      };
    }

    // Video: animation starts from onDurationKnown, or resumes here after a pause.
    if (videoDurationMs.current != null) {
      progress.value = withTiming(1, {
        duration: remainingStoryMs(videoDurationMs.current, progress.value),
        easing: Easing.linear,
      });
    }
    return () => {
      cancelAnimation(progress);
    };
  }, [currentStory?.id, advance, viewersOpen]);

  const handleDurationKnown = useCallback(
    (dur: number) => {
      videoDurationMs.current = dur * 1000;
      if (viewersOpen) return;
      progress.value = withTiming(1, { duration: dur * 1000, easing: Easing.linear });
    },
    [progress, viewersOpen]
  );

  const handleVideoEnd = useCallback(() => advance(), [advance]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    const storyId = currentStory?.id;
    if (!storyId) return;

    const doDelete = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          onStoryDeleted?.(storyId);
          const filtered = stories.filter((s) => s.id !== storyId);
          if (filtered.length === 0) {
            navigation.goBack();
          } else {
            setStories(filtered);
            setCurrentIndex((i) => Math.min(i, filtered.length - 1));
          }
        } else {
          Alert.alert("Error", "Could not delete story. Please try again.");
        }
      } catch {
        Alert.alert("Error", "Could not delete story. Please try again.");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Delete Story", "Cancel"],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (idx) => {
          if (idx === 0) doDelete();
        }
      );
    } else {
      Alert.alert("Delete Story", "This story will be permanently deleted.", [
        { text: "Delete", style: "destructive", onPress: doDelete },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [currentStory?.id, getToken, navigation, stories, onStoryDeleted]);

  // ── Swipe-down to dismiss ────────────────────────────────────────────────
  // activeOffsetY(20) ensures quick taps don't accidentally fire the gesture.
  const swipeGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationY > 100) runOnJS(handleDismiss)();
      else if (e.translationY < -60) runOnJS(handleOpenViewerSheet)();
    });

  if (!currentStory) return null;

  return (
    <>
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        {/* ── Background media ── */}
        {currentStory.mediaType === "image" ? (
          <ImageStory key={currentStory.id} story={currentStory} />
        ) : (
          <VideoStory
            key={currentStory.id}
            story={currentStory}
            onDurationKnown={handleDurationKnown}
            onVideoEnd={handleVideoEnd}
            paused={viewersOpen}
          />
        )}

        {/* ── Gradient overlays for text readability ── */}
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          style={styles.topGradient}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.65)"]}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        {/* ── Tap zones — left 40% = back, right 60% = forward ── */}
        {/* box-none lets touches pass through to header & bottom bar above */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: SCREEN_W * 0.4,
            }}
            onPress={goBack}
          />
          <Pressable
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: SCREEN_W * 0.6,
            }}
            onPress={advance}
          />
        </View>

        {/* ── Progress bar ── */}
        <View style={[styles.progressRow, { top: insets.top + 8 }]}>
          {stories.map((s, i) => (
            <Segment
              key={s.id}
              isCurrent={i === currentIndex}
              isDone={i < currentIndex}
              progress={progress}
            />
          ))}
        </View>

        {/* ── Header ── */}
        <View style={[styles.header, { top: insets.top + 20 }]}>
          <View style={styles.authorRow}>
            {authorAvatarUrl ? (
              <Image
                source={{ uri: authorAvatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Feather name="user" size={14} color="#fff" />
              </View>
            )}
            {authorName ? (
              <Text style={styles.authorName} numberOfLines={1}>
                {authorName}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={handleDismiss} hitSlop={16}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* ── Bottom bar — trash icon replaces caption when viewer is author ── */}
        <View style={[styles.bottomBar, { bottom: insets.bottom + 24 }]}>
          {isAuthor ? (
            <View style={styles.authorBarRow}>
              <Pressable style={styles.deleteRow} onPress={handleDelete}>
                <Feather name="trash-2" size={20} color="#fff" />
                <Text style={styles.deleteText}>Delete Story</Text>
              </Pressable>
              <Pressable style={styles.viewsPill} onPress={handleOpenViewerSheet}>
                <Text style={styles.viewsPillText}>
                  👁 {viewerData != null ? viewerData.viewCount : "·"}
                </Text>
              </Pressable>
            </View>
          ) : currentStory.caption ? (
            <Text style={styles.caption}>{currentStory.caption}</Text>
          ) : null}
        </View>
      </View>
    </GestureDetector>
    {isAuthor && (
      <FullScreenSheet
        visible={viewersOpen}
        onClose={() => setViewersOpen(false)}
        title={`${viewerData?.viewCount ?? 0} views`}
        backgroundColor="#1a1a1a"
        tintColor="#FFFFFF"
        borderColor="#333333"
      >
        <View style={styles.pausedRow}>
          <Feather name="pause" size={12} color="#A0A0A0" />
          <Text style={styles.pausedText}>Your story is paused. Close to keep watching.</Text>
        </View>
        {viewerLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color="#D4A94A" />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={viewerData?.viewers ?? []}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => <ViewerRow viewer={item} />}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListEmptyComponent={
              <Text style={styles.sheetEmpty}>No views yet</Text>
            }
          />
        )}
      </FullScreenSheet>
    )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  progressRow: {
    position: "absolute",
    left: 8,
    right: 8,
    flexDirection: "row",
  },
  header: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#fff",
    overflow: "hidden",
  },
  avatarFallback: {
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  authorName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  caption: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  authorBarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  viewsPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  viewsPillText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  pausedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333333",
  },
  pausedText: { color: "#A0A0A0", fontSize: 13 },
  sheetEmpty: { color: "#666", fontSize: 14, textAlign: "center", paddingTop: 32 },
});

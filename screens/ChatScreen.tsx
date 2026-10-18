import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  ScrollView,
  AppState,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import MessagePhotoGrid from "@/components/messaging/MessagePhotoGrid";
import PhotoViewer from "@/components/messaging/PhotoViewer";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import {
  useMessaging,
  mapApiMessage,
  previewFor,
  Message,
} from "@/context/MessagingContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import api, { ApiError } from "@/services/api";
import { uploadImage } from "@/services/mediaUpload";
import { setActiveConversation, onMessagePush } from "@/services/messagePush";
import { showReportBlockMenu } from "@/utils/moderationActions";
import { showChoiceSheet } from "@/utils/choiceSheet";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Chat">;

const MAX_PHOTOS = 10;
const MAX_CHARS = 2000;
const POLL_MS = 5000;
/** Messages from the same person within this window stack together (one time stamp, one tail). */
const RUN_GAP_MS = 3 * 60 * 1000;

type LocalStatus = "sending" | "failed";
type ChatMessage = Message & {
  localStatus?: LocalStatus;
  progress?: number;
  /** Local picks kept for a retry after a failed send. */
  localAssets?: PickedPhoto[];
  /** Already uploaded URLs (a retry doesn't upload twice). */
  uploadedUrls?: string[];
};
type PickedPhoto = { uri: string; mimeType?: string | null };

const TYPE_LABEL: Record<string, string> = {
  business: "Business",
  photographer: "Photographer",
  consumer: "Customer",
};

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function dayLabel(ts: string): string | null {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(ts: string): string | null {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function initialsFor(name?: string): string {
  const words = (name || "")
    .replace(/^@/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  return (
    words.length > 1 ? words[0][0] + words[1][0] : words[0][0]
  ).toUpperCase();
}

function Avatar({
  uri,
  name,
  size,
}: {
  uri?: string;
  name?: string;
  size: number;
}) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const r = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[r, { backgroundColor: theme.brandSurface }]}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={[r, styles.center, { backgroundColor: theme.brandPrimary }]}>
      <ThemedText
        style={{
          color: theme.brandGold,
          fontWeight: "700",
          fontSize: Math.round(size * 0.38),
        }}
      >
        {initialsFor(name)}
      </ThemedText>
    </View>
  );
}

type Row =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "msg";
      key: string;
      message: ChatMessage;
      isOwn: boolean;
      tail: boolean;
      showTime: boolean;
      first: boolean;
    };

export default function ChatScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const params = route.params;
  const conversationId = params.conversationId;
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { user, getToken } = useAuth();
  const {
    conversations,
    refreshConversations,
    markConversationAsRead,
    noteMessageSent,
  } = useMessaging();

  // Participant: from the route, else from the inbox (a push tap only carries the conversation id).
  const convo = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  );
  const participantId = params.participantId || convo?.participantId || "";
  const participantName =
    params.participantName || convo?.participantName || "";
  const participantAvatar =
    params.participantAvatar || convo?.participantAvatar;
  const participantType =
    params.participantType || convo?.participantType || "consumer";
  const businessId = params.businessId ?? convo?.businessId ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [attachments, setAttachments] = useState<PickedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    urls: string[];
    index: number;
    caption?: string;
  } | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const inFlight = useRef(false);
  const atBottom = useRef(true);

  const isSelfConversation = !!user?.id && user.id === participantId;

  // Inbox not loaded yet (opened from a push): load it so the header can show the name.
  useEffect(() => {
    if (!params.participantName && !convo) refreshConversations();
  }, [params.participantName, convo, refreshConversations]);

  const openProfile = useCallback(() => {
    if (!participantId || isSelfConversation) return;
    if (participantType === "business" && businessId) {
      navigation.navigate("VendorDetail", { vendorId: businessId });
    } else {
      navigation.navigate("UserProfile", {
        userId: participantId,
        userType: participantType,
      });
    }
  }, [
    navigation,
    participantId,
    participantType,
    businessId,
    isSelfConversation,
  ]);

  const openMenu = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    showReportBlockMenu({
      authToken: token,
      currentUserId: String(user?.id || ""),
      target: {
        type: "user",
        userId: String(participantId),
        userName: participantName,
      },
    });
  }, [getToken, user?.id, participantId, participantName]);

  useEffect(() => {
    const label = TYPE_LABEL[participantType];
    navigation.setOptions({
      headerTitleAlign: "left",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: theme.backgroundRoot },
      headerTitle: () => (
        <Pressable
          onPress={openProfile}
          disabled={isSelfConversation}
          accessibilityRole="button"
          accessibilityLabel={`View ${participantName || "profile"}`}
          style={({ pressed }) => [
            styles.headerTitle,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Avatar uri={participantAvatar} name={participantName} size={34} />
          <View style={{ flexShrink: 1 }}>
            <ThemedText
              style={[styles.headerName, { color: theme.brandCream }]}
              numberOfLines={1}
            >
              {participantName || " "}
            </ThemedText>
            {!isSelfConversation && participantName ? (
              <ThemedText
                style={[styles.headerSub, { color: theme.brandTextDim }]}
                numberOfLines={1}
              >
                {label ? `${label} · ` : ""}
                <ThemedText style={{ color: theme.brandGold, fontSize: 12 }}>
                  View profile
                </ThemedText>
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      ),
      headerRight: isSelfConversation
        ? undefined
        : () => (
            <Pressable
              onPress={openMenu}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Report or block"
              style={({ pressed }) => [
                styles.headerIcon,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather
                name="more-horizontal"
                size={22}
                color={theme.brandCream}
              />
            </Pressable>
          ),
    });
  }, [
    navigation,
    theme,
    participantName,
    participantAvatar,
    participantType,
    isSelfConversation,
    openProfile,
    openMenu,
  ]);

  // ── loading + live updates ────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (silent: boolean) => {
      if (!conversationId) {
        setError("This chat couldn't be opened.");
        setIsLoading(false);
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        if (!silent) {
          setIsLoading(true);
          setError(null);
        }
        const token = await getToken();
        const response: any = await api.getMessages(conversationId, token);
        const list = (
          Array.isArray(response) ? response : response?.messages || []
        ).map(mapApiMessage);
        setMessages((prev) => {
          const pending = prev.filter((m) => m.localStatus);
          const same =
            prev.length - pending.length === list.length &&
            list.every((m: Message, i: number) => prev[i]?.id === m.id);
          return same ? prev : [...list, ...pending];
        });
        markConversationAsRead(conversationId);
      } catch (err) {
        if (!silent) {
          const e = err as ApiError;
          if (e?.status === 404) setMessages([]);
          else
            setError(
              "We couldn't load this chat. Check your connection and try again.",
            );
        }
      } finally {
        inFlight.current = false;
        if (!silent) setIsLoading(false);
      }
    },
    [conversationId, getToken, markConversationAsRead],
  );

  useEffect(() => {
    fetchMessages(false);
  }, [fetchMessages]);

  // While this chat is on screen: no push banner for it, poll for new messages, refresh on push.
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);
      const timer = setInterval(() => {
        if (AppState.currentState === "active") fetchMessages(true);
      }, POLL_MS);
      const off = onMessagePush((id) => {
        if (!id || id === conversationId) fetchMessages(true);
      });
      const appSub = AppState.addEventListener("change", (s) => {
        if (s === "active") fetchMessages(true);
      });
      return () => {
        setActiveConversation(null);
        clearInterval(timer);
        off();
        appSub.remove();
      };
    }, [conversationId, fetchMessages]),
  );

  // ── rows ──────────────────────────────────────────────────────────────
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let lastDay = "";
    messages.forEach((m, i) => {
      const day = dayLabel(m.createdAt) || "";
      if (day && day !== lastDay) {
        out.push({ kind: "day", key: `day-${day}-${m.id}`, label: day });
        lastDay = day;
      }
      const isOwn = m.senderId === user?.id;
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const t = new Date(m.createdAt).getTime();
      const sameRunAsNext =
        !!next &&
        next.senderId === m.senderId &&
        Math.abs(new Date(next.createdAt).getTime() - t) < RUN_GAP_MS &&
        (dayLabel(next.createdAt) || "") === day;
      const sameRunAsPrev =
        !!prev &&
        prev.senderId === m.senderId &&
        Math.abs(t - new Date(prev.createdAt).getTime()) < RUN_GAP_MS &&
        (dayLabel(prev.createdAt) || "") === day;
      out.push({
        kind: "msg",
        key: m.id,
        message: m,
        isOwn,
        tail: !sameRunAsNext,
        showTime: !sameRunAsNext,
        first: !sameRunAsPrev,
      });
    });
    return out;
  }, [messages, user?.id]);

  useEffect(() => {
    if (!isLoading && atBottom.current && rows.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [rows.length, isLoading]);

  // ── sending ───────────────────────────────────────────────────────────
  const deliver = useCallback(
    async (
      tempId: string,
      text: string,
      assets: PickedPhoto[],
      alreadyUploaded: string[] = [],
    ) => {
      const patch = (p: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, ...p } : m)),
        );
      try {
        const token = await getToken();
        if (!token) throw new Error("signed out");
        const urls = [...alreadyUploaded];
        for (let i = urls.length; i < assets.length; i++) {
          const a = assets[i];
          const res = await uploadImage(
            a.uri,
            a.mimeType || "image/jpeg",
            "messages",
            token,
            (p) =>
              patch({
                progress: ((i + p.percent / 100) / assets.length) * 100,
              }),
          );
          urls.push(res.url);
          patch({ uploadedUrls: [...urls] });
        }
        const sent = await api.sendMessage(conversationId, text, token, urls);
        const real = mapApiMessage({
          ...sent,
          mediaItems: sent.mediaItems ?? urls,
          text: sent.text ?? text,
        });
        setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
        noteMessageSent(conversationId, previewFor(text, urls), real.createdAt);
      } catch (err) {
        console.warn("[Chat] send failed", (err as any)?.message);
        patch({ localStatus: "failed", progress: undefined });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
      }
    },
    [conversationId, getToken, noteMessageSent],
  );

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    const assets = attachments;
    if (!text && assets.length === 0) return;
    if (!conversationId || !user?.id) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      senderId: user.id,
      content: previewFor(
        text,
        assets.map((a) => a.uri),
      ),
      text,
      mediaItems: assets.map((a) => a.uri),
      createdAt: new Date().toISOString(),
      localStatus: "sending",
      localAssets: assets,
      uploadedUrls: [],
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputText("");
    setAttachments([]);
    atBottom.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    deliver(tempId, text, assets);
  }, [inputText, attachments, conversationId, user?.id, deliver]);

  const retry = useCallback(
    (m: ChatMessage) => {
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, localStatus: "sending", progress: 0 } : x,
        ),
      );
      deliver(m.id, m.text, m.localAssets || [], m.uploadedUrls || []);
    },
    [deliver],
  );

  const discard = useCallback((m: ChatMessage) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }, []);

  const onFailedPress = useCallback(
    (m: ChatMessage) => {
      Alert.alert("Message not sent", "Try sending it again, or delete it.", [
        { text: "Delete", style: "destructive", onPress: () => discard(m) },
        { text: "Cancel", style: "cancel" },
        { text: "Try again", onPress: () => retry(m) },
      ]);
    },
    [discard, retry],
  );

  // ── photos ────────────────────────────────────────────────────────────
  const room = MAX_PHOTOS - attachments.length;

  const pickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Allow photo access",
        "To send photos, allow Outsyde to access your photos in Settings.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets
      .filter((a) => a.type !== "video")
      .map((a) => ({ uri: a.uri, mimeType: a.mimeType }));
    setAttachments((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  }, [room]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Allow camera access",
        "To take a photo, allow Outsyde to use your camera in Settings.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setAttachments((prev) =>
      [...prev, { uri: a.uri, mimeType: a.mimeType }].slice(0, MAX_PHOTOS),
    );
  }, []);

  const openPhotoMenu = useCallback(() => {
    if (room <= 0) {
      Alert.alert("10 photos max", "You can send up to 10 photos at a time.");
      return;
    }
    if (Platform.OS === "web") {
      pickFromLibrary();
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Take photo", "Choose from library", "Cancel"],
          cancelButtonIndex: 2,
        },
        (i) => {
          if (i === 0) takePhoto();
          if (i === 1) pickFromLibrary();
        },
      );
      return;
    }
    const shown = showChoiceSheet({
      title: "Send photos",
      options: [
        { label: "Take photo", onPress: takePhoto },
        { label: "Choose from library", onPress: pickFromLibrary },
      ],
    });
    if (!shown) pickFromLibrary();
  }, [room, takePhoto, pickFromLibrary]);

  // ── render ────────────────────────────────────────────────────────────
  const bubbleMax = Math.round(screenW * 0.76);
  const gridW = Math.min(264, Math.round(screenW * 0.66));
  const otherBubble = theme.brandBgElevated;
  const canSend =
    (inputText.trim().length > 0 || attachments.length > 0) && !!conversationId;

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "day") {
      return (
        <View style={styles.dayWrap}>
          <View
            style={[
              styles.dayPill,
              {
                backgroundColor: theme.brandSurface,
                borderColor: theme.brandSurfaceBorder,
              },
            ]}
          >
            <ThemedText style={[styles.dayText, { color: theme.brandTextDim }]}>
              {item.label}
            </ThemedText>
          </View>
        </View>
      );
    }
    const { message: m, isOwn, tail, showTime, first } = item;
    const text = m.text || "";
    const photos = m.mediaItems || [];
    const hasPhotos = photos.length > 0;
    const hasText = text.trim().length > 0;
    const failed = m.localStatus === "failed";
    const sending = m.localStatus === "sending";
    const bubbleColor = isOwn ? theme.brandPrimary : otherBubble;
    const textColor = isOwn ? theme.brandPrimaryText : theme.brandCream;
    const r = BorderRadius.lg + 2;
    const corners = {
      borderTopLeftRadius: !isOwn && !first ? 6 : r,
      borderTopRightRadius: isOwn && !first ? 6 : r,
      borderBottomLeftRadius: !isOwn && !tail ? 6 : !isOwn ? 6 : r,
      borderBottomRightRadius: isOwn && !tail ? 6 : isOwn ? 6 : r,
    };
    const fullCorners = {
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      borderBottomLeftRadius: !isOwn && tail ? 6 : r,
      borderBottomRightRadius: isOwn && tail ? 6 : r,
    };

    const content = (
      <View
        style={{
          maxWidth: bubbleMax,
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
        {hasPhotos && !hasText ? (
          <MessagePhotoGrid
            urls={photos}
            width={gridW}
            isOwn={isOwn}
            showTail={tail}
            uploading={sending}
            progress={m.progress}
            onOpen={(index) =>
              setViewer({
                urls: photos,
                index,
                caption: isOwn ? "You" : participantName,
              })
            }
          />
        ) : (
          <View
            style={[
              styles.bubble,
              hasPhotos ? fullCorners : corners,
              {
                backgroundColor: bubbleColor,
                borderColor: isOwn ? "transparent" : theme.brandSurfaceBorder,
                padding: hasPhotos ? 3 : undefined,
                width: hasPhotos ? gridW : undefined,
                opacity: failed ? 0.6 : 1,
              },
            ]}
          >
            {hasPhotos ? (
              <MessagePhotoGrid
                urls={photos}
                width={gridW - 6}
                isOwn={isOwn}
                hasTextBelow
                uploading={sending}
                progress={m.progress}
                onOpen={(index) =>
                  setViewer({
                    urls: photos,
                    index,
                    caption: isOwn ? "You" : participantName,
                  })
                }
              />
            ) : null}
            {hasText ? (
              <ThemedText
                selectable
                style={[
                  styles.msgText,
                  { color: textColor },
                  hasPhotos
                    ? {
                        paddingHorizontal: Spacing.sm + 2,
                        paddingTop: Spacing.sm,
                        paddingBottom: Spacing.xs,
                      }
                    : null,
                ]}
              >
                {text}
              </ThemedText>
            ) : null}
          </View>
        )}
      </View>
    );

    return (
      <View
        style={[
          styles.msgRow,
          {
            justifyContent: isOwn ? "flex-end" : "flex-start",
            marginTop: first ? Spacing.sm : 2,
          },
        ]}
      >
        <View style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}>
          {failed ? (
            <Pressable
              onPress={() => onFailedPress(m)}
              accessibilityRole="button"
              accessibilityLabel="Message not sent. Tap for options"
            >
              {content}
            </Pressable>
          ) : (
            content
          )}
          {failed ? (
            <Pressable
              onPress={() => onFailedPress(m)}
              style={styles.metaRow}
              hitSlop={8}
            >
              <Feather name="alert-circle" size={12} color={theme.brandError} />
              <ThemedText style={[styles.meta, { color: theme.brandError }]}>
                Not sent. Tap to retry
              </ThemedText>
            </Pressable>
          ) : sending && tail && !hasPhotos ? (
            <ThemedText style={[styles.meta, { color: theme.brandTextDim }]}>
              Sending…
            </ThemedText>
          ) : showTime && !sending ? (
            <ThemedText style={[styles.meta, { color: theme.brandTextDim }]}>
              {timeLabel(m.createdAt)}
            </ThemedText>
          ) : null}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.brandGold} />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView
        style={[styles.container, styles.center, { padding: Spacing.xl }]}
      >
        <Feather name="wifi-off" size={40} color={theme.brandTextDim} />
        <ThemedText
          style={[
            styles.emptyBody,
            { color: theme.brandTextDim, marginTop: Spacing.md },
          ]}
        >
          {error}
        </ThemedText>
        <Pressable
          onPress={() => fetchMessages(false)}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: theme.brandGold, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <ThemedText style={styles.primaryBtnText}>Try again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const emptyHint =
    participantType === "business"
      ? "Ask about availability or prices, or send a photo of the look you want."
      : participantType === "photographer"
        ? "Share your shoot idea, date and location. You can send up to 10 reference photos."
        : "Say hello. You can send messages and up to 10 photos at a time.";

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          contentContainerStyle={[
            styles.list,
            rows.length === 0 && { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } =
              e.nativeEvent;
            atBottom.current =
              contentOffset.y + layoutMeasurement.height >=
              contentSize.height - 80;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (atBottom.current)
              listRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View
              style={[
                styles.center,
                { flex: 1, paddingHorizontal: Spacing["2xl"] },
              ]}
            >
              <Avatar
                uri={participantAvatar}
                name={participantName}
                size={76}
              />
              <ThemedText
                style={[styles.emptyTitle, { color: theme.brandCream }]}
                numberOfLines={2}
              >
                {participantName || "New chat"}
              </ThemedText>
              {TYPE_LABEL[participantType] && !isSelfConversation ? (
                <ThemedText
                  style={[styles.emptyType, { color: theme.brandGold }]}
                >
                  {TYPE_LABEL[participantType]}
                </ThemedText>
              ) : null}
              <ThemedText
                style={[styles.emptyBody, { color: theme.brandTextDim }]}
              >
                {emptyHint}
              </ThemedText>
            </View>
          }
        />

        <View
          style={[
            styles.composer,
            {
              backgroundColor: theme.backgroundRoot,
              borderTopColor: theme.brandSurfaceBorder,
              paddingBottom: Math.max(insets.bottom, Spacing.sm),
            },
          ]}
        >
          {attachments.length > 0 ? (
            <View style={styles.trayWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tray}
                keyboardShouldPersistTaps="handled"
              >
                {attachments.map((a, i) => (
                  <View
                    key={`${a.uri}-${i}`}
                    style={[
                      styles.thumb,
                      { backgroundColor: theme.brandSurface },
                    ]}
                  >
                    <Image
                      source={{ uri: a.uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() =>
                        setAttachments((prev) => prev.filter((_, j) => j !== i))
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      style={styles.thumbRemove}
                    >
                      <Feather name="x" size={12} color="#F0EAD6" />
                    </Pressable>
                  </View>
                ))}
                {room > 0 ? (
                  <Pressable
                    onPress={openPhotoMenu}
                    accessibilityRole="button"
                    accessibilityLabel="Add more photos"
                    style={[
                      styles.thumb,
                      styles.center,
                      {
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: theme.brandGoldDim,
                      },
                    ]}
                  >
                    <Feather name="plus" size={20} color={theme.brandGold} />
                  </Pressable>
                ) : null}
              </ScrollView>
              <ThemedText
                style={[styles.trayCount, { color: theme.brandTextDim }]}
              >
                {attachments.length}/{MAX_PHOTOS}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <Pressable
              onPress={openPhotoMenu}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              hitSlop={6}
              style={({ pressed }) => [
                styles.roundBtn,
                {
                  backgroundColor: theme.brandSurface,
                  borderColor: theme.brandSurfaceBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="image" size={20} color={theme.brandGold} />
            </Pressable>
            <View
              style={[
                styles.inputPill,
                {
                  backgroundColor: theme.brandSurface,
                  borderColor: theme.brandSurfaceBorder,
                },
              ]}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  attachments.length ? "Add a message (optional)" : "Message"
                }
                placeholderTextColor={theme.brandTextDim}
                style={[styles.input, { color: theme.brandCream }]}
                multiline
                maxLength={MAX_CHARS}
                accessibilityLabel="Message"
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => [
                styles.roundBtn,
                styles.sendBtn,
                {
                  backgroundColor: canSend
                    ? theme.brandGold
                    : theme.brandSurface,
                  borderColor: canSend
                    ? theme.brandGold
                    : theme.brandSurfaceBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather
                name="arrow-up"
                size={20}
                color={canSend ? "#0A0A0A" : theme.brandTextDim}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <PhotoViewer
        visible={!!viewer}
        urls={viewer?.urls || []}
        initialIndex={viewer?.index || 0}
        caption={viewer?.caption}
        onClose={() => setViewer(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 260,
  },
  headerName: { fontSize: 16, fontWeight: "700", lineHeight: 20 },
  headerSub: { fontSize: 12, lineHeight: 16 },
  headerIcon: { paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  dayWrap: {
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  msgRow: { flexDirection: "row" },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  msgText: { fontSize: 16, lineHeight: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: {
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 4,
    fontVariant: ["tabular-nums"],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.md,
    textAlign: "center",
  },
  emptyType: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: Spacing.sm,
    maxWidth: 300,
  },
  primaryBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: { color: "#0A0A0A", fontWeight: "700", fontSize: 15 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.sm + 4,
  },
  trayWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  tray: { gap: 8, paddingRight: 8 },
  thumb: { width: 64, height: 64, borderRadius: 12, overflow: "hidden" },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  trayCount: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
    fontVariant: ["tabular-nums"],
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {},
  inputPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    lineHeight: 21,
    maxHeight: 120,
    paddingTop: Platform.OS === "ios" ? 10 : 6,
    paddingBottom: Platform.OS === "ios" ? 10 : 6,
  },
});

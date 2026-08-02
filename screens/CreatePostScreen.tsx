import React, { useState, useEffect } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { uploadImage, uploadVideo } from "@/services/mediaUpload";
import { feedEvents } from "@/services/feedEvents";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreatePostScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, getToken } = useAuth();

  const [postImage, setPostImage] = useState<string>("");
  const [postCaption, setPostCaption] = useState("");
  const [postLayout, setPostLayout] = useState<"pro" | "pulse" | null>(null);
  const [postSaving, setPostSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"post" | "story">("post");
  const [storySaving, setStorySaving] = useState(false);

  type AttachType = "product" | "service" | "photographerService";
  type AttachItem = { type: AttachType; id: string; name: string; priceCents: number | null };

  const [attachItems, setAttachItems] = useState<AttachItem[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [selectedAttach, setSelectedAttach] = useState<{ type: AttachType; id: string } | null>(null);

  const canAttach = user?.role === "business" || user?.role === "photographer";

  const switchMode = (newMode: "post" | "story") => {
    setMode(newMode);
    setStep(1);
    setPostImage("");
    setPostCaption("");
    setSelectedAttach(null);
  };

  // Horizontal swipe on Step 1 only — left = story, right = post
  const modeSwipeGesture = Gesture.Pan()
    .activeOffsetX([-50, 50])
    .onEnd((e) => {
      if (e.translationX < -50) runOnJS(switchMode)("story");
      else if (e.translationX > 50) runOnJS(switchMode)("post");
    });

  useEffect(() => {
    if (step !== 3 || attachItems.length > 0 || attachLoading) return;

    const fetchAttachItems = async () => {
      setAttachLoading(true);
      setAttachError(null);
      try {
        const authToken = await getToken();
        if (!authToken) {
          setAttachError("You must be logged in to load your products and services.");
          return;
        }
        if (user?.role === "business") {
          const [productsRes, servicesRes] = await Promise.all([
            apiClient.getVendorProducts(authToken),
            apiClient.getVendorServices(authToken),
          ]);
          const liveProducts: AttachItem[] = productsRes.products
            .filter((product) => product.status === "live")
            .map((product) => ({ type: "product", id: product.id, name: product.name, priceCents: product.priceCents }));
          const liveServices: AttachItem[] = servicesRes.services
            .filter((service) => service.status === "live")
            .map((service) => ({ type: "service", id: service.id, name: service.name, priceCents: service.priceCents }));
          setAttachItems([...liveProducts, ...liveServices]);
        } else if (user?.role === "photographer") {
          const servicesRes = await apiClient.getPhotographerMeServices(authToken);
          const liveServices: AttachItem[] = servicesRes.services
            .filter((service) => service.status === "live")
            .map((service) => ({ type: "photographerService", id: service.id, name: service.name, priceCents: service.priceCents ?? null }));
          setAttachItems(liveServices);
        }
      } catch (error: any) {
        console.error("[CreatePostScreen] Failed to load attach items:", error);
        setAttachError("Couldn't load your products and services. You can still share your post.");
      } finally {
        setAttachLoading(false);
      }
    };

    fetchAttachItems();
  }, [step]);

  const handlePickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPostImage(asset.uri);
      const isVideo = asset.type === "video" || (asset.mimeType?.includes("video") ?? false);
      setPostLayout(isVideo ? "pulse" : "pro");
    }
  };

  const handlePickStoryMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      videoMaxDuration: 15,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPostImage(asset.uri);
      const isVideo = asset.type === "video" || (asset.mimeType?.includes("video") ?? false);
      setPostLayout(isVideo ? "pulse" : "pro");
    }
  };

  const handleCameraCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your camera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPostImage(result.assets[0].uri);
      setPostLayout("pro");
    }
  };

  const handleCreatePost = async () => {
    if (!postImage) {
      Alert.alert("No Media", "Please select a photo or video for your post.");
      return;
    }
    if (!postLayout) {
      Alert.alert("Layout Required", "Please select a photo or video first.");
      return;
    }
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "You must be logged in to create a post.");
      return;
    }
    setPostSaving(true);
    try {
      const isVideo = postLayout === "pulse";
      const postData: {
        imageUrl?: string;
        videoUrl?: string;
        mediaType?: "image" | "video";
        content?: string;
        displayLayout?: "pro" | "pulse";
        feedSurface?: "pro" | "pulse";
        productId?: string;
        serviceId?: string;
        photographerServiceId?: string;
      } = {
        content: postCaption.trim() || " ",
        displayLayout: postLayout,
        feedSurface: postLayout,
      };
      if (isVideo) {
        const uploadResult = await uploadVideo(postImage, "video/mp4", authToken);
        if (!uploadResult.uploadId) throw new Error("Failed to upload video. Please try again.");
        postData.videoUrl = uploadResult.uploadId;
        postData.mediaType = "video";
      } else {
        const uploadResult = await uploadImage(postImage, "image/jpeg", "posts", authToken);
        if (!uploadResult.url) throw new Error("Failed to upload image. Please try again.");
        postData.imageUrl = uploadResult.url;
      }
      if (selectedAttach) {
        if (selectedAttach.type === "product") postData.productId = selectedAttach.id;
        else if (selectedAttach.type === "service") postData.serviceId = selectedAttach.id;
        else if (selectedAttach.type === "photographerService") postData.photographerServiceId = selectedAttach.id;
      }
      await apiClient.createPost(authToken, postData);
      setPostImage("");
      setPostCaption("");
      setPostLayout(null);
      feedEvents.emitRefresh(isVideo ? "pulse" : "pro");
      Alert.alert(
        "Post Shared!",
        isVideo ? "Your video is now live on the Pulse feed!" : "Your post is now live on the Pro feed!",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      console.error("[CreatePostScreen] Failed to create post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setPostSaving(false);
    }
  };

  const handleCreateStory = async () => {
    if (!postImage) {
      Alert.alert("No Media", "Please select a photo or video for your story.");
      return;
    }
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "You must be logged in to post a story.");
      return;
    }
    setStorySaving(true);
    try {
      const isVideo = postLayout === "pulse";
      const caption = postCaption.trim() || undefined;
      if (isVideo) {
        const uploadResult = await uploadVideo(postImage, "video/mp4", authToken);
        if (!uploadResult.uploadId) throw new Error("Failed to upload video. Please try again.");
        await apiClient.createStory(authToken, {
          mediaUrl: uploadResult.uploadId,
          mediaType: "video",
          muxAssetId: uploadResult.uploadId,
          caption,
        });
      } else {
        const uploadResult = await uploadImage(postImage, "image/jpeg", "stories", authToken);
        if (!uploadResult.url) throw new Error("Failed to upload image. Please try again.");
        await apiClient.createStory(authToken, {
          mediaUrl: uploadResult.url,
          mediaType: "image",
          caption,
        });
      }
      setPostImage("");
      setPostCaption("");
      setPostLayout(null);
      setStep(1);
      navigation.goBack();
    } catch (error: any) {
      console.error("[CreatePostScreen] Failed to create story:", error);
      Alert.alert("Error", error.message || "Failed to post story. Please try again.");
    } finally {
      setStorySaving(false);
    }
  };

  const handleClose = () => {
    setPostImage("");
    setPostCaption("");
    setPostLayout(null);
    setStep(1);
    setSelectedAttach(null);
    setAttachItems([]);
    setAttachError(null);
    navigation.goBack();
  };

  const renderShareButton = () => (
    <Pressable
      onPress={handleCreatePost}
      disabled={postSaving || !postImage}
      style={[
        styles.footerButton,
        {
          backgroundColor: theme.brandPrimary,
          opacity: postSaving || !postImage ? 0.5 : 1,
        },
      ]}
    >
      {postSaving ? (
        <ActivityIndicator size="small" color={theme.brandPrimaryText} />
      ) : (
        <ThemedText type="button" style={{ color: theme.brandPrimaryText }}>
          Share Post
        </ThemedText>
      )}
    </Pressable>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {step === 1 ? (
          <Pressable onPress={handleClose} hitSlop={16}>
            <Feather name="x" size={24} color={theme.brandCream} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setStep(step === 3 ? 2 : 1)} hitSlop={16}>
            <Feather name="chevron-left" size={24} color={theme.brandCream} />
          </Pressable>
        )}
        <ThemedText type="h4" style={{ flex: 1, textAlign: "center", color: theme.brandCream }}>
          {mode === "story" ? "Create Story" : "Create Post"}
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* ── Mode tab switcher ── */}
      <View style={[styles.tabRow, { borderBottomColor: theme.brandSurfaceBorder }]}>
        <Pressable
          style={[styles.tab, mode === "post" && { borderBottomWidth: 2, borderBottomColor: "#D4A94A" }]}
          onPress={() => switchMode("post")}
        >
          <ThemedText type="button" style={{ color: mode === "post" ? "#D4A94A" : theme.brandTextDim }}>
            Post
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === "story" && { borderBottomWidth: 2, borderBottomColor: "#D4A94A" }]}
          onPress={() => switchMode("story")}
        >
          <ThemedText type="button" style={{ color: mode === "story" ? "#D4A94A" : theme.brandTextDim }}>
            Story
          </ThemedText>
        </Pressable>
      </View>

      {step === 1 && (
        <GestureDetector gesture={modeSwipeGesture}>
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={mode === "story" ? handlePickStoryMedia : handlePickPostImage}
              style={[styles.mediaPicker, { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder }]}
            >
              {postImage ? (
                postLayout === "pulse" ? (
                  <View style={styles.videoSelected}>
                    <Feather name="video" size={32} color={theme.brandGold} />
                    <ThemedText type="body" style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
                      Video selected
                    </ThemedText>
                  </View>
                ) : (
                  <Image source={{ uri: postImage }} style={styles.mediaPreview} contentFit="cover" />
                )
              ) : (
                <View style={styles.mediaEmpty}>
                  <Feather name="image" size={32} color={theme.brandTextDim} />
                  <ThemedText type="body" style={{ color: theme.brandTextDim, marginTop: Spacing.sm }}>
                    Tap to select a photo or video
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {mode === "story" && (
              <Pressable onPress={handleCameraCapture} style={styles.cameraButton}>
                <Feather name="camera" size={16} color={theme.brandGold} />
                <ThemedText type="body" style={{ color: theme.brandGold, marginLeft: Spacing.xs }}>
                  Camera
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={() => setStep(2)}
              disabled={!postImage}
              style={[
                styles.footerButton,
                { backgroundColor: theme.brandPrimary, opacity: !postImage ? 0.5 : 1 },
              ]}
            >
              <ThemedText type="button" style={{ color: theme.brandPrimaryText }}>
                Next
              </ThemedText>
            </Pressable>
          </View>
        </GestureDetector>
      )}

      {step === 2 && mode === "post" && (
        <>
          <View
            style={[
              styles.detailsThumbnail,
              { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
            ]}
          >
            {postLayout === "pulse" ? (
              <View style={styles.videoSelected}>
                <Feather name="video" size={20} color={theme.brandGold} />
                <ThemedText type="caption" style={{ color: theme.brandTextDim, marginTop: Spacing.xs }}>
                  Video selected
                </ThemedText>
              </View>
            ) : (
              <Image source={{ uri: postImage }} style={styles.mediaPreview} contentFit="cover" />
            )}
          </View>

          <ScreenKeyboardAwareScrollView contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0 }}>
            <TextInput
              style={[styles.captionInput, { color: theme.brandCream, borderColor: theme.brandSurfaceBorder }]}
              placeholder="Write a caption..."
              placeholderTextColor={theme.brandTextDim}
              value={postCaption}
              onChangeText={setPostCaption}
              multiline
            />

            {canAttach ? (
              <Pressable
                onPress={() => setStep(3)}
                style={[styles.footerButton, { backgroundColor: theme.brandPrimary }]}
              >
                <ThemedText type="button" style={{ color: theme.brandPrimaryText }}>
                  Next
                </ThemedText>
              </Pressable>
            ) : (
              renderShareButton()
            )}
          </ScreenKeyboardAwareScrollView>
        </>
      )}

      {step === 2 && mode === "story" && (
        <>
          <View
            style={[
              styles.detailsThumbnail,
              { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
            ]}
          >
            {postLayout === "pulse" ? (
              <View style={styles.videoSelected}>
                <Feather name="video" size={20} color={theme.brandGold} />
                <ThemedText type="caption" style={{ color: theme.brandTextDim, marginTop: Spacing.xs }}>
                  Video selected
                </ThemedText>
              </View>
            ) : (
              <Image source={{ uri: postImage }} style={styles.mediaPreview} contentFit="cover" />
            )}
          </View>

          <ScreenKeyboardAwareScrollView contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0 }}>
            <TextInput
              style={[styles.captionInput, { color: theme.brandCream, borderColor: theme.brandSurfaceBorder }]}
              placeholder="Write a caption... (optional)"
              placeholderTextColor={theme.brandTextDim}
              value={postCaption}
              onChangeText={setPostCaption}
              multiline
            />

            <Pressable
              onPress={handleCreateStory}
              disabled={storySaving}
              style={[
                styles.footerButton,
                { backgroundColor: "#D4A94A", opacity: storySaving ? 0.6 : 1 },
              ]}
            >
              {storySaving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <ThemedText type="button" style={{ color: "#000" }}>
                  Post Story
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={() => { setStep(1); setPostImage(""); setPostCaption(""); setPostLayout(null); }}
              style={styles.discardButton}
            >
              <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                Discard
              </ThemedText>
            </Pressable>
          </ScreenKeyboardAwareScrollView>
        </>
      )}

      {step === 3 && canAttach && mode === "post" && (
        <View style={{ flex: 1, paddingBottom: insets.bottom || 16 }}>
          <View style={styles.attachContent}>
            <ThemedText type="h4" style={{ color: theme.brandCream, textAlign: "center" }}>
              {user?.role === "photographer" ? "Attach a service?" : "Attach a product or service?"}
            </ThemedText>

            {attachLoading ? (
              <View style={styles.attachStatusBox}>
                <ActivityIndicator size="small" color={theme.brandPrimary} />
              </View>
            ) : attachError ? (
              <View
                style={[
                  styles.attachPlaceholder,
                  { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
                ]}
              >
                <Feather name="alert-circle" size={28} color={theme.brandTextDim} />
                <ThemedText
                  type="body"
                  style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.md }}
                >
                  {attachError}
                </ThemedText>
              </View>
            ) : attachItems.length === 0 ? (
              <View
                style={[
                  styles.attachPlaceholder,
                  { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
                ]}
              >
                <Feather name="tag" size={28} color={theme.brandTextDim} />
                <ThemedText
                  type="body"
                  style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.md }}
                >
                  No live items to attach — you can still share your post.
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.attachList} showsVerticalScrollIndicator={false}>
                {attachItems.map((item) => {
                  const isSelected = selectedAttach?.type === item.type && selectedAttach?.id === item.id;
                  const priceLabel = item.priceCents != null ? `$${(item.priceCents / 100).toFixed(2)}` : "—";
                  return (
                    <Pressable
                      key={`${item.type}-${item.id}`}
                      onPress={() => setSelectedAttach(isSelected ? null : { type: item.type, id: item.id })}
                      style={[
                        styles.attachRow,
                        {
                          backgroundColor: isSelected ? theme.brandPrimary : theme.brandSurface,
                          borderColor: isSelected ? theme.brandPrimary : theme.brandSurfaceBorder,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{ color: isSelected ? theme.brandPrimaryText : theme.brandCream, flex: 1 }}
                      >
                        {item.name}
                      </ThemedText>
                      <ThemedText
                        type="body"
                        style={{ color: isSelected ? theme.brandPrimaryText : theme.brandTextDim }}
                      >
                        {priceLabel}
                      </ThemedText>
                      {isSelected && (
                        <Feather
                          name="check-circle"
                          size={18}
                          color={theme.brandPrimaryText}
                          style={{ marginLeft: Spacing.sm }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {renderShareButton()}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  notAvailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  mediaPicker: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    height: 280,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  mediaEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  videoSelected: {
    alignItems: "center",
    justifyContent: "center",
  },
  captionInput: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    textAlignVertical: "top",
  },
  footerButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsThumbnail: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    height: 120,
    width: 120,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  attachContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    flex: 1,
  },
  attachPlaceholder: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  attachStatusBox: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  attachList: {
    marginTop: Spacing.lg,
    flex: 1,
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  discardButton: {
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});

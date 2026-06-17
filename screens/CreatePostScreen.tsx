import React, { useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
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

  const canCreatePosts = user?.role !== "consumer";

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

  if (!canCreatePosts) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={16}>
            <Feather name="x" size={24} color={theme.brandCream} />
          </Pressable>
          <ThemedText type="h4" style={{ flex: 1, textAlign: "center", color: theme.brandCream }}>
            Create Post
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notAvailable}>
          <Feather name="lock" size={40} color={theme.brandTextDim} />
          <ThemedText type="body" style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.md }}>
            Posting is available for businesses and photographers.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            setPostImage("");
            setPostCaption("");
            setPostLayout(null);
            navigation.goBack();
          }}
          hitSlop={16}
        >
          <Feather name="x" size={24} color={theme.brandCream} />
        </Pressable>
        <ThemedText type="h4" style={{ flex: 1, textAlign: "center", color: theme.brandCream }}>
          Create Post
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <Pressable
        onPress={handlePickPostImage}
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

      <TextInput
        style={[styles.captionInput, { color: theme.brandCream, borderColor: theme.brandSurfaceBorder }]}
        placeholder="Write a caption..."
        placeholderTextColor={theme.brandTextDim}
        value={postCaption}
        onChangeText={setPostCaption}
        multiline
      />

      <Pressable
        onPress={handleCreatePost}
        disabled={postSaving || !postImage}
        style={[
          styles.shareButton,
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
  shareButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

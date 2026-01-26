import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/hooks/useTheme";
import { uploadImageToCloudinary, uploadVideoToCloudinary } from "@/services/cloudinary";

type MediaType = "image" | "video";

interface MediaUploaderProps {
  currentImage?: string | null;
  currentVideo?: string | null;
  currentMediaType?: MediaType | null;
  onMediaUploaded: (url: string, mediaType: MediaType) => void;
  onRemove?: () => void;
  aspectRatio?: "cover" | "logo" | "product";
  placeholder?: string;
  showRemove?: boolean;
  folder?: string;
  maxVideoDuration?: number;
  maxVideoSizeMB?: number;
}

export default function MediaUploader({
  currentImage,
  currentVideo,
  currentMediaType,
  onMediaUploaded,
  onRemove,
  aspectRatio = "cover",
  placeholder = "Upload Media",
  showRemove = true,
  folder = "banners",
  maxVideoDuration = 15,
  maxVideoSizeMB = 50,
}: MediaUploaderProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<MediaType>(currentMediaType || "image");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const videoPlayer = useVideoPlayer(currentVideo || null, player => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const getAspectRatioStyle = () => {
    switch (aspectRatio) {
      case "logo":
        return { width: 120, height: 120, borderRadius: 16 };
      case "product":
        return { width: "100%" as const, aspectRatio: 1, borderRadius: 12 };
      case "cover":
      default:
        return { width: "100%" as const, aspectRatio: 16 / 9, borderRadius: 12 };
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload images."
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress("Selecting image...");
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: aspectRatio === "logo" ? [1, 1] : aspectRatio === "product" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadProgress("Uploading image...");
        const cloudinaryUrl = await uploadImageToCloudinary(result.assets[0].uri, folder);
        onMediaUploaded(cloudinaryUrl, "image");
        setActiveTab("image");
      }
    } catch (error: any) {
      console.error("[MediaUploader] Image upload failed:", error);
      Alert.alert("Upload Failed", error.message || "Could not upload image. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Camera is not available on web. Please use the Expo Go app on your device.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take photos."
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress("Taking photo...");
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: aspectRatio === "logo" ? [1, 1] : aspectRatio === "product" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadProgress("Uploading photo...");
        const cloudinaryUrl = await uploadImageToCloudinary(result.assets[0].uri, folder);
        onMediaUploaded(cloudinaryUrl, "image");
        setActiveTab("image");
      }
    } catch (error: any) {
      console.error("[MediaUploader] Photo capture failed:", error);
      Alert.alert("Upload Failed", error.message || "Could not take photo. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload videos."
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress("Selecting video...");
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: maxVideoDuration,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        if (asset.duration && asset.duration > maxVideoDuration * 1000) {
          Alert.alert(
            "Video Too Long",
            `Please select a video under ${maxVideoDuration} seconds.`
          );
          setUploading(false);
          setUploadProgress("");
          return;
        }

        if (asset.fileSize && asset.fileSize > maxVideoSizeMB * 1024 * 1024) {
          Alert.alert(
            "Video Too Large",
            `Please select a video under ${maxVideoSizeMB}MB.`
          );
          setUploading(false);
          setUploadProgress("");
          return;
        }

        setUploadProgress("Uploading video (this may take a moment)...");
        console.log("[MediaUploader] Starting video upload:", {
          uri: asset.uri.substring(0, 50),
          mimeType: asset.mimeType,
          duration: asset.duration,
          fileSize: asset.fileSize,
        });
        
        const cloudinaryUrl = await uploadVideoToCloudinary(asset.uri, folder, asset.mimeType);
        console.log("[MediaUploader] Video uploaded successfully:", cloudinaryUrl);
        onMediaUploaded(cloudinaryUrl, "video");
        setActiveTab("video");
      }
    } catch (error: any) {
      console.error("[MediaUploader] Video upload failed:", error);
      Alert.alert("Upload Failed", error.message || "Could not upload video. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const showImageOptions = () => {
    Alert.alert("Upload Image", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const hasCurrentMedia = (activeTab === "image" && currentImage) || (activeTab === "video" && currentVideo);

  const styles = StyleSheet.create({
    container: {
      width: "100%",
    },
    tabsContainer: {
      flexDirection: "row",
      marginBottom: 12,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 8,
      padding: 4,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 6,
      gap: 6,
    },
    activeTab: {
      backgroundColor: theme.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.textSecondary,
    },
    activeTabText: {
      color: "#000",
    },
    mediaContainer: {
      ...getAspectRatioStyle(),
      backgroundColor: theme.surfaceSecondary,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    media: {
      width: "100%",
      height: "100%",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    removeButton: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    videoBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    videoBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },
    placeholder: {
      alignItems: "center",
      gap: 8,
    },
    placeholderText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    uploadButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginTop: 8,
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#000",
    },
    uploadingContainer: {
      alignItems: "center",
      gap: 12,
    },
    uploadingText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
    },
  });

  if (uploading) {
    return (
      <View style={styles.container}>
        <View style={styles.tabsContainer}>
          <Pressable 
            style={[styles.tab, activeTab === "image" && styles.activeTab]}
            disabled
          >
            <Feather name="image" size={16} color={activeTab === "image" ? "#000" : theme.textSecondary} />
            <Text style={[styles.tabText, activeTab === "image" && styles.activeTabText]}>Image</Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === "video" && styles.activeTab]}
            disabled
          >
            <Feather name="video" size={16} color={activeTab === "video" ? "#000" : theme.textSecondary} />
            <Text style={[styles.tabText, activeTab === "video" && styles.activeTabText]}>Video</Text>
          </Pressable>
        </View>
        <View style={styles.mediaContainer}>
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.uploadingText}>{uploadProgress}</Text>
          </View>
        </View>
      </View>
    );
  }

  const renderMediaPreview = () => {
    if (activeTab === "image" && currentImage) {
      return (
        <View style={styles.mediaContainer}>
          <Image source={{ uri: currentImage }} style={styles.media} contentFit="cover" />
          <View style={styles.overlay}>
            <Pressable onPress={showImageOptions} style={styles.uploadButton}>
              <Feather name="camera" size={16} color="#000" />
              <Text style={styles.uploadButtonText}>Change</Text>
            </Pressable>
          </View>
          {showRemove && onRemove && (
            <Pressable style={styles.removeButton} onPress={onRemove}>
              <Feather name="x" size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      );
    }

    if (activeTab === "video" && currentVideo) {
      return (
        <View style={styles.mediaContainer}>
          <VideoView
            player={videoPlayer}
            style={styles.media}
            contentFit="cover"
            nativeControls={false}
          />
          <View style={styles.videoBadge}>
            <Feather name="video" size={12} color="#fff" />
            <Text style={styles.videoBadgeText}>Video</Text>
          </View>
          <View style={styles.overlay}>
            <Pressable onPress={pickVideo} style={styles.uploadButton}>
              <Feather name="video" size={16} color="#000" />
              <Text style={styles.uploadButtonText}>Change</Text>
            </Pressable>
          </View>
          {showRemove && onRemove && (
            <Pressable style={styles.removeButton} onPress={onRemove}>
              <Feather name="x" size={16} color="#fff" />
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <Pressable 
        style={styles.mediaContainer} 
        onPress={activeTab === "image" ? showImageOptions : pickVideo}
      >
        <View style={styles.placeholder}>
          <Feather 
            name={activeTab === "image" ? "image" : "video"} 
            size={32} 
            color={theme.textSecondary} 
          />
          <Text style={styles.placeholderText}>
            {activeTab === "image" ? placeholder : `Upload Video (max ${maxVideoDuration}s)`}
          </Text>
          <View style={styles.uploadButton}>
            <Feather name={activeTab === "image" ? "camera" : "video"} size={16} color="#000" />
            <Text style={styles.uploadButtonText}>Upload</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <Pressable 
          style={[styles.tab, activeTab === "image" && styles.activeTab]}
          onPress={() => setActiveTab("image")}
        >
          <Feather name="image" size={16} color={activeTab === "image" ? "#000" : theme.textSecondary} />
          <Text style={[styles.tabText, activeTab === "image" && styles.activeTabText]}>Image</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === "video" && styles.activeTab]}
          onPress={() => setActiveTab("video")}
        >
          <Feather name="video" size={16} color={activeTab === "video" ? "#000" : theme.textSecondary} />
          <Text style={[styles.tabText, activeTab === "video" && styles.activeTabText]}>Video</Text>
        </Pressable>
      </View>
      {renderMediaPreview()}
    </View>
  );
}

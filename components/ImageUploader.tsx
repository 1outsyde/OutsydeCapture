import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { CROP_PRESETS, useCropPicker } from "@/components/crop/useCropPicker";
import { useTheme } from "@/hooks/useTheme";

interface ImageUploaderProps {
  currentImage?: string | null;
  onImageSelected: (uri: string) => void;
  onRemove?: () => void;
  /** cover 16:9, logo and profile 1:1 circle, product 4:5, service 1:1. */
  aspectRatio?: "cover" | "logo" | "profile" | "product" | "service";
  placeholder?: string;
  showRemove?: boolean;
}

export default function ImageUploader({
  currentImage,
  onImageSelected,
  onRemove,
  aspectRatio = "cover",
  placeholder = "Upload Image",
  showRemove = true,
}: ImageUploaderProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const crop = useCropPicker();

  const getAspectRatioStyle = () => {
    switch (aspectRatio) {
      case "logo":
      case "profile":
        return { width: 120, height: 120, borderRadius: 60 };
      case "product":
        return { width: "100%" as const, aspectRatio: 4 / 5, borderRadius: 12 };
      case "service":
        return { width: "100%" as const, aspectRatio: 1, borderRadius: 12 };
      case "cover":
      default:
        return {
          width: "100%" as const,
          aspectRatio: 16 / 9,
          borderRadius: 12,
        };
    }
  };

  const preset =
    aspectRatio === "logo"
      ? CROP_PRESETS.logo
      : aspectRatio === "profile"
        ? CROP_PRESETS.profile
        : aspectRatio === "product"
          ? CROP_PRESETS.product
          : aspectRatio === "service"
            ? CROP_PRESETS.service
            : CROP_PRESETS.cover;

  // Pick or take a photo, then crop it to this uploader's shape before handing it back.
  const pickAndCrop = async (source: "library" | "camera") => {
    try {
      setLoading(true);
      const result = await crop.pick(source, preset);
      if (result) onImageSelected(result.uri);
    } catch (error) {
      Alert.alert(
        "Error",
        source === "camera"
          ? "Failed to take photo. Please try again."
          : "Failed to pick image. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const pickImage = () => pickAndCrop("library");
  const takePhoto = () => pickAndCrop("camera");

  const showOptions = () => {
    Alert.alert("Upload Image", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      ...getAspectRatioStyle(),
      backgroundColor: theme.brandBgElevated,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
      width: "100%",
      height: "100%",
    },
    overlay: {
      ...StyleSheet.absoluteFill,
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
    placeholder: {
      alignItems: "center",
      gap: 8,
    },
    placeholderText: {
      fontSize: 14,
      color: theme.brandTextDim,
    },
    uploadButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.brandPrimary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginTop: 8,
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.brandPrimaryText,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.brandPrimary} />
        {crop.cropper}
      </View>
    );
  }

  if (currentImage) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: currentImage }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.overlay}>
          <Pressable onPress={showOptions} style={styles.uploadButton}>
            <Feather name="camera" size={16} color={theme.brandPrimaryText} />
            <Text style={styles.uploadButtonText}>Change</Text>
          </Pressable>
        </View>
        {showRemove && onRemove && (
          <Pressable style={styles.removeButton} onPress={onRemove}>
            <Feather name="x" size={16} color="#fff" />
          </Pressable>
        )}
        {crop.cropper}
      </View>
    );
  }

  // The cropper sits beside the Pressable, not inside it, so touches in the crop screen
  // never reach this button.
  return (
    <>
      <Pressable style={styles.container} onPress={showOptions}>
        <View style={styles.placeholder}>
          <Feather name="image" size={32} color={theme.brandTextDim} />
          <Text style={styles.placeholderText}>{placeholder}</Text>
          <View style={styles.uploadButton}>
            <Feather name="camera" size={16} color={theme.brandPrimaryText} />
            <Text style={styles.uploadButtonText}>Upload</Text>
          </View>
        </View>
      </Pressable>
      {crop.cropper}
    </>
  );
}

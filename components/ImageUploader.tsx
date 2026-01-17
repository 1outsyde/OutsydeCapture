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
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/hooks/useTheme";

interface ImageUploaderProps {
  currentImage?: string | null;
  onImageSelected: (uri: string) => void;
  onRemove?: () => void;
  aspectRatio?: "cover" | "logo" | "product";
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
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: aspectRatio === "logo" ? [1, 1] : aspectRatio === "product" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take photos."
      );
      return;
    }

    try {
      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: aspectRatio === "logo" ? [1, 1] : aspectRatio === "product" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      backgroundColor: theme.surfaceSecondary,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
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
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (currentImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: currentImage }} style={styles.image} resizeMode="cover" />
        <View style={styles.overlay}>
          <Pressable onPress={showOptions} style={styles.uploadButton}>
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

  return (
    <Pressable style={styles.container} onPress={showOptions}>
      <View style={styles.placeholder}>
        <Feather name="image" size={32} color={theme.textSecondary} />
        <Text style={styles.placeholderText}>{placeholder}</Text>
        <View style={styles.uploadButton}>
          <Feather name="camera" size={16} color="#000" />
          <Text style={styles.uploadButtonText}>Upload</Text>
        </View>
      </View>
    </Pressable>
  );
}

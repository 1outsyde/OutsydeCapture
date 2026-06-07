import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { AccountStackParamList } from "@/navigation/types";
import api from "@/services/api";
import ImageUploader from "@/components/ImageUploader";
import MediaUploader from "@/components/MediaUploader";
import { uploadImage } from "@/services/mediaUpload";

type NavigationProp = NativeStackNavigationProp<AccountStackParamList>;

export default function ConsumerEditProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user, getToken, refreshUser } = useAuth();

  // ─── Originals (for changed-fields diff) ─────────────────────────────────
  const origProfileImageUrl = user?.avatar || user?.profileImageUrl || "";
  const origCoverMediaUrl = user?.coverMediaUrl || "";
  const origCoverMediaType: "image" | "video" =
    user?.coverMediaType === "video" ? "video" : "image";
  const origDisplayName =
    user?.displayName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  const origBio = user?.bio || "";

  // ─── Local editable state seeded from current user ───────────────────────
  const [profileImageUrl, setProfileImageUrl] = useState<string>(origProfileImageUrl);
  const [coverMediaUrl, setCoverMediaUrl] = useState<string>(origCoverMediaUrl);
  const [coverMediaType, setCoverMediaType] = useState<"image" | "video">(origCoverMediaType);
  const [displayName, setDisplayName] = useState<string>(origDisplayName);
  const [bio, setBio] = useState<string>(origBio);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Avatar: pick via ImageUploader → upload to R2 "profiles" folder ──────
  const handleAvatarSelected = useCallback(
    async (uri: string) => {
      const token = await getToken();
      if (!token) {
        Alert.alert("Error", "Authentication required. Please log in again.");
        return;
      }
      try {
        setAvatarUploading(true);
        const result = await uploadImage(uri, "image/jpeg", "profiles", token);
        setProfileImageUrl(result.url);
      } catch (error: any) {
        Alert.alert(
          "Upload Failed",
          error.message || "Could not upload profile photo. Please try again.",
        );
      } finally {
        setAvatarUploading(false);
      }
    },
    [getToken],
  );

  // ─── Save: only send fields that changed ─────────────────────────────────
  const handleSave = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Authentication required. Please log in again.");
      return;
    }

    const payload: Parameters<typeof api.updateUserMe>[1] = {};

    if (profileImageUrl !== origProfileImageUrl) {
      payload.profileImageUrl = profileImageUrl || null;
    }
    if (coverMediaUrl !== origCoverMediaUrl) {
      payload.coverMediaUrl = coverMediaUrl || null;
      payload.coverMediaType = coverMediaUrl ? coverMediaType : null;
    } else if (coverMediaType !== origCoverMediaType && coverMediaUrl) {
      payload.coverMediaType = coverMediaType;
    }
    if (displayName.trim() !== origDisplayName.trim()) {
      payload.displayName = displayName.trim();
    }
    if (bio.trim() !== origBio.trim()) {
      payload.bio = bio.trim();
    }

    if (Object.keys(payload).length === 0) {
      navigation.goBack();
      return;
    }

    try {
      setSaving(true);
      console.log("[ConsumerEditProfile] Saving payload:", JSON.stringify(payload, null, 2));
      await api.updateUserMe(token, payload);
      await refreshUser();
      navigation.goBack();
    } catch (error: any) {
      console.error("[ConsumerEditProfile] Save failed:", error);
      Alert.alert(
        "Save Failed",
        error.message || "Could not save profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    getToken,
    profileImageUrl,
    coverMediaUrl,
    coverMediaType,
    displayName,
    bio,
    origProfileImageUrl,
    origCoverMediaUrl,
    origCoverMediaType,
    origDisplayName,
    origBio,
    refreshUser,
    navigation,
  ]);

  const busy = saving || avatarUploading;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover Photo / Video ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            COVER PHOTO / VIDEO
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
            Appears at the top of your profile (supports image or short video)
          </Text>
          <MediaUploader
            currentImage={
              coverMediaType === "image" && coverMediaUrl
                ? coverMediaUrl
                : undefined
            }
            currentVideo={
              coverMediaType === "video" && coverMediaUrl
                ? coverMediaUrl
                : undefined
            }
            currentMediaType={coverMediaUrl ? coverMediaType : null}
            onMediaUploaded={(url, mediaType) => {
              setCoverMediaUrl(url);
              setCoverMediaType(mediaType);
            }}
            onRemove={() => {
              setCoverMediaUrl("");
              setCoverMediaType("image");
            }}
            folder="banners"
            aspectRatio="cover"
            placeholder="Upload cover photo or video"
            maxVideoDuration={15}
          />
        </View>

        {/* ── Profile Photo ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            PROFILE PHOTO
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
            Your avatar shown on posts, messages, and search results
          </Text>
          <View style={styles.avatarRow}>
            <ImageUploader
              currentImage={profileImageUrl || undefined}
              onImageSelected={handleAvatarSelected}
              onRemove={() => setProfileImageUrl("")}
              aspectRatio="logo"
              placeholder="Upload Photo"
              showRemove={!!profileImageUrl}
            />
            {avatarUploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.uploadingText, { color: theme.textSecondary }]}>
                  Uploading…
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Display Name ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            DISPLAY NAME
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={theme.textSecondary}
            maxLength={60}
            returnKeyType="next"
            autoCapitalize="words"
          />
        </View>

        {/* ── Bio ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            BIO
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.bioInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people a bit about yourself"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.textSecondary }]}>
            {bio.length}/200
          </Text>
        </View>

        {/* ── Save Button ──────────────────────────────────────────────── */}
        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: busy ? theme.textSecondary : theme.primary },
          ]}
          onPress={handleSave}
          disabled={busy}
        >
          {saving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.saveText}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  avatarRow: {
    alignItems: "flex-start",
  },
  uploadingOverlay: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadingText: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 4,
  },
  bioInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#000000",
    fontWeight: "800",
    fontSize: 15,
  },
});

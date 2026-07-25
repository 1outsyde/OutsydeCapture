import React, { useState, useCallback, useLayoutEffect, useEffect, useRef } from "react";
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
import { useHeaderHeight } from "@react-navigation/elements";
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

const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,30}$/;

type UsernameCheckState = "idle" | "checking" | "available" | "taken" | "invalid";

export default function ConsumerEditProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
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
  const origUsername = user?.username || "";

  // ─── Local editable state seeded from current user ───────────────────────
  const [profileImageUrl, setProfileImageUrl] = useState<string>(origProfileImageUrl);
  const [coverMediaUrl, setCoverMediaUrl] = useState<string>(origCoverMediaUrl);
  const [coverMediaType, setCoverMediaType] = useState<"image" | "video">(origCoverMediaType);
  const [displayName, setDisplayName] = useState<string>(origDisplayName);
  const [bio, setBio] = useState<string>(origBio);
  const [username, setUsername] = useState<string>(origUsername);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Identity change cooldown status ──────────────────────────────────────
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [canChangeDisplayName, setCanChangeDisplayName] = useState(true);
  const [usernameCooldownDays, setUsernameCooldownDays] = useState<number | undefined>(undefined);
  const [displayNameCooldownDays, setDisplayNameCooldownDays] = useState<number | undefined>(undefined);
  const [statusLoading, setStatusLoading] = useState(true);

  // ─── Username availability check state ────────────────────────────────────
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>("idle");
  const usernameCheckSeq = useRef(0);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setStatusLoading(false);
        return;
      }
      try {
        const status = await api.getUserIdentityStatus(token);
        setCanChangeUsername(status.canChangeUsername);
        setCanChangeDisplayName(status.canChangeDisplayName);
        setUsernameCooldownDays(status.usernameCooldownDays);
        setDisplayNameCooldownDays(status.displayNameCooldownDays);
      } catch (error) {
        console.warn("[ConsumerEditProfile] Failed to load identity status:", error);
        // Fail open — allow edits if status check fails, backend still enforces the rule
      } finally {
        setStatusLoading(false);
      }
    })();
  }, [getToken]);

  // ─── Debounced username availability check ────────────────────────────────
  useEffect(() => {
    const trimmed = username.trim();

    if (trimmed === origUsername) {
      setUsernameCheck("idle");
      return;
    }
    if (trimmed.length === 0) {
      setUsernameCheck("idle");
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameCheck("invalid");
      return;
    }

    setUsernameCheck("checking");
    const seq = ++usernameCheckSeq.current;
    const timeout = setTimeout(async () => {
      try {
        const result = await api.checkUsernameAvailable(trimmed);
        if (usernameCheckSeq.current !== seq) return; // stale response
        setUsernameCheck(result.available ? "available" : "taken");
      } catch {
        if (usernameCheckSeq.current !== seq) return;
        setUsernameCheck("idle");
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [username, origUsername]);

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

  // ─── Save: route fields to the correct endpoints ─────────────────────────
  // displayName, username → PATCH /api/users/identity  (updateUserMe silently drops them)
  // bio, avatar, cover → PATCH /api/users/me
  const handleSave = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Error", "Authentication required. Please log in again.");
      return;
    }

    const trimmedUsername = username.trim();
    const displayNameChanged = displayName.trim() !== origDisplayName.trim();
    const usernameChanged = trimmedUsername !== origUsername;

    if (usernameChanged && !canChangeUsername) {
      Alert.alert(
        "Username Locked",
        usernameCooldownDays
          ? `You can change your username again in ${usernameCooldownDays} day${usernameCooldownDays === 1 ? "" : "s"}.`
          : "You recently changed your username. Please try again later.",
      );
      return;
    }
    if (displayNameChanged && !canChangeDisplayName) {
      Alert.alert(
        "Display Name Locked",
        displayNameCooldownDays
          ? `You can change your display name again in ${displayNameCooldownDays} day${displayNameCooldownDays === 1 ? "" : "s"}.`
          : "You recently changed your display name. Please try again later.",
      );
      return;
    }
    if (usernameChanged && usernameCheck === "invalid") {
      Alert.alert("Invalid Username", "Usernames must be 3–30 characters and can only contain letters, numbers, periods, and underscores.");
      return;
    }
    if (usernameChanged && usernameCheck === "taken") {
      Alert.alert("Username Unavailable", "That username is already taken. Please choose another.");
      return;
    }
    if (usernameChanged && usernameCheck === "checking") {
      Alert.alert("Please Wait", "Still checking username availability.");
      return;
    }

    const mePayload: Parameters<typeof api.updateUserMe>[1] = {};
    if (profileImageUrl !== origProfileImageUrl) {
      mePayload.profileImageUrl = profileImageUrl || null;
    }
    if (coverMediaUrl !== origCoverMediaUrl) {
      mePayload.coverMediaUrl = coverMediaUrl || null;
      mePayload.coverMediaType = coverMediaUrl ? coverMediaType : null;
    } else if (coverMediaType !== origCoverMediaType && coverMediaUrl) {
      mePayload.coverMediaType = coverMediaType;
    }
    if (bio.trim() !== origBio.trim()) {
      mePayload.bio = bio.trim();
    }

    const identityPayload: { username?: string; displayName?: string } = {};
    if (displayNameChanged) identityPayload.displayName = displayName.trim();
    if (usernameChanged) identityPayload.username = trimmedUsername;

    const hasIdentityChange = Object.keys(identityPayload).length > 0;
    const hasMeChange = Object.keys(mePayload).length > 0;

    if (!hasIdentityChange && !hasMeChange) {
      navigation.goBack();
      return;
    }

    try {
      setSaving(true);
      console.log("[ConsumerEditProfile] identity payload:", hasIdentityChange ? JSON.stringify(identityPayload) : "no change");
      console.log("[ConsumerEditProfile] me payload:", JSON.stringify(mePayload, null, 2));

      // Run both calls (whichever are needed) before refreshing
      const calls: Promise<any>[] = [];
      if (hasIdentityChange) {
        calls.push(api.updateUserIdentity(token, identityPayload));
      }
      if (hasMeChange) {
        calls.push(api.updateUserMe(token, mePayload));
      }
      await Promise.all(calls);

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
    username,
    usernameCheck,
    canChangeUsername,
    canChangeDisplayName,
    usernameCooldownDays,
    displayNameCooldownDays,
    origProfileImageUrl,
    origCoverMediaUrl,
    origCoverMediaType,
    origDisplayName,
    origBio,
    origUsername,
    refreshUser,
    navigation,
  ]);

  const busy = saving || avatarUploading;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleSave}
          disabled={busy}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [{ opacity: pressed || busy ? 0.5 : 1, paddingHorizontal: 4 }]}
        >
          <Text style={{ color: theme.brandPrimary, fontSize: 16, fontWeight: "600" }}>Save</Text>
        </Pressable>
      ),
    });
  }, [navigation, handleSave, busy, theme]);

  const usernameHint = (() => {
    if (statusLoading) return null;
    if (!canChangeUsername) {
      return usernameCooldownDays
        ? `You can change your username again in ${usernameCooldownDays} day${usernameCooldownDays === 1 ? "" : "s"}.`
        : "You recently changed your username. Please try again later.";
    }
    switch (usernameCheck) {
      case "checking":
        return "Checking availability…";
      case "available":
        return "Username is available";
      case "taken":
        return "That username is already taken";
      case "invalid":
        return "3–30 characters: letters, numbers, periods, underscores only";
      default:
        return "Your unique @handle shown on your profile and posts";
    }
  })();

  const usernameHintColor = (() => {
    if (!canChangeUsername) return theme.brandTextDim;
    switch (usernameCheck) {
      case "available":
        return "#3DBB6B";
      case "taken":
      case "invalid":
        return "#E5484D";
      default:
        return theme.brandTextDim;
    }
  })();

  const displayNameHint = !statusLoading && !canChangeDisplayName
    ? (displayNameCooldownDays
        ? `You can change your display name again in ${displayNameCooldownDays} day${displayNameCooldownDays === 1 ? "" : "s"}.`
        : "You recently changed your display name. Please try again later.")
    : null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.brandBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover Photo / Video ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
            COVER PHOTO / VIDEO
          </Text>
          <Text style={[styles.sectionHint, { color: theme.brandTextDim }]}>
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
            folder="covers"
            aspectRatio="cover"
            placeholder="Upload cover photo or video"
            maxVideoDuration={15}
          />
        </View>

        {/* ── Profile Photo ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.avatarRow}>
            <View>
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
                  <ActivityIndicator color={theme.brandPrimary} />
                  <Text style={[styles.uploadingText, { color: theme.brandTextDim }]}>
                    Uploading…
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.avatarMeta}>
              <Text style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
                PROFILE PHOTO
              </Text>
              <Text style={[styles.sectionHint, { color: theme.brandTextDim }]}>
                Your avatar shown on posts, messages, and search results
              </Text>
            </View>
          </View>
        </View>

        {/* ── Display Name ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
            DISPLAY NAME
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.brandBgElevated,
                color: theme.brandCream,
                borderColor: theme.brandSurfaceBorder,
                opacity: !statusLoading && !canChangeDisplayName ? 0.5 : 1,
              },
            ]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={theme.brandTextDim}
            maxLength={60}
            returnKeyType="next"
            autoCapitalize="words"
            editable={statusLoading || canChangeDisplayName}
          />
          {displayNameHint ? (
            <Text style={[styles.fieldHint, { color: theme.brandTextDim }]}>
              {displayNameHint}
            </Text>
          ) : null}
        </View>

        {/* ── Username ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
            USERNAME
          </Text>
          <View style={styles.usernameInputWrap}>
            <Text style={[styles.usernamePrefix, { color: theme.brandTextDim }]}>@</Text>
            <TextInput
              style={[
                styles.input,
                styles.usernameInput,
                {
                  backgroundColor: theme.brandBgElevated,
                  color: theme.brandCream,
                  borderColor: theme.brandSurfaceBorder,
                  opacity: !statusLoading && !canChangeUsername ? 0.5 : 1,
                },
              ]}
              value={username}
              onChangeText={(text) => setUsername(text.replace(/\s/g, ""))}
              placeholder="username"
              placeholderTextColor={theme.brandTextDim}
              maxLength={30}
              returnKeyType="next"
              autoCapitalize="none"
              autoCorrect={false}
              editable={statusLoading || canChangeUsername}
            />
            {usernameCheck === "checking" ? (
              <ActivityIndicator size="small" color={theme.brandTextDim} style={styles.usernameSpinner} />
            ) : null}
          </View>
          {usernameHint ? (
            <Text style={[styles.fieldHint, { color: usernameHintColor }]}>
              {usernameHint}
            </Text>
          ) : null}
        </View>

        {/* ── Bio ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.bioLabelRow}>
            <Text style={[styles.sectionLabel, { color: theme.brandTextDim }]}>
              BIO
            </Text>
            <Text style={[styles.charCount, { color: theme.brandTextDim }]}>
              {bio.length}/200
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.bioInput,
              {
                backgroundColor: theme.brandBgElevated,
                color: theme.brandCream,
                borderColor: theme.brandSurfaceBorder,
              },
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people a bit about yourself"
            placeholderTextColor={theme.brandTextDim}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
        </View>

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
  fieldHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarMeta: {
    flex: 1,
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
  usernameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  usernamePrefix: {
    position: "absolute",
    left: 14,
    top: 16,
    fontSize: 15,
    zIndex: 1,
  },
  usernameInput: {
    flex: 1,
    paddingLeft: 26,
  },
  usernameSpinner: {
    position: "absolute",
    right: 14,
    top: 16,
  },
  bioInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  bioLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
  },
});

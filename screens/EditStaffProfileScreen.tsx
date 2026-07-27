import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { RootStackParamList } from "@/navigation/types";
import { uploadImage } from "@/services/mediaUpload";
import ImageUploader from "@/components/ImageUploader";
import MediaUploader from "@/components/MediaUploader";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import apiClient from "@/services/api";
import { resolveBrandColor, parseBrandColorSpec } from "@/constants/colorOptions";

const SPECIALTY_OPTIONS = [
  "Nails", "Hair", "Braids", "Locs", "Makeup", "Skincare",
  "Brows", "Lashes", "Waxing", "Beard", "Cuts", "Color",
  "Extensions", "Massage", "Nail Art",
];

export default function EditStaffProfileScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { getToken, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverVideo, setCoverVideo] = useState("");
  const [coverMediaType, setCoverMediaType] = useState<"image" | "video" | null>(null);
  const [accentColor, setAccentColor] = useState("#E8B930");

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setLoading(true);
      const staffRes = await apiClient.getStaffMe(token);
      const staff = staffRes.staff;

      const businessId = staff.businessId || user?.staffBusinessId;
      let resolvedAccent = "#E8B930";
      if (businessId) {
        try {
          const businessRes = await apiClient.getBusiness(businessId);
          resolvedAccent = resolveBrandColor(
            parseBrandColorSpec((businessRes as any).brandColors),
            isDark ? "dark" : "light",
          );
        } catch {
          // keep default
        }
      }
      setAccentColor(resolvedAccent);

      setDisplayName(staff.displayName || "");
      setUsername((staff as any).username || "");
      setTitle((staff as any).title || "");
      setBio(staff.bio || "");
      setSpecialties(staff.specialties || []);
      setCity((staff as any).city || "");
      setState((staff as any).state || "");
      setInstagramHandle((staff as any).instagramHandle || "");
      setProfileImageUrl(staff.profileImageUrl || "");

      const isVideo = (staff as any).coverMediaType === "video";
      if (isVideo) {
        setCoverVideo((staff as any).coverImage || "");
        setCoverImage("");
        setCoverMediaType("video");
      } else {
        setCoverImage((staff as any).coverImage || "");
        setCoverVideo("");
        setCoverMediaType((staff as any).coverImage ? "image" : null);
      }
    } catch (error) {
      console.error("[EditStaffProfile] Failed to fetch staff data:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken, user, isDark]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProfileImageSelected = async (uri: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      setSaving(true);
      const result = await uploadImage(uri, "image/jpeg", "avatars", token);
      setProfileImageUrl(result.url);
    } catch (e: any) {
      Alert.alert("Upload Error", e.message || "Failed to upload image");
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (item: string) => {
    setSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item],
    );
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name is required");
      return;
    }
    const token = await getToken();
    if (!token) return;
    try {
      setSaving(true);
      const finalCoverImage = coverMediaType === "video" ? coverVideo : coverImage;
      await apiClient.updateStaffMe(token, {
        displayName: displayName.trim(),
        username: username.trim().toLowerCase() || undefined,
        title: title.trim() || undefined,
        bio: bio.trim() || undefined,
        specialties,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        instagramHandle: instagramHandle.trim().replace(/^@/, "") || undefined,
        profileImageUrl: profileImageUrl || undefined,
        coverImage: finalCoverImage || undefined,
        coverMediaType: coverMediaType || undefined,
      });
      Alert.alert("Success", "Profile updated", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.brandBg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700",
      color: theme.brandCream,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    card: {
      backgroundColor: theme.brandBgElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.brandCream,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 13,
      color: theme.brandTextDim,
      marginBottom: 12,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.brandCream,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.brandSurface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.brandCream,
      marginBottom: 12,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    saveButton: {
      backgroundColor: theme.brandPrimary,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 8,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.brandPrimaryText,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    flex1: {
      flex: 1,
    },
    helperText: {
      fontSize: 12,
      color: theme.brandTextDim,
      marginTop: -8,
      marginBottom: 12,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.brandSurfaceBorder,
      backgroundColor: theme.brandSurface,
    },
    chipActive: {
      borderColor: accentColor,
      backgroundColor: `${accentColor}22`,
    },
    chipText: {
      fontSize: 13,
      color: theme.brandTextDim,
    },
    chipTextActive: {
      color: accentColor,
      fontWeight: "600",
    },
    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.brandBg,
    },
  });

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.brandGold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={24} color={theme.brandCream} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScreenKeyboardAwareScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>

          {/* Section 1 — Media */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile Photo</Text>
            <Text style={styles.cardDesc}>Your public profile picture</Text>
            <View style={{ alignItems: "center" }}>
              <ImageUploader
                currentImage={profileImageUrl || undefined}
                onImageSelected={handleProfileImageSelected}
                onRemove={() => setProfileImageUrl("")}
                aspectRatio="logo"
                placeholder="Upload Photo"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cover Media</Text>
            <Text style={styles.cardDesc}>Banner image or short video for your profile</Text>
            <MediaUploader
              currentImage={coverImage || undefined}
              currentVideo={coverVideo || undefined}
              currentMediaType={coverMediaType}
              folder="covers"
              maxVideoDuration={15}
              onMediaUploaded={async (url, mediaType) => {
                if (mediaType === "video") {
                  setCoverVideo(url);
                  setCoverImage("");
                  setCoverMediaType("video");
                } else {
                  setCoverImage(url);
                  setCoverVideo("");
                  setCoverMediaType("image");
                }
              }}
              onRemove={() => {
                setCoverImage("");
                setCoverVideo("");
                setCoverMediaType(null);
              }}
            />
          </View>

          {/* Section 2 — Identity */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identity</Text>

            <Text style={styles.inputLabel}>Display Name *</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={theme.brandTextDim}
            />

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              placeholder="yourhandle"
              placeholderTextColor={theme.brandTextDim}
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>Letters and numbers only, no spaces</Text>

            <Text style={styles.inputLabel}>Title / Role</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Senior Nail Tech, Lead Stylist"
              placeholderTextColor={theme.brandTextDim}
            />
          </View>

          {/* Section 3 — About */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell clients about yourself…"
              placeholderTextColor={theme.brandTextDim}
              multiline
            />

            <Text style={styles.inputLabel}>Specialties</Text>
            <View style={styles.chipGrid}>
              {SPECIALTY_OPTIONS.map((item) => {
                const active = specialties.includes(item);
                return (
                  <Pressable
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSpecialty(item)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Section 4 — Location */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location</Text>
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor={theme.brandTextDim}
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.input}
                  value={state}
                  onChangeText={setState}
                  placeholder="State"
                  placeholderTextColor={theme.brandTextDim}
                />
              </View>
            </View>
          </View>

          {/* Section 5 — Social */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Social</Text>

            <Text style={styles.inputLabel}>Instagram Handle</Text>
            <TextInput
              style={styles.input}
              value={instagramHandle}
              onChangeText={setInstagramHandle}
              placeholder="yourhandle"
              placeholderTextColor={theme.brandTextDim}
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>Just your handle, no @ needed</Text>
          </View>

          <Pressable
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.brandPrimaryText} />
            ) : (
              <Text style={styles.saveButtonText}>Save Profile</Text>
            )}
          </Pressable>
        </View>
      </ScreenKeyboardAwareScrollView>
    </View>
  );
}

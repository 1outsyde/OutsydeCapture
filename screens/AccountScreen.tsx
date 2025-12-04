import React, { useState } from "react";
import { StyleSheet, View, Pressable, Alert, TextInput } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList, AccountStackParamList } from "@/navigation/types";
import { useNotifications } from "@/context/NotificationContext";
import { CompositeNavigationProp } from "@react-navigation/native";

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<AccountStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function AccountScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const { unreadCount } = useNotifications();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    await updateProfile({
      name: editName,
      phone: editPhone,
    });
    setIsEditing(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Deletion",
              "This will permanently delete all your data. Are you absolutely sure?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: async () => {
                    await logout();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.authContainer}>
        <View style={styles.authContent}>
          <Feather name="camera" size={64} color={theme.primary} />
          <ThemedText type="h2" style={styles.authTitle}>
            Welcome to Outsyde
          </ThemedText>
          <ThemedText type="body" style={[styles.authSubtitle, { color: theme.textSecondary }]}>
            Sign in to book photographers, manage sessions, and more
          </ThemedText>
          <Button
            onPress={() => navigation.navigate("Auth")}
            style={styles.authButton}
          >
            Sign In or Sign Up
          </Button>
        </View>
      </ScreenKeyboardAwareScrollView>
    );
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <Feather name="user" size={40} color={theme.textSecondary} />
          )}
        </View>
        {!isEditing ? (
          <>
            <ThemedText type="h2" style={styles.userName}>
              {user?.name}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {user?.email}
            </ThemedText>
          </>
        ) : null}
      </View>

      {isEditing ? (
        <View style={styles.editSection}>
          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Name
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Phone
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Phone number"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.editButtons}>
            <Pressable
              onPress={() => {
                setEditName(user?.name || "");
                setEditPhone(user?.phone || "");
                setIsEditing(false);
              }}
              style={({ pressed }) => [
                styles.cancelButton,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="button">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSaveProfile}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                Save Changes
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Account
            </ThemedText>
            
            <Pressable
              onPress={() => setIsEditing(true)}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="edit-2" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.menuItemText}>
                  Edit Profile
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Notifications")}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="bell" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.menuItemText}>
                  Notifications
                </ThemedText>
                {unreadCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="map-pin" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.menuItemText}>
                  Location Preferences
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Support
            </ThemedText>
            
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="help-circle" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.menuItemText}>
                  Help Center
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="file-text" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.menuItemText}>
                  Terms of Service
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="shield" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.menuItemText}>
                  Privacy Policy
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="log-out" size={20} color={theme.error} />
                <ThemedText type="body" style={[styles.menuItemText, { color: theme.error }]}>
                  Log Out
                </ThemedText>
              </View>
            </Pressable>

            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Feather name="trash-2" size={20} color={theme.error} />
                <ThemedText type="body" style={[styles.menuItemText, { color: theme.error }]}>
                  Delete Account
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </>
      )}
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  authContent: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  authTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  authSubtitle: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  authButton: {
    width: "100%",
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    marginLeft: Spacing.md,
  },
  editSection: {
    marginBottom: Spacing.xl,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
  },
  editButtons: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  saveButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: Spacing.sm,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

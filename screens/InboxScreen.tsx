import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { InboxToggle, InboxMode } from "@/components/InboxToggle";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import NotificationsScreen from "@/screens/NotificationsScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import StoriesBar from "@/components/StoriesBar";

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [mode, setMode] = useState<InboxMode>("activity");
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const storiesBarHeight = useSharedValue(96);

  const storiesBarAnimatedStyle = useAnimatedStyle(() => ({
    height: storiesBarHeight.value,
    overflow: "hidden",
  }));

  const handleStoriesVisibilityChange = (visible: boolean) => {
    storiesBarHeight.value = withTiming(visible ? 96 : 0, { duration: 250 });
  };

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.brandScreen }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <ThemedText type="h2">Inbox</ThemedText>
        {/* Activity redesign step 2: notification settings moved off the Activity list. */}
        <Pressable
          onPress={() => navigation.navigate("NotificationSettings")}
          style={[styles.gear, { backgroundColor: theme.brandCard }]}
          accessibilityRole="button"
          accessibilityLabel="Notification settings"
        >
          <Ionicons name="settings" size={22} color={theme.text} />
        </Pressable>
      </View>
      <Animated.View style={storiesBarAnimatedStyle}>
        <StoriesBar onVisibilityChange={handleStoriesVisibilityChange} />
      </Animated.View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <InboxToggle mode={mode} onModeChange={setMode} />
      <View style={styles.content}>
        {mode === "activity" ? <NotificationsScreen /> : <MessagesScreen />}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth },
  content: {
    flex: 1,
  },
});

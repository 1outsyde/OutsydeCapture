import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
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

  const storiesBarHeight = useSharedValue(96);

  const storiesBarAnimatedStyle = useAnimatedStyle(() => ({
    height: storiesBarHeight.value,
    overflow: "hidden",
  }));

  const handleStoriesVisibilityChange = (visible: boolean) => {
    storiesBarHeight.value = withTiming(visible ? 96 : 0, { duration: 250 });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <ThemedText type="h2">Inbox</ThemedText>
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
  },
  divider: { height: StyleSheet.hairlineWidth },
  content: {
    flex: 1,
  },
});

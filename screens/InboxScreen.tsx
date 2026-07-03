import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { InboxToggle, InboxMode } from "@/components/InboxToggle";
import { Spacing } from "@/constants/theme";
import NotificationsScreen from "@/screens/NotificationsScreen";
import MessagesScreen from "@/screens/MessagesScreen";

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<InboxMode>("activity");

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <ThemedText type="h2">Inbox</ThemedText>
      </View>
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
  content: {
    flex: 1,
  },
});

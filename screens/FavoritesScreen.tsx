/**
 * The Saved screen (route "Favorites", kept so Settings and the `favorites` push link still land here).
 * Same content as the profile Saved tab: posts, businesses, photographers and products on the account.
 */
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import SavedCollection from "@/components/SavedCollection";
import { Spacing } from "@/constants/theme";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <SavedCollection horizontalPadding={Spacing.lg} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

/**
 * A card on the quote screens (restyle, Nov 2026): raised green black with real padding, on brandBg.
 * Used by QuoteScreen and RequestQuoteScreen in place of the event host Box, which is built for pick lists
 * whose rows bring their own padding (plain rows touched its edges). Box itself is unchanged.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export function QuoteCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.brandBgElevated,
          borderColor: theme.brandSurfaceBorder,
        },
      ]}
      accessibilityLabel={title}
    >
      {title ? (
        <ThemedText style={[styles.title, { color: theme.brandTextDim }]}>
          {title.toUpperCase()}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: Spacing.md,
    gap: 10,
  },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});

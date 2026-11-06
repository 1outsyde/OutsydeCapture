// A quote or request card in a chat (Quotes step 6c-1, calls 2 and 3). What it shows and which buttons come from
// utils/quoteLogic.ts cardView: the card's own data plus the quote as it is now, so an old card never offers a step
// that is already done. Buttons open the quote screen, which runs the step.
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import {
  cardView,
  type Card,
  type Quote,
  type Start,
} from "@/utils/quoteLogic";

export default function QuoteChatCard({
  card,
  live,
  loading,
  isCustomer,
  width,
  onStart,
}: {
  card: Card;
  live: Quote | null;
  loading: boolean;
  isCustomer: boolean;
  width: number;
  onStart: (start: Start) => void;
}) {
  const { theme } = useTheme();
  const v = cardView(card, live, { isCustomer });
  return (
    <View
      style={[
        styles.card,
        {
          width,
          backgroundColor: theme.brandBgElevated,
          borderColor: theme.brandSurfaceBorder,
        },
      ]}
      accessible={false}
    >
      <View style={styles.top}>
        <ThemedText
          style={[
            styles.pill,
            { color: theme.brandGold, borderColor: theme.brandGold },
          ]}
        >
          {v.pill}
        </ThemedText>
        {loading && !live && card.type !== "request" ? (
          <ActivityIndicator size="small" color={theme.brandTextDim} />
        ) : null}
      </View>
      {v.title ? (
        <ThemedText style={[styles.title, { color: theme.brandCream }]}>
          {v.title}
        </ThemedText>
      ) : null}
      {v.when ? (
        <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
          {v.when}
        </ThemedText>
      ) : null}
      {v.amount ? (
        <ThemedText style={[styles.amount, { color: theme.brandCream }]}>
          {v.amount}
        </ThemedText>
      ) : null}
      {v.body ? (
        <ThemedText style={[styles.body, { color: theme.brandCream }]}>
          {v.body}
        </ThemedText>
      ) : null}
      {v.note ? (
        <ThemedText style={[styles.dim, { color: theme.brandTextDim }]}>
          {v.note}
        </ThemedText>
      ) : null}
      {v.buttons.length ? (
        <View style={styles.buttons}>
          {v.buttons.map((b) => (
            <Pressable
              key={b.start}
              onPress={() => onStart(b.start)}
              accessibilityRole="button"
              accessibilityLabel={b.label}
              style={({ pressed }) => [
                styles.btn,
                b.primary
                  ? {
                      backgroundColor: theme.brandGold,
                      borderColor: theme.brandGold,
                    }
                  : {
                      backgroundColor: "transparent",
                      borderColor: theme.brandSurfaceBorder,
                    },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ThemedText
                style={[
                  styles.btnText,
                  { color: b.primary ? "#0B0B0B" : theme.brandCream },
                ]}
              >
                {b.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md - 2,
    gap: 6,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  title: { fontSize: 16, fontWeight: "700" },
  amount: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  dim: { fontSize: 13, lineHeight: 18 },
  buttons: { gap: Spacing.sm, marginTop: Spacing.xs },
  btn: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  btnText: { fontSize: 15, fontWeight: "700" },
});

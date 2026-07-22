import React from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { SavedCard } from "@/services/api";

export interface SavedCardSelectorProps {
  cards: SavedCard[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onAddNewCard: () => void;
  onDeleteCard: (cardId: string) => void;
}

function brandLabel(brand: string): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    jcb: "JCB",
    unionpay: "UnionPay",
    diners: "Diners",
  };
  return map[brand.toLowerCase()] ?? "Card";
}

export default function SavedCardSelector({
  cards,
  selectedCardId,
  onSelectCard,
  onAddNewCard,
  onDeleteCard,
}: SavedCardSelectorProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      marginBottom: Spacing.xs,
      backgroundColor: theme.brandSurface,
      gap: Spacing.sm,
    },
    cardRowSelected: {
      borderColor: theme.brandGold,
      backgroundColor: theme.brandGold + "10",
    },
    cardInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    brandBadge: {
      backgroundColor: theme.brandGold + "20",
      borderRadius: BorderRadius.xs,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.brandSurfaceBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: theme.brandGold,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.brandGold,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.brandSurfaceBorder,
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    deleteBtn: {
      padding: Spacing.xs,
    },
  });

  const handleDelete = (card: SavedCard) => {
    Alert.alert(
      "Remove Card",
      `Remove ${brandLabel(card.brand)} •••• ${card.last4}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => onDeleteCard(card.id) },
      ]
    );
  };

  return (
    <View>
      {cards.map((card) => {
        const selected = card.id === selectedCardId;
        const expMonth = String(card.expMonth).padStart(2, "0");
        const expYear = String(card.expYear).slice(-2);

        return (
          <Pressable
            key={card.id}
            style={[styles.cardRow, selected && styles.cardRowSelected]}
            onPress={() => onSelectCard(card.id)}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioDot} />}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.brandBadge}>
                <ThemedText type="caption" style={{ color: theme.brandGold, fontWeight: "600" }}>
                  {brandLabel(card.brand)}
                </ThemedText>
              </View>
              <ThemedText type="body">•••• {card.last4}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                {expMonth}/{expYear}
              </ThemedText>
            </View>

            <Pressable
              style={styles.deleteBtn}
              hitSlop={8}
              onPress={() => handleDelete(card)}
            >
              <Feather name="trash-2" size={16} color={theme.brandError} />
            </Pressable>
          </Pressable>
        );
      })}

      <Pressable style={styles.addRow} onPress={onAddNewCard}>
        <Feather name="plus-circle" size={18} color={theme.brandGold} />
        <ThemedText type="body" style={{ color: theme.brandGold }}>
          Add new card
        </ThemedText>
      </Pressable>
    </View>
  );
}

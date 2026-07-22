import React from "react";
import { StyleSheet, Switch, View } from "react-native";
import { CardField, CardFieldInput } from "@stripe/stripe-react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

export interface CardInputFormProps {
  onCardComplete: (complete: boolean) => void;
  saveCard: boolean;
  onSaveToggle?: (save: boolean) => void;
}

export default function CardInputForm({
  onCardComplete,
  saveCard,
  onSaveToggle,
}: CardInputFormProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    fieldWrapper: {
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      borderRadius: BorderRadius.md,
      backgroundColor: theme.brandSurface,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    cardField: {
      height: 48,
    },
    saveRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
  });

  const handleCardChange = (details: CardFieldInput.Details) => {
    onCardComplete(details.complete);
  };

  return (
    <View>
      <View style={styles.fieldWrapper}>
        <CardField
          postalCodeEnabled={true}
          style={styles.cardField}
          cardStyle={{
            backgroundColor: "transparent",
            textColor: theme.brandCream,
            placeholderColor: theme.brandTextDim,
            borderColor: "transparent",
          }}
          onCardChange={handleCardChange}
        />
      </View>

      {onSaveToggle && (
        <View style={styles.saveRow}>
          <ThemedText type="body" style={{ color: theme.brandTextDim }}>
            Save card for future purchases
          </ThemedText>
          <Switch
            value={saveCard}
            onValueChange={onSaveToggle}
            trackColor={{ false: theme.brandSurfaceBorder, true: theme.brandGold }}
            thumbColor={saveCard ? theme.brandPrimaryText : theme.brandTextDim}
          />
        </View>
      )}
    </View>
  );
}

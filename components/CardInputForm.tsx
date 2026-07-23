import React from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import { CardField, CardFieldInput } from "@stripe/stripe-react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

export interface CardInputFormProps {
  onCardComplete: (complete: boolean) => void;
  saveCard: boolean;
  onSaveToggle: (save: boolean) => void;
  cardholderName: string;
  onCardholderNameChange: (name: string) => void;
}

export default function CardInputForm({
  onCardComplete,
  saveCard,
  onSaveToggle,
  cardholderName,
  onCardholderNameChange,
}: CardInputFormProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    nameInput: {
      height: 44,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      marginBottom: Spacing.sm,
      fontSize: 14,
      color: theme.brandCream,
      borderColor: theme.brandSurfaceBorder,
      backgroundColor: theme.brandSurface,
    },
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
      <TextInput
        style={styles.nameInput}
        placeholder="Name on card"
        placeholderTextColor={theme.brandTextDim}
        value={cardholderName}
        onChangeText={onCardholderNameChange}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        autoCorrect={false}
      />

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
    </View>
  );
}

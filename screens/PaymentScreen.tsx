import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { usePayment, PaymentMethod } from "@/context/PaymentContext";
import { Spacing, BorderRadius, FontSizes, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "Payment">;

export default function PaymentScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const insets = useSafeAreaInsets();
  const { sessionId, amount, photographerName, sessionDate, subtotalAmount, consumerServiceFeeAmount, taxAmount } = route.params;
  const {
    paymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    processPayment,
    getDefaultPaymentMethod,
  } = usePayment();

  const [isAddingCard, setIsAddingCard] = useState(paymentMethods.length === 0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardholderName, setCardholderName] = useState("");

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ").substring(0, 19) : "";
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + "/" + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const getCardBrand = (number: string): string => {
    const cleaned = number.replace(/\s/g, "");
    if (cleaned.startsWith("4")) return "Visa";
    if (cleaned.startsWith("5")) return "Mastercard";
    if (cleaned.startsWith("3")) return "Amex";
    if (cleaned.startsWith("6")) return "Discover";
    return "Card";
  };

  const handleAddCard = async () => {
    const cleanedNumber = cardNumber.replace(/\s/g, "");
    
    if (cleanedNumber.length < 15) {
      Alert.alert("Invalid Card", "Please enter a valid card number");
      return;
    }
    if (expiry.length < 5) {
      Alert.alert("Invalid Expiry", "Please enter a valid expiry date");
      return;
    }
    if (cvc.length < 3) {
      Alert.alert("Invalid CVC", "Please enter a valid CVC");
      return;
    }
    if (!cardholderName.trim()) {
      Alert.alert("Name Required", "Please enter the cardholder name");
      return;
    }

    try {
      const [month, year] = expiry.split("/");
      await addPaymentMethod({
        type: "card",
        last4: cleanedNumber.slice(-4),
        brand: getCardBrand(cleanedNumber),
        expiryMonth: parseInt(month),
        expiryYear: 2000 + parseInt(year),
        isDefault: true,
      });
      
      setCardNumber("");
      setExpiry("");
      setCvc("");
      setCardholderName("");
      setIsAddingCard(false);
    } catch (error) {
      Alert.alert("Error", "Failed to add payment method");
    }
  };

  const handlePayment = async () => {
    const defaultMethod = getDefaultPaymentMethod();
    
    if (!defaultMethod) {
      Alert.alert("No Payment Method", "Please add a payment method first");
      return;
    }

    setIsProcessing(true);
    try {
      await processPayment(
        sessionId,
        amount,
        `Photography session with ${photographerName}`
      );
      
      Alert.alert(
        "Payment Successful",
        `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
        [
          {
            text: "View Session",
            onPress: () => {
              navigation.goBack();
              navigation.navigate("SessionDetail", { sessionId });
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Payment Failed",
        "There was an issue processing your payment. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveCard = (methodId: string) => {
    Alert.alert(
      "Remove Card",
      "Are you sure you want to remove this payment method?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removePaymentMethod(methodId),
        },
      ]
    );
  };

  const renderPaymentMethod = (method: PaymentMethod) => (
    <Card key={method.id} style={styles.paymentMethodCard}>
      <Pressable
        style={styles.paymentMethodContent}
        onPress={() => setDefaultPaymentMethod(method.id)}
      >
        <View style={styles.paymentMethodLeft}>
          <View
            style={[
              styles.radioOuter,
              {
                borderColor: method.isDefault ? theme.primary : theme.textSecondary,
              },
            ]}
          >
            {method.isDefault ? (
              <View
                style={[styles.radioInner, { backgroundColor: theme.primary }]}
              />
            ) : null}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardBrandRow}>
              <Feather name="credit-card" size={20} color={theme.text} />
              <ThemedText type="bodyBold" style={styles.cardBrand}>
                {method.brand}
              </ThemedText>
            </View>
            <ThemedText type="caption" color="secondary">
              **** **** **** {method.last4}
            </ThemedText>
            {method.expiryMonth && method.expiryYear ? (
              <ThemedText type="caption" color="secondary">
                Expires {method.expiryMonth}/{method.expiryYear.toString().slice(-2)}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => handleRemoveCard(method.id)}
          hitSlop={8}
          style={styles.removeButton}
        >
          <Feather name="trash-2" size={18} color={theme.error} />
        </Pressable>
      </Pressable>
    </Card>
  );

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.surfaceSecondary,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  const styles = StyleSheet.create({
    container: {
      padding: Spacing.md,
      gap: Spacing.lg,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      marginBottom: Spacing.xs,
    },
    summaryCard: {
      padding: Spacing.lg,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: Spacing.xs,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: Spacing.sm,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: Spacing.sm,
    },
    paymentMethodCard: {
      padding: Spacing.md,
    },
    paymentMethodContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    paymentMethodLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      flex: 1,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    cardInfo: {
      gap: Spacing.xxs,
    },
    cardBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    cardBrand: {
      marginLeft: Spacing.xs,
    },
    removeButton: {
      padding: Spacing.sm,
    },
    addCardButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.primary,
      gap: Spacing.sm,
    },
    addCardForm: {
      gap: Spacing.md,
    },
    inputLabel: {
      marginBottom: Spacing.xs,
    },
    input: {
      height: 50,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      fontSize: FontSizes.md,
      borderWidth: 1,
    },
    row: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    halfInput: {
      flex: 1,
    },
    formButtons: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    cancelButton: {
      flex: 1,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.full,
      backgroundColor: theme.surfaceSecondary,
    },
    saveButton: {
      flex: 1,
    },
    payButton: {
      marginTop: Spacing.md,
    },
    secureNote: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    processingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
    },
    processingCard: {
      padding: Spacing.xl,
      alignItems: "center",
      gap: Spacing.md,
      minWidth: 200,
    },
  });

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: theme.backgroundRoot }} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Order Summary
          </ThemedText>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <ThemedText type="body">Photographer</ThemedText>
              <ThemedText type="bodyBold">{photographerName}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText type="body">Session Date</ThemedText>
              <ThemedText type="body" color="secondary">
                {sessionDate}
              </ThemedText>
            </View>
            <View style={styles.divider} />
            {subtotalAmount != null ? (
              <View style={styles.summaryRow}>
                <ThemedText type="body">Subtotal</ThemedText>
                <ThemedText type="body">${subtotalAmount.toFixed(2)}</ThemedText>
              </View>
            ) : null}
            {consumerServiceFeeAmount != null ? (
              <View style={styles.summaryRow}>
                <ThemedText type="body">Outsyde Service Fee</ThemedText>
                <ThemedText type="body">${consumerServiceFeeAmount.toFixed(2)}</ThemedText>
              </View>
            ) : null}
            {taxAmount != null ? (
              <View style={styles.summaryRow}>
                <ThemedText type="body">Sales Tax</ThemedText>
                <ThemedText type="body">${taxAmount.toFixed(2)}</ThemedText>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <ThemedText type="h4">Total</ThemedText>
              <ThemedText type="h3" style={{ color: theme.primary }}>
                ${amount.toFixed(2)}
              </ThemedText>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Payment Method
          </ThemedText>

          {paymentMethods.map(renderPaymentMethod)}

          {isAddingCard ? (
            <Card style={[styles.paymentMethodCard, styles.addCardForm]}>
              <View>
                <ThemedText type="caption" style={styles.inputLabel}>
                  Card Number
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={cardNumber}
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>

              <View>
                <ThemedText type="caption" style={styles.inputLabel}>
                  Cardholder Name
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  placeholder="John Doe"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <ThemedText type="caption" style={styles.inputLabel}>
                    Expiry Date
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={expiry}
                    onChangeText={(text) => setExpiry(formatExpiry(text))}
                    placeholder="MM/YY"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.halfInput}>
                  <ThemedText type="caption" style={styles.inputLabel}>
                    CVC
                  </ThemedText>
                  <TextInput
                    style={inputStyle}
                    value={cvc}
                    onChangeText={setCvc}
                    placeholder="123"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.formButtons}>
                {paymentMethods.length > 0 ? (
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setIsAddingCard(false)}
                  >
                    <ThemedText type="button">Cancel</ThemedText>
                  </Pressable>
                ) : null}
                <Button
                  onPress={handleAddCard}
                  style={paymentMethods.length > 0 ? styles.saveButton : undefined}
                >
                  Save Card
                </Button>
              </View>
            </Card>
          ) : (
            <Pressable
              style={styles.addCardButton}
              onPress={() => setIsAddingCard(true)}
            >
              <Feather name="plus" size={20} color={theme.primary} />
              <ThemedText type="body" color="primary">
                Add New Card
              </ThemedText>
            </Pressable>
          )}
        </View>

        <Button
          onPress={handlePayment}
          style={styles.payButton}
          disabled={paymentMethods.length === 0 || isProcessing}
        >
          {isProcessing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
        </Button>

        <View style={styles.secureNote}>
          <Feather name="lock" size={14} color={theme.textSecondary} />
          <ThemedText type="caption" color="secondary">
            Secure payment powered by Stripe
          </ThemedText>
        </View>
      </ScrollView>

      {isProcessing ? (
        <View style={styles.processingOverlay}>
          <Card style={styles.processingCard}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="bodyBold">Processing Payment</ThemedText>
            <ThemedText type="caption" color="secondary">
              Please wait...
            </ThemedText>
          </Card>
        </View>
      ) : null}
    </>
  );
}

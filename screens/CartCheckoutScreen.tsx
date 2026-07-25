import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";

import AddressAutocompleteInput, { AddressFields } from "@/components/AddressAutocompleteInput";
import CardInputForm from "@/components/CardInputForm";
import SavedCardSelector from "@/components/SavedCardSelector";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiPost } from "@/api/client";
import { RootStackParamList } from "@/navigation/types";
import {
  getPaymentMethods,
  getSavedAddresses,
  createSetupIntent,
  deletePaymentMethod,
  createSavedAddress,
  type SavedCard,
  type SavedAddress,
} from "@/services/api";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FeeBreakdown {
  basePriceCents: number;
  consumerUpchargeCents: number;
  vendorPayoutCents: number;
  platformFeeCents: number;
  totalChargedToConsumerCents: number;
  outsydePointsEarned: number;
}

const RETURN_URL = "outsyde://checkout-return";

export default function CartCheckoutScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { items: cart, removeVendorItems, subtotal } = useCart();
  const { confirmPayment, confirmSetupIntent } = useStripe();

  // ─── Saved cards ──────────────────────────────────────────────────────────
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [isNewCardComplete, setIsNewCardComplete] = useState(false);
  const [saveNewCard, setSaveNewCard] = useState(true);
  const [cardholderName, setCardholderName] = useState("");

  // ─── Saved addresses ──────────────────────────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<AddressFields>({
    line1: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [saveNewAddress, setSaveNewAddress] = useState(true);

  // ─── Checkout state ───────────────────────────────────────────────────────
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [backendFeeBreakdown, setBackendFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  // ─── Load saved cards + addresses on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPaymentData() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const [pmResult, addrResult] = await Promise.all([
          getPaymentMethods(token).catch(() => ({ paymentMethods: [], defaultPaymentMethodId: null })),
          getSavedAddresses(token).catch(() => ({ addresses: [] })),
        ]);

        if (cancelled) return;

        setSavedCards(pmResult.paymentMethods);
        if (pmResult.paymentMethods.length > 0) {
          const defaultCard = pmResult.paymentMethods.find((c) => c.isDefault) ?? pmResult.paymentMethods[0];
          setSelectedCardId(defaultCard.id);
          setUseNewCard(false);
        } else {
          setUseNewCard(true);
        }

        setSavedAddresses(addrResult.addresses);
        if (addrResult.addresses.length > 0) {
          const defaultAddr = addrResult.addresses.find((a) => a.isDefault) ?? addrResult.addresses[0];
          setSelectedAddressId(defaultAddr.id);
          setUseNewAddress(false);
        } else {
          setUseNewAddress(true);
        }
      } finally {
        if (!cancelled) {
          setCardsLoading(false);
          setAddressesLoading(false);
        }
      }
    }

    loadPaymentData();
    return () => { cancelled = true; };
  }, [getToken]);

  // ─── Derived flags ────────────────────────────────────────────────────────
  const hasNewAddressFields =
    shippingAddress.line1.trim().length > 0 &&
    shippingAddress.city.trim().length > 0 &&
    shippingAddress.state.trim().length > 0 &&
    shippingAddress.zipCode.trim().length > 0;

  const hasShippingAddress =
    (!useNewAddress && selectedAddressId !== null) ||
    (useNewAddress && hasNewAddressFields);

  const hasPaymentMethod =
    (!useNewCard && selectedCardId !== null) ||
    (useNewCard && isNewCardComplete && cardholderName.trim().length > 0);

  const confirmDisabled =
    cart.length === 0 ||
    !hasShippingAddress ||
    !hasPaymentMethod ||
    checkoutLoading ||
    cardsLoading ||
    addressesLoading;

  // ─── Price computation ────────────────────────────────────────────────────
  const clientServiceFee = useMemo(() => (subtotal / 100) * 0.08, [subtotal]);
const clientTotal = useMemo(() => (subtotal / 100) * 1.08, [subtotal]);
const clientPointsRate = 0.04; // matches backend points-earning rate, separate from the 8% consumer fee
const clientPoints = useMemo(() => Math.round((subtotal / 100) * clientPointsRate * 100), [subtotal]);

  const displayedSubtotal = backendFeeBreakdown ? backendFeeBreakdown.basePriceCents / 100 : subtotal / 100;
  const displayedServiceFee = backendFeeBreakdown ? backendFeeBreakdown.consumerUpchargeCents / 100 : clientServiceFee;
  const displayedTotal = backendFeeBreakdown ? backendFeeBreakdown.totalChargedToConsumerCents / 100 : clientTotal;
  const displayedPoints = backendFeeBreakdown ? backendFeeBreakdown.outsydePointsEarned : clientPoints;

  // ─── Delete saved card ────────────────────────────────────────────────────
  const handleDeleteCard = useCallback(async (cardId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await deletePaymentMethod(token, cardId);
      setSavedCards((prev) => {
        const updated = prev.filter((c) => c.id !== cardId);
        if (selectedCardId === cardId) {
          if (updated.length > 0) {
            setSelectedCardId(updated[0].id);
          } else {
            setSelectedCardId(null);
            setUseNewCard(true);
          }
        }
        return updated;
      });
    } catch {
      Alert.alert("Could not remove card. Please try again.");
    }
  }, [getToken, selectedCardId]);

  // ─── Resolve shipping address for the PI call ─────────────────────────────
  const resolveShippingAddress = () => {
    if (!useNewAddress && selectedAddressId) {
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (addr) {
        return { line1: addr.line1, city: addr.city, state: addr.state, zipCode: addr.zipCode };
      }
    }
    return {
      line1: shippingAddress.line1.trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      zipCode: shippingAddress.zipCode.trim(),
    };
  };

  // ─── Checkout ─────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (confirmDisabled) return;
    setCardError(null);

    const token = await getToken();
    if (!token) { Alert.alert("Checkout failed. Please try again."); return; }

    setCheckoutLoading(true);
    try {
      // Step 1 — Create PaymentIntent
      const resolvedAddress = resolveShippingAddress();
      const paymentIntentResponse = await apiPost(
        "/api/cart/payment-intent",
        {
          items: cart.map((item) => ({
            productId: item.productId,
            vendorId: item.vendorId,
            priceCents: item.price,
            quantity: item.quantity,
            name: item.name,
          })),
          shippingAddress: resolvedAddress,
        },
        token
      ) as { clientSecret?: string; feeBreakdown?: FeeBreakdown };

      const clientSecret = paymentIntentResponse?.clientSecret;
      const feeBreakdown = paymentIntentResponse?.feeBreakdown ?? null;
      setBackendFeeBreakdown(feeBreakdown);
      if (!clientSecret) throw new Error("Missing clientSecret");

      // Step 2 — Confirm payment
      let resolvedPaymentMethodId: string | undefined;

      if (useNewCard && saveNewCard) {
        // Vault the new card via SetupIntent first
        const siResponse = await createSetupIntent(token);
        if (!siResponse?.clientSecret) throw new Error("Missing SetupIntent clientSecret");

        const { setupIntent, error: siError } = await confirmSetupIntent(siResponse.clientSecret, {
          paymentMethodType: "Card",
        });
        if (siError) {
          setCardError(siError.message ?? "Card setup failed.");
          return;
        }
        resolvedPaymentMethodId = (setupIntent as any)?.paymentMethodId ?? undefined;

        // Refresh saved cards list in background after vaulting
        getPaymentMethods(token).then((result) => {
          setSavedCards(result.paymentMethods);
        }).catch(() => {});
      }

      const billingDetails = { name: cardholderName.trim() };
      const paymentData: any = resolvedPaymentMethodId
        ? {
            paymentMethodType: "Card",
            paymentMethodData: { paymentMethodId: resolvedPaymentMethodId, billingDetails },
          }
        : useNewCard
        ? { paymentMethodType: "Card", paymentMethodData: { billingDetails } }
        : {
            paymentMethodType: "Card",
            paymentMethodData: { paymentMethodId: selectedCardId!, billingDetails },
          };

      const { paymentIntent, error: piError } = await confirmPayment(
        clientSecret,
        paymentData,
        { returnURL: RETURN_URL }
      );

      if (piError) {
        if ((piError as any)?.code === "Canceled") {
          Alert.alert("Payment cancelled.");
          return;
        }
        setCardError(piError.message ?? "Payment failed. Please try again.");
        return;
      }

      if (!paymentIntent) throw new Error("Payment not confirmed");

      // Step 3 — Post-payment cleanup
      if (useNewAddress && saveNewAddress && hasNewAddressFields) {
        createSavedAddress(token, {
          line1: shippingAddress.line1.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          zipCode: shippingAddress.zipCode.trim(),
          isDefault: savedAddresses.length === 0,
        }).catch(() => {});
      }

      const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
      const totalCharged = feeBreakdown?.totalChargedToConsumerCents ?? 0;
      const pointsEarned = feeBreakdown?.outsydePointsEarned ?? 0;
      Array.from(new Set(cart.map(i => i.vendorId))).forEach(vid => removeVendorItems(vid));
      setBackendFeeBreakdown(null);
      navigation.navigate("OrderSuccess", { itemCount, totalCharged, pointsEarned });
    } catch {
      Alert.alert("Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.brandBg,
    },
    header: {
      paddingTop: insets.top + Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.brandSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: insets.bottom + Spacing["2xl"],
    },
    sectionLabel: {
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    cartItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.brandSurfaceBorder,
    },
    cartIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandGold + "1A",
    },
    cartInfo: { flex: 1, gap: 2 },
    card: {
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: theme.brandSurface,
      borderWidth: 1,
      borderColor: theme.brandSurfaceBorder,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.xs,
    },
    savedAddrRow: {
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
    savedAddrRowSelected: {
      borderColor: theme.brandGold,
      backgroundColor: theme.brandGold + "10",
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
    addAddrRow: {
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
    saveToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    loadingSection: {
      alignItems: "center",
      paddingVertical: Spacing.md,
    },
    cardErrorText: {
      color: theme.brandError,
      marginTop: Spacing.sm,
    },
    checkoutButton: {
      marginTop: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      gap: Spacing.sm,
    },
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={18} color={theme.brandCream} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>Checkout</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order summary */}
        <ThemedText type="h4" style={styles.sectionLabel}>Order Summary</ThemedText>
        {cart.map((item) => (
          <View key={item.productId} style={styles.cartItem}>
            <View style={styles.cartIcon}>
              <Feather name="package" size={20} color={theme.brandGold} />
            </View>
            <View style={styles.cartInfo}>
              <ThemedText type="h4" numberOfLines={1}>{item.name}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                ${(item.price / 100).toFixed(2)} each
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              ×{item.quantity}
            </ThemedText>
          </View>
        ))}

        {/* Shipping address */}
        <ThemedText type="h4" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
          Shipping Address
        </ThemedText>
        <View style={styles.card}>
          {addressesLoading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={theme.brandGold} />
            </View>
          ) : savedAddresses.length > 0 ? (
            <>
              {savedAddresses.map((addr) => {
                const selected = !useNewAddress && addr.id === selectedAddressId;
                return (
                  <Pressable
                    key={addr.id}
                    style={[styles.savedAddrRow, selected && styles.savedAddrRowSelected]}
                    onPress={() => { setSelectedAddressId(addr.id); setUseNewAddress(false); }}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      {addr.label ? (
                        <ThemedText type="caption" style={{ color: theme.brandGold, marginBottom: 2 }}>
                          {addr.label}
                        </ThemedText>
                      ) : null}
                      <ThemedText type="body" numberOfLines={1}>{addr.line1}</ThemedText>
                      <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                        {addr.city}, {addr.state} {addr.zipCode}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                style={styles.addAddrRow}
                onPress={() => { setUseNewAddress(true); setSelectedAddressId(null); }}
              >
                <Feather name="plus-circle" size={18} color={theme.brandGold} />
                <ThemedText type="body" style={{ color: theme.brandGold }}>
                  Add new address
                </ThemedText>
              </Pressable>

              {useNewAddress && (
                <View style={{ marginTop: Spacing.sm }}>
                  <AddressAutocompleteInput
                    line1={shippingAddress.line1}
                    city={shippingAddress.city}
                    state={shippingAddress.state}
                    zipCode={shippingAddress.zipCode}
                    onChange={(fields) => setShippingAddress(fields)}
                  />
                  <View style={styles.saveToggleRow}>
                    <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                      Save this address
                    </ThemedText>
                    <Switch
                      value={saveNewAddress}
                      onValueChange={setSaveNewAddress}
                      trackColor={{ false: theme.brandSurfaceBorder, true: theme.brandGold }}
                      thumbColor={saveNewAddress ? theme.brandPrimaryText : theme.brandTextDim}
                    />
                  </View>
                </View>
              )}
            </>
          ) : (
            <>
              <AddressAutocompleteInput
                line1={shippingAddress.line1}
                city={shippingAddress.city}
                state={shippingAddress.state}
                zipCode={shippingAddress.zipCode}
                onChange={(fields) => setShippingAddress(fields)}
              />
              <View style={styles.saveToggleRow}>
                <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                  Save this address
                </ThemedText>
                <Switch
                  value={saveNewAddress}
                  onValueChange={setSaveNewAddress}
                  trackColor={{ false: theme.brandSurfaceBorder, true: theme.brandGold }}
                  thumbColor={saveNewAddress ? theme.brandPrimaryText : theme.brandTextDim}
                />
              </View>
            </>
          )}
        </View>

        {/* Payment */}
        <ThemedText type="h4" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
          Payment
        </ThemedText>
        <View style={styles.card}>
          {cardsLoading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={theme.brandGold} />
            </View>
          ) : savedCards.length > 0 && !useNewCard ? (
            <SavedCardSelector
              cards={savedCards}
              selectedCardId={selectedCardId}
              onSelectCard={(id) => { setSelectedCardId(id); setUseNewCard(false); }}
              onAddNewCard={() => { setUseNewCard(true); setSelectedCardId(null); setCardError(null); }}
              onDeleteCard={handleDeleteCard}
            />
          ) : (
            <>
              {savedCards.length > 0 && (
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}
                  onPress={() => { setUseNewCard(false); setSelectedCardId(savedCards[0].id); setCardError(null); }}
                >
                  <Feather name="arrow-left" size={16} color={theme.brandGold} />
                  <ThemedText type="body" style={{ color: theme.brandGold }}>Use saved card</ThemedText>
                </Pressable>
              )}
              <CardInputForm
                onCardComplete={setIsNewCardComplete}
                saveCard={saveNewCard}
                onSaveToggle={setSaveNewCard}
                cardholderName={cardholderName}
                onCardholderNameChange={setCardholderName}
              />
            </>
          )}

          {cardError !== null && (
            <ThemedText type="body" style={styles.cardErrorText}>
              {cardError}
            </ThemedText>
          )}
        </View>

        {/* Price breakdown */}
        <View style={[styles.card, { marginTop: Spacing.md }]}>
          <View style={styles.row}>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>Subtotal</ThemedText>
            <ThemedText type="body">${displayedSubtotal.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>Outsyde Service Fee</ThemedText>
            <ThemedText type="body">${displayedServiceFee.toFixed(2)}</ThemedText>
          </View>
          <View style={[styles.row, { marginBottom: 0 }]}>
            <ThemedText type="h4">Total</ThemedText>
            <ThemedText type="h4" style={{ color: theme.brandGold }}>${displayedTotal.toFixed(2)}</ThemedText>
          </View>
          <ThemedText type="body" style={{ color: theme.brandSuccess, marginTop: Spacing.xs }}>
            You'll earn {displayedPoints} Outsyde Points
          </ThemedText>
        </View>

        {/* Refund policy disclosure */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: Spacing.md }}>
          <ThemedText type="small" style={{ color: theme.brandTextDim }}>
            {"Orders can be cancelled for a full refund before shipment. Once shipped, all sales are final unless the item arrives damaged or not as described. To report an issue contact info@goutsyde.com within 7 days of delivery. See our full "}
          </ThemedText>
          {/* TODO: Replace with navigation.navigate("RefundPolicyScreen") once that screen is created */}
          <Pressable onPress={() => navigation.navigate("PrivacyPolicy")}>
            <ThemedText type="small" style={{ color: theme.brandPrimary }}>
              {"Refund Policy"}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" style={{ color: theme.brandTextDim }}>{"."}</ThemedText>
        </View>

        {/* Confirm & Pay */}
        <Pressable
          onPress={handleCheckout}
          disabled={confirmDisabled}
          style={({ pressed }) => [
            styles.checkoutButton,
            {
              backgroundColor: confirmDisabled ? theme.brandPrimary + "66" : theme.brandPrimary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {checkoutLoading ? (
            <ActivityIndicator size="small" color={theme.brandPrimaryText} />
          ) : (
            <>
              <Feather name="credit-card" size={18} color={theme.brandPrimaryText} />
              <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>Confirm & Pay</ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

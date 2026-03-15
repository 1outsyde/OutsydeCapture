import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { RootStackParamList } from "@/navigation/types";

type RouteType = RouteProp<RootStackParamList, "ShootBooking">;

const BASE_PRICE_CENTS = 30000;

const SHOOT_TYPES = [
  { id: "on-location-product", label: "On-Location Product", desc: "Showcase products in real-world settings", icon: "camera" as const },
  { id: "studio-product", label: "Studio Product", desc: "Clean, professional studio environment", icon: "box" as const },
  { id: "video", label: "Video Shoot", desc: "Motion content for ads, reels, and more", icon: "video" as const },
];

const LOCATIONS = [
  { id: "outdoor", label: "Outdoor", desc: "Natural light, parks, streets, or your storefront", icon: "sun" as const },
  { id: "indoor-lifestyle", label: "Indoor / Lifestyle", desc: "Homes, cafes, or styled interior settings", icon: "home" as const },
  { id: "studio", label: "Studio", desc: "Controlled lighting in a professional studio", icon: "aperture" as const },
];

type PricingOption = "full" | "1credit" | "2credits" | "free";

interface PricingChoice {
  id: PricingOption;
  label: string;
  creditsUsed: number;
  finalCents: number;
  savingsCents: number;
  badge?: string;
  minCredits: number;
}

function getPricingOptions(balance: number): PricingChoice[] {
  const options: PricingChoice[] = [
    {
      id: "full",
      label: "Pay full price",
      creditsUsed: 0,
      finalCents: BASE_PRICE_CENTS,
      savingsCents: 0,
      minCredits: 0,
    },
    {
      id: "1credit",
      label: "Use 1 credit — 30% off",
      creditsUsed: 1,
      finalCents: Math.round(BASE_PRICE_CENTS * 0.7),
      savingsCents: Math.round(BASE_PRICE_CENTS * 0.3),
      minCredits: 1,
    },
    {
      id: "2credits",
      label: "Use 2 credits — 50% off",
      creditsUsed: 2,
      finalCents: Math.round(BASE_PRICE_CENTS * 0.5),
      savingsCents: Math.round(BASE_PRICE_CENTS * 0.5),
      minCredits: 2,
    },
    {
      id: "free",
      label: "Use 3 credits — Free shoot",
      creditsUsed: 3,
      finalCents: 0,
      savingsCents: BASE_PRICE_CENTS,
      badge: "FREE",
      minCredits: 3,
    },
  ];
  return options.filter((o) => o.minCredits <= balance);
}

function formatDollars(cents: number) {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

export default function ShootBookingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteType>();
  const { businessId, creditBalance } = route.params;
  const { getToken } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [shootType, setShootType] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [pricingOption, setPricingOption] = useState<PricingOption>("full");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [newBalance, setNewBalance] = useState(creditBalance);

  const pricingOptions = getPricingOptions(creditBalance);
  const selectedPricing = pricingOptions.find((o) => o.id === pricingOption) || pricingOptions[0];

  const selectedShoot = SHOOT_TYPES.find((s) => s.id === shootType);
  const selectedLocation = LOCATIONS.find((l) => l.id === location);

  const canProceed = () => {
    if (step === 1) return !!shootType;
    if (step === 2) return !!location;
    if (step === 3) return !!pricingOption;
    return false;
  };

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    else navigation.goBack();
  };

  const handleConfirmBooking = async () => {
    const token = await getToken();
    if (!token) return;
    setBooking(true);
    try {
      const res = await api.bookProductionShoot(token, {
        businessId,
        shootType,
        location,
        creditsToUse: selectedPricing.creditsUsed,
        pricingOption,
      });
      setNewBalance(res.newBalance ?? creditBalance - selectedPricing.creditsUsed);
      setBooked(true);
    } catch (err: any) {
      Alert.alert(
        "Booking Failed",
        err.message || "Something went wrong. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setBooking(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundRoot },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.text, flex: 1 },
    stepIndicator: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 0,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    stepDotActive: { backgroundColor: theme.primary, width: 24, borderRadius: 4 },
    stepDotDone: { backgroundColor: theme.primary, opacity: 0.5 },
    stepLine: { flex: 1, height: 1, backgroundColor: theme.border, marginHorizontal: 4 },
    stepLineDone: { backgroundColor: theme.primary, opacity: 0.5 },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 6,
      marginTop: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      marginBottom: 12,
    },
    cardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + "10",
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.primary + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    cardIconSelected: { backgroundColor: theme.primary + "30" },
    cardLabel: { fontSize: 16, fontWeight: "700", color: theme.text, flex: 1 },
    cardDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },
    checkCircle: { marginLeft: "auto" },
    pricingCard: {
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    pricingCardSelected: {
      borderColor: "#22c55e",
      backgroundColor: "#22c55e10",
    },
    pricingCardFree: { borderColor: "#22c55e" },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    radioOuterSelected: { borderColor: "#22c55e" },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },
    pricingBody: { flex: 1 },
    pricingLabel: { fontSize: 15, fontWeight: "600", color: theme.text },
    pricingLabelFree: { color: "#22c55e" },
    pricingPrice: { fontSize: 22, fontWeight: "800", color: theme.text, marginTop: 2 },
    pricingPriceFree: { color: "#22c55e" },
    pricingSaving: { fontSize: 12, color: "#22c55e", fontWeight: "600", marginTop: 2 },
    pricingBadge: {
      backgroundColor: "#22c55e",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginLeft: 8,
    },
    pricingBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    creditRemainder: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 20,
      textAlign: "center",
    },
    summaryCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 20,
      marginBottom: 20,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + "80",
    },
    summaryRowLast: {
      borderBottomWidth: 0,
    },
    summaryLabel: { fontSize: 14, color: theme.textSecondary },
    summaryValue: { fontSize: 14, fontWeight: "600", color: theme.text },
    summaryValueGreen: { color: "#22c55e", fontWeight: "700" },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1.5,
      borderTopColor: theme.border,
    },
    totalLabel: { fontSize: 16, fontWeight: "700", color: theme.text },
    totalValue: { fontSize: 22, fontWeight: "800", color: theme.text },
    totalValueFree: { color: "#22c55e" },
    primaryBtn: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    primaryBtnDisabled: { backgroundColor: theme.border },
    primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
    successContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    successIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#22c55e20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    successTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: theme.text,
      textAlign: "center",
      marginBottom: 10,
    },
    successSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 30,
    },
    successBalance: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: "center",
      width: "100%",
      marginBottom: 30,
    },
    successBalanceNum: { fontSize: 36, fontWeight: "800", color: theme.primary },
    successBalanceLabel: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    doneBtn: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 40,
      width: "100%",
      alignItems: "center",
    },
    doneBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
  });

  if (booked) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.successContainer}>
          <View style={s.successIcon}>
            <Feather name="check-circle" size={38} color="#22c55e" />
          </View>
          <Text style={s.successTitle}>Shoot Booked!</Text>
          <Text style={s.successSubtitle}>
            Your {selectedShoot?.label.toLowerCase()} shoot has been confirmed.
            {selectedPricing.creditsUsed > 0
              ? ` ${selectedPricing.creditsUsed} credit${selectedPricing.creditsUsed > 1 ? "s" : ""} used.`
              : ""}
            {"\n"}Our team will reach out with next steps shortly.
          </Text>
          <View style={s.successBalance}>
            <Text style={s.successBalanceNum}>{newBalance}</Text>
            <Text style={s.successBalanceLabel}>Credits remaining</Text>
          </View>
          <Pressable style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>Back to Credits Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const renderStepIndicator = () => (
    <View style={s.stepIndicator}>
      {[1, 2, 3, 4].map((n, idx) => (
        <React.Fragment key={n}>
          <View
            style={[
              s.stepDot,
              step === n && s.stepDotActive,
              step > n && s.stepDotDone,
            ]}
          />
          {idx < 3 && (
            <View style={[s.stepLine, step > n && s.stepLineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <>
      <Text style={s.sectionTitle}>Choose Shoot Type</Text>
      <Text style={s.sectionSubtitle}>Select the type of production shoot for your business.</Text>
      {SHOOT_TYPES.map((t) => (
        <Pressable
          key={t.id}
          style={[s.card, shootType === t.id && s.cardSelected]}
          onPress={() => setShootType(t.id)}
        >
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, shootType === t.id && s.cardIconSelected]}>
              <Feather name={t.icon} size={20} color={theme.primary} />
            </View>
            <Text style={s.cardLabel}>{t.label}</Text>
            {shootType === t.id ? (
              <Feather name="check-circle" size={20} color={theme.primary} style={s.checkCircle} />
            ) : null}
          </View>
          <Text style={s.cardDesc}>{t.desc}</Text>
        </Pressable>
      ))}
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={s.sectionTitle}>Choose Location</Text>
      <Text style={s.sectionSubtitle}>Where would you like the shoot to take place?</Text>
      {LOCATIONS.map((l) => (
        <Pressable
          key={l.id}
          style={[s.card, location === l.id && s.cardSelected]}
          onPress={() => setLocation(l.id)}
        >
          <View style={s.cardHeader}>
            <View style={[s.cardIcon, location === l.id && s.cardIconSelected]}>
              <Feather name={l.icon} size={20} color={theme.primary} />
            </View>
            <Text style={s.cardLabel}>{l.label}</Text>
            {location === l.id ? (
              <Feather name="check-circle" size={20} color={theme.primary} style={s.checkCircle} />
            ) : null}
          </View>
          <Text style={s.cardDesc}>{l.desc}</Text>
        </Pressable>
      ))}
    </>
  );

  const renderStep3 = () => {
    const afterBookingBalance = creditBalance - selectedPricing.creditsUsed;
    return (
      <>
        <Text style={s.sectionTitle}>Choose Pricing</Text>
        <Text style={s.sectionSubtitle}>
          You have <Text style={{ color: theme.primary, fontWeight: "700" }}>{creditBalance} credit{creditBalance !== 1 ? "s" : ""}</Text>. Base price is {formatDollars(BASE_PRICE_CENTS)}.
        </Text>
        {pricingOptions.map((opt) => {
          const isFree = opt.id === "free";
          const isSelected = pricingOption === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[
                s.pricingCard,
                isSelected && s.pricingCardSelected,
                isFree && !isSelected && s.pricingCardFree,
              ]}
              onPress={() => setPricingOption(opt.id)}
            >
              <View style={[s.radioOuter, isSelected && s.radioOuterSelected]}>
                {isSelected ? <View style={s.radioInner} /> : null}
              </View>
              <View style={s.pricingBody}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[s.pricingLabel, isFree && s.pricingLabelFree]}>{opt.label}</Text>
                  {opt.badge ? (
                    <View style={s.pricingBadge}>
                      <Text style={s.pricingBadgeText}>{opt.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[s.pricingPrice, isFree && s.pricingPriceFree]}>
                  {isFree ? "Free" : formatDollars(opt.finalCents)}
                </Text>
                {opt.savingsCents > 0 ? (
                  <Text style={s.pricingSaving}>You save {formatDollars(opt.savingsCents)}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        <Text style={s.creditRemainder}>
          After booking: {afterBookingBalance} credit{afterBookingBalance !== 1 ? "s" : ""} remaining
        </Text>
      </>
    );
  };

  const renderStep4 = () => (
    <>
      <Text style={s.sectionTitle}>Confirm Booking</Text>
      <Text style={s.sectionSubtitle}>Review your shoot details before confirming.</Text>
      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Shoot type</Text>
          <Text style={s.summaryValue}>{selectedShoot?.label}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Location</Text>
          <Text style={s.summaryValue}>{selectedLocation?.label}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Credits used</Text>
          <Text style={s.summaryValue}>
            {selectedPricing.creditsUsed > 0
              ? `${selectedPricing.creditsUsed} credit${selectedPricing.creditsUsed > 1 ? "s" : ""}`
              : "None"}
          </Text>
        </View>
        {selectedPricing.savingsCents > 0 ? (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>You save</Text>
            <Text style={[s.summaryValue, s.summaryValueGreen]}>{formatDollars(selectedPricing.savingsCents)}</Text>
          </View>
        ) : null}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={[s.totalValue, selectedPricing.finalCents === 0 && s.totalValueFree]}>
            {selectedPricing.finalCents === 0 ? "FREE" : formatDollars(selectedPricing.finalCents)}
          </Text>
        </View>
      </View>
      <Pressable
        style={[s.primaryBtn, booking && s.primaryBtnDisabled]}
        onPress={handleConfirmBooking}
        disabled={booking}
      >
        {booking ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Feather name="check" size={18} color="#000" />
            <Text style={s.primaryBtnText}>Book Shoot</Text>
          </>
        )}
      </Pressable>
    </>
  );

  const stepTitles = ["Shoot Type", "Location", "Pricing", "Confirm"];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={handleBack}>
          <Feather name="arrow-left" size={18} color={theme.text} />
        </Pressable>
        <Text style={s.headerTitle}>
          {step < 4 ? `Step ${step}: ${stepTitles[step - 1]}` : "Confirm Booking"}
        </Text>
      </View>
      {renderStepIndicator()}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>
      {step < 4 ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: theme.backgroundRoot, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Pressable
            style={[s.primaryBtn, !canProceed() && s.primaryBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={s.primaryBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#000" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

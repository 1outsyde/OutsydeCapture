import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe, PlatformPay, PlatformPayButton, isPlatformPaySupported, type PaymentSheet } from "@stripe/stripe-react-native";

import AddressAutocompleteInput, { AddressFields } from "@/components/AddressAutocompleteInput";
import CheckoutPaymentPicker, { type CheckoutPickerHandle, type CheckoutPickerState } from "@/components/CheckoutPaymentPicker";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useCart, lineKeyOf } from "@/context/CartContext";
import { checkoutAddons, lineDetail } from "@/components/products/productAddonLogic";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiPost } from "@/api/client";
import { RootStackParamList } from "@/navigation/types";
import UsePointsPicker, { SelectedPointsCode } from "@/components/UsePointsPicker";
import {
  getSavedAddresses,
  createSavedAddress,
  getCheckoutSession,
  previewCartPrice,
  type SavedAddress,
} from "@/services/api";
import { applePayCartItems, chargedCents, applePayOutcome, shownBreakdown, makeOneAtATime } from "@/utils/savedCardsLogic";
import { sheetStyle } from "@/utils/paymentSheetOptions";
import {
  cartIntentBody,
  chargeMatchesPreview,
  checkoutElementConfig,
  checkoutSessionBody,
  intentAmount,
  methodSub,
  payButtonLabel,
  payIn4Shown,
  pickerReady,
  previewFor,
  resultErrorText,
} from "@/utils/checkoutPaymentLogic";

// Checkout refusals from the server (POST /api/cart/payment-intent) that carry
// a message written for the customer: sold out, pick an option, no longer
// available. Returns that message, or null for any other error.
const CUSTOMER_FACING_CHECKOUT_CODES = [
  "INSUFFICIENT_STOCK",
  "VARIANT_REQUIRED",
  "INVALID_VARIANT",
  "PRODUCT_UNAVAILABLE",
  "PRODUCT_VENDOR_MISMATCH",
  // Add-on refusals (backend #371)
  "ADDON_REQUIRED",
  "ADDON_LIMIT",
  "INVALID_ADDON",
  "ADDON_TEXT_REQUIRED",
  "ADDON_TEXT_TOO_LONG",
  // Points code refusals (backend #308 / #314)
  "INVALID_PROMO",
  "PROMO_MINIMUM_NOT_MET",
  "PROMO_SINGLE_SHOP_ONLY",
  "PROMO_IN_USE",
  "PROMO_CHECK_FAILED",
];
const PROMO_REFUSAL_CODES = ["INVALID_PROMO", "PROMO_MINIMUM_NOT_MET", "PROMO_SINGLE_SHOP_ONLY", "PROMO_IN_USE", "PROMO_CHECK_FAILED"];
function checkoutRefusalMessage(errMessage: string): string | null {
  if (!CUSTOMER_FACING_CHECKOUT_CODES.some((c) => errMessage.includes(c))) return null;
  const jsonStart = errMessage.indexOf("{");
  if (jsonStart === -1) return null;
  try {
    const body = JSON.parse(errMessage.slice(jsonStart));
    const msg = body?.error?.message;
    return typeof msg === "string" && msg.length > 0 ? msg : null;
  } catch {
    return null;
  }
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CheckoutRoute = RouteProp<RootStackParamList, "CheckoutScreen">;

interface FeeBreakdown {
  basePriceCents: number;
  consumerUpchargeCents: number;
  vendorPayoutCents: number;
  platformFeeCents: number;
  totalChargedToConsumerCents: number;
  outsydePointsEarned: number;
  // Points code (backend #314): what the code took off, and what the card is charged.
  discountCents?: number;
  amountChargedCents?: number;
}

export default function CheckoutScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CheckoutRoute>();
  const insets = useSafeAreaInsets();
  const { getToken, user } = useAuth();
  const { mode, buyNowItem } = route.params;
  const { items: cartItems, removeVendorItems, subtotal: cartSubtotal } = useCart();
  const { confirmPlatformPayPayment } = useStripe();

  const checkoutItems = mode === "buyNow" && buyNowItem
    ? [{
        productId: buyNowItem.productId,
        vendorId: buyNowItem.vendorId,
        priceCents: buyNowItem.priceCents,
        quantity: buyNowItem.quantity,
        name: buyNowItem.name,
        ...(buyNowItem.variantId ? { variantId: buyNowItem.variantId } : {}),
        ...(buyNowItem.addons ? { addons: checkoutAddons(buyNowItem.addons) } : {}),
      }]
    : cartItems.map((item) => ({
        productId: item.productId,
        vendorId: item.vendorId,
        priceCents: item.price,
        quantity: item.quantity,
        name: item.name,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        // Products with add-on groups always send the list (even empty) so the backend checks
        // required groups and prices the picks. Lines saved before add-ons send nothing, as before.
        ...(item.addons ? { addons: checkoutAddons(item.addons) } : {}),
      }));

  const subtotal = mode === "buyNow" && buyNowItem
    ? buyNowItem.priceCents * buyNowItem.quantity
    : cartSubtotal;

  // ─── Payment (app payment methods Step 4b) ────────────────────────────────
  // Stripe's embedded picker lists the customer's saved cards (booking cards too, Legend 2026-11-07),
  // a new card, Klarna, Afterpay, Cash App Pay, Amazon Pay and, on Android, Google Pay. Cards can't be
  // removed here (Option 1). Apple Pay keeps its own button on top.
  const [sessionLoading, setSessionLoading] = useState(true);
  // The picker's setup, built once when the session and the starting address are known (checkoutElementConfig).
  const [elementConfig, setElementConfig] = useState<ReturnType<typeof checkoutElementConfig> | null>(null);
  const who = useRef({ user, isDark });
  useEffect(() => { who.current = { user, isDark }; });
  // getToken is a new function on every AuthContext render (AuthContext.tsx:932), and the app coming back to
  // the foreground re-renders it (refreshUser). Loading through a ref keeps that from reloading the screen,
  // which would rebuild the picker in the middle of a Klarna or Cash App return.
  const tokenRef = useRef(getToken);
  useEffect(() => { tokenRef.current = getToken; });
  const [pickerKey, setPickerKey] = useState(0);
  const [picker, setPicker] = useState<CheckoutPickerState>({ option: null, loaded: false, failed: false });
  const [sheetOpen, setSheetOpen] = useState(false);
  const pickerRef = useRef<CheckoutPickerHandle>(null);
  // Apple Pay: iPhone only, and only when this device can pay with it.
  const [applePayReady, setApplePayReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let alive = true;
    isPlatformPaySupported().then((ok) => { if (alive) setApplePayReady(ok); }).catch(() => {});
    return () => { alive = false; };
  }, []);

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
  // Two quick taps must not start two checkouts (each makes an order and a PaymentIntent).
  const oneAtATime = useRef(makeOneAtATime()).current;
  // "Use my points": codes work on orders from one shop only (backend refuses multi-shop codes).
  const [pointsCode, setPointsCode] = useState<SelectedPointsCode | null>(null);
  const [pointsRefreshKey, setPointsRefreshKey] = useState(0);
  const [refusedCodeIds, setRefusedCodeIds] = useState<Set<string>>(() => new Set());
  // A changed code makes an earlier server breakdown stale; show the local preview until the new one lands.
  useEffect(() => { setBackendFeeBreakdown(null); }, [pointsCode?.id]);
  const [cardError, setCardError] = useState<string | null>(null);

  // ─── Load the checkout session + addresses on mount ───────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPaymentData() {
      let sessionResult: Awaited<ReturnType<typeof getCheckoutSession>> = {};
      let defaultAddr: SavedAddress | null = null;
      try {
        const token = await tokenRef.current();
        if (!token || cancelled) return;

        const [sessionLoaded, addrResult] = await Promise.all([
          // No session (Stripe outage, no email): the picker still works with a new card.
          getCheckoutSession(token, checkoutSessionBody(Platform.OS)).catch(() => ({})),
          getSavedAddresses(token).catch(() => ({ addresses: [] })),
        ]);

        if (cancelled) return;

        sessionResult = sessionLoaded;
        setSavedAddresses(addrResult.addresses);
        defaultAddr = addrResult.addresses.find((a) => a.isDefault) ?? addrResult.addresses[0] ?? null;
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setUseNewAddress(false);
        } else {
          setUseNewAddress(true);
        }
      } finally {
        if (!cancelled) {
          // Always set (even signed out or offline) so the payment row never spins forever; once only.
          const built = checkoutElementConfig({
            os: Platform.OS,
            style: sheetStyle(who.current.isDark),
            session: sessionResult,
            user: who.current.user,
            address: defaultAddr,
          });
          setElementConfig((prev) => prev ?? built);
          setSessionLoading(false);
          setAddressesLoading(false);
        }
      }
    }

    loadPaymentData();
    return () => { cancelled = true; };
  }, []);

  // ─── Derived flags ────────────────────────────────────────────────────────
  const hasNewAddressFields =
    shippingAddress.line1.trim().length > 0 &&
    shippingAddress.city.trim().length > 0 &&
    shippingAddress.state.trim().length > 0 &&
    shippingAddress.zipCode.trim().length > 0;

  const hasShippingAddress =
    (!useNewAddress && selectedAddressId !== null) ||
    (useNewAddress && hasNewAddressFields);

  const isEmpty = mode === "buyNow"
    ? !buyNowItem
    : cartItems.length === 0;

  // Apple Pay needs everything except a picked method.
  const applePayDisabled =
    isEmpty ||
    !hasShippingAddress ||
    checkoutLoading ||
    sessionLoading ||
    addressesLoading;

  // ─── Price computation ────────────────────────────────────────────────────
  const clientServiceFee = useMemo(() => (subtotal / 100) * 0.08, [subtotal]);
  const clientTotal = useMemo(() => (subtotal / 100) * 1.08, [subtotal]);
  // Fallback until the backend fee breakdown arrives. Points are worth half the service fee
  // (4% of the subtotal) at 500 points per $1, so points = subtotal cents x 0.2 (backend loyaltyLedger.ts).
  const clientPoints = useMemo(() => Math.round(subtotal * 0.2), [subtotal]);

  const displayedSubtotal = backendFeeBreakdown ? backendFeeBreakdown.basePriceCents / 100 : subtotal / 100;
  const displayedServiceFee = backendFeeBreakdown ? backendFeeBreakdown.consumerUpchargeCents / 100 : clientServiceFee;
  const singleShop = new Set(checkoutItems.map((i) => i.vendorId)).size === 1;
  const appliedCode = singleShop ? pointsCode : null;
  const displayedRewards = backendFeeBreakdown
    ? (backendFeeBreakdown.discountCents ?? 0) / 100
    : (appliedCode?.discountCents ?? 0) / 100;
  const displayedPoints = backendFeeBreakdown ? backendFeeBreakdown.outsydePointsEarned : clientPoints;

  // ─── Exact total before paying (backend /api/cart/price-preview) ──────────
  // The same pricing as the real charge. The picker shows the methods that fit this amount, and the
  // charge is refused if it comes back different (chargeMatchesPreview).
  const itemsKey = JSON.stringify(checkoutItems);
  const previewKey = `${itemsKey}|${appliedCode?.id ?? ""}`;
  // Keyed to the cart and code it priced, so a stale preview never shows after either changes.
  const [preview, setPreview] = useState<{ key: string; cents: number | null } | null>(null);
  const { pending: previewPending, cents: previewCents } = previewFor(preview, previewKey);
  useEffect(() => {
    if (isEmpty) return;
    let alive = true;
    (async () => {
      try {
        const token = await tokenRef.current();
        if (!token || !alive) return;
        const res = await previewCartPrice(token, {
          items: JSON.parse(itemsKey),
          ...(appliedCode ? { promoCodeId: appliedCode.id } : {}),
        });
        if (!alive) return;
        setPreview({ key: previewKey, cents: typeof res?.amountChargedCents === "number" ? res.amountChargedCents : null });
        const fb = shownBreakdown(res?.feeBreakdown as FeeBreakdown | undefined);
        if (fb) setBackendFeeBreakdown(fb);
      } catch {
        // No preview (offline, server error): the shown estimate is what the charge is checked against.
        if (alive) setPreview({ key: previewKey, cents: null });
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, isEmpty]);

  const localTotalCents = Math.round((clientTotal - (appliedCode?.discountCents ?? 0) / 100) * 100);
  const totalCents = previewCents ?? (backendFeeBreakdown
    ? (backendFeeBreakdown.amountChargedCents ?? backendFeeBreakdown.totalChargedToConsumerCents)
    : localTotalCents);
  const displayedTotal = totalCents / 100;

  useEffect(() => {
    pickerRef.current?.setAmount(intentAmount(previewCents, localTotalCents));
  }, [previewCents, localTotalCents, picker.loaded]);

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

  // ─── Refusals and errors (same alerts as before Step 4b) ──────────────────
  const showCheckoutError = (message: string) => {
    if (message.includes("ADDRESS_REQUIRED")) {
      Alert.alert(
        "Shipping Address Required",
        "Please add a shipping address to continue.",
        [{ text: "OK" }]
      );
    } else if (message.includes("INVALID_ADDRESS")) {
      Alert.alert(
        "Invalid Address",
        "Please check your shipping address and try again.",
        [{ text: "OK" }]
      );
    } else if (checkoutRefusalMessage(message)) {
      if (PROMO_REFUSAL_CODES.some((c) => message.includes(c))) {
        const refusedId = appliedCode?.id;
        if (refusedId && message.includes("PROMO_IN_USE")) setRefusedCodeIds((prev) => new Set(prev).add(refusedId));
        setPointsCode(null);
        setPointsRefreshKey((k) => k + 1);
      }
      Alert.alert(
        "Can't Complete Checkout",
        checkoutRefusalMessage(message)!,
        [{ text: "OK" }]
      );
    } else if (message.includes("STRIPE_NOT_ONBOARDED")) {
      Alert.alert(
        "Vendor Unavailable",
        "One or more items in your cart cannot be purchased at this " +
          "time. Please remove them and try again, or contact support.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Checkout Failed",
        "Something went wrong. Please try again or contact support " +
          "if the issue continues.",
        [{ text: "OK" }]
      );
    }
  };

  // ─── After a payment goes through ─────────────────────────────────────────
  const finishOrder = (token: string, feeBreakdown: FeeBreakdown | null) => {
    if (useNewAddress && saveNewAddress && hasNewAddressFields) {
      createSavedAddress(token, {
        line1: shippingAddress.line1.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        zipCode: shippingAddress.zipCode.trim(),
        isDefault: savedAddresses.length === 0,
      }).catch(() => {});
    }

    const itemCount = checkoutItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalCharged = feeBreakdown?.amountChargedCents ?? feeBreakdown?.totalChargedToConsumerCents ?? 0;
    const pointsEarned = feeBreakdown?.outsydePointsEarned ?? 0;
    if (mode === "cart") {
      Array.from(new Set(cartItems.map(i => i.vendorId))).forEach(vid => removeVendorItems(vid));
    }
    // buyNow never wrote to cart — nothing to clear
    setBackendFeeBreakdown(null);
    navigation.navigate("OrderSuccess", { itemCount, totalCharged, pointsEarned });
  };

  // ─── The order and PaymentIntent, made when the customer taps pay ─────────
  // Same route and fields as before, plus redirectCapable (backend #429). Returns the client secret.
  const createOrder = async (token: string): Promise<{ clientSecret: string; feeBreakdown: FeeBreakdown | null }> => {
    const res = await apiPost(
      "/api/cart/payment-intent",
      cartIntentBody(checkoutItems, resolveShippingAddress(), appliedCode?.id ?? null),
      token
    ) as { clientSecret?: string; feeBreakdown?: FeeBreakdown };
    const feeBreakdown = res?.feeBreakdown ?? null;
    // Multi shop carts answer with the total only: keep the local preview lines then.
    setBackendFeeBreakdown(shownBreakdown(feeBreakdown));
    if (!res?.clientSecret) throw new Error("Missing clientSecret");
    return { clientSecret: res.clientSecret, feeBreakdown };
  };

  // The picker's confirm handler reads the screen through this ref, so its setup never changes.
  type Attempt = { token: string; feeBreakdown: FeeBreakdown | null; handled: boolean };
  const attemptRef = useRef<Attempt | null>(null);
  const latest = useRef({ createOrder, showCheckoutError, shownCents: totalCents, previewKey });
  useEffect(() => {
    latest.current = { createOrder, showCheckoutError, shownCents: totalCents, previewKey };
  });

  // Built once; amounts change through setAmount (the SDK rebuilds the picker if this object changes).
  const [intentConfig] = useState<PaymentSheet.IntentConfiguration>(() => ({
    mode: { amount: intentAmount(null, localTotalCents), currencyCode: "USD" },
    confirmHandler: (_pm, _save, intentCreationCallback) => {
      const attempt = attemptRef.current;
      const fail = (message: string) => {
        if (attempt) attempt.handled = true;
        intentCreationCallback({ error: { code: "Failed", message } });
      };
      if (!attempt) return fail("Checkout failed. Please try again.");
      (async () => {
        try {
          const { clientSecret, feeBreakdown } = await latest.current.createOrder(attempt.token);
          attempt.feeBreakdown = feeBreakdown;
          const charged = chargedCents(feeBreakdown);
          // Checked against the total on screen (the preview, or the estimate if the preview failed).
          if (!chargeMatchesPreview(latest.current.shownCents, charged)) {
            if (charged != null) setPreview({ key: latest.current.previewKey, cents: charged });
            Alert.alert(
              "Your total changed",
              `The total is now $${((charged ?? 0) / 100).toFixed(2)}. Check your order and tap pay again.`,
              [{ text: "OK" }]
            );
            return fail("Your total changed. Check your order and tap pay again.");
          }
          intentCreationCallback({ clientSecret });
        } catch (err: any) {
          latest.current.showCheckoutError(err?.message ?? "");
          fail("Checkout didn't go through.");
        }
      })();
    },
  }));

  const closeSheet = useCallback(() => setSheetOpen(false), [setSheetOpen]);

  const payReady = pickerReady({
    loaded: picker.loaded,
    hasOption: !!picker.option,
    hasAddress: hasShippingAddress,
    busy: checkoutLoading || sessionLoading || addressesLoading || previewPending,
    empty: isEmpty,
    loadFailed: picker.failed,
  });

  // ─── Pay with the picked method ───────────────────────────────────────────
  const handlePay = async () => {
    if (!payReady || !pickerRef.current) return;
    if (!oneAtATime.start()) return;
    setCardError(null);
    const token = await tokenRef.current();
    if (!token) { oneAtATime.done(); Alert.alert("Checkout failed. Please try again."); return; }
    setCheckoutLoading(true);
    const attempt: Attempt = { token, feeBreakdown: null, handled: false };
    attemptRef.current = attempt;
    try {
      const result = await pickerRef.current.confirm();
      if (result.status === "completed") {
        finishOrder(token, attempt.feeBreakdown);
      } else if (result.status === "failed" && !attempt.handled) {
        setCardError(resultErrorText(result) || "Payment failed. Please try again.");
      }
      // canceled: the customer backed out (or left Klarna, Afterpay or Cash App); nothing was charged.
    } catch {
      if (!attempt.handled) setCardError("Payment failed. Please try again.");
    } finally {
      attemptRef.current = null;
      setCheckoutLoading(false);
      oneAtATime.done();
    }
  };

  // ─── Apple Pay (unchanged path, p4-applepay) ──────────────────────────────
  const handleApplePay = async () => {
    if (applePayDisabled) return;
    if (!oneAtATime.start()) return;
    setCardError(null);

    const token = await getToken();
    if (!token) { oneAtATime.done(); Alert.alert("Checkout failed. Please try again."); return; }

    setCheckoutLoading(true);
    try {
      const resolvedAddress = resolveShippingAddress();
      const paymentIntentResponse = await apiPost(
        "/api/cart/payment-intent",
        {
          items: checkoutItems,
          shippingAddress: resolvedAddress,
          ...(appliedCode ? { promoCodeId: appliedCode.id } : {}),
        },
        token
      ) as { clientSecret?: string; feeBreakdown?: FeeBreakdown };

      const clientSecret = paymentIntentResponse?.clientSecret;
      const feeBreakdown = paymentIntentResponse?.feeBreakdown ?? null;
      setBackendFeeBreakdown(shownBreakdown(feeBreakdown));
      if (!clientSecret) throw new Error("Missing clientSecret");

      // The sheet shows the charge the server set; the card is not saved.
      const cents = chargedCents(feeBreakdown) ?? Math.round(displayedTotal * 100);
      const { error: apError } = await confirmPlatformPayPayment(clientSecret, {
        applePay: {
          cartItems: applePayCartItems(cents).map((i) => ({ ...i, paymentType: PlatformPay.PaymentType.Immediate })),
          merchantCountryCode: "US",
          currencyCode: "USD",
        },
      });
      const outcome = applePayOutcome(apError as any);
      if (outcome === "canceled") return;
      if (outcome === "failed") {
        setCardError(apError?.message || "Apple Pay didn't go through. Try again, or pay another way.");
        return;
      }
      finishOrder(token, feeBreakdown);
    } catch (err: any) {
      showCheckoutError(err?.message ?? "");
    } finally {
      setCheckoutLoading(false);
      oneAtATime.done();
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
    methodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      minHeight: 56,
      paddingVertical: Spacing.sm,
    },
    methodMark: {
      width: 40,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.brandSurface,
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
        <ThemedText type="h3" style={styles.headerTitle}>
          {mode === "buyNow" ? "Buy Now" : "Checkout"}
        </ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order summary */}
        <ThemedText type="h4" style={styles.sectionLabel}>Order Summary</ThemedText>
        {mode === "buyNow" && buyNowItem ? (
          <View style={styles.cartItem}>
            <View style={styles.cartIcon}>
              <Feather name="package" size={20} color={theme.brandGold} />
            </View>
            <View style={styles.cartInfo}>
              <ThemedText type="h4" numberOfLines={1}>
                {buyNowItem.name}
              </ThemedText>
              {lineDetail(buyNowItem.variantLabel, buyNowItem.addonsLabel) ? (
                <ThemedText type="caption" style={{ color: theme.brandGold }}>
                  {lineDetail(buyNowItem.variantLabel, buyNowItem.addonsLabel)}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                ${(buyNowItem.priceCents / 100).toFixed(2)} each
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              ×{buyNowItem.quantity}
            </ThemedText>
          </View>
        ) : (
          cartItems.map((item) => (
            <View key={lineKeyOf(item)} style={styles.cartItem}>
              <View style={styles.cartIcon}>
                <Feather name="package" size={20} color={theme.brandGold} />
              </View>
              <View style={styles.cartInfo}>
                <ThemedText type="h4" numberOfLines={1}>{item.name}</ThemedText>
                {lineDetail(item.variantLabel, item.addonsLabel) ? (
                  <ThemedText type="caption" style={{ color: theme.brandGold }}>
                    {lineDetail(item.variantLabel, item.addonsLabel)}
                  </ThemedText>
                ) : null}
                <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                  ${(item.price / 100).toFixed(2)} each
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                ×{item.quantity}
              </ThemedText>
            </View>
          ))
        )}

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

        {/* Payment (Step 4b compact layout): Apple Pay on top, the picked method with Change, pay in 4 */}
        <ThemedText type="h4" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
          Payment
        </ThemedText>
        <View style={styles.card}>
          {applePayReady && (
            <ApplePayBlock disabled={applePayDisabled} onPress={handleApplePay} theme={theme} />
          )}
          {sessionLoading || !elementConfig || (!picker.loaded && !picker.failed) ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={theme.brandGold} />
            </View>
          ) : (
            <Pressable
              style={styles.methodRow}
              onPress={() => { setCardError(null); setSheetOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={picker.option ? `Paying with ${picker.option.label}. Change` : "Choose how to pay"}
            >
              {picker.option?.image ? (
                <Image source={{ uri: `data:image/png;base64,${picker.option.image}` }} style={styles.methodMark} resizeMode="contain" />
              ) : (
                <View style={[styles.methodMark, { alignItems: "center", justifyContent: "center" }]}>
                  <Feather name="credit-card" size={18} color={theme.brandGold} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <ThemedText type="body" numberOfLines={1}>
                  {picker.option ? picker.option.label : "Choose how to pay"}
                </ThemedText>
                {methodSub(picker.option?.paymentMethodType, totalCents) ? (
                  <ThemedText type="caption" style={{ color: theme.brandTextDim }}>
                    {methodSub(picker.option?.paymentMethodType, totalCents)}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="body" style={{ color: theme.brandGold }}>Change</ThemedText>
            </Pressable>
          )}
          {payIn4Shown(totalCents) && picker.loaded ? (
            <Pressable onPress={() => { setCardError(null); setSheetOpen(true); }} style={{ marginTop: Spacing.sm }}>
              <ThemedText type="caption" style={{ color: theme.brandTextDim, textAlign: "center" }}>
                Or pay in 4 interest free with Klarna or Afterpay
              </ThemedText>
            </Pressable>
          ) : null}
          {picker.failed ? (
            <Pressable
              onPress={() => {
                setPicker({ option: null, loaded: false, failed: false });
                setPickerKey((k) => k + 1);
              }}
              accessibilityRole="button"
            >
              <ThemedText type="body" style={styles.cardErrorText}>
                {"Payment options didn't load. Tap to try again."}
              </ThemedText>
            </Pressable>
          ) : null}

          {cardError !== null && (
            <ThemedText type="body" style={styles.cardErrorText}>
              {cardError}
            </ThemedText>
          )}
        </View>

        {/* Use my points (Outsyde loyalty rewards): one shop per order */}
        {!isEmpty && singleShop && (
          <UsePointsPicker
            kind="order"
            amountCents={subtotal}
            selected={pointsCode}
            onChange={setPointsCode}
            disabled={checkoutLoading}
            refreshKey={pointsRefreshKey}
            refusedCodeIds={refusedCodeIds}
          />
        )}

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
          {displayedRewards > 0 && (
            <View style={styles.row}>
              <ThemedText type="body" style={{ color: theme.brandTextDim }}>Outsyde rewards</ThemedText>
              <ThemedText type="body">${displayedRewards.toFixed(2)} off</ThemedText>
            </View>
          )}
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
          onPress={handlePay}
          disabled={!payReady}
          style={({ pressed }) => [
            styles.checkoutButton,
            {
              backgroundColor: !payReady ? theme.brandPrimary + "66" : theme.brandPrimary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {checkoutLoading ? (
            <ActivityIndicator size="small" color={theme.brandPrimaryText} />
          ) : (
            <>
              <Feather name="lock" size={18} color={theme.brandPrimaryText} />
              <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>
                {payButtonLabel(picker.option?.paymentMethodType, totalCents)}
              </ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>

      {elementConfig ? (
        <CheckoutPaymentPicker
          key={pickerKey}
          ref={pickerRef}
          intentConfig={intentConfig}
          config={elementConfig}
          open={sheetOpen}
          onClose={closeSheet}
          onState={setPicker}
          theme={theme}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

/** Apple Pay button above the picked method, with the "Or pay another way" divider (p4-applepay, Step 4b). */
function ApplePayBlock({ disabled, onPress, theme }: { disabled: boolean; onPress: () => void; theme: any }) {
  return (
    <View style={{ gap: Spacing.sm, marginBottom: Spacing.sm }}>
      <PlatformPayButton
        type={PlatformPay.ButtonType.Pay}
        appearance={PlatformPay.ButtonStyle.Automatic}
        borderRadius={BorderRadius.full}
        disabled={disabled}
        onPress={onPress}
        style={{ width: "100%", height: 48, opacity: disabled ? 0.5 : 1 }}
      />
      <ThemedText type="caption" style={{ color: theme.brandTextDim, textAlign: "center" }}>
        Or pay another way
      </ThemedText>
    </View>
  );
}

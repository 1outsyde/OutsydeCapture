// App payment methods Step 4b: Stripe's embedded picker inside the branded "Choose how to pay" sheet
// (compact layout, Legend 2026-11-07). The sheet is an in-screen BottomSheet, not a modal: on Android the
// picker can only confirm and update while its view is mounted (stripe-react-native 0.81.0
// EmbeddedPaymentElement.tsx:538-560), so it stays mounted while the sheet is closed.
// Render this once, at the screen's root, with setup objects that never change (see checkoutElementConfig).
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import {
  useEmbeddedPaymentElement,
  type EmbeddedPaymentElementConfiguration,
  type EmbeddedPaymentElementResult,
  type PaymentOptionDisplayData,
  type PaymentSheet,
} from "@stripe/stripe-react-native";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";

type IntentConfiguration = PaymentSheet.IntentConfiguration;

export interface CheckoutPickerHandle {
  confirm(): Promise<EmbeddedPaymentElementResult>;
  /** New total (points, promo): the picker refreshes which methods fit. */
  setAmount(cents: number): void;
}

export interface CheckoutPickerState {
  option: PaymentOptionDisplayData | null;
  loaded: boolean;
  failed: boolean;
}

interface Props {
  intentConfig: IntentConfiguration;
  config: EmbeddedPaymentElementConfiguration;
  open: boolean;
  onClose: () => void;
  onState: (s: CheckoutPickerState) => void;
  theme: any;
  bottomInset: number;
}

const CheckoutPaymentPicker = forwardRef<CheckoutPickerHandle, Props>(
  function CheckoutPaymentPicker(
    { intentConfig, config, open, onClose, onState, theme, bottomInset },
    ref,
  ) {
    const {
      embeddedPaymentElementView,
      paymentOption,
      confirm,
      update,
      loadingError,
      isLoaded,
    } = useEmbeddedPaymentElement(intentConfig, config);

    const lastAmount = useRef<number | null>(null);
    useImperativeHandle(
      ref,
      () => ({
        confirm,
        setAmount(cents: number) {
          if (lastAmount.current === cents) return;
          const mode = intentConfig.mode as {
            amount: number;
            currencyCode: string;
          };
          try {
            // update() returns a promise on both platforms. If it fails (picker not ready yet), forget
            // the amount so the next call (the screen calls again once the picker loads) sends it.
            Promise.resolve(
              update({
                ...intentConfig,
                mode: { ...mode, amount: cents },
              } as IntentConfiguration),
            ).catch(() => {
              if (lastAmount.current === cents) lastAmount.current = null;
            });
            lastAmount.current = cents;
          } catch {
            // Not created yet (iOS throws right away): try again on the next call.
          }
        },
      }),
      [confirm, update, intentConfig],
    );

    useEffect(() => {
      onState({
        option: paymentOption,
        loaded: isLoaded,
        failed: !!loadingError,
      });
    }, [paymentOption, isLoaded, loadingError, onState]);

    const snapPoints = useMemo(() => ["82%"], []);

    return (
      <BottomSheet
        index={open ? 0 : -1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onChange={(i) => {
          if (i === -1) onClose();
        }}
        backgroundStyle={{
          backgroundColor: theme.brandBgElevated ?? theme.brandSurface,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.brandTextDim }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            pressBehavior="close"
          />
        )}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomInset + Spacing.lg },
          ]}
        >
          <ThemedText type="h4" style={styles.title}>
            Choose how to pay
          </ThemedText>
          {loadingError ? (
            <ThemedText type="body" style={{ color: theme.brandTextDim }}>
              {"Payment options didn't load. Close this and try again."}
            </ThemedText>
          ) : null}
          {!isLoaded && !loadingError ? (
            <ActivityIndicator
              size="small"
              color={theme.brandGold}
              style={{ marginVertical: Spacing.lg }}
            />
          ) : null}
          {/* Always rendered (Android needs the view to confirm), even before it has loaded. */}
          <View>{embeddedPaymentElementView}</View>
          <Pressable
            onPress={onClose}
            disabled={!paymentOption}
            style={({ pressed }) => [
              styles.useThis,
              {
                backgroundColor: theme.brandPrimary,
                opacity: !paymentOption ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <ThemedText type="body" style={{ color: theme.brandPrimaryText }}>
              Use this
            </ThemedText>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

export default CheckoutPaymentPicker;

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  title: { textAlign: "center", marginBottom: Spacing.xs },
  useThis: {
    height: 50,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
});

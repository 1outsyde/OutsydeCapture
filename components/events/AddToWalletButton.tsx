/**
 * p4-store S2: the Add to Apple Wallet button on the ticket screen. Apple's own PKAddPassButton (modules/outsyde-wallet-button)
 * when this build has it; the text button anywhere else, so Expo Go, an older dev client, Android and web keep working.
 * The native view is only required once the module is known to be there: requiring a missing view breaks the screen.
 */
import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { requireNativeView, requireOptionalNativeModule } from "expo";

import { ThemedText } from "@/components/ThemedText";
import { walletButtonKind } from "@/utils/ticketCheckoutLogic";

type NativeProps = {
  outline: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

// Resolved once, when the file loads, so the screen never creates a component while it renders.
const NativeWalletButton: React.ComponentType<NativeProps> | null = (() => {
  const hasModule =
    Platform.OS === "ios" &&
    requireOptionalNativeModule("OutsydeWalletButton") != null;
  if (walletButtonKind(Platform.OS, hasModule) !== "native") return null;
  try {
    return requireNativeView<NativeProps>("OutsydeWalletButton");
  } catch {
    return null;
  }
})();

export function AddToWalletButton({
  url,
  isDark,
  borderColor,
}: {
  url: string;
  isDark: boolean;
  borderColor: string;
}) {
  const open = () => {
    Linking.openURL(url).catch(() => {});
  };
  if (NativeWalletButton)
    return (
      <NativeWalletButton
        outline={isDark}
        onPress={open}
        style={styles.native}
      />
    );
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      style={[styles.pill, { borderColor }]}
    >
      <ThemedText style={styles.pillText}>Add to Apple Wallet</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  native: { height: 52, alignSelf: "stretch" },
  pill: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#0B0B0B",
    borderWidth: 1,
  },
  pillText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

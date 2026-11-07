import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

// A pop-up shown as its own full page: slides up, close control top left,
// title centered, optional action on the right, content below the notch and
// above the home bar, and the keyboard never covers the content.
export interface FullScreenSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** "close" shows an ✕ (default); "cancel" shows the word Cancel. */
  closeLabel?: "close" | "cancel";
  /** Optional control on the right of the header (e.g. Save). */
  right?: React.ReactNode;
  backgroundColor?: string;
  tintColor?: string;
  borderColor?: string;
  /** iOS: called after the page has finished closing. */
  onDismiss?: () => void;
  /** While true (e.g. saving), the close control and Android back do nothing. */
  closeDisabled?: boolean;
  /** Android keyboard handling; default leaves it to the window resizing. */
  androidKeyboardBehavior?: "height";
  children: React.ReactNode;
}

export function FullScreenSheet({
  visible,
  onClose,
  title,
  closeLabel = "close",
  right,
  backgroundColor,
  tintColor,
  borderColor,
  onDismiss,
  closeDisabled = false,
  androidKeyboardBehavior,
  children,
}: FullScreenSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bg = backgroundColor ?? theme.backgroundRoot;
  const tint = tintColor ?? theme.text;
  const border = borderColor ?? theme.border;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!closeDisabled) onClose();
      }}
      onDismiss={onDismiss}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: bg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Pressable
            onPress={onClose}
            disabled={closeDisabled}
            style={[styles.side, closeDisabled && styles.disabled]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={closeLabel === "cancel" ? "Cancel" : "Close"}
          >
            {closeLabel === "cancel" ? (
              <Text style={[styles.cancel, { color: tint }]}>Cancel</Text>
            ) : (
              <Feather name="x" size={24} color={tint} />
            )}
          </Pressable>
          <Text
            style={[styles.title, { color: tint }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <View style={[styles.side, styles.sideRight]}>{right ?? null}</View>
        </View>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : androidKeyboardBehavior}
        >
          {children}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  cancel: {
    fontSize: 16,
    fontWeight: "500",
  },
  body: {
    flex: 1,
  },
});

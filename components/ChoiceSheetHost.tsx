import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ChoiceSheetConfig, setChoiceSheetListener } from "@/utils/choiceSheet";

/** Renders menus opened with showChoiceSheet(). Mounted once in App.tsx on Android only. */
export default function ChoiceSheetHost() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<ChoiceSheetConfig | null>(null);

  useEffect(() => {
    setChoiceSheetListener(setConfig);
    return () => setChoiceSheetListener(null);
  }, []);

  const close = () => setConfig(null);
  const choose = (onPress: () => void) => {
    setConfig(null);
    onPress();
  };

  return (
    <Modal
      visible={config !== null}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: Spacing.md + insets.bottom,
            },
          ]}
          onPress={() => {}}
        >
          {config && (
            <>
              <ThemedText style={styles.title}>{config.title}</ThemedText>
              {config.message ? (
                <ThemedText
                  style={[styles.message, { color: theme.textSecondary }]}
                >
                  {config.message}
                </ThemedText>
              ) : null}
              <ScrollView style={styles.list} bounces={false}>
                {config.options.map((option) => (
                  <Pressable
                    key={option.label}
                    style={({ pressed }) => [
                      styles.option,
                      { borderTopColor: theme.border },
                      pressed && { backgroundColor: theme.border },
                    ]}
                    onPress={() => choose(option.onPress)}
                    accessibilityRole="button"
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        option.destructive && { color: theme.error },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                style={[styles.cancel, { borderColor: theme.border }]}
                onPress={close}
                accessibilityRole="button"
              >
                <ThemedText style={styles.cancelText}>
                  {config.cancelLabel ?? "Cancel"}
                </ThemedText>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    maxHeight: "80%",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  list: {
    marginTop: Spacing.sm,
  },
  option: {
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 16,
  },
  cancel: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

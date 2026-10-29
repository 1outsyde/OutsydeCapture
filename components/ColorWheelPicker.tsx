// Color wheel picker (2026-10-29): replaces the 16 preset swatches in every editor
// (Storefront Editor, Photographer Dashboard, Consumer Edit Profile, Edit Staff Profile).
//
// The wheel picks hue + saturation, the slider picks brightness, and the hex box takes an exact color.
// It reports a plain #RRGGBB. Screens save it as { type: "custom", hex } via toColorPayload().
// The preview shows the color the way the profile will actually show it in this mode
// (resolveBrandColor nudges a too-faint color to 3:1 contrast) with readable text on top.
import React, { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import ColorPicker, {
  Panel3,
  BrightnessSlider,
  InputWidget,
  type ColorFormatsObject,
} from "reanimated-color-picker";
import { useTheme } from "@/hooks/useTheme";
import { resolveBrandColor, readableTextOn } from "@/constants/colorOptions";

type Props = {
  /** Current color as #RRGGBB. */
  value: string;
  /** Called with #RRGGBB (uppercase) when the person finishes a drag or types a color. */
  onChange: (hex: string) => void;
  /** Optional line under the title. */
  hint?: string;
};

export default function ColorWheelPicker({ value, onChange, hint }: Props) {
  const { theme, isDark } = useTheme();
  const mode = isDark ? "dark" : "light";
  const shown = resolveBrandColor({ type: "custom", hex: value }, mode);
  const onShown = readableTextOn(shown);

  const handleComplete = useCallback(
    (colors: ColorFormatsObject) => {
      const hex = colors.hex.slice(0, 7).toUpperCase();
      if (/^#[0-9A-F]{6}$/.test(hex)) onChange(hex);
    },
    [onChange],
  );

  return (
    <View style={styles.wrap} testID="color-wheel-picker">
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      <ColorPicker value={value} onCompleteJS={handleComplete} style={styles.picker} thumbSize={26} boundedThumb>
        <Panel3 style={styles.wheel} centerChannel="saturation" />
        <BrightnessSlider style={styles.slider} />
        <InputWidget
          formats={["HEX"]}
          disableAlphaChannel
          containerStyle={styles.inputRow}
          inputStyle={[styles.input, { color: theme.text, borderColor: theme.border }]}
          inputTitleStyle={{ color: theme.textSecondary }}
          iconColor={theme.textSecondary}
        />
      </ColorPicker>
      <View style={styles.previewRow}>
        <View style={[styles.previewButton, { backgroundColor: shown }]} testID="color-wheel-preview">
          <Text style={[styles.previewText, { color: onShown }]}>Follow</Text>
        </View>
        <Text style={[styles.previewLabel, { color: shown }]}>{value.toUpperCase()}</Text>
      </View>
      {shown !== value.toUpperCase() ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Shown a little {isDark ? "lighter" : "darker"} in {mode} mode so it stays easy to see.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 13 },
  picker: { gap: 16, width: "100%", maxWidth: 320, alignSelf: "center" },
  wheel: { width: "100%", aspectRatio: 1 },
  slider: { borderRadius: 12, height: 28 },
  inputRow: { width: "100%" },
  input: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, fontSize: 15 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "center" },
  previewButton: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
  previewText: { fontSize: 14, fontWeight: "700" },
  previewLabel: { fontSize: 13, fontWeight: "600" },
  note: { fontSize: 12, textAlign: "center" },
});

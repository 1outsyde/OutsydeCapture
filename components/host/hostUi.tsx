/**
 * Small building blocks shared by the host screens (editor, Your events, manage): header, buttons, fields,
 * choice rows and messages. Same look as the Events canvas (gold primary button with dark text, outlined
 * secondary buttons, uppercase field labels). Colors follow the theme so light and dark both work.
 */
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { EVENT_GOLD } from "@/components/events/eventColors";

export const GOLD = EVENT_GOLD;
export const ON_GOLD = "#0B0B0B";

export function HostHeader({ title, sub, left, right }: {
  title?: string; sub?: string;
  left?: { icon: "chevron-left" | "x"; label: string; onPress: () => void };
  right?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
      <View style={s.side}>
        {left ? (
          <Pressable onPress={left.onPress} accessibilityRole="button" accessibilityLabel={left.label} hitSlop={10} style={s.iconBtn}>
            <Feather name={left.icon} size={22} color={theme.text} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.headMid}>
        {title ? <ThemedText style={s.headTitle} accessibilityRole="header" numberOfLines={1}>{title}</ThemedText> : null}
        {sub ? <ThemedText style={[s.hint, { color: theme.textSecondary }]}>{sub}</ThemedText> : null}
      </View>
      <View style={[s.side, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

export function Progress({ step }: { step: number }) {
  const { theme } = useTheme();
  return (
    <View style={[s.progress, { backgroundColor: theme.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: `${(step / 3) * 100}%`, height: 3, backgroundColor: GOLD }} />
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, style }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const { theme } = useTheme();
  const off = disabled || busy;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [s.primary, { backgroundColor: off && !busy ? theme.border : GOLD, opacity: pressed ? 0.85 : 1 }, style]}>
      {busy ? <ActivityIndicator color={ON_GOLD} style={{ marginRight: 8 }} /> : null}
      <ThemedText style={[s.primaryText, { color: off && !busy ? theme.textSecondary : ON_GOLD }]}>{label}</ThemedText>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, disabled, danger, style }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.outline, { borderColor: danger ? theme.error : theme.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }, style]}>
      <ThemedText style={[s.outlineText, { color: danger ? theme.error : theme.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

export function TextButton({ label, onPress, disabled, gold, a11yLabel, center }: { label: string; onPress: () => void; disabled?: boolean; gold?: boolean; a11yLabel?: string; center?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11yLabel} hitSlop={8}
      style={{ opacity: disabled ? 0.45 : 1, paddingVertical: 4, alignSelf: center ? "center" : undefined }}>
      <ThemedText style={[s.textBtn, { color: gold ? theme.brandGold : theme.text }]} numberOfLines={1}>{label}</ThemedText>
    </Pressable>
  );
}

export function Label({ children }: { children: string }) {
  const { theme } = useTheme();
  return <ThemedText style={[s.label, { color: theme.textSecondary }]}>{children}</ThemedText>;
}

export function Hint({ children, warn, style }: { children: React.ReactNode; warn?: boolean; style?: object }) {
  const { theme } = useTheme();
  return <ThemedText style={[s.hint, { color: warn ? theme.warning : theme.textSecondary }, style]}>{children}</ThemedText>;
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        {...input}
        accessibilityLabel={input.accessibilityLabel ?? label}
        placeholderTextColor={theme.textSecondary}
        style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundDefault, opacity: input.editable === false ? 0.5 : 1 }, input.multiline ? s.area : null, input.style]}
      />
    </View>
  );
}

/** A tappable box that looks like an input (date, time, zone, pickers). */
export function PickerBox({ label, value, onPress, disabled }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[s.field, { flex: 1 }]}>
      <Label>{label}</Label>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label.toLowerCase()}, ${value}`} accessibilityState={{ disabled: !!disabled }}
        style={[s.input, s.pickBox, { borderColor: theme.border, backgroundColor: theme.backgroundDefault, opacity: disabled ? 0.5 : 1 }]}>
        <ThemedText style={{ fontSize: 15 }} numberOfLines={1}>{value}</ThemedText>
      </Pressable>
    </View>
  );
}

export function Chip({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !!disabled }}
      style={[s.chip, { borderColor: on ? GOLD : theme.border, backgroundColor: on ? "rgba(232,185,48,0.14)" : "transparent", opacity: disabled && !on ? 0.45 : 1 }]}>
      <ThemedText style={[s.chipText, { color: on ? theme.brandGold : theme.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

export function RadioRow({ label, sub, on, onPress, disabled, children }: { label?: string; sub?: string; on: boolean; onPress: () => void; disabled?: boolean; children?: React.ReactNode }) {
  const { theme } = useTheme();
  const dot = <View style={[s.radio, { borderColor: on ? GOLD : theme.textSecondary }]}>{on ? <View style={s.radioDot} /> : null}</View>;
  if (children) {
    // A row with its own input inside (refund hours): the row isn't one accessible element, or the input would be
    // hidden from screen readers. The circle carries the radio role instead.
    return (
      <View style={[s.radioRow, { borderTopColor: theme.border, opacity: disabled ? 0.45 : 1 }]}>
        <View style={{ flex: 1, gap: 2 }}>{children}{sub ? <Hint>{sub}</Hint> : null}</View>
        <Pressable onPress={onPress} disabled={disabled} hitSlop={10} accessibilityRole="radio" accessibilityLabel={label}
          accessibilityState={{ checked: on, disabled: !!disabled }}>{dot}</Pressable>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={label} accessibilityHint={sub}
      style={[s.radioRow, { borderTopColor: theme.border, opacity: disabled ? 0.45 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontSize: 15 }}>{label}</ThemedText>
        {sub ? <Hint>{sub}</Hint> : null}
      </View>
      {dot}
    </Pressable>
  );
}

export function Box({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[s.box, { borderColor: theme.border }]} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <ThemedText style={s.boxTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

export function Switch({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} style={s.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={s.strong}>{label}</ThemedText>
        {sub ? <Hint>{sub}</Hint> : null}
      </View>
      <View style={[s.track, { backgroundColor: on ? GOLD : theme.border }]}>
        <View style={[s.knob, { alignSelf: on ? "flex-end" : "flex-start" }]} />
      </View>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <ThemedText style={[s.msg, { color: theme.error }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">{children}</ThemedText>;
}

export function OkText({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <ThemedText style={[s.msg, { color: theme.success }]} accessibilityLiveRegion="polite">{children}</ThemedText>;
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={s.centered}>{children}</View>;
}

export const hostStyles = StyleSheet.create({
  strong: { fontSize: 15, fontWeight: "600" },
  section: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  h1: { fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  body: { fontSize: 15, lineHeight: 22 },
});

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { width: 112, justifyContent: "center" },
  headMid: { flex: 1, alignItems: "center" },
  headTitle: { fontSize: 17, fontWeight: "700" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progress: { height: 3, width: "100%" },
  primary: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 20 },
  primaryText: { fontSize: 16, fontWeight: "700" },
  outline: { minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  outlineText: { fontSize: 15, fontWeight: "600" },
  textBtn: { fontSize: 15, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  hint: { fontSize: 13, lineHeight: 18 },
  field: { gap: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  pickBox: { justifyContent: "center" },
  area: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 14, fontWeight: "600" },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  box: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  boxTitle: { fontSize: 15, fontWeight: "700", paddingHorizontal: 14, paddingVertical: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  track: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
  msg: { fontSize: 14, lineHeight: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  strong: { fontSize: 15, fontWeight: "600" },
});

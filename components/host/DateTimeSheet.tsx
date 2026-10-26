/**
 * The editor's own date and time pickers (Events canvas 32). Built from plain views so no native picker package
 * is needed. Dates are "YYYY-MM-DD", times "HH:MM".
 */
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { GOLD, ON_GOLD } from "@/components/host/hostUi";
import { dateLabel, monthGrid, monthOf, monthTitle, shiftMonth, timeLabel, timeOptions, type YM } from "@/utils/host/pickerLogic";

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROW = 48;

export type PickerTarget = { mode: "date" | "time"; title: string; value: string; min?: string; fallbackMonth: YM };

export default function DateTimeSheet({ target, onDone, onClose }: { target: PickerTarget | null; onDone: (value: string) => void; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      {target ? (
        <View style={[s.sheet, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + 16, borderColor: theme.border }]} accessibilityViewIsModal>
          <View style={s.head}>
            <ThemedText style={s.title} accessibilityRole="header">{target.title}</ThemedText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
          {target.mode === "date"
            ? <Calendar key={`d-${target.value}`} value={target.value} min={target.min} fallbackMonth={target.fallbackMonth} onDone={onDone} />
            : <Times key={`t-${target.value}`} value={target.value} onDone={onDone} />}
        </View>
      ) : null}
    </Modal>
  );
}

function Calendar({ value, min, fallbackMonth, onDone }: { value: string; min?: string; fallbackMonth: YM; onDone: (v: string) => void }) {
  const { theme } = useTheme();
  const [month, setMonth] = useState<YM>(monthOf(value) ?? monthOf(min ?? "") ?? fallbackMonth);
  const [picked, setPicked] = useState(value);
  const cells = useMemo(() => monthGrid(month.y, month.m), [month]);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const minMonth = min ? monthOf(min) : null;
  const canBack = !minMonth || month.y * 12 + month.m > minMonth.y * 12 + minMonth.m;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.monthRow}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} disabled={!canBack} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} style={{ opacity: canBack ? 1 : 0.3 }}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </Pressable>
        <ThemedText style={s.month}>{monthTitle(month)}</ThemedText>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10}>
          <Feather name="chevron-right" size={22} color={theme.text} />
        </Pressable>
      </View>
      <View style={s.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEK.map((d, i) => <ThemedText key={i} style={[s.wd, { color: theme.textSecondary }]}>{d}</ThemedText>)}
      </View>
      {weeks.map((w, wi) => (
        <View key={wi} style={s.week}>
          {w.map((d, i) => {
            if (!d) return <View key={i} style={s.cell} />;
            const off = !!min && d < min;
            const on = d === picked;
            return (
              <Pressable key={d} onPress={() => setPicked(d)} disabled={off} style={s.cell}
                accessibilityRole="button" accessibilityLabel={`${WEEK_NAMES[i]}, ${dateLabel(d)}`} accessibilityState={{ selected: on, disabled: off }}>
                <View style={[s.day, on ? { backgroundColor: GOLD } : null]}>
                  <ThemedText style={{ fontSize: 15, fontWeight: on ? "700" : "400", color: on ? ON_GOLD : off ? theme.textSecondary : theme.text, opacity: off ? 0.4 : 1 }}>
                    {Number(d.slice(8))}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable onPress={() => picked && onDone(picked)} disabled={!picked} accessibilityRole="button" style={[s.done, { backgroundColor: picked ? GOLD : theme.border }]}>
        <ThemedText style={[s.doneText, { color: picked ? ON_GOLD : theme.textSecondary }]}>Done</ThemedText>
      </Pressable>
    </View>
  );
}

function Times({ value, onDone }: { value: string; onDone: (v: string) => void }) {
  const { theme } = useTheme();
  const options = useMemo(() => timeOptions(15, value), [value]);
  // Open at the saved time, or 7:00 PM for a new one.
  const start = Math.max(0, options.indexOf(value || "19:00"));
  return (
    <FlatList
      data={options}
      keyExtractor={(t) => t}
      style={{ maxHeight: ROW * 6.5 }}
      initialScrollIndex={start}
      getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
      renderItem={({ item }) => {
        const on = item === value;
        return (
          <Pressable onPress={() => onDone(item)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[s.timeRow, { borderBottomColor: theme.border, backgroundColor: on ? "rgba(232,185,48,0.14)" : "transparent" }]}>
            <ThemedText style={{ fontSize: 16, fontWeight: on ? "700" : "400", color: on ? theme.brandGold : theme.text }}>{timeLabel(item)}</ThemedText>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  month: { fontSize: 16, fontWeight: "700" },
  week: { flexDirection: "row" },
  wd: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  cell: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  done: { minHeight: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 4 },
  doneText: { fontSize: 16, fontWeight: "700" },
  timeRow: { height: ROW, justifyContent: "center", paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});

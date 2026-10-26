/** Add or edit one ticket type (Events canvas 11, same rules as goutsyde.com's ticket sheet). */
import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Box, ErrorText, Field, GOLD, Hint, ON_GOLD, PickerBox, PrimaryButton, RadioRow } from "@/components/host/hostUi";
import DateTimeSheet, { type PickerTarget } from "@/components/host/DateTimeSheet";
import OptionSheet from "@/components/host/OptionSheet";
import { money } from "@/utils/eventsLogic";
import { hostEarningsCents } from "@/utils/host/hostFees";
import { parsePriceCents, switchPaid, ticketBody, type HostTicketType, type SalesStart, type TicketSheet } from "@/utils/host/editorLogic";
import { dateLabel, monthOf, timeLabel, todayIn } from "@/utils/host/pickerLogic";

export default function TicketTypeSheet({ initial, editing, others, timezone, onSave, onClose }: {
  initial: TicketSheet;
  editing: HostTicketType | null;
  /** Other active types of this event (for "when another type runs out"). */
  others: HostTicketType[];
  timezone: string;
  /** Resolves to an error message, or null when saved. */
  onSave: (body: Record<string, unknown>) => Promise<string | null>;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [sh, setSh] = useState<TicketSheet>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [pickAfter, setPickAfter] = useState(false);
  const priceLocked = !!editing && editing.takenCount > 0;
  const set = <K extends keyof TicketSheet>(k: K, v: TicketSheet[K]) => setSh((p) => ({ ...p, [k]: v }));

  const cents = sh.paid ? parsePriceCents(sh.price) : null;
  const earn = cents != null && cents >= 100 ? hostEarningsCents(cents) : null;
  const today = todayIn(timezone);

  async function submit() {
    if (saving) return;
    const r = ticketBody(sh, timezone);
    if (!r.ok) { setError(r.message); return; }
    setSaving(true);
    setError(null);
    const msg = await onSave(r.body);
    setSaving(false);
    if (msg) setError(msg);
  }

  const starts: { value: SalesStart; label: string }[] = [
    { value: "now", label: "Right away" },
    { value: "date", label: "On a date I pick" },
  ];
  if (others.length) starts.push({ value: "after", label: "When another ticket type runs out" });
  const afterName = others.find((o) => o.id === sh.unlockAfterId)?.name;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[s.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]} accessibilityViewIsModal>
          <View style={s.head}>
            <ThemedText style={s.title} accessibilityRole="header">{editing ? "Edit ticket type" : "New ticket type"}</ThemedText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 20 }}>
            <View style={[s.seg, { borderColor: theme.border }]} accessibilityRole="radiogroup" accessibilityLabel="Ticket price type">
              {[false, true].map((paid) => {
                const on = sh.paid === paid;
                return (
                  <Pressable key={String(paid)} onPress={() => setSh((p) => switchPaid(p, paid))} disabled={priceLocked}
                    accessibilityRole="radio" accessibilityState={{ checked: on, disabled: priceLocked }}
                    style={[s.segBtn, on ? { backgroundColor: GOLD } : null, { opacity: priceLocked && !on ? 0.45 : 1 }]}>
                    <ThemedText style={{ fontWeight: "700", color: on ? ON_GOLD : theme.text }}>{paid ? "Paid" : "Free"}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <Field label="NAME" maxLength={80} placeholder={sh.paid ? "General admission" : "Free RSVP"} value={sh.name} onChangeText={(v) => set("name", v)} />

            <View style={s.grid}>
              {sh.paid ? (
                <View style={s.cell}><Field label="PRICE" keyboardType="decimal-pad" placeholder="$0.00" editable={!priceLocked} value={sh.price} onChangeText={(v) => set("price", v)} /></View>
              ) : null}
              <View style={s.cell}><Field label="HOW MANY" keyboardType="number-pad" placeholder="100" value={sh.quantity} onChangeText={(v) => set("quantity", v)} /></View>
              <View style={s.cell}><Field label="MAX PER ORDER" keyboardType="number-pad" value={sh.maxPerOrder} onChangeText={(v) => set("maxPerOrder", v)} /></View>
              <View style={s.cell}><Field label="LIMIT PER PERSON" keyboardType="number-pad" placeholder="No limit" value={sh.perAccountLimit} onChangeText={(v) => set("perAccountLimit", v)} /></View>
            </View>
            {priceLocked ? <Hint>The price can't change once tickets are taken.</Hint> : null}
            {sh.paid ? <Hint>Guests pay a service fee on top of your price.{earn != null ? ` You earn ${money(earn)} per ticket.` : ""}</Hint> : null}

            <Box title="Sales start">
              {starts.map((o) => <RadioRow key={o.value} label={o.label} on={sh.salesStart === o.value} onPress={() => set("salesStart", o.value)} />)}
              {sh.salesStart === "date" ? (
                <View style={[s.grid, { padding: 14, paddingTop: 4 }]}>
                  <PickerBox label="DATE" value={dateLabel(sh.salesDate)}
                    onPress={() => setPicker({ mode: "date", title: "Sales start date", value: sh.salesDate, min: today, fallbackMonth: monthOf(today)! })} />
                  <PickerBox label="TIME" value={timeLabel(sh.salesTime)}
                    onPress={() => setPicker({ mode: "time", title: "Sales start time", value: sh.salesTime, fallbackMonth: monthOf(today)! })} />
                </View>
              ) : null}
              {sh.salesStart === "after" ? (
                <View style={{ padding: 14, paddingTop: 4 }}>
                  <PickerBox label="OPENS WHEN THIS RUNS OUT" value={afterName ?? "Pick a ticket type"} onPress={() => setPickAfter(true)} />
                </View>
              ) : null}
            </Box>

            {error ? <ErrorText>{error}</ErrorText> : null}
            <PrimaryButton label={saving ? "Saving…" : editing ? "Save ticket" : "Add ticket"} onPress={submit} busy={saving} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <DateTimeSheet target={picker} onClose={() => setPicker(null)}
        onDone={(v) => { if (picker?.mode === "date") set("salesDate", v); else set("salesTime", v); setPicker(null); }} />
      <OptionSheet title="Opens when this runs out" options={pickAfter ? others.map((o) => ({ value: o.id, label: o.name })) : null}
        selected={sh.unlockAfterId} onClose={() => setPickAfter(false)} onPick={(v) => { set("unlockAfterId", v); setPickAfter(false); }} />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  seg: { flexDirection: "row", borderWidth: 1, borderRadius: 24, padding: 3 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { flexBasis: "46%", flexGrow: 1 },
});

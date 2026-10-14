import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";

// Read-only block for a booking's add-ons, the customer's own notes and the
// amount still to collect in person. Renders nothing when there is nothing to
// show, so bookings without add-ons/notes look exactly as before.
// Money in integer cents (backend fields).

interface BookingExtrasBlockProps {
  addons?: { id: string; name: string; priceCents: number }[] | null;
  customerDetails?: string | null;
  inPersonDueCents?: number | null;
  // "Collect in person" for the provider, "Pay at appointment" for the customer.
  inPersonLabel: string;
  textColor: string;
  dimColor: string;
  accentColor: string;
  borderColor: string;
  style?: StyleProp<ViewStyle>;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function BookingExtrasBlock({
  addons,
  customerDetails,
  inPersonDueCents,
  inPersonLabel,
  textColor,
  dimColor,
  accentColor,
  borderColor,
  style,
}: BookingExtrasBlockProps) {
  const list = addons ?? [];
  const details = customerDetails?.trim() ? customerDetails : null;
  const inPerson = typeof inPersonDueCents === "number" && inPersonDueCents > 0 ? inPersonDueCents : null;
  if (list.length === 0 && !details && inPerson === null) return null;

  return (
    <View style={[styles.block, { borderTopColor: borderColor }, style]}>
      {list.length > 0 ? (
        <>
          <Text style={[styles.heading, { color: dimColor }]}>Add-ons</Text>
          {list.map((a) => (
            <View key={a.id} style={styles.row}>
              <Text style={[styles.rowText, { color: textColor, flex: 1 }]} numberOfLines={2}>+ {a.name}</Text>
              <Text style={[styles.rowText, { color: textColor }]}>{money(a.priceCents)}</Text>
            </View>
          ))}
        </>
      ) : null}
      {details ? (
        <>
          <Text style={[styles.heading, { color: dimColor, marginTop: list.length > 0 ? 8 : 0 }]}>Customer details</Text>
          <Text style={[styles.rowText, { color: textColor }]}>{details}</Text>
        </>
      ) : null}
      {inPerson !== null ? (
        <View style={[styles.row, { marginTop: list.length > 0 || details ? 8 : 0 }]}>
          <Text style={[styles.rowText, { color: accentColor, fontWeight: "600", flex: 1 }]}>{inPersonLabel}</Text>
          <Text style={[styles.rowText, { color: accentColor, fontWeight: "600" }]}>{money(inPerson)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10 },
  heading: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  rowText: { fontSize: 13, lineHeight: 18 },
});

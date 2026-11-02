import React from "react";
import { Linking, type StyleProp, type TextStyle } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { EVENT_GOLD } from "@/components/events/eventColors";
import { REFUND_POLICY_URL, TICKET_TERMS_LEAD } from "@/utils/eventsLogic";

/**
 * "By getting tickets or RSVPing (By paying), you agree to the Terms of Service and the Refund Policy."
 * Terms of Service opens the app's own screen (onOpenTerms); the Refund Policy opens goutsyde.com.
 */
export default function TicketTermsLine({
  kind,
  onOpenTerms,
  style,
}: {
  kind: keyof typeof TICKET_TERMS_LEAD;
  onOpenTerms: () => void;
  style?: StyleProp<TextStyle>;
}) {
  const { theme } = useTheme();
  const link = { color: EVENT_GOLD, fontWeight: "600" as const };
  return (
    <ThemedText
      style={[
        { fontSize: 12, lineHeight: 17, color: theme.textSecondary },
        style,
      ]}
      testID={`ticket-terms-${kind}`}
    >
      {TICKET_TERMS_LEAD[kind]}
      <ThemedText onPress={onOpenTerms} accessibilityRole="link" style={link}>
        Terms of Service
      </ThemedText>
      {" and the "}
      <ThemedText
        onPress={() => Linking.openURL(REFUND_POLICY_URL).catch(() => {})}
        accessibilityRole="link"
        style={link}
      >
        Refund Policy
      </ThemedText>
      .
    </ThemedText>
  );
}

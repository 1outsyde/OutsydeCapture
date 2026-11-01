/**
 * The Event Team note (p4-team step 9d-3, mockup H; same card as goutsyde.com app/events/_host/TeamNoteCard.tsx):
 * its numbered points and, when `onAccept` is given, an I accept button. Used on the invite screen (DoorInviteScreen)
 * and their event page (MyTeamScreen). Above an Accept that also joins, the screen passes no `onAccept` and its own
 * button says "Accept and join" (call 84). Text comes from the backend (GET /api/events/team-note) as plain text.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { ErrorText, PrimaryButton, hostStyles } from "@/components/host/hostUi";
import type { TeamNote } from "@/utils/host/teamNoteLogic";

export default function TeamNoteCard({
  note,
  onAccept,
  busy,
  error,
  testID = "team-note",
}: {
  note: TeamNote;
  onAccept?: () => void;
  busy?: boolean;
  error?: string | null;
  testID?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        st.card,
        { borderColor: theme.border, backgroundColor: theme.backgroundDefault },
      ]}
      testID={testID}
      accessibilityLabel={note.title}
    >
      <ThemedText
        style={[
          hostStyles.section,
          { color: theme.textSecondary, fontSize: 12 },
        ]}
        accessibilityRole="header"
      >
        {note.title.toUpperCase()}
      </ThemedText>
      {note.intro ? (
        <ThemedText style={{ fontSize: 14, color: theme.textSecondary }}>
          {note.intro}
        </ThemedText>
      ) : null}
      <View style={{ gap: 6 }}>
        {note.points.map((p, i) => (
          <View key={i} style={st.row}>
            <ThemedText
              style={[st.num, { color: theme.textSecondary }]}
            >{`${i + 1}.`}</ThemedText>
            <ThemedText style={st.point}>{p}</ThemedText>
          </View>
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {onAccept ? (
        <PrimaryButton
          label={busy ? "Saving…" : "I accept"}
          busy={busy}
          disabled={busy}
          onPress={onAccept}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  row: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  num: { fontSize: 14, lineHeight: 20, minWidth: 18 },
  point: { flex: 1, fontSize: 14, lineHeight: 20 },
});

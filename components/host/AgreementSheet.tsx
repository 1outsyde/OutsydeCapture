/**
 * Event Host Agreement on Publish (Events canvas 31, Legend 2026-10-26): pops up with the text from the backend.
 * "Agree and publish" turns on only after the text was scrolled to the end (or fits) and the box is checked.
 */
import React, { useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { ErrorText, GOLD, Hint, ON_GOLD, PrimaryButton, TextButton } from "@/components/host/hostUi";
import { parseAgreement, type Inline } from "@/utils/host/agreementText";
import { isScrolledToEnd } from "@/utils/host/editorLogic";

export interface Agreement { version: string; title: string; text: string; accepted: boolean; acceptedAt: string | null }

export function toAgreement(a: unknown): Agreement | null {
  const x = a as Record<string, unknown> | null;
  if (!x || typeof x.version !== "string" || typeof x.text !== "string") return null;
  return {
    version: x.version,
    title: typeof x.title === "string" ? x.title : "Event Host Agreement",
    text: x.text,
    accepted: x.accepted === true,
    acceptedAt: typeof x.acceptedAt === "string" ? x.acceptedAt : null,
  };
}

function Inlines({ parts, color, link }: { parts: Inline[]; color: string; link: string }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === "text") return <Text key={i}>{p.v}</Text>;
        if (p.t === "bold") return <Text key={i} style={{ fontWeight: "700" }}><Inlines parts={p.c} color={color} link={link} /></Text>;
        return (
          <Text key={i} style={{ color: link, textDecorationLine: "underline" }} accessibilityRole="link"
            onPress={() => Linking.openURL(p.href).catch(() => {})}>
            <Inlines parts={p.c} color={color} link={link} />
          </Text>
        );
      })}
    </>
  );
}

export function AgreementText({ text }: { text: string }) {
  const { theme } = useTheme();
  const blocks = useMemo(() => parseAgreement(text), [text]);
  const base = { color: theme.text, fontSize: 14, lineHeight: 21 };
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((b, i) => {
        if (b.t === "h") return <Text key={i} style={[base, { fontSize: 15, fontWeight: "700", marginTop: 6 }]} accessibilityRole="header"><Inlines parts={b.c} color={theme.text} link={theme.brandGold} /></Text>;
        if (b.t === "p") return <Text key={i} style={base}><Inlines parts={b.c} color={theme.text} link={theme.brandGold} /></Text>;
        const ordered = b.t === "ol";
        const start = ordered ? (b as { start: number }).start : 1;
        return (
          <View key={i} style={{ gap: 6 }}>
            {b.items.map((it, j) => (
              <View key={j} style={{ flexDirection: "row", gap: 8 }}>
                <Text style={base}>{ordered ? `${start + j}.` : "•"}</Text>
                <Text style={[base, { flex: 1 }]}><Inlines parts={it} color={theme.text} link={theme.brandGold} /></Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default function AgreementSheet({ visible, agreement, loadError, notice, working, onRetry, onAgree, onClose }: {
  visible: boolean;
  agreement: Agreement | null;
  loadError: string | null;
  notice: string | null;
  /** Accepting, then publishing. */
  working: boolean;
  onRetry: () => void;
  onAgree: () => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [read, setRead] = useState(false);
  const [checked, setChecked] = useState(false);
  const box = useRef({ h: 0, content: 0 });
  const version = agreement?.version ?? "";
  const [seen, setSeen] = useState(version);
  if (seen !== version) {
    // A new version came in (it was updated while the sheet was open): read it again.
    setSeen(version);
    setRead(false);
    setChecked(false);
  }

  const fits = () => {
    const { h, content } = box.current;
    if (h > 0 && content > 0 && isScrolledToEnd(0, h, content)) setRead(true);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (!read && isScrolledToEnd(contentOffset.y, layoutMeasurement.height, contentSize.height)) setRead(true);
  };
  const helper = working ? "Accepted. Publishing your event." : read ? "You can accept it now." : "Scroll to the end of the agreement to accept it.";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={working ? undefined : onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[s.sheet, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
        <View style={s.head}>
          <ThemedText style={s.title} accessibilityRole="header">{agreement?.title ?? "Event Host Agreement"}</ThemedText>
          <Pressable onPress={onClose} disabled={working} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>
        <Hint>Read it to the end to publish. You only accept it once.</Hint>
        {notice ? <ErrorText>{notice}</ErrorText> : null}

        {!agreement && !loadError ? <Hint style={{ paddingVertical: 24 }}>Loading the Event Host Agreement…</Hint> : null}
        {!agreement && loadError ? (
          <View style={{ gap: 8, paddingVertical: 16 }}>
            <ErrorText>{loadError}</ErrorText>
            <TextButton label="Try again" gold onPress={onRetry} />
          </View>
        ) : null}

        {agreement ? (
          <>
            <ScrollView
              style={[s.box, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
              contentContainerStyle={{ padding: 14 }}
              onScroll={onScroll}
              scrollEventThrottle={64}
              onLayout={(e) => { box.current.h = e.nativeEvent.layout.height; fits(); }}
              onContentSizeChange={(_, h) => { box.current.content = h; fits(); }}
              accessibilityLabel="Event Host Agreement text"
              testID="agreement-box"
            >
              <AgreementText text={agreement.text} />
            </ScrollView>
            <Pressable onPress={() => setChecked((c) => !c)} disabled={!read || working}
              accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !read || working }} style={s.check}>
              <View style={[s.checkBox, { borderColor: read ? GOLD : theme.border, backgroundColor: checked ? GOLD : "transparent" }]}>
                {checked ? <Feather name="check" size={16} color={ON_GOLD} /> : null}
              </View>
              <ThemedText style={{ flex: 1, fontSize: 15, color: read ? theme.text : theme.textSecondary }}>I have read and agree to the Event Host Agreement.</ThemedText>
            </Pressable>
            <Hint>{helper}</Hint>
            <PrimaryButton label={working ? "Publishing…" : "Agree and publish"} onPress={onAgree} disabled={!read || !checked} busy={working} />
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { maxHeight: "90%", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", flex: 1 },
  box: { maxHeight: 360, borderWidth: 1, borderRadius: 12 },
  check: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});

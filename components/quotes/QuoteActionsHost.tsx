// The quote pop-up on the main tabs (Quotes step 6c-2b, call 4; canvas artboard 10). Mounted once in
// MainTabNavigator next to PlanOfferHost. When the app opens or comes back to the front it reads what is waiting
// on the customer (GET /api/me/quote-actions, money first) and shows one thing at a time, only while Main is in
// front and no other blocking pop-up is open (it registers with the same modal coordinator). The main button opens
// the quote at that step; Not now puts it off until the next time the app opens.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { BorderRadius, Spacing } from "@/constants/theme";
import {
  isAnyOpenExcept,
  registerWhile,
  subscribe as subscribeModals,
} from "@/utils/modalCoordinator";
import {
  actionCopy,
  actionKey,
  nextAction,
  type QuoteAction,
} from "@/utils/requestLogic";

const KEY = "quote-actions";
const RECHECK_MS = 60 * 1000;

export default function QuoteActionsHost() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const mainFocused = useIsFocused();
  const { user, isAuthenticated, getToken } = useAuth();
  const signedIn = isAuthenticated && !!user && !user.isGuest;
  const uid = user?.id ?? null;
  // Kept with the account it was read for, so another account never sees it after a switch.
  const [data, setData] = useState<{ uid: string; list: QuoteAction[] } | null>(
    null,
  );
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [othersOpen, setOthersOpen] = useState(isAnyOpenExcept(KEY));
  const lastCheck = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    const sync = () => setOthersOpen(isAnyOpenExcept(KEY));
    sync();
    return subscribeModals(sync);
  }, []);

  const check = useCallback(
    async (force = false) => {
      if (!signedIn) return;
      if (!force && Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      const mine = ++seq.current;
      try {
        const token = await getToken();
        if (!token) return;
        const list = await api.getQuoteActions(token);
        if (mine === seq.current && uid) setData({ uid, list });
      } catch {
        // Best effort: nothing shows when the list can't be read.
      }
    },
    [signedIn, getToken, uid],
  );

  // On launch and sign in; each time the app comes back to the front is a new open (Not now is forgotten).
  useEffect(() => {
    // Signed out: nothing shows (shown is null), and a new sign in reads the list again.
    if (!signedIn) return;
    const t = setTimeout(() => check(true), 0);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        setSnoozed(new Set());
        check(true);
      }
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [signedIn, uid, check]);

  const shown =
    signedIn && data && data.uid === uid
      ? nextAction(data.list, snoozed)
      : null;
  const visible = !!shown && mainFocused && !othersOpen;
  useEffect(() => registerWhile(KEY, visible), [visible]);

  if (!shown) return null;
  const c = actionCopy(shown);
  const putOff = () => setSnoozed((s) => new Set(s).add(actionKey(shown)));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={putOff}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.brandBgElevated,
              borderColor: theme.brandSurfaceBorder,
            },
          ]}
          accessibilityViewIsModal
        >
          <ThemedText
            style={[
              styles.pill,
              { color: theme.brandGold, borderColor: theme.brandGold },
            ]}
          >
            {c.pill}
          </ThemedText>
          <ThemedText
            style={[styles.title, { color: theme.brandCream }]}
            accessibilityRole="header"
          >
            {c.title}
          </ThemedText>
          <ThemedText style={[styles.body, { color: theme.brandCream }]}>
            {c.body}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              putOff();
              navigation.navigate("Quote", {
                quoteId: shown.quoteId,
                start: c.start,
              });
            }}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: theme.brandGold, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <ThemedText style={[styles.btnText, { color: "#0B0B0B" }]}>
              {c.button}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={putOff}
            hitSlop={8}
            style={styles.later}
          >
            <ThemedText
              style={[styles.laterText, { color: theme.brandTextDim }]}
            >
              Not now
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.66)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  pill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  title: { fontSize: 18, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 21 },
  btn: {
    minHeight: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  btnText: { fontSize: 16, fontWeight: "800" },
  later: { alignSelf: "center", paddingVertical: Spacing.sm },
  laterText: { fontSize: 14, fontWeight: "600" },
});

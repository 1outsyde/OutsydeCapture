import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import {
  getPointsBalance,
  redeemPointsForCode,
  PointsActiveCode,
} from "@/services/api";

// "Use my points" at checkout (Outsyde loyalty rewards program).
// Rule (backend loyaltyLedger.ts, decided 2026-10-18), the same 10x rule everywhere:
//   - bookings: what is paid online now, before the service fee (the deposit, or the full price
//     when there is no deposit), must be at least 10 times the code
//   - products: the order (before the service fee) must be at least 10 times the code
// 500 points = $1. The backend re-checks everything; this only decides what to offer.

export type PointsPickerKind = "booking" | "order";

export interface SelectedPointsCode {
  id: string;
  code: string;
  discountCents: number;
}

const TIERS: readonly { points: number; discountCents: number }[] = [
  { points: 2500, discountCents: 500 },
  { points: 5000, discountCents: 1000 },
  { points: 12500, discountCents: 2500 },
  { points: 25000, discountCents: 5000 },
  { points: 50000, discountCents: 10000 },
];
const MIN_MULTIPLIER = 10;

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const whole = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : money(cents));

/** Why a code of this value can't be used here, or null when it can. */
export function pointsCodeBlockedReason(
  kind: PointsPickerKind,
  amountCents: number,
  discountCents: number,
): string | null {
  const minimum = discountCents * MIN_MULTIPLIER;
  if (kind === "booking") {
    // amountCents is due now (base + service fee); this recovers the base exactly, like the backend.
    const paidOnlineBase = Math.round(amountCents / 1.08);
    if (paidOnlineBase < minimum) return `For bookings of ${whole(minimum)} or more paid online`;
    return null;
  }
  if (amountCents < minimum) return `For orders of ${whole(minimum)} or more`;
  return null;
}

interface Props {
  kind: PointsPickerKind;
  /** booking: what is due now (deposit or full price plus the service fee). order: the order before the service fee. */
  amountCents: number | null;
  selected: SelectedPointsCode | null;
  onChange: (code: SelectedPointsCode | null) => void;
  disabled?: boolean;
  accentColor?: string;
  /** Bump to reload codes (e.g. after checkout said a code was taken). */
  refreshKey?: number;
  /** Codes checkout refused this session (e.g. held by a booking waiting for the business). */
  refusedCodeIds?: ReadonlySet<string>;
}

// apiPost throws Error("API Error <status>: <body>"). Pull the backend's message out of it.
function friendlyError(err: any): string {
  const fallback = "Your points couldn't be used right now.";
  const msg: string = typeof err?.message === "string" ? err.message : "";
  const start = msg.indexOf("{");
  if (start === -1) return fallback;
  try {
    const body = JSON.parse(msg.slice(start));
    if (typeof body?.error === "string" && body.error.length > 0) return body.error;
    if (typeof body?.error?.message === "string") return body.error.message;
  } catch {
    // not JSON
  }
  return fallback;
}

export default function UsePointsPicker({ kind, amountCents, selected, onChange, disabled, accentColor, refreshKey, refusedCodeIds }: Props) {
  const { theme } = useTheme();
  const { getToken: getTokenFn, isAuthenticated } = useAuth();
  // getToken is not memoized by AuthContext; keep one stable reference so loads only rerun on purpose.
  const getTokenRef = useRef(getTokenFn);
  getTokenRef.current = getTokenFn;
  const getToken = useCallback(() => getTokenRef.current(), []);
  const accent = accentColor ?? theme.brandGold;
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [codes, setCodes] = useState<PointsActiveCode[]>([]);
  const [working, setWorking] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const token = await getToken();
      const res = await getPointsBalance(token ?? "");
      setBalance(typeof res?.balance === "number" ? res.balance : 0);
      setCodes(Array.isArray(res?.activeCodes) ? res.activeCodes.filter((c) => typeof c.id === "string") : []);
    } catch {
      // No points section if the balance can't be read; checkout still works.
      setCodes([]);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [getToken, isAuthenticated]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Drop a selection that no longer fits (amount changed) or no longer exists.
  useEffect(() => {
    if (!selected || amountCents == null || loading) return;
    const stillThere = codes.some((c) => c.id === selected.id);
    if (!stillThere || pointsCodeBlockedReason(kind, amountCents, selected.discountCents)) onChange(null);
  }, [selected, amountCents, codes, kind, loading, onChange]);

  const sortedCodes = useMemo(() => [...codes].sort((a, b) => b.discountCents - a.discountCents), [codes]);
  const affordableTiers = useMemo(
    () => TIERS.filter((t) => t.points <= balance && !codes.some((c) => c.discountCents === t.discountCents)),
    [balance, codes],
  );

  const turnIntoCode = (tier: { points: number; discountCents: number }) => {
    Alert.alert(
      `Use ${tier.points.toLocaleString()} points?`,
      `They become a ${whole(tier.discountCents)} code, applied to this checkout. If you don't finish, the code stays in your account for 30 days.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: `Get ${whole(tier.discountCents)} off`,
          onPress: async () => {
            setWorking(tier.points);
            setMessage(null);
            try {
              const token = await getToken();
              const res: any = await redeemPointsForCode(token ?? "", tier.points);
              await load();
              if (typeof res?.codeId === "string") {
                onChange({ id: res.codeId, code: res.code, discountCents: res.discountCents ?? tier.discountCents });
              }
            } catch (err: any) {
              setMessage(friendlyError(err));
            } finally {
              setWorking(null);
            }
          },
        },
      ],
    );
  };

  if (!isAuthenticated || amountCents == null) return null;
  if (loading) {
    return (
      <View style={[styles.box, { borderColor: theme.brandSurfaceBorder, backgroundColor: theme.brandBgElevated }]}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }
  if (sortedCodes.length === 0 && affordableTiers.length === 0) return null;

  const row = (key: string, label: string, sub: string | null, active: boolean, blocked: string | null, onPress: () => void, busy = false) => {
    const off = !!blocked || disabled || working !== null;
    return (
      <Pressable
        key={key}
        onPress={() => !off && onPress()}
        disabled={off}
        accessibilityRole="radio"
        accessibilityState={{ checked: active, disabled: off }}
        style={[
          styles.row,
          { borderColor: active ? accent : theme.brandSurfaceBorder, opacity: blocked ? 0.5 : 1 },
        ]}
      >
        <Feather name={active ? "check-circle" : "circle"} size={18} color={active ? accent : theme.brandTextDim} />
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <ThemedText style={{ color: theme.brandCream, fontWeight: active ? "600" : "400" }}>{label}</ThemedText>
          {(blocked || sub) && (
            <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.xs }}>{blocked ?? sub}</ThemedText>
          )}
        </View>
        {busy && <ActivityIndicator size="small" color={accent} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.box, { borderColor: theme.brandSurfaceBorder, backgroundColor: theme.brandBgElevated }]}>
      <ThemedText style={{ color: theme.brandCream, fontWeight: "600" }}>Use my points</ThemedText>
      <ThemedText style={{ color: theme.brandTextDim, fontSize: FontSizes.sm, marginBottom: Spacing.sm }}>
        {`You have ${balance.toLocaleString()} points in Outsyde loyalty rewards.`}
      </ThemedText>
      {row("none", "Don't use points", null, !selected, null, () => onChange(null))}
      {sortedCodes.map((c) =>
        row(
          c.id!,
          `${whole(c.discountCents)} off`,
          "Code in your account",
          selected?.id === c.id,
          refusedCodeIds?.has(c.id!) ? "In use on another booking right now" : pointsCodeBlockedReason(kind, amountCents, c.discountCents),
          () => onChange({ id: c.id!, code: c.code, discountCents: c.discountCents }),
        ),
      )}
      {affordableTiers.map((t) =>
        row(
          `tier-${t.points}`,
          `${whole(t.discountCents)} off`,
          `Uses ${t.points.toLocaleString()} points`,
          false,
          pointsCodeBlockedReason(kind, amountCents, t.discountCents),
          () => turnIntoCode(t),
          working === t.points,
        ),
      )}
      {message && <ThemedText style={{ color: theme.brandError, fontSize: FontSizes.sm, marginTop: Spacing.xs }}>{message}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
});

// Admin: referrals in the app (App Admin Step 8). Same routes, labels, filters and buttons as goutsyde.com
// /admin/referrals: totals, Needs attention, Businesses and Friends with search. $25 business payouts can be
// paused, released, cancelled or retried, each behind a confirm; the payout job sends the money, never this screen.
// Friend referrals are view only (Legend, 2026-10-24). Logic: utils/adminReferrals.ts.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { pushErrorText } from "@/utils/adminPush";
import {
  ACTION_COPY,
  BIZ_FILTERS,
  actionsFor,
  at,
  attentionCopy,
  filterBusiness,
  filterFriends,
  friendPill,
  payoutPill,
  referralPill,
  shortDate,
  usd,
  type ActionButton,
  type AdminAction,
  type AdminBusinessReferral,
  type AdminReferralsData,
  type Pill,
} from "@/utils/adminReferrals";

type Tab = "business" | "friends";
type Notice = { kind: "ok" | "error"; text: string };

// Set before the first await so a fast double tap can't start a second payout action. One Referrals screen is
// open at a time, and finally always clears it. Module level (not a ref) so the compiler lint accepts it.
const actionLock = { on: false };

export default function AdminReferralsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const C = useMemo(
    () => ({
      bg: theme.brandBg,
      card: theme.brandBgElevated,
      border: theme.brandSurfaceBorder,
      text: theme.brandCream,
      dim: theme.brandCream + "B3",
      gold: theme.brandGold,
      goldText: isDark ? theme.brandGold : theme.brandGoldDim,
      onGold: isDark ? theme.brandBg : theme.brandCream,
      error: theme.brandError,
      success: theme.brandSuccess,
    }),
    [theme, isDark],
  );

  const [data, setData] = useState<AdminReferralsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("business");
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return setLoadError("Sign in again to see referrals.");
    }
    try {
      setData(await api.getAdminReferrals(token));
      setLoadError(null);
    } catch (err: any) {
      setLoadError(
        err?.status === 403
          ? "Only Outsyde admins can see referrals."
          : pushErrorText(err, "Couldn't load referrals."),
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(
    async (kind: AdminAction, payoutId: string) => {
      if (actionLock.on) return;
      actionLock.on = true;
      setBusy(true);
      try {
        const token = await getToken();
        if (!token) {
          setNotice({ kind: "error", text: "Sign in again, then try again." });
          return;
        }
        await api.adminReferralPayoutAction(token, payoutId, kind);
        setNotice({ kind: "ok", text: ACTION_COPY[kind].done });
      } catch (err: any) {
        // No answer means we don't know if it went through: say so, and reload to show where it stands.
        const text =
          typeof err?.status !== "number"
            ? "Couldn't reach the server. Reload to see where this stands before trying again."
            : err?.message === "Retry after refresh failed"
              ? "Couldn't do that. Reload to see where this stands."
              : pushErrorText(
                  err,
                  "Couldn't update this payout. Reload and try again.",
                );
        setNotice({ kind: "error", text });
      } finally {
        setConfirm(null);
        await load();
        setBusy(false);
        actionLock.on = false;
      }
    },
    [getToken, load],
  );

  const business = useMemo(
    () => (data ? filterBusiness(data.business, filter, search) : []),
    [data, filter, search],
  );
  const friends = useMemo(
    () => (data ? filterFriends(data.friends, search) : []),
    [data, search],
  );
  const byPayout = useMemo(() => {
    const m = new Map<string, AdminBusinessReferral>();
    for (const b of data?.business ?? []) if (b.payout) m.set(b.payout.id, b);
    return m;
  }, [data]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: insets.bottom + 40, gap: 16 },
    line: { fontSize: 14, color: C.dim, lineHeight: 20 },
    err: { fontSize: 14, color: C.error, lineHeight: 20 },
    heading: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: C.dim,
    },
    headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    count: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.gold,
    },
    countText: { fontSize: 12, fontWeight: "700", color: C.onGold },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    tile: {
      flexGrow: 1,
      flexBasis: "45%",
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    tileLabel: { fontSize: 12, fontWeight: "600", color: C.dim },
    tileValue: { fontSize: 22, fontWeight: "700", color: C.text },
    tileHint: { fontSize: 12, color: C.dim, lineHeight: 16 },
    card: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 14,
      padding: 16,
      gap: 10,
    },
    attnTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    attnKind: {
      fontSize: 13,
      fontWeight: "700",
      color: C.goldText,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    attnAmt: { fontSize: 15, fontWeight: "700", color: C.text },
    title: { fontSize: 15, fontWeight: "600", color: C.text },
    notice: {
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    tabs: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    tabBtn: {
      flex: 1,
      minHeight: 40,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBtnOn: { backgroundColor: C.gold },
    tabText: { fontSize: 14, fontWeight: "600", color: C.dim },
    tabTextOn: { color: C.onGold },
    input: {
      minHeight: 44,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 15,
      color: C.text,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.card,
    },
    chipOn: { backgroundColor: C.gold, borderColor: C.gold },
    chipText: { fontSize: 13, fontWeight: "600", color: C.dim },
    chipTextOn: { color: C.onGold },
    row: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 6,
    },
    pills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center",
    },
    pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    pillText: { fontSize: 12, fontWeight: "700" },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    btn: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    btnText: { fontSize: 15, fontWeight: "600" },
    confirmBox: { gap: 8, marginTop: 4 },
    foot: { fontSize: 13, color: C.dim, lineHeight: 19 },
  });

  const toneColor = (tone: Pill["tone"]) =>
    tone === "green"
      ? C.success
      : tone === "red"
        ? C.error
        : tone === "gold"
          ? C.goldText
          : C.dim;
  const pill = (p: Pill, key?: string) => (
    <View
      key={key}
      style={[styles.pill, { backgroundColor: toneColor(p.tone) + "26" }]}
    >
      <Text style={[styles.pillText, { color: toneColor(p.tone) }]}>
        {p.text}
      </Text>
    </View>
  );

  const button = (
    label: string,
    tone: ActionButton["tone"],
    onPress: () => void,
    key?: string,
  ) => {
    const box =
      tone === "gold"
        ? { backgroundColor: C.gold, borderColor: C.gold }
        : tone === "danger"
          ? { backgroundColor: "transparent", borderColor: C.error }
          : { backgroundColor: C.bg, borderColor: C.border };
    const color =
      tone === "gold" ? C.onGold : tone === "danger" ? C.error : C.text;
    return (
      <Pressable
        key={key}
        style={[styles.btn, box, busy && { opacity: 0.5 }]}
        disabled={busy}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
      >
        <Text style={[styles.btnText, { color }]}>{label}</Text>
      </Pressable>
    );
  };

  const renderButtons = (payoutId: string, buttons: ActionButton[]) => {
    if (!buttons.length) return null;
    const pending = buttons.find((b) => confirm === `${b.kind}:${payoutId}`);
    if (pending) {
      const copy = ACTION_COPY[pending.kind];
      return (
        <View style={styles.confirmBox}>
          <Text style={[styles.line, { color: C.text }]}>{copy.confirm}</Text>
          <View style={styles.actions}>
            {busy ? (
              <ActivityIndicator color={C.gold} />
            ) : (
              <>
                {button(
                  `Yes, ${copy.label.toLowerCase()}`,
                  pending.tone === "danger" ? "danger" : "gold",
                  () => run(pending.kind, payoutId),
                  "yes",
                )}
                {button("Keep it", "ghost", () => setConfirm(null), "keep")}
              </>
            )}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.actions}>
        {buttons.map((b) =>
          button(
            ACTION_COPY[b.kind].label,
            b.tone,
            () => setConfirm(`${b.kind}:${payoutId}`),
            b.kind,
          ),
        )}
      </View>
    );
  };

  if (loading && !data) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  const refresh = (
    <RefreshControl
      refreshing={false}
      onRefresh={() => {
        if (!busy) load();
      }}
      tintColor={C.gold}
    />
  );

  if (!data) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={refresh}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{"Couldn't load referrals"}</Text>
          {loadError ? <Text style={styles.err}>{loadError}</Text> : null}
          {button("Try again", "gold", () => {
            setLoading(true);
            load();
          })}
        </View>
      </ScrollView>
    );
  }

  const t = data.totals;
  const tiles: { label: string; value: string; hint: string }[] = [
    {
      label: "Businesses referred",
      value: String(t.business.invited),
      hint: `${t.business.pending} not live yet`,
    },
    {
      label: "Qualified",
      value: String(t.business.qualified),
      hint: `${t.business.blocked} blocked, ${t.business.expired} expired`,
    },
    {
      label: "Paid out",
      value: usd(t.payouts.paidCents),
      hint: `${t.payouts.cancelled} cancelled`,
    },
    {
      label: "Coming up",
      value: usd(t.payouts.upcomingCents),
      hint: `${usd(t.payouts.pausedCents)} paused, ${usd(t.payouts.reviewCents)} need a look`,
    },
    {
      label: "Friend points given",
      value: t.friends.pointsAwarded.toLocaleString("en-US"),
      hint: `${t.friends.completed} of ${t.friends.total} friends`,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={refresh}
    >
      <Text style={styles.line}>
        Business referrals pay $25 cash 7 days after they qualify. Friend
        referrals pay 2,500 points each.
      </Text>

      {notice ? (
        <View
          style={[
            styles.notice,
            {
              borderColor: (notice.kind === "ok" ? C.success : C.error) + "66",
              backgroundColor:
                (notice.kind === "ok" ? C.success : C.error) + "1A",
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.line, { flex: 1, color: C.text }]}>
            {notice.text}
          </Text>
          <Pressable
            onPress={() => setNotice(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text
              style={[styles.line, { color: C.goldText, fontWeight: "600" }]}
            >
              OK
            </Text>
          </Pressable>
        </View>
      ) : null}
      {loadError ? <Text style={styles.err}>{loadError}</Text> : null}

      <View style={styles.tiles}>
        {tiles.map((x) => (
          <View
            key={x.label}
            style={styles.tile}
            accessible
            accessibilityLabel={`${x.label}: ${x.value}. ${x.hint}`}
          >
            <Text style={styles.tileLabel}>{x.label}</Text>
            <Text style={styles.tileValue}>{x.value}</Text>
            <Text style={styles.tileHint}>{x.hint}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <View style={styles.headRow}>
          <Text style={styles.heading} accessibilityRole="header">
            Needs attention
          </Text>
          {data.attention.length > 0 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{data.attention.length}</Text>
            </View>
          ) : null}
        </View>
        {data.attention.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.line}>Nothing needs you right now.</Text>
          </View>
        ) : (
          data.attention.map((a) => {
            const c = attentionCopy(a.kind);
            const b = byPayout.get(a.payoutId);
            return (
              <View key={`${a.kind}-${a.payoutId}`} style={styles.card}>
                <View style={styles.attnTop}>
                  <Text style={styles.attnKind}>{c.title}</Text>
                  <Text style={styles.attnAmt}>
                    {b?.payout ? usd(b.payout.amountCents) : "$25"}
                  </Text>
                </View>
                <Text style={styles.title}>
                  {a.businessName}, referred by {at(a.referrer)}
                </Text>
                <Text style={styles.line}>
                  {c.why}
                  {a.since ? ` Due since ${shortDate(a.since)}.` : ""}
                </Text>
                {a.kind === "review" && a.detail ? (
                  <Text style={styles.err}>{a.detail}</Text>
                ) : null}
                {b ? renderButtons(a.payoutId, actionsFor(b)) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(["business", "friends"] as Tab[]).map((k) => {
          const on = tab === k;
          const label =
            k === "business"
              ? `Businesses (${data.business.length})`
              : `Friends (${data.friends.length})`;
          return (
            <Pressable
              key={k}
              style={[styles.tabBtn, on && styles.tabBtnOn]}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder={
          tab === "business"
            ? "Search business or @username"
            : "Search @username"
        }
        placeholderTextColor={C.dim}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search referrals"
      />

      {tab === "business" ? (
        <>
          <View
            style={styles.chips}
            accessibilityLabel="Filter business referrals"
          >
            {BIZ_FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.card}>
            {business.length === 0 ? (
              <Text style={styles.line}>
                {data.business.length === 0
                  ? "No business referrals yet."
                  : "No referrals match."}
              </Text>
            ) : (
              business.map((b) => (
                <View key={b.id} style={styles.row}>
                  <Text style={styles.title}>{b.businessName}</Text>
                  <Text style={styles.line}>
                    Referred by {at(b.referrer.username)}, owner{" "}
                    {at(b.owner.username)}
                    {b.createdAt ? `, signed up ${shortDate(b.createdAt)}` : ""}
                  </Text>
                  <View style={styles.pills}>
                    {pill(referralPill(b), "r")}
                    {b.payout ? pill(payoutPill(b.payout), "p") : null}
                    {b.status === "pending" && b.expiresAt ? (
                      <Text style={styles.line}>
                        by {shortDate(b.expiresAt)}
                      </Text>
                    ) : null}
                  </View>
                  {b.payout &&
                  (b.payout.attempts > 0 ||
                    b.payout.account ||
                    b.payout.transfer) ? (
                    <Text style={styles.line}>
                      {b.payout.attempts > 0
                        ? `${b.payout.attempts} tries. `
                        : ""}
                      {b.payout.account ? `Account ${b.payout.account}. ` : ""}
                      {b.payout.transfer
                        ? `Transfer ${b.payout.transfer}.`
                        : ""}
                    </Text>
                  ) : null}
                  {b.payout ? renderButtons(b.payout.id, actionsFor(b)) : null}
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <View style={styles.card}>
          {friends.length === 0 ? (
            <Text style={styles.line}>
              {data.friends.length === 0
                ? "No friend referrals yet."
                : "No referrals match."}
            </Text>
          ) : (
            friends.map((f) => (
              <View key={f.id} style={styles.row}>
                <Text style={styles.title}>
                  {at(f.referrer.username)} invited {at(f.friend.username)}
                </Text>
                <Text style={styles.line}>
                  {f.referrerPoints.toLocaleString("en-US")} points each
                  {f.createdAt ? `, joined ${shortDate(f.createdAt)}` : ""}
                  {f.paidAt ? `, points given ${shortDate(f.paidAt)}` : ""}
                </Text>
                <View style={styles.pills}>{pill(friendPill(f))}</View>
              </View>
            ))
          )}
        </View>
      )}

      <Text style={styles.foot}>
        Pause stops a payout until you release it. Cancel means no money goes
        out and can{"'"}t be undone. While a payout may be sending, its buttons
        are hidden for a few minutes. Every action is recorded in the audit log.
      </Text>
    </ScrollView>
  );
}

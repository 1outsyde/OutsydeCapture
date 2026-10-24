import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import { EVENT_CREAM, EVENT_GOLD, EVENT_GREEN, EVENT_GREEN_TEXT } from "@/components/events/eventColors";
import {
  defaultTicketId,
  eventBanner,
  eventErrorCopy,
  eventPageBar,
  maxQty,
  minQty,
  rangeLine,
  refundLine,
  revealLine,
  rsvpKeyNext,
  ticketRow,
  type EventPage,
} from "@/utils/eventsLogic";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Phase = "loading" | "ready" | "notfound" | "error";

const followType = (kind: string): "user" | "photographer" | "business" =>
  kind === "business" ? "business" : kind === "photographer" ? "photographer" : "user";

/** Event page in the app (canvas 23). Free RSVP works here; paid checkout comes with p4-buy. */
export default function EventDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { slug } = useRoute<RouteProp<RootStackParamList, "EventDetail">>().params;
  const { getToken, isAuthenticated } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [phase, setPhase] = useState<Phase>("loading");
  const [page, setPage] = useState<EventPage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [going, setGoing] = useState(false);
  const [msg, setMsg] = useState("");
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const token = await getTokenRef.current().catch(() => null);
      const res = await api.getEventBySlug(slug, token);
      if (mine !== seq.current) return;
      setPage(res);
      setPhase("ready");
      setSelectedId((cur) => cur ?? defaultTicketId(res.ticketTypes));
      const followId = res.event.host?.followId;
      if (token && followId && !res.event.viewerIsHost) {
        const f = await api.checkFollowStatus(followId, token);
        if (mine === seq.current) setFollowing(!!f.isFollowing);
      }
    } catch (err: any) {
      if (mine !== seq.current) return;
      setPhase(err?.status === 404 ? "notfound" : "error");
    }
  }, [slug]);

  // Reload whenever the page comes back into view (after signing in, viewerHasTicket changes).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const e = page?.event;
  const types = page?.ticketTypes ?? [];
  const selected = useMemo(() => types.find((t) => t.id === selectedId) ?? null, [types, selectedId]);

  useEffect(() => {
    if (selected) setQty((q) => Math.min(Math.max(q, minQty(selected)), maxQty(selected)));
  }, [selected]);

  const pick = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    keyRef.current = rsvpKeyNext(keyRef.current, "changed");
    setMsg("");
  };

  const changeQty = (next: number) => {
    setQty(next);
    keyRef.current = rsvpKeyNext(keyRef.current, "changed");
  };

  const rsvp = async () => {
    if (!e || !selected || busy) return;
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    setBusy(true);
    setMsg("");
    keyRef.current = rsvpKeyNext(keyRef.current, "attempt");
    try {
      const token = await getTokenRef.current();
      if (!token) {
        navigation.navigate("Auth", {});
        return;
      }
      await api.rsvpEvent(e.id, { ticketTypeId: selected.id, quantity: qty, idempotencyKey: keyRef.current as string }, token);
      keyRef.current = rsvpKeyNext(keyRef.current, "success");
      setGoing(true);
      load();
    } catch (err: any) {
      if (err?.status === 401) navigation.navigate("Auth", {});
      else setMsg(eventErrorCopy(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleFollow = async () => {
    const followId = e?.host?.followId;
    if (!followId || followBusy) return;
    if (!isAuthenticated) {
      navigation.navigate("Auth", {});
      return;
    }
    setFollowBusy(true);
    const want = !following;
    setFollowing(want);
    try {
      const token = await getTokenRef.current();
      if (want) await api.followUser(followId, followType(e!.host.kind), token);
      else await api.unfollowUser(followId, token);
    } catch {
      setFollowing(!want);
    } finally {
      setFollowBusy(false);
    }
  };

  const share = () => {
    Share.share({ message: `https://goutsyde.com/e/${slug}` }).catch(() => {});
  };

  const back = (
    <Pressable
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={[styles.circle, { top: insets.top + 8, left: 16 }]}
    >
      <Feather name="chevron-left" size={22} color={EVENT_CREAM} />
    </Pressable>
  );

  if (phase !== "ready" || !e) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        {back}
        {phase === "loading" ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <>
            <ThemedText style={[styles.centerTitle, { color: theme.text }]}>
              {phase === "notfound" ? "This event isn't available." : "This event could not be loaded."}
            </ThemedText>
            {phase === "error" ? (
              <Pressable onPress={() => { setPhase("loading"); load(); }} accessibilityRole="button" style={styles.greenButton}>
                <ThemedText style={styles.greenButtonText}>Try again</ThemedText>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    );
  }

  const now = new Date();
  const banner = eventBanner(e, now);
  const bar = eventPageBar(e, types, selectedId, going, now);
  const holder = going || e.viewerHasTicket;
  const place = [e.city, e.state].filter(Boolean).join(", ");
  const canFollow = !!e.host?.followId && !e.viewerIsHost;
  const showQty = bar.kind === "rsvp" && selected && maxQty(selected) > 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bar.kind === "none" ? insets.bottom + 32 : 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          {e.coverImageUrl ? (
            <Image source={{ uri: e.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <ThemedText style={styles.coverLabel}>Event</ThemedText>
          )}
        </View>

        <View style={styles.body}>
          {banner ? (
            <View style={[styles.banner, { borderColor: theme.border }]}>
              <ThemedText style={[styles.bannerText, { color: theme.text }]}>{banner}</ThemedText>
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <ThemedText style={[styles.when, { color: theme.brandGold }]}>{rangeLine(e)}</ThemedText>
            <ThemedText style={[styles.title, { color: theme.text }]}>{e.title}</ThemedText>
          </View>

          <View style={styles.hostRow}>
            <View style={styles.hostWho}>
              {e.host.avatarUrl ? (
                <Image source={{ uri: e.host.avatarUrl }} style={styles.hostAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.hostAvatar, { backgroundColor: EVENT_GREEN }]}>
                  <ThemedText style={styles.hostLetter}>{e.host.name.replace(/^@/, "").charAt(0).toUpperCase()}</ThemedText>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText style={[styles.hostName, { color: theme.text }]} numberOfLines={1}>{e.host.name}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.textSecondary }]}>Host</ThemedText>
              </View>
            </View>
            {canFollow ? (
              <Pressable
                onPress={toggleFollow}
                disabled={followBusy}
                accessibilityRole="button"
                accessibilityState={{ selected: following, busy: followBusy }}
                style={[styles.follow, following ? styles.followingBtn : styles.followBtn]}
              >
                <ThemedText style={[styles.followText, { color: following ? theme.text : EVENT_CREAM }]}>
                  {following ? "Following" : "Follow"}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {holder ? (
            <View style={styles.going}>
              <Feather name="check-circle" size={20} color={EVENT_GREEN_TEXT} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.goingTitle}>You're going</ThemedText>
                <ThemedText style={styles.goingText}>Your confirmation is in your email.</ThemedText>
              </View>
            </View>
          ) : null}

          <View style={[styles.place, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="map-pin" size={20} color={theme.brandGold} />
            <View style={{ flex: 1, gap: 2 }}>
              {e.addressHidden ? (
                <>
                  <ThemedText style={[styles.placeMain, { color: theme.text }]}>{place || "Location to be announced"}</ThemedText>
                  <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
                    {e.addressRevealAt ? `${revealLine(e.addressRevealAt, e.timezone)}.` : "The exact address is shared once you have a ticket."}
                  </ThemedText>
                </>
              ) : (
                <>
                  {e.venueName ? <ThemedText style={[styles.placeMain, { color: theme.text }]}>{e.venueName}</ThemedText> : null}
                  {[e.addressLine1, e.addressLine2].filter(Boolean).map((l) => (
                    <ThemedText key={l as string} style={[styles.small, { color: theme.textSecondary }]}>{l}</ThemedText>
                  ))}
                  <ThemedText style={[styles.small, { color: theme.textSecondary }]}>
                    {[place, e.postalCode].filter(Boolean).join(" ") || "Location to be announced"}
                  </ThemedText>
                </>
              )}
            </View>
          </View>

          {types.length > 0 ? (
            <View>
              <ThemedText style={[styles.section, { color: theme.textSecondary }]}>TICKETS</ThemedText>
              {types.map((t) => {
                const row = ticketRow(t, e.timezone);
                const canPick = row.selectable && !holder && bar.kind !== "none";
                const on = canPick && t.id === selectedId;
                const muted = !row.selectable && !row.paid;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => canPick && pick(t.id)}
                    disabled={!canPick}
                    accessibilityRole={canPick ? "radio" : "text"}
                    accessibilityState={canPick ? { selected: on } : undefined}
                    style={[styles.ticket, { borderColor: on ? EVENT_GOLD : theme.border }]}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <ThemedText style={[styles.ticketName, { color: muted ? theme.textSecondary : theme.text }]}>{t.name}</ThemedText>
                      {row.sub ? <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{row.sub}</ThemedText> : null}
                      {t.description ? <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{t.description}</ThemedText> : null}
                    </View>
                    <ThemedText style={[styles.ticketRight, { color: muted ? theme.textSecondary : theme.text }]}>{row.right}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {showQty && selected ? (
            <View style={styles.qtyRow}>
              <ThemedText style={[styles.placeMain, { color: theme.text }]}>How many</ThemedText>
              <View style={styles.qtyCtl}>
                <Pressable
                  onPress={() => changeQty(qty - 1)}
                  disabled={qty <= minQty(selected)}
                  accessibilityRole="button"
                  accessibilityLabel="One less"
                  style={[styles.qtyBtn, { borderColor: theme.border, opacity: qty <= minQty(selected) ? 0.4 : 1 }]}
                >
                  <Feather name="minus" size={18} color={theme.text} />
                </Pressable>
                <ThemedText style={[styles.qtyValue, { color: theme.text }]}>{qty}</ThemedText>
                <Pressable
                  onPress={() => changeQty(qty + 1)}
                  disabled={qty >= maxQty(selected)}
                  accessibilityRole="button"
                  accessibilityLabel="One more"
                  style={[styles.qtyBtn, { borderColor: theme.border, opacity: qty >= maxQty(selected) ? 0.4 : 1 }]}
                >
                  <Feather name="plus" size={18} color={theme.text} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {msg ? <ThemedText style={[styles.error, { color: theme.error }]} accessibilityRole="alert">{msg}</ThemedText> : null}

          {e.description ? <ThemedText style={[styles.about, { color: theme.text }]}>{e.description}</ThemedText> : null}
          <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{refundLine(e)}</ThemedText>
        </View>
      </ScrollView>

      {back}
      <Pressable
        onPress={share}
        accessibilityRole="button"
        accessibilityLabel="Share event"
        style={[styles.circle, { top: insets.top + 8, right: 16 }]}
      >
        <Feather name="share" size={20} color={EVENT_CREAM} />
      </Pressable>

      {bar.kind !== "none" ? (
        <View style={[styles.bar, { backgroundColor: theme.backgroundRoot, borderTopColor: theme.border, paddingBottom: insets.bottom + 14 }]}>
          <View>
            <ThemedText style={[styles.small, { color: theme.textSecondary }]}>{bar.label}</ThemedText>
            <ThemedText style={[styles.barValue, { color: theme.text }]}>{bar.value}</ThemedText>
          </View>
          {bar.kind === "rsvp" || bar.kind === "pick" ? (
            <Pressable
              onPress={bar.kind === "rsvp" ? rsvp : () => setMsg("Choose a ticket first.")}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: EVENT_GOLD, opacity: busy ? 0.7 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#0B0B0B" /> : <ThemedText style={styles.ctaText}>RSVP</ThemedText>}
            </Pressable>
          ) : (
            <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={[styles.cta, { backgroundColor: theme.border }]}>
              <ThemedText style={[styles.ctaText, { color: theme.textSecondary }]}>
                {bar.kind === "sold_out" ? "Sold out" : "Coming soon in the app"}
              </ThemedText>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.md },
  centerTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  cover: { height: 280, backgroundColor: EVENT_GREEN, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverLabel: { color: EVENT_GREEN_TEXT, fontSize: 13 },
  circle: { position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(11,11,11,0.85)", alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
  bannerText: { fontSize: 14, fontWeight: "600" },
  when: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  title: { fontSize: 30, fontWeight: "800", lineHeight: 34 },
  hostRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  hostWho: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  hostAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hostLetter: { color: EVENT_CREAM, fontWeight: "700" },
  hostName: { fontSize: 14, fontWeight: "700" },
  follow: { minHeight: 36, minWidth: 92, paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: EVENT_GREEN },
  followBtn: { backgroundColor: EVENT_GREEN },
  followingBtn: { backgroundColor: "transparent" },
  followText: { fontSize: 13, fontWeight: "600" },
  going: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#10241F", borderColor: EVENT_GREEN, borderWidth: 1, borderRadius: 14, padding: 14 },
  goingTitle: { color: EVENT_CREAM, fontSize: 14, fontWeight: "700" },
  goingText: { color: EVENT_GREEN_TEXT, fontSize: 12 },
  place: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderWidth: 1, borderRadius: 14, padding: 14 },
  placeMain: { fontSize: 14, fontWeight: "600" },
  small: { fontSize: 12, lineHeight: 17 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  ticket: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, marginTop: 8 },
  ticketName: { fontSize: 14, fontWeight: "600" },
  ticketRight: { fontSize: 14, fontWeight: "600", textAlign: "right", maxWidth: "45%" },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qtyCtl: { flexDirection: "row", alignItems: "center", gap: 14 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontSize: 17, fontWeight: "700", minWidth: 20, textAlign: "center" },
  error: { fontSize: 14 },
  about: { fontSize: 14, lineHeight: 21 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  barValue: { fontSize: 18, fontWeight: "700" },
  cta: { minHeight: 52, paddingHorizontal: 24, borderRadius: 26, alignItems: "center", justifyContent: "center", flexShrink: 1 },
  ctaText: { color: "#0B0B0B", fontSize: 16, fontWeight: "700", textAlign: "center" },
  greenButton: { minHeight: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: EVENT_GREEN, alignItems: "center", justifyContent: "center" },
  greenButtonText: { color: EVENT_CREAM, fontSize: 15, fontWeight: "600" },
});

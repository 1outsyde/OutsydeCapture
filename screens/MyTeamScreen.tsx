/**
 * My page for an event I'm on the team for (p4-team step 9c-1, mockup C). Same as goutsyde.com
 * app/events/[id]/my-team/MyTeamClient.tsx: a request to stay longer (Accept / Decline), my roles with their times,
 * where to go and the host's notes, Open the scanner (Admissions) and Manage (co-hosts), my promoter link (Share and
 * Copy, call 65), notes from the host, what I'll get (every amount comes from the backend), payout setup (call 62:
 * the personal payout setup, coming back here), Got it / Not yet after the host paid me, and Leave per spot.
 * Only my own things: GET /:id/team/me answers 404 for anyone not on the team.
 * Step 9d-3 (calls 85, 87): the Event Team note with I accept while they have pay that isn't worked out and haven't
 * accepted (shown even while the backend's TEAM_NOTE_REQUIRED switch is off), "Set up payouts" only when payout setup
 * is what's missing, and a due line if the note can't load while it's required. The note loads on its own.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import {
  Centered,
  ErrorText,
  GOLD,
  Hint,
  HostHeader,
  OkText,
  OutlineButton,
  PrimaryButton,
  TextButton,
  hostStyles,
} from "@/components/host/hostUi";
import { GENERIC_ERROR, fmt } from "@/utils/eventsLogic";
import {
  failureCopy,
  flatError,
  stripeUrl,
  whenRange,
} from "@/utils/host/editorLogic";
import { backendMessage } from "@/utils/host/manageLogic";
import { makeGate } from "@/utils/host/doorLogic";
import {
  clearHostSetupPending,
  markHostSetupPending,
  onHostSetupReturn,
} from "@/utils/host/hostGate";
import {
  acceptedEndLine,
  canAnswerPaid,
  dollars,
  durationText,
  isTeamEvent,
  leaveSpotCopy,
  myPayoutLine,
  roleName,
  stayLine,
  timeFields,
  timeOf,
  type TeamEvent,
} from "@/utils/host/teamLogic";
import {
  leaveSpots,
  myPayLines,
  openStayRequests,
  parseMyTeam,
  setupNeededLine,
  stripeWaitDone,
  type MyTeam,
} from "@/utils/host/memberLogic";
import {
  isTeamNote,
  noteDueLine,
  noteOnMyPage,
  payNotWorkedOut,
  type TeamNote,
} from "@/utils/host/teamNoteLogic";
import TeamNoteCard from "@/components/host/TeamNoteCard";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Note = { where: string; ok: boolean; text: string };

export default function MyTeamScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { eventId } =
    useRoute<RouteProp<RootStackParamList, "MyTeam">>().params;
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);

  const [me, setMe] = useState<MyTeam | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [phase, setPhase] = useState<
    "loading" | "ready" | "notfound" | "error"
  >("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  // The Event Team note (null until loaded or when it fails).
  const [teamNote, setTeamNote] = useState<TeamNote | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  // Leaving the last spot makes /team/me answer 404: keep the confirmation on that screen.
  const [left, setLeft] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Read when the data loads, never during render.
  const [now, setNow] = useState(0);
  // Taken before any await: a double tap sends one request.
  const gate = useRef(makeGate()).current;
  const seq = useRef(0);
  const live = useRef(true);
  // True while a payout setup started here is open in Stripe. Only then does this screen own the Stripe return flag.
  const settingUp = useRef(false);
  const [waitingSetup, setWaitingSetup] = useState(false);
  const doneSetup = useCallback(() => {
    if (!settingUp.current) return;
    settingUp.current = false;
    setWaitingSetup(false);
    clearHostSetupPending();
  }, []);
  useEffect(
    () => () => {
      live.current = false;
      // Leaving the screen: a later Stripe return goes where it always did (only if this screen set the flag).
      if (settingUp.current) clearHostSetupPending();
    },
    [],
  );

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    const t = await token();
    if (!t) return;
    // The note loads on its own: a slow answer never holds up the page (its card just appears when it arrives).
    // Only the latest load's answer counts, so an older one can't bring the card back after I accept.
    api.getTeamNote(t).then(
      (n) => {
        if (mine === seq.current && live.current)
          setTeamNote(isTeamNote(n?.note) ? n.note : null);
      },
      () => {
        if (mine === seq.current && live.current) setTeamNote(null);
      },
    );
    const [r, list] = await Promise.all([
      api.getMyTeam(eventId, t).then(
        (b) => ({ ok: true as const, b }),
        (e) => ({ ok: false as const, e }),
      ),
      api.getTeamEvents(t).then(
        (b) => b,
        () => null,
      ),
    ]);
    if (mine !== seq.current || !live.current) return;
    if (!r.ok) {
      const f = flatError(r.e);
      if (f.status === 401) {
        navigation.navigate("Auth", {});
        return;
      }
      if (f.status === 404) {
        setPhase("notfound");
        return;
      }
      setLoadError(failureCopy(f.status, f.body).message);
      setPhase("error");
      return;
    }
    const parsed = parseMyTeam(r.b);
    if (!parsed) {
      setLoadError(GENERIC_ERROR);
      setPhase("error");
      return;
    }
    setNow(Date.now());
    setMe(parsed);
    // Still on the team (a role is listed): a past Leave was for another spot.
    if (parsed.roles.length > 0) setLeft(false);
    // Payouts are set up now (or nothing needs them): stop holding the Stripe return for this screen. Only the note
    // missing doesn't keep it waiting (call 87).
    if (stripeWaitDone(parsed)) doneSetup();
    // Spots come from the Event team list (each has its own invite to leave). A failed list just hides Leave.
    setEvents(
      Array.isArray(list?.events)
        ? (list!.events as unknown[]).filter(isTeamEvent)
        : [],
    );
    setPhase("ready");
  }, [eventId, token, navigation, doneSetup]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // Call 62: back from Stripe's payout setup (the navigator stays here while the flag is set), check again. Also when
  // the app comes back to the front without the return link (Safari closed by hand), like the event editor.
  useEffect(() => {
    if (!waitingSetup) return;
    const off = onHostSetupReturn(() => {
      load();
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") load();
    });
    return () => {
      off();
      sub.remove();
    };
  }, [waitingSetup, load]);

  async function act(
    where: string,
    run: (t: string) => Promise<unknown>,
    ok: string,
  ) {
    if (!gate.enter()) return;
    setBusy(where);
    setNote(null);
    try {
      const t = await token();
      if (!t) return;
      await run(t);
      if (!live.current) return;
      if (where.startsWith("leave:")) setLeft(true);
      setNote({ where, ok: true, text: ok });
      setLeaving(null);
      await load();
    } catch (e) {
      if (!live.current) return;
      const f = flatError(e);
      if (f.status === 401) {
        navigation.navigate("Auth", {});
        return;
      }
      setNote({ where, ok: false, text: backendMessage(f.status, f.body) });
      if (f.status === 409 || f.status === 404) await load();
    } finally {
      gate.leave();
      if (live.current) setBusy(null);
    }
  }

  async function setUpPayouts() {
    if (!gate.enter()) return;
    setBusy("setup");
    setNote(null);
    try {
      const t = await token();
      if (!t) return;
      const url = stripeUrl((await api.startPayoutSetup(t))?.url);
      if (!url) throw { status: 500 };
      markHostSetupPending();
      settingUp.current = true;
      setWaitingSetup(true);
      await Linking.openURL(url);
    } catch (e) {
      clearHostSetupPending();
      settingUp.current = false;
      setWaitingSetup(false);
      const f = flatError(e);
      if (live.current)
        setNote({
          where: "setup",
          ok: false,
          text: failureCopy(f.status, f.body).message,
        });
    } finally {
      gate.leave();
      if (live.current) setBusy(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await Clipboard.setStringAsync(url);
      setNote({ where: "link", ok: true, text: "Link copied." });
    } catch {
      /* ignore */
    }
  }
  async function shareLink(url: string, title: string) {
    try {
      await Share.share({ message: `${title} ${url}` });
    } catch {
      /* closed */
    }
  }

  const say = (where: string) =>
    note?.where === where ? (
      note.ok ? (
        <OkText>{note.text}</OkText>
      ) : (
        <ErrorText>{note.text}</ErrorText>
      )
    ) : null;
  const back = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate("DoorEvents");
  const root = (
    title: string,
    sub: string | undefined,
    children: React.ReactNode,
  ) => (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <HostHeader
        left={{ icon: "chevron-left", label: "Back", onPress: back }}
        title={title}
        sub={sub}
      />
      {children}
    </View>
  );

  if (phase === "loading")
    return root(
      "Event team",
      undefined,
      <Centered>
        <ActivityIndicator color={GOLD} />
      </Centered>,
    );
  if (phase !== "ready" || !me) {
    const head =
      phase === "error" ? "EVENT TEAM" : left ? "YOU LEFT" : "NOT ON THIS TEAM";
    const text =
      phase === "error"
        ? (loadError ?? GENERIC_ERROR)
        : left
          ? "You're no longer on the Event team for this event."
          : "You're not on the Event team for this event, or it was removed.";
    return root(
      "Event team",
      undefined,
      <Centered>
        <ThemedText style={hostStyles.h1} accessibilityRole="header">
          {head}
        </ThemedText>
        <ThemedText style={[hostStyles.body, { textAlign: "center" }]}>
          {text}
        </ThemedText>
        {phase === "error" ? (
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setPhase("loading");
              load();
            }}
            style={{ alignSelf: "stretch" }}
          />
        ) : null}
        <OutlineButton
          label="Event team"
          onPress={() => navigation.navigate("DoorEvents")}
          style={{ alignSelf: "stretch" }}
        />
      </Centered>,
    );
  }

  const tz = me.event.timezone;
  const ended = new Date(me.event.endsAt).getTime() <= now;
  const open = openStayRequests(me, now);
  const lines = myPayLines(me);
  const setup = setupNeededLine(me);
  const due = noteDueLine(me.payoutSetup, !!teamNote, (d) =>
    fmt(d, tz, { weekday: "short", month: "short", day: "numeric" }),
  );
  const showNote =
    noteOnMyPage(
      { hasPay: payNotWorkedOut(me), paidOut: !!me.payout },
      teamNote,
    ) && !!teamNote;
  const spots = leaveSpots(events, eventId, ended);
  const card = [
    st.card,
    { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
  ];
  const trow = (label: string, value: string, key?: string) => (
    <View key={key ?? label} style={st.trow}>
      <ThemedText style={{ fontSize: 14, color: theme.textSecondary, flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText
        style={[hostStyles.strong, { flexShrink: 1, textAlign: "right" }]}
      >
        {value}
      </ThemedText>
    </View>
  );

  return root(
    me.event.title,
    `${whenRange(me.event.startsAt, me.event.endsAt, tz)} · ${me.host.name}`,
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 40,
        gap: 16,
      }}
      testID="my-team"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={GOLD}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {open.map((r) => (
        <View
          key={r.id}
          style={[
            st.card,
            { backgroundColor: theme.backgroundDefault, borderColor: GOLD },
          ]}
          testID="stay-ask"
          accessibilityLabel="Request to stay longer"
        >
          <ThemedText
            style={hostStyles.strong}
          >{`${me.host.name} asked you to stay ${durationText(r.extraMinutes)}`}</ThemedText>
          <ThemedText style={hostStyles.body}>{stayLine(r, tz)}</ThemedText>
          <Hint>{`Answer by ${timeOf(r.expiresAt, tz)}.`}</Hint>
          <View style={st.two}>
            <PrimaryButton
              label={busy === `stay:${r.id}` ? "Saving…" : "Accept"}
              busy={busy === `stay:${r.id}`}
              disabled={!!busy}
              style={{ flex: 1 }}
              onPress={() =>
                act(
                  `stay:${r.id}`,
                  (t) => api.answerStayLonger(eventId, r.id, "accept", t),
                  "Accepted. Your end time and pay are updated.",
                )
              }
            />
            <OutlineButton
              label="Decline"
              disabled={!!busy}
              style={{ flex: 1 }}
              onPress={() =>
                act(
                  `stay:${r.id}`,
                  (t) => api.answerStayLonger(eventId, r.id, "decline", t),
                  "Declined. Nothing changes.",
                )
              }
            />
          </View>
          {say(`stay:${r.id}`)}
        </View>
      ))}
      {open.length === 0 && note?.where.startsWith("stay:")
        ? say(note.where)
        : null}

      {me.roles.map((r) => {
        const s = r.schedule;
        const until = acceptedEndLine(me.stayLonger, r.role, tz);
        return (
          <View
            key={r.role}
            style={card}
            testID="my-role"
            accessibilityLabel={roleName(r.role, r.roleLabel)}
          >
            <View style={[st.chip, { backgroundColor: theme.border }]}>
              <ThemedText style={st.chipText}>
                {roleName(r.role, r.roleLabel).toUpperCase()}
              </ThemedText>
            </View>
            {timeFields(r.role)
              .filter((f) => s?.[f.key])
              .map((f) =>
                trow(f.label, timeOf(s![f.key] as string, tz), f.key),
              )}
            {until ? (
              <ThemedText
                style={{
                  color: theme.brandGold,
                  fontWeight: "600",
                  fontSize: 14,
                }}
                testID="stay-until"
              >
                {until}
              </ThemedText>
            ) : null}
            {s?.placeNote ? trow("Where to go", s.placeNote) : null}
            {s?.hostNote ? (
              <View style={{ gap: 2 }}>
                <Hint>From the host</Hint>
                <ThemedText style={hostStyles.body}>{s.hostNote}</ThemedText>
              </View>
            ) : null}
            {r.role === "door" && !ended ? (
              <PrimaryButton
                label="Open the scanner"
                onPress={() => navigation.navigate("DoorScanner", { eventId })}
              />
            ) : null}
            {r.role === "cohost" ? (
              <OutlineButton
                label="Manage the event"
                onPress={() => navigation.navigate("ManageEvent", { eventId })}
              />
            ) : null}
          </View>
        );
      })}

      {me.promoter ? (
        <View style={card} testID="my-link" accessibilityLabel="Your link">
          <ThemedText
            style={[hostStyles.section, { color: theme.textSecondary }]}
            accessibilityRole="header"
          >
            YOUR LINK
          </ThemedText>
          <ThemedText style={hostStyles.body} selectable>
            {me.promoter.url}
          </ThemedText>
          <View style={st.two}>
            <PrimaryButton
              label="Share"
              style={{ flex: 1 }}
              onPress={() => shareLink(me.promoter!.url, me.event.title)}
            />
            <OutlineButton
              label="Copy link"
              style={{ flex: 1 }}
              onPress={() => copyLink(me.promoter!.url)}
            />
          </View>
          {say("link")}
          {trow(
            "Tickets sold through your link",
            String(me.promoter.ticketsSold),
          )}
          {me.promoter.rsvps > 0
            ? trow("RSVPs through your link", String(me.promoter.rsvps))
            : null}
          {trow("Ticket price total", dollars(me.promoter.salesCents))}
        </View>
      ) : null}

      {me.fromHost.length > 0 ? (
        <View style={{ gap: 10 }} testID="from-host">
          <ThemedText
            style={[hostStyles.section, { color: theme.textSecondary }]}
            accessibilityRole="header"
          >
            FROM THE HOST
          </ThemedText>
          {me.fromHost.map((m) => (
            <View key={m.id} style={card}>
              <Hint>{`${m.from?.name ?? me.host.name} · ${fmt(m.at, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })}`}</Hint>
              <ThemedText style={hostStyles.body}>{m.text}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {lines.length > 0 || me.payout ? (
        <View style={card} testID="my-pay" accessibilityLabel="Your pay">
          <ThemedText
            style={[hostStyles.section, { color: theme.textSecondary }]}
            accessibilityRole="header"
          >
            {me.payout ? "YOUR PAY" : "YOU'LL GET"}
          </ThemedText>
          {!me.payout
            ? lines.map((l, i) => trow(l.label, l.value, `l${i}`))
            : null}
          {me.payout
            ? trow("Total", dollars(me.payout.amountCents))
            : me.payTotalCents !== null
              ? trow("Total", dollars(me.payTotalCents))
              : null}
          {me.payout ? (
            <Hint>{myPayoutLine(me.payout)}</Hint>
          ) : (
            <Hint>Paid 3 days after the event due to processing.</Hint>
          )}
          {me.payout && canAnswerPaid(me.payout) ? (
            <View style={st.two}>
              <PrimaryButton
                label="Got it"
                disabled={!!busy}
                busy={busy === "paid"}
                style={{ flex: 1 }}
                onPress={() =>
                  act(
                    "paid",
                    (t) => api.answerTeamPaid(eventId, "got-it", t),
                    "Thanks. The host sees you got it.",
                  )
                }
              />
              <OutlineButton
                label="Not yet"
                disabled={!!busy}
                style={{ flex: 1 }}
                onPress={() =>
                  act(
                    "paid",
                    (t) => api.answerTeamPaid(eventId, "not-yet", t),
                    "The host sees you haven't got it yet.",
                  )
                }
              />
            </View>
          ) : null}
          {say("paid")}
          {due ? (
            <ThemedText
              style={{ color: theme.error, fontSize: 14 }}
              testID="note-due"
            >
              {due}
            </ThemedText>
          ) : null}
          {setup ? (
            <View style={{ gap: 8 }} testID="setup-needed">
              <ThemedText style={{ color: theme.error, fontSize: 14 }}>
                {setup}
              </ThemedText>
              <PrimaryButton
                label={busy === "setup" ? "Opening…" : "Set up payouts"}
                busy={busy === "setup"}
                disabled={!!busy}
                onPress={setUpPayouts}
              />
              {say("setup")}
            </View>
          ) : null}
        </View>
      ) : null}

      {showNote && teamNote ? (
        <TeamNoteCard
          note={teamNote}
          busy={busy === "note"}
          disabled={!!busy}
          testID="my-note"
          onAccept={() =>
            act(
              "note",
              async (t) => {
                await api.acceptTeamNote(teamNote.version, t);
                // Gone right away, before the reload's note answer arrives.
                if (live.current) setTeamNote({ ...teamNote, accepted: true });
              },
              "Thanks. You've accepted the Event Team note.",
            )
          }
        />
      ) : null}
      {say("note")}

      {spots.length > 0 ? (
        <View style={{ gap: 8 }} accessibilityLabel="Leave">
          {spots.map((sp) => (
            <View key={sp.inviteId} style={{ gap: 6 }}>
              {leaving !== sp.inviteId ? (
                <View style={{ alignSelf: "flex-end" }}>
                  <TextButton
                    label={`Leave as ${roleName(sp.role, sp.roleLabel)}${sp.scope === "standing" ? " (all their events)" : ""}`}
                    disabled={!!busy}
                    onPress={() => {
                      setLeaving(sp.inviteId);
                      setNote(null);
                    }}
                  />
                </View>
              ) : (
                <View style={card} accessibilityLabel="Confirm leave">
                  <ThemedText style={hostStyles.body}>
                    {leaveSpotCopy(sp, me.event.title)}
                  </ThemedText>
                  {say(`leave:${sp.inviteId}`)}
                  <View style={st.two}>
                    <OutlineButton
                      danger
                      label={
                        busy === `leave:${sp.inviteId}`
                          ? "Leaving…"
                          : "Yes, leave"
                      }
                      disabled={!!busy}
                      style={{ flex: 1 }}
                      onPress={() =>
                        act(
                          `leave:${sp.inviteId}`,
                          (t) => api.answerTeamInvite(sp.inviteId, "leave", t),
                          "You left.",
                        )
                      }
                    />
                    <OutlineButton
                      label="Stay"
                      disabled={!!busy}
                      style={{ flex: 1 }}
                      onPress={() => setLeaving(null)}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}
      {note && note.where.startsWith("leave:") && leaving === null
        ? say(note.where)
        : null}
    </ScrollView>,
  );
}

const st = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  trow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  two: { flexDirection: "row", gap: 8 },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
});

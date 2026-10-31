/**
 * Event team (p4-team step 9a, mockup A, screens 45 to 48; calls 57 to 63 and 66 to 71). The host's and co-hosts' team
 * for one event, the same as goutsyde.com/events/[id]/team:
 *   Invite by Username, Email (that address gets its own link), Phone (the phone's Messages app opens with the link;
 *   Outsyde never texts) or Link (share or copy), with a role (Admissions, Security, Promoter, Entertainment, Media,
 *   Co-host, Other with a name) and All my events or Only this event. Links can carry pay for This event (host only).
 *   Waiting links with Copy and Cancel. The team by role (GET /door/team?roles=all); a row opens TeamPersonSheet.
 *   Team pay and what the host takes home.
 * Messages, stay longer, To be discussed amounts and I paid them come in step 9b.
 * The route keeps its name (DoorTeam) so pushes and links already on phones still open it (call 59).
 * GET /door/team answers 404 for anyone but the host and accepted co-hosts.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import type { RootStackParamList } from "@/navigation/types";
import {
  Centered,
  Chip,
  ErrorText,
  Field,
  GOLD,
  Hint,
  HostHeader,
  OkText,
  OutlineButton,
  PrimaryButton,
  TextButton,
  hostStyles,
} from "@/components/host/hostUi";
import TeamPersonSheet from "@/components/host/TeamPersonSheet";
import { GENERIC_ERROR } from "@/utils/eventsLogic";
import { failureCopy, flatError } from "@/utils/host/editorLogic";
import { backendMessage, guestName } from "@/utils/host/manageLogic";
import { USERNAME_MAX, cleanUsername, makeGate } from "@/utils/host/doorLogic";
import { manageAccess } from "@/utils/host/eventTeamRules";
import {
  LINK_ROLES,
  TEAM_ROLES,
  dollars,
  inviteSentLine,
  roleLabelError,
  roleName,
  rowLine,
  rowStatus,
  sections,
  teamRows,
  type PayForm,
  type TeamRole,
  type TeamRow,
} from "@/utils/host/teamLogic";
import {
  INVITE_WAYS,
  isHostLink,
  linkBody,
  linkRowLine,
  linkShareText,
  phoneError,
  smsHref,
  type HostLink,
  type InviteWay,
} from "@/utils/host/teamLinksLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Phase = "loading" | "ready" | "notfound" | "error";
type Ev = {
  id: string;
  title: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  status: string;
};
type Totals = {
  teamCents: number;
  hostEarningsCents: number;
  covered: boolean;
  teamPaidCents: number;
  hostTakeHomeCents: number;
} | null;

export default function DoorTeamScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { eventId } =
    useRoute<RouteProp<RootStackParamList, "DoorTeam">>().params;
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  useEffect(() => {
    tokenRef.current = authToken;
  }, [authToken]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [event, setEvent] = useState<Ev | null>(null);
  const [asHost, setAsHost] = useState(true);
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [totals, setTotals] = useState<Totals>(null);
  const [links, setLinks] = useState<HostLink[]>([]);
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState<TeamRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // invite form
  const [way, setWay] = useState<InviteWay>("username");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<TeamRole>("door");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"standing" | "event">("event");
  const [payOn, setPayOn] = useState(false);
  const [linkPay, setLinkPay] = useState<PayForm>({
    payType: "fixed",
    fixed: "",
    hourly: "",
    commission: "",
  });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const gate = useRef(makeGate()).current;

  const token = useCallback(async () => {
    const t = await tokenRef.current();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [navigation]);

  /** The team, totals and links. False when the screen shows not found or an error instead. */
  const refresh = useCallback(
    async (t: string): Promise<boolean> => {
      try {
        const r = await api.getEventTeam(eventId, t);
        setRows(teamRows(r ?? {}));
        setTotals(
          r?.payTotals && typeof r.payTotals.teamCents === "number"
            ? r.payTotals
            : null,
        );
        setNow(Date.now());
      } catch (e) {
        const f = flatError(e);
        if (f.status === 401) {
          navigation.navigate("Auth", {});
          return false;
        }
        if (f.status === 404) {
          setPhase("notfound");
          return false;
        }
        setLoadError(failureCopy(f.status, f.body).message);
        setPhase("error");
        return false;
      }
      // Extra: a failure leaves the list empty, the team still shows.
      const l = await api.getTeamLinks(eventId, t).catch(() => null);
      setLinks(
        Array.isArray(l?.links)
          ? (l!.links as unknown[]).filter(isHostLink)
          : [],
      );
      return true;
    },
    [eventId, navigation],
  );

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setPhase("loading");
        setLoadError(null);
      }
      const t = await token();
      if (!t) return;
      if (!(await refresh(t))) return;
      try {
        const m = await api.getManageEvent(eventId, t);
        const e = m?.event;
        // Without the event (times, zone) and who's looking, the screen would offer the wrong things: say so instead.
        if (!e || typeof e.title !== "string") {
          setLoadError(GENERIC_ERROR);
          setPhase("error");
          return;
        }
        setEvent({
          id: eventId,
          title: e.title,
          timezone: e.timezone,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          status: e.status,
        });
        setAsHost(manageAccess(m).as === "host");
        setPhase("ready");
      } catch (err) {
        const f = flatError(err);
        setLoadError(failureCopy(f.status, f.body).message);
        setPhase("error");
      }
    },
    [eventId, refresh, token],
  );

  const loaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(loaded.current);
      loaded.current = true;
    }, [load]),
  );

  async function sendUsername(t: string) {
    const name = cleanUsername(username);
    if (role === "other") {
      const le = roleLabelError(label);
      if (le) {
        setSendError(le);
        return;
      }
    }
    const body: Record<string, unknown> = {
      username: name,
      scope: asHost ? scope : "event",
      role,
    };
    if (role === "other") body.roleLabel = label.trim().replace(/\s+/g, " ");
    const r = await api.inviteToEventTeam(eventId, body, t);
    const m = r?.member ?? {};
    setNotice(
      inviteSentLine(
        guestName({
          firstName: m.firstName ?? null,
          username: m.username ?? name,
        }),
        role,
        role === "other" ? label.trim() : null,
      ),
    );
    setUsername("");
    setLabel("");
  }

  /** Email, Phone and Link: make a one person link, then email it, open Messages with it, or show it. */
  async function sendLink(t: string) {
    if (!event) return;
    if (way === "phone") {
      const pe = phoneError(phone);
      if (pe) {
        setSendError(pe);
        return;
      }
    }
    const b = linkBody({
      role,
      label,
      scope,
      pay: linkPay,
      payOn,
      asHost,
      email: way === "email" ? email : undefined,
    });
    if (!b.ok) {
      setSendError(b.message);
      return;
    }
    const r = await api.makeTeamLink(eventId, b.body, t);
    if (!isHostLink(r?.link)) throw new Error("link");
    const link: HostLink = r.link;
    const who = roleName(role, role === "other" ? label : null);
    if (way === "email") {
      if (r.emailed === true)
        setNotice(
          `Invite emailed to ${link.sentToEmail}. It's for one person: the first to accept gets the spot as ${who}.`,
        );
      else {
        setNotice(
          "The link is ready, but it couldn't be emailed today (you've sent 10 invite emails, or this address got one already). Share it below instead.",
        );
        setMade({ url: link.url, text: link.url });
      }
      setEmail("");
    } else {
      // The host's public name, the same one the invitee sees on the link page.
      const pg = await api.getTeamLinkPage(link.code, t).catch(() => null);
      const hostName =
        typeof pg?.link?.host?.name === "string"
          ? pg.link.host.name
          : "Your host";
      const text = linkShareText({
        hostName,
        role,
        roleLabel: role === "other" ? label.trim() : null,
        eventTitle: event.title,
        scope: link.scope,
        url: link.url,
      });
      setMade({ url: link.url, text });
      if (way === "phone") {
        setNotice(
          "Your Messages app should open with the invite. Send it from there. Didn't open? Share the link below.",
        );
        Linking.openURL(smsHref(phone, text)).catch(() =>
          setNotice("Couldn't open Messages. Share the link below instead."),
        );
        setPhone("");
      } else
        setNotice(
          `Link ready. It's for one person: the first to accept gets the spot as ${who}.`,
        );
    }
    setLabel("");
  }

  async function send() {
    if (!gate.enter()) return;
    setSending(true);
    setSendError(null);
    setNotice(null);
    setMade(null);
    const t = await token();
    if (!t) {
      gate.leave();
      setSending(false);
      return;
    }
    try {
      if (way === "username") await sendUsername(t);
      else await sendLink(t);
      await refresh(t);
    } catch (e) {
      const f = flatError(e);
      setSendError(backendMessage(f.status, f.body));
    } finally {
      gate.leave();
      setSending(false);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function share(text: string) {
    try {
      await Share.share({ message: text });
    } catch {
      /* closed */
    }
  }

  async function cancelLink(l: HostLink) {
    if (linkBusy || !gate.enter()) return;
    setLinkBusy(l.id);
    setSendError(null);
    const t = await token();
    try {
      if (t) {
        await api.cancelTeamLink(eventId, l.id, t);
        setNotice("Link cancelled. Nobody can use it now.");
        await refresh(t);
      }
    } catch (e) {
      const f = flatError(e);
      setSendError(backendMessage(f.status, f.body));
    } finally {
      gate.leave();
      setLinkBusy(null);
    }
  }

  const root = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {children}
    </View>
  );
  const header = (
    <HostHeader
      left={{
        icon: "chevron-left",
        label: "Back",
        onPress: () => navigation.goBack(),
      }}
      title="Event team"
      sub={event?.title}
    />
  );

  if (phase === "loading")
    return root(
      <>
        {header}
        <Centered>
          <ActivityIndicator color={GOLD} />
        </Centered>
      </>,
    );
  if (phase === "notfound") {
    return root(
      <>
        {header}
        <Centered>
          <ThemedText style={hostStyles.h1} accessibilityRole="header">
            EVENT NOT FOUND
          </ThemedText>
          <ThemedText style={[hostStyles.body, { textAlign: "center" }]}>
            Event not found. It may have been removed, or it belongs to another
            account.
          </ThemedText>
          <PrimaryButton
            label="Your events"
            onPress={() => navigation.navigate("YourEvents")}
            style={{ alignSelf: "stretch" }}
          />
        </Centered>
      </>,
    );
  }
  if (phase === "error" || !event) {
    return root(
      <>
        {header}
        <Centered>
          <ErrorText>{loadError ?? GENERIC_ERROR}</ErrorText>
          <PrimaryButton
            label="Try again"
            onPress={() => load()}
            style={{ alignSelf: "stretch" }}
          />
        </Centered>
      </>,
    );
  }

  const tz = event.timezone;
  const ended =
    new Date(event.endsAt).getTime() <= now || event.status === "cancelled";
  const roleChoices = TEAM_ROLES.filter((r) => asHost || r !== "cohost");
  const canSend =
    way === "username"
      ? !!cleanUsername(username)
      : way === "email"
        ? !!email.trim()
        : way === "phone"
          ? !!phone.trim()
          : true;
  const sendLabel = sending
    ? "Sending…"
    : way === "email"
      ? "Email the invite"
      : way === "phone"
        ? "Text the invite"
        : way === "link"
          ? "Make the link"
          : "Send invite";
  const wayHint =
    way === "email"
      ? "They get an email with their own invite link. New to Outsyde? They can join from it in a minute."
      : way === "phone"
        ? "Your Messages app opens with their invite link. Outsyde never texts them."
        : way === "link"
          ? "Share or copy the link. It's for one person: the first to accept gets the spot."
          : null;
  const showPay =
    way !== "username" && asHost && role !== "cohost" && scope === "event";

  return root(
    <>
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {!ended && (
          <View style={{ gap: 10 }} testID="team-add">
            <ThemedText
              style={[hostStyles.section, { color: theme.textSecondary }]}
              accessibilityRole="header"
            >
              INVITE SOMEONE
            </ThemedText>
            <View
              style={st.chips}
              accessibilityRole="radiogroup"
              accessibilityLabel="Invite by"
            >
              {INVITE_WAYS.map((w) => (
                <Chip
                  key={w.key}
                  label={w.label}
                  on={way === w.key}
                  onPress={() => {
                    setWay(w.key);
                    setSendError(null);
                    setMade(null);
                  }}
                />
              ))}
            </View>
            {way === "username" && (
              <Field
                label="USERNAME"
                value={username}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={
                  username.startsWith("@") ? USERNAME_MAX + 1 : USERNAME_MAX
                }
                onChangeText={(v) => {
                  setUsername(v);
                  setSendError(null);
                }}
                onSubmitEditing={send}
                returnKeyType="send"
              />
            )}
            {way === "email" && (
              <Field
                label="EMAIL"
                value={email}
                placeholder="name@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={254}
                onChangeText={(v) => {
                  setEmail(v);
                  setSendError(null);
                }}
              />
            )}
            {way === "phone" && (
              <Field
                label="PHONE NUMBER"
                value={phone}
                placeholder="(516) 555 0134"
                keyboardType="phone-pad"
                maxLength={24}
                onChangeText={(v) => {
                  setPhone(v);
                  setSendError(null);
                }}
              />
            )}
            {wayHint ? <Hint>{wayHint}</Hint> : null}
            <View
              style={[st.box, { backgroundColor: theme.backgroundDefault }]}
            >
              <View
                style={st.chips}
                accessibilityRole="radiogroup"
                accessibilityLabel="Role"
              >
                {roleChoices.map((r) => (
                  <Chip
                    key={r}
                    label={roleName(r)}
                    on={role === r}
                    onPress={() => {
                      setRole(r);
                      setSendError(null);
                    }}
                  />
                ))}
              </View>
              {role === "other" && (
                <Field
                  label="NAME OF THE ROLE"
                  value={label}
                  placeholder="Coat check"
                  maxLength={40}
                  onChangeText={(v) => {
                    setLabel(v);
                    setSendError(null);
                  }}
                />
              )}
              {asHost && (
                <View
                  style={st.chips}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Access"
                >
                  <Chip
                    label="All my events"
                    on={scope === "standing"}
                    onPress={() => setScope("standing")}
                  />
                  <Chip
                    label="Only this event"
                    on={scope === "event"}
                    onPress={() => setScope("event")}
                  />
                </View>
              )}
              {showPay && (
                <View style={{ gap: 8 }} testID="link-pay">
                  <Pressable
                    onPress={() => setPayOn((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: payOn }}
                    style={st.check}
                  >
                    <View
                      style={[
                        st.box16,
                        {
                          borderColor: GOLD,
                          backgroundColor: payOn ? GOLD : "transparent",
                        },
                      ]}
                    />
                    <ThemedText style={{ fontSize: 14, flex: 1 }}>
                      Add their pay now (shown on the invite)
                    </ThemedText>
                  </Pressable>
                  {payOn && (
                    <>
                      <View
                        style={st.chips}
                        accessibilityRole="radiogroup"
                        accessibilityLabel="Pay type"
                      >
                        {(["none", "fixed", "hourly"] as const).map((t) => (
                          <Chip
                            key={t}
                            label={
                              t === "none"
                                ? "No pay"
                                : t === "fixed"
                                  ? "Fixed"
                                  : "Hourly"
                            }
                            on={linkPay.payType === t}
                            onPress={() =>
                              setLinkPay((p) => ({ ...p, payType: t }))
                            }
                          />
                        ))}
                      </View>
                      {linkPay.payType === "fixed" && (
                        <Field
                          label="FIXED AMOUNT"
                          value={linkPay.fixed}
                          keyboardType="decimal-pad"
                          placeholder="$160"
                          onChangeText={(v) =>
                            setLinkPay((p) => ({ ...p, fixed: v }))
                          }
                        />
                      )}
                      {linkPay.payType === "hourly" && (
                        <Field
                          label="HOURLY RATE"
                          value={linkPay.hourly}
                          keyboardType="decimal-pad"
                          placeholder="$50 an hour"
                          onChangeText={(v) =>
                            setLinkPay((p) => ({ ...p, hourly: v }))
                          }
                        />
                      )}
                      {LINK_ROLES.includes(role) && (
                        <Field
                          label="COMMISSION ON THEIR LINK SALES"
                          value={linkPay.commission}
                          keyboardType="decimal-pad"
                          placeholder="10%"
                          onChangeText={(v) =>
                            setLinkPay((p) => ({ ...p, commission: v }))
                          }
                        />
                      )}
                    </>
                  )}
                </View>
              )}
              <Hint>
                {role === "cohost"
                  ? "Co-hosts see everything you see for the event."
                  : showPay && payOn
                    ? `${roleName(role, role === "other" ? label : null)}: you set their times after they join.`
                    : `${roleName(role, role === "other" ? label : null)}: you set their times and pay after you invite them.`}
              </Hint>
              <PrimaryButton
                label={sendLabel}
                busy={sending}
                disabled={!canSend || sending}
                onPress={send}
              />
            </View>
            {sendError ? <ErrorText>{sendError}</ErrorText> : null}
          </View>
        )}
        {notice ? <OkText>{notice}</OkText> : null}
        {made && (
          <View
            style={[st.box, { backgroundColor: theme.backgroundDefault }]}
            testID="made-link"
          >
            <ThemedText selectable style={{ fontSize: 14 }} numberOfLines={2}>
              {made.url}
            </ThemedText>
            <View style={st.chips}>
              <PrimaryButton
                label="Share"
                onPress={() => share(made.text)}
                style={{ flex: 1 }}
              />
              <OutlineButton
                label={copied === "made" ? "Copied" : "Copy link"}
                onPress={() => copy("made", made.url)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {links.length > 0 && (
          <View style={{ gap: 6 }} testID="team-links">
            <ThemedText
              style={[hostStyles.section, { color: theme.textSecondary }]}
              accessibilityRole="header"
            >
              WAITING TO JOIN
            </ThemedText>
            {links.map((l) => (
              <View
                key={l.id}
                style={[st.row, { borderBottomColor: theme.border }]}
                testID="link-row"
              >
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <ThemedText style={hostStyles.strong}>Invite link</ThemedText>
                  <ThemedText
                    style={{
                      fontSize: 13,
                      lineHeight: 18,
                      color: theme.textSecondary,
                    }}
                  >
                    {linkRowLine(l, tz)}
                  </ThemedText>
                </View>
                <TextButton
                  gold
                  label={copied === l.id ? "Copied" : "Copy"}
                  onPress={() => copy(l.id, l.url)}
                />
                {(asHost || (l.scope === "event" && l.role !== "cohost")) && (
                  <TextButton
                    label={linkBusy === l.id ? "Cancelling…" : "Cancel"}
                    a11yLabel="Cancel this invite link"
                    disabled={linkBusy !== null}
                    onPress={() => cancelLink(l)}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {rows.length === 0 && (
          <Hint>No one on the team yet. Invite someone above.</Hint>
        )}
        {sections(rows).map((sec) => (
          <View key={sec.key} style={{ gap: 2 }} testID="team-section">
            <ThemedText
              style={[hostStyles.section, { color: theme.textSecondary }]}
              accessibilityRole="header"
            >
              {sec.title}
            </ThemedText>
            {sec.rows.map((r) => (
              <Pressable
                key={`${r.userId}:${r.role}:${r.scope}`}
                onPress={() => setOpen(r)}
                accessibilityRole="button"
                accessibilityLabel={`${guestName(r)}, ${roleName(r.role, r.roleLabel)}, ${rowStatus(r)}. Open`}
                style={({ pressed }) => [
                  st.row,
                  {
                    borderBottomColor: theme.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                testID="team-row"
              >
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <ThemedText style={hostStyles.strong} numberOfLines={1}>
                    {guestName(r)}
                  </ThemedText>
                  {rowLine(r, tz) ? (
                    <ThemedText
                      style={{
                        fontSize: 13,
                        lineHeight: 18,
                        color: theme.textSecondary,
                      }}
                    >
                      {rowLine(r, tz)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color:
                      r.status === "accepted"
                        ? (theme.success ?? "#6FC193")
                        : r.status === "invited"
                          ? GOLD
                          : theme.textSecondary,
                  }}
                >
                  {rowStatus(r)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ))}

        {totals && totals.teamCents > 0 && (
          <View
            style={[st.box, { backgroundColor: theme.backgroundDefault }]}
            accessibilityLabel="Team pay"
            testID="team-totals"
          >
            <View style={st.kv}>
              <ThemedText style={hostStyles.body}>Team pay</ThemedText>
              <ThemedText style={hostStyles.strong}>
                {dollars(totals.teamCents)}
              </ThemedText>
            </View>
            <View style={st.kv}>
              <ThemedText style={hostStyles.body}>
                Your ticket earnings
              </ThemedText>
              <ThemedText style={hostStyles.strong}>
                {dollars(totals.hostEarningsCents)}
              </ThemedText>
            </View>
            {totals.covered ? (
              <OkText>{`Covered. You take home ${dollars(totals.hostTakeHomeCents)}.`}</OkText>
            ) : (
              <ErrorText>
                Not covered: the team is owed more than you earned, so Outsyde
                pays the team $0 and you keep your earnings. You pay them
                yourself.
              </ErrorText>
            )}
            <Hint>Paid 3 days after the event due to processing.</Hint>
          </View>
        )}
      </ScrollView>

      {open && (
        <TeamPersonSheet
          row={open}
          event={event}
          asHost={asHost}
          now={now}
          getToken={token}
          onChanged={async () => {
            const t = await token();
            if (t) await refresh(t);
          }}
          onRemoved={async (m) => {
            setOpen(null);
            setNotice(m);
            const t = await token();
            if (t) await refresh(t);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </>,
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  box: { borderRadius: 16, padding: 12, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  box16: { width: 20, height: 20, borderRadius: 4, borderWidth: 2 },
});

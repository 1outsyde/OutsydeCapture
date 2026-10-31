/**
 * One person on the host's Event team (p4-team step 9a, mockup B, screens 46 and 48): their times, their pay, a
 * co-host's level, and taking them off (a reason once they accepted a paid spot). Step 9b: asking them to stay longer
 * (calls 41 to 48) and entering To be discussed amounts. Same rules and copy as goutsyde.com
 * app/events/[id]/team/PersonPanel.tsx; who can do what: utils/host/eventTeamRules.ts personRights.
 */
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import api from "@/services/api";
import DateTimeSheet, {
  type PickerTarget,
} from "@/components/host/DateTimeSheet";
import {
  Chip,
  ErrorText,
  Field,
  Hint,
  OkText,
  OutlineButton,
  PickerBox,
  PrimaryButton,
  TextButton,
  hostStyles,
} from "@/components/host/hostUi";
import { flatError, parsePriceCents } from "@/utils/host/editorLogic";
import { money } from "@/utils/eventsLogic";
import { backendMessage, guestName } from "@/utils/host/manageLogic";
import {
  dateLabel,
  monthOf,
  timeLabel,
  todayIn,
} from "@/utils/host/pickerLogic";
import { personRights } from "@/utils/host/eventTeamRules";
import {
  LINK_ROLES,
  REMOVAL_REASONS,
  STAY_CHOICES,
  amountWaiting,
  isStayRequest,
  needsReason,
  stayBody,
  stayChoiceLabel,
  stayLine,
  stayPayChoices,
  stayStatus,
  timeOf,
  payBody,
  payFormFrom,
  removeQuery,
  roleName,
  scheduleBody,
  timeFields,
  zonedInputs,
  type PayForm,
  type RemovalReason,
  type StayPay,
  type StayRequest,
  type TeamRow,
  type TimeInputs,
} from "@/utils/host/teamLogic";

type Ev = {
  id: string;
  title: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  status: string;
};
type Where = string; // "times" | "pay" | "level" | "stay" | "remove" | "amt:<requestId>"
type Pick = { key: keyof TimeInputs; part: "date" | "time" } | null;

export default function TeamPersonSheet({
  row,
  event,
  asHost,
  now,
  requests,
  getToken,
  onChanged,
  onRemoved,
  onClose,
}: {
  row: TeamRow;
  event: Ev;
  asHost: boolean;
  now: number;
  /** This person's stay longer requests (GET /team/stay-longer, every role). */
  requests: StayRequest[];
  getToken: () => Promise<string | null>;
  onChanged: () => void;
  onRemoved: (message: string) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tz = event.timezone;
  const who = guestName(row);
  const accepted = row.status === "accepted";
  const can = personRights(row, event, asHost, now);

  const [times, setTimes] = useState<TimeInputs>(() => ({
    startsAt: zonedInputs(row.schedule?.startsAt ?? null, tz),
    endsAt: zonedInputs(row.schedule?.endsAt ?? null, tz),
    callAt: zonedInputs(row.schedule?.callAt ?? null, tz),
    loadInAt: zonedInputs(row.schedule?.loadInAt ?? null, tz),
  }));
  const [place, setPlace] = useState(row.schedule?.placeNote ?? "");
  const [note, setNote] = useState(row.schedule?.hostNote ?? "");
  const [pay, setPay] = useState<PayForm>(() => payFormFrom(row.pay));
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState<RemovalReason | null>(null);
  const [reasonNote, setReasonNote] = useState("");
  const [pick, setPick] = useState<Pick>(null);
  /* stay longer (step 9b) */
  const hourly = row.pay?.payType === "hourly";
  const [stayMin, setStayMin] = useState<number | null>(60);
  const [stayEnd, setStayEnd] = useState({ date: "", time: "" });
  const [stayPick, setStayPick] = useState<"date" | "time" | null>(null);
  const [stayPayPick, setStayPay] = useState<StayPay>(
    hourly ? "hourly" : "fixed",
  );
  // Their pay type can change while the sheet is open: never keep a choice the other set doesn't have (call 43).
  const stayPay: StayPay =
    hourly && stayPayPick === "fixed"
      ? "hourly"
      : !hourly && stayPayPick === "hourly"
        ? "fixed"
        : stayPayPick;
  const [stayFixed, setStayFixed] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Where | null>(null);
  // Set before any await, so a double tap sends once (state updates a render too late).
  const busyRef = useRef(false);
  const [msg, setMsg] = useState<{
    where: Where;
    text: string;
    ok: boolean;
  } | null>(null);

  async function run(
    where: Where,
    fn: (t: string) => Promise<unknown>,
    ok: string,
    after?: (body: unknown) => void,
  ) {
    if (busyRef.current) return;
    busyRef.current = true; // before the token await, so a second tap waits out the first
    setBusy(where);
    setMsg(null);
    try {
      const t = await getToken();
      if (!t) return;
      const body = await fn(t);
      setMsg({ where, text: ok, ok: true });
      if (after) after(body);
      if (!after || where === "stay") onChanged();
    } catch (e) {
      const f = flatError(e);
      if (
        where === "remove" &&
        (f.body as { code?: string } | null)?.code === "NOT_ON_TEAM"
      ) {
        onRemoved(`${who} is off the team.`);
        return;
      }
      setMsg({ where, text: backendMessage(f.status, f.body), ok: false });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function saveTimes() {
    const b = scheduleBody(times, place, note, tz);
    if (!b.ok) {
      setMsg({ where: "times", text: b.message, ok: false });
      return;
    }
    run(
      "times",
      (t) => api.setTeamTimes(event.id, row.userId, row.role, b.body, t),
      "Times saved.",
    );
  }
  function savePay() {
    const b = payBody(row.role, pay);
    if (!b.ok) {
      setMsg({ where: "pay", text: b.message, ok: false });
      return;
    }
    run(
      "pay",
      (t) => api.setTeamPay(event.id, row.userId, row.role, b.body, t),
      accepted
        ? `Pay saved. ${who} gets a push.`
        : "Pay saved. They see it on the invite.",
    );
  }
  function saveLevel(level: "team" | "edit") {
    run(
      "level",
      (t) => api.setCohostLevel(event.id, row.userId, row.scope, level, t),
      "Saved.",
    );
  }
  function askStay() {
    const b = stayBody(
      stayMin,
      stayMin === null ? stayEnd : null,
      stayPay,
      stayFixed,
      tz,
    );
    if (!b.ok) {
      setMsg({ where: "stay", text: b.message, ok: false });
      return;
    }
    run(
      "stay",
      (t) => api.askStayLonger(event.id, row.userId, row.role, b.body, t),
      `Sent. ${who} gets a push to accept or decline.`,
      (body) => {
        const r = (body as { request?: unknown } | null)?.request;
        if (isStayRequest(r))
          setMsg({
            where: "stay",
            text: `Sent. ${who} has until ${timeOf(r.expiresAt, tz)} to answer.`,
            ok: true,
          });
      },
    );
  }
  function saveAmount(r: StayRequest) {
    const c = parsePriceCents(amounts[r.id] ?? "");
    if (c === null || c > 100_000) {
      setMsg({
        where: `amt:${r.id}`,
        text: "Enter an amount up to $1,000.",
        ok: false,
      });
      return;
    }
    run(
      `amt:${r.id}`,
      (t) => api.setStayAmount(event.id, r.id, c, t),
      `Saved. ${who} gets ${money(c)} for staying.`,
    );
  }
  function remove() {
    const q = removeQuery(row, reason, reasonNote);
    if (!q.ok) {
      setMsg({ where: "remove", text: q.message, ok: false });
      return;
    }
    run(
      "remove",
      (t) => api.removeFromEventTeam(event.id, row.userId, q.query, t),
      "",
      () =>
        onRemoved(
          row.status === "invited"
            ? `${who}'s invite was cancelled.`
            : `${who} is off the team.`,
        ),
    );
  }

  const say = (where: Where) =>
    msg?.where === where ? (
      msg.ok ? (
        <OkText>{msg.text}</OkText>
      ) : (
        <ErrorText>{msg.text}</ErrorText>
      )
    ) : null;
  const setPart = (k: keyof TimeInputs, part: "date" | "time", v: string) =>
    setTimes((x) => ({ ...x, [k]: { ...x[k], [part]: v } }));
  const fallbackMonth = monthOf(todayIn(tz)) ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
  };
  const target: PickerTarget | null = pick
    ? {
        mode: pick.part,
        title:
          timeFields(row.role).find((f) => f.key === pick.key)?.label ?? "Time",
        value: times[pick.key][pick.part],
        fallbackMonth:
          monthOf(times[pick.key].date || event.startsAt.slice(0, 10)) ??
          fallbackMonth,
      }
    : null;
  const levelOn = row.cohostLevel === "edit" ? "edit" : "team";
  const mine = requests.filter((r) => r.role === row.role);
  // One open request per person, whatever the role (backend REQUEST_OPEN).
  const openRequest = requests.some((r) => r.status === "open");
  const stayTarget: PickerTarget | null = stayPick
    ? {
        mode: stayPick,
        title: stayPick === "date" ? "End date" : "End time",
        value: stayEnd[stayPick],
        fallbackMonth:
          monthOf(stayEnd.date || event.startsAt.slice(0, 10)) ?? fallbackMonth,
      }
    : null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={st.backdrop}
          onPress={() => !busy && onClose()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[
            st.sheet,
            {
              backgroundColor: theme.backgroundRoot,
              borderColor: theme.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
          accessibilityViewIsModal
          testID="person-sheet"
        >
          <View style={st.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText
                style={st.title}
                accessibilityRole="header"
                numberOfLines={1}
              >
                {who}
              </ThemedText>
              <Hint>{`${roleName(row.role, row.roleLabel)}${row.scope === "standing" ? " · All your events" : ""}`}</Hint>
            </View>
            <TextButton label="Close" disabled={!!busy} onPress={onClose} />
          </View>
          <ScrollView
            contentContainerStyle={{ gap: 18, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {can.level && (
              <View style={st.block} accessibilityLabel="What they can do">
                <ThemedText
                  style={[hostStyles.section, { color: theme.textSecondary }]}
                  accessibilityRole="header"
                >
                  WHAT THEY CAN DO
                </ThemedText>
                <View
                  style={st.chips}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Co-host level"
                >
                  {(["team", "edit"] as const).map((lv) => (
                    <Chip
                      key={lv}
                      label={lv === "team" ? "Team" : "Team + edit"}
                      on={levelOn === lv}
                      disabled={!!busy}
                      onPress={() => saveLevel(lv)}
                    />
                  ))}
                </View>
                <Hint>
                  {levelOn === "edit"
                    ? "They can also edit the event details and ticket types."
                    : "They see everything, scan, and manage the team for this event."}
                </Hint>
                {say("level")}
              </View>
            )}

            {can.times && (
              <View style={st.block} testID="sheet-times">
                <ThemedText
                  style={[hostStyles.section, { color: theme.textSecondary }]}
                  accessibilityRole="header"
                >
                  TIMES
                </ThemedText>
                {timeFields(row.role).map((f) => (
                  <View key={f.key} style={st.pair}>
                    <View style={{ flex: 1 }}>
                      <PickerBox
                        label={f.label.toUpperCase()}
                        value={
                          times[f.key].date
                            ? dateLabel(times[f.key].date)
                            : "Day"
                        }
                        onPress={() => setPick({ key: f.key, part: "date" })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PickerBox
                        label=" "
                        value={
                          times[f.key].time
                            ? timeLabel(times[f.key].time)
                            : "Time"
                        }
                        onPress={() => setPick({ key: f.key, part: "time" })}
                      />
                    </View>
                    {times[f.key].date || times[f.key].time ? (
                      <TextButton
                        label="Clear"
                        a11yLabel={`Clear ${f.label}`}
                        onPress={() =>
                          setTimes((x) => ({
                            ...x,
                            [f.key]: { date: "", time: "" },
                          }))
                        }
                      />
                    ) : null}
                  </View>
                ))}
                <Field
                  label="WHERE TO GO"
                  value={place}
                  maxLength={300}
                  placeholder="Side door on 5th"
                  onChangeText={setPlace}
                />
                <Field
                  label="YOUR NOTE TO THEM"
                  value={note}
                  maxLength={500}
                  placeholder="Wear all black."
                  onChangeText={setNote}
                  multiline
                />
                <PrimaryButton
                  label={busy === "times" ? "Saving…" : "Save times"}
                  busy={busy === "times"}
                  disabled={!!busy}
                  onPress={saveTimes}
                />
                {say("times")}
              </View>
            )}

            {can.pay && (
              <View style={st.block} testID="sheet-pay">
                <ThemedText
                  style={[hostStyles.section, { color: theme.textSecondary }]}
                  accessibilityRole="header"
                >
                  PAY
                </ThemedText>
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
                      on={pay.payType === t}
                      onPress={() => setPay((p) => ({ ...p, payType: t }))}
                    />
                  ))}
                </View>
                {pay.payType === "fixed" && (
                  <Field
                    label="FIXED AMOUNT"
                    value={pay.fixed}
                    keyboardType="decimal-pad"
                    placeholder="$160"
                    onChangeText={(v) => setPay((p) => ({ ...p, fixed: v }))}
                  />
                )}
                {pay.payType === "hourly" && (
                  <Field
                    label="HOURLY RATE"
                    value={pay.hourly}
                    keyboardType="decimal-pad"
                    placeholder="$50 an hour"
                    onChangeText={(v) => setPay((p) => ({ ...p, hourly: v }))}
                  />
                )}
                {pay.payType === "hourly" && (
                  <Hint>Paid for the shift you set, start to end.</Hint>
                )}
                {LINK_ROLES.includes(row.role) && (
                  <Field
                    label="COMMISSION ON THEIR LINK SALES (OPTIONAL)"
                    value={pay.commission}
                    keyboardType="decimal-pad"
                    placeholder="10%"
                    onChangeText={(v) =>
                      setPay((p) => ({ ...p, commission: v }))
                    }
                  />
                )}
                <Hint>
                  Paid 3 days after the event due to processing, once they set
                  up payouts.
                </Hint>
                <PrimaryButton
                  label={busy === "pay" ? "Saving…" : "Save pay"}
                  busy={busy === "pay"}
                  disabled={!!busy}
                  onPress={savePay}
                />
                {say("pay")}
              </View>
            )}

            {(can.stay || mine.length > 0) && (
              <View style={st.block} testID="sheet-stay">
                <ThemedText
                  style={[hostStyles.section, { color: theme.textSecondary }]}
                  accessibilityRole="header"
                >
                  STAY LONGER
                </ThemedText>
                {mine.map((r) => (
                  <View
                    key={r.id}
                    style={[
                      st.req,
                      { backgroundColor: theme.backgroundDefault },
                    ]}
                    testID="stay-request"
                  >
                    <ThemedText style={hostStyles.body}>
                      {stayLine(r, tz, true)}
                    </ThemedText>
                    <Hint>{stayStatus(r, tz)}</Hint>
                    {asHost && amountWaiting(r) && (
                      <>
                        <View style={st.pair}>
                          <View style={{ flex: 1 }}>
                            <Field
                              label="AMOUNT FOR STAYING"
                              value={amounts[r.id] ?? ""}
                              keyboardType="decimal-pad"
                              placeholder="$ amount"
                              onChangeText={(v) =>
                                setAmounts((a) => ({ ...a, [r.id]: v }))
                              }
                            />
                          </View>
                          <OutlineButton
                            label="Save"
                            disabled={!!busy}
                            onPress={() => saveAmount(r)}
                          />
                        </View>
                        <Hint>
                          Enter it before payout day, 3 days after the event, or
                          it&apos;s $0.
                        </Hint>
                      </>
                    )}
                    {say(`amt:${r.id}`)}
                  </View>
                ))}
                {can.stay && !openRequest && (
                  <>
                    <View
                      style={st.chips}
                      accessibilityRole="radiogroup"
                      accessibilityLabel="How much longer"
                    >
                      {STAY_CHOICES.map((m) => (
                        <Chip
                          key={m}
                          label={stayChoiceLabel(m)}
                          on={stayMin === m}
                          onPress={() => setStayMin(m)}
                        />
                      ))}
                      <Chip
                        label="Pick end time"
                        on={stayMin === null}
                        onPress={() => setStayMin(null)}
                      />
                    </View>
                    {stayMin === null && (
                      <View style={st.pair}>
                        <View style={{ flex: 1 }}>
                          <PickerBox
                            label="END DATE"
                            value={
                              stayEnd.date ? dateLabel(stayEnd.date) : "Day"
                            }
                            onPress={() => setStayPick("date")}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PickerBox
                            label="END TIME"
                            value={
                              stayEnd.time ? timeLabel(stayEnd.time) : "Time"
                            }
                            onPress={() => setStayPick("time")}
                          />
                        </View>
                      </View>
                    )}
                    <View
                      style={st.chips}
                      accessibilityRole="radiogroup"
                      accessibilityLabel="Extra pay"
                    >
                      {stayPayChoices(hourly).map((c) => (
                        <Chip
                          key={c.key}
                          label={c.label}
                          on={stayPay === c.key}
                          onPress={() => setStayPay(c.key)}
                        />
                      ))}
                    </View>
                    {stayPay === "fixed" && (
                      <Field
                        label="EXTRA AMOUNT"
                        value={stayFixed}
                        keyboardType="decimal-pad"
                        placeholder="$50"
                        onChangeText={setStayFixed}
                      />
                    )}
                    <PrimaryButton
                      label={
                        busy === "stay" ? "Sending…" : `Ask ${who} to stay`
                      }
                      busy={busy === "stay"}
                      disabled={!!busy}
                      onPress={askStay}
                    />
                    <Hint>
                      They have until their end time to answer, and at least 30
                      minutes.
                    </Hint>
                  </>
                )}
                {say("stay")}
              </View>
            )}

            {can.remove && (
              <View style={st.block} testID="sheet-remove">
                {!removing ? (
                  <OutlineButton
                    danger
                    label={
                      row.status === "invited"
                        ? "Cancel invite"
                        : "Take off the team"
                    }
                    disabled={!!busy}
                    onPress={() => {
                      setRemoving(true);
                      setMsg(null);
                    }}
                  />
                ) : (
                  <>
                    <ThemedText style={hostStyles.body}>
                      {row.status === "invited"
                        ? `Cancel ${who}'s invite? They won't be able to accept it.`
                        : row.scope === "standing"
                          ? `Take ${who} off your Event team for all your events?`
                          : `Take ${who} off this event's team?`}
                    </ThemedText>
                    {accepted && (
                      <>
                        <ThemedText
                          style={[
                            hostStyles.section,
                            { color: theme.textSecondary },
                          ]}
                        >
                          WHY
                        </ThemedText>
                        <View
                          style={st.chips}
                          accessibilityRole="radiogroup"
                          accessibilityLabel="Why"
                        >
                          {REMOVAL_REASONS.map((r) => (
                            <Chip
                              key={r.key}
                              label={r.label}
                              on={reason === r.key}
                              onPress={() =>
                                setReason(reason === r.key ? null : r.key)
                              }
                            />
                          ))}
                        </View>
                        {reason === "other" && (
                          <Field
                            label="SAY WHY"
                            value={reasonNote}
                            maxLength={200}
                            placeholder="A few words"
                            onChangeText={setReasonNote}
                          />
                        )}
                        <Hint>
                          {needsReason(row)
                            ? "They had pay, so they see the reason you pick."
                            : "Optional. If you pick one, they see it."}
                        </Hint>
                      </>
                    )}
                    <PrimaryButton
                      label={
                        busy === "remove"
                          ? "Saving…"
                          : row.status === "invited"
                            ? "Yes, cancel invite"
                            : "Yes, take them off"
                      }
                      busy={busy === "remove"}
                      disabled={!!busy}
                      onPress={remove}
                    />
                    <TextButton
                      center
                      label="Keep"
                      disabled={!!busy}
                      onPress={() => {
                        setRemoving(false);
                        setReason(null);
                        setReasonNote("");
                      }}
                    />
                  </>
                )}
                {say("remove")}
              </View>
            )}
            {!can.times &&
              !can.pay &&
              !can.level &&
              !can.remove &&
              mine.length === 0 && (
                <Hint>
                  This event is over, so its Event team can&apos;t change.
                </Hint>
              )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <DateTimeSheet
        target={stayTarget}
        onClose={() => setStayPick(null)}
        onDone={(v) => {
          if (stayPick) setStayEnd((x) => ({ ...x, [stayPick]: v }));
          setStayPick(null);
        }}
      />
      <DateTimeSheet
        target={target}
        onClose={() => setPick(null)}
        onDone={(v) => {
          if (pick) setPart(pick.key, pick.part, v);
          setPick(null);
        }}
      />
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "700" },
  block: { gap: 10 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  req: { borderRadius: 12, padding: 10, gap: 6 },
  pair: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
});

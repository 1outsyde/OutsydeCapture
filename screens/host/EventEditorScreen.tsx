/**
 * Host an event in the app (Events canvas 8 to 13, 31, 32, 35), the same flow as goutsyde.com/events/new:
 * payout gate, start (cover and drafts), Details, Tickets, Review with the Event Host Agreement on Publish, live.
 * The first save creates the draft (POST), later saves PATCH only what changed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import type { ScrollViewInstance } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { uploadImage } from "@/services/mediaUpload";
import type { RootStackParamList } from "@/navigation/types";
import {
  Box, Centered, Chip, ErrorText, Field, GOLD, Hint, HostHeader, Label, OkText, OutlineButton, PickerBox, PrimaryButton, Progress,
  RadioRow, Switch, TextButton, hostStyles,
} from "@/components/host/hostUi";
import DateTimeSheet, { type PickerTarget } from "@/components/host/DateTimeSheet";
import OptionSheet from "@/components/host/OptionSheet";
import TicketTypeSheet from "@/components/host/TicketTypeSheet";
import AgreementSheet, { toAgreement, type Agreement } from "@/components/host/AgreementSheet";
import PreviewCard from "@/components/host/PreviewCard";
import { GENERIC_ERROR, fmt, safeZone } from "@/utils/eventsLogic";
import {
  activeTypes, addressLabel, autoEndDate, canRemoveType, changedFields, clockChangeNote, createBody, dayOfNote, emptyForm, emptySheet,
  eventTimes, failureCopy, flatError, formFromEvent, hostAsLabel, isHostEvent, isHostTicketType, nextStepLabel, patchBody, publishFailure,
  refundChangeAllowed, refundLabel, safeHttpUrl, shareUrl, sheetFromType, stripeUrl, ticketBody, ticketRowLines, ticketsSummary,
  timeZoneLabel, usTimeZones, validateForm, whenRange,
  type EventForm, type HostAs, type HostEvent, type HostTicketType, type PublishNext, type TicketSheet,
} from "@/utils/host/editorLogic";
import {
  clearHostSetupPending, gateAtOpen, gateCopy, hostChoicesFromStatus, markHostSetupPending, onHostSetupReturn, paidReady, statusResult,
  type GateStatus, type HostStatuses,
} from "@/utils/host/hostGate";
import { dateLabel, monthOf, timeLabel, todayIn } from "@/utils/host/pickerLogic";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Screen = "loading" | "error" | "gate" | "start" | "details" | "tickets" | "review" | "live";
type Step = "details" | "tickets" | "review";
/** Where the gate goes once payouts are ready. */
type AfterGate = "start" | "create" | "tickets" | "review";

const STEPS: Record<Step, { n: number; title: string }> = {
  details: { n: 1, title: "Event details" },
  tickets: { n: 2, title: "Tickets" },
  review: { n: 3, title: "Review" },
};
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const UPLOAD_FAILED = "We couldn't upload that photo. Try again, or continue without one for now.";
const NOT_FINISHED = "Your payout setup isn't finished yet. Tap the button to keep going.";
const VISIBILITY: { value: EventForm["addressVisibility"]; label: string }[] = [
  { value: "ticket_holders", label: "People with a ticket, right away" },
  { value: "ticket_holders_day_of", label: "People with a ticket, on the day of the event" },
  { value: "public", label: "Everyone" },
];
const STRIPE_RETURN_URL = "outsyde://stripe-return";

function phoneZone(): string {
  try { return safeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"); } catch { return "America/New_York"; }
}

export default function EventEditorScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  // The id the editor opened with. Saving a new draft sets the route param too (so a remount edits it), but the
  // load below keys on this first value only, so the first save never reloads the screen.
  const [routeId] = useState(useRoute<RouteProp<RootStackParamList, "EventEditor">>().params?.eventId);
  // getToken is a new function on every auth update: read it through a ref so loads don't rerun (and reset the form).
  const { getToken: authToken } = useAuth();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const getToken = useCallback(() => tokenRef.current(), []);
  const zone = useMemo(phoneZone, []);

  const [screen, setScreen] = useState<Screen>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(routeId ?? null);
  const [event, setEvent] = useState<HostEvent | null>(null);
  const [types, setTypes] = useState<HostTicketType[]>([]);
  const [form, setForm] = useState<EventForm>(() => emptyForm(zone));
  const [base, setBase] = useState<EventForm | null>(null);
  const [startLocked, setStartLocked] = useState(false);
  const [hosts, setHosts] = useState<HostAs[]>(["user"]);
  const [statuses, setStatuses] = useState<HostStatuses>({ user: "unknown", business: "unknown", photographer: "unknown" });
  const [drafts, setDrafts] = useState<HostEvent[]>([]);
  const [busy, setBusy] = useState(false);
  /** In flight right away (state updates land a render later): stops a double tap from creating two drafts. */
  const saving = useRef(false);
  const publishing = useRef(false);
  /** Stripe is live for the event's host (paid tickets can sell). Null until known. */
  const [paidOk, setPaidOk] = useState<boolean | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ initial: TicketSheet; editing: HostTicketType | null } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<HostTicketType | null>(null);
  const [picker, setPicker] = useState<(PickerTarget & { field: "date" | "startTime" | "endTime" | "endDate" }) | null>(null);
  const [zonePick, setZonePick] = useState(false);
  const [multiDay, setMultiDay] = useState(false);
  const [gate, setGate] = useState<{ host: HostAs; state: "setup" | "finish"; after: AfterGate; opening: boolean; error: string | null } | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [agreementNotice, setAgreementNotice] = useState<string | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [publishError, setPublishError] = useState<{ message: string; next: PublishNext } | null>(null);
  const [copied, setCopied] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; clearHostSetupPending(); }, []);

  /** Token or a trip to sign in. */
  const token = useCallback(async (): Promise<string | null> => {
    const t = await getToken();
    if (!t) navigation.navigate("Auth", {});
    return t;
  }, [getToken, navigation]);

  /** Error copy for a failed call; a lost session goes to sign in. */
  const copyFor = useCallback((err: unknown): string => {
    const f = flatError(err);
    if (f.status === 401) navigation.navigate("Auth", {});
    return failureCopy(f.status, f.body).message;
  }, [navigation]);

  const applyServer = useCallback((e: HostEvent, ts?: unknown) => {
    const f = formFromEvent(e);
    setEvent(e);
    setForm(f);
    setBase(f);
    setMultiDay(f.endDate !== "");
    setStartLocked(new Date(e.startsAt).getTime() <= Date.now());
    if (Array.isArray(ts)) setTypes(ts.filter(isHostTicketType));
  }, []);

  /* ---------- payout status ---------- */

  const fetchStatus = useCallback(async (t: string, h: HostAs): Promise<{ gate: GateStatus; paid: boolean | null }> => {
    try {
      const r = await api.getHostPayoutStatus(h, t);
      return { gate: statusResult(r), paid: paidReady(r) };
    } catch (e) {
      return { gate: statusResult(null, e), paid: null };
    }
  }, []);
  const loadStatus = useCallback(async (t: string, h: HostAs): Promise<GateStatus> => (await fetchStatus(t, h)).gate, [fetchStatus]);

  const loadStatuses = useCallback(async (t: string): Promise<HostStatuses> => {
    const [user, business, photographer] = await Promise.all((["user", "business", "photographer"] as HostAs[]).map((h) => loadStatus(t, h)));
    const s = { user, business, photographer };
    if (live.current) setStatuses(s);
    return s;
  }, [loadStatus]);

  /* ---------- loading ---------- */

  const loadEvent = useCallback(async (id: string): Promise<boolean> => {
    const t = await token();
    if (!t) return false;
    try {
      const r = await api.getManageEvent(id, t);
      if (!r?.success || !isHostEvent(r.event)) throw { status: 500 };
      if (r.event.status === "cancelled") {
        setLoadError("This event was cancelled, so it can't be edited.");
        setScreen("error");
        return false;
      }
      applyServer(r.event, r.ticketTypes);
      fetchStatus(t, r.event.hostType).then((st) => {
        if (!live.current) return;
        setStatuses((p) => ({ ...p, [r.event.hostType]: st.gate }));
        setPaidOk(st.paid);
      });
      return true;
    } catch (e) {
      const f = flatError(e);
      setLoadError(f.status === 404 ? "We couldn't find that event on your account." : copyFor(e));
      setScreen("error");
      return false;
    }
  }, [token, applyServer, copyFor, fetchStatus]);

  const loadStart = useCallback(async () => {
    const t = await token();
    if (!t) return;
    const [s, mine] = await Promise.all([loadStatuses(t), api.getMyHostedEvents(t).catch(() => null)]);
    if (!live.current) return;
    const choices = hostChoicesFromStatus(s);
    setHosts(choices);
    const list: unknown[] = Array.isArray(mine?.events) ? mine!.events : [];
    setDrafts(list.filter(isHostEvent).filter((e) => e.status === "draft"));
    const first = gateAtOpen(choices, s);
    if (first) {
      setGate({ host: first, state: s[first] as "setup" | "finish", after: "start", opening: false, error: null });
      setScreen("gate");
    } else {
      setScreen("start");
    }
  }, [token, loadStatuses]);

  const load = useCallback(async () => {
    setScreen("loading");
    setLoadError(null);
    if (routeId) { if (await loadEvent(routeId)) setScreen("details"); } else await loadStart();
  }, [routeId, loadEvent, loadStart]);

  useEffect(() => { load(); }, [load]);

  const go = useCallback((sc: Screen) => {
    setScreen(sc);
    setError(null);
    setNotice(null);
    setPublishError(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const editForm = useCallback(<K extends keyof EventForm>(k: K, v: EventForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }, []);

  /* ---------- saving ---------- */

  async function save(): Promise<boolean> {
    if (saving.current) return false;
    const problem = validateForm(form);
    if (problem) { setError(problem); setErrorCode(null); return false; }
    saving.current = true;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    setNotice(null);
    try {
      const t = await token();
      if (!t) return false;
      if (!eventId) {
        // Every host sets up payouts before the draft exists (Legend 2026-10-26).
        const st = await loadStatus(t, form.hostAs);
        setStatuses((p) => ({ ...p, [form.hostAs]: st }));
        if (st === "setup" || st === "finish") {
          setGate({ host: form.hostAs, state: st, after: "create", opening: false, error: null });
          setScreen("gate");
          return false;
        }
        const r = await api.createEvent(createBody(form), t);
        if (!r?.success || !isHostEvent(r.event)) { setError(GENERIC_ERROR); return false; }
        setEventId(r.event.id);
        applyServer(r.event, r.ticketTypes ?? []);
        // Opening the editor again from here edits this draft, never a second one.
        navigation.setParams({ eventId: r.event.id });
        return true;
      }
      const patch = patchBody(base ?? form, form);
      if (Object.keys(patch).length === 0) return true;
      const r = await api.updateEvent(eventId, patch, t);
      if (!r?.success || !isHostEvent(r.event)) { setError(GENERIC_ERROR); return false; }
      applyServer(r.event, r.ticketTypes);
      return true;
    } catch (e) {
      setError(copyFor(e));
      const code = flatError(e).body?.code;
      setErrorCode(typeof code === "string" ? code : null);
      return false;
    } finally {
      saving.current = false;
      if (live.current) setBusy(false);
    }
  }

  /** "This event just changed": load the saved version (the person's unsaved edits on this step are replaced). */
  async function reloadEvent() {
    if (!eventId) return;
    setError(null);
    setErrorCode(null);
    await loadEvent(eventId);
  }

  async function saveDraft() {
    if (await save()) setNotice(event && event.status !== "draft" ? "Changes saved." : "Draft saved.");
  }

  async function next(to: Step) {
    if (!(await save())) return;
    go(to);
    if (to === "review" && event?.status !== "published") loadAgreement();
  }

  /* ---------- cover ---------- */

  async function pickCover() {
    setError(null);
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { setError("Allow photo access in Settings to add a cover photo."); return; }
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true, aspect: [16, 9] });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > MAX_UPLOAD_BYTES) { setError("That photo is too large. Choose one under 20 MB."); return; }
      const t = await token();
      if (!t) return;
      setUploading(true);
      const up = await uploadImage(a.uri, a.mimeType ?? "image/jpeg", "covers", t);
      const url = safeHttpUrl(up.url);
      if (!url) { setError(UPLOAD_FAILED); return; }
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch {
      setError(UPLOAD_FAILED);
    } finally {
      if (live.current) setUploading(false);
    }
  }

  /* ---------- ticket types ---------- */

  async function saveType(body: Record<string, unknown>): Promise<string | null> {
    if (!eventId || !sheet) return GENERIC_ERROR;
    const t = await token();
    if (!t) return null;
    const editing = sheet.editing;
    let patch = body;
    if (editing && event) {
      const before = ticketBody(sheetFromType(editing, event.timezone), event.timezone);
      if (before.ok) patch = changedFields(before.body, body);
      if (Object.keys(patch).length === 0) { setSheet(null); return null; }
    }
    try {
      const r = editing ? await api.updateTicketType(eventId, editing.id, patch, t) : await api.addTicketType(eventId, body, t);
      if (!r?.success || !isHostTicketType(r.ticketType)) return GENERIC_ERROR;
      const tt = r.ticketType as HostTicketType;
      setTypes((prev) => (editing ? prev.map((x) => (x.id === tt.id ? tt : x)) : [...prev, tt]));
      setSheet(null);
      setNotice(editing ? `${tt.name} saved.` : `${tt.name} added.`);
      return null;
    } catch (e) {
      return copyFor(e);
    }
  }

  function askRemove(tt: HostTicketType) {
    if (!event || removingId) return;
    const guard = canRemoveType(event.status, types, tt.id);
    if (!guard.ok) { setNotice(null); setError(guard.reason); return; }
    if (tt.takenCount > 0) { setConfirmRemove(tt); return; }
    removeType(tt);
  }

  async function removeType(tt: HostTicketType) {
    if (!eventId) return;
    setConfirmRemove(null);
    const t = await token();
    if (!t) return;
    setRemovingId(tt.id);
    setError(null);
    setNotice(null);
    try {
      const r = await api.removeTicketType(eventId, tt.id, t);
      if (r?.removed === "archived" && isHostTicketType(r.ticketType)) {
        const archived = r.ticketType as HostTicketType;
        setTypes((prev) => prev.map((x) => (x.id === tt.id ? archived : x)));
        setNotice(`${tt.name} has sales, so it stopped selling instead of being deleted. Tickets already taken stay valid.`);
      } else {
        setTypes((prev) => prev.filter((x) => x.id !== tt.id));
        setNotice(`${tt.name} removed.`);
      }
    } catch (e) {
      setError(copyFor(e));
    } finally {
      if (live.current) setRemovingId(null);
    }
  }

  /* ---------- payout gate ---------- */

  async function openGateSetup() {
    if (!gate || gate.opening) return;
    const t = await token();
    if (!t) return;
    setGate({ ...gate, opening: true, error: null });
    try {
      const r = gate.host === "user"
        ? await api.startPayoutSetup(t)
        : gate.host === "business"
          ? await api.startVendorStripeOnboarding(t, STRIPE_RETURN_URL)
          : await api.startPhotographerStripeOnboarding(t, STRIPE_RETURN_URL);
      const url = stripeUrl(r?.url);
      if (!url) throw { status: 500 };
      markHostSetupPending();
      await Linking.openURL(url);
      if (live.current) setGate((g) => (g ? { ...g, opening: false } : g));
    } catch (e) {
      clearHostSetupPending();
      if (live.current) setGate((g) => (g ? { ...g, opening: false, error: copyFor(e) } : g));
    }
  }

  /** "Not now": from the start of a new event, close; otherwise back to the step the gate came from (edits kept). */
  function leaveGate() {
    const g = gate;
    clearHostSetupPending();
    setGate(null);
    if (!g || g.after === "start") { close(); return; }
    setScreen(g.after === "create" ? "details" : g.after);
  }

  /** Tickets banner: save the step first, then the gate (it comes back to Tickets). */
  async function payoutsFromTickets(ev: HostEvent) {
    if (!(await save())) return;
    const st = statuses[ev.hostType];
    setGate({ host: ev.hostType, state: st === "setup" ? "setup" : "finish", after: "tickets", opening: false, error: null });
    setScreen("gate");
  }

  /** After Stripe (or Check again): ready moves on, otherwise the gate stays with a note. */
  const recheckGate = useCallback(async () => {
    const g = gate;
    if (!g) return;
    const t = await getToken();
    if (!t) return;
    const st = await loadStatus(t, g.host);
    if (!live.current) return;
    setStatuses((p) => ({ ...p, [g.host]: st }));
    if (st !== "ready") {
      setGate({ ...g, state: st === "setup" ? "setup" : "finish", opening: false, error: st === "unknown" ? GENERIC_ERROR : NOT_FINISHED });
      return;
    }
    clearHostSetupPending();
    setGate(null);
    if (g.after === "start") setScreen("start");
    else if (g.after === "review") { setScreen("review"); setPublishError(null); }
    else if (g.after === "tickets") setScreen("tickets");
    else setScreen("details"); // create: the person taps Next again with the same form
    if (g.after === "tickets" || g.after === "review") {
      fetchStatus(t, g.host).then((x) => { if (live.current) setPaidOk(x.paid); });
    }
    if (g.after === "create") setNotice("Payouts are set up. Tap Next to save your event.");
  }, [gate, getToken, loadStatus, fetchStatus]);

  useEffect(() => {
    if (screen !== "gate") return;
    const off = onHostSetupReturn(() => { recheckGate(); });
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") recheckGate(); });
    return () => { off(); sub.remove(); };
  }, [screen, recheckGate]);

  /* ---------- agreement and publish ---------- */

  const loadAgreement = useCallback(async (): Promise<Agreement | null> => {
    setAgreement(null);
    setAgreementError(null);
    const t = await getToken();
    if (!t) return null;
    try {
      const r = await api.getHostAgreement(t);
      const a = r?.success ? toAgreement(r.agreement) : null;
      if (!a) { setAgreementError(GENERIC_ERROR); return null; }
      setAgreement(a);
      return a;
    } catch (e) {
      setAgreementError(copyFor(e));
      return null;
    }
  }, [getToken, copyFor]);

  /** Callers hold the publishing ref, so a double tap never sends two publishes. */
  async function publish() {
    if (!eventId) return;
    const t = await token();
    if (!t) return;
    setBusy(true);
    setPublishError(null);
    setNotice(null);
    try {
      const r = await api.publishEvent(eventId, t);
      if (r?.success && isHostEvent(r.event)) {
        applyServer(r.event, r.ticketTypes);
        setAgreementOpen(false);
        go("live");
        return;
      }
      setPublishError({ message: GENERIC_ERROR, next: null });
    } catch (e) {
      const f = flatError(e);
      if (f.status === 401) { navigation.navigate("Auth", {}); return; }
      const pf = publishFailure(f.status, f.body);
      if (pf.next === "agreement") {
        setAgreementNotice(pf.message);
        await loadAgreement();
        setAgreementOpen(true);
        return;
      }
      setAgreementOpen(false);
      setPublishError({ message: pf.message, next: pf.next });
    } finally {
      if (live.current) setBusy(false);
    }
  }

  /** Publish button: straight to publish once accepted, otherwise the agreement pops up. */
  async function onPublishPress() {
    if (publishing.current || saving.current) return;
    publishing.current = true;
    try {
      setAgreementNotice(null);
      const a = agreement ?? (await loadAgreement());
      if (a?.accepted) { await publish(); return; }
      setAgreementOpen(true);
    } finally {
      publishing.current = false;
    }
  }

  async function agreeAndPublish() {
    if (!agreement || publishing.current) return;
    publishing.current = true;
    try {
      await acceptThenPublish(agreement);
    } finally {
      publishing.current = false;
    }
  }

  async function acceptThenPublish(agreement: Agreement) {
    const t = await token();
    if (!t) return;
    setBusy(true);
    setAgreementNotice(null);
    try {
      const r = await api.acceptHostAgreement(agreement.version, t);
      const a = r?.success ? toAgreement(r.agreement) : null;
      if (!a || !a.accepted) { setAgreementNotice(GENERIC_ERROR); setBusy(false); return; }
      setAgreement(a);
    } catch (e) {
      const f = flatError(e);
      setBusy(false);
      if (f.status === 409 && f.body?.code === "AGREEMENT_VERSION_CHANGED") {
        setAgreementNotice(publishFailure(f.status, f.body).message);
        await loadAgreement();
        return;
      }
      setAgreementNotice(copyFor(e));
      return;
    }
    setBusy(false);
    await publish();
  }

  async function runNext(n: PublishNext) {
    if (n === "new") navigation.replace("EventEditor", undefined);
    else if (n === "tickets") go("tickets");
    else if (n === "payouts" && event) {
      const st = statuses[event.hostType];
      setGate({ host: event.hostType, state: st === "setup" ? "setup" : "finish", after: "review", opening: false, error: null });
      setScreen("gate");
    } else if (n === "manage" && eventId) backTo("ManageEvent", eventId);
    else if (n === "reload" && eventId) {
      setPublishError(null);
      await loadEvent(eventId);
      await loadAgreement();
    }
  }

  /* ---------- live ---------- */

  async function copyLink() {
    if (!event) return;
    try { await Clipboard.setStringAsync(shareUrl(event.slug)); setCopied(true); } catch { setCopied(false); }
  }
  async function shareLink() {
    if (!event) return;
    try { await Share.share({ message: `${event.title} ${shareUrl(event.slug)}` }); } catch { /* closed */ }
  }

  /* ---------- render ---------- */

  const close = () => navigation.goBack();
  /** Go to a screen that may already be under the editor in the stack: pop back to it, never stack a second copy. */
  const backTo = (name: "ManageEvent" | "YourEvents", id?: string) => {
    const st = navigation.getState();
    const routes = st?.routes ?? [];
    let at = -1;
    for (let i = (st?.index ?? 0) - 1; i >= 0; i--) {
      const r = routes[i];
      if (r.name === name && (name === "YourEvents" || (r.params as { eventId?: string } | undefined)?.eventId === id)) { at = i; break; }
    }
    if (at >= 0) navigation.pop(st.index - at);
    else if (name === "ManageEvent" && id) navigation.replace("ManageEvent", { eventId: id });
    else navigation.replace("YourEvents");
  };
  const root = (children: React.ReactNode) => (
    <View style={[s.root, { backgroundColor: theme.backgroundRoot }]}>{children}</View>
  );
  const messages = (
    <>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {error && errorCode === "EVENT_CHANGED" && eventId ? <TextButton center gold label="Reload" onPress={reloadEvent} /> : null}
      {notice ? <OkText>{notice}</OkText> : null}
    </>
  );

  if (screen === "loading") {
    return root(<><HostHeader left={{ icon: "x", label: "Close", onPress: close }} title="Create Event" /><Centered><ActivityIndicator color={GOLD} /></Centered></>);
  }

  if (screen === "error") {
    return root(
      <>
        <HostHeader left={{ icon: "x", label: "Close", onPress: close }} title="Events" />
        <Centered>
          <ThemedText style={[hostStyles.body, { textAlign: "center" }]} accessibilityRole="alert">{loadError ?? GENERIC_ERROR}</ThemedText>
          <PrimaryButton label="Try again" onPress={load} style={{ alignSelf: "stretch" }} />
          <TextButton center label="Your events" gold onPress={() => backTo("YourEvents")} />
        </Centered>
      </>,
    );
  }

  if (screen === "gate" && gate) {
    const c = gateCopy(gate.host, gate.state);
    const steps = [c.step1, "Stripe checks your details and adds your bank.", "You come right back here to create your event."];
    return root(
      <>
        <HostHeader left={{ icon: "x", label: "Close", onPress: close }} title="Create Event" />
        <ScrollView contentContainerStyle={[s.body, { gap: 18 }]}>
          <View style={[s.gateIcon, { backgroundColor: "rgba(232,185,48,0.14)" }]}>
            <Feather name="credit-card" size={30} color={theme.brandGold} />
          </View>
          <ThemedText style={hostStyles.h1} accessibilityRole="header">{c.title}</ThemedText>
          <ThemedText style={[hostStyles.body, { color: theme.textSecondary }]}>{c.body}</ThemedText>
          <View style={{ gap: 14 }}>
            {steps.map((st, i) => (
              <View key={i} style={s.stepRow}>
                <View style={[s.stepNum, { borderColor: GOLD }]}><ThemedText style={{ color: theme.brandGold, fontWeight: "700" }}>{i + 1}</ThemedText></View>
                <ThemedText style={[hostStyles.body, { flex: 1 }]}>{st}</ThemedText>
              </View>
            ))}
          </View>
          {gate.error ? <ErrorText>{gate.error}</ErrorText> : null}
        </ScrollView>
        <View style={[s.foot, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
          <PrimaryButton label={gate.opening ? "Opening Stripe…" : c.cta} onPress={openGateSetup} busy={gate.opening} />
          {gate.error === NOT_FINISHED || gate.error === GENERIC_ERROR ? <TextButton center label="Check again" gold onPress={recheckGate} /> : null}
          <TextButton center label="Not now" onPress={leaveGate} />
        </View>
      </>,
    );
  }

  if (screen === "start") {
    const cover = safeHttpUrl(form.coverImageUrl);
    return root(
      <>
        <HostHeader left={{ icon: "x", label: "Close", onPress: close }} title="Create Event" />
        <ScrollView contentContainerStyle={[s.body, { gap: 18 }]}>
          <Pressable onPress={pickCover} disabled={uploading} accessibilityRole="button" accessibilityLabel={cover ? "Change cover photo" : "Add a cover photo"}
            style={[s.coverTile, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Feather name="image" size={30} color={theme.textSecondary} />}
            <View style={[s.coverLabel, cover ? { backgroundColor: "rgba(0,0,0,0.55)" } : null]}>
              <ThemedText style={[hostStyles.strong, cover ? { color: "#FFFFFF" } : null]}>{uploading ? "Uploading…" : cover ? "Change cover photo" : "Add a cover photo"}</ThemedText>
              {!cover ? <Hint style={{ textAlign: "center" }}>This is what people see in Discover. You can change it later.</Hint> : null}
            </View>
          </Pressable>
          {messages}
          {drafts.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Label>YOUR DRAFTS</Label>
              {drafts.map((d) => (
                <Pressable key={d.id} onPress={() => navigation.replace("EventEditor", { eventId: d.id })} accessibilityRole="button"
                  style={[s.draft, { borderColor: theme.border }]}>
                  <View style={[s.draftThumb, { backgroundColor: theme.backgroundDefault }]}>
                    {safeHttpUrl(d.coverImageUrl) ? <Image source={{ uri: d.coverImageUrl as string }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={hostStyles.strong} numberOfLines={1}>{d.title}</ThemedText>
                    <Hint>Draft · {fmt(d.startsAt, d.timezone, { weekday: "short", month: "short", day: "numeric" })}</Hint>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={[s.foot, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
          <PrimaryButton label="Next" onPress={() => go("details")} disabled={uploading} />
        </View>
      </>,
    );
  }

  if (screen === "live" && event) {
    const url = shareUrl(event.slug);
    return root(
      <>
        <HostHeader left={{ icon: "x", label: "Close", onPress: () => backTo("YourEvents") }} />
        <ScrollView contentContainerStyle={[s.body, { gap: 16, alignItems: "stretch" }]}>
          <View style={[s.liveCheck, { backgroundColor: GOLD }]}><Feather name="check" size={34} color="#0B0B0B" /></View>
          <ThemedText style={[hostStyles.h1, { textAlign: "center" }]} accessibilityRole="header">YOUR EVENT IS LIVE</ThemedText>
          <ThemedText style={[hostStyles.body, { textAlign: "center", color: theme.textSecondary }]}>
            {event.visibility === "unlisted"
              ? "Only people with the link can find it. Share the link to fill it up."
              : "People can find it in Discover under Events. Share the link to fill it up."}
          </ThemedText>
          <PreviewCard form={form} types={types} startsAt={event.startsAt} showPrice={false} />
          <View style={[s.share, { borderColor: theme.border }]}>
            <ThemedText style={{ flex: 1, fontSize: 14 }} numberOfLines={1} selectable testID="share-url">{url.replace(/^https:\/\//, "")}</ThemedText>
            <Pressable onPress={copyLink} accessibilityRole="button" hitSlop={8}><ThemedText style={{ color: theme.brandGold, fontWeight: "700" }}>{copied ? "Copied" : "Copy"}</ThemedText></Pressable>
          </View>
          <PrimaryButton label="Share link" onPress={shareLink} />
          <View style={s.twoUp}>
            <OutlineButton label="View event" onPress={() => navigation.navigate("EventDetail", { slug: event.slug })} style={{ flex: 1 }} />
            <OutlineButton label="Manage event" onPress={() => backTo("ManageEvent", event.id)} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </>,
    );
  }

  const step = (screen === "details" || screen === "tickets" || screen === "review" ? screen : "details") as Step;
  const meta = STEPS[step];
  const published = !!event && event.status !== "draft";
  const back = step === "details"
    ? (routeId ? close : () => go("start"))
    : () => go(step === "review" ? "tickets" : "details");

  return root(
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <HostHeader
        left={{ icon: "chevron-left", label: "Back", onPress: back }}
        title={meta.title}
        sub={`Step ${meta.n} of 3`}
        right={step !== "review" ? <TextButton label={published ? "Save" : "Save draft"} gold onPress={saveDraft} disabled={busy || uploading} /> : null}
      />
      <Progress step={meta.n} />
      <ScrollView ref={scroll} contentContainerStyle={[s.body, { gap: 18 }]} keyboardShouldPersistTaps="handled">
        {step === "details" ? renderDetails() : null}
        {step === "tickets" && event ? renderTickets(event) : null}
        {step === "review" && event ? renderReview(event) : null}
      </ScrollView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
        {messages}
        {publishError ? (
          <View style={{ gap: 8 }}>
            <ErrorText>{publishError.message}</ErrorText>
            {nextStepLabel(publishError.next) ? <OutlineButton label={nextStepLabel(publishError.next)!} onPress={() => runNext(publishError.next)} /> : null}
          </View>
        ) : null}
        {step === "details" ? <PrimaryButton label={busy ? "Saving…" : "Next: tickets"} onPress={() => next("tickets")} busy={busy} disabled={uploading} /> : null}
        {step === "tickets" ? <PrimaryButton label={busy ? "Saving…" : "Next: review"} onPress={() => next("review")} busy={busy} /> : null}
        {step === "review" && !published ? (
          <>
            <PrimaryButton label={busy && !agreementOpen ? "Publishing…" : "Publish event"} onPress={onPublishPress} busy={busy && !agreementOpen} />
            <TextButton center label="Save as draft" onPress={saveDraft} disabled={busy} />
          </>
        ) : null}
        {step === "review" && published && event ? (
          <View style={s.twoUp}>
            <OutlineButton label="View event" onPress={() => navigation.navigate("EventDetail", { slug: event.slug })} style={{ flex: 1 }} />
            <OutlineButton label="Manage event" onPress={() => backTo("ManageEvent", event.id)} style={{ flex: 1 }} />
          </View>
        ) : null}
      </View>

      {sheet && event ? (
        <TicketTypeSheet initial={sheet.initial} editing={sheet.editing}
          others={activeTypes(types).filter((x) => x.id !== sheet.editing?.id)}
          timezone={event.timezone} onSave={saveType} onClose={() => setSheet(null)} />
      ) : null}
      <DateTimeSheet target={picker} onClose={() => setPicker(null)}
        onDone={(v) => { if (picker) editForm(picker.field, v); setPicker(null); }} />
      <OptionSheet title="Time zone" selected={form.timezone} onClose={() => setZonePick(false)}
        options={zonePick ? usTimeZones(form.timezone, zone).map((z) => ({ value: z, label: timeZoneLabel(z) })) : null}
        onPick={(v) => { editForm("timezone", v); setZonePick(false); }} />
      <AgreementSheet visible={agreementOpen} agreement={agreement} loadError={agreementError} notice={agreementNotice}
        working={busy} onRetry={loadAgreement} onAgree={agreeAndPublish} onClose={() => setAgreementOpen(false)} />
      {confirmRemove ? (
        <ConfirmBar
          text={`Tickets for ${confirmRemove.name} were already taken, so it will stop selling instead of being deleted. Tickets already taken stay valid. Stop selling ${confirmRemove.name}?`}
          yes={`Stop selling ${confirmRemove.name}`} no="Keep selling"
          onYes={() => removeType(confirmRemove)} onNo={() => setConfirmRemove(null)} />
      ) : null}
    </KeyboardAvoidingView>,
  );

  /* ---------- steps ---------- */

  function renderDetails() {
    const cover = safeHttpUrl(form.coverImageUrl);
    const hostChoices = eventId ? [form.hostAs] : hosts;
    const endDay = form.endDate || autoEndDate(form);
    const notes = [
      form.date && form.startTime ? clockChangeNote(form.date, form.startTime, form.timezone) : null,
      endDay && form.endTime ? clockChangeNote(endDay, form.endTime, form.timezone) : null,
    ].filter((n, i, all): n is string => !!n && all.indexOf(n) === i);
    const today = todayIn(form.timezone);
    const month = monthOf(form.date) ?? monthOf(today)!;
    const toggleMultiDay = () => {
      if (multiDay) { setMultiDay(false); editForm("endDate", ""); return; }
      setMultiDay(true);
      editForm("endDate", autoEndDate(form));
    };
    return (
      <>
        <View style={s.nameRow}>
          <Pressable onPress={pickCover} disabled={uploading} accessibilityRole="button" accessibilityLabel={cover ? "Change cover photo" : "Add a cover photo"}
            style={[s.thumb, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Feather name="plus" size={22} color={theme.textSecondary} />}
            <ThemedText style={[s.thumbText, cover ? { color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.55)" } : { color: theme.textSecondary }]}>
              {uploading ? "Uploading…" : cover ? "Change" : "Cover"}
            </ThemedText>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field label="EVENT NAME" placeholder="Name your event" maxLength={120} value={form.title} onChangeText={(v) => editForm("title", v)} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label>HOSTED AS</Label>
          <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Hosted as">
            {hostChoices.map((h) => <Chip key={h} label={hostAsLabel(h)} on={form.hostAs === h} disabled={!!eventId} onPress={() => editForm("hostAs", h)} />)}
          </View>
          {eventId ? <Hint>Who hosts can't change after the draft is saved.</Hint> : null}
        </View>

        <PickerBox label="DATE" value={dateLabel(form.date)} disabled={startLocked}
          onPress={() => setPicker({ field: "date", mode: "date", title: "Pick a date", value: form.date, min: today, fallbackMonth: month })} />
        <View style={s.twoUp}>
          <PickerBox label="STARTS" value={timeLabel(form.startTime)} disabled={startLocked}
            onPress={() => setPicker({ field: "startTime", mode: "time", title: "Starts", value: form.startTime, fallbackMonth: month })} />
          <PickerBox label="ENDS" value={timeLabel(form.endTime)}
            onPress={() => setPicker({ field: "endTime", mode: "time", title: "Ends", value: form.endTime, fallbackMonth: month })} />
        </View>
        {!multiDay && form.startTime && form.endTime && form.endTime < form.startTime ? <Hint>Ends the next day.</Hint> : null}
        {notes.map((n) => <Hint key={n} warn>{n}</Hint>)}
        <View style={{ alignSelf: "flex-start" }}>
          <TextButton label={multiDay ? "Ends the same day or the next morning" : "Ends on a different day"} gold onPress={toggleMultiDay} />
        </View>
        {multiDay ? (
          <PickerBox label="END DATE" value={dateLabel(form.endDate || endDay)}
            onPress={() => setPicker({ field: "endDate", mode: "date", title: "End date", value: form.endDate || endDay, min: form.date || today, fallbackMonth: month })} />
        ) : null}
        {startLocked ? <Hint>This event has started, so its start time can't change.</Hint> : null}

        <PickerBox label="TIME ZONE" value={timeZoneLabel(form.timezone)} disabled={startLocked} onPress={() => setZonePick(true)} />

        <View style={{ gap: 12 }}>
          <Label>LOCATION</Label>
          <Field label="Venue name" maxLength={200} placeholder="The Hall" value={form.venueName} onChangeText={(v) => editForm("venueName", v)} />
          <Field label="Address" maxLength={200} autoComplete="street-address" textContentType="streetAddressLine1" value={form.addressLine1} onChangeText={(v) => editForm("addressLine1", v)} />
          <Field label="Apartment, suite or floor (optional)" maxLength={200} textContentType="streetAddressLine2" value={form.addressLine2} onChangeText={(v) => editForm("addressLine2", v)} />
          <Field label="City" maxLength={100} textContentType="addressCity" value={form.city} onChangeText={(v) => editForm("city", v)} />
          <View style={s.twoUp}>
            <View style={{ flex: 1 }}><Field label="State" maxLength={100} textContentType="addressState" value={form.state} onChangeText={(v) => editForm("state", v)} /></View>
            <View style={{ flex: 1 }}><Field label="Postal code" maxLength={20} keyboardType="number-pad" textContentType="postalCode" value={form.postalCode} onChangeText={(v) => editForm("postalCode", v)} /></View>
          </View>
          <Box title="Who sees the full address?">
            {VISIBILITY.map((o) => (
              <RadioRow key={o.value} label={o.label} on={form.addressVisibility === o.value} onPress={() => editForm("addressVisibility", o.value)}
                sub={o.value === "ticket_holders_day_of" ? dayOfNote(form.city, form.state) : undefined} />
            ))}
          </Box>
        </View>

        <Field label="ABOUT" multiline maxLength={5000} placeholder="What should guests know? Dress code, parking, age limit."
          value={form.description} onChangeText={(v) => editForm("description", v)} />

        <Switch label="Show in Discover" sub="Off means only people with the link can find it." on={form.listed} onPress={() => editForm("listed", !form.listed)} />
      </>
    );
  }

  function renderTickets(ev: HostEvent) {
    const list = activeTypes(types);
    const isPublished = ev.status !== "draft";
    const noRefundsLocked = isPublished && !refundChangeAllowed({ policy: ev.refundPolicy, cutoffHours: ev.refundCutoffHours }, { policy: "no_refunds", cutoffHours: null });
    const hasPaid = list.some((x) => x.priceCents > 0);
    const st = statuses[ev.hostType];
    // Paid tickets sell only once Stripe is live for this host (free publishing only needs setup).
    const needsPayout = hasPaid && (paidOk === false || st === "setup" || st === "finish");
    return (
      <>
        {needsPayout ? (
          <View style={[s.banner, { borderColor: GOLD }]} accessibilityLiveRegion="polite">
            <Feather name="credit-card" size={20} color={theme.brandGold} />
            <View style={{ flex: 1, gap: 8 }}>
              <ThemedText style={{ fontSize: 14, lineHeight: 20 }}>
                {st === "setup"
                  ? "To sell paid tickets, add where we send your earnings. You get paid 3 days after the event."
                  : "To sell paid tickets, finish your payout setup with Stripe. You get paid 3 days after the event."}
              </ThemedText>
              <View style={{ alignSelf: "flex-start" }}>
                <TextButton label={st === "setup" ? "Set up payouts" : "Finish payout setup"} gold onPress={() => payoutsFromTickets(ev)} />
              </View>
            </View>
          </View>
        ) : null}

        {list.map((x) => {
          const l = ticketRowLines(x, list, ev.timezone);
          return (
            <View key={x.id} style={[s.type, { borderColor: theme.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText style={hostStyles.strong}>{x.name}</ThemedText>
                <Hint>{l.qty}</Hint>
                <ThemedText style={{ fontSize: 13, color: theme.brandGold }}>{l.when}</ThemedText>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <ThemedText style={hostStyles.strong}>{l.price}</ThemedText>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <TextButton label="Edit" a11yLabel={`Edit ${x.name}`} onPress={() => setSheet({ initial: sheetFromType(x, ev.timezone), editing: x })} />
                  <TextButton label={removingId === x.id ? "Removing…" : "Remove"} a11yLabel={`Remove ${x.name}`} disabled={removingId === x.id} onPress={() => askRemove(x)} />
                </View>
              </View>
            </View>
          );
        })}

        <Pressable onPress={() => setSheet({ initial: emptySheet(false), editing: null })} accessibilityRole="button"
          style={[s.dashed, { borderColor: theme.border }]}>
          <Feather name="plus" size={18} color={theme.text} />
          <ThemedText style={hostStyles.strong}>Add a ticket type</ThemedText>
        </Pressable>

        <Field label="EVENT CAPACITY (OPTIONAL)" keyboardType="number-pad" placeholder="No limit" value={form.capacity} onChangeText={(v) => editForm("capacity", v)} />

        <Box title="Refunds">
          <RadioRow on={form.refundPolicy === "until_cutoff"} onPress={() => editForm("refundPolicy", "until_cutoff")} label="Refunds until the hours you set before the event">
            <View style={s.inline}>
              <ThemedText style={{ fontSize: 15 }}>Until</ThemedText>
              <Field label="" accessibilityLabel="Hours before the event" keyboardType="number-pad" value={form.refundCutoffHours}
                style={{ width: 64, minHeight: 40, textAlign: "center" }}
                onChangeText={(v) => setForm((f) => ({ ...f, refundPolicy: "until_cutoff", refundCutoffHours: v }))} />
              <ThemedText style={{ fontSize: 15 }}>hours before</ThemedText>
            </View>
          </RadioRow>
          <RadioRow label="No refunds" on={form.refundPolicy === "no_refunds"} disabled={noRefundsLocked} onPress={() => editForm("refundPolicy", "no_refunds")} />
          <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}><Hint>After you publish, you can make this more flexible but not stricter.</Hint></View>
        </Box>
      </>
    );
  }

  function renderReview(ev: HostEvent) {
    const times = eventTimes(form);
    const rows: { label: string; value: string; to: "details" | "tickets" }[] = [
      { label: "Hosted as", value: hostAsLabel(ev.hostType), to: "details" },
      { label: "When", value: times ? whenRange(times.startsAt, times.endsAt, form.timezone) : "Not set", to: "details" },
      { label: "Address", value: addressLabel(form.addressVisibility), to: "details" },
      { label: "Discover", value: form.listed ? "Shown in Discover" : "Only people with the link", to: "details" },
      { label: "Tickets", value: ticketsSummary(types), to: "tickets" },
      { label: "Capacity", value: form.capacity.trim() ? `${form.capacity.trim()} people` : "No limit", to: "tickets" },
      { label: "Refunds", value: refundLabel(form.refundPolicy, form.refundPolicy === "until_cutoff" ? Number(form.refundCutoffHours) : null), to: "tickets" },
    ];
    return (
      <>
        <Label>HOW IT LOOKS IN DISCOVER</Label>
        {times ? <PreviewCard form={form} types={types} startsAt={times.startsAt} /> : null}
        <View style={[s.rows, { borderColor: theme.border }]}>
          {rows.map((r, i) => (
            <View key={r.label} style={[s.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Hint>{r.label}</Hint>
                <ThemedText style={hostStyles.strong}>{r.value}</ThemedText>
              </View>
              <TextButton label="Edit" gold a11yLabel={`Edit ${r.label.toLowerCase()}`} onPress={() => go(r.to)} />
            </View>
          ))}
        </View>
        {agreement?.accepted && agreement.acceptedAt ? (
          <Hint>You accepted the Event Host Agreement on {fmt(agreement.acceptedAt, zone, { month: "long", day: "numeric", year: "numeric" })}.</Hint>
        ) : null}
      </>
    );
  }
}

function ConfirmBar({ text, yes, no, onYes, onNo }: { text: string; yes: string; no: string; onYes: () => void; onNo: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.confirm, { backgroundColor: theme.backgroundRoot, borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal>
      <ThemedText style={hostStyles.body}>{text}</ThemedText>
      <PrimaryButton label={yes} onPress={onYes} />
      <TextButton label={no} onPress={onNo} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 32 },
  foot: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "stretch" },
  gateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  coverTile: { height: 220, borderWidth: 1, borderStyle: "dashed", borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden", gap: 10 },
  coverLabel: { alignItems: "center", gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  draft: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  draftThumb: { width: 52, height: 52, borderRadius: 10, overflow: "hidden" },
  liveCheck: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8 },
  share: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  twoUp: { flexDirection: "row", gap: 12 },
  nameRow: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  thumb: { width: 76, height: 76, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbText: { position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", fontSize: 11, fontWeight: "700", paddingVertical: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  banner: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  type: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  dashed: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 14, minHeight: 52 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  rows: { borderWidth: 1, borderRadius: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  confirm: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
});

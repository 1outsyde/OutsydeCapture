/**
 * Door helpers for the app (p4-scanner, Events canvas 14, 15, 37 to 41): door team invites, the invite screen, the
 * events I can scan, and the scanner (codes, duplicate scans, result cards, guest list). No React, no network.
 * Ported from goutsyde.com app/events/_host/doorLogic.ts and app/events/[id]/scan/scanLogic.ts. Shapes follow
 * outsyde-backend server/events/doorRouter.ts (migration 075). The app calls the backend directly, so error bodies
 * are the backend's own { success:false, error:{ code, message }, ticket?, otherEvent? }.
 * Unit tests: utils/host/doorLogic.test.ts.
 */
import { GENERIC_ERROR, fmt } from "@/utils/eventsLogic";
import { guestHandle, guestName, type DoorGuest } from "./manageLogic";

/* ---------- time and the scan window ---------- */

/** "9:42 PM" in the event's own time zone. */
export function timeOnly(iso: string, tz: string): string {
  return fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
}

const day = (iso: string, tz: string) => fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });

/** Same rule as backend doorAccess.isWithinScanWindow: opens 6 hours before the start, closes at the end. */
export const SCAN_OPENS_BEFORE_START_MS = 6 * 60 * 60 * 1000;

export function scanWindowNote(e: { startsAt: string; endsAt: string; timezone: string; status?: string }, now: Date = new Date()): string | null {
  if (e.status !== undefined && e.status !== "published") return "Check in is closed for this event.";
  const opens = new Date(e.startsAt).getTime() - SCAN_OPENS_BEFORE_START_MS;
  const t = now.getTime();
  if (t < opens) {
    const iso = new Date(opens).toISOString();
    return `Check in opens ${day(iso, e.timezone)} at ${timeOnly(iso, e.timezone)}, 6 hours before the start.`;
  }
  if (t > new Date(e.endsAt).getTime()) return "Check in has closed for this event.";
  return null;
}

/* ---------- events I can scan (GET /door/mine) ---------- */

export type DoorRole = "host" | "standing" | "event";
/** inviteId (additive): the accepted invite behind a member's row, null for the host's own events. */
export interface DoorEvent { id: string; slug: string; title: string; startsAt: string; endsAt: string; timezone: string; role: DoorRole; inviteId?: string | null }

/** A member (not the host) can open their invite from Door check in to Leave the team. */
export function canLeave(e: DoorEvent): boolean {
  return e.role !== "host" && typeof e.inviteId === "string" && e.inviteId.length > 0;
}

/**
 * One request at a time: enter() is true only when nothing is running, and must be called before any await (React
 * state updates a render too late, so two fast taps or two QR frames would both get through).
 */
export function makeGate() {
  let on = false;
  return {
    enter(): boolean { if (on) return false; on = true; return true; },
    leave(): void { on = false; },
    busy(): boolean { return on; },
  };
}

export function isDoorEvent(x: unknown): x is DoorEvent {
  const e = x as DoorEvent | null;
  return !!e && typeof e.id === "string" && typeof e.title === "string" && typeof e.startsAt === "string"
    && typeof e.endsAt === "string" && typeof e.timezone === "string" && ["host", "standing", "event"].includes(e.role);
}

export function roleLabel(role: DoorRole): string {
  if (role === "host") return "Your event";
  if (role === "standing") return "Door team";
  return "Door team, this event";
}

/* ---------- the host's door team (canvas 38) ---------- */

export type Scope = "standing" | "event";
export type MemberStatus = "invited" | "accepted" | "declined";

export interface TeamMember {
  userId: string; firstName: string | null; username: string | null; addedAt: string | null;
  status?: MemberStatus; inviteId?: string; invitedAt?: string | null;
}

export function isTeamMember(x: unknown): x is TeamMember {
  const m = x as TeamMember | null;
  return !!m && typeof m.userId === "string";
}

export function memberStatus(m: TeamMember): MemberStatus {
  return m.status === "invited" || m.status === "declined" ? m.status : "accepted";
}

export function memberStatusLine(m: TeamMember, scope: Scope): string {
  const st = memberStatus(m);
  const text = st === "invited" ? "Invited, waiting for them to accept"
    : st === "declined" ? "Said no. You can invite them again."
    : scope === "event" ? "On the team until the event ends" : "On the team";
  return [m.firstName?.trim() ? guestHandle(m) : "", text].filter(Boolean).join(" · ");
}

export function memberAction(m: TeamMember): "Remove" | "Cancel invite" | "Invite again" {
  const st = memberStatus(m);
  return st === "invited" ? "Cancel invite" : st === "declined" ? "Invite again" : "Remove";
}

export function cancelInviteCopy(m: TeamMember): string {
  return `Cancel ${guestName(m)}'s invite? They won't be able to accept it.`;
}

export function removeConfirmCopy(m: TeamMember, scope: Scope): string {
  const who = guestName(m);
  return scope === "standing"
    ? `Remove ${who} from your door team? They stop being able to scan all your events.`
    : `Remove ${who} from this event's door team? They stop being able to scan this event.`;
}

export function inviteSentCopy(m: TeamMember): string {
  return `Invite sent. ${guestName(m)} can scan once they accept.`;
}

/** "@marcus" typed or pasted: trimmed, one leading @ removed. Usernames are at most 40 characters. */
export function cleanUsername(input: string): string {
  return input.trim().replace(/^@/, "").trim();
}
export const USERNAME_MAX = 40;

/** The manage screen's button (canvas 37). The count is everyone on the list, invites included. */
export function teamCountLabel(n: number): string {
  return n > 0 ? `Door team (${n})` : "Door team";
}

/* ---------- my invites (GET /door/invites, canvas 39 and 40) ---------- */

export type InviteStatus = "invited" | "accepted" | "declined" | "gone";

export interface DoorInvite {
  id: string; scope: Scope; role: string; status: InviteStatus; invitedAt: string | null;
  host: { name: string };
  event: { id: string; title: string; startsAt: string; endsAt: string; timezone: string } | null;
  upcoming: { id: string; title: string; startsAt: string; timezone: string }[];
}

export function isDoorInvite(x: unknown): x is DoorInvite {
  const i = x as DoorInvite | null;
  return !!i && typeof i.id === "string" && (i.scope === "standing" || i.scope === "event")
    && ["invited", "accepted", "declined", "gone"].includes(i.status)
    && !!i.host && typeof i.host.name === "string" && Array.isArray(i.upcoming)
    && (i.event === null || (typeof i.event?.title === "string" && typeof i.event.startsAt === "string" && typeof i.event.timezone === "string"));
}

export interface InviteScreenCopy {
  state: InviteStatus; headline: string; body: string; scopeLabel: string;
  events: { id: string; title: string; when: string }[];
}

/** Everything the invite screen shows for one state. */
export function inviteScreenCopy(i: DoorInvite): InviteScreenCopy {
  const host = i.host.name;
  const one = i.scope === "event" && i.event;
  const events = one
    ? [{ id: i.event!.id, title: i.event!.title, when: day(i.event!.startsAt, i.event!.timezone) }]
    : i.upcoming.map((e) => ({ id: e.id, title: e.title, when: day(e.startsAt, e.timezone) }));
  const scopeLabel = one ? "ONLY THIS EVENT" : `ALL OF ${host.toUpperCase()}'S EVENTS`;
  if (i.status === "gone") {
    return { state: "gone", headline: "This invite is no longer open", body: "The host cancelled it, or the event is over.", scopeLabel: "NO LONGER AVAILABLE", events: [] };
  }
  if (i.status === "declined") {
    return { state: "declined", headline: "Invite declined", body: `${host} can see you said no. They can invite you again later.`, scopeLabel, events };
  }
  if (i.status === "accepted") {
    return {
      state: "accepted", headline: "You're on the door team", scopeLabel, events,
      body: one
        ? `You can scan tickets for ${i.event!.title}. The scanner opens 6 hours before it starts.`
        : `You can scan tickets for ${host}'s events. The scanner opens 6 hours before each event starts.`,
    };
  }
  return {
    state: "invited", headline: `${host} invited you to their door team`, scopeLabel, events,
    body: one
      ? "Scan tickets at the door for this event. You can leave the team any time."
      : "Scan tickets at the door for all of their events. You can leave the team any time.",
  };
}

/** A door team invite in Activity (backend type door_team_invite) opens that invite. */
export function doorNoticeTarget(n: { type: string; referenceId?: string | null; metadata?: Record<string, unknown> | null }): { inviteId: string } | null {
  if (n.type !== "door_team_invite") return null;
  const id = typeof n.metadata?.inviteId === "string" ? n.metadata.inviteId : n.referenceId;
  return typeof id === "string" && id.length > 0 ? { inviteId: id } : null;
}

/* ---------- scanner ---------- */

export const CODE_RE = /^[A-Z0-9]{16}$/;
export const CODE_LENGTH = 16;

/** QR text to a ticket code: trimmed and uppercased. Anything that isn't exactly a 16 character code is null. */
export function qrToCode(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const code = text.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** What the Type a code box keeps while typing: uppercase letters and digits only, at most 16. */
export function cleanTyped(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export const DUPLICATE_WINDOW_MS = 3000;

/** `allow(key, now)` is true (and records it) unless the same key was allowed less than windowMs ago. */
export function makeRecent(windowMs: number = DUPLICATE_WINDOW_MS) {
  const seen = new Map<string, number>();
  return {
    allow(key: string, now: number): boolean {
      for (const [k, at] of seen) if (now - at >= windowMs) seen.delete(k);
      const at = seen.get(key);
      if (at !== undefined && now - at < windowMs) return false;
      seen.set(key, now);
      return true;
    },
  };
}

export type Tone = "ok" | "warn" | "bad";
export interface ScanResult { outcome: string; tone: Tone; title: string; who: string; detail: string; ticket: DoorGuest | null }
export const TONE_BG: Record<Tone, string> = { ok: "#1E6B45", warn: "#8A5B00", bad: "#8C2B2B" };
export const LAST_SCAN_COLOR: Record<Tone, string> = { ok: "#6FD39B", warn: "#F0B54A", bad: "#FF8A7A" };

function isGuest(x: unknown): x is DoorGuest {
  const g = x as DoorGuest | null;
  return !!g && typeof g.ticketId === "string" && typeof g.ticketTypeName === "string";
}
const whoLine = (g: DoorGuest) => `${guestName(g)} · ${g.ticketTypeName}`;

export function invalidCodeResult(): ScanResult {
  return { outcome: "INVALID_CODE", tone: "bad", title: "Invalid code", who: "", detail: "That isn't a valid ticket code. Try again or type the code.", ticket: null };
}

export function undoneResult(t: DoorGuest): ScanResult {
  return { outcome: "UNDONE", tone: "warn", title: "Check in undone", who: whoLine(t), detail: "This guest is not checked in anymore.", ticket: t };
}

/** The result card for a check in answer. status 0 = the network failed. body = the backend's JSON. */
export function resultFor(status: number, body: any, tz: string): ScanResult { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (status === 0) return { outcome: "NETWORK", tone: "warn", title: "No connection", who: "", detail: "Couldn't reach Outsyde. Check your connection and scan again.", ticket: null };
  if (status === 200 && body?.success && isGuest(body.ticket)) {
    return { outcome: "CHECKED_IN", tone: "ok", title: "Checked in", who: whoLine(body.ticket), detail: "Let them in.", ticket: body.ticket };
  }
  const code = typeof body?.error?.code === "string" ? body.error.code : "";
  const msg = (fallback: string) => (typeof body?.error?.message === "string" && body.error.message.trim() ? body.error.message : fallback);
  switch (code) {
    case "ALREADY_CHECKED_IN": {
      const t = isGuest(body.ticket) ? body.ticket : null;
      const detail = t?.checkedInAt
        ? `This ticket was scanned at ${timeOnly(t.checkedInAt, tz)}${t.checkedInBy ? ` by ${t.checkedInBy}` : ""}.`
        : "This ticket was already scanned.";
      return { outcome: code, tone: "warn", title: "Already checked in", who: t ? whoLine(t) : "", detail, ticket: t };
    }
    case "WRONG_EVENT": {
      const other = typeof body?.otherEvent?.title === "string" ? body.otherEvent.title : null;
      return { outcome: code, tone: "bad", title: "Not for this event", who: other ? `Ticket for ${other}` : msg("This ticket is for another event."), detail: "Ask the guest to open the right ticket in My Tickets.", ticket: null };
    }
    case "NOT_PAID":
      return { outcome: code, tone: "bad", title: "Not paid", who: "", detail: `${msg("This ticket isn't paid for yet.")} Do not let it in.`, ticket: null };
    case "NOT_VALID":
      return { outcome: code, tone: "bad", title: "Not valid", who: "", detail: `${msg("This ticket is not valid. It was refunded or cancelled.")} Do not let it in.`, ticket: null };
    case "NOT_FOUND":
      return { outcome: code, tone: "bad", title: "Not found", who: "", detail: msg("No ticket found for that code."), ticket: null };
    case "CHECKIN_CLOSED":
      return { outcome: code, tone: "warn", title: "Check in closed", who: "", detail: msg("Check in isn't open for this event right now."), ticket: null };
    case "INVALID_CODE":
      return { ...invalidCodeResult(), detail: msg("That isn't a valid ticket code.") };
    case "RATE_LIMITED":
      return { outcome: code, tone: "warn", title: "Slow down", who: "", detail: msg("Too many scans. Wait a moment and try again."), ticket: null };
    case "EVENT_NOT_FOUND":
      return { outcome: code, tone: "bad", title: "No access", who: "", detail: "You can't scan for this event anymore. Ask the host to invite you again.", ticket: null };
    default:
      return { outcome: "ERROR", tone: "bad", title: "Couldn't check in", who: "", detail: status >= 500 ? GENERIC_ERROR : msg(GENERIC_ERROR), ticket: null };
  }
}

export function lastScanLabel(r: ScanResult): string {
  if (r.outcome === "CHECKED_IN") return "In";
  if (r.outcome === "UNDONE") return "Undone";
  if (r.outcome === "ALREADY_CHECKED_IN") return "Already in";
  return r.title;
}

/** Search by first name, @username or ticket type. A leading @ is ignored. */
export function filterGuests(guests: DoorGuest[], query: string): DoorGuest[] {
  const q = query.trim().replace(/^@/, "").toLowerCase();
  if (!q) return guests;
  return guests.filter((g) => [g.firstName, g.username, g.ticketTypeName].some((v) => typeof v === "string" && v.toLowerCase().includes(q)));
}

export function replaceGuest(guests: DoorGuest[], t: DoorGuest): DoorGuest[] {
  return guests.map((g) => (g.ticketId === t.ticketId ? t : g));
}

export function progressPct(checkedIn: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, Math.round((checkedIn / total) * 100))) : 0;
}

/**
 * The member side of the Event team in the app (p4-team step 9c-1): the Event team screen (mockup D), an invite for
 * any role (E), my page for one event (C), co-hosting in Your events and who can scan (calls 59, 62, 63, 65, 74, 75).
 * Same rules as goutsyde.com app/events/door/DoorClient.tsx, app/events/[id]/my-team/MyTeamClient.tsx,
 * app/events/_host/MineClient.tsx and the backend doorRouter.ts (myTeamEvents, loadEventForDoor, /team/me), which
 * refuses anything else anyway. Pure, no React, no network. Copy rule: no dashes, never the service fee percentage.
 * Unit tests: utils/host/memberLogic.test.ts.
 */
import { fmt } from "@/utils/eventsLogic";
import { isHostEvent, type HostEvent } from "./editorLogic";
import { isDoorInvite, type DoorInvite } from "./doorLogic";
import {
  earningLines,
  isRolePay,
  isStayRequest,
  isTeamPayout,
  payLine,
  roleName,
  teamInviteHeadline,
  type RolePay,
  type Schedule,
  type StayRequest,
  type TeamEvent,
  type TeamPayout,
} from "./teamLogic";

/** Call 75: the Account menu item (was "Door check in"). The screen keeps its route name DoorEvents (call 59). */
export const MENU_ITEM = { label: "Event team", subtitle: "Invites, events you work and your pay" } as const;

/* ---------- invites (GET /door/invites?roles=all, /door/invites/:id?roles=all) ---------- */

export type TeamInvite = DoorInvite & {
  roleLabel: string | null;
  cohostLevel: "team" | "edit" | null;
  pay: unknown;
};

export function isTeamInvite(x: unknown): x is TeamInvite {
  return isDoorInvite(x) && typeof (x as DoorInvite).role === "string";
}

/** What each role gets, in the member's words (backend roleInfo descriptions are written for the host). */
function roleWhat(i: Pick<TeamInvite, "role" | "cohostLevel">): string {
  switch (i.role) {
    case "door": return "Scan tickets at the door and see the guest list.";
    case "host": return "Get your own link and see the tickets sold through it.";
    case "entertainment": return "See your set time, load in and the host's notes.";
    case "cohost":
      return `See everything the host sees for the event, including sales, the guest list and the team.${i.cohostLevel === "edit" ? " You can also edit the event." : ""}`;
    default: return "See your call time, where to go and the host's notes.";
  }
}

const day = (iso: string, tz: string) => fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });

export interface MemberInviteCopy {
  state: DoorInvite["status"];
  headline: string;
  body: string;
  scopeLabel: string;
  events: { id: string; title: string; when: string }[];
  pay: string | null;
  privacy: string | null;
}

/** Everything the invite screen shows (mockup E). `justLeft`: the member left here (the backend then says gone). */
export function memberInviteCopy(i: TeamInvite, justLeft = false): MemberInviteCopy {
  const host = i.host.name;
  const one = i.scope === "event" && !!i.event;
  const events = one
    ? [{ id: i.event!.id, title: i.event!.title, when: day(i.event!.startsAt, i.event!.timezone) }]
    : i.upcoming.map((e) => ({ id: e.id, title: e.title, when: day(e.startsAt, e.timezone) }));
  const scopeLabel = one ? "ONLY THIS EVENT" : `ALL OF ${host.toUpperCase()}'S EVENTS`;
  const pay = isRolePay(i.pay) && (i.pay.payType !== "none" || !!i.pay.commissionPercent) ? payLine(i.pay as RolePay) : null;
  const privacy = i.role === "cohost" ? null : "You won't see sales, earnings or anyone's contact details.";
  const base = { scopeLabel, events, pay, privacy };
  if (i.status === "gone") {
    return justLeft
      ? { ...base, state: "gone", headline: "You left the Event team", body: `${host} can invite you again.`, scopeLabel: "NO LONGER AVAILABLE", events: [], pay: null }
      : { ...base, state: "gone", headline: "This invite is no longer open", body: "The host cancelled it, or the event is over.", scopeLabel: "NO LONGER AVAILABLE", events: [], pay: null };
  }
  if (i.status === "declined") {
    return { ...base, state: "declined", headline: "Invite declined", body: `${host} can see you said no. They can invite you again later.` };
  }
  if (i.status === "accepted") {
    const body = i.role === "door"
      ? one
        ? `You can scan tickets for ${i.event!.title}. The scanner opens 6 hours before it starts.`
        : `You can scan tickets for ${host}'s events. The scanner opens 6 hours before each event starts.`
      : one
        ? "Your times, notes and pay are on your event page."
        : `${host}'s events show up in Event team.`;
    return { ...base, state: "accepted", headline: `You're on the Event team as ${roleName(i.role, i.roleLabel)}`, body };
  }
  return { ...base, state: "invited", headline: teamInviteHeadline(i), body: `${roleWhat(i)} You can leave any time.` };
}

/** Where the accepted invite's main button goes: the scanner (Admissions, one event), my page, or the Event team list. */
export function inviteAfter(i: TeamInvite): { to: "scanner"; eventId: string } | { to: "myTeam"; eventId: string } | { to: "list" } {
  if (i.scope !== "event" || !i.event) return { to: "list" };
  return i.role === "door" ? { to: "scanner", eventId: i.event.id } : { to: "myTeam", eventId: i.event.id };
}

/* ---------- Event team list (GET /door/mine?roles=all) ---------- */

export function splitTeamEvents(list: TeamEvent[]): { upcoming: TeamEvent[]; past: TeamEvent[] } {
  return { upcoming: list.filter((e) => !e.ended), past: list.filter((e) => e.ended) };
}

const cohostOn = (e: TeamEvent) => e.role !== "host" && e.team.some((t) => t.role === "cohost");

/** Web DoorClient row buttons: Open (my page), Scan (Admissions, co-hosts, the host; not after the end), Manage. */
export function rowActions(e: TeamEvent): { open: boolean; scan: boolean; manage: boolean } {
  return {
    open: e.role !== "host" && e.team.length > 0,
    scan: e.canScan && !e.ended,
    manage: e.role === "host" || cohostOn(e),
  };
}

/* ---------- scanner (call 74) ---------- */

export type ScanAs = "host" | "cohost" | "member";

/** Who may scan this event, from GET /door/mine?roles=all (canScan = host, Admissions or co-host). */
export function scanAccess(
  list: TeamEvent[],
  eventId: string,
): { as: ScanAs; title: string; startsAt: string; endsAt: string; timezone: string } | null {
  const e = list.find((x) => x.id === eventId);
  if (!e || !e.canScan) return null;
  const as: ScanAs = e.role === "host" ? "host" : cohostOn(e) ? "cohost" : "member";
  return { as, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timezone: e.timezone };
}

/** Undo a check in: the host or a co-host (backend doorUser hostRequired), never a door member. */
export const canUndo = (as: ScanAs) => as === "host" || as === "cohost";

/* ---------- my page for one event (GET /:id/team/me, mockup C) ---------- */

export interface MyRole {
  role: string;
  roleLabel: string | null;
  scope: "standing" | "event";
  schedule: Schedule | null;
  pay: RolePay | null;
}

export interface MyTeam {
  event: { id: string; slug: string; title: string; startsAt: string; endsAt: string; timezone: string };
  host: { name: string };
  roles: MyRole[];
  promoter: { code: string; url: string; rsvps: number; ticketsSold: number; salesCents: number } | null;
  payTotalCents: number | null;
  payout: TeamPayout | null;
  payoutSetup: { needed: boolean; deadline: string | null } | null;
  fromHost: { id: string; at: string; text: string; from: { name?: string } }[];
  stayLonger: StayRequest[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The /team/me body, checked field by field the way the website reads it. Null when it isn't one. */
export function parseMyTeam(b: any): MyTeam | null {
  const e = b?.event;
  if (!b || !e || typeof e.id !== "string" || typeof e.title !== "string" || typeof e.startsAt !== "string"
    || typeof e.endsAt !== "string" || typeof e.timezone !== "string") return null;
  const roles: MyRole[] = Array.isArray(b.roles)
    ? b.roles.filter((r: any) => r && typeof r.role === "string").map((r: any) => ({
      role: r.role, roleLabel: typeof r.roleLabel === "string" ? r.roleLabel : null, scope: r.scope === "standing" ? "standing" : "event",
      schedule: r.schedule && typeof r.schedule === "object" ? r.schedule : null, pay: isRolePay(r.pay) ? r.pay : null,
    }))
    : [];
  const p = b.promoter;
  return {
    event: { id: e.id, slug: typeof e.slug === "string" ? e.slug : "", title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timezone: e.timezone },
    host: { name: typeof b.host?.name === "string" ? b.host.name : "The host" },
    roles,
    promoter: p && typeof p.url === "string" && typeof p.ticketsSold === "number"
      ? { code: String(p.code ?? ""), url: p.url, rsvps: Number(p.rsvps) || 0, ticketsSold: p.ticketsSold, salesCents: Number(p.salesCents) || 0 }
      : null,
    payTotalCents: typeof b.payTotalCents === "number" ? b.payTotalCents : null,
    payout: isTeamPayout(b.payout) ? b.payout : null,
    payoutSetup: b.payoutSetup && typeof b.payoutSetup.needed === "boolean"
      ? { needed: b.payoutSetup.needed, deadline: typeof b.payoutSetup.deadline === "string" ? b.payoutSetup.deadline : null }
      : null,
    fromHost: Array.isArray(b.fromHost)
      ? b.fromHost.filter((m: any) => m && typeof m.id === "string" && typeof m.text === "string" && typeof m.at === "string")
      : [],
    stayLonger: Array.isArray(b.stayLonger) ? b.stayLonger.filter(isStayRequest) : [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Requests still open and not past their answer time (the backend refuses a late answer anyway). */
export const openStayRequests = (me: MyTeam, now: number) =>
  me.stayLonger.filter((r) => r.status === "open" && new Date(r.expiresAt).getTime() >= now);

/** "You'll get" lines; with more than one role each line says which role it is for. */
export function myPayLines(me: MyTeam): { label: string; value: string }[] {
  return me.roles.flatMap((r) =>
    r.pay
      ? earningLines(r.pay).map((l) => ({ ...l, label: me.roles.length > 1 ? `${roleName(r.role, r.roleLabel)}: ${l.label}` : l.label }))
      : [],
  );
}

/** Call 62: the payout setup nudge, with the deadline in the event's zone. Null when nothing is needed. */
export function setupNeededLine(me: MyTeam): string | null {
  const s = me.payoutSetup;
  if (!s?.needed) return null;
  return s.deadline
    ? `Set up payouts by ${fmt(s.deadline, me.event.timezone, { weekday: "short", month: "short", day: "numeric" })} to get paid.`
    : "Set up payouts to get paid.";
}

/** My spots at this event (from /door/mine?roles=all), each with its own Leave. None once the event ended (team locked). */
export function leaveSpots(list: TeamEvent[], eventId: string, ended: boolean): TeamEvent["team"] {
  if (ended) return [];
  return list.find((e) => e.id === eventId)?.team ?? [];
}

/* ---------- co-hosting in Your events (GET /api/events/cohosting, call 63) ---------- */

export function cohostingEvents(body: { events?: unknown } | null | undefined): HostEvent[] {
  return Array.isArray(body?.events) ? (body!.events as unknown[]).filter(isHostEvent) : [];
}

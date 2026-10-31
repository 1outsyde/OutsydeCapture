/**
 * p4-team step 9 (app): ported from goutsyde.com app/events/_host/teamLogic.ts (step 8) so the app shows exactly what
 * the website shows. Keep the two in sync. Originally: helpers for the Event team pages (host team page, the Event team
 * page the invite email opens, a member's own event page). No React, no network. Shapes follow outsyde-backend
 * server/events/doorRouter.ts, teamPay.ts (rolePayJson), teamExtensions.ts, teamMessages.ts and teamSend.ts.
 * Copy rule: no dashes. Unit tests: utils/host/teamLogic.test.ts (port of goutsyde.com tests/events-team-logic.test.ts).
 */

import { fmt, money } from "@/utils/eventsLogic";
import { isoInZone, parsePriceCents } from "./editorLogic";
import { guestName } from "./manageLogic";

/* ---------- roles ---------- */

/** Stored role names (backend TEAM_ROLES). `door` is shown as Admissions and `host` as Promoter. */
export const TEAM_ROLES = [
  "door",
  "security",
  "host",
  "entertainment",
  "media",
  "cohost",
  "other",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
export const isTeamRole = (x: unknown): x is TeamRole =>
  typeof x === "string" && (TEAM_ROLES as readonly string[]).includes(x);

const NAMES: Record<TeamRole, string> = {
  door: "Admissions",
  security: "Security",
  host: "Promoter",
  entertainment: "Entertainment",
  media: "Media",
  cohost: "Co-host",
  other: "Other",
};

/** "Admissions", "Promoter", or the host's own name for an Other role ("Coat check"). */
export function roleName(role: string, label?: string | null): string {
  if (role === "other" && label && label.trim()) return label.trim();
  return isTeamRole(role) ? NAMES[role] : "Event team";
}

/** Order of the sections on the host's page (screen 48). */
export const SECTION_ORDER: readonly TeamRole[] = [
  "cohost",
  "door",
  "security",
  "host",
  "entertainment",
  "media",
  "other",
];

/** Same rule as backend parseRoleLabel: up to 40 letters, numbers, spaces and & ' . , / ( ). */
export const ROLE_LABEL_MAX = 40;
export function roleLabelError(raw: string): string | null {
  const label = raw.trim().replace(/\s+/g, " ");
  if (!label) return "Type a name for this role.";
  if (label.length > ROLE_LABEL_MAX)
    return `Up to ${ROLE_LABEL_MAX} characters.`;
  if (!/^[\p{L}\p{N} &'.,/()]+$/u.test(label))
    return "Letters, numbers, spaces and & ' . , / ( ) only.";
  return null;
}

/** Roles a host can ask to stay longer (backend STAY_LONGER_ROLES, call 41). */
export const STAY_LONGER_ROLES: readonly TeamRole[] = [
  "door",
  "security",
  "entertainment",
  "media",
  "other",
];

/* ---------- pay (rolePayJson) ---------- */

export interface ExtraLine {
  id: string;
  minutes: number;
  payKind: "fixed" | "none" | "tbd" | "hourly";
  cents: number | null;
  tbd: boolean;
}
export interface RolePay {
  payType: "none" | "fixed" | "hourly";
  fixedCents: number | null;
  hourlyRateCents: number | null;
  hours: number | null;
  hourlyCents: number | null;
  commissionPercent: number | null;
  commissionCents: number | null;
  earnedCents: number;
  needsShift: boolean;
  hourlyCapped?: boolean;
  extraCents?: number;
  extras?: ExtraLine[];
  extraCapped?: boolean;
}

export function isRolePay(x: unknown): x is RolePay {
  const p = x as RolePay | null;
  return (
    !!p &&
    ["none", "fixed", "hourly"].includes(p.payType) &&
    typeof p.earnedCents === "number"
  );
}

/** "$160" or "$12.50": whole dollars without cents. */
export function dollars(cents: number): string {
  return cents % 100 === 0
    ? `$${(cents / 100).toLocaleString("en-US")}`
    : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** One line for a row: "Fixed $160", "$50 an hour, set their shift", "10% of link sales", "No pay". */
export function payLine(p: RolePay | null | undefined): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.payType === "fixed" && p.fixedCents)
    parts.push(`Fixed ${dollars(p.fixedCents)}`);
  if (p.payType === "hourly" && p.hourlyRateCents)
    parts.push(
      `${dollars(p.hourlyRateCents)} an hour${p.needsShift ? ", set their shift" : ""}`,
    );
  if (p.commissionPercent) parts.push(`${p.commissionPercent}% of link sales`);
  if (p.extraCents) parts.push(`${dollars(p.extraCents)} for staying longer`);
  return parts.length ? parts.join(" · ") : "No pay";
}

/** Screen 51: "You'll get" lines. Each line's amount is exactly what's paid; nothing is worked out here. */
export function earningLines(p: RolePay): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (p.payType === "fixed" && p.fixedCents)
    out.push({ label: "Fixed", value: dollars(p.fixedCents) });
  if (p.payType === "hourly") {
    out.push(
      p.needsShift || p.hours === null
        ? {
            label: `${dollars(p.hourlyRateCents ?? 0)} an hour`,
            value: "Once your shift is set",
          }
        : {
            label: `${p.hours} ${p.hours === 1 ? "hour" : "hours"} at ${dollars(p.hourlyRateCents ?? 0)}${p.hourlyCapped ? ", up to $10,000" : ""}`,
            value: dollars(p.hourlyCents ?? 0),
          },
    );
  }
  if (p.commissionPercent)
    out.push({
      label: `${p.commissionPercent}% of your link sales`,
      value: dollars(p.commissionCents ?? 0),
    });
  // Over the role's $10,000 the backend cuts the extras (extraCapped): one line with what's actually paid.
  if (p.extraCapped) {
    out.push({
      label: "Staying longer, up to the $10,000 for this role",
      value: dollars(p.extraCents ?? 0),
    });
    return out;
  }
  for (const x of p.extras ?? []) {
    if (x.payKind === "none") continue;
    out.push({
      label: `Stayed ${durationText(x.minutes)}`,
      value:
        x.tbd && x.cents === null ? "To be discussed" : dollars(x.cents ?? 0),
    });
  }
  return out;
}

/* ---------- pay form (PUT /door/team/:userId/pay) ---------- */

export interface PayForm {
  payType: "none" | "fixed" | "hourly";
  fixed: string;
  hourly: string;
  commission: string;
}

export function payFormFrom(p: RolePay | null | undefined): PayForm {
  const amount = (c: number | null | undefined) =>
    c ? (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)) : "";
  return {
    payType: p?.payType ?? "none",
    fixed: amount(p?.fixedCents),
    hourly: amount(p?.hourlyRateCents),
    commission: p?.commissionPercent ? String(p.commissionPercent) : "",
  };
}

/** Promoters and Entertainment earn commission (backend LINK_ROLES). */
export const LINK_ROLES: readonly TeamRole[] = ["host", "entertainment"];

/** The body the backend's parsePay accepts, or what to fix (same limits: $10,000 fixed, $1,000 an hour, 1% to 50%). */
export function payBody(
  role: string,
  f: PayForm,
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string } {
  const body: Record<string, unknown> = { payType: f.payType };
  if (f.payType === "fixed") {
    const c = parsePriceCents(f.fixed);
    if (c === null || c < 1 || c > 1_000_000)
      return { ok: false, message: "Enter a fixed amount up to $10,000." };
    body.fixedCents = c;
  }
  if (f.payType === "hourly") {
    const c = parsePriceCents(f.hourly);
    if (c === null || c < 1 || c > 100_000)
      return { ok: false, message: "Enter an hourly rate up to $1,000." };
    body.hourlyCents = c;
  }
  if (f.commission.trim()) {
    if (!(LINK_ROLES as readonly string[]).includes(role))
      return {
        ok: false,
        message: "Only Promoters and Entertainment earn commission.",
      };
    const v = f.commission.trim().replace(/%$/, "");
    if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) < 1 || Number(v) > 50)
      return {
        ok: false,
        message: "Commission is 1% to 50%, at most two decimals.",
      };
    body.commissionPercent = Number(v);
  }
  return { ok: true, body };
}

/* ---------- times (PUT /door/team/:userId/schedule) ---------- */

export interface Schedule {
  startsAt: string | null;
  endsAt: string | null;
  callAt: string | null;
  loadInAt: string | null;
  placeNote: string | null;
  hostNote: string | null;
}

/** Which times each role uses (screens 50 to 53). Every field stays optional. */
export function timeFields(
  role: string,
): { key: "startsAt" | "endsAt" | "callAt" | "loadInAt"; label: string }[] {
  if (role === "security")
    return [
      { key: "callAt", label: "Call time" },
      { key: "startsAt", label: "Shift starts" },
      { key: "endsAt", label: "Shift ends" },
    ];
  if (role === "entertainment")
    return [
      { key: "loadInAt", label: "Load in" },
      { key: "startsAt", label: "Set starts" },
      { key: "endsAt", label: "Set ends" },
    ];
  if (role === "media" || role === "other")
    return [
      { key: "callAt", label: "Call time" },
      { key: "startsAt", label: "Starts" },
      { key: "endsAt", label: "Ends" },
    ];
  return [
    { key: "startsAt", label: "Shift starts" },
    { key: "endsAt", label: "Shift ends" },
  ];
}

export const timeOf = (iso: string, tz: string) =>
  fmt(iso, tz, { hour: "numeric", minute: "2-digit" });

/** Row line: "Call 9:00 PM", "Set 11:00 PM", "9:30 PM to 2:00 AM". Empty when nothing is set. */
export function timesLine(
  role: string,
  s: Schedule | null | undefined,
  tz: string,
): string {
  if (!s) return "";
  if (role === "security" && s.callAt) return `Call ${timeOf(s.callAt, tz)}`;
  if (role === "entertainment" && s.startsAt)
    return `Set ${timeOf(s.startsAt, tz)}`;
  if ((role === "media" || role === "other") && s.callAt)
    return `Call ${timeOf(s.callAt, tz)}`;
  if (s.startsAt && s.endsAt)
    return `${timeOf(s.startsAt, tz)} to ${timeOf(s.endsAt, tz)}`;
  if (s.startsAt) return `From ${timeOf(s.startsAt, tz)}`;
  return "";
}

/** "2026-11-07" and "21:00" in the event's zone, for date and time inputs. */
export function zonedInputs(
  iso: string | null,
  tz: string,
): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

export type TimeInputs = Record<
  "startsAt" | "endsAt" | "callAt" | "loadInAt",
  { date: string; time: string }
>;

/** The whole set the schedule route saves (a field left empty is cleared), or what to fix. */
export function scheduleBody(
  t: TimeInputs,
  placeNote: string,
  hostNote: string,
  tz: string,
):
  | { ok: true; body: Record<string, string | null> }
  | { ok: false; message: string } {
  const body: Record<string, string | null> = {};
  for (const k of ["startsAt", "endsAt", "callAt", "loadInAt"] as const) {
    const { date, time } = t[k];
    if (!date && !time) {
      body[k] = null;
      continue;
    }
    const iso = isoInZone(date, time, tz);
    if (!iso) return { ok: false, message: "Pick a date and a time." };
    body[k] = iso;
  }
  if (
    body.startsAt &&
    body.endsAt &&
    new Date(body.endsAt) <= new Date(body.startsAt)
  )
    return { ok: false, message: "The end has to be after the start." };
  if (placeNote.trim().length > 300)
    return { ok: false, message: "Where to go: up to 300 characters." };
  if (hostNote.trim().length > 500)
    return { ok: false, message: "Your note: up to 500 characters." };
  body.placeNote = placeNote.trim() || null;
  body.hostNote = hostNote.trim() || null;
  return { ok: true, body };
}

/* ---------- team list (GET /door/team?roles=all) ---------- */

export interface TeamRow {
  userId: string;
  firstName: string | null;
  username: string | null;
  inviteId: string;
  status: "invited" | "accepted" | "declined";
  role: TeamRole;
  roleLabel: string | null;
  schedule: Schedule | null;
  pay: RolePay | null;
  cohostLevel: "team" | "edit" | null;
  scope: "standing" | "event";
}

/** Rows from both lists, each with its scope. Unknown roles are dropped (a newer backend). */
export function teamRows(body: {
  standing?: unknown;
  event?: unknown;
}): TeamRow[] {
  const take = (list: unknown, scope: "standing" | "event") =>
    (Array.isArray(list) ? list : [])
      .filter(
        (m: any) =>
          m &&
          typeof m.userId === "string" &&
          typeof m.inviteId === "string" &&
          isTeamRole(m.role ?? "door"),
      )
      .map(
        (m: any): TeamRow => ({
          userId: m.userId,
          firstName: m.firstName ?? null,
          username: m.username ?? null,
          inviteId: m.inviteId,
          status:
            m.status === "invited" || m.status === "declined"
              ? m.status
              : "accepted",
          role: m.role ?? "door",
          roleLabel: m.roleLabel ?? null,
          schedule: m.schedule ?? null,
          pay: isRolePay(m.pay) ? m.pay : null,
          cohostLevel:
            m.cohostLevel === "edit"
              ? "edit"
              : m.cohostLevel === "team"
                ? "team"
                : null,
          scope,
        }),
      );
  return [...take(body.standing, "standing"), ...take(body.event, "event")];
}

/** Sections in SECTION_ORDER, Other split by its name, empty ones left out. */
export function sections(
  rows: TeamRow[],
): { key: string; title: string; rows: TeamRow[] }[] {
  const out: { key: string; title: string; rows: TeamRow[] }[] = [];
  for (const role of SECTION_ORDER) {
    const mine = rows.filter((r) => r.role === role);
    if (!mine.length) continue;
    if (role !== "other") {
      out.push({ key: role, title: roleName(role).toUpperCase(), rows: mine });
      continue;
    }
    const labels = Array.from(
      new Set(mine.map((r) => roleName("other", r.roleLabel))),
    );
    for (const l of labels)
      out.push({
        key: `other:${l}`,
        title: l.toUpperCase(),
        rows: mine.filter((r) => roleName("other", r.roleLabel) === l),
      });
  }
  return out;
}

export function rowStatus(r: TeamRow): string {
  if (r.status === "invited") return "Invited";
  if (r.status === "declined") return "Said no";
  return "On the team";
}

/** Second line of a row: their time, their pay, and "All your events" for a standing spot. */
export function rowLine(r: TeamRow, tz: string): string {
  return [
    timesLine(r.role, r.schedule, tz),
    r.role === "cohost"
      ? r.cohostLevel === "edit"
        ? "Team + edit"
        : "Team"
      : payLine(r.pay),
    r.scope === "standing" ? "All your events" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function inviteSentLine(
  name: string,
  role: string,
  label: string | null,
): string {
  return role === "cohost"
    ? `Invite sent. ${name} can co-host once they accept.`
    : `Invite sent. ${name} joins as ${roleName(role, label)} once they accept.`;
}

/* ---------- taking someone off (DELETE ?role=&reason=&note=) ---------- */

export const REMOVAL_REASONS = [
  { key: "late", label: "Late" },
  { key: "no_show", label: "No show" },
  { key: "unprofessional", label: "Unprofessional conduct" },
  { key: "other", label: "Other" },
] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number]["key"];

/** Someone who accepted a paid spot needs a reason (backend REASON_REQUIRED). Invites and unpaid spots don't. */
export function needsReason(r: TeamRow): boolean {
  return (
    r.status === "accepted" &&
    !!r.pay &&
    (r.pay.payType !== "none" || !!r.pay.commissionPercent)
  );
}

export function removeQuery(
  r: TeamRow,
  reason: RemovalReason | null,
  note: string,
): { ok: true; query: string } | { ok: false; message: string } {
  const q = new URLSearchParams({ scope: r.scope, role: r.role });
  if (reason) {
    if (reason === "other" && !note.trim())
      return { ok: false, message: "Say why in a few words." };
    if (note.trim().length > 200)
      return { ok: false, message: "Up to 200 characters." };
    q.set("reason", reason);
    // Only Other carries a note (a note typed under Other then switched to Late isn't sent).
    if (reason === "other") q.set("note", note.trim());
  } else if (needsReason(r))
    return { ok: false, message: "Choose why you're taking them off." };
  return { ok: true, query: q.toString() };
}

export function removeConfirm(r: TeamRow): string {
  const who = guestName(r);
  if (r.status === "invited")
    return `Cancel ${who}'s invite? They won't be able to accept it.`;
  return r.scope === "standing"
    ? `Take ${who} off your Event team for all your events?`
    : `Take ${who} off this event's team?`;
}

/* ---------- stay longer (teamExtensions.ts) ---------- */

/** "30 more minutes", "1 more hour", "1 more hour and 30 minutes" (backend durationText). */
export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} more minutes`;
  const hours = `${h} more ${h === 1 ? "hour" : "hours"}`;
  return m ? `${hours} and ${m} minutes` : hours;
}

export const STAY_CHOICES = [30, 60, 120, 180] as const;
export const stayChoiceLabel = (m: number) =>
  m < 60 ? `${m} min` : `${m / 60} ${m === 60 ? "hour" : "hours"}`;

export type StayPay = "fixed" | "none" | "tbd" | "hourly";
/** Call 43: hourly members get their rate (the default), no extra or to be discussed; others Fixed, none or tbd. */
export function stayPayChoices(
  hourly: boolean,
): { key: StayPay; label: string }[] {
  return hourly
    ? [
        { key: "hourly", label: "At their hourly rate" },
        { key: "none", label: "No extra pay" },
        { key: "tbd", label: "To be discussed" },
      ]
    : [
        { key: "fixed", label: "Fixed amount" },
        { key: "none", label: "No extra pay" },
        { key: "tbd", label: "To be discussed" },
      ];
}

export function stayBody(
  minutes: number | null,
  end: { date: string; time: string } | null,
  pay: StayPay,
  fixed: string,
  tz: string,
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string } {
  const body: Record<string, unknown> = { pay };
  if (minutes !== null) body.minutes = minutes;
  else {
    const iso = end ? isoInZone(end.date, end.time, tz) : null;
    if (!iso) return { ok: false, message: "Pick the end date and time." };
    body.endAt = iso;
  }
  if (pay === "fixed") {
    const c = parsePriceCents(fixed);
    if (c === null || c < 1 || c > 100_000)
      return { ok: false, message: "Enter an amount up to $1,000." };
    body.fixedCents = c;
  }
  return { ok: true, body };
}

export interface StayRequest {
  id: string;
  role: string;
  extraMinutes: number;
  fromEndAt: string;
  newEndAt: string;
  payKind: StayPay;
  fixedCents: number | null;
  finalCents: number | null;
  status: "open" | "accepted" | "declined" | "expired";
  expiresAt: string;
  createdAt: string;
  member?: { firstName: string | null; username: string | null };
  memberUserId?: string;
}

export function isStayRequest(x: unknown): x is StayRequest {
  const r = x as StayRequest | null;
  return (
    !!r &&
    typeof r.id === "string" &&
    typeof r.extraMinutes === "number" &&
    typeof r.newEndAt === "string" &&
    ["open", "accepted", "declined", "expired"].includes(r.status) &&
    ["fixed", "none", "tbd", "hourly"].includes(r.payKind)
  );
}

/** "$50.00 extra", "paid at your hourly rate" (the member's words, backend payText). */
export function stayPayText(
  r: Pick<StayRequest, "payKind" | "fixedCents" | "finalCents">,
  forHost = false,
): string {
  if (r.payKind === "fixed") return `${money(r.fixedCents ?? 0)} extra`;
  if (r.payKind === "hourly")
    return forHost ? "at their hourly rate" : "paid at your hourly rate";
  if (r.payKind === "tbd")
    return r.finalCents !== null
      ? `${money(r.finalCents)} extra`
      : "extra pay to be discussed";
  return "no extra pay";
}

/** Card line, screen 56: "Until 3:00 AM, $50.00 extra." */
export function stayLine(r: StayRequest, tz: string, forHost = false): string {
  return `Until ${timeOf(r.newEndAt, tz)}, ${stayPayText(r, forHost)}.`;
}

export function stayStatus(r: StayRequest, tz: string): string {
  if (r.status === "open")
    return `Waiting for an answer until ${timeOf(r.expiresAt, tz)}`;
  if (r.status === "accepted")
    return `Accepted ${durationText(r.extraMinutes)}`;
  if (r.status === "declined") return "Said no";
  return "Expired";
}

/** Call 47: To be discussed, accepted and not entered yet. */
export const amountWaiting = (r: StayRequest) =>
  r.payKind === "tbd" && r.status === "accepted" && r.finalCents === null;

/** "Until 3:00 AM, you accepted 1 more hour" (screen 51), the latest accepted one. */
export function acceptedEndLine(
  list: StayRequest[],
  role: string,
  tz: string,
): string | null {
  const acc = list
    .filter((r) => r.role === role && r.status === "accepted")
    .sort((a, b) => b.newEndAt.localeCompare(a.newEndAt))[0];
  return acc
    ? `Until ${timeOf(acc.newEndAt, tz)}, you accepted ${durationText(acc.extraMinutes)}`
    : null;
}

/* ---------- messages (POST /team/messages) ---------- */

export const MESSAGE_MAX = 1000;
export type Audience =
  | { to: "team" }
  | { to: "role"; role: TeamRole }
  | { to: "person"; userId: string };

export function messageBody(
  a: Audience,
  text: string,
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string } {
  const t = text.trim();
  if (!t) return { ok: false, message: "Write a message." };
  if (t.length > MESSAGE_MAX)
    return {
      ok: false,
      message: `Up to ${MESSAGE_MAX.toLocaleString("en-US")} characters.`,
    };
  if ((t.match(/https?:\/\/|www\./gi) ?? []).length > 5)
    return { ok: false, message: "At most 5 links." };
  return { ok: true, body: { ...a, text: t } };
}

export function audienceLine(m: {
  audience: string;
  role: string | null;
  to: { username: string | null } | null;
  recipientCount: number;
}): string {
  const who =
    m.audience === "role"
      ? `All ${roleName(m.role ?? "")}`
      : m.audience === "person"
        ? m.to?.username
          ? `@${m.to.username}`
          : "One person"
        : "Whole team";
  return `${who} · ${m.recipientCount} ${m.recipientCount === 1 ? "person" : "people"}`;
}

/* ---------- team pay after the event (team-payouts) ---------- */

export interface TeamPayout {
  amountCents: number;
  outcome: "covered" | "not_covered" | "no_setup";
  status: "pending" | "paid" | "held" | "review" | "host_to_pay";
  sentAt: string | null;
  hostPaidAt: string | null;
  confirmedAt: string | null;
  notYetAt: string | null;
  member?: {
    userId: string;
    firstName: string | null;
    username: string | null;
  };
}

export function isTeamPayout(x: unknown): x is TeamPayout {
  const p = x as TeamPayout | null;
  return (
    !!p &&
    typeof p.amountCents === "number" &&
    typeof p.status === "string" &&
    typeof p.outcome === "string"
  );
}

/** What the host sees per person once the payout is worked out (4b-2). */
export function payoutStatusLine(p: TeamPayout): string {
  if (p.status === "host_to_pay") {
    if (p.confirmedAt) return "They confirmed they got it";
    if (p.hostPaidAt)
      return p.notYetAt && p.notYetAt > p.hostPaidAt
        ? "They said not yet"
        : "You marked it paid, waiting for them";
    return p.outcome === "no_setup"
      ? "You pay them: they didn't set up payouts in time"
      : "You pay them: ticket sales didn't cover the team";
  }
  if (p.status === "paid") return "Sent by Outsyde";
  if (p.status === "held" || p.status === "review")
    return "Held while Outsyde checks it";
  return "Outsyde sends it";
}

/** The member's line (screen 51 after payout). */
export function myPayoutLine(p: TeamPayout): string {
  if (p.status === "paid") return "Sent to your payout account.";
  if (p.status === "host_to_pay") {
    if (p.confirmedAt) return "You confirmed you got it.";
    if (p.hostPaidAt) return "The host says they paid you. Did you get it?";
    return "The host pays you directly for this event.";
  }
  if (p.status === "held" || p.status === "review")
    return "Held while Outsyde checks it.";
  return "Outsyde is sending it.";
}

/** Got it / Not yet only after the host tapped I paid them and before they confirmed. */
export const canAnswerPaid = (p: TeamPayout) =>
  p.status === "host_to_pay" && !!p.hostPaidAt && !p.confirmedAt;

/* ---------- invites (GET /door/invites?roles=all) ---------- */

/** "Jordan Events invited you to be Security" / "... to co-host with them". */
export function teamInviteHeadline(i: {
  host: { name: string };
  role: string;
  roleLabel?: string | null;
}): string {
  if (i.role === "cohost")
    return `${i.host.name} invited you to co-host with them`;
  if (i.role === "host") return `${i.host.name} invited you to be a Promoter`;
  return `${i.host.name} invited you to be ${roleName(i.role, i.roleLabel ?? null)}`;
}

/** "Summer Rooftop, Sat, Nov 7 · Fixed $160" or "All of Jordan Events' events". */
export function teamInviteLine(i: {
  scope: string;
  host: { name: string };
  event: { title: string; startsAt: string; timezone: string } | null;
  pay?: unknown;
}): string {
  const what =
    i.scope === "event" && i.event
      ? `${i.event.title}, ${fmt(i.event.startsAt, i.event.timezone, { weekday: "short", month: "short", day: "numeric" })}`
      : `All of ${i.host.name}'s events`;
  const pay =
    isRolePay(i.pay) && (i.pay.payType !== "none" || i.pay.commissionPercent)
      ? payLine(i.pay)
      : "";
  return [what, pay].filter(Boolean).join(" · ");
}

/* ---------- my events on a team (GET /door/mine?roles=all) ---------- */

export interface TeamEvent {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  role: "host" | "standing" | "event";
  team: {
    role: TeamRole;
    roleLabel: string | null;
    scope: "standing" | "event";
    inviteId: string;
  }[];
  canScan: boolean;
  ended: boolean;
}

export function isTeamEvent(x: unknown): x is TeamEvent {
  const e = x as TeamEvent | null;
  return (
    !!e &&
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    typeof e.startsAt === "string" &&
    typeof e.timezone === "string" &&
    Array.isArray(e.team) &&
    typeof e.canScan === "boolean"
  );
}

/** "Security · Admissions" for a row. */
export function teamRolesLine(e: TeamEvent): string {
  if (e.role === "host") return "Your event";
  return Array.from(
    new Set(e.team.map((t) => roleName(t.role, t.roleLabel))),
  ).join(" · ");
}

/** Leaving one spot (POST /door/invites/:inviteId/leave). */
export function leaveSpotCopy(
  spot: { role: string; roleLabel: string | null; scope: "standing" | "event" },
  title: string,
): string {
  const what = roleName(spot.role, spot.roleLabel);
  return spot.scope === "standing"
    ? `Leave as ${what} for all of this host's events?`
    : `Leave as ${what} for ${title}?`;
}

export const isCohosting = (e: TeamEvent) =>
  e.role !== "host" && e.team.some((t) => t.role === "cohost");
/** Every team event has its own page (their roles, times, pay, Leave); events I host open Manage instead. */
export const hasMemberPage = (e: TeamEvent) =>
  e.role !== "host" && e.team.length > 0;

/* ---------- host earnings card (summary.teamPay) ---------- */

export interface SummaryTeamPay {
  fixed: boolean;
  totalCents: number;
  covered: boolean;
  teamPaidCents: number;
  hostTakeHomeCents: number;
}

export function isSummaryTeamPay(x: unknown): x is SummaryTeamPay {
  const t = x as SummaryTeamPay | null;
  return (
    !!t &&
    typeof t.totalCents === "number" &&
    typeof t.covered === "boolean" &&
    typeof t.hostTakeHomeCents === "number"
  );
}

/** Null when there's no team pay. Otherwise the team total and what the host takes home (all or nothing). */
export function teamPayCard(
  t: SummaryTeamPay | null | undefined,
): { team: string; note: string } | null {
  if (!t || t.totalCents <= 0) return null;
  const team = dollars(t.totalCents);
  if (!t.covered)
    return {
      team,
      note: "Ticket earnings don't cover the team, so Outsyde pays the team $0 and you keep your earnings. You pay them yourself.",
    };
  return {
    team,
    note: `${t.fixed ? "Taken" : "Will be taken"} from your payout. You take home ${dollars(t.hostTakeHomeCents)}.`,
  };
}

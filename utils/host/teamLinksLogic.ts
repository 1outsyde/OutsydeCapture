/**
 * p4-team step 9 (app): ported from goutsyde.com app/events/_host/teamLinksLogic.ts (step 9-0). Keep the two in sync.
 * Originally: invite links on goutsyde.com (backend #402, migration 092; Legend 2026-10-31 calls 66 to 71, 67b).
 * How a host invites someone who isn't on Outsyde yet: by email (that address gets its own link), by text from the
 * host's own phone (the link in a message), or a link to copy and share. Pure helpers, no React, no network.
 * Shapes follow outsyde-backend server/events/doorRouter.ts (hostLinkJson, the public link page).
 * Copy rule: no dashes. Unit tests: utils/host/teamLinksLogic.test.ts.
 */

import { fmt } from "@/utils/eventsLogic";
import {
  dollars,
  payBody,
  roleLabelError,
  roleName,
  teamInviteHeadline,
  type PayForm,
  type TeamRole,
} from "./teamLogic";

export type InviteWay = "username" | "email" | "phone" | "link";
export const INVITE_WAYS: { key: InviteWay; label: string }[] = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "link", label: "Link" },
];

/** Same alphabet as the backend (no 0, 1, I or O), 12 characters. */
const CODE_RE = /^[A-HJ-NP-Z2-9]{12}$/;
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The body for POST /team/links. Pay goes only on a This event link, only from the host and never for a co-host
 * (the backend refuses otherwise). A co-host's link is always This event.
 */
export function linkBody(o: {
  role: TeamRole;
  label: string;
  scope: "standing" | "event";
  pay: PayForm;
  payOn: boolean;
  asHost: boolean;
  email?: string;
}):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string } {
  const scope = o.asHost ? o.scope : "event";
  const body: Record<string, unknown> = { scope, role: o.role };
  if (o.role === "other") {
    const le = roleLabelError(o.label);
    if (le) return { ok: false, message: le };
    body.roleLabel = o.label.trim().replace(/\s+/g, " ");
  }
  if (o.payOn && o.asHost && scope === "event" && o.role !== "cohost") {
    const p = payBody(o.role, o.pay);
    if (!p.ok) return { ok: false, message: p.message };
    body.pay = p.body;
  }
  if (o.email !== undefined) {
    const e = o.email.trim().toLowerCase();
    if (!EMAIL_RE.test(e) || e.length > 254)
      return { ok: false, message: "Enter a full email address." };
    body.email = e;
  }
  return { ok: true, body };
}

/** At least 10 digits, an optional leading + (same rule as quick sign up's phone). */
export function phoneError(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15
    ? null
    : "Enter a phone number with at least 10 digits.";
}

/** Opens the host's own Messages app with the link in it. Outsyde never sends texts (no provider, call 66). */
export function smsHref(phone: string, text: string): string {
  const num =
    (phone.trim().startsWith("+") ? "+" : "") + phone.replace(/\D/g, "");
  return `sms:${num}?&body=${encodeURIComponent(text)}`;
}

/** What the host sends by text or shares: who, what role, and the link. */
export function linkShareText(o: {
  hostName: string;
  role: TeamRole;
  roleLabel: string | null;
  eventTitle: string;
  scope: "standing" | "event";
  url: string;
}): string {
  const what = o.scope === "event" ? o.eventTitle : "their events";
  const as =
    o.role === "cohost"
      ? `co-host ${what}`
      : o.role === "host"
        ? `be a Promoter for ${what}`
        : `be ${roleName(o.role, o.roleLabel)} for ${what}`;
  return `${o.hostName} invited you to ${as} on Outsyde. Tap to accept: ${o.url}`;
}

export type LinkPay = {
  payType: "none" | "fixed" | "hourly";
  fixedCents: number | null;
  hourlyCents: number | null;
  commissionPercent: number | null;
};

/** "Fixed $160", "$20.50 an hour · 10% of link sales", "No pay", or "" when the link has no pay. */
export function linkPayLine(p: LinkPay | null | undefined): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.payType === "fixed" && p.fixedCents)
    parts.push(`Fixed ${dollars(p.fixedCents)}`);
  if (p.payType === "hourly" && p.hourlyCents)
    parts.push(`${dollars(p.hourlyCents)} an hour`);
  if (p.commissionPercent) parts.push(`${p.commissionPercent}% of link sales`);
  return parts.length ? parts.join(" · ") : "No pay";
}

/* ---------- the host's waiting links (GET /team/links) ---------- */

export interface HostLink {
  id: string;
  code: string;
  url: string;
  scope: "standing" | "event";
  role: TeamRole;
  roleLabel: string | null;
  cohostLevel: "team" | "edit" | null;
  pay: LinkPay | null;
  sentToEmail: string | null;
  emailSentAt: string | null;
  status: "open" | "accepted" | "cancelled" | "expired";
  expiresAt: string;
  createdAt: string;
}

export function isHostLink(x: unknown): x is HostLink {
  const l = x as HostLink | null;
  return (
    !!l &&
    typeof l.id === "string" &&
    typeof l.code === "string" &&
    typeof l.url === "string" &&
    typeof l.role === "string" &&
    typeof l.expiresAt === "string"
  );
}

/** "Jordan Events'" or "Maya's". */
const possessive = (name: string) =>
  name.endsWith("s") ? `${name}'` : `${name}'s`;

const day = (iso: string, tz: string) =>
  fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });

/** "Security · Fixed $160 · Emailed to jay@example.com · Ends Sun, Nov 8". Only the host and co-hosts see this. */
export function linkRowLine(l: HostLink, tz: string): string {
  const how = l.sentToEmail
    ? l.emailSentAt
      ? `Emailed to ${l.sentToEmail}`
      : "Not emailed (limit for today), share the link"
    : "Link";
  return [
    roleName(l.role, l.roleLabel),
    l.scope === "standing" ? "All your events" : "",
    linkPayLine(l.pay),
    how,
    `Ends ${day(l.expiresAt, tz)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ---------- the link page (GET /team-links/:code) ---------- */

export interface LinkPage {
  status: "open" | "accepted" | "cancelled" | "expired";
  scope: "standing" | "event";
  role: TeamRole;
  roleLabel: string | null;
  cohostLevel: "team" | "edit" | null;
  host: { name: string };
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
  } | null;
  upcoming: { id: string; title: string; startsAt: string; timezone: string }[];
  pay: LinkPay | null;
  expiresAt: string;
  yours: boolean;
  isHost: boolean;
}

export function isLinkPage(x: unknown): x is LinkPage {
  const l = x as LinkPage | null;
  return (
    !!l &&
    typeof l.status === "string" &&
    typeof l.role === "string" &&
    !!l.host &&
    typeof l.host.name === "string" &&
    Array.isArray(l.upcoming)
  );
}

export type LinkView = {
  state: "open" | "yours" | "closed" | "host";
  headline: string;
  body: string;
  what: string;
  payLines: { label: string; value: string }[];
  payNote: string | null;
  canAccept: boolean;
  next: { href: string; label: string } | null;
};

/** Everything the link page shows for one state. Names the host, never an email. */
export function linkPageView(l: LinkPage): LinkView {
  const what =
    l.scope === "event" && l.event
      ? `${l.event.title}, ${day(l.event.startsAt, l.event.timezone)}`
      : l.scope === "standing"
        ? `All of ${possessive(l.host.name)} events`
        : "";
  const payLines: { label: string; value: string }[] = [];
  if (l.pay) {
    if (l.pay.payType === "fixed" && l.pay.fixedCents)
      payLines.push({ label: "Fixed", value: dollars(l.pay.fixedCents) });
    if (l.pay.payType === "hourly" && l.pay.hourlyCents)
      payLines.push({
        label: `${dollars(l.pay.hourlyCents)} an hour`,
        value: "for the shift the host sets",
      });
    if (l.pay.commissionPercent)
      payLines.push({
        label: `${l.pay.commissionPercent}% of your link sales`,
        value: "",
      });
  }
  const paid = payLines.length > 0;
  const base = {
    what,
    payLines,
    payNote: paid
      ? "Paid 3 days after the event due to processing, once you set up payouts."
      : null,
  };
  if (l.isHost)
    return {
      ...base,
      state: "host",
      headline: teamInviteHeadline({
        host: l.host,
        role: l.role,
        roleLabel: l.roleLabel,
      }),
      body: "This is your invite link. Share it with the person you're inviting.",
      canAccept: false,
      next: null,
    };
  if (l.status === "accepted" && l.yours) {
    const href =
      l.scope === "event" && l.event
        ? `/events/${l.event.id}/my-team`
        : "/events/door";
    return {
      ...base,
      state: "yours",
      headline: "You're on the team",
      body: `You joined as ${roleName(l.role, l.roleLabel)}.`,
      canAccept: false,
      next: {
        href,
        label: l.scope === "event" ? "Open your event" : "Your Event team",
      },
    };
  }
  const closed = (headline: string, body: string): LinkView => ({
    state: "closed",
    headline,
    body,
    what: "",
    payLines: [],
    payNote: null,
    canAccept: false,
    next: null,
  });
  if (l.status === "accepted")
    return closed(
      "This invite was already used",
      "Someone already accepted it. Ask the host for a new link.",
    );
  if (l.status === "cancelled")
    return closed(
      "This invite was cancelled",
      "The host cancelled it. Ask them for a new link if you think that's a mistake.",
    );
  if (l.status === "expired")
    return closed(
      "This invite has ended",
      "The event is over or the link ran out. Ask the host for a new one.",
    );
  return {
    ...base,
    state: "open",
    headline: teamInviteHeadline({
      host: l.host,
      role: l.role,
      roleLabel: l.roleLabel,
    }),
    body:
      l.role === "cohost"
        ? "Co-hosts see everything the host sees for the event."
        : "Accept to join the Event team. You can leave any time.",
    canAccept: true,
    next: null,
  };
}

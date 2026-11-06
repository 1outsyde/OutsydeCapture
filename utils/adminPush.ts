// Admin push announcements in the app (App Admin Step 7a). Wording and checks copied from goutsyde.com
// app/admin/emails/PushTab.tsx, PushHistory.tsx and shared.tsx. Every real rule (3 a day, no repeat
// within 10 minutes, one send at a time, who is eligible, which screens fit) is enforced by the
// backend (server/routes/pushAdmin.ts); these only mirror it so the screen can explain itself.
// Run the tests with: npx tsx utils/adminPush.test.ts
import { etOffsetHours } from "./adminPlans";

export type PushAudience = "picked" | "vendors" | "photographers" | "consumers" | "all";
export type PushCounts = Record<Exclude<PushAudience, "picked">, number>;

export interface PushScreenOption { key: string; label: string; fit: string }
export interface PushScreensData {
  screens: PushScreenOption[];
  byAudience: Record<PushAudience, string[]>;
  defaultScreen: string;
  maxTitle: number;
  maxBody: number;
}
export interface PushLimits { sentToday: number; max: number; remaining: number; quietHours: boolean; nowNewYork: string }
export interface PushPerson { id: string; name: string | null; username: string | null; role: string; hasToken: boolean; newsOptOut: boolean; canPush: boolean }
export interface PushSendRow {
  id: string; kind: string; audience: string; title: string; body: string; screen: string | null; url: string | null;
  status: string; recipientCount: number; sentCount: number; failedCount: number; skippedCount: number;
  createdByName: string | null; createdAt: string; finishedAt: string | null;
}
export interface PushRecipientRow { userId: string | null; name: string | null; role: string | null; status: string; error: string | null; sentAt: string | null }

export const PUSH_AUDIENCES: PushAudience[] = ["picked", "vendors", "photographers", "consumers", "all"];
export const MAX_PICKED = 500; // backend MAX_PICKED (server/push/pushAudience.ts)
export const POLL_MS = 1500;

// The web's labels say "vendors" and "consumers"; the app says businesses and customers, like the rest of it.
export const AUDIENCE_LABEL: Record<PushAudience, string> = {
  picked: "Picked people",
  vendors: "All businesses",
  photographers: "All photographers",
  consumers: "All customers",
  all: "Everyone",
};

export const ROLE_LABEL: Record<string, string> = {
  consumer: "Customer",
  business: "Business",
  photographer: "Photographer",
  staff: "Staff",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
  unknown: "Maybe sent",
  done: "Done",
};

export const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/**
 * One key per push the admin means to send. A repeated key returns the same send instead of a second
 * one (backend POST /sends), so a retry after a dropped connection can't go out twice. Uses
 * crypto.randomUUID when the engine has it; otherwise the same fallback as the web. No native module.
 */
export function newPushKey(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

const LINK_RE = /^https:\/\/(www\.)?goutsyde\.com(\/|$|\?|#)/i;
// A pre-check only; the backend (isAllowedPushUrl) also refuses ports, user info and over 500 characters.
export const isAllowedPushLink = (url: string) => url.trim().length <= 500 && LINK_RE.test(url.trim());

/** The web's contentError: what's wrong with the title, message or link, or null. */
export function pushContentError(p: { title: string; body: string; screen: string; url: string; maxTitle: number; maxBody: number }): string | null {
  const t = p.title.trim();
  const b = p.body.trim();
  if (!t) return "Add a title.";
  if (t.length > p.maxTitle) return `Keep the title to ${p.maxTitle} characters.`;
  if (/[\r\n]/.test(t)) return "The title must be one line.";
  if (!b) return "Add a message.";
  if (b.length > p.maxBody) return `Keep the message to ${p.maxBody} characters.`;
  if (p.screen === "link" && !isAllowedPushLink(p.url)) return "The link must start with https://goutsyde.com.";
  return null;
}

/** The web's sendBlocker: why Send can't be pressed yet, or null. */
export function pushSendBlocker(p: {
  contentError: string | null;
  audience: PushAudience | null;
  recipients: number;
  limits: PushLimits | null;
}): string | null {
  if (p.contentError) return p.contentError;
  if (!p.audience) return "Pick who to send to.";
  if (p.recipients === 0) return p.audience === "picked" ? "Tick at least one person." : "Nobody in this group can get a push right now.";
  if (p.limits && p.limits.remaining < 1) return `You've sent ${p.limits.max} pushes today. Send it tomorrow.`;
  return null;
}

export function pushWhyNot(p: PushPerson): string {
  if (p.newsOptOut) return "Turned off Outsyde news and offers";
  if (!p.hasToken) return "Hasn't allowed notifications on a phone";
  return "Can't get pushes (disabled, demo or admin account)";
}

export function quietLine(nowNewYork: string): string {
  return /PM/i.test(nowNewYork)
    ? `It is after 9 PM in New York (${nowNewYork}). People may be asleep.`
    : `It is before 9 AM in New York (${nowNewYork}). People may be asleep.`;
}

export function countsLine(s: Pick<PushSendRow, "sentCount" | "failedCount" | "skippedCount" | "recipientCount">): string {
  const parts = [`${s.sentCount} sent`];
  if (s.failedCount) parts.push(`${s.failedCount} failed`);
  if (s.skippedCount) parts.push(`${s.skippedCount} skipped`);
  return `${parts.join(", ")} of ${s.recipientCount}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 6, 2026, 8:31 AM" in New York time (web shared.tsx DATE_FMT), without Intl time zones. */
export function formatEtDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms + etOffsetHours(ms) * 3600 * 1000);
  const h24 = d.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${h}:${min} ${h24 < 12 ? "AM" : "PM"}`;
}

/** The readable message from an ApiError; push routes answer { success: false, error: { code, message } }. */
export function pushErrorText(err: any, fallback: string): string {
  // No status = no answer from the server (network failure or timeout: services/api.ts request()).
  if (!err || typeof err.status !== "number") return OFFLINE;
  const nested = err?.body?.error;
  if (nested && typeof nested === "object" && typeof nested.message === "string" && nested.message) return nested.message;
  if (typeof nested === "string" && nested) return nested;
  if (typeof err?.message === "string" && err.message && err.message !== "[object Object]") return err.message;
  return fallback;
}

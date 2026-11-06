// Admin email history in the app (App Admin Step 7b). Read only. Labels copied from goutsyde.com
// app/admin/emails/HistoryTab.tsx and shared.tsx. Writing and sending broadcasts stays on goutsyde.com
// (pasted HTML preview needs a WebView; POST /broadcasts has no one-time key). Test: npx tsx utils/adminEmail.test.ts
import { AUDIENCE_LABEL } from "./adminPush";

export interface EmailBudget { sentToday: number; limit: number | null; remaining: number | null }
export interface EmailSendRow {
  id: string; kind: string; audience: string | null; subject: string | null; status: string;
  recipient_count: number; sent_count: number; failed_count: number;
  created_at: string; finished_at: string | null; created_by_name: string | null;
}
export interface EmailRecipientRow {
  id?: string; user_id: string | null; email: string | null; name: string | null; kind: string;
  label: string | null; status: string; error: string | null; created_at?: string; sent_at: string | null;
}
export interface EmailPerson { id: string; email: string | null; name: string | null; role: string; canBroadcast: boolean; unsubscribed: boolean }
export interface EmailPersonInfo { id: string; email: string | null; name: string | null; unsubscribed: boolean }
export interface PersonEmailRow {
  id?: string; send_id: string | null; kind: string; status: string; error?: string | null;
  subject: string | null; created_at: string; sent_at: string | null;
}

export const SEND_KIND_LABEL: Record<string, string> = {
  broadcast: "Broadcast",
  broadcast_test: "Test",
  setup: "Setup emails",
};

export const EMAIL_KIND_LABEL: Record<string, string> = {
  broadcast: "Announcement",
  broadcast_test: "Test announcement",
  setup_claim: "Claim email",
  setup_steps_left: "Steps left email",
};

export const EMAIL_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  unknown: "Maybe sent, server restarted",
  done: "Done",
};

export const EMAIL_POLL_MS = 2000;

/** Web kindLabel: known kinds by name, anything else "some_kind" → "Some kind". */
export function emailKindLabel(kind: string): string {
  return EMAIL_KIND_LABEL[kind] ?? kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function emailSendTitle(s: Pick<EmailSendRow, "kind" | "subject">): string {
  if (s.kind === "setup") return s.subject?.trim() || "Account setup emails";
  return s.subject?.trim() || "No subject";
}

export function emailCountsLine(s: Pick<EmailSendRow, "sent_count" | "failed_count" | "recipient_count">): string {
  const parts = [`${Number(s.sent_count) || 0} sent`];
  if (Number(s.failed_count)) parts.push(`${Number(s.failed_count)} failed`);
  return `${parts.join(", ")} of ${Number(s.recipient_count) || 0}`;
}

/** The audience for a send row, using the app's names (businesses, customers). Null when none. */
export function emailAudienceLabel(audience: string | null): string | null {
  return audience && Object.prototype.hasOwnProperty.call(AUDIENCE_LABEL, audience)
    ? AUDIENCE_LABEL[audience as keyof typeof AUDIENCE_LABEL]
    : null;
}

export function emailPersonName(p: { name?: string | null; email?: string | null }): string {
  return p.name?.trim() || p.email || "Unknown account";
}

/** "12 of 80 sent today", or "12 sent today" when the limit is off. */
export function emailBudgetLine(b: EmailBudget): string {
  return b.limit === null ? `${b.sentToday} sent today` : `${b.sentToday} of ${b.limit} sent today`;
}

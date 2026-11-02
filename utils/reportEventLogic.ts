/**
 * p5-safety app (Legend's calls A1 to A7, 2026-11-01): Report event and the on hold state. Pure, no React, no network.
 * Same words and rules as goutsyde.com (app/e/[slug]/reportLogic.ts). Backend: POST /api/events/:id/report
 * { reason, note? } (eventModeration.ts): signed in only, live or on hold events, never the host, co-hosts or the event's
 * team (403 CANT_REPORT_OWN); "other" needs a note; notes up to 500.
 */

/** Same line as eventsLogic GENERIC_ERROR (kept here so eventsLogic can import this file without a cycle). */
const GENERIC_ERROR = "Something went wrong. Try again.";

export const REPORT_NOTE_MAX = 500;

/** Same keys and words as the backend's REPORT_REASONS, in the order the sheet lists them. */
export const REPORT_REASONS = [
  { id: "scam", label: "Scam or fake event" },
  { id: "illegal", label: "Illegal or dangerous" },
  { id: "hate", label: "Hate, harassment or violence" },
  { id: "sexual", label: "Sexual content" },
  { id: "wrong_details", label: "Wrong date, place or details" },
  { id: "other", label: "Something else" },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]["id"];

export const REPORT_COPY = {
  button: "Report event",
  title: "Report this event",
  sub: "Tell us what's wrong. Outsyde reviews every report. The host isn't told who sent it.",
  pick: "Choose a reason.",
  noteNeeded: "Tell us what's wrong.",
  noteLabel: "Anything else we should know (optional)",
  noteLabelOther: "What's wrong",
  send: "Send report",
  thanks: "Thanks. We'll review this event.",
} as const;

export const ON_HOLD_COPY = {
  holder:
    "This event is on hold while Outsyde reviews it. Your ticket is safe, and we'll email you if anything changes.",
  host: "Outsyde put this event on hold. Check your email for the reason and next steps.",
  ticketRow: "On hold",
  ticketTag: "On hold",
  manage: "Outsyde put this event on hold. Check your email for the reason.",
} as const;

const REASON_IDS = new Set<string>(REPORT_REASONS.map((r) => r.id));
export const isReportReason = (v: unknown): v is ReportReasonId =>
  typeof v === "string" && REASON_IDS.has(v);

/** Problem with the form, or null when it can be sent. */
export function reportFormError(
  reason: string | null,
  note: string,
): string | null {
  if (!reason || !isReportReason(reason)) return REPORT_COPY.pick;
  const n = note.trim();
  if (reason === "other" && !n) return REPORT_COPY.noteNeeded;
  if (n.length > REPORT_NOTE_MAX)
    return `Keep it under ${REPORT_NOTE_MAX} characters.`;
  return null;
}

/** The request body: the note only when there is one. */
export function reportBody(
  reason: ReportReasonId,
  note: string,
): { reason: ReportReasonId; note?: string } {
  const n = note.trim();
  return n ? { reason, note: n } : { reason };
}

/**
 * Copy after a failed report (the app's request error: { status, body: { error: { code, message } } }). The backend's
 * own line for a refusal it explains (your own event, an inactive account, a bad reason), a not found line, the
 * generic line otherwise. 401 is handled by the screen (sign in).
 */
export function reportErrorCopy(err: unknown): string {
  const e = err as
    | {
        status?: number;
        body?: { error?: { code?: unknown; message?: unknown } };
      }
    | null
    | undefined;
  const status = typeof e?.status === "number" ? e.status : 0;
  const code =
    typeof e?.body?.error?.code === "string" ? e.body.error.code : "";
  const msg =
    typeof e?.body?.error?.message === "string"
      ? e.body.error.message.trim()
      : "";
  if (status === 404) return "This event isn't available to report anymore.";
  if (
    (code === "CANT_REPORT_OWN" ||
      code === "ACCOUNT_INACTIVE" ||
      code === "INVALID_INPUT") &&
    msg
  )
    return msg;
  return GENERIC_ERROR;
}

type Viewer = {
  status: string;
  onHold?: boolean;
  viewerIsHost: boolean;
  viewerIsCohost?: boolean;
};

/** Outsyde paused the event (the backend sends onHold; status paused covers an answer without it). */
export function isOnHold(e: { status: string; onHold?: boolean }): boolean {
  return e.onHold === true || e.status === "paused";
}

/** Who sees Report event: a live or on hold event, not its host or co-hosts (team members get the backend's 403). */
export function canShowReport(e: Viewer): boolean {
  return (
    (e.status === "published" || e.status === "paused") &&
    !e.viewerIsHost &&
    !e.viewerIsCohost
  );
}

/** On hold banner for this viewer, or null when the event isn't on hold. */
export function onHoldBanner(e: Viewer): string | null {
  if (!isOnHold(e)) return null;
  return e.viewerIsHost || e.viewerIsCohost
    ? ON_HOLD_COPY.host
    : ON_HOLD_COPY.holder;
}

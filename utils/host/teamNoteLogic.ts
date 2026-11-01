/**
 * p4-team step 9d-3 (app, calls 86 to 88): ported from goutsyde.com app/events/_host/teamNoteLogic.ts (step 9d-2).
 * Keep the two in sync. The Event Team note (Legend's calls 79 to 85, backend #403). A team member
 * accepts it to be paid through Outsyde. Shown when they take a spot that offers pay (one "Accept and join"), and on
 * their event page while they have pay and haven't accepted, whatever the backend's TEAM_NOTE_REQUIRED switch says
 * (call 85). Joining is never blocked (call 81): join first, then the note (call 84). Pure. Copy rule: no dashes.
 * Unit tests: utils/host/teamNoteLogic.test.ts.
 */

export interface TeamNote {
  version: string;
  title: string;
  intro: string;
  points: string[];
  accepted: boolean;
  acceptedAt: string | null;
}

export function isTeamNote(x: unknown): x is TeamNote {
  const n = x as TeamNote | null;
  return (
    !!n &&
    typeof n.version === "string" &&
    typeof n.title === "string" &&
    Array.isArray(n.points) &&
    n.points.every((p) => typeof p === "string") &&
    typeof n.accepted === "boolean"
  );
}

/** An invite's or a link's pay (both carry payType and commissionPercent): anything but No pay. */
export function payOffered(pay: unknown): boolean {
  const p = pay as { payType?: unknown; commissionPercent?: unknown } | null;
  if (!p || !["none", "fixed", "hourly"].includes(String(p.payType)))
    return false;
  return (
    p.payType !== "none" ||
    (typeof p.commissionPercent === "number" && p.commissionPercent > 0)
  );
}

/** Show the note with Accept: the spot offers pay and they haven't accepted it. A note that didn't load: no card. */
export const noteOnAccept = (pay: unknown, note: TeamNote | null) =>
  payOffered(pay) && !!note && !note.accepted;

export const acceptLabel = (withNote: boolean) =>
  withNote ? "Accept and join" : "Accept";

/** Their event page: they have pay, it isn't worked out yet, and they haven't accepted. */
export const noteOnMyPage = (
  s: { hasPay: boolean; paidOut: boolean },
  note: TeamNote | null,
) => s.hasPay && !s.paidOut && !!note && !note.accepted;

/** The "Set up payouts" link: only when payout setup is what's missing (older backends: whenever anything is). */
export function setupLinkShown(
  s: {
    needed: boolean;
    deadline: string | null;
    stripeNeeded?: boolean;
    noteNeeded?: boolean;
  } | null,
): boolean {
  if (!s?.needed) return false;
  return typeof s.stripeNeeded === "boolean" ? s.stripeNeeded : true;
}

/** Joined, but saving the note failed (call 84). On the invite list it waits on their event page. */
export const NOTE_SAVE_FAILED =
  "You're on the team. Your acceptance of the Event Team note didn't save, so it's waiting on your event page.";
/** The same on the link page, where the note card shows again right below. */
export const NOTE_SAVE_FAILED_HERE =
  "You're on the team. Your acceptance of the Event Team note didn't save. Accept it below.";

/**
 * Their event page: pay that isn't worked out yet, the backend's own rule (GET /team/me sends payoutSetup only then:
 * paid, team pay not fixed, no payout). Null payoutSetup (no pay, worked out, or it failed): no note card.
 */
export const payNotWorkedOut = (me: {
  payoutSetup: unknown;
  payout: unknown;
}) => me.payoutSetup !== null && me.payoutSetup !== undefined && !me.payout;

/** When the switch is on and the note couldn't load: still tell them what's due, so the page is never silent. */
export function noteDueLine(
  s: { noteNeeded?: boolean; deadline: string | null } | null,
  noteLoaded: boolean,
  when: (iso: string) => string,
): string | null {
  if (!s?.noteNeeded || noteLoaded) return null;
  return s.deadline
    ? `Accept the Event Team note by ${when(s.deadline)} to get paid.`
    : "Accept the Event Team note to get paid.";
}

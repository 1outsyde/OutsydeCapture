/**
 * Who can do what on the app's Event team and Manage screens (p4-team step 9a, calls 57 to 63). The same rules as
 * goutsyde.com (ManageClient access, PersonPanel) and the backend, which refuses anything else anyway: these only hide
 * what would fail. Pure. Unit tests: utils/host/eventTeamRules.test.ts.
 */
import {
  STAY_LONGER_ROLES,
  roleName,
  type Audience,
  type TeamRole,
  type TeamRow,
} from "./teamLogic";
import { guestName } from "./manageLogic";

export type Access = { as: "host" | "cohost"; level: "team" | "edit" | null };

/** GET /manage `access` (step 2b). Missing (an older backend) reads as the host: only hosts could open Manage then. */
export function manageAccess(
  body:
    | { access?: { as?: unknown; level?: unknown } | null }
    | null
    | undefined,
): Access {
  const a = body?.access;
  if (a?.as === "cohost")
    return { as: "cohost", level: a.level === "edit" ? "edit" : "team" };
  return { as: "host", level: null };
}

/** Call 63: co-hosts never cancel or refund; Team level co-hosts don't edit (backend cohostBlocked). */
export function manageActions(
  a: Access,
  status: string,
): { edit: boolean; cancel: boolean; refund: boolean } {
  const host = a.as === "host";
  return {
    edit: status !== "cancelled" && (host || a.level === "edit"),
    cancel: host,
    refund: host,
  };
}

/**
 * One person's sheet. Times: host or co-host, anyone but co-hosts (standing members too), until the event ends. Pay: host only. Level: host,
 * an accepted co-host. Remove: until the event ends (a standing spot can still go), co-hosts only this event's non
 * co-host spots.
 */
export function personRights(
  row: TeamRow,
  ev: { startsAt?: string; endsAt: string; status: string },
  asHost: boolean,
  now: number,
) {
  const ended =
    new Date(ev.endsAt).getTime() <= now || ev.status === "cancelled";
  return {
    times: !ended && row.role !== "cohost", // the backend lets co-hosts set this event's times, standing members included
    pay: asHost && !ended && row.role !== "cohost",
    level:
      asHost && !ended && row.role === "cohost" && row.status === "accepted",
    remove:
      (row.scope === "standing" || !ended) &&
      (asHost || (row.scope === "event" && row.role !== "cohost")),
    // Step 9b, calls 41 to 44: the host only, someone who accepted, Admissions / Security / Entertainment / Media /
    // Other, from the event start until it ends (the backend checks their own end too).
    stay:
      asHost &&
      !ended &&
      row.status === "accepted" &&
      STAY_LONGER_ROLES.includes(row.role) &&
      !!ev.startsAt &&
      new Date(ev.startsAt).getTime() <= now,
  };
}

/** Everyone listed on the team screen (invites and Said no too), as the old door team count did. */
export const teamCount = (rows: TeamRow[]) => rows.length;

/** The Manage button (call 59: Event team everywhere). */
export const eventTeamLabel = (n: number) =>
  n > 0 ? `Event team (${n})` : "Event team";

/**
 * Step 9b (screen 49): who a message can go to. Whole team, each role someone accepted, each person once. Invites and
 * people who said no aren't on the team yet (the backend sends only to accepted members).
 */
export function audienceOptions(
  rows: TeamRow[],
): { value: string; label: string }[] {
  const accepted = rows.filter((r) => r.status === "accepted");
  if (!accepted.length) return [];
  const roles = Array.from(new Map(accepted.map((r) => [r.role, r])).values());
  const people = Array.from(
    new Map(accepted.map((r) => [r.userId, r])).values(),
  );
  return [
    { value: "team", label: "Whole team" },
    // A role message goes to everyone in that role: Other is every Other, whatever its name (same as the website).
    ...roles.map((r) => ({
      value: `role:${r.role}`,
      label: `All ${roleName(r.role)}`,
    })),
    ...people.map((p) => ({
      value: `person:${p.userId}`,
      label: guestName(p),
    })),
  ];
}

/** The picked option as the audience the message route takes. */
export function audienceFrom(value: string): Audience {
  if (value.startsWith("role:"))
    return { to: "role", role: value.slice(5) as TeamRole };
  if (value.startsWith("person:"))
    return { to: "person", userId: value.slice(7) };
  return { to: "team" };
}

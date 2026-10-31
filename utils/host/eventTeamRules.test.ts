/**
 * Unit tests for who can do what on the app's Event team and Manage screens (p4-team step 9a, calls 57 to 63).
 * Same rules as goutsyde.com (ManageClient access, PersonPanel canTimes / canPay / canRemove) and the backend
 * (cohostBlocked, doorRouter). npx tsx utils/host/eventTeamRules.test.ts
 *
 * Mutation checks (each must turn a test red):
 *  - let a Team level co-host edit → "Team level: no Edit" fails.
 *  - let a co-host refund → "co-hosts never refund or cancel" fails.
 *  - let a co-host set pay → "a co-host sets times, never pay" fails.
 *  - let anyone remove from an ended event's team → "an ended event's team is locked" fails.
 */
import {
  manageAccess,
  manageActions,
  personRights,
  eventTeamLabel,
  teamCount,
} from "./eventTeamRules";
import type { TeamRow } from "./teamLogic";

let passed = 0,
  failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(
      `  FAIL ${name}`,
      JSON.stringify(actual),
      "expected",
      JSON.stringify(expected),
    );
  }
}

console.log("who's looking at Manage (GET /manage access)");
eq(
  manageAccess({ access: { as: "host", level: null } }),
  { as: "host", level: null },
  "the host",
);
eq(
  manageAccess({ access: { as: "cohost", level: "edit" } }),
  { as: "cohost", level: "edit" },
  "an edit level co-host",
);
eq(
  manageAccess({ access: { as: "cohost", level: null } }),
  { as: "cohost", level: "team" },
  "a co-host with no level is Team",
);
eq(
  manageAccess({}),
  { as: "host", level: null },
  "an older backend without access: the host (only hosts could open Manage then)",
);

console.log("Manage buttons (call 63)");
eq(
  manageActions({ as: "host", level: null }, "published"),
  { edit: true, cancel: true, refund: true },
  "the host sees everything",
);
eq(
  manageActions({ as: "cohost", level: "edit" }, "published"),
  { edit: true, cancel: false, refund: false },
  "Team + edit: Edit only",
);
eq(
  manageActions({ as: "cohost", level: "team" }, "published"),
  { edit: false, cancel: false, refund: false },
  "Team level: no Edit; co-hosts never refund or cancel",
);
eq(
  manageActions({ as: "host", level: null }, "cancelled").edit,
  false,
  "a cancelled event has no Edit (as today)",
);

console.log("one person's sheet (mockup B)");
const now = new Date("2026-11-01T12:00:00.000Z").getTime();
const ev = {
  startsAt: "2026-11-07T02:00:00.000Z",
  endsAt: "2026-11-07T07:00:00.000Z",
  status: "published",
};
const row = (o: Partial<TeamRow> = {}): TeamRow => ({
  userId: "u1",
  firstName: "Marcus",
  username: "marcus",
  inviteId: "i1",
  status: "accepted",
  role: "security",
  roleLabel: null,
  schedule: null,
  pay: null,
  cohostLevel: null,
  scope: "event",
  ...o,
});
eq(
  personRights(row(), ev, true, now),
  { times: true, pay: true, level: false, remove: true },
  "host, a Security member",
);
eq(
  personRights(row(), ev, false, now),
  { times: true, pay: false, level: false, remove: true },
  "a co-host sets times, never pay",
);
eq(
  personRights(row({ role: "cohost", cohostLevel: "team" }), ev, true, now),
  { times: false, pay: false, level: true, remove: true },
  "host, a co-host: their level, no times or pay",
);
eq(
  personRights(
    row({ role: "cohost", cohostLevel: "team", status: "invited" }),
    ev,
    true,
    now,
  ).level,
  false,
  "an invited co-host has no level to change yet",
);
eq(
  personRights(row({ role: "cohost" }), ev, false, now),
  { times: false, pay: false, level: false, remove: false },
  "a co-host never touches another co-host",
);
eq(
  personRights(row({ scope: "standing" }), ev, false, now).remove,
  false,
  "a co-host never takes off a standing member",
);
eq(
  personRights(row({ scope: "standing" }), ev, false, now).times,
  true,
  "but sets their times for this event (same as the website)",
);
const ended = { ...ev, endsAt: "2026-11-01T11:00:00.000Z" };
eq(
  personRights(row(), ended, true, now),
  { times: false, pay: false, level: false, remove: false },
  "an ended event's team is locked",
);
eq(
  personRights(row({ scope: "standing" }), ended, true, now).remove,
  true,
  "a standing spot can still go after one event ends",
);
eq(
  personRights(row(), { ...ev, status: "cancelled" }, true, now).pay,
  false,
  "a cancelled event is locked too",
);

console.log("the Manage button");
const rows = [
  row(),
  row({ userId: "u2", role: "door" }),
  row({ userId: "u1", role: "door", scope: "standing" }),
  row({ userId: "u3", status: "declined" }),
];
eq(
  teamCount(rows),
  4,
  "everyone listed, invites and Said no included (as the door team count did)",
);
eq(eventTeamLabel(0), "Event team", "none yet");
eq(eventTeamLabel(4), "Event team (4)", "with the count (call 59)");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

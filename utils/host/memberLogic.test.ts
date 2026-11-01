/**
 * Unit tests for the member side of the Event team in the app (p4-team step 9c-1, calls 59, 62, 63, 65, 74, 75).
 * Same rules as goutsyde.com DoorClient, MyTeamClient, MineClient and the scanner, and the backend doorRouter
 * (myTeamEvents canScan, loadEventForDoor, /team/me). npx tsx utils/host/memberLogic.test.ts
 *
 * Mutation checks (each must turn a test red):
 *  - give a plain door member Undo → "a door member never gets Undo" fails.
 *  - drop co-hosts from scan access → "a co-host can scan (call 74)" fails.
 *  - show Accept on an expired stay longer request → "an expired request is not answered" fails.
 *  - offer Leave after the event ended → "no Leave once the event ended" fails.
 *  - send a non door invite to the scanner after accept → "Security goes to their event page" fails.
 *  - show Set up payouts when only the note is missing → "only the note missing: no Set up payouts line" fails.
 *  - keep waiting for the Stripe return when Stripe is done → "Stripe done, only the note missing: stop waiting" fails.
 */
import {
  canUndo,
  cohostingEvents,
  inviteAfter,
  isTeamInvite,
  leaveSpots,
  memberInviteCopy,
  myPayLines,
  openStayRequests,
  parseMyTeam,
  rowActions,
  scanAccess,
  setupNeededLine,
  splitTeamEvents,
  stripeWaitDone,
  MENU_ITEM,
  type TeamInvite,
} from "./memberLogic";
import type { TeamEvent } from "./teamLogic";

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

const TZ = "America/New_York";
const EV = {
  id: "e1",
  title: "Summer Rooftop",
  startsAt: "2026-11-08T02:00:00.000Z",
  endsAt: "2026-11-08T07:00:00.000Z",
  timezone: TZ,
};

function invite(over: Partial<TeamInvite> = {}): TeamInvite {
  return {
    id: "i1",
    scope: "event",
    role: "security",
    status: "invited",
    invitedAt: null,
    roleLabel: null,
    cohostLevel: null,
    host: { name: "Jordan Events" },
    event: EV,
    upcoming: [],
    pay: null,
    ...over,
  } as TeamInvite;
}

function tev(over: Partial<TeamEvent> = {}): TeamEvent {
  return {
    id: "e1",
    slug: "summer",
    title: "Summer Rooftop",
    startsAt: EV.startsAt,
    endsAt: EV.endsAt,
    timezone: TZ,
    role: "event",
    team: [
      { role: "security", roleLabel: null, scope: "event", inviteId: "i1" },
    ],
    canScan: false,
    ended: false,
    ...over,
  } as TeamEvent;
}

/* ---------- menu (call 75) ---------- */
eq(
  MENU_ITEM,
  { label: "Event team", subtitle: "Invites, events you work and your pay" },
  "Account menu item renamed (call 75)",
);

/* ---------- invites ---------- */
console.log("invites");
eq(isTeamInvite(invite()), true, "a security invite is accepted by the check");
eq(
  isTeamInvite({ ...invite(), role: 5 }),
  false,
  "a role that isn't text is dropped",
);
eq(isTeamInvite({ ...invite(), host: null }), false, "no host: dropped");

let c = memberInviteCopy(invite());
eq(
  c.headline,
  "Jordan Events invited you to be Security",
  "invited headline names the role",
);
eq(
  c.body,
  "See your call time, where to go and the host's notes. You can leave any time.",
  "security body, member's words",
);
eq(c.scopeLabel, "ONLY THIS EVENT", "event scope label");
eq(c.pay, null, "no pay offered: no pay line");
eq(
  c.privacy,
  "You won't see sales, earnings or anyone's contact details.",
  "non co-hosts see no money",
);
c = memberInviteCopy(
  invite({
    pay: {
      payType: "fixed",
      fixedCents: 16000,
      hourlyRateCents: null,
      hours: null,
      hourlyCents: null,
      commissionPercent: null,
      commissionCents: null,
      earnedCents: 16000,
      needsShift: false,
    },
  }),
);
eq(c.pay, "Fixed $160", "pay offered shows as one line");
c = memberInviteCopy(
  invite({
    pay: {
      payType: "none",
      fixedCents: null,
      hourlyRateCents: null,
      hours: null,
      hourlyCents: null,
      commissionPercent: null,
      commissionCents: null,
      earnedCents: 0,
      needsShift: false,
    },
  }),
);
eq(c.pay, null, "No pay is not shown as an offer");
c = memberInviteCopy(invite({ role: "cohost", cohostLevel: "edit" }));
eq(
  c.headline,
  "Jordan Events invited you to co-host with them",
  "co-host headline",
);
eq(
  c.body,
  "See everything the host sees for the event, including sales, the guest list and the team. You can also edit the event. You can leave any time.",
  "edit level co-host body",
);
eq(c.privacy, null, "co-hosts see sales, so no privacy line");
c = memberInviteCopy(invite({ role: "cohost", cohostLevel: "team" }));
eq(
  c.body,
  "See everything the host sees for the event, including sales, the guest list and the team. You can leave any time.",
  "team level co-host body",
);
c = memberInviteCopy(invite({ role: "other", roleLabel: "Coat check" }));
eq(
  c.headline,
  "Jordan Events invited you to be Coat check",
  "Other uses the host's role name",
);
c = memberInviteCopy(
  invite({
    role: "door",
    scope: "standing",
    event: null,
    upcoming: [
      { id: "e2", title: "Fall Night", startsAt: EV.startsAt, timezone: TZ },
    ],
  }),
);
eq(c.scopeLabel, "ALL OF JORDAN EVENTS'S EVENTS", "standing scope label");
eq(
  c.events.map((e) => e.title),
  ["Fall Night"],
  "standing shows their upcoming events",
);
eq(
  c.body,
  "Scan tickets at the door and see the guest list. You can leave any time.",
  "door body",
);
c = memberInviteCopy(invite({ status: "accepted" }));
eq(c.headline, "You're on the Event team as Security", "accepted headline");
eq(
  c.body,
  "Your times, notes and pay are on your event page.",
  "accepted, this event",
);
c = memberInviteCopy(invite({ status: "accepted", role: "door" }));
eq(
  c.body,
  "You can scan tickets for Summer Rooftop. The scanner opens 6 hours before it starts.",
  "accepted door keeps the scanner line",
);
c = memberInviteCopy(
  invite({ status: "accepted", scope: "standing", event: null }),
);
eq(
  c.body,
  "Jordan Events's events show up in Event team.",
  "accepted standing",
);
c = memberInviteCopy(invite({ status: "declined" }));
eq([c.state, c.headline], ["declined", "Invite declined"], "declined");
c = memberInviteCopy(invite({ status: "gone" }));
eq([c.headline, c.events.length], ["This invite is no longer open", 0], "gone");
c = memberInviteCopy(invite({ status: "gone" }), true);
eq(
  [c.headline, c.body],
  ["You left the Event team", "Jordan Events can invite you again."],
  "just left",
);

console.log("after accept");
eq(
  inviteAfter(invite({ role: "door" })),
  { to: "scanner", eventId: "e1" },
  "Admissions, this event: the scanner",
);
eq(
  inviteAfter(invite()),
  { to: "myTeam", eventId: "e1" },
  "Security goes to their event page",
);
eq(
  inviteAfter(invite({ role: "cohost" })),
  { to: "myTeam", eventId: "e1" },
  "co-host, this event: their event page",
);
eq(
  inviteAfter(invite({ scope: "standing", event: null })),
  { to: "list" },
  "all events: the Event team list",
);
eq(
  inviteAfter(invite({ role: "door", scope: "standing", event: null })),
  { to: "list" },
  "standing door: the list",
);

/* ---------- Event team list (mockup D) ---------- */
console.log("event team list");
const list = [
  tev(),
  tev({ id: "e2", ended: true }),
  tev({ id: "e3", role: "host", team: [], canScan: true }),
];
const sp = splitTeamEvents(list);
eq(
  [sp.upcoming.map((e) => e.id), sp.past.map((e) => e.id)],
  [["e1", "e3"], ["e2"]],
  "upcoming and recently ended",
);
eq(
  rowActions(tev()),
  { open: true, scan: false, manage: false },
  "security: Open only",
);
eq(
  rowActions(
    tev({
      canScan: true,
      team: [{ role: "door", roleLabel: null, scope: "event", inviteId: "i1" }],
    }),
  ),
  { open: true, scan: true, manage: false },
  "door: Open and Scan",
);
eq(
  rowActions(
    tev({
      canScan: true,
      team: [
        { role: "cohost", roleLabel: null, scope: "event", inviteId: "i1" },
      ],
    }),
  ),
  { open: true, scan: true, manage: true },
  "co-host: Open, Scan, Manage",
);
eq(
  rowActions(tev({ role: "host", team: [], canScan: true })),
  { open: false, scan: true, manage: true },
  "my own event: Scan and Manage",
);
eq(
  rowActions(
    tev({
      canScan: true,
      ended: true,
      team: [{ role: "door", roleLabel: null, scope: "event", inviteId: "i1" }],
    }),
  ),
  { open: true, scan: false, manage: false },
  "ended: no Scan",
);

/* ---------- scanner access (call 74) ---------- */
console.log("scanner");
const door = tev({
  canScan: true,
  team: [{ role: "door", roleLabel: null, scope: "event", inviteId: "i1" }],
});
const coh = tev({
  canScan: true,
  team: [
    { role: "cohost", roleLabel: null, scope: "standing", inviteId: "i2" },
  ],
  role: "standing",
});
eq(scanAccess([door], "e1")?.as, "member", "door member can scan");
eq(scanAccess([coh], "e1")?.as, "cohost", "a co-host can scan (call 74)");
eq(
  scanAccess([tev({ role: "host", team: [], canScan: true })], "e1")?.as,
  "host",
  "host can scan",
);
eq(scanAccess([tev()], "e1"), null, "security can't scan");
eq(scanAccess([door], "e9"), null, "another event: no access");
eq(
  scanAccess([coh], "e1")?.title,
  "Summer Rooftop",
  "carries the event's details",
);
eq(canUndo("host"), true, "host undoes");
eq(
  canUndo("cohost"),
  true,
  "co-host undoes (backend doorUser hostRequired allows co-hosts)",
);
eq(canUndo("member"), false, "a door member never gets Undo");

/* ---------- my page (mockup C) ---------- */
console.log("my team page");
const body = {
  success: true,
  event: { ...EV, slug: "summer" },
  host: { name: "Jordan Events" },
  roles: [
    {
      role: "security",
      roleLabel: null,
      scope: "event",
      schedule: null,
      pay: {
        payType: "fixed",
        fixedCents: 16000,
        hourlyRateCents: null,
        hours: null,
        hourlyCents: null,
        commissionPercent: null,
        commissionCents: null,
        earnedCents: 16000,
        needsShift: false,
      },
    },
    {
      role: "media",
      roleLabel: null,
      scope: "event",
      schedule: null,
      pay: "bad",
    },
  ],
  promoter: null,
  payTotalCents: 16000,
  payout: null,
  payoutSetup: { needed: true, deadline: "2026-11-11T07:00:00.000Z" },
  fromHost: [
    {
      id: "m1",
      at: EV.startsAt,
      text: "Park in the back",
      from: { name: "Jordan" },
    },
    { bad: true },
  ],
  stayLonger: [
    {
      id: "s1",
      role: "security",
      extraMinutes: 60,
      fromEndAt: EV.endsAt,
      newEndAt: "2026-11-08T08:00:00.000Z",
      payKind: "fixed",
      fixedCents: 5000,
      finalCents: null,
      status: "open",
      expiresAt: "2026-11-08T06:00:00.000Z",
      createdAt: EV.startsAt,
    },
    {
      id: "s2",
      role: "security",
      extraMinutes: 60,
      fromEndAt: EV.endsAt,
      newEndAt: "2026-11-08T08:00:00.000Z",
      payKind: "fixed",
      fixedCents: 5000,
      finalCents: null,
      status: "open",
      expiresAt: "2026-11-08T03:00:00.000Z",
      createdAt: EV.startsAt,
    },
    { nope: 1 },
  ],
};
const me = parseMyTeam(body)!;
eq(me.roles[1].pay, null, "a pay that doesn't look right is dropped");
eq(me.fromHost.length, 1, "bad messages dropped");
eq(me.stayLonger.length, 2, "bad requests dropped");
eq(parseMyTeam({ success: true }), null, "no event: null");
eq(parseMyTeam(null), null, "nothing: null");
const now = Date.parse("2026-11-08T04:00:00.000Z");
eq(
  openStayRequests(me, now).map((r) => r.id),
  ["s1"],
  "an expired request is not answered",
);
eq(
  myPayLines(me).map((l) => l.label),
  ["Security: Fixed"],
  "two roles: each line says its role",
);
eq(
  myPayLines({ ...me, roles: [me.roles[0]] }).map((l) => l.label),
  ["Fixed"],
  "one role: no prefix",
);
eq(
  setupNeededLine(me),
  "Set up payouts by Wed, Nov 11 to get paid.",
  "payout setup with the deadline",
);
eq(
  setupNeededLine({ ...me, payoutSetup: { needed: false, deadline: null } }),
  null,
  "set up already: nothing",
);
eq(
  setupNeededLine({ ...me, payoutSetup: { needed: true, deadline: null } }),
  "Set up payouts to get paid.",
  "no deadline",
);

// p4-team step 9d-3 (call 87): /team/me says what's missing (backend #403). Set up payouts only for Stripe.
const both = parseMyTeam({
  ...body,
  payoutSetup: {
    needed: true,
    deadline: "2026-11-11T07:00:00.000Z",
    stripeNeeded: false,
    noteNeeded: true,
  },
})!;
eq(
  both.payoutSetup,
  {
    needed: true,
    deadline: "2026-11-11T07:00:00.000Z",
    stripeNeeded: false,
    noteNeeded: true,
  },
  "what's missing is kept",
);
eq(
  parseMyTeam({
    ...body,
    payoutSetup: { needed: true, deadline: null, stripeNeeded: "yes" },
  })!.payoutSetup,
  { needed: true, deadline: null },
  "a missing flag that isn't true or false is dropped",
);
eq(
  setupNeededLine(both),
  null,
  "only the note missing: no Set up payouts line",
);
eq(
  setupNeededLine({
    ...both,
    payoutSetup: { ...both.payoutSetup!, stripeNeeded: true },
  }),
  "Set up payouts by Wed, Nov 11 to get paid.",
  "Stripe missing: the Set up payouts line",
);
eq(
  setupNeededLine(me),
  "Set up payouts by Wed, Nov 11 to get paid.",
  "an older backend (no flags): the line whenever anything is needed",
);
eq(
  stripeWaitDone(both),
  true,
  "Stripe done, only the note missing: stop waiting for the Stripe return",
);
eq(stripeWaitDone(me), false, "an older backend, still needed: keep waiting");
eq(
  stripeWaitDone({ ...me, payoutSetup: null }),
  true,
  "nothing needed: stop waiting",
);
eq(
  stripeWaitDone({
    ...both,
    payoutSetup: { ...both.payoutSetup!, stripeNeeded: true },
  }),
  false,
  "Stripe missing: keep waiting",
);

const spots = [
  {
    role: "security" as const,
    roleLabel: null,
    scope: "event" as const,
    inviteId: "i1",
  },
];
eq(leaveSpots([tev()], "e1", false), spots, "Leave for each of my spots");
eq(leaveSpots([tev()], "e1", true), [], "no Leave once the event ended");
eq(leaveSpots([tev()], "e9", false), [], "spots from another event never show");

/* ---------- co-hosting (call 63) ---------- */
console.log("co-hosting");
eq(
  cohostingEvents({
    events: [
      {
        id: "c1",
        slug: "c",
        title: "Co",
        startsAt: EV.startsAt,
        endsAt: EV.endsAt,
        timezone: TZ,
        status: "published",
      },
      { id: 3 },
    ],
  }).map((e) => e.id),
  ["c1"],
  "keeps real events",
);
eq(cohostingEvents(null), [], "failed call: empty");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

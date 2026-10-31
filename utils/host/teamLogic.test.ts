/** Unit tests for the Event team helpers (p4-team step 8). No server: npx tsx utils/host/teamLogic.test.ts (port of goutsyde.com tests/events-team-logic.test.ts) */
import {
  roleName,
  roleLabelError,
  payLine,
  earningLines,
  payBody,
  payFormFrom,
  timesLine,
  zonedInputs,
  scheduleBody,
  teamRows,
  sections,
  rowLine,
  needsReason,
  removeQuery,
  removeConfirm,
  durationText,
  stayPayChoices,
  stayBody,
  stayLine,
  stayStatus,
  amountWaiting,
  acceptedEndLine,
  messageBody,
  audienceLine,
  payoutStatusLine,
  myPayoutLine,
  canAnswerPaid,
  teamInviteHeadline,
  teamInviteLine,
  teamRolesLine,
  isCohosting,
  hasMemberPage,
  teamPayCard,
  dollars,
  timeFields,
  inviteSentLine,
  isTeamEvent,
  type RolePay,
  type TeamRow,
  type StayRequest,
  type TeamPayout,
  type TeamEvent,
} from "./teamLogic";

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
const DASH = /[–—]| - /;
const tz = "America/New_York";
const all: string[] = [];
const say = (s: string) => {
  all.push(s);
  return s;
};

console.log("roles");
eq(
  ["door", "security", "host", "entertainment", "media", "cohost", "other"].map(
    (r) => roleName(r),
  ),
  [
    "Admissions",
    "Security",
    "Promoter",
    "Entertainment",
    "Media",
    "Co-host",
    "Other",
  ],
  "names (door = Admissions, host = Promoter)",
);
eq(
  [roleName("other", " Coat check "), roleName("other", ""), roleName("vip")],
  ["Coat check", "Other", "Event team"],
  "Other's own name, unknown roles",
);
eq(
  [
    roleLabelError("Coat check"),
    roleLabelError(""),
    roleLabelError("x".repeat(41)),
    roleLabelError("Bar <tab>"),
  ],
  [
    null,
    "Type a name for this role.",
    "Up to 40 characters.",
    "Letters, numbers, spaces and & ' . , / ( ) only.",
  ],
  "Other name rules (backend parseRoleLabel)",
);

console.log("pay");
const fixed: RolePay = {
  payType: "fixed",
  fixedCents: 16000,
  hourlyRateCents: null,
  hours: null,
  hourlyCents: null,
  commissionPercent: null,
  commissionCents: null,
  earnedCents: 21000,
  needsShift: false,
  extraCents: 5000,
  extras: [{ id: "x", minutes: 60, payKind: "fixed", cents: 5000, tbd: false }],
};
const hourly: RolePay = {
  payType: "hourly",
  fixedCents: null,
  hourlyRateCents: 5000,
  hours: 2,
  hourlyCents: 10000,
  commissionPercent: 10,
  commissionCents: 1500,
  earnedCents: 11500,
  needsShift: false,
};
const noShift: RolePay = {
  ...hourly,
  hours: null,
  hourlyCents: null,
  needsShift: true,
  commissionPercent: null,
  commissionCents: null,
  earnedCents: 0,
};
const tbd: RolePay = {
  payType: "none",
  fixedCents: null,
  hourlyRateCents: null,
  hours: null,
  hourlyCents: null,
  commissionPercent: null,
  commissionCents: null,
  earnedCents: 0,
  needsShift: false,
  extraCents: 0,
  extras: [
    { id: "t", minutes: 90, payKind: "tbd", cents: null, tbd: true },
    { id: "n", minutes: 30, payKind: "none", cents: 0, tbd: false },
  ],
};
eq(
  [
    payLine(fixed),
    payLine(hourly),
    payLine(noShift),
    payLine(tbd),
    payLine(null),
  ],
  [
    "Fixed $160 · $50 for staying longer",
    "$50 an hour · 10% of link sales",
    "$50 an hour, set their shift",
    "No pay",
    "",
  ],
  "row pay line",
);
eq(
  earningLines(fixed),
  [
    { label: "Fixed", value: "$160" },
    { label: "Stayed 1 more hour", value: "$50" },
  ],
  "screen 51: $160 + $50",
);
eq(
  earningLines(hourly),
  [
    { label: "2 hours at $50", value: "$100" },
    { label: "10% of your link sales", value: "$15" },
  ],
  "hourly and commission",
);
eq(
  earningLines(noShift)[0],
  { label: "$50 an hour", value: "Once your shift is set" },
  "hourly without a shift",
);
eq(
  earningLines(tbd),
  [{ label: "Stayed 1 more hour and 30 minutes", value: "To be discussed" }],
  "to be discussed shown; no extra pay left off (screen 56)",
);
eq(
  [dollars(16000), dollars(1250), dollars(100000000)],
  ["$160", "$12.50", "$1,000,000"],
  "dollars",
);
eq(
  payBody("security", {
    payType: "fixed",
    fixed: "160",
    hourly: "",
    commission: "",
  }),
  { ok: true, body: { payType: "fixed", fixedCents: 16000 } },
  "fixed body",
);
eq(
  payBody("entertainment", {
    payType: "hourly",
    fixed: "",
    hourly: "$50.50",
    commission: "12.5%",
  }),
  {
    ok: true,
    body: { payType: "hourly", hourlyCents: 5050, commissionPercent: 12.5 },
  },
  "hourly + commission",
);
eq(
  payBody("security", {
    payType: "none",
    fixed: "",
    hourly: "",
    commission: "10",
  }).ok,
  false,
  "commission only for Promoters and Entertainment",
);
eq(
  [
    payBody("door", {
      payType: "fixed",
      fixed: "10000.01",
      hourly: "",
      commission: "",
    }).ok,
    payBody("door", {
      payType: "hourly",
      fixed: "",
      hourly: "1000.01",
      commission: "",
    }).ok,
    payBody("host", {
      payType: "none",
      fixed: "",
      hourly: "",
      commission: "51",
    }).ok,
    payBody("host", {
      payType: "none",
      fixed: "",
      hourly: "",
      commission: "0.5",
    }).ok,
    payBody("host", {
      payType: "none",
      fixed: "",
      hourly: "",
      commission: "10.123",
    }).ok,
  ],
  [false, false, false, false, false],
  "limits: $10,000, $1,000 an hour, 1% to 50%, two decimals",
);
eq(
  payFormFrom(hourly),
  { payType: "hourly", fixed: "", hourly: "50", commission: "10" },
  "form from saved pay",
);

console.log("times");
eq(
  timeFields("security").map((f) => f.key),
  ["callAt", "startsAt", "endsAt"],
  "security: call time and shift",
);
eq(
  timeFields("entertainment").map((f) => f.key),
  ["loadInAt", "startsAt", "endsAt"],
  "entertainment: load in and set",
);
eq(
  timeFields("door").map((f) => f.key),
  ["startsAt", "endsAt"],
  "admissions: shift",
);
const s = {
  startsAt: "2026-11-08T02:30:00.000Z",
  endsAt: "2026-11-08T07:00:00.000Z",
  callAt: "2026-11-08T02:00:00.000Z",
  loadInAt: null,
  placeNote: null,
  hostNote: null,
};
eq(
  [
    timesLine("security", s, tz),
    timesLine("entertainment", s, tz),
    timesLine("door", s, tz),
    timesLine("door", null, tz),
  ],
  ["Call 9:00 PM", "Set 9:30 PM", "9:30 PM to 2:00 AM", ""],
  "row times in the event's zone",
);
eq(
  zonedInputs("2026-11-08T02:00:00.000Z", tz),
  { date: "2026-11-07", time: "21:00" },
  "inputs in the event's zone",
);
const empty = { date: "", time: "" };
let sb = scheduleBody(
  {
    startsAt: { date: "2026-11-07", time: "21:30" },
    endsAt: { date: "2026-11-08", time: "02:00" },
    callAt: { date: "2026-11-07", time: "21:00" },
    loadInAt: empty,
  },
  " Side door ",
  "",
  tz,
);
eq(
  sb,
  {
    ok: true,
    body: {
      startsAt: "2026-11-07T21:30:00-05:00",
      endsAt: "2026-11-08T02:00:00-05:00",
      callAt: "2026-11-07T21:00:00-05:00",
      loadInAt: null,
      placeNote: "Side door",
      hostNote: null,
    },
  },
  "the whole set, empty = cleared",
);
sb = scheduleBody(
  {
    startsAt: { date: "2026-11-07", time: "21:30" },
    endsAt: { date: "2026-11-07", time: "21:00" },
    callAt: empty,
    loadInAt: empty,
  },
  "",
  "",
  tz,
);
eq(
  sb,
  { ok: false, message: "The end has to be after the start." },
  "end after start",
);
eq(
  scheduleBody(
    {
      startsAt: { date: "2026-11-07", time: "" },
      endsAt: empty,
      callAt: empty,
      loadInAt: empty,
    },
    "",
    "",
    tz,
  ).ok,
  false,
  "a date without a time",
);

console.log("team list");
const rows = teamRows({
  standing: [
    {
      userId: "u1",
      firstName: "Tasha",
      username: "tasha",
      inviteId: "i1",
      status: "accepted",
      role: "host",
      roleLabel: null,
      schedule: null,
      pay: {
        ...hourly,
        payType: "none",
        hourlyRateCents: null,
        hours: null,
        hourlyCents: null,
      },
      cohostLevel: null,
    },
  ],
  event: [
    {
      userId: "u2",
      firstName: "Marcus",
      username: "marcus",
      inviteId: "i2",
      status: "accepted",
      role: "security",
      schedule: s,
      pay: fixed,
    },
    {
      userId: "u3",
      firstName: null,
      username: "nova",
      inviteId: "i3",
      status: "invited",
      role: "entertainment",
      schedule: null,
      pay: null,
    },
    {
      userId: "u4",
      firstName: "Kim",
      username: "kim",
      inviteId: "i4",
      status: "accepted",
      role: "other",
      roleLabel: "Coat check",
      pay: null,
    },
    {
      userId: "u5",
      firstName: "Ray",
      username: "ray",
      inviteId: "i5",
      status: "accepted",
      role: "cohost",
      cohostLevel: "edit",
      pay: null,
    },
    {
      userId: "u6",
      firstName: "Old",
      username: "old",
      inviteId: "i6",
      role: "door",
    }, // older response without status
    { userId: "u7", inviteId: "i7", role: "dj" }, // unknown role: dropped
  ],
});
eq(rows.length, 6, "unknown roles dropped");
eq(
  rows.find((r) => r.userId === "u6")?.status,
  "accepted",
  "missing status = on the team",
);
eq(
  sections(rows).map((x) => x.title),
  [
    "CO-HOST",
    "ADMISSIONS",
    "SECURITY",
    "PROMOTER",
    "ENTERTAINMENT",
    "COAT CHECK",
  ],
  "sections in order, Other by its name",
);
const marcus = rows.find((r) => r.userId === "u2") as TeamRow;
eq(
  rowLine(marcus, tz),
  "Call 9:00 PM · Fixed $160 · $50 for staying longer",
  "row line",
);
eq(
  rowLine(rows.find((r) => r.userId === "u1") as TeamRow, tz),
  "10% of link sales · All your events",
  "standing spot",
);
eq(
  rowLine(rows.find((r) => r.userId === "u5") as TeamRow, tz),
  "Team + edit",
  "co-host level",
);
eq(
  [
    inviteSentLine("Marcus", "security", null),
    inviteSentLine("Ray", "cohost", null),
    inviteSentLine("Kim", "other", "Coat check"),
  ],
  [
    "Invite sent. Marcus joins as Security once they accept.",
    "Invite sent. Ray can co-host once they accept.",
    "Invite sent. Kim joins as Coat check once they accept.",
  ],
  "invite sent copy",
);

console.log("taking someone off");
eq(
  [
    needsReason(marcus),
    needsReason(rows.find((r) => r.userId === "u3") as TeamRow),
    needsReason(rows.find((r) => r.userId === "u4") as TeamRow),
  ],
  [true, false, false],
  "a reason only for an accepted paid spot",
);
eq(
  removeQuery(marcus, null, ""),
  { ok: false, message: "Choose why you're taking them off." },
  "paid spot without a reason",
);
eq(
  removeQuery(marcus, "late", ""),
  { ok: true, query: "scope=event&role=security&reason=late" },
  "role and reason go along",
);
eq(
  removeQuery(marcus, "other", " "),
  { ok: false, message: "Say why in a few words." },
  "other needs a note",
);
eq(
  removeQuery(marcus, "other", "Left early"),
  { ok: true, query: "scope=event&role=security&reason=other&note=Left+early" },
  "other with a note",
);
eq(
  removeQuery(marcus, "late", "typed under Other first"),
  { ok: true, query: "scope=event&role=security&reason=late" },
  "a note only goes with Other (review M6)",
);
eq(
  earningLines({
    ...fixed,
    fixedCents: 990000,
    extraCents: 10000,
    extraCapped: true,
    extras: [
      { id: "a", minutes: 60, payKind: "fixed", cents: 20000, tbd: false },
    ],
  }),
  [
    { label: "Fixed", value: "$9,900" },
    { label: "Staying longer, up to the $10,000 for this role", value: "$100" },
  ],
  "extras cut at $10,000: what's actually paid (review M2)",
);
eq(
  earningLines({
    ...hourly,
    hours: 12,
    hourlyRateCents: 100000,
    hourlyCents: 1000000,
    hourlyCapped: true,
    commissionPercent: null,
  })[0],
  { label: "12 hours at $1,000, up to $10,000", value: "$10,000" },
  "hourly cut at $10,000 says so",
);
eq(
  removeQuery(rows.find((r) => r.userId === "u3") as TeamRow, null, ""),
  { ok: true, query: "scope=event&role=entertainment" },
  "an invite: no reason",
);
eq(
  [
    say(removeConfirm(marcus)),
    say(removeConfirm(rows.find((r) => r.userId === "u3") as TeamRow)),
    say(removeConfirm(rows.find((r) => r.userId === "u1") as TeamRow)),
  ],
  [
    "Take Marcus off this event's team?",
    "Cancel @nova's invite? They won't be able to accept it.",
    "Take Tasha off your Event team for all your events?",
  ],
  "confirm copy",
);

console.log("stay longer");
eq(
  [30, 60, 90, 120, 45].map(durationText),
  [
    "30 more minutes",
    "1 more hour",
    "1 more hour and 30 minutes",
    "2 more hours",
    "45 more minutes",
  ],
  "durations (backend wording)",
);
eq(
  stayPayChoices(true).map((c) => c.key),
  ["hourly", "none", "tbd"],
  "hourly: their rate first, never Fixed (call 43)",
);
eq(
  stayPayChoices(false).map((c) => c.key),
  ["fixed", "none", "tbd"],
  "others: Fixed, none, to be discussed",
);
eq(
  stayBody(60, null, "fixed", "50", tz),
  { ok: true, body: { pay: "fixed", minutes: 60, fixedCents: 5000 } },
  "1 hour, $50",
);
eq(
  stayBody(null, { date: "2026-11-08", time: "03:00" }, "tbd", "", tz),
  { ok: true, body: { pay: "tbd", endAt: "2026-11-08T03:00:00-05:00" } },
  "pick end time",
);
eq(
  [
    stayBody(60, null, "fixed", "1000.01", tz).ok,
    stayBody(null, { date: "", time: "" }, "none", "", tz).ok,
  ],
  [false, false],
  "over $1,000, no end time",
);
const req: StayRequest = {
  id: "r",
  role: "security",
  extraMinutes: 60,
  fromEndAt: "2026-11-08T07:00:00.000Z",
  newEndAt: "2026-11-08T08:00:00.000Z",
  payKind: "fixed",
  fixedCents: 5000,
  finalCents: null,
  status: "open",
  expiresAt: "2026-11-08T07:00:00.000Z",
  createdAt: "2026-11-08T05:00:00.000Z",
};
eq(say(stayLine(req, tz)), "Until 3:00 AM, $50.00 extra.", "screen 56 line");
eq(
  say(stayLine({ ...req, payKind: "hourly", fixedCents: null }, tz)),
  "Until 3:00 AM, paid at your hourly rate.",
  "hourly, member",
);
eq(
  say(stayLine({ ...req, payKind: "hourly", fixedCents: null }, tz, true)),
  "Until 3:00 AM, at their hourly rate.",
  "hourly, host",
);
eq(
  [
    say(stayStatus(req, tz)),
    stayStatus({ ...req, status: "accepted" }, tz),
    stayStatus({ ...req, status: "declined" }, tz),
    stayStatus({ ...req, status: "expired" }, tz),
  ],
  [
    "Waiting for an answer until 2:00 AM",
    "Accepted 1 more hour",
    "Said no",
    "Expired",
  ],
  "status",
);
eq(
  [
    amountWaiting({
      ...req,
      payKind: "tbd",
      fixedCents: null,
      status: "accepted",
    }),
    amountWaiting({
      ...req,
      payKind: "tbd",
      fixedCents: null,
      status: "accepted",
      finalCents: 0,
    }),
    amountWaiting(req),
  ],
  [true, false, false],
  "to be discussed waiting for an amount",
);
eq(
  say(
    acceptedEndLine(
      [
        { ...req, status: "accepted" },
        {
          ...req,
          id: "r2",
          status: "accepted",
          extraMinutes: 30,
          newEndAt: "2026-11-08T08:30:00.000Z",
        },
        {
          ...req,
          id: "r3",
          role: "door",
          status: "accepted",
          newEndAt: "2026-11-08T09:00:00.000Z",
        },
      ],
      "security",
      tz,
    ) ?? "",
  ),
  "Until 3:30 AM, you accepted 30 more minutes",
  "screen 51: the latest accepted, this role",
);
eq(acceptedEndLine([req], "security", tz), null, "nothing accepted yet");

console.log("messages");
eq(
  messageBody({ to: "role", role: "security" }, " Radio check at 9:15. "),
  {
    ok: true,
    body: { to: "role", role: "security", text: "Radio check at 9:15." },
  },
  "to a role",
);
eq(
  [
    messageBody({ to: "team" }, "  ").ok,
    messageBody({ to: "team" }, "x".repeat(1001)).ok,
    messageBody({ to: "team" }, "www.a www.b www.c www.d www.e www.f").ok,
  ],
  [false, false, false],
  "empty, too long, too many links",
);
eq(
  [
    audienceLine({ audience: "team", role: null, to: null, recipientCount: 5 }),
    audienceLine({
      audience: "role",
      role: "door",
      to: null,
      recipientCount: 1,
    }),
    audienceLine({
      audience: "person",
      role: null,
      to: { username: "marcus" },
      recipientCount: 1,
    }),
  ],
  ["Whole team · 5 people", "All Admissions · 1 person", "@marcus · 1 person"],
  "sent list lines",
);

console.log("team pay after the event");
const tp: TeamPayout = {
  amountCents: 21000,
  outcome: "not_covered",
  status: "host_to_pay",
  sentAt: null,
  hostPaidAt: null,
  confirmedAt: null,
  notYetAt: null,
};
eq(
  [
    say(payoutStatusLine(tp)),
    say(payoutStatusLine({ ...tp, outcome: "no_setup" })),
    say(payoutStatusLine({ ...tp, hostPaidAt: "2026-11-11T10:00:00Z" })),
    say(
      payoutStatusLine({
        ...tp,
        hostPaidAt: "2026-11-11T10:00:00Z",
        notYetAt: "2026-11-11T12:00:00Z",
      }),
    ),
    say(payoutStatusLine({ ...tp, hostPaidAt: "a", confirmedAt: "b" })),
    say(payoutStatusLine({ ...tp, status: "paid", outcome: "covered" })),
    say(payoutStatusLine({ ...tp, status: "pending", outcome: "covered" })),
  ],
  [
    "You pay them: ticket sales didn't cover the team",
    "You pay them: they didn't set up payouts in time",
    "You marked it paid, waiting for them",
    "They said not yet",
    "They confirmed they got it",
    "Sent by Outsyde",
    "Outsyde sends it",
  ],
  "host lines",
);
eq(
  [
    canAnswerPaid(tp),
    canAnswerPaid({ ...tp, hostPaidAt: "a" }),
    canAnswerPaid({ ...tp, hostPaidAt: "a", confirmedAt: "b" }),
  ],
  [false, true, false],
  "Got it / Not yet only after I paid them",
);
eq(
  say(myPayoutLine({ ...tp, hostPaidAt: "a" })),
  "The host says they paid you. Did you get it?",
  "member line",
);

console.log("invites and my events");
const inv = {
  host: { name: "Jordan Events" },
  scope: "event",
  role: "security",
  roleLabel: null,
  event: {
    title: "Summer Rooftop",
    startsAt: "2026-11-08T02:00:00.000Z",
    timezone: tz,
  },
  pay: fixed,
};
eq(
  [
    say(teamInviteHeadline(inv)),
    teamInviteHeadline({ ...inv, role: "cohost" }),
    teamInviteHeadline({ ...inv, role: "host" }),
    teamInviteHeadline({ ...inv, role: "other", roleLabel: "Coat check" }),
    teamInviteHeadline({ ...inv, role: "door" }),
  ],
  [
    "Jordan Events invited you to be Security",
    "Jordan Events invited you to co-host with them",
    "Jordan Events invited you to be a Promoter",
    "Jordan Events invited you to be Coat check",
    "Jordan Events invited you to be Admissions",
  ],
  "invite headlines",
);
eq(
  say(teamInviteLine(inv)),
  "Summer Rooftop, Sat, Nov 7 · Fixed $160 · $50 for staying longer",
  "invite line with pay",
);
eq(
  teamInviteLine({ ...inv, scope: "standing", event: null, pay: null }),
  "All of Jordan Events's events",
  "standing invite",
);
const te: TeamEvent = {
  id: "e",
  slug: "s",
  title: "T",
  startsAt: "a",
  endsAt: "b",
  timezone: tz,
  role: "event",
  canScan: true,
  ended: false,
  team: [
    { role: "security", roleLabel: null, scope: "event", inviteId: "1" },
    { role: "door", roleLabel: null, scope: "event", inviteId: "2" },
  ],
};
eq(
  [teamRolesLine(te), teamRolesLine({ ...te, role: "host", team: [] })],
  ["Security · Admissions", "Your event"],
  "roles line",
);
eq(
  [
    isCohosting(te),
    isCohosting({
      ...te,
      team: [
        { role: "cohost", roleLabel: null, scope: "event", inviteId: "3" },
      ],
    }),
    hasMemberPage(te),
    hasMemberPage({
      ...te,
      team: [
        { role: "cohost", roleLabel: null, scope: "event", inviteId: "3" },
      ],
    }),
  ],
  [false, true, true, true],
  "co-hosting rows open Manage too; every team row has its own page",
);
eq(
  hasMemberPage({ ...te, role: "host", team: [] }),
  false,
  "my own event: Manage only",
);
eq(
  [isTeamEvent(te), isTeamEvent({ ...te, team: undefined })],
  [true, false],
  "guard",
);

console.log("host earnings card");
eq(teamPayCard(null), null, "no team pay");
eq(
  teamPayCard({
    fixed: false,
    totalCents: 0,
    covered: true,
    teamPaidCents: 0,
    hostTakeHomeCents: 19600,
  }),
  null,
  "team pay $0: nothing shown",
);
eq(
  teamPayCard({
    fixed: false,
    totalCents: 58200,
    covered: true,
    teamPaidCents: 58200,
    hostTakeHomeCents: 137800,
  }),
  {
    team: "$582",
    note: "Will be taken from your payout. You take home $1,378.",
  },
  "covered, estimate",
);
eq(
  teamPayCard({
    fixed: true,
    totalCents: 58200,
    covered: true,
    teamPaidCents: 58200,
    hostTakeHomeCents: 137800,
  })?.note,
  "Taken from your payout. You take home $1,378.",
  "covered, worked out",
);
eq(
  say(
    teamPayCard({
      fixed: false,
      totalCents: 300000,
      covered: false,
      teamPaidCents: 0,
      hostTakeHomeCents: 196000,
    })?.note ?? "",
  ),
  "Ticket earnings don't cover the team, so Outsyde pays the team $0 and you keep your earnings. You pay them yourself.",
  "not covered (all or nothing)",
);

console.log("wording");
eq(
  all.filter((x) => DASH.test(x)),
  [],
  "no dashes anywhere",
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

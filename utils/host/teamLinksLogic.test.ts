/**
 * Unit tests for Event team invite links on goutsyde.com (p4-team step 9-0, backend #402). No server:
 *   npx tsx utils/host/teamLinksLogic.test.ts (port of goutsyde.com tests/team-links-logic.test.ts)
 *
 * Mutation checks (each must turn a test red):
 *  - let linkBody send pay for All my events → "no pay on an All my events link" fails.
 *  - let linkBody send pay from a co-host → "a co-host never sends pay" fails.
 *  - drop the digits clean in smsHref → "the number is cleaned" fails.
 *  - show the email on someone else's view → "a waiting link shows who it was emailed to" stays, but
 *    "the link page copy never names an email" fails.
 *  - linkPageView open for someone else's taken link → "taken by someone else: closed" fails.
 */
import {
  INVITE_WAYS,
  cleanCode,
  linkBody,
  smsHref,
  phoneError,
  linkShareText,
  linkPayLine,
  linkRowLine,
  linkPageView,
  isHostLink,
  isLinkPage,
  type HostLink,
  type LinkPage,
} from "./teamLinksLogic";
import type { PayForm } from "./teamLogic";

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
const all: string[] = [];
const say = (s: string) => {
  all.push(s);
  return s;
};
const tz = "America/New_York";
const noPay: PayForm = {
  payType: "none",
  fixed: "",
  hourly: "",
  commission: "",
};

console.log("ways to invite");
eq(
  INVITE_WAYS.map((w) => w.key),
  ["username", "email", "phone", "link"],
  "Username, Email, Phone, Link (call 66)",
);
eq(
  INVITE_WAYS.map((w) => w.label),
  ["Username", "Email", "Phone", "Link"],
  "labels",
);

console.log("the link to make");
const base = {
  role: "security" as const,
  label: "",
  scope: "event" as const,
  pay: noPay,
  payOn: false,
  asHost: true,
};
eq(
  linkBody({ ...base }),
  { ok: true, body: { scope: "event", role: "security" } },
  "a This event link with no pay",
);
eq(
  linkBody({
    ...base,
    payOn: true,
    pay: { payType: "fixed", fixed: "160", hourly: "", commission: "" },
  }),
  {
    ok: true,
    body: {
      scope: "event",
      role: "security",
      pay: { payType: "fixed", fixedCents: 16000 },
    },
  },
  "with fixed pay",
);
eq(
  linkBody({
    ...base,
    role: "host",
    payOn: true,
    pay: { payType: "none", fixed: "", hourly: "", commission: "10" },
  }),
  {
    ok: true,
    body: {
      scope: "event",
      role: "host",
      pay: { payType: "none", commissionPercent: 10 },
    },
  },
  "a Promoter with commission only",
);
eq(
  linkBody({
    ...base,
    scope: "standing",
    payOn: true,
    pay: { payType: "fixed", fixed: "160", hourly: "", commission: "" },
  }),
  { ok: true, body: { scope: "standing", role: "security" } },
  "no pay on an All my events link (set on each event)",
);
eq(
  linkBody({
    ...base,
    asHost: false,
    scope: "standing",
    payOn: true,
    pay: { payType: "fixed", fixed: "160", hourly: "", commission: "" },
  }),
  { ok: true, body: { scope: "event", role: "security" } },
  "a co-host never sends pay, and only This event",
);
eq(
  linkBody({
    ...base,
    role: "cohost",
    payOn: true,
    pay: { payType: "fixed", fixed: "160", hourly: "", commission: "" },
  }),
  { ok: true, body: { scope: "event", role: "cohost" } },
  "no pay for co-hosts",
);
eq(
  linkBody({
    ...base,
    payOn: true,
    pay: { payType: "fixed", fixed: "0", hourly: "", commission: "" },
  }),
  { ok: false, message: "Enter a fixed amount up to $10,000." },
  "pay is checked like the pay form",
);
eq(
  linkBody({ ...base, role: "other", label: "  Coat   check " }),
  {
    ok: true,
    body: { scope: "event", role: "other", roleLabel: "Coat check" },
  },
  "Other with its name",
);
eq(
  linkBody({ ...base, role: "other", label: "" }),
  { ok: false, message: "Type a name for this role." },
  "Other needs its name",
);
eq(
  linkBody({ ...base, email: " Jay@Example.com " }),
  {
    ok: true,
    body: { scope: "event", role: "security", email: "jay@example.com" },
  },
  "an email, cleaned",
);
eq(
  linkBody({ ...base, email: "jay@example" }),
  { ok: false, message: "Enter a full email address." },
  "a bad email",
);

console.log("text it from your phone");
eq(phoneError("(516) 555-0134"), null, "a US number with punctuation");
eq(phoneError("+44 20 7946 0958"), null, "an international number");
eq(
  phoneError("555-01"),
  "Enter a phone number with at least 10 digits.",
  "too short",
);
eq(
  smsHref("(516) 555-0134", "Hi there https://goutsyde.com/team/K7Q2M9ABCDEF"),
  "sms:5165550134?&body=Hi%20there%20https%3A%2F%2Fgoutsyde.com%2Fteam%2FK7Q2M9ABCDEF",
  "the number is cleaned and the text is encoded",
);
eq(
  smsHref("+44 20 7946 0958", "x"),
  "sms:+442079460958?&body=x",
  "a leading + stays",
);
const share = say(
  linkShareText({
    hostName: "Jordan Events",
    role: "security",
    roleLabel: null,
    eventTitle: "Summer Rooftop",
    scope: "event",
    url: "https://goutsyde.com/team/K7Q2M9ABCDEF",
  }),
);
eq(
  share,
  "Jordan Events invited you to be Security for Summer Rooftop on Outsyde. Tap to accept: https://goutsyde.com/team/K7Q2M9ABCDEF",
  "the text to send",
);
eq(
  say(
    linkShareText({
      hostName: "Jordan Events",
      role: "cohost",
      roleLabel: null,
      eventTitle: "Summer Rooftop",
      scope: "standing",
      url: "U",
    }),
  ),
  "Jordan Events invited you to co-host their events on Outsyde. Tap to accept: U",
  "co-host, all events",
);
eq(
  say(
    linkShareText({
      hostName: "Jordan Events",
      role: "host",
      roleLabel: null,
      eventTitle: "Summer Rooftop",
      scope: "event",
      url: "U",
    }),
  ),
  "Jordan Events invited you to be a Promoter for Summer Rooftop on Outsyde. Tap to accept: U",
  "promoter",
);

console.log("pay on a link");
eq(linkPayLine(null), "", "no pay set");
eq(
  linkPayLine({
    payType: "fixed",
    fixedCents: 16000,
    hourlyCents: null,
    commissionPercent: null,
  }),
  "Fixed $160",
  "fixed",
);
eq(
  linkPayLine({
    payType: "hourly",
    fixedCents: null,
    hourlyCents: 2050,
    commissionPercent: 10,
  }),
  "$20.50 an hour · 10% of link sales",
  "hourly and commission",
);
eq(
  linkPayLine({
    payType: "none",
    fixedCents: null,
    hourlyCents: null,
    commissionPercent: null,
  }),
  "No pay",
  "none",
);

console.log("waiting links (host)");
const hl = (o: Partial<HostLink> = {}): HostLink => ({
  id: "l1",
  code: "K7Q2M9ABCDEF",
  url: "https://goutsyde.com/team/K7Q2M9ABCDEF",
  scope: "event",
  role: "security",
  roleLabel: null,
  cohostLevel: null,
  pay: null,
  sentToEmail: null,
  emailSentAt: null,
  status: "open",
  expiresAt: "2026-11-08T07:00:00.000Z",
  createdAt: "2026-10-31T18:58:00.000Z",
  ...o,
});
eq(isHostLink(hl()), true, "a host link");
eq(isHostLink({ id: "x" }), false, "not a host link");
eq(
  say(linkRowLine(hl(), tz)),
  "Security · Link · Ends Sun, Nov 8",
  "a plain link",
);
eq(
  say(
    linkRowLine(
      hl({
        sentToEmail: "jay@example.com",
        emailSentAt: "2026-10-31T18:58:00.000Z",
        pay: {
          payType: "fixed",
          fixedCents: 16000,
          hourlyCents: null,
          commissionPercent: null,
        },
      }),
      tz,
    ),
  ),
  "Security · Fixed $160 · Emailed to jay@example.com · Ends Sun, Nov 8",
  "a waiting link shows who it was emailed to",
);
eq(
  say(
    linkRowLine(hl({ sentToEmail: "jay@example.com", emailSentAt: null }), tz),
  ),
  "Security · Not emailed (limit for today), share the link · Ends Sun, Nov 8",
  "an email that wasn't sent says so",
);
eq(
  say(
    linkRowLine(
      hl({ scope: "standing", role: "other", roleLabel: "Coat check" }),
      tz,
    ),
  ),
  "Coat check · All your events · Link · Ends Sun, Nov 8",
  "All my events",
);

console.log("the link page");
const lp = (o: Partial<LinkPage> = {}): LinkPage => ({
  status: "open",
  scope: "event",
  role: "security",
  roleLabel: null,
  cohostLevel: null,
  host: { name: "Jordan Events" },
  event: {
    id: "e1",
    title: "Summer Rooftop",
    startsAt: "2026-11-08T02:00:00.000Z",
    endsAt: "2026-11-08T07:00:00.000Z",
    timezone: tz,
  },
  upcoming: [],
  pay: {
    payType: "fixed",
    fixedCents: 16000,
    hourlyCents: null,
    commissionPercent: null,
  },
  expiresAt: "2026-11-08T07:00:00.000Z",
  yours: false,
  isHost: false,
  ...o,
});
eq(isLinkPage(lp()), true, "a link page");
eq(isLinkPage({ status: "open" }), false, "not a link page");
const v1 = linkPageView(lp());
eq(v1.state, "open", "open");
eq(say(v1.headline), "Jordan Events invited you to be Security", "headline");
eq(say(v1.what), "Summer Rooftop, Sat, Nov 7", "the event");
eq(
  v1.payLines.map((l) => say(`${l.label} ${l.value}`)),
  ["Fixed $160"],
  "pay lines",
);
eq(
  say(v1.payNote ?? ""),
  "Paid 3 days after the event due to processing, once you set up payouts.",
  "the pay line copy",
);
eq(v1.canAccept, true, "they can accept");
const v2 = linkPageView(lp({ status: "accepted", yours: true }));
eq(
  [v2.state, say(v2.headline), v2.canAccept, v2.next?.href],
  ["yours", "You're on the team", false, "/events/e1/my-team"],
  "theirs: links to their event page",
);
const v2s = linkPageView(
  lp({ status: "accepted", yours: true, scope: "standing", event: null }),
);
eq(
  v2s.next?.href,
  "/events/door",
  "theirs, All my events: the Event team page",
);
const v3 = linkPageView(lp({ status: "accepted", event: null, pay: null }));
eq(
  [v3.state, say(v3.headline), say(v3.body), v3.canAccept],
  [
    "closed",
    "This invite was already used",
    "Someone already accepted it. Ask the host for a new link.",
    false,
  ],
  "taken by someone else: closed",
);
eq(
  say(linkPageView(lp({ status: "expired", event: null, pay: null })).headline),
  "This invite has ended",
  "expired",
);
eq(
  say(
    linkPageView(lp({ status: "cancelled", event: null, pay: null })).headline,
  ),
  "This invite was cancelled",
  "cancelled",
);
const v4 = linkPageView(lp({ isHost: true }));
eq(
  [v4.state, say(v4.body), v4.canAccept],
  [
    "host",
    "This is your invite link. Share it with the person you're inviting.",
    false,
  ],
  "the host sees it's theirs",
);
const v5 = linkPageView(
  lp({
    scope: "standing",
    event: null,
    pay: null,
    upcoming: [
      {
        id: "a",
        title: "Halloween Bash",
        startsAt: "2026-11-01T01:00:00.000Z",
        timezone: tz,
      },
    ],
  }),
);
eq(
  [say(v5.what), v5.payLines.length, v5.payNote],
  ["All of Jordan Events' events", 0, null],
  "All my events: no pay, the host's events",
);
eq(
  say(linkPageView(lp({ role: "cohost", pay: null })).headline),
  "Jordan Events invited you to co-host with them",
  "co-host headline",
);
eq(
  JSON.stringify(linkPageView(lp())).includes("@"),
  false,
  "the link page copy never names an email",
);

console.log("typed codes");
eq(cleanCode(" k7q2m9abcdef "), "K7Q2M9ABCDEF", "cleaned");
eq(cleanCode("K7Q2M9ABCDE0"), null, "a 0 is never in a code");
eq(cleanCode("../etc"), null, "not a code");

console.log("wording");
eq(
  all.filter((x) => DASH.test(x)),
  [],
  "no dashes anywhere",
);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

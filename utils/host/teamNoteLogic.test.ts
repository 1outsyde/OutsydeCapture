/**
 * Unit tests for the Event Team note in the app (p4-team step 9d-3, calls 79 to 88, backend #403). Same tests as
 * goutsyde.com tests/team-note-logic.test.ts (the rules are ported; keep the two in sync). No server:
 *   npx tsx utils/host/teamNoteLogic.test.ts
 *
 * Mutation checks (each must turn a test red):
 *  - show the note on a spot without pay → "no pay: no note on accept" fails.
 *  - keep showing it after it was accepted → "accepted: never shown again" fails.
 *  - show "Set up payouts" when only the note is missing → "only the note missing: no Set up link" fails.
 *  - hide the note on their page while the switch is off (follow noteNeeded) → "shown on their page even while the
 *    backend doesn't ask yet (call 85)" fails.
 */
import {
  acceptLabel,
  isTeamNote,
  noteDueLine,
  noteOnAccept,
  noteOnMyPage,
  payNotWorkedOut,
  payOffered,
  setupLinkShown,
  NOTE_SAVE_FAILED,
  NOTE_SAVE_FAILED_HERE,
  type TeamNote,
} from "./teamNoteLogic";

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

const note = (accepted = false): TeamNote => ({
  version: "2026-11-01",
  title: "Event Team note",
  intro: "Read and accept to be paid through Outsyde.",
  points: ["a", "b", "c", "d", "e", "f"],
  accepted,
  acceptedAt: accepted ? "2026-11-01T01:00:00.000Z" : null,
});
const fixed = {
  payType: "fixed",
  fixedCents: 16000,
  hourlyRateCents: null,
  hours: null,
  hourlyCents: null,
  commissionPercent: null,
  commissionCents: null,
  earnedCents: 16000,
  needsShift: false,
};
const none = { ...fixed, payType: "none", fixedCents: null, earnedCents: 0 };
const commission = { ...none, commissionPercent: 10 };
const linkFixed = {
  payType: "fixed",
  fixedCents: 16000,
  hourlyCents: null,
  commissionPercent: null,
};
const linkNone = {
  payType: "none",
  fixedCents: null,
  hourlyCents: null,
  commissionPercent: null,
};

console.log("the note from the backend");
eq(isTeamNote(note()), true, "a note");
eq(isTeamNote({ ...note(), points: "x" }), false, "points must be a list");
eq(isTeamNote({ ...note(), version: 3 }), false, "version must be text");
eq(isTeamNote(null), false, "nothing");

console.log("pay offered");
eq(payOffered(fixed), true, "fixed pay (invite)");
eq(payOffered(commission), true, "commission only");
eq(payOffered(none), false, "No pay");
eq(payOffered(linkFixed), true, "fixed pay (link)");
eq(payOffered(linkNone), false, "link with No pay");
eq(payOffered(null), false, "no pay at all");
eq(payOffered({ payType: "bogus" }), false, "something that isn't pay");

console.log("on accept (calls 79, 84)");
eq(noteOnAccept(fixed, note()), true, "paid spot, not accepted: shown");
eq(noteOnAccept(none, note()), false, "no pay: no note on accept");
eq(noteOnAccept(fixed, note(true)), false, "accepted: never shown again");
eq(
  noteOnAccept(fixed, null),
  false,
  "note didn't load: joining still works, no card",
);
eq(acceptLabel(true), "Accept and join", "one button for both");
eq(acceptLabel(false), "Accept", "otherwise the usual Accept");

console.log("their event page (calls 79, 85)");
eq(
  noteOnMyPage({ hasPay: true, paidOut: false }, note()),
  true,
  "shown on their page even while the backend doesn't ask yet (call 85)",
);
eq(
  noteOnMyPage({ hasPay: false, paidOut: false }, note()),
  false,
  "no pay: not shown",
);
eq(
  noteOnMyPage({ hasPay: true, paidOut: true }, note()),
  false,
  "pay already worked out: not shown",
);
eq(
  noteOnMyPage({ hasPay: true, paidOut: false }, note(true)),
  false,
  "accepted: not shown",
);
eq(
  noteOnMyPage({ hasPay: true, paidOut: false }, null),
  false,
  "note didn't load: not shown",
);

console.log("pay not worked out yet (the backend's rule)");
eq(
  payNotWorkedOut({
    payoutSetup: { needed: false, deadline: null },
    payout: null,
  }),
  true,
  "payoutSetup sent: pay waiting",
);
eq(
  payNotWorkedOut({ payoutSetup: null, payout: null }),
  false,
  "no payoutSetup (no pay, or fixed): no card",
);
eq(
  payNotWorkedOut({
    payoutSetup: { needed: true, deadline: null },
    payout: { amountCents: 1 },
  }),
  false,
  "a payout exists: no card",
);

console.log("the note couldn't load while it's due");
const when = () => "Tue, Nov 10";
eq(
  noteDueLine(
    { noteNeeded: true, deadline: "2026-11-10T00:00:00Z" },
    false,
    when,
  ),
  "Accept the Event Team note by Tue, Nov 10 to get paid.",
  "says what is due and by when",
);
eq(
  noteDueLine(
    { noteNeeded: true, deadline: "2026-11-10T00:00:00Z" },
    true,
    when,
  ),
  null,
  "the card is there: no extra line",
);
eq(
  noteDueLine({ noteNeeded: false, deadline: null }, false, when),
  null,
  "not due: nothing",
);
eq(noteDueLine(null, false, when), null, "no info: nothing");

console.log("the Set up payouts link");
eq(
  setupLinkShown({ needed: true, deadline: null }),
  true,
  "older backend (no detail): as before",
);
eq(
  setupLinkShown({
    needed: true,
    deadline: null,
    stripeNeeded: true,
    noteNeeded: false,
  }),
  true,
  "payouts missing: shown",
);
eq(
  setupLinkShown({
    needed: true,
    deadline: null,
    stripeNeeded: false,
    noteNeeded: true,
  }),
  false,
  "only the note missing: no Set up link",
);
eq(
  setupLinkShown({
    needed: false,
    deadline: null,
    stripeNeeded: false,
    noteNeeded: false,
  }),
  false,
  "nothing missing",
);
eq(setupLinkShown(null), false, "no setup info");

console.log("copy");
eq(
  DASH.test(NOTE_SAVE_FAILED) || DASH.test(NOTE_SAVE_FAILED_HERE),
  false,
  "no dashes",
);
eq(
  /below/.test(NOTE_SAVE_FAILED_HERE) &&
    !/event page/.test(NOTE_SAVE_FAILED_HERE),
  true,
  "on the link page it points below, where the card is",
);
eq(
  /event page/i.test(NOTE_SAVE_FAILED) && /on the team/i.test(NOTE_SAVE_FAILED),
  true,
  "says they joined and where the note waits",
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/** Unit tests for the door helpers (team invites, invite screen, scanner). Ported from goutsyde.com tests/events-door-logic.test.ts + events-scan-logic. npx tsx utils/host/doorLogic.test.ts */
import {
  memberStatus, memberStatusLine, memberAction, cancelInviteCopy, removeConfirmCopy, inviteSentCopy, cleanUsername, isTeamMember,
  isDoorEvent, isDoorInvite, roleLabel, scanWindowNote, timeOnly, inviteScreenCopy, doorNoticeTarget, teamCountLabel,
  qrToCode, cleanTyped, makeRecent, resultFor, invalidCodeResult, undoneResult, lastScanLabel, filterGuests, replaceGuest, progressPct,
  type TeamMember, type DoorInvite,
} from "./doorLogic";
import { ticketPushTarget } from "../ticketCheckoutLogic";
import type { DoorGuest } from "./manageLogic";

let passed = 0, failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.error(`  FAIL ${name}`, JSON.stringify(actual), "expected", JSON.stringify(expected)); }
}
const tz = "America/New_York";

// ---------- team (canvas 38) ----------
const mem = (o: Partial<TeamMember>): TeamMember => ({ userId: "u", firstName: "Marcus", username: "marcus", addedAt: null, ...o });
eq([memberStatus(mem({})), memberStatus(mem({ status: "invited" })), memberStatus(mem({ status: "declined" })), memberStatus(mem({ status: "bogus" as any }))],
  ["accepted", "invited", "declined", "accepted"], "member status, missing or unknown = on the team");
eq(memberStatusLine(mem({ status: "accepted" }), "standing"), "@marcus · On the team", "standing on the team");
eq(memberStatusLine(mem({ status: "accepted" }), "event"), "@marcus · On the team until the event ends", "event on the team");
eq(memberStatusLine(mem({ status: "invited" }), "event"), "@marcus · Invited, waiting for them to accept", "invited");
eq(memberStatusLine(mem({ status: "declined" }), "standing"), "@marcus · Said no. You can invite them again.", "declined");
eq(memberStatusLine(mem({ status: "invited", firstName: null }), "event"), "Invited, waiting for them to accept", "no handle twice");
eq([memberAction(mem({})), memberAction(mem({ status: "invited" })), memberAction(mem({ status: "declined" }))], ["Remove", "Cancel invite", "Invite again"], "row actions");
eq(cancelInviteCopy(mem({})), "Cancel Marcus's invite? They won't be able to accept it.", "cancel invite copy");
eq(removeConfirmCopy(mem({}), "standing"), "Remove Marcus from your door team? They stop being able to scan all your events.", "remove standing copy");
eq(removeConfirmCopy(mem({ firstName: null }), "event"), "Remove @marcus from this event's door team? They stop being able to scan this event.", "remove event copy");
eq(inviteSentCopy(mem({})), "Invite sent. Marcus can scan once they accept.", "invite sent copy");
eq([cleanUsername("  @marcus "), cleanUsername("marcus")], ["marcus", "marcus"], "username cleanup");
eq([isTeamMember(mem({})), isTeamMember({ firstName: "x" })], [true, false], "team member guard");
eq([teamCountLabel(0), teamCountLabel(2)], ["Door team", "Door team (2)"], "door team button label (canvas 37)");

// ---------- door events (/door/mine) ----------
eq(isDoorEvent({ id: "e", slug: "s", title: "T", startsAt: "a", endsAt: "b", timezone: tz, role: "standing" }), true, "door event guard");
eq(isDoorEvent({ id: "e", title: "T", startsAt: "a", endsAt: "b", timezone: tz, role: "admin" }), false, "unknown role rejected");
eq([roleLabel("host"), roleLabel("standing"), roleLabel("event")], ["Your event", "Door team", "Door team, this event"], "role labels");
eq(timeOnly("2026-10-25T01:42:00.000Z", tz), "9:42 PM", "time in the event zone");
const ev = { startsAt: "2026-10-25T01:00:00.000Z", endsAt: "2026-10-25T06:00:00.000Z", timezone: tz };
eq(scanWindowNote(ev, new Date("2026-10-24T18:59:59.000Z")), "Check in opens Sat, Oct 24 at 3:00 PM, 6 hours before the start.", "before the window");
eq(scanWindowNote(ev, new Date("2026-10-24T19:00:00.000Z")), null, "opens exactly 6 hours before");
eq(scanWindowNote(ev, new Date("2026-10-25T06:00:00.001Z")), "Check in has closed for this event.", "closed after the end");
eq(scanWindowNote({ ...ev, status: "cancelled" }, new Date("2026-10-24T20:00:00.000Z")), "Check in is closed for this event.", "cancelled is closed");

// ---------- invite screen (canvas 39) ----------
const inv = (o: Partial<DoorInvite>): DoorInvite => ({
  id: "i1", scope: "standing", role: "door", status: "invited", invitedAt: null, host: { name: "Club Nine" }, event: null,
  upcoming: [{ id: "e1", title: "Late Night", startsAt: "2026-11-01T01:00:00.000Z", timezone: tz }, { id: "e2", title: "Brunch", startsAt: "2026-11-07T15:00:00.000Z", timezone: tz }],
  ...o,
});
const evInv = inv({ scope: "event", event: { id: "e1", title: "Late Night", startsAt: "2026-11-01T01:00:00.000Z", endsAt: "2026-11-01T06:00:00.000Z", timezone: tz }, upcoming: [] });
eq(isDoorInvite(inv({})), true, "invite guard (standing)");
eq(isDoorInvite(evInv), true, "invite guard (event)");
eq(isDoorInvite({ ...inv({}), status: "maybe" }), false, "unknown status rejected");
eq(isDoorInvite({ ...inv({}), host: null }), false, "needs a host");
let c = inviteScreenCopy(inv({}));
eq([c.state, c.headline, c.body, c.scopeLabel], ["invited", "Club Nine invited you to their door team", "Scan tickets at the door for all of their events. You can leave the team any time.", "ALL OF CLUB NINE'S EVENTS"], "standing invited copy");
eq(c.events, [{ id: "e1", title: "Late Night", when: "Sat, Oct 31" }, { id: "e2", title: "Brunch", when: "Sat, Nov 7" }], "standing invite lists upcoming events in their zones");
c = inviteScreenCopy(evInv);
eq([c.headline, c.body, c.scopeLabel, c.events.length], ["Club Nine invited you to their door team", "Scan tickets at the door for this event. You can leave the team any time.", "ONLY THIS EVENT", 1], "event invited copy");
c = inviteScreenCopy(inv({ status: "accepted" }));
eq([c.state, c.headline, c.body], ["accepted", "You're on the door team", "You can scan tickets for Club Nine's events. The scanner opens 6 hours before each event starts."], "standing accepted copy");
c = inviteScreenCopy({ ...evInv, status: "accepted" });
eq(c.body, "You can scan tickets for Late Night. The scanner opens 6 hours before it starts.", "event accepted copy");
c = inviteScreenCopy(inv({ status: "declined" }));
eq([c.state, c.headline, c.body], ["declined", "Invite declined", "Club Nine can see you said no. They can invite you again later."], "declined copy");
c = inviteScreenCopy(inv({ status: "gone" }));
eq([c.state, c.headline, c.body, c.scopeLabel, c.events.length], ["gone", "This invite is no longer open", "The host cancelled it, or the event is over.", "NO LONGER AVAILABLE", 0], "gone copy");
for (const s of ["invited", "accepted", "declined", "gone"] as const) {
  const t = inviteScreenCopy(inv({ status: s }));
  eq(/[–—]| - /.test(t.headline + t.body), false, `no dashes (${s})`);
}

// ---------- push and Activity targets ----------
eq(ticketPushTarget({ type: "door_team_invite", inviteId: "i1" }), { screen: "doorInvite", eventId: null, inviteId: "i1" }, "invite push opens the invite");
eq(ticketPushTarget({ type: "door_team_invite" }), { screen: "doorEvents", eventId: null }, "invite push without an id opens Door check in");
eq(ticketPushTarget({ type: "door_team_accepted", eventId: "e9" }), { screen: "doorTeam", eventId: "e9" }, "accept push opens that event's door team");
eq(ticketPushTarget({ type: "door_team_accepted", eventId: null }), { screen: "yourEvents", eventId: null }, "standing accept push opens Your events");
eq(ticketPushTarget({ type: "door_team_added", eventId: "e1" }), null, "the old door_team_added push type is ignored");
eq(ticketPushTarget({ type: "address_reveal", eventId: "e1" }), { screen: "tickets", eventId: "e1" }, "address reveal unchanged");
eq(doorNoticeTarget({ type: "door_team_invite", referenceId: "i2", metadata: { inviteId: "i2" } }), { inviteId: "i2" }, "Activity item opens the invite");
eq(doorNoticeTarget({ type: "door_team_invite", referenceId: "i3", metadata: null }), { inviteId: "i3" }, "falls back to referenceId");
eq(doorNoticeTarget({ type: "new_follower", referenceId: "x", metadata: {} }), null, "other Activity types are not door items");

// ---------- scanner (canvas 14 and 15) ----------
eq([qrToCode(" abcd1234efgh5678 "), qrToCode("hello"), qrToCode(42)], ["ABCD1234EFGH5678", null, null], "QR text to code");
eq(cleanTyped("ab-cd 12!34efgh5678ZZ"), "ABCD1234EFGH5678", "typed code cleanup, max 16");
const rec = makeRecent(3000);
eq([rec.allow("A", 0), rec.allow("A", 2999), rec.allow("A", 3000), rec.allow("B", 3001)], [true, false, true, true], "same code ignored for 3 seconds");
const g = (o: Partial<DoorGuest>): DoorGuest => ({ ticketId: "t1", firstName: "Gwen", username: "gwen", ticketTypeName: "General", checkedInAt: null, checkedInBy: null, ...o });
let r = resultFor(200, { success: true, result: "checked_in", ticket: g({ checkedInAt: "2026-10-25T01:42:00.000Z" }) }, tz);
eq([r.outcome, r.tone, r.title, r.who, r.detail], ["CHECKED_IN", "ok", "Checked in", "Gwen · General", "Let them in."], "checked in");
r = resultFor(409, { success: false, error: { code: "ALREADY_CHECKED_IN", message: "Already checked in." }, ticket: g({ checkedInAt: "2026-10-25T01:42:00.000Z", checkedInBy: "Marcus" }) }, tz);
eq([r.outcome, r.tone, r.title, r.detail], ["ALREADY_CHECKED_IN", "warn", "Already checked in", "This ticket was scanned at 9:42 PM by Marcus."], "already in, with time and scanner");
r = resultFor(409, { success: false, error: { code: "WRONG_EVENT", message: "This ticket is for Other." }, otherEvent: { id: "o", title: "Other Night" } }, tz);
eq([r.tone, r.title, r.who], ["bad", "Not for this event", "Ticket for Other Night"], "wrong event");
r = resultFor(409, { success: false, error: { code: "NOT_VALID", message: "This ticket is not valid. It was refunded or cancelled." } }, tz);
eq([r.title, r.detail], ["Not valid", "This ticket is not valid. It was refunded or cancelled. Do not let it in."], "refunded");
r = resultFor(409, { success: false, error: { code: "NOT_PAID", message: "This ticket isn't paid for yet." } }, tz);
eq(r.title, "Not paid", "not paid");
r = resultFor(404, { success: false, error: { code: "EVENT_NOT_FOUND", message: "Event not found." } }, tz);
eq([r.title, r.detail], ["No access", "You can't scan for this event anymore. Ask the host to invite you again."], "lost access");
r = resultFor(0, null, tz);
eq([r.outcome, r.title], ["NETWORK", "No connection"], "network");
r = resultFor(500, { success: false, error: { code: "SERVER_ERROR", message: "boom" } }, tz);
eq([r.title, r.detail], ["Couldn't check in", "Something went wrong. Try again."], "server error never shows the raw message");
eq(invalidCodeResult().title, "Invalid code", "invalid code card");
eq(undoneResult(g({})).title, "Check in undone", "undone card");
eq([lastScanLabel(resultFor(200, { success: true, ticket: g({}) }, tz)), lastScanLabel(undoneResult(g({})))], ["In", "Undone"], "last scan labels");
const list = [g({}), g({ ticketId: "t2", firstName: "Kai", username: "kai", ticketTypeName: "VIP" })];
eq(filterGuests(list, "@ka").map((x) => x.ticketId), ["t2"], "search by @username");
eq(filterGuests(list, "vip").map((x) => x.ticketId), ["t2"], "search by ticket type");
eq(replaceGuest(list, g({ checkedInAt: "x" }))[0].checkedInAt, "x", "replace a guest");
eq([progressPct(48, 200), progressPct(0, 0), progressPct(5, 2)], [24, 0, 100], "progress bar width");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

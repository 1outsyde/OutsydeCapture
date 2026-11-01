/**
 * p4-team step 9c-2: where every Event team, host and ticket push and Activity item opens (calls 60, 61, 73, 77, 78).
 * Push data shapes from outsyde-backend b3aea22 (ticketNotices.ts, teamSend.ts, teamExtensions.ts, eventReminders.ts,
 * teamMessages.ts, eventPayouts.ts). npx tsx utils/teamPushRoutes.test.ts
 *
 * Mutation checks (each must turn a test red):
 *  - send co-host reminders to their event page → "a co-host's reminder opens Manage (call 77)" fails.
 *  - send team_removed to their event page → "taken off: Event team" fails.
 *  - drop the team_message Activity route → "team_message Activity opens their event (call 73)" fails.
 *  - let Activity skip the push router → "Activity opens what the push opens (call 78)" fails.
 *  - send member pay pushes to the host team screen → "member pay pushes open their event" fails.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { activityTarget, ticketPushTarget } from "./ticketCheckoutLogic";

const my = (eventId: string) => ({ screen: "myTeam", eventId });
const MEMBER_TYPES = [
  "team_stay_longer",
  "team_time_changed",
  "team_pay_changed",
  "team_payout_setup",
  "team_pay_held",
  "team_pay_sent",
  "team_pay_to_host",
  "team_pay_marked_paid",
];
const HOST_TEAM_TYPES = [
  "team_stay_longer_answer",
  "team_stay_longer_expired",
  "team_stay_longer_amount",
  "team_pay_confirmed",
  "team_pay_not_received",
];

test("invites for every role open the invite", () => {
  assert.deepEqual(ticketPushTarget({ type: "team_invite", inviteId: "i1" }), {
    screen: "doorInvite",
    eventId: null,
    inviteId: "i1",
  });
  assert.deepEqual(ticketPushTarget({ type: "team_invite" }), {
    screen: "doorEvents",
    eventId: null,
  });
  // Admissions unchanged.
  assert.deepEqual(
    ticketPushTarget({ type: "door_team_invite", inviteId: "i2" }),
    { screen: "doorInvite", eventId: null, inviteId: "i2" },
  );
});

test("joined opens the host's Event team, or Your events for all events", () => {
  assert.deepEqual(ticketPushTarget({ type: "team_accepted", eventId: "e1" }), {
    screen: "doorTeam",
    eventId: "e1",
  });
  assert.deepEqual(ticketPushTarget({ type: "team_accepted", eventId: null }), {
    screen: "yourEvents",
    eventId: null,
  });
});

test("member pay pushes open their event", () => {
  for (const type of MEMBER_TYPES) {
    assert.deepEqual(
      ticketPushTarget({ type, eventId: "e1", amountCents: 100 } as never),
      my("e1"),
      type,
    );
    assert.deepEqual(
      ticketPushTarget({ type }),
      { screen: "doorEvents", eventId: null },
      `${type} without an event`,
    );
  }
});

test("taken off: Event team", () => {
  assert.deepEqual(
    ticketPushTarget({ type: "team_removed", inviteId: "i1", eventId: "e1" }),
    { screen: "doorEvents", eventId: null },
  );
});

test("host answers and pay confirmations open the host's Event team", () => {
  for (const type of HOST_TEAM_TYPES) {
    assert.deepEqual(
      ticketPushTarget({ type, eventId: "e1" }),
      { screen: "doorTeam", eventId: "e1" },
      type,
    );
    assert.deepEqual(
      ticketPushTarget({ type }),
      { screen: "yourEvents", eventId: null },
      `${type} without an event`,
    );
  }
});

test("reminders: guests, host, team, co-hosts", () => {
  for (const kind of ["day_before", "soon", "week", "start"]) {
    assert.deepEqual(
      ticketPushTarget({ type: "event_reminder", kind, eventId: "e1" }),
      { screen: "ticket", eventId: "e1" },
      kind,
    );
  }
  for (const kind of [
    "host_day_before",
    "host_week",
    "host_soon",
    "host_start",
  ]) {
    assert.deepEqual(
      ticketPushTarget({ type: "event_reminder", kind, eventId: "e1" }),
      { screen: "manage", eventId: "e1" },
      kind,
    );
  }
  for (const kind of [
    "team_week",
    "team_day_before",
    "team_soon",
    "team_start",
  ]) {
    assert.deepEqual(
      ticketPushTarget({
        type: "event_reminder",
        kind,
        eventId: "e1",
        role: "security",
      } as never),
      my("e1"),
      kind,
    );
    assert.deepEqual(
      ticketPushTarget({ type: "event_reminder", kind, eventId: "e1" }),
      my("e1"),
      `${kind} without a role`,
    );
    assert.deepEqual(
      ticketPushTarget({ type: "event_reminder", kind }),
      { screen: "doorEvents", eventId: null },
      `${kind} without an event`,
    );
  }
});

test("a co-host's reminder opens Manage (call 77)", () => {
  assert.deepEqual(
    ticketPushTarget({
      type: "event_reminder",
      kind: "team_day_before",
      eventId: "e1",
      role: "cohost",
    } as never),
    { screen: "manage", eventId: "e1" },
  );
});

test("host money pushes (call 61)", () => {
  assert.deepEqual(
    ticketPushTarget({
      type: "ticket_sold",
      eventId: "e1",
      orderId: "o1",
    } as never),
    { screen: "manage", eventId: "e1" },
  );
  assert.deepEqual(
    ticketPushTarget({
      type: "event_payout_sent",
      eventId: "e1",
      payoutId: "p1",
    } as never),
    { screen: "manage", eventId: "e1" },
  );
  assert.deepEqual(ticketPushTarget({ type: "ticket_sold" }), {
    screen: "yourEvents",
    eventId: null,
  });
  assert.deepEqual(
    ticketPushTarget({ type: "event_payout_owed", amountCents: 500 } as never),
    { screen: "yourEvents", eventId: null },
  );
});

test("other push types stay with their own hooks", () => {
  for (const type of [
    "new_message",
    "booking_request",
    "announcement",
    "plan_offer",
    "referral_reward",
    "subscription_paused",
    "team_message",
  ]) {
    assert.equal(ticketPushTarget({ type }), null, type);
  }
});

test("team_message Activity opens their event (call 73)", () => {
  assert.deepEqual(
    activityTarget({
      type: "team_message",
      metadata: {
        eventId: "e1",
        conversationId: "c1",
        referenceType: "event",
        referenceId: "e1",
      },
    }),
    my("e1"),
  );
  assert.deepEqual(
    activityTarget({ type: "team_message", metadata: { referenceId: "e2" } }),
    my("e2"),
  );
  assert.equal(activityTarget({ type: "team_message", metadata: {} }), null);
});

test("Activity opens what the push opens (call 78)", () => {
  // A server row: metadata holds the event, referenceId the payout.
  assert.deepEqual(
    activityTarget({
      type: "team_pay_sent",
      metadata: {
        referenceType: "event_team_payout",
        referenceId: "p1",
        eventId: "e1",
      },
    }),
    my("e1"),
  );
  // A team reminder row.
  assert.deepEqual(
    activityTarget({
      type: "event_reminder",
      metadata: {
        referenceType: "event",
        referenceId: "e1",
        eventId: "e1",
        kind: "team_soon",
        role: "cohost",
      },
    }),
    { screen: "manage", eventId: "e1" },
  );
  // An item the app saved when the push came in while open (metadata = the push data).
  assert.deepEqual(
    activityTarget({
      type: "ticket_sold",
      metadata: { type: "ticket_sold", eventId: "e1", orderId: "o1" },
    }),
    { screen: "manage", eventId: "e1" },
  );
  assert.deepEqual(
    activityTarget({
      type: "event_reminder",
      metadata: { type: "event_reminder", kind: "day_before", eventId: "e1" },
    }),
    { screen: "ticket", eventId: "e1" },
  );
  // Taken off.
  assert.deepEqual(
    activityTarget({
      type: "team_removed",
      metadata: {
        referenceType: "event_door_invite",
        referenceId: "i1",
        inviteId: "i1",
        scope: "event",
        eventId: "e1",
      },
    }),
    { screen: "doorEvents", eventId: null },
  );
});

test("Activity invites: metadata first, then referenceId (as before)", () => {
  assert.deepEqual(
    activityTarget({
      type: "team_invite",
      metadata: { inviteId: "i1", referenceId: "i1" },
    }),
    { screen: "doorInvite", eventId: null, inviteId: "i1" },
  );
  assert.deepEqual(
    activityTarget({
      type: "door_team_invite",
      metadata: { referenceId: "i3" },
    }),
    { screen: "doorInvite", eventId: null, inviteId: "i3" },
  );
  assert.deepEqual(
    activityTarget({
      type: "door_team_invite",
      referenceId: "i4",
      metadata: null,
    }),
    { screen: "doorInvite", eventId: null, inviteId: "i4" },
  );
});

test("other Activity types are left to the screen", () => {
  for (const type of [
    "new_follower",
    "booking_request",
    "plan_offer",
    "announcement",
    "business_pending",
  ]) {
    assert.equal(
      activityTarget({ type, metadata: { referenceId: "x", eventId: "e1" } }),
      null,
      type,
    );
  }
  assert.deepEqual(
    activityTarget({ type: "team_pay_sent", metadata: undefined }),
    { screen: "doorEvents", eventId: null },
  );
});

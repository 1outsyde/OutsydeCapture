/**
 * Activity redesign step 2: chips, groups, times, icons and row buttons.
 * Run with: npx tsx utils/activityLogic.test.ts
 */
import assert from "node:assert/strict";
import {
  activityCategory,
  activityChips,
  filterByChip,
  groupByWhen,
  activityTime,
  activityIcon,
  activityAction,
  type ActivityRow,
} from "./activityLogic";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}
const row = (type: string, extra: Partial<ActivityRow> = {}): ActivityRow => ({
  id: type,
  type,
  date: "2026-11-10T12:00:00Z",
  read: false,
  ...extra,
});

test("every type the backend writes today has a category (Neon 2026-11-10 list)", () => {
  const expected: Record<string, string> = {
    new_follower: "social",
    new_vendor_application: "admin",
    new_order: "orders",
    new_consumer_signup: "admin",
    payment_succeeded: "orders",
    vendor_approved: "outsyde",
    new_photographer_application: "admin",
    stripe_onboarding_complete: "outsyde",
    order_confirmed: "orders",
    subscription_activated: "outsyde",
    order_shipped: "orders",
    vendor_rejected: "outsyde",
    staff_invite_accepted: "outsyde",
    payment_failed: "orders",
    staff_bookable: "outsyde",
    staff_onboarding_complete: "outsyde",
    announcement: "outsyde",
    plan_offer: "outsyde",
    door_team_invite: "events",
  };
  for (const [type, cat] of Object.entries(expected)) {
    assert.equal(activityCategory(row(type)), cat, type);
  }
});

test("bookings, quotes and unknown types", () => {
  for (const t of [
    "booking_request",
    "booking_expired",
    "booking_confirmed",
    "reminder",
    "addon_charged",
  ]) {
    assert.equal(activityCategory(row(t)), "bookings", t);
  }
  assert.equal(
    activityCategory(row("quote_paid", { metadata: { quoteId: "q1" } })),
    "bookings",
  );
  assert.equal(activityCategory(row("quote_extra")), "bookings");
  assert.equal(activityCategory(row("ticket_sale")), "events");
  assert.equal(activityCategory(row("something_new")), "other");
});

test("chips: Admin only for admins", () => {
  assert.deepEqual(
    activityChips(false).map((c) => c.label),
    ["All", "Bookings", "Orders", "Social", "Events", "Outsyde"],
  );
  assert.deepEqual(
    activityChips(true)
      .map((c) => c.key)
      .slice(-1),
    ["admin"],
  );
});

test("filter: All keeps everything incl. unknown types; a chip keeps only its rows", () => {
  const rows = [row("new_order"), row("new_follower"), row("something_new")];
  assert.equal(filterByChip(rows, "all").length, 3);
  assert.deepEqual(
    filterByChip(rows, "orders").map((r) => r.type),
    ["new_order"],
  );
  assert.deepEqual(filterByChip(rows, "events"), []);
});

test("groups: Today, This week, Earlier; empty groups dropped; order kept", () => {
  const now = new Date(2026, 10, 10, 9, 0); // Nov 10, 9:00 local
  const at = (d: Date) => d.toISOString();
  const rows = [
    row("a", { id: "t1", date: at(new Date(2026, 10, 10, 8, 0)) }),
    row("b", { id: "w1", date: at(new Date(2026, 10, 9, 23, 0)) }),
    row("c", { id: "w2", date: at(new Date(2026, 10, 4, 0, 1)) }),
    row("d", { id: "e1", date: at(new Date(2026, 10, 3, 23, 59)) }),
    row("e", { id: "bad", date: "not a date" }),
  ];
  const g = groupByWhen(rows, now);
  assert.deepEqual(
    g.map((s) => [s.title, s.rows.map((r) => r.id)]),
    [
      ["Today", ["t1"]],
      ["This week", ["w1", "w2"]],
      ["Earlier", ["e1", "bad"]],
    ],
  );
  assert.deepEqual(
    groupByWhen([row("x", { date: at(new Date(2026, 9, 1)) })], now).map(
      (s) => s.title,
    ),
    ["Earlier"],
  );
});

test("short times", () => {
  const now = new Date(2026, 10, 10, 12, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  assert.equal(activityTime(ago(10_000), now), "Just now");
  assert.equal(activityTime(ago(5 * 60_000), now), "5m");
  assert.equal(activityTime(ago(2 * 3_600_000), now), "2h");
  assert.equal(activityTime(ago(3 * 86_400_000), now), "3d");
  assert.equal(
    activityTime(new Date(2026, 9, 26, 12).toISOString(), now),
    "Oct 26",
  );
  assert.equal(
    activityTime(new Date(2025, 11, 2, 12).toISOString(), now),
    "Dec 2, 2025",
  );
  assert.equal(activityTime("nope", now), "");
});

test("icons are filled Ionicons names that exist", () => {
  const glyphs = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");
  const types = [
    "new_follower",
    "new_order",
    "order_shipped",
    "payment_failed",
    "refund_issued",
    "announcement",
    "plan_offer",
    "booking_request",
    "quote_paid",
    "door_team_invite",
    "new_vendor_application",
    "new_consumer_signup",
    "vendor_approved",
    "vendor_rejected",
    "subscription_activated",
    "photographer_assigned",
    "staff_bookable",
    "something_new",
  ];
  for (const t of types) {
    const icon = activityIcon(
      row(t, t === "quote_paid" ? { metadata: { quoteId: "q" } } : {}),
    );
    assert.ok(icon in glyphs, `${t} -> ${icon}`);
    assert.ok(!icon.endsWith("-outline"), `${t} uses an outline icon`);
  }
});

test("buttons only where a tap opens something", () => {
  assert.deepEqual(
    activityAction(
      row("new_follower", { metadata: { referenceId: "u1" } }),
      false,
    ),
    { kind: "follow", userId: "u1" },
  );
  assert.deepEqual(
    activityAction(
      row("new_follower", { metadata: { followerUserId: "u2" } }),
      false,
    ),
    { kind: "follow", userId: "u2" },
  );
  assert.equal(activityAction(row("new_follower"), false), null);
  assert.deepEqual(activityAction(row("booking_request"), false), {
    kind: "open",
    label: "View booking",
  });
  assert.deepEqual(
    activityAction(row("quote_paid", { metadata: { quoteId: "q" } }), false),
    { kind: "open", label: "View quote" },
  );
  assert.deepEqual(activityAction(row("plan_offer"), false), {
    kind: "open",
    label: "View offer",
  });
  assert.deepEqual(activityAction(row("referral_reward"), false), {
    kind: "open",
    label: "Open points",
  });
  assert.deepEqual(activityAction(row("order_shipped"), false), {
    kind: "open",
    label: "View order",
  });
  assert.deepEqual(activityAction(row("new_order"), false), {
    kind: "open",
    label: "View orders",
  });
  assert.equal(
    activityAction(
      row("business_pending", { metadata: { businessId: "b" } }),
      false,
    ),
    null,
  );
  assert.deepEqual(
    activityAction(
      row("business_pending", { metadata: { businessId: "b" } }),
      true,
    ),
    { kind: "open", label: "Review" },
  );
  for (const t of [
    "payment_succeeded",
    "vendor_approved",
    "announcement",
    "new_vendor_application",
    "something_new",
  ]) {
    assert.equal(activityAction(row(t), true), null, t);
  }
});

console.log(`\n${passed} passed`);

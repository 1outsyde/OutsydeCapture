/** Admin referrals (port of goutsyde.com tests/admin-referrals-logic.test.ts). Run with: npx tsx utils/adminReferrals.test.ts */
import assert from "node:assert/strict";
import {
  usd,
  actionsFor,
  payoutPill,
  referralPill,
  friendPill,
  attentionCopy,
  BIZ_FILTERS,
  filterBusiness,
  filterFriends,
  ACTION_COPY,
  ADMIN_ACTIONS,
  allCopy,
  shortDate,
  normalizeReferrals,
  type AdminBusinessReferral,
  type AdminFriendReferral,
} from "./adminReferrals";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} ${name}`);
};

const pay = (
  o: Partial<NonNullable<AdminBusinessReferral["payout"]>> = {},
) => ({
  id: "p1",
  status: "pending",
  paused: false,
  holdReason: null,
  amountCents: 2500,
  payableAfter: "2026-10-31T16:00:00Z",
  attempts: 0,
  lastError: null,
  nextAttemptAt: null,
  paidAt: null,
  destinationType: null,
  account: null,
  transfer: null,
  sending: false,
  ...o,
});
const biz = (
  o: Partial<AdminBusinessReferral> = {},
): AdminBusinessReferral => ({
  id: "r1",
  businessName: "Kay's Braids",
  referrer: { id: "u1", username: "legend" },
  owner: { username: "kay" },
  status: "qualified",
  blockReason: null,
  createdAt: "2026-10-01T16:00:00Z",
  qualifiedAt: "2026-10-24T16:00:00Z",
  expiresAt: "2026-12-30T16:00:00Z",
  payout: pay(),
  ...o,
});
const kinds = (b: AdminBusinessReferral) =>
  actionsFor(b)
    .map((a) => a.kind)
    .join(",");

t("money", () => {
  assert.equal(usd(2500), "$25");
  assert.equal(usd(0), "$0");
  assert.equal(usd(250000), "$2,500");
  assert.equal(usd(2550), "$25.50");
  assert.equal(usd(NaN), "$0");
});

t("which buttons show (same as web)", () => {
  assert.equal(kinds(biz()), "pause,cancel");
  assert.equal(
    kinds(biz({ payout: pay({ status: "held", holdReason: "no_account" }) })),
    "pause,cancel",
  );
  assert.equal(
    kinds(
      biz({
        payout: pay({
          status: "held",
          holdReason: "admin_paused",
          paused: true,
        }),
      }),
    ),
    "release,cancel",
  );
  assert.equal(
    kinds(biz({ payout: pay({ status: "review" }) })),
    "retry,cancel",
  );
  assert.equal(
    kinds(biz({ payout: pay({ sending: true }) })),
    "",
    "may be sending: no buttons",
  );
  assert.equal(kinds(biz({ payout: pay({ status: "paid" }) })), "");
  assert.equal(kinds(biz({ payout: pay({ status: "cancelled" }) })), "");
  assert.equal(kinds(biz({ status: "pending", payout: null })), "");
  assert.equal(
    actionsFor(biz()).find((a) => a.kind === "cancel")?.tone,
    "danger",
  );
  assert.deepEqual([...ADMIN_ACTIONS], ["pause", "release", "cancel", "retry"]);
});

t("labels", () => {
  assert.ok(
    payoutPill(biz().payout!, new Date("2026-10-24T16:00:00Z")).text.includes(
      "Oct 31",
    ),
  );
  assert.equal(
    payoutPill(
      pay({ status: "pending", payableAfter: "2026-10-01T00:00:00Z" }),
      new Date("2026-10-24T16:00:00Z"),
    ).text,
    "Sending soon",
  );
  assert.equal(
    payoutPill(
      pay({ status: "held", holdReason: "admin_paused", paused: true }),
    ).text,
    "Paused",
  );
  assert.match(
    payoutPill(pay({ status: "held", holdReason: "no_account" })).text,
    /payout setup/i,
  );
  assert.match(
    payoutPill(pay({ status: "held", holdReason: "stripe_not_ready" })).text,
    /Stripe/,
  );
  assert.equal(payoutPill(pay({ status: "review" })).tone, "red");
  assert.equal(payoutPill(pay({ status: "paid" })).tone, "green");
  assert.match(payoutPill(pay({ sending: true })).text, /Sending/);
  assert.ok(
    referralPill(
      biz({ status: "blocked", blockReason: "yearly_cap" }),
    ).text.includes("20"),
  );
  assert.match(
    referralPill(biz({ status: "blocked", blockReason: "owner" })).text,
    /own/i,
  );
  assert.equal(
    referralPill(biz({ status: "blocked", blockReason: "toString" })).text,
    "Blocked",
    "only real block reasons",
  );
  assert.equal(
    referralPill(biz({ status: "pending", payout: null })).text,
    "Not live yet",
  );
  assert.equal(
    friendPill({ status: "completed" } as AdminFriendReferral).tone,
    "green",
  );
  assert.equal(
    friendPill({ status: "pending" } as AdminFriendReferral).text,
    "No purchase yet",
  );
  for (const k of [
    "review",
    "paused",
    "waiting_setup",
    "waiting_balance",
  ] as const) {
    assert.ok(
      attentionCopy(k).title.length > 0 && attentionCopy(k).why.length > 0,
      k,
    );
  }
});

t("New York dates", () => {
  // 3:30 AM UTC Nov 1 is still Oct 31 in New York (EDT); 4:30 AM UTC Nov 3 is Nov 2 (EST).
  assert.equal(shortDate("2026-11-01T03:30:00Z"), "Oct 31");
  assert.equal(shortDate("2026-11-03T04:30:00Z"), "Nov 2");
  assert.equal(shortDate("2026-11-03T05:30:00Z"), "Nov 3");
  assert.equal(shortDate(null), "");
  assert.equal(shortDate("nope"), "");
});

t("filters and search", () => {
  const list = [
    biz({ id: "a", status: "pending", payout: null }),
    biz({ id: "b" }),
    biz({ id: "c", payout: pay({ status: "paid" }) }),
    biz({ id: "d", payout: pay({ status: "review" }) }),
    biz({
      id: "e",
      payout: pay({ status: "held", holdReason: "admin_paused", paused: true }),
    }),
    biz({
      id: "f",
      status: "blocked",
      payout: null,
      businessName: "Nail Spot",
      referrer: { id: "u2", username: "pam" },
    }),
  ];
  const ids = (f: string, s = "") =>
    filterBusiness(list, f, s)
      .map((b) => b.id)
      .join("");
  assert.equal(
    BIZ_FILTERS.map((f) => f.key).join(","),
    "all,waiting,upcoming,paid,problems",
  );
  assert.equal(ids("all"), "abcdef");
  assert.equal(ids("waiting"), "a");
  assert.equal(ids("upcoming"), "b");
  assert.equal(ids("paid"), "c");
  assert.equal(ids("problems"), "def");
  assert.equal(ids("all", "nail"), "f");
  assert.equal(ids("all", "@PAM"), "f");
  assert.equal(ids("all", "kay"), "abcdef");
  assert.equal(ids("all", "braids"), "abcde");
  const friends: AdminFriendReferral[] = [
    {
      id: "1",
      referrer: { id: "u1", username: "legend" },
      friend: { username: "mia" },
      status: "completed",
      referrerPoints: 2500,
      friendPoints: 2500,
      firstPurchaseType: "appointment",
      createdAt: null,
      paidAt: null,
    },
    {
      id: "2",
      referrer: { id: "u2", username: "pam" },
      friend: { username: "joe" },
      status: "pending",
      referrerPoints: 2500,
      friendPoints: 2500,
      firstPurchaseType: null,
      createdAt: null,
      paidAt: null,
    },
  ];
  assert.equal(
    filterFriends(friends, "MIA")
      .map((f) => f.id)
      .join(""),
    "1",
  );
  assert.equal(filterFriends(friends, "").length, 2);
});

t("list response with missing parts", () => {
  const d = normalizeReferrals({
    success: true,
    totals: { payouts: { paidCents: "2500" } },
  });
  assert.equal(d.totals.payouts.paidCents, 2500);
  assert.equal(d.totals.business.invited, 0);
  assert.equal(d.totals.friends.pointsAwarded, 0);
  assert.deepEqual(d.attention, []);
  assert.deepEqual(d.business, []);
  assert.deepEqual(d.friends, []);
  assert.equal(normalizeReferrals(null).totals.payouts.upcomingCents, 0);
});

t("copy rules", () => {
  assert.match(ACTION_COPY.cancel.confirm, /can't be undone/i);
  assert.match(ACTION_COPY.cancel.confirm, /no money/i);
  for (const s of allCopy()) assert.ok(!/(—|–| - )/.test(s) && !/%/.test(s), s);
});

console.log(`\n${n} passed`);

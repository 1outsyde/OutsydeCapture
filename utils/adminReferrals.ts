// Admin referrals in the app (App Admin Step 8). Port of goutsyde.com app/admin/referrals/_lib/referrals.ts:
// same types, labels, filters, and which buttons show. Routes: GET /api/admin/referrals and
// POST /api/admin/referrals/payouts/:id/{pause,release,cancel,retry} (backend referrals/adminReferralsRouter.ts).
// The $25 business payout pays itself 7 days after qualifying; the actions only change its state, the payout job
// sends it. Friend referrals are view only (Legend, 2026-10-24). Copy: real punctuation, no dashes, no percentages.
// Test: npx tsx utils/adminReferrals.test.ts
import { etOffsetHours } from "./adminPlans";

export type AdminPayout = {
  id: string;
  status: string;
  paused: boolean;
  holdReason: string | null;
  amountCents: number;
  payableAfter: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  paidAt: string | null;
  destinationType: string | null;
  account: string | null;
  transfer: string | null;
  sending: boolean;
};
export type AdminBusinessReferral = {
  id: string;
  businessName: string;
  referrer: { id: string; username: string | null };
  owner: { username: string | null };
  status: string;
  blockReason: string | null;
  createdAt: string | null;
  qualifiedAt: string | null;
  expiresAt: string | null;
  payout: AdminPayout | null;
};
export type AdminFriendReferral = {
  id: string;
  referrer: { id: string; username: string | null };
  friend: { username: string | null };
  status: string;
  referrerPoints: number;
  friendPoints: number;
  firstPurchaseType: string | null;
  createdAt: string | null;
  paidAt: string | null;
};
export type AttentionKind =
  | "review"
  | "paused"
  | "waiting_setup"
  | "waiting_balance";
export type AttentionItem = {
  kind: AttentionKind;
  payoutId: string;
  businessName: string;
  referrer: string | null;
  since: string | null;
  detail: string | null;
};
export type AdminReferralsData = {
  totals: {
    business: {
      invited: number;
      pending: number;
      qualified: number;
      expired: number;
      blocked: number;
    };
    payouts: {
      paidCents: number;
      upcomingCents: number;
      pausedCents: number;
      reviewCents: number;
      cancelled: number;
    };
    friends: {
      total: number;
      waiting: number;
      completed: number;
      pointsAwarded: number;
    };
  };
  attention: AttentionItem[];
  business: AdminBusinessReferral[];
  friends: AdminFriendReferral[];
};

const n0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** The list response with every total present, so a missing field never shows NaN. */
export function normalizeReferrals(r: any): AdminReferralsData {
  const t = r?.totals ?? {};
  const b = t.business ?? {},
    p = t.payouts ?? {},
    f = t.friends ?? {};
  return {
    totals: {
      business: {
        invited: n0(b.invited),
        pending: n0(b.pending),
        qualified: n0(b.qualified),
        expired: n0(b.expired),
        blocked: n0(b.blocked),
      },
      payouts: {
        paidCents: n0(p.paidCents),
        upcomingCents: n0(p.upcomingCents),
        pausedCents: n0(p.pausedCents),
        reviewCents: n0(p.reviewCents),
        cancelled: n0(p.cancelled),
      },
      friends: {
        total: n0(f.total),
        waiting: n0(f.waiting),
        completed: n0(f.completed),
        pointsAwarded: n0(f.pointsAwarded),
      },
    },
    attention: Array.isArray(r?.attention) ? r.attention : [],
    business: Array.isArray(r?.business) ? r.business : [],
    friends: Array.isArray(r?.friends) ? r.friends : [],
  };
}

/** "$25" for whole dollars, "$25.50" otherwise. */
export function usd(cents: number): string {
  const n = Number.isFinite(cents) ? Math.round(cents) : 0;
  const whole = n % 100 === 0;
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

export const at = (u: string | null | undefined) => (u ? `@${u}` : "Unknown");

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Nov 4" in New York time (web events/_lib/money.ts shortDate), without Intl time zones. Empty when missing. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms + etOffsetHours(ms) * 3600 * 1000);
  return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/* ---------- Actions ---------- */

export const ADMIN_ACTIONS = ["pause", "release", "cancel", "retry"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export const ACTION_COPY: Record<
  AdminAction,
  { label: string; confirm: string; done: string }
> = {
  pause: {
    label: "Pause",
    confirm: "Pause this $25? It won't be sent until you release it.",
    done: "Paused. It won't be sent until you release it.",
  },
  release: {
    label: "Release",
    confirm:
      "Release this $25? It goes out on the next run once the 7 days have passed.",
    done: "Released. It goes out on the next run once the 7 days have passed.",
  },
  cancel: {
    label: "Cancel payout",
    confirm: "Cancel this $25? No money goes out, and this can't be undone.",
    done: "Payout cancelled. No money goes out.",
  },
  retry: {
    label: "Try again",
    confirm: "Try sending this $25 again?",
    done: "Set to try again. The payout job sends it within a few minutes.",
  },
};

export type ActionButton = {
  kind: AdminAction;
  tone: "gold" | "ghost" | "danger";
};

/** The buttons for one referral's payout. None while it may be sending, or once it's paid or cancelled. */
export function actionsFor(b: AdminBusinessReferral): ActionButton[] {
  const p = b.payout;
  if (!p || p.sending) return [];
  if (p.status === "review")
    return [
      { kind: "retry", tone: "gold" },
      { kind: "cancel", tone: "danger" },
    ];
  if (p.paused)
    return [
      { kind: "release", tone: "gold" },
      { kind: "cancel", tone: "danger" },
    ];
  if (p.status === "pending" || p.status === "held")
    return [
      { kind: "pause", tone: "ghost" },
      { kind: "cancel", tone: "danger" },
    ];
  return [];
}

/* ---------- Labels ---------- */

export type Pill = { text: string; tone: "gold" | "green" | "red" | "grey" };

export function payoutPill(p: AdminPayout, now: Date = new Date()): Pill {
  if (p.sending) return { text: "Sending now", tone: "gold" };
  if (p.paused) return { text: "Paused", tone: "red" };
  switch (p.status) {
    case "paid":
      return {
        text: `Paid${p.paidAt ? ` ${shortDate(p.paidAt)}` : ""}`,
        tone: "green",
      };
    case "cancelled":
      return { text: "Cancelled", tone: "grey" };
    case "review":
      return { text: "Needs a look", tone: "red" };
    case "held":
      return p.holdReason === "stripe_not_ready"
        ? { text: "Waiting on Stripe", tone: "gold" }
        : { text: "Waiting on payout setup", tone: "gold" };
    default: {
      const due = p.payableAfter ? Date.parse(p.payableAfter) : NaN;
      return Number.isFinite(due) && due > now.getTime()
        ? { text: `Sends ${shortDate(p.payableAfter)}`, tone: "gold" }
        : { text: "Sending soon", tone: "gold" };
    }
  }
}

// The backend's block reasons (businessReferralBlock and the yearly cap in checkBusinessReferral).
const BLOCK_TEXT: Record<string, string> = {
  owner: "Blocked: referrer owns it",
  staff: "Blocked: referrer works there",
  shared_stripe: "Blocked: same Stripe account",
  shared_email: "Blocked: same email",
  referrer_inactive: "Blocked: referrer account inactive",
  missing: "Blocked: business or referrer missing",
  yearly_cap: "Blocked: over 20 this year",
};

export function referralPill(b: AdminBusinessReferral): Pill {
  switch (b.status) {
    case "pending":
      return { text: "Not live yet", tone: "grey" };
    case "qualified":
      return { text: "Qualified", tone: "green" };
    case "expired":
      return { text: "Expired after 90 days", tone: "grey" };
    case "blocked":
      return {
        text:
          (b.blockReason &&
            Object.prototype.hasOwnProperty.call(BLOCK_TEXT, b.blockReason) &&
            BLOCK_TEXT[b.blockReason]) ||
          "Blocked",
        tone: "red",
      };
    default:
      return { text: b.status, tone: "grey" };
  }
}

export function friendPill(f: AdminFriendReferral): Pill {
  switch (f.status) {
    case "completed":
      return { text: "Points given", tone: "green" };
    case "qualifying":
      return { text: "Purchase made, points pending", tone: "gold" };
    case "pending":
      return { text: "No purchase yet", tone: "grey" };
    default:
      return { text: f.status, tone: "grey" };
  }
}

export function attentionCopy(kind: AttentionKind): {
  title: string;
  why: string;
} {
  switch (kind) {
    case "review":
      return {
        title: "Needs a look",
        why: "The payout failed or Stripe couldn't confirm the plan payment. Check Stripe, then try again or cancel.",
      };
    case "paused":
      return {
        title: "Paused",
        why: "You paused this payout. Release it to send, or cancel it.",
      };
    case "waiting_setup":
      return {
        title: "Waiting over a week",
        why: "The referrer still hasn't set up payouts. They were told how.",
      };
    case "waiting_balance":
      return {
        title: "Waiting for balance",
        why: "Stripe balance is too low to send it. It tries again every hour.",
      };
    default:
      return { title: "Needs a look", why: "" };
  }
}

/* ---------- Filters ---------- */

export const BIZ_FILTERS = [
  { key: "all", label: "All" },
  { key: "waiting", label: "Not live yet" },
  { key: "upcoming", label: "Coming up" },
  { key: "paid", label: "Paid" },
  { key: "problems", label: "Problems" },
] as const;

function bucket(b: AdminBusinessReferral): string {
  const p = b.payout;
  if (
    b.status === "blocked" ||
    b.status === "expired" ||
    p?.status === "review" ||
    p?.paused
  )
    return "problems";
  if (b.status === "pending") return "waiting";
  if (p?.status === "paid") return "paid";
  if (p && (p.status === "pending" || p.status === "held")) return "upcoming";
  return "other";
}

const norm = (s: string) => s.trim().toLowerCase().replace(/^@/, "");

export function filterBusiness(
  list: AdminBusinessReferral[],
  filter: string,
  search: string,
): AdminBusinessReferral[] {
  const s = norm(search);
  return list.filter(
    (b) =>
      (filter === "all" || bucket(b) === filter) &&
      (!s ||
        [b.businessName, b.referrer.username, b.owner.username].some((v) =>
          (v ?? "").toLowerCase().includes(s),
        )),
  );
}

export function filterFriends(
  list: AdminFriendReferral[],
  search: string,
): AdminFriendReferral[] {
  const s = norm(search);
  return list.filter(
    (f) =>
      !s ||
      [f.referrer.username, f.friend.username].some((v) =>
        (v ?? "").toLowerCase().includes(s),
      ),
  );
}

/** Every fixed string the screen shows, for the copy rule test. */
export function allCopy(): string[] {
  return [
    ...Object.values(ACTION_COPY).flatMap((c) => [c.label, c.confirm, c.done]),
    ...Object.values(BLOCK_TEXT),
    ...(
      ["review", "paused", "waiting_setup", "waiting_balance"] as const
    ).flatMap((k) => Object.values(attentionCopy(k))),
    ...BIZ_FILTERS.map((f) => f.label),
  ];
}

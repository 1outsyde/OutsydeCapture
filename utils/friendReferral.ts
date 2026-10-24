// Friend referrals (2026-10-23). The backend pays 2,500 points each ($5) when the friend's first
// purchase of $10 or more is final; a code is used once, within 30 days of signing up, by a new
// customer. Share links are https://www.goutsyde.com/r/<CODE>.
// Copy rules: real punctuation, no dashes, never a percentage, points are Outsyde loyalty rewards.

const CODE_RE = /^[A-Za-z0-9]{1,20}$/;
const HOSTS = new Set(["goutsyde.com", "www.goutsyde.com"]);

/** A code the backend accepts (letters and digits, up to 20), uppercased, or null. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim();
  return CODE_RE.test(code) ? code.toUpperCase() : null;
}

/** The friend code in a goutsyde.com/r/<CODE> link, or null for any other link. */
export function referralCodeFromUrl(url: string): string | null {
  const m = /^https:\/\/([^/?#]+)\/r\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(
    url.trim(),
  );
  if (!m || !HOSTS.has(m[1].toLowerCase())) return null;
  let raw = m[2];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return normalizeReferralCode(raw);
}

/** Push data from the backend's reward notice: { type: "referral_reward", referenceId }. */
export function isReferralRewardPush(
  data: { type?: unknown; [key: string]: unknown } | null | undefined,
): boolean {
  return !!data && data.type === "referral_reward";
}

interface Nav {
  navigate: (...args: any[]) => void;
}

/** A reward tap (push or Activity row): Points for a signed in customer, sign in otherwise. */
export function openPointsFromReward(
  navigation: Nav,
  user: { role?: string | null; isGuest?: boolean | null } | null | undefined,
): void {
  if (!user || user.isGuest) {
    navigation.navigate("Auth", {});
    return;
  }
  // pop: back to the tabs already under this screen (a plain navigate pushes a second copy).
  navigation.navigate(
    "Main",
    { screen: "AccountTab", params: { screen: "OutsydePoints" } },
    { pop: true },
  );
}

export interface FriendReferralStats {
  totalReferrals?: number;
  pendingReferrals?: number;
  qualifyingReferrals?: number;
  completedReferrals?: number;
  totalPointsEarned?: number;
}

/** Numbers for the invite card. Waiting = joined but no final first purchase yet. */
export function referralCounts(stats: FriendReferralStats | undefined): {
  invited: number;
  waiting: number;
  earned: number;
} {
  return {
    invited: stats?.totalReferrals ?? 0,
    waiting: (stats?.pendingReferrals ?? 0) + (stats?.qualifyingReferrals ?? 0),
    earned: stats?.totalPointsEarned ?? 0,
  };
}

export const REFERRAL_COPY = {
  cardTitle: "Invite friends",
  cardBody:
    "Share your link. When a friend joins and makes a first purchase of $10 or more, you each get 2,500 Outsyde loyalty rewards points, worth $5.",
  share:
    "Join me on Outsyde. Use my link and we each get 2,500 Outsyde loyalty rewards points, worth $5, after your first purchase of $10 or more.",
  fieldLabel: "Invite code (optional)",
  fieldHint: "Got a code from a friend? Enter it here.",
  copied: "Link copied",
} as const;

export function referralShareMessage(link: string): string {
  return `${REFERRAL_COPY.share} ${link}`;
}

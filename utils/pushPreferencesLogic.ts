// Per-category push switches in Notification settings (Activity step 3b, Legend 2026-11-10).
// Backend: /api/push/preferences (outsyde-backend #438, migration 110). The backend decides which
// pushes each switch controls; money, account and admin pushes can't be turned off.
// Test: npx tsx utils/pushPreferencesLogic.test.ts

export const PUSH_CATEGORY_KEYS = [
  "bookings",
  "messages",
  "orders",
  "events",
] as const;
export type PushCategoryKey = (typeof PUSH_CATEGORY_KEYS)[number];
export type PushCategories = Record<PushCategoryKey, boolean>;
export type PushPreferences = {
  news: boolean;
  categories: PushCategories | null;
};
export type PushPreferenceChange = Partial<PushCategories> & { news?: boolean };

/**
 * Reads the server reply. null = not usable (the screen hides the switches). categories = null when
 * the backend is older than #438 and only knows news: the four category rows stay hidden.
 */
export function parsePushPreferences(r: unknown): PushPreferences | null {
  if (!r || typeof r !== "object") return null;
  const o = r as { news?: unknown; categories?: unknown };
  if (typeof o.news !== "boolean") return null;
  let categories: PushCategories | null = null;
  if (o.categories && typeof o.categories === "object") {
    const c = o.categories as Record<string, unknown>;
    if (PUSH_CATEGORY_KEYS.every((k) => typeof c[k] === "boolean")) {
      categories = {} as PushCategories;
      for (const k of PUSH_CATEGORY_KEYS) categories[k] = c[k] as boolean;
    }
  }
  return { news: o.news, categories };
}

export type PushCategoryRow = {
  key: PushCategoryKey;
  label: string;
  description: string;
  note?: string;
};

/** The four rows, in order. Businesses, photographers and staff get a note under Bookings. */
export function pushCategoryRows(
  role: string | null | undefined,
): PushCategoryRow[] {
  const provider =
    role === "business" || role === "photographer" || role === "staff";
  return [
    {
      key: "bookings",
      label: "Bookings and quotes",
      description: "Booking requests, confirmations, changes and quotes.",
      ...(provider
        ? { note: "New bookings still show in your Activity and by email." }
        : {}),
    },
    {
      key: "messages",
      label: "Messages",
      description: "New messages, including event team chats.",
    },
    {
      key: "orders",
      label: "Orders and refunds",
      description: "Order updates and refunds.",
    },
    {
      key: "events",
      label: "Events and tickets",
      description: "Tickets, event reminders and your event teams.",
    },
  ];
}

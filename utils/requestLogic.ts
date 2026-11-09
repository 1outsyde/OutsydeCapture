/**
 * Quotes in the app, customers (step 6c-2b). Pure: no React Native, no network. Tested in utils/requestLogic.test.ts.
 *
 * Legend 2026-11-05 (step 6c-2 calls, all as recommended):
 *   - 2: a request only service reads Price on request and Request a quote, never Book. Contact for pricing always
 *        opens the request form, never a dead end.
 *   - 3: the request form is the business's own questions (GET /api/services/:id/request-form), plus the city when
 *        the business lists cities and a phone number; name and email come from the account. The backend checks
 *        the answers again (server/requests/requestForms.ts checkAnswers); the limits here match it.
 *   - 4: the pop-up shows one thing waiting on the customer (GET /api/me/quote-actions, money first); Not now hides
 *        it until the next time the app opens.
 *   - 5: Activity rows for quotes open that quote.
 *   - 6: the Quotes tab lists quotes and requests, newest first, with Needs you.
 * Copy uses commas and periods only and never the fee rate.
 */
import {
  money,
  quoteChip,
  whenLine,
  type Quote,
  type Start,
} from "./quoteLogic";

// ─── Request only services ──────────────────────────────────────────────────

export function serviceAction(s: {
  requestOnly?: boolean | null;
  priceCents: number;
}): { price: string; button: string; kind: "request" | "book" } {
  return s.requestOnly === true
    ? { price: "Price on request", button: "Request a quote", kind: "request" }
    : { price: money(s.priceCents), button: "Book", kind: "book" };
}

// ─── The request form ───────────────────────────────────────────────────────

export type RequestQuestion = {
  id: string;
  type: "short_text" | "long_text" | "choice" | "date" | "photos";
  label: string;
  help?: string;
  required: boolean;
  options?: string[];
  multiple?: boolean;
  maxPhotos?: number;
};
export type RequestForm = {
  service: { id: string; name: string; description?: string | null };
  /** The business, or (vendorType photographer, F2b) the photographer the request goes to. */
  business: { id: string; name: string };
  /** F2b: absent = a business (every form loaded before F2b). */
  vendorType?: "business" | "photographer";
  cities: string[];
  cityRequired: boolean;
  phoneRequired: boolean;
  questions: RequestQuestion[];
};
/** Answers by question id: text, a date (YYYY-MM-DD), a choice, several choices, or photos (local or uploaded). */
export type Answers = Record<string, string | string[] | undefined>;

export const MAX_SHORT = 200,
  MAX_LONG = 2000,
  MAX_PHOTOS_TOTAL = 10,
  MAX_PHOTOS_EACH = 5;

/** The first problem, in form order, or null. photoCount: every photo picked across the form. */
export function checkRequest(
  f: RequestForm,
  a: Answers,
  phone: string,
  city: string,
  photoCount: number,
): { field: string; message: string } | null {
  if (f.cityRequired && !city.trim())
    return { field: "city", message: "Please choose your city." };
  for (const q of f.questions) {
    const raw = a[q.id];
    const fail = (message: string) => ({ field: q.id, message });
    if (q.type === "photos") {
      const n = Array.isArray(raw) ? raw.length : 0;
      if (!n && q.required) return fail(`Please add a photo for "${q.label}"`);
      if (n > (q.maxPhotos ?? MAX_PHOTOS_EACH))
        return fail(
          `"${q.label}" takes up to ${q.maxPhotos ?? MAX_PHOTOS_EACH} photos`,
        );
      continue;
    }
    if (q.type === "choice" && q.multiple) {
      const list = Array.isArray(raw) ? raw : [];
      if (!list.length && q.required) return fail(`Please answer "${q.label}"`);
      if (list.some((v) => !(q.options ?? []).includes(v)))
        return fail(`Please pick from the choices for "${q.label}"`);
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) {
      if (q.required) return fail(`Please answer "${q.label}"`);
      continue;
    }
    if (q.type === "choice" && !(q.options ?? []).includes(v))
      return fail(`Please pick one of the choices for "${q.label}"`);
    if (q.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v))
      return fail(`"${q.label}" must be a date`);
    const max =
      q.type === "short_text"
        ? MAX_SHORT
        : q.type === "long_text"
          ? MAX_LONG
          : Infinity;
    if (v.length > max)
      return fail(
        `"${q.label}" can be up to ${max.toLocaleString("en-US")} characters`,
      );
  }
  if (photoCount > MAX_PHOTOS_TOTAL)
    return {
      field: f.questions.find((q) => q.type === "photos")?.id ?? "photos",
      message: `A request can have up to ${MAX_PHOTOS_TOTAL} photos.`,
    };
  if (f.phoneRequired && phone.replace(/\D/g, "").length < 7)
    return {
      field: "phone",
      message: "Please add a phone number the business can call.",
    };
  return null;
}

/** POST /api/estimate-requests. uploaded: photo URLs by question id (the requests folder). */
export function requestBody(
  f: RequestForm,
  user: { firstName?: string | null; lastName?: string | null; email: string },
  a: Answers,
  uploaded: Record<string, string[]>,
  phone: string,
  city: string,
) {
  const answers: Record<string, string | string[]> = {};
  let preferredDate: string | null = null;
  for (const q of f.questions) {
    if (q.type === "photos") {
      if (uploaded[q.id]?.length) answers[q.id] = uploaded[q.id];
      continue;
    }
    const raw = a[q.id];
    if (Array.isArray(raw)) {
      if (raw.length) answers[q.id] = raw;
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) continue;
    answers[q.id] = v;
    if (q.type === "date" && !preferredDate) preferredDate = v;
  }
  const name =
    [user.firstName, user.lastName]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" ") || "Outsyde customer";
  // F2b: exactly one of businessId or photographerId (backend F2a refuses both).
  return {
    ...(f.vendorType === "photographer"
      ? { photographerId: f.business.id }
      : { businessId: f.business.id }),
    serviceId: f.service.id,
    city: city.trim() || null,
    name,
    email: user.email,
    phone: phone.trim(),
    preferredDate,
    source: "app",
    answers,
  };
}

// ─── The pop-up ─────────────────────────────────────────────────────────────

export type QuoteAction = {
  kind:
    | "update_card"
    | "update_extras_card"
    | "pay_extras"
    | "approve_extra"
    | "confirm_or_report";
  quoteId: string;
  conversationId: string;
  businessName: string | null;
  title: string;
  amountCents?: number;
  extraId?: string;
  description?: string;
  serviceFeeCents?: number;
  totalCents?: number;
  endsAt?: unknown;
};

export function actionKey(a: QuoteAction): string {
  return [a.kind, a.quoteId, a.extraId].filter(Boolean).join(":");
}

/** The first thing not put off with Not now. The backend already sends money first. */
export function nextAction(
  list: QuoteAction[],
  snoozed: Set<string>,
): QuoteAction | null {
  return list.find((a) => !snoozed.has(actionKey(a))) ?? null;
}

export function actionCopy(a: QuoteAction): {
  pill: string;
  title: string;
  body: string;
  button: string;
  start: Start;
} {
  const name = a.businessName?.trim() || "The business";
  const t = a.title.trim();
  switch (a.kind) {
    case "update_card":
      return {
        pill: "Card needed",
        title: `Update your card for ${t}`,
        body: `We couldn't hold the balance, ${money(a.amountCents)}, on your card.`,
        button: "Update your card",
        start: "balance-card",
      };
    case "update_extras_card":
      return {
        pill: "Card needed",
        title: `Update your card for ${t}`,
        body: `We couldn't hold the extras, ${money(a.amountCents)}, on your card.`,
        button: "Update your card",
        start: "extras-card",
      };
    case "pay_extras":
      return {
        pill: "Extras unpaid",
        title: `Pay for extras on ${t}`,
        body: `We couldn't charge your card for the extras, ${money(a.amountCents)}.`,
        button: "Pay for extras",
        start: "extras-card",
      };
    case "approve_extra":
      return {
        pill: "Needs your OK",
        title: `${name} added ${a.description?.trim() || "an extra"}`,
        body: `${money(a.totalCents)} with the service fee. Nothing is charged unless you approve.`,
        button: "Review",
        start: `approve:${a.extraId}` as Start,
      };
    case "confirm_or_report":
      return {
        pill: "Job complete",
        title: `How did ${t} go?`,
        body: `Confirm the job, or report a problem within 6 hours. Otherwise ${name} is paid.`,
        button: "Confirm or report",
        start: "window",
      };
  }
}

// ─── The Quotes tab ─────────────────────────────────────────────────────────

type ListQuote = Pick<
  Quote,
  | "id"
  | "status"
  | "title"
  | "businessName"
  | "jobDate"
  | "startTime"
  | "durationMinutes"
  | "kind"
  | "dueDate"
  | "paying"
  | "window"
  | "report"
> & { sentAt?: string | null };
type ListRequest = {
  id: string;
  status: string;
  serviceName: string | null;
  businessName: string | null;
  conversationId: string | null;
  createdAt: string;
};
export type TabRow = {
  key: string;
  kind: "quote" | "request";
  id: string;
  title: string;
  sub: string;
  chip: string;
  needsYou: boolean;
  at: number;
  conversationId?: string | null;
};

export function requestChip(status: string): string {
  return (
    (
      {
        new: "Waiting for a quote",
        called: "Waiting for a quote",
        quoted: "Quoted",
        booked: "Booked",
        closed: "Closed",
      } as Record<string, string>
    )[status] ?? "Sent"
  );
}

export function quotesTabRows(
  quotes: ListQuote[],
  requests: ListRequest[],
  actions: QuoteAction[],
): TabRow[] {
  const waiting = new Set(actions.map((a) => a.quoteId));
  const rows: TabRow[] = [
    ...quotes.map((q) => {
      const needs = waiting.has(q.id);
      const when = whenLine(q);
      const pay = q.status === "sent" && !q.paying;
      return {
        key: `quote:${q.id}`,
        kind: "quote" as const,
        id: q.id,
        title: q.title,
        sub: [q.businessName?.trim() || "", when].filter(Boolean).join(", "),
        chip: needs ? "Needs you" : quoteChip(q),
        needsYou: needs || pay,
        at: Date.parse(q.sentAt ?? "") || 0,
      };
    }),
    ...requests.map((r) => ({
      key: `request:${r.id}`,
      kind: "request" as const,
      id: r.id,
      title: r.serviceName?.trim() || "Request",
      sub: r.businessName?.trim() || "",
      chip: requestChip(r.status),
      needsYou: false,
      at: Date.parse(r.createdAt) || 0,
      conversationId: r.conversationId,
    })),
  ];
  return rows.sort((a, b) => b.at - a.at);
}

// ─── Activity ───────────────────────────────────────────────────────────────

const QUOTE_TYPES = new Set([
  "quote_extra",
  "quote_paid",
  "quote_extra_approved",
  "quote_extra_declined",
  "quote_problem_reported",
  "quote_card_failed",
]);

/** The quote an Activity row opens (step 6a notices), or null for any other row. */
export function activityQuoteId(n: {
  type: string;
  metadata?: Record<string, unknown> | null;
}): string | null {
  if (!QUOTE_TYPES.has(n.type)) return null;
  const id = n.metadata?.quoteId;
  return typeof id === "string" && id ? id : null;
}

/**
 * Quotes in the app, businesses (step 6d-1). Pure: no React Native, no network. Tested in utils/quoteSendLogic.test.ts.
 *
 * Legend 2026-11-05 (step 6d calls 1 to 6, all as recommended):
 *   - 2: Create a quote in the chat's + menu for the business owner in any customer chat, and for active staff in
 *        their own chats (sent for the business the app picked). Customers see Photos and Camera only. Add an extra
 *        only when the chat has a paid quote whose booking is still open.
 *   - 3: services only. The form follows the backend's checkQuoteInput (server/quotes/quoteRules.ts); the expiry is
 *        set by the backend and shown as text.
 *   - 4: Review shows what the customer gets, then Send. Edit (a new version) and Withdraw until paid.
 *   - 5: Add an extra (checkExtraInput, server/quotes/quoteExtrasRules.ts). "The customer pays a service fee on top".
 *   - 6: Job complete on the quote screen and the booked card, with a check first.
 * Copy uses commas and periods only and never the fee rate. The app never works out a fee: amounts with the fee
 * come from the backend after sending.
 */
import {
  bookingOpen,
  durationLabel,
  jobCompleteState,
  money,
  type Quote,
} from "./quoteLogic";

export { bookingOpen, jobCompleteState };

// The backend's limits (quoteRules.ts, quoteExtrasRules.ts).
const QUOTE_MIN_CENTS = 700;
const QUOTE_MAX_CENTS = 10_000_000;
const MAX_TITLE = 120;
const MAX_DETAILS = 2000;
const MAX_EXTRAS_NOTE = 300;
const MIN_MINUTES = 15;
const MAX_MINUTES = 3 * 24 * 60;
const EXTRA_MIN_CENTS = 100;
const EXTRA_MAX_CENTS = 1_000_000;
const EXTRA_MIN_DESC = 3;
const EXTRA_MAX_DESC = 200;

export const EXPIRY_LINE =
  "The customer has 7 days to pay, or until the day before the job if that is sooner. A job less than a day away can be paid until it starts.";
export const EXTRA_FEE_LINE =
  "The customer pays a service fee on top. Nothing is charged unless they approve.";

// ─── Money input ───────────────────────────────────────────────────────────

/** "$1,250.50" to 125050. null when it isn't a plain amount with at most 2 decimals. */
export function parseDollars(text: string): number | null {
  const t = (text ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

/** 65000 to "650", 125050 to "1250.50". */
export function centsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest ? `${whole}.${String(rest).padStart(2, "0")}` : String(whole);
}

// ─── The form ──────────────────────────────────────────────────────────────

export type QuoteForm = {
  /** Deliverables D2: a service has a date, start and length; a deliverable (a cake, a dress) has an optional due date. */
  kind: "service" | "product";
  dueDate: string;
  fulfillment: "pickup" | "delivery";
  deliveryFee: string;
  productId: string | null;
  title: string;
  jobDate: string;
  startTime: string;
  durationMinutes: number | null;
  details: string;
  extrasNote: string;
  total: string;
  paymentMode: "deposit" | "full";
  deposit: string;
  restPaid: "outsyde" | "outside";
  serviceId: string | null;
  requestId: string | null;
};

export type QuoteBody = {
  kind: "service" | "product";
  title: string;
  /** Services only. Deliverables send null. */
  jobDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  /** Deliverables only (D1a/D2). */
  dueDate?: string | null;
  fulfillment?: "pickup" | "delivery";
  deliveryFeeCents?: number | null;
  productId?: string | null;
  details: string | null;
  extrasNote: string | null;
  totalCents: number;
  paymentMode: "deposit" | "full";
  depositCents: number | null;
  restPaid: "outsyde" | "outside";
  serviceId: string | null;
  requestId?: string;
};

export type Fail = { ok: false; field: string; message: string };

export function emptyForm(): QuoteForm {
  return {
    kind: "service",
    dueDate: "",
    fulfillment: "pickup",
    deliveryFee: "",
    productId: null,
    title: "",
    jobDate: "",
    startTime: "",
    durationMinutes: null,
    details: "",
    extrasNote: "",
    total: "",
    paymentMode: "deposit",
    deposit: "",
    restPaid: "outsyde",
    serviceId: null,
    requestId: null,
  };
}

const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
function isRealDate(v: string): boolean {
  if (!isYmd(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Edit: the form from the live quote. */
export function formFromQuote(q: Quote): QuoteForm {
  const any = q as any;
  return {
    kind: q.kind === "product" ? "product" : "service",
    dueDate: q.dueDate ?? "",
    fulfillment: any.fulfillment === "delivery" ? "delivery" : "pickup",
    deliveryFee: centsInput(any.deliveryFeeCents ?? null),
    productId: any.productId ?? null,
    title: q.title,
    jobDate: q.jobDate ?? "",
    startTime: (q.startTime ?? "").slice(0, 5),
    durationMinutes: q.durationMinutes ?? null,
    details: q.details ?? "",
    extrasNote: q.extrasNote ?? "",
    total: centsInput(q.totalCents),
    paymentMode: q.paymentMode,
    deposit: centsInput(q.depositCents),
    restPaid: q.restPaid === "outside" ? "outside" : "outsyde",
    serviceId: q.serviceId ?? null,
    requestId: null,
  };
}

/** Send a quote from a request card: the service, the preferred date (when it is a real date) and the request. */
export function formFromRequest(c: {
  requestId?: string;
  serviceId?: string | null;
  serviceName?: string | null;
  preferredDate?: string | null;
}): QuoteForm {
  return {
    ...emptyForm(),
    title: (c.serviceName ?? "").trim().slice(0, MAX_TITLE),
    jobDate:
      c.preferredDate && isRealDate(c.preferredDate) ? c.preferredDate : "",
    serviceId: c.serviceId ?? null,
    requestId: c.requestId ?? null,
  };
}

/** The request body for POST /api/quotes and PATCH /api/quotes/:id, checked like the backend checks it. */
export function formToBody(f: QuoteForm): { ok: true; body: QuoteBody } | Fail {
  const title = f.title.trim().replace(/\s+/g, " ");
  if (!title)
    return { ok: false, field: "title", message: "Give the quote a title." };
  if (title.length > MAX_TITLE)
    return {
      ok: false,
      field: "title",
      message: `Keep the title to ${MAX_TITLE} characters.`,
    };
  const details = f.details.trim();
  if (details.length > MAX_DETAILS)
    return {
      ok: false,
      field: "details",
      message: "Keep what's included to 2,000 characters.",
    };
  const extrasNote = f.extrasNote.trim();
  if (extrasNote.length > MAX_EXTRAS_NOTE)
    return {
      ok: false,
      field: "extrasNote",
      message: `Keep the extras note to ${MAX_EXTRAS_NOTE} characters.`,
    };
  const product = f.kind === "product";
  let len: number | null = null;
  if (product) {
    // Deliverables: no time and no length; the due date is optional.
    if (f.dueDate && !isRealDate(f.dueDate))
      return { ok: false, field: "dueDate", message: "Choose a real due date." };
  } else {
    if (!isRealDate(f.jobDate))
      return {
        ok: false,
        field: "jobDate",
        message: "Choose the date of the job.",
      };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.startTime))
      return { ok: false, field: "startTime", message: "Choose a start time." };
    len = f.durationMinutes;
    if (
      len === null ||
      !Number.isInteger(len) ||
      len < MIN_MINUTES ||
      len > MAX_MINUTES
    ) {
      return {
        ok: false,
        field: "durationMinutes",
        message: "Choose how long the job takes, from 15 minutes to 3 days.",
      };
    }
  }
  const total = parseDollars(f.total);
  if (total === null || total < QUOTE_MIN_CENTS)
    return {
      ok: false,
      field: "totalCents",
      message: "The total must be at least $7.00.",
    };
  if (total > QUOTE_MAX_CENTS)
    return {
      ok: false,
      field: "totalCents",
      message: "The total can be up to $100,000.00.",
    };
  let depositCents: number | null = null;
  if (f.paymentMode === "deposit") {
    const d = parseDollars(f.deposit);
    if (d === null)
      return {
        ok: false,
        field: "depositCents",
        message: "Enter the deposit.",
      };
    if (d < QUOTE_MIN_CENTS)
      return {
        ok: false,
        field: "depositCents",
        message: "The deposit must be at least $7.00.",
      };
    if (d >= total)
      return {
        ok: false,
        field: "depositCents",
        message:
          "The deposit must be less than the total. Choose full payment instead.",
      };
    depositCents = d;
  }
  let deliveryFeeCents: number | null = null;
  if (product && f.fulfillment === "delivery" && f.deliveryFee.trim()) {
    const fee = parseDollars(f.deliveryFee);
    if (fee === null || fee < 0)
      return { ok: false, field: "deliveryFeeCents", message: "Enter the delivery fee." };
    if (fee >= total)
      return {
        ok: false,
        field: "deliveryFeeCents",
        message: "The delivery fee is part of the total, so it must be less than the total.",
      };
    deliveryFeeCents = fee > 0 ? fee : null;
  }
  const body: QuoteBody = product
    ? {
        kind: "product",
        title,
        jobDate: null,
        startTime: null,
        durationMinutes: null,
        dueDate: f.dueDate || null,
        fulfillment: f.fulfillment,
        deliveryFeeCents,
        productId: f.productId ?? null,
        details: details || null,
        extrasNote: null,
        totalCents: total,
        paymentMode: f.paymentMode,
        depositCents,
        // D1a rule: a deliverable's deposit has the rest paid directly to the business.
        restPaid: f.paymentMode === "deposit" ? "outside" : "outsyde",
        serviceId: null,
      }
    : {
        kind: "service",
        title,
        jobDate: f.jobDate,
        startTime: f.startTime,
        durationMinutes: len,
        details: details || null,
        extrasNote: extrasNote || null,
        totalCents: total,
        paymentMode: f.paymentMode,
        depositCents,
        restPaid: f.paymentMode === "deposit" ? f.restPaid : "outsyde",
        serviceId: f.serviceId ?? null,
      };
  if (f.requestId) body.requestId = f.requestId;
  return { ok: true, body };
}

/** The job lengths to pick from: 15 minutes to 3 days, plus a saved length that isn't in the list. */
export function durationOptions(
  keep?: number | null,
): { value: string; label: string }[] {
  const mins = new Set<number>([15, 30, 45]);
  for (let m = 60; m <= 12 * 60; m += 30) mins.add(m);
  for (let h = 13; h <= 24; h++) mins.add(h * 60);
  for (let h = 30; h <= 72; h += 6) mins.add(h * 60);
  if (
    keep &&
    Number.isInteger(keep) &&
    keep >= MIN_MINUTES &&
    keep <= MAX_MINUTES
  )
    mins.add(keep);
  return [...mins]
    .sort((a, b) => a - b)
    .map((m) => ({ value: String(m), label: lengthLabel(m) }));
}

/** "3 hours", "1 day", "2 days 12 hours". */
export function lengthLabel(min: number): string {
  if (min < 24 * 60) return durationLabel(min);
  const d = Math.floor(min / (24 * 60));
  const rest = min - d * 24 * 60;
  const days = `${d} ${d === 1 ? "day" : "days"}`;
  return rest ? `${days} ${durationLabel(rest)}` : days;
}

/** Review: the business's own amounts (the customer pays a service fee on top, worked out by the backend). */
export function reviewLines(
  b: Pick<
    QuoteBody,
    "totalCents" | "paymentMode" | "depositCents" | "restPaid"
  >,
): { label: string; value: string }[] {
  if (b.paymentMode === "full" || b.depositCents === null) {
    return [
      { label: "Quote total", value: money(b.totalCents) },
      { label: "Paid in full now", value: money(b.totalCents) },
    ];
  }
  const rest = b.totalCents - b.depositCents;
  return [
    { label: "Quote total", value: money(b.totalCents) },
    { label: "Deposit to pay now", value: money(b.depositCents) },
    b.restPaid === "outside"
      ? { label: "The rest, paid to you directly", value: money(rest) }
      : {
          label: "The rest, held on the customer's card the day before",
          value: money(rest),
        },
  ];
}

// ─── Extras ────────────────────────────────────────────────────────────────

export function checkExtra(
  description: string,
  amount: string,
): { ok: true; body: { description: string; amountCents: number } } | Fail {
  const d = (description ?? "").trim().replace(/\s+/g, " ");
  if (d.length < EXTRA_MIN_DESC)
    return {
      ok: false,
      field: "description",
      message: "Say what the extra is.",
    };
  if (d.length > EXTRA_MAX_DESC)
    return {
      ok: false,
      field: "description",
      message: `Keep it to ${EXTRA_MAX_DESC} characters.`,
    };
  const a = parseDollars(amount);
  if (a === null || a < EXTRA_MIN_CENTS)
    return {
      ok: false,
      field: "amountCents",
      message: "An extra must be at least $1.00.",
    };
  if (a > EXTRA_MAX_CENTS)
    return {
      ok: false,
      field: "amountCents",
      message: "An extra can be up to $10,000.00.",
    };
  return { ok: true, body: { description: d, amountCents: a } };
}

// ─── Who sends ─────────────────────────────────────────────────────────────

type Viewer =
  | {
      id?: string;
      role?: string;
      businessId?: string;
      staffBusinessId?: string;
      isAdmin?: boolean;
    }
  | null
  | undefined;

/**
 * Can this user send quotes in this chat, and for which business? Owners: the business they own (the backend picks
 * it, so no id is sent). Staff: the business the app picked. A chat with a business means you are its customer.
 */
export function sendSide(
  user: Viewer,
  participantType: string | null | undefined,
  selfChat = false,
  // Review 2: false until the chat's other side is known (a push can open the chat before the inbox loads, and the
  // screen then defaults the other side to a customer).
  known = true,
): { businessId: string | undefined } | null {
  if (!user || selfChat || !known || participantType === "business")
    return null;
  if (user.role === "business" || (user.role !== "staff" && user.businessId))
    return { businessId: undefined };
  if (user.role === "staff" && user.staffBusinessId)
    return { businessId: user.staffBusinessId };
  return null;
}

/**
 * The PATCH body (review 3): the service is left out unless it changed, so the backend keeps the saved one (a
 * service retired since would otherwise block every edit). The request is never sent on an edit.
 */
export function editBody(
  body: QuoteBody,
  savedServiceId: string | null,
  savedProductId: string | null = null,
): Omit<QuoteBody, "requestId" | "serviceId" | "productId"> & { serviceId?: string | null; productId?: string | null } {
  const { requestId: _r, serviceId, productId, ...rest } = body;
  const out: Omit<QuoteBody, "requestId" | "serviceId" | "productId"> & { serviceId?: string | null; productId?: string | null } = { ...rest };
  if (serviceId !== savedServiceId) out.serviceId = serviceId;
  // Deliverables D2: the product goes the same way (left out when unchanged, so a retired product never blocks an edit).
  if (body.kind === "product" && (productId ?? null) !== savedProductId) out.productId = productId ?? null;
  return out;
}

export type ComposerKey = "camera" | "library" | "quote" | "extra";

/** The chat's + menu. */
export function composerOptions(o: {
  business: boolean;
  extraCount: number;
  photoRoom: number;
}): { key: ComposerKey; label: string }[] {
  const out: { key: ComposerKey; label: string }[] = [];
  if (o.photoRoom > 0)
    out.push(
      { key: "camera", label: "Take photo" },
      { key: "library", label: "Choose from library" },
    );
  if (o.business) {
    out.push({ key: "quote", label: "Create a quote" });
    if (o.extraCount > 0) out.push({ key: "extra", label: "Add an extra" });
  }
  return out;
}

/** The quotes in this chat that can take an extra (call 2), for a business viewer. */
export function extraTargets(
  list: (Quote | null | undefined)[],
  user: Viewer,
): Quote[] {
  return list.filter(
    (q): q is Quote => !!q && bookingOpen(q) && canManageView(q, user),
  );
}

/**
 * Does this viewer see the business buttons on a quote? The backend only lets the customer, the business (owner or
 * the sending staff member) and Outsyde admin read a quote, so anyone else who isn't the customer is the business,
 * except an admin who isn't the sender or this business's owner. The backend checks every action again.
 */
export function canManageView(
  q: Pick<Quote, "customerId" | "senderId" | "businessId">,
  user: Viewer,
): boolean {
  if (!user?.id || q.customerId === user.id) return false;
  if (q.senderId === user.id) return true;
  if (user.isAdmin)
    return !!user.businessId && user.businessId === q.businessId;
  return true;
}

// ─── Job complete ──────────────────────────────────────────────────────────

export function jobCompleteConfirm(
  q: Pick<Quote, "paymentMode" | "restPaid" | "amounts">,
): string {
  const outside = q.restPaid === "outside" || q.amounts?.restPaid === "outside";
  if (q.paymentMode === "deposit" && !outside) {
    return "This charges the balance and any approved extras. The customer then has 6 hours to confirm or report a problem.";
  }
  return "This charges any approved extras. The customer then has 6 hours to confirm or report a problem.";
}

// ─── Business wording on the quote screen ──────────────────────────────────

export function vendorBalanceLine(
  q: Pick<Quote, "paymentMode" | "amounts" | "balance">,
): string | null {
  if (q.paymentMode === "full") return null;
  if (q.amounts.restPaid === "outside")
    return `The customer pays the rest, ${money(q.amounts.paidDirectlyCents)}, to you directly.`;
  const b = q.balance;
  if (!b || b.status === "none") return null;
  const amt = money(b.holdCents);
  switch (b.status) {
    case "scheduled":
      return `The balance, ${amt}, is held on the customer's card the day before the job.`;
    case "holding":
      return `The balance, ${amt}, is being held on the customer's card.`;
    case "held":
    case "capturing":
      return `The balance, ${amt}, is on hold on the customer's card. It is charged when you mark the job complete.`;
    case "captured":
      return `The balance, ${money(b.capturedCents ?? b.holdCents)}, was charged.`;
    case "hold_failed":
      return b.needsNewCard
        ? `The balance, ${amt}, couldn't be held on the customer's card. They have been asked to update their card.`
        : `The balance, ${amt}, couldn't be held on the customer's card yet. Outsyde tries again before the job.`;
    default:
      return null;
  }
}

export function vendorExtraStatusLine(
  x: { status: string },
  p: { status: string } | null | undefined,
): string {
  switch (x.status) {
    case "proposed":
      return "Waiting for the customer to approve.";
    case "approving":
      return "The customer's bank is confirming.";
    case "approved":
      if (p?.status === "captured") return "Approved and charged.";
      if (p?.status === "held") return "Approved, held on the card.";
      if (p?.status === "scheduled")
        return "Approved. It is held on the card the day before the job.";
      if (p?.status === "hold_failed")
        return "Approved, but it couldn't be held on the customer's card yet.";
      return "Approved.";
    case "declined":
      return "The customer declined. Nothing was added.";
    case "withdrawn":
      return "You took this back. Nothing was added.";
    case "lapsed":
      return "Not answered before the job was complete. Nothing was added.";
    case "canceled":
      return "The booking ended. Nothing was added.";
    default:
      return "";
  }
}

/** The extras payment as the business sees it (the customer's own wording is in quoteLogic extrasPaymentLine). */
export function vendorExtrasPaymentLine(
  p: Quote["extrasPayment"],
): string | null {
  if (!p || p.approvedCents <= 0) return null;
  const amt = money(p.holdCents);
  if (p.unpaid)
    return `The customer's card couldn't be charged for the extras, ${amt}. They have been asked to pay.`;
  if (p.needsNewCard)
    return `The extras, ${amt}, couldn't be held on the customer's card. They have been asked to update it. The job can't be marked complete until then.`;
  if (p.status === "captured")
    return `Extras charged, ${money(p.capturedCents ?? p.holdCents)}.`;
  if (p.status === "held")
    return `Approved extras, ${amt}, are on hold on the customer's card.`;
  if (p.status === "scheduled")
    return `Approved extras, ${amt}, are held on the customer's card the day before the job.`;
  return null;
}

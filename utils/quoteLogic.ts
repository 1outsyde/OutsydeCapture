/**
 * Quotes in the app, customers (step 6c-1). Pure: no React Native, no network. Tested in utils/quoteLogic.test.ts.
 *
 * Legend 2026-11-05 (step 6c calls, all as recommended):
 *   - 2: each chat card shows a short summary and its one main button; View quote opens the quote screen.
 *   - 3: the card reads the quote itself (GET /api/quotes/:id), so an old card never shows a stale button.
 *   - 4: Pay, Update your card and Pay for extras use the payment sheet; Approve uses the card on file with a bank
 *        check (3D Secure) when the bank asks, and Use another card opens the sheet.
 * The quote screen's wording matches goutsyde.com/q (outsyde-web app/q/[code]/quoteLogic.ts). Copy uses commas and
 * periods only and never the fee rate. Money lines always come from the backend's amounts, never worked out here.
 */

export type Amounts = {
  totalCents: number;
  depositOrTotalCents: number;
  serviceFeeCents: number;
  payNowCents: number;
  balanceCents: number;
  balanceServiceFeeCents: number;
  balanceTotalCents: number;
  restPaid: "outsyde" | "outside";
  paidDirectlyCents: number;
};
export type Extra = {
  id: string;
  description: string;
  amountCents: number;
  serviceFeeCents: number;
  totalCents: number;
  status: string;
  canApprove: boolean;
  canDecline: boolean;
  canWithdraw: boolean;
};
export type Quote = {
  id: string;
  version: number;
  status: string;
  kind: string;
  title: string;
  jobDate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  timeZone: string | null;
  dueDate: string | null;
  /** Deliverables (D1a/D1b, additive; older backends send none). */
  fulfillment?: "pickup" | "delivery" | null;
  deliveryFeeCents?: number | null;
  deliveryAddress?: string | null;
  productId?: string | null;
  orderId?: string | null;
  orderStatus?: string | null;
  totalCents: number;
  paymentMode: "deposit" | "full";
  depositCents: number | null;
  restPaid: string;
  amounts: Amounts;
  expiresAt: string;
  businessName: string | null;
  /** Step 6d-1 (already in the backend answer): the business, the job start, the linked service and request. */
  businessId?: string;
  startsAt?: string | null;
  serviceId?: string | null;
  requestId?: string | null;
  /** Step 6d-2a (backend #418): the paid quote's booking status, null before payment. Older backends omit it. */
  bookingStatus?: string | null;
  customerId: string;
  senderId: string;
  conversationId: string;
  details: string | null;
  extrasNote: string | null;
  paying: boolean;
  appointmentId: string | null;
  paidAt: string | null;
  balance: {
    status: string;
    holdCents: number;
    capturedCents: number | null;
    needsNewCard: boolean;
    completedAt: string | null;
  } | null;
  window: {
    state: string;
    endsAt: string | null;
    canConfirm: boolean;
    canReport: boolean;
  } | null;
  report: {
    status: "open" | "decided";
    outcome: "pay_full" | "partial_refund" | "full_refund" | null;
    refundCents: number | null;
  } | null;
  extras: Extra[];
  extrasPayment: {
    status: string;
    approvedCents: number;
    holdCents: number;
    capturedCents: number | null;
    needsNewCard: boolean;
    unpaid: boolean;
  } | null;
};

/** A quote or request card on a chat message (messages.card). Only the fields read here. */
export type Card = {
  type: "quote" | "request" | string;
  event?: string;
  quoteId?: string;
  version?: number;
  title?: string;
  content?: string;
  extraId?: string;
  description?: string;
  amountCents?: number;
  totalCents?: number;
  serviceName?: string;
  preferredDate?: string | null;
  requestId?: string;
  serviceId?: string | null;
  answerCount?: number;
};

export function money(cents: number | null | undefined): string {
  const c = Number(cents ?? 0);
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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

/** "Fri, Nov 13 at 9:00 AM, 3 hours". The job's own wall clock date and time, never shifted by the phone's zone. */
export function whenLine(
  p: Pick<
    Quote,
    "jobDate" | "startTime" | "durationMinutes" | "dueDate" | "kind"
  >,
): string {
  if (p.kind === "product") {
    // Deliverables D2: "Due Fri, Nov 20 · Pickup" once the backend says how (D1a); older cards keep "Due ...".
    const f = (p as { fulfillment?: string | null }).fulfillment;
    const how = f === "delivery" ? "Delivery" : f === "pickup" ? "Pickup" : "";
    const due = p.dueDate ? `Due ${dateLabel(p.dueDate)}` : "";
    return [due, how].filter(Boolean).join(" · ");
  }
  if (!p.jobDate) return "";
  const parts = [
    dateLabel(p.jobDate) + (p.startTime ? ` at ${timeLabel(p.startTime)}` : ""),
  ];
  if (p.durationMinutes) parts.push(durationLabel(p.durationMinutes));
  return parts.join(", ");
}
export function dateLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function timeLabel(hm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  if (!m) return hm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}
export function durationLabel(min: number): string {
  if (min < 60) return `${min} minutes`;
  const h = Math.floor(min / 60),
    r = min % 60;
  return `${h} ${h === 1 ? "hour" : "hours"}${r ? ` ${r} minutes` : ""}`;
}

export type Line = {
  label: string;
  cents: number;
  total?: boolean;
  muted?: boolean;
};

/** The money lines before paying. The rest paid directly reads as such, with no hold. */
export function payLines(a: Amounts, paymentMode: "deposit" | "full"): Line[] {
  if (paymentMode === "full")
    return [
      { label: "Quote total", cents: a.totalCents },
      { label: "Service fee", cents: a.serviceFeeCents },
      { label: "Pay now", cents: a.payNowCents, total: true },
    ];
  const lines: Line[] = [
    { label: "Quote total", cents: a.totalCents },
    { label: "Deposit today", cents: a.depositOrTotalCents },
    { label: "Service fee", cents: a.serviceFeeCents },
    { label: "Pay now", cents: a.payNowCents, total: true },
  ];
  if (a.restPaid === "outside")
    lines.push({
      label: "The rest, paid to the business directly",
      cents: a.paidDirectlyCents,
      muted: true,
    });
  else if (a.balanceTotalCents > 0)
    lines.push({
      label: "Balance, held on your card the day before",
      cents: a.balanceTotalCents,
      muted: true,
    });
  return lines;
}

export type Stage =
  | "pay"
  | "paying"
  | "closed"
  | "booked"
  | "window"
  | "reported"
  | "decided"
  | "complete";

export function stageOf(
  q: Pick<Quote, "status" | "paying" | "window" | "report">,
): Stage {
  if (q.status === "sent") return q.paying ? "paying" : "pay";
  if (q.status !== "paid") return "closed";
  if (q.report?.status === "decided") return "decided";
  if (q.report || q.window?.state === "reported") return "reported";
  if (q.window?.state === "open") return "window";
  if (q.window && ["confirmed", "closed"].includes(q.window.state))
    return "complete";
  return "booked";
}

/** The customer can pay this quote here and now (review I2: the same check on the card and the screen). */
export function canPayNow(
  q: Pick<
    Quote,
    "status" | "paying" | "window" | "report" | "kind" | "jobDate" | "startTime"
  > &
    Partial<Pick<Quote, "fulfillment" | "deliveryAddress">>,
): boolean {
  if (stageOf(q) !== "pay") return false;
  // Deliverables D2: paid as a product order; a Delivery quote needs the customer's address first.
  if (q.kind === "product") return q.fulfillment !== "delivery" || !!q.deliveryAddress;
  return !!q.jobDate && !!q.startTime;
}

export function quoteChip(
  q: Pick<Quote, "status" | "paying" | "window" | "report">,
): string {
  const s = stageOf(q);
  return (
    {
      pay: "Ready to pay",
      paying: "Paying",
      closed:
        q.status === "withdrawn"
          ? "Withdrawn"
          : q.status === "declined"
            ? "Declined"
            : "Expired",
      booked: "Booked",
      window: "Confirm or report",
      reported: "Under review",
      decided: "Reviewed",
      complete: "Complete",
    } as Record<Stage, string>
  )[s];
}

export function closedLine(status: string): string {
  if (status === "withdrawn")
    return "The business took this quote back. Message them if you still want the job.";
  if (status === "declined") return "You declined this quote.";
  if (status === "expired")
    return "This quote has expired. Message the business for a new one.";
  return "This quote can't be paid now.";
}

export type Action = { kind: "balance-card" | "extras-card"; label: string };

/** The balance as the customer sees it after paying. */
export function balanceLine(
  q: Pick<Quote, "amounts" | "balance" | "paymentMode">,
): { text: string; action?: Action } | null {
  if (q.paymentMode === "full") return null;
  if (q.amounts.restPaid === "outside")
    return {
      text: `The rest, ${money(q.amounts.paidDirectlyCents)}, is paid to the business directly.`,
    };
  const b = q.balance;
  if (!b || b.status === "none") return null;
  const amt = money(b.holdCents);
  switch (b.status) {
    case "scheduled":
      return {
        text: `The balance, ${amt}, is held on your card the day before the job.`,
      };
    case "holding":
      return { text: `We're holding the balance, ${amt}, on your card.` };
    case "held":
    case "capturing":
      return {
        text: `The balance, ${amt}, is on hold on your card. It is charged when the job is complete.`,
      };
    case "captured":
      return {
        text: `The balance, ${money(b.capturedCents ?? b.holdCents)}, was charged.`,
      };
    case "hold_failed":
      return b.needsNewCard
        ? {
            text: `We couldn't hold the balance, ${amt}, on your card. Update your card to keep this booking.`,
            action: { kind: "balance-card", label: "Update your card" },
          }
        : {
            text: `We couldn't hold the balance, ${amt}, on your card. We'll try again before the job.`,
          };
    default:
      return null;
  }
}

/** The extras payment line (Pay for extras, Update your card). */
export function extrasPaymentLine(
  p: Quote["extrasPayment"],
): { text: string; action?: Action } | null {
  if (!p || p.approvedCents <= 0) return null;
  const amt = money(p.holdCents);
  if (p.unpaid)
    return {
      text: `We couldn't charge your card for the extras, ${amt}. Pay for extras to finish your booking.`,
      action: { kind: "extras-card", label: "Pay for extras" },
    };
  if (p.needsNewCard)
    return {
      text: `We couldn't hold the extras, ${amt}, on your card. Update your card so the job can be marked complete.`,
      action: { kind: "extras-card", label: "Update your card" },
    };
  if (p.status === "captured")
    return {
      text: `Extras charged, ${money(p.capturedCents ?? p.holdCents)}.`,
    };
  if (p.status === "scheduled")
    return {
      text: `Approved extras, ${amt}, are held on your card the day before the job.`,
    };
  if (p.status === "held")
    return {
      text: `Approved extras, ${amt}, are on hold on your card. They are charged when the job is complete.`,
    };
  return null;
}

export function extraStatusLine(x: Pick<Extra, "status">): string {
  switch (x.status) {
    case "proposed":
      return "Nothing is charged unless you approve.";
    case "approving":
      return "Waiting for your bank to confirm.";
    case "approved":
      return "Approved. It is charged when the job is complete.";
    case "declined":
      return "Declined. Nothing was added.";
    case "withdrawn":
      return "The business took this back. Nothing was added.";
    case "lapsed":
      return "Not answered before the job was complete. Nothing was added.";
    case "canceled":
      return "The booking ended. Nothing was added.";
    default:
      return "";
  }
}

/** "4 h 52 min left" in the 6 hour window. */
export function windowLeft(endsAt: string | null, nowMs: number): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - nowMs;
  if (!(ms > 0)) return "The 6 hours are over.";
  const mins = Math.ceil(ms / 60_000);
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return h > 0 ? `${h} h ${m} min left` : `${m} min left`;
}

export const REASON_MIN = 10,
  REASON_MAX = 1000,
  MAX_PHOTOS = 5;
export function reportProblem(reason: string, photos: number): string | null {
  const t = reason.trim();
  if (t.length < REASON_MIN)
    return `Tell us what went wrong in at least ${REASON_MIN} characters.`;
  if (t.length > REASON_MAX) return "Keep it to 1,000 characters.";
  if (photos > MAX_PHOTOS) return `Add up to ${MAX_PHOTOS} photos.`;
  return null;
}

export function decidedLine(
  r: NonNullable<Quote["report"]>,
  businessName: string,
): string {
  const name = businessName || "The business";
  if (r.outcome === "full_refund")
    return "Outsyde reviewed your report. You get a full refund.";
  if (r.outcome === "partial_refund")
    return `Outsyde reviewed your report. You get ${money(r.refundCents)} back and the rest is paid to ${name}.`;
  return `Outsyde reviewed your report. ${name} is paid in full.`;
}

/** The booking is paid and still open (not marked complete): extras and Job complete apply (step 6d-1). */
export function bookingOpen(
  q: Pick<Quote, "status" | "kind" | "appointmentId" | "balance" | "window"> &
    Partial<Pick<Quote, "bookingStatus">>,
): boolean {
  return (
    q.status === "paid" &&
    // Step 6d-2b (call 6): a canceled or ended booking is not open. No field (an older backend): as before.
    (q.bookingStatus == null || q.bookingStatus === "confirmed") &&
    q.kind !== "product" &&
    !!q.appointmentId &&
    !q.balance?.completedAt &&
    !q.window
  );
}

/** Job complete (step 6d-1). show: the button belongs here. ready: the job has started (the backend refuses before). */
export function jobCompleteState(
  q: Pick<
    Quote,
    "status" | "kind" | "appointmentId" | "balance" | "window" | "startsAt"
  > &
    Partial<Pick<Quote, "bookingStatus">>,
  nowMs: number,
): { show: boolean; ready: boolean; hint?: string } {
  if (!bookingOpen(q)) return { show: false, ready: false };
  const starts = q.startsAt ? new Date(q.startsAt).getTime() : NaN;
  if (Number.isFinite(starts) && nowMs >= starts)
    return { show: true, ready: true };
  return {
    show: true,
    ready: false,
    hint: "You can mark the job complete once it starts.",
  };
}

// ─── Chat cards ─────────────────────────────────────────────────────────────

/** What a card button starts on the quote screen. */
export type Start =
  | "view"
  | "pay"
  | "balance-card"
  | "extras-card"
  | "window"
  | `approve:${string}`
  | `decline:${string}`
  // Step 6d-1, business side: Job complete and Add an extra on the quote screen; Send a quote from a request card.
  | "job-complete"
  | "extra"
  | "send-quote";
export type CardButton = { label: string; start: Start; primary?: boolean };
export type CardView = {
  pill: string;
  title?: string;
  when?: string;
  body?: string;
  amount?: string;
  note?: string;
  buttons: CardButton[];
};

const PILLS: Record<string, string> = {
  sent: "Quote",
  updated: "Updated quote",
  withdrawn: "Quote withdrawn",
  declined: "Quote declined",
  expired: "Quote expired",
  paid: "Paid",
  balance_held: "Balance held",
  balance_failed: "Card needed",
  extra_proposed: "Needs your OK",
  extra_approved: "Extra approved",
  extra_declined: "Extra declined",
  extra_withdrawn: "Extra withdrawn",
  extras_failed: "Extras unpaid",
  extras_hold_failed: "Card needed",
  extras_reminder: "Extras unpaid",
  job_complete: "Job complete",
  job_confirmed: "Confirmed",
  problem_reported: "Problem reported",
  report_decided: "Reviewed",
};

/**
 * One chat card. live: the quote now (null until it loads, or when it can't be read). Buttons only for the customer
 * and only while the quote now still needs that step; View quote is always there for a quote card.
 */
export function cardView(
  c: Card,
  live: Quote | null,
  viewer: { isCustomer: boolean; canManage?: boolean; nowMs?: number },
): CardView {
  const manage = !viewer.isCustomer && viewer.canManage === true;
  if (c.type === "request") {
    const when = c.preferredDate
      ? `Preferred date ${dateLabel(c.preferredDate)}`
      : undefined;
    return {
      pill: "Request",
      title: c.serviceName || "Request",
      when,
      body: c.answerCount
        ? `${c.answerCount} ${c.answerCount === 1 ? "answer" : "answers"}`
        : undefined,
      // Step 6d-1 (call 3): the business starts a quote from the request.
      buttons:
        manage && c.requestId
          ? [{ label: "Send a quote", start: "send-quote", primary: true }]
          : [],
    };
  }
  const ev = c.event ?? "";
  const view: CardButton = { label: "View quote", start: "view" };
  const out: CardView = {
    pill: PILLS[ev] ?? "Quote",
    title: c.title,
    buttons: [view],
  };
  const mine = viewer.isCustomer && !!live;
  if (ev === "sent" || ev === "updated") {
    if (live) {
      out.when = whenLine(live) || undefined;
      out.amount = money(live.totalCents);
    }
    if (!live) return out;
    if (
      typeof c.version === "number" &&
      live.version > c.version &&
      live.status === "sent"
    )
      out.note = "This quote was updated. Open the newest one.";
    else if (live.status === "paid") out.note = "Paid.";
    else if (live.status !== "sent") out.note = closedLine(live.status);
    else if (live.paying) out.note = "Your payment is being confirmed.";
    else if (mine && canPayNow(live))
      out.buttons = [
        {
          label: `Pay ${money(live.amounts.payNowCents)}`,
          start: "pay",
          primary: true,
        },
        view,
      ];
    return out;
  }
  if (ev === "extra_proposed") {
    out.title = c.description || c.title;
    if (typeof c.totalCents === "number")
      out.amount = `${money(c.totalCents)} with the service fee`;
    const x = live?.extras.find((e) => e.id === c.extraId);
    if (!x) return out;
    if (mine && x.canApprove) {
      out.note = extraStatusLine(x);
      out.buttons = [
        {
          label: `Approve ${money(x.totalCents)}`,
          start: `approve:${x.id}`,
          primary: true,
        },
        { label: "Decline", start: `decline:${x.id}` },
        view,
      ];
    } else out.note = extraStatusLine(x);
    return out;
  }
  out.body = c.content || undefined;
  // Step 6d-1 (call 6): Job complete on the booked card for the business, once the job has started.
  if (
    manage &&
    live &&
    // Review 9: one button per booking, on the paid card only.
    ev === "paid" &&
    jobCompleteState(live, viewer.nowMs ?? 0).ready
  ) {
    out.buttons = [
      { label: "Job complete", start: "job-complete", primary: true },
      view,
    ];
    return out;
  }
  if (!mine || !live) return out;
  if (ev === "balance_failed" && live.balance?.needsNewCard)
    out.buttons = [
      { label: "Update your card", start: "balance-card", primary: true },
      view,
    ];
  if (
    ev === "extras_failed" ||
    ev === "extras_hold_failed" ||
    ev === "extras_reminder"
  ) {
    const a = extrasPaymentLine(live.extrasPayment)?.action;
    if (a)
      out.buttons = [
        { label: a.label, start: "extras-card", primary: true },
        view,
      ];
  }
  if (
    ev === "job_complete" &&
    (live.window?.canConfirm || live.window?.canReport)
  )
    out.buttons = [
      { label: "Confirm or report", start: "window", primary: true },
      view,
    ];
  return out;
}

export function parseStart(s: string | undefined | null):
  | {
      kind:
        | "view"
        | "pay"
        | "balance-card"
        | "extras-card"
        | "window"
        | "job-complete"
        | "extra";
    }
  | { kind: "approve" | "decline"; extraId: string }
  | null {
  if (!s) return null;
  if (
    [
      "view",
      "pay",
      "balance-card",
      "extras-card",
      "window",
      "job-complete",
      "extra",
    ].includes(s)
  )
    return { kind: s as any };
  const m = /^(approve|decline):(.+)$/.exec(s);
  return m ? { kind: m[1] as "approve" | "decline", extraId: m[2] } : null;
}

/** The quotes behind the quote cards in a chat, once each, in order. */
export function quoteIdsIn(
  messages: { kind?: string | null; card?: Partial<Card> | null }[],
): string[] {
  const out: string[] = [];
  for (const m of messages) {
    const id = m.kind === "quote" ? m.card?.quoteId : undefined;
    if (typeof id === "string" && id && !out.includes(id)) out.push(id);
  }
  return out;
}

// ─── Payment steps ──────────────────────────────────────────────────────────

/**
 * After POST /extras/:id/approve. done: approved. bank / bank-setup: the saved card needs the bank's check
 * (handleNextAction for a hold, handleNextActionForSetup for a far out card check), then approve again.
 * sheet: Use another card, open the payment sheet with the secret, then approve again.
 */
export function approveStep(
  r: { status?: string; intentType?: string; clientSecret?: string },
  newCard: boolean,
): "done" | "bank" | "bank-setup" | "sheet" | "failed" {
  if (r.status === "approved") return "done";
  if (
    r.status !== "needs_action" ||
    typeof r.clientSecret !== "string" ||
    !r.clientSecret
  )
    return "failed";
  if (newCard) return "sheet";
  return r.intentType === "setup" ? "bank-setup" : "bank";
}

/** The payment sheet's answer. */
export function sheetOutcome(
  err: { code?: string; message?: string } | undefined | null,
):
  | { next: "done" }
  | { next: "canceled" }
  | { next: "failed"; message: string } {
  if (!err) return { next: "done" };
  if (err.code === "Canceled") return { next: "canceled" };
  return {
    next: "failed",
    message:
      err.message ||
      "Payment didn't go through. Try again or use another card.",
  };
}

/** A backend answer's own message, or a plain fallback (never a raw network error). */
export function errorMessage(
  err:
    | { message?: string; body?: Record<string, any> | null }
    | null
    | undefined,
): string {
  const b = err?.body;
  const m =
    (b &&
      (typeof b.message === "string"
        ? b.message
        : typeof b.error === "string"
          ? b.error
          : typeof b.error?.message === "string"
            ? b.error.message
            : "")) ||
    "";
  return (
    m.trim() || "Something went wrong. Check your connection and try again."
  );
}

# Events App p4-buy (buy tickets + My Tickets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paid ticket checkout in the app (card, Stripe PaymentSheet), a Tickets tab in Cart & activity, one-ticket screen with QR, directions, add to calendar, refund / cancel RSVP.

**Architecture:** All rules live in a new pure module `utils/ticketCheckoutLogic.ts` (node:test, no React). Screens stay thin: a full-screen buy modal on top of the event page (choose, pay, result), a Tickets tab rendered by a new `components/events/MyTicketsList.tsx` inside CartOrdersScreen, and a new `TicketDetail` stack screen. No backend change.

**Tech Stack:** Expo 57 / RN 0.86, @stripe/stripe-react-native 0.64 via `hooks/useStripePayment`, expo-calendar 57.0.6 (`expo-calendar/legacy`), node:test via `npx tsx --test`.

**Spec:** vault `Handoffs/2026-10-26 Events App p4-buy — Build, Next Chat Start Here` + `Events App p4-buy — Audit & Regression (2026-10-24)` + Events canvas screens 25 to 29 (AppPicker, AppPay, AppPaid, AppMyTickets, AppTicket).

## Global Constraints
- Backend routes (re-verified 2026-10-26 @ `1ecf12f`, `server/events/` identical to `3155182`): `POST /api/events/:id/checkout` body `{ticketTypeId, quantity 1-20, idempotencyKey 8-100}` (ticketCheckout.ts:274-287), `GET /api/events/orders/:orderId` (:457), `GET /api/events/me/tickets` (ticketsRouter.ts:505), `POST /api/events/orders/:orderId/refund` (ticketRefunds.ts:305), `POST /api/events/orders/:orderId/cancel` (ticketsRouter.ts:427), QR `qrUrl` public PNG, push `address_reveal` data `{type, eventId}` (addressReveal.ts:114).
- Checkout 201: `{orderId, paymentIntentId, clientSecret, holdExpiresAt, subtotalCents, serviceFeeCents, totalCents}`. Same key again: same open checkout (`repeated: true`), or `{order}` when already completed/refunding/refunded.
- Refund success returns `order.refundPendingCents` and `order.refundedCents`; the refund is usually sent inline, so pending is often 0 and the amount is in `refundedCents`.
- Card only: no applePay/googlePay options, no StripeProvider merchantIdentifier.
- Copy: real punctuation, no dashes as sentence breaks, "Service fee" as an amount only (never a percentage), no points copy, host by display name only. Show "The service fee isn't refundable." before paying and before refunding.
- Errors: ApiError `{status, body.error.{code,message}}`; always show through `eventErrorCopy` / the new refund copy helper.
- tsc must stay at 67 errors; every `*.test.ts` passes; `expo export` ios + android succeed.
- CartOrders callers that pass no tab (DiscoverStackNavigator.tsx:28, VendorDetailScreen.tsx:1496, :1580) still land on Cart; bookingPush.ts:84 and OrderSuccessScreen.tsx:164 keep their tabs.

## Review Focus
1. Payment succeeded but the webhook is slow: poll the order, then show "Confirming your payment", never "not charged". (Task 1 `checkoutResultAfterPoll` tests.)
2. A retry after a network error must reuse the same idempotency key; a changed type or quantity, CHECKOUT_CLOSED, IDEMPOTENCY_KEY_REUSED or PAYMENT_SETUP_FAILED must start a new one. (Task 1 `checkoutKeyNext` tests.)
3. A repeated key that returns `{order}` (already paid) must go straight to "You're going", not to the payment sheet. (Task 1 `checkoutResponseKind` tests.)
4. Refund amount after a refund: `refundPendingCents` when > 0, else `refundedCents`; never a guessed amount before. (Task 1 `refundShownCents` tests.)
5. Hidden address: no Directions, no location in the calendar event, the reveal line instead. (Task 1 `directionsUrl` / `calendarEventFor` tests.)

---

### Task 1: Pure logic + API methods

**Files:**
- Create: `utils/ticketCheckoutLogic.ts`, `utils/ticketCheckoutLogic.test.ts`
- Modify: `utils/eventsLogic.ts` (CODE_COPY gains `IDEMPOTENCY_KEY_REUSED`, `CHECKOUT_CLOSED`, `ACCOUNT_INACTIVE`, `PAYMENT_SETUP_FAILED`; `eventPageBar` kind `paid_soon` renamed `buy`), `utils/eventsLogic.test.ts`, `services/api.ts`

**Interfaces (Produces):**
- Types `CheckoutStart`, `TicketOrder`, `MyTicket`, `TicketGroup`.
- `quoteLines(t: PublicTicketType, qty) -> {line, subtotalCents, feeCents, totalCents}` (fee = qty x `serviceFeeCents`, total = qty x `buyerTotalCents`).
- `checkoutKeyNext(prev, "attempt"|"success"|"changed"|"closed") -> string|null`; `keyResetCodes` = IDEMPOTENCY_KEY_REUSED, CHECKOUT_CLOSED, PAYMENT_SETUP_FAILED.
- `checkoutResponseKind(res) -> "pay"|"paid"|"error"`.
- `holdMsLeft(holdExpiresAt, now) -> number`, `holdClock(ms) -> "9:42"`.
- `sheetOutcome(error?: {code}) -> "paid_sheet"|"canceled"|"expired"|"failed"` (Timeout -> expired).
- `POLL_EVERY_MS = 2000`, `POLL_MAX_MS = 20000`; `pollDecision(status, elapsedMs) -> "paid"|"wait"|"processing"`.
- `splitTickets(tickets, now) -> {upcoming: TicketGroup[], past: TicketGroup[]}` grouped by event, past when `endsAt` < now (past newest first).
- `groupInfo(g) -> "General admission · 2 tickets · Freeport, NY"`, `addressTag(ev, now) -> "ADDRESS SAT 9 AM" | null`.
- `directionsUrl(ev, os) -> string|null`, `calendarEventFor(ev) -> {title, startDate, endDate, location?, timeZone, url}`.
- `refundErrorCopy(err)`, `refundShownCents(order)`, `refundConfirmBody(count)`.
- api: `checkoutTickets(eventId, body, token)`, `getTicketOrder(orderId, token)`, `getMyTickets(token)`, `requestTicketRefund(orderId, token)`, `cancelRsvp(orderId, token)` (Bearer, like `rsvpEvent`).

- [ ] Write failing tests for each function above (exact cents, exact copy), run, see them fail.
- [ ] Implement, run `npx tsx --test utils/ticketCheckoutLogic.test.ts utils/eventsLogic.test.ts`, all pass.
- [ ] Add the api methods; `npx tsc --noEmit` still 67. Commit.

### Task 2: Screens 25 to 27 (buy flow on the event page)

**Files:** Create `components/events/BuyTicketsModal.tsx`; Modify `screens/EventDetailScreen.tsx`.

- [ ] `bar.kind === "buy"` shows "Get tickets" (gold) and opens BuyTicketsModal (sign-in first when signed out).
- [ ] Choose step (25): one type at a time (Choose / + and -), qty within `minQty`/`maxQty`, lines from `quoteLines`, refund line + "The service fee isn't refundable.", "Continue to payment".
- [ ] Pay step (26): `checkoutTickets` with the kept key; `pay` -> `initPaymentSheet({paymentIntentClientSecret, merchantDisplayName: "Outsyde", allowsDelayedPaymentMethods: false})`, `presentPaymentSheet({timeout: holdMsLeft})`; hold timer line; Canceled -> choose step; Timeout -> expired.
- [ ] Result step (27): poll `getTicketOrder` (pollDecision); paid / processing / expired copy from the mockup; "View my tickets", "Choose tickets again", "Back to the event".
- [ ] "View your tickets" link on the "You're going" card. tsc 67. Commit.

### Task 3: Screens 28 and 29 (Tickets tab, one ticket, calendar)

**Files:** Create `components/events/MyTicketsList.tsx`, `screens/TicketDetailScreen.tsx`; Modify `screens/CartOrdersScreen.tsx` (ActiveTab + tab row + render), `navigation/types.ts` (CartOrders openTab adds "tickets"; new `TicketDetail: { eventId: string; orderId?: string }`), `navigation/RootNavigator.tsx`, `package.json`, `package-lock.json`, `app.json`.

- [ ] `npx expo install expo-calendar@57.0.6`; plugin `["expo-calendar", {"calendarPermission": false?...}]` exactly per the package's plugin options with `writeOnlyAccess: true` and text "Outsyde adds events you have tickets for to your calendar."; check the option names in node_modules before writing.
- [ ] Tickets tab: Upcoming then Past groups, address tag, empty copy, sign-in prompt when signed out, pull to refresh.
- [ ] TicketDetail: QR from `qrUrl`, code, "Ticket 1 of N" swipe (horizontal paging), place line, Directions, Add to calendar (`createEventInCalendarAsync` from `expo-calendar/legacy`, hidden on web), Request a refund (paid order) or Cancel RSVP (free order) via a confirm sheet; Wallet button only when `walletUrl` exists.
- [ ] tsc 67. Commit.

### Task 4: Entry points + push

**Files:** Create `hooks/useTicketPushLinks.ts`, `services/ticketPush.ts`, `services/ticketPush.test.ts`... (pure target in `utils/ticketCheckoutLogic.ts` `ticketPushTarget(data)`); Modify `navigation/MainTabNavigator.tsx`, `screens/EventsTab.tsx` (My Tickets chip).

- [ ] Test `ticketPushTarget({type:"address_reveal", eventId})` -> `{eventId}`, other types -> null; implement; hook opens `CartOrders {openTab:"tickets"}` (signed out -> Auth).
- [ ] EVENTS tab My Tickets chip -> CartOrders tickets. Commit.

### Task 5: Verify
- [ ] tsc 67; all 18 test files pass; `npx expo export --platform ios` and `--platform android` OK.
- [ ] react-native-web harness (temporary `harness-web.tsx`, Playwright intercepting `https://outsyde-backend.onrender.com/**`): screens 25 to 29 in light and dark; delete the harness.
- [ ] Fresh whole-branch review (subagent, most capable model); fix Critical/Important with a failing test first.
- [ ] Push, open PR via `gh api -X POST repos/1outsyde/OutsydeCapture/pulls`.

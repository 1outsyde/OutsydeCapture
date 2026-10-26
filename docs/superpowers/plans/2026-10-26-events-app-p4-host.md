# Events App p4-host (create and manage events) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hosts create, publish and manage events in the app, the same way goutsyde.com does (outsyde-web #87), with Legend's Oct 26 decisions.

**Architecture:** Port the web's pure host logic (editorLogic, manageLogic, hostFees, agreement parser) with its unit tests into `utils/host/`, adding the app differences as tested functions. Screens: `EventEditorScreen` (payout gate, start, details, tickets, review with the agreement sheet, live), `YourEventsScreen`, `ManageEventScreen`. Entry points: Event tab on the create screen, Your events chip on the EVENTS tab and in the Account menu, Stripe return back to the event.

**Spec:** vault `Handoffs/Events App p4-host — Audit & Regression (2026-10-26)` (decisions callout) + Events canvas 8 to 13 and 30 to 35. Backend: outsyde-backend #369 (payouts required to publish).

## Global Constraints
- Same copy as the web host pages; real punctuation, no dashes, service fee never a percentage, host earnings as amounts.
- Every host sets up payouts before creating (35): consumers `startPayoutSetup` (`/api/events/payouts/setup-link {}`), business `startVendorStripeOnboarding`, photographer `startPhotographerStripeOnboarding`. Status from `GET /api/events/payouts/status?hostType=`.
- Agreement pops up on Publish; Agree and publish only after scrolling to the end (8 px rule).
- US time zones plus the phone's zone; live events keep one visible ticket type.
- No new native package. tsc stays at the main count; all test files pass; iOS + Android export.

## Review Focus
1. Stripe return: referral cash returns still open Points; vendor and photographer returns still open their dashboards, unless a host setup is pending (then the event editor).
2. Save draft then leave and come back: no duplicate draft (first save creates, later saves PATCH only changes).
3. Publish refusals each lead somewhere (tickets, payouts, agreement, reload, new event).
4. Times: an end time after midnight is the next day; multi day; the clock change gap note.
5. Removing or hiding the last visible type of a live event is blocked in the app.

### Task 1: Host logic + API (tests ported first)
- [x] Port tests from goutsyde.com, add app checks (US zones, flatError, canRemoveType, hostSetupState); RED; port code; GREEN.
- [ ] `stripeReturnTarget(type, hostPending)` test + code; API methods for every host route.

### Task 2: Editor screen (8 to 13, 31, 32, 35)
### Task 3: Your events + manage (30, 33, 34)
### Task 4: Entry points (create tab, chip, menu row, Stripe return)
### Task 5: Verify (tsc, tests, exports, web harness light/dark, fresh review, PR)

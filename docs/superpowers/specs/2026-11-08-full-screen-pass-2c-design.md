# Full screen pass 2c: customer pop-ups — design

Date: 2026-11-08 · Base: main 3b87516 · Owner: Legend · Mockups: Design canvas "Full Screen Pass 2c Mockups" (approved 2026-11-08)

## Goals
On `components/FullScreenSheet` (2a/2b), as drawn in the mockups:
1. Rate & review (`components/ratings/RatingBottomSheet.tsx`): ✕, title "Rate <name>", stars, visit list, Submit at the bottom; keeps its white/gold palette.
2. Buy tickets (`components/events/BuyTicketsModal.tsx`): ✕, title "Choose tickets"; every step (choose, held/paying, result) inside the same page; close blocked exactly when it is today.
3. Report an event (`components/events/ReportEventSheet.tsx`): ✕, title "Report this event"; Android keeps KeyboardAvoidingView "height".
4. Edit caption (`screens/PostDetailScreen.tsx`): Cancel top left, **Save top right** (Legend approved), caption box below.
5. Free plan offer (`components/plan-offer/PlanOfferSheet.tsx`): ✕, title "Your plan"; done step unchanged inside the page.
6. Story viewers (`screens/StoryViewerScreen.tsx`): full page replacing the gorhom 50% sheet; ✕, title "<N> views", "Your story · Paused" line, viewer list. **The story pauses while it is open and resumes from the same spot.**

## Exception (Legend, 2026-11-07)
Comments on Discover and Pulse stay a partial sheet with the post showing above; a Pulse video keeps playing. Only fix: tapping a commenter's story ring closes comments first, then opens the story (today it does nothing on iOS).

## Non-goals
No change to what any pop-up submits, charges, reports or saves; no change to Stripe PaymentSheet setup (payment methods work, #528–#530); no backend/web/site changes.

## Anti-goals
Closing Buy tickets mid-payment; a story advancing behind its viewers page; a navigation landing under a pop-up.

## Approach
Reuse `FullScreenSheet` (`closeDisabled`, `androidKeyboardBehavior`, `onDismiss`) and `utils/afterSheetClose` (story ring). Story pause: a pure helper `remainingStoryMs(totalMs, progress)` decides the resume duration.

## Left to the builder
Spacing within existing tokens.

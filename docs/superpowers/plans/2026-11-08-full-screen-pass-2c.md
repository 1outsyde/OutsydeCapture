# Full Screen Pass 2c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six customer pop-ups become full pages per the approved mockups; story pauses behind its viewers; comment story rings work.

**Architecture:** Swap each pop-up's sheet chrome for `FullScreenSheet`; keep bodies. Pure helper `utils/storyPause.ts` for resume timing. Guards extend `utils/fullScreenSheets.test.ts`.

**Tech Stack:** Expo / React Native 0.88, TypeScript, `npx tsx` tests.

**Spec:** `docs/superpowers/specs/2026-11-08-full-screen-pass-2c-design.md`

## Global Constraints
- tsc error list identical to main's (64); all `*.test.ts` pass; both exports exit 0; no new ESLint rules.
- Close blocked in exactly the states it is today (BuyTickets: `busy || confirming`-equivalent from its `close`; Report: while sending; PlanOffer: while accepting).
- Comments stay transparent sheets (exception).

## Review Focus
1. Buy tickets: start a paid checkout, the Stripe sheet appears over the full page; cancel the Stripe sheet; the hold/result steps still render and close correctly; ✕ blocked mid-payment.
2. Story viewers: open viewers on an image story at ~50%, wait 10 s, close: the story resumes from ~50%, not restarted or advanced; video stories pause/resume.
3. Comments: tap a commenter's gold ring: comments close, then the story opens (iOS); Android too.
4. Plan offer from the auto prompt over another full page, and from the dashboard banner.
5. Rating from all 6 entry points; Report keyboard on Android.

---

### Task 1: Guards and story pause helper
**Files:** modify `utils/fullScreenSheets.test.ts`; create `utils/storyPause.ts`, `utils/storyPause.test.ts`.
**Interfaces:** Produces `remainingStoryMs(totalMs: number, progress: number): number` — `totalMs * (1 - clamp(progress, 0, 1))`, minimum 0.
- [ ] Tests: 2c files (RatingBottomSheet, BuyTicketsModal, ReportEventSheet, PostDetailScreen, PlanOfferSheet, StoryViewerScreen) have no transparent `<Modal`, import FullScreenSheet; StoryViewer no longer imports `@gorhom/bottom-sheet`; Discover and Pulse comment modals are still transparent (exception pinned) and their story-ring navigate is queued via `createAfterClose`; PostDetail edit-caption sheet has `closeLabel="cancel"` and `right=` containing `Save`; Report sheet `androidKeyboardBehavior="height"`; BuyTickets passes `closeDisabled`. storyPause: 0→total, 0.5→half, 1→0, >1→0, <0→total.
- [ ] Run → FAIL. Implement `utils/storyPause.ts` → its tests PASS. Commit.

### Task 2: Rate & review
`components/ratings/RatingBottomSheet.tsx`: FullScreenSheet title `Rate ${targetName}`, bg `#fff`, tint `#111827`, border `#E5E7EB`; ScrollView flex 1; footer pinned; remove backdrop/sheet/handle/header/closeBtn styles and the Android inset hack (wrapper pads). Commit.

### Task 3: Buy tickets
`components/events/BuyTicketsModal.tsx`: one FullScreenSheet for all steps, `onClose={close}`, `closeDisabled` = the same condition `close` refuses on; title "Choose tickets"; step bodies unchanged (drop their own top inset padding where the header now covers it). Commit.

### Task 4: Report and Edit caption
`ReportEventSheet.tsx`: FullScreenSheet title from `REPORT_COPY.title`, `closeDisabled` while sending, `androidKeyboardBehavior="height"`. `PostDetailScreen.tsx` edit caption: FullScreenSheet title "Edit Caption", `closeLabel="cancel"`, `right` = Save (same handler/disabled), body caption box. Commit.

### Task 5: Free plan offer
`PlanOfferSheet.tsx`: FullScreenSheet title "Your plan", `closeDisabled` while accepting; done step unchanged. Commit.

### Task 6: Story viewers + pause
`StoryViewerScreen.tsx`: replace gorhom BottomSheet with FullScreenSheet (`visible={viewersOpen}`), title `${n} views`, "Your story · Paused" line, same viewer list. While open: stop the image progress animation and pause video; on close resume with `remainingStoryMs(IMAGE_MS, progress)` (image) / play (video). Remove the gorhom import if unused. Commit.

### Task 7: Comments story ring
`DiscoverScreen.tsx`, `PulseFeedScreenV2.tsx`: story-ring `onViewStory` queues navigation with `createAfterClose`, closes comments, `runIfImmediate`; the comments Modal gets `onDismiss={after.onDismiss}`. Sheets otherwise unchanged. Commit.

### Task 8: Verify and hand off
Full checks, mutation (revert one file → guard fails), independent review against Review Focus, push, draft PR with phone tests.

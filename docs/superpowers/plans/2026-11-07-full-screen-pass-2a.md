# Full Screen Pass 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 10 business-tool sheets into full pages through one shared wrapper, with keyboard handling, and fix ProviderCalendar's hidden navigation.

**Architecture:** New `components/FullScreenSheet.tsx` wraps RN `Modal` (fullScreen) with a standard header, safe areas and a KeyboardAvoidingView. Each pop-up keeps its body and swaps its sheet chrome for the wrapper. A pure helper decides when ProviderCalendar runs `onBookingPress`. A structural test keeps the 2a files free of partial sheets.

**Tech Stack:** Expo / React Native 0.88, TypeScript, tests run with `npx tsx <file>.test.ts`.

**Spec:** `docs/superpowers/specs/2026-11-07-full-screen-pass-2a-design.md`

## Global Constraints
- tsc error list identical to main's (64 errors).
- All `*.test.ts` files pass with `npx tsx`.
- `npx expo export --platform ios` and `--platform android` exit 0.
- No new ESLint rule violations (prettier excluded) in changed files.
- Close controls: hit area ≥ 44pt, `accessibilityRole="button"`, `accessibilityLabel`.
- Each screen keeps its own palette.

## Review Focus
1. Keyboard open on the last field of ServiceEditorModal, InviteTeam, Ship order, Block time: the field stays visible and Save stays reachable.
2. ProviderCalendar day view → tap a booking on BusinessDashboard: DashboardBookings is visible, not hidden under the day view.
3. StaffDashboard My services → Add/Edit service: the editor opens after the list closes (existing 100 ms hand-off) and still saves.
4. Android back button closes each full page (`onRequestClose`).
5. Weekly hours / Block dates: their small pickers (HoursEditor, DateBlocker) still open on top of the full page.

---

### Task 1: FullScreenSheet wrapper and the guard test

**Files:**
- Create: `components/FullScreenSheet.tsx`
- Create: `utils/fullScreenSheets.test.ts`

**Interfaces:**
- Produces: `FullScreenSheet(props: { visible: boolean; onClose: () => void; title: string; closeLabel?: "close" | "cancel"; right?: React.ReactNode; backgroundColor?: string; tintColor?: string; borderColor?: string; onDismiss?: () => void; children: React.ReactNode })`. Renders `Modal` (`animationType="slide"`, `presentationStyle="fullScreen"`, `onRequestClose={onClose}`, `onDismiss`), a `View` flex 1 with `paddingTop: insets.top`, `paddingBottom: insets.bottom`, a header row (close left: ✕ icon or "Cancel" text, title centered, `right` or a 44pt spacer), then `KeyboardAvoidingView` (`behavior` "padding" on iOS, undefined on Android, flex 1) holding `children`. Defaults from `useTheme()`: `theme.backgroundRoot`, `theme.text`, `theme.border`.

- [ ] **Step 1: Write the guard test** `utils/fullScreenSheets.test.ts`: for each file in the 2a list, find every `<Modal` element; assert none has `transparent` unless its line is on `KEEP` (`components/RefundModal.tsx` dialog, `components/HoursEditor.tsx` and `components/DateBlocker.tsx` pickers are not in the list); assert the file imports `FullScreenSheet`. 2a list: StaffDashboardScreen, PhotographerDashboardScreen (bookings modal only, matched by `activeModal === "bookings"`), DashboardBookingsScreen, DashboardOrdersScreen, StaffCalendarScreen, ProviderCalendar, InviteTeamModal. Also assert `StaffDashboardScreen` passes `fullScreen` to `<ServiceEditorModal`.
- [ ] **Step 2: Run** `npx tsx utils/fullScreenSheets.test.ts` — Expected: FAIL (files still use transparent sheets).
- [ ] **Step 3: Implement `components/FullScreenSheet.tsx`** per the interface.
- [ ] **Step 4: Run** `npx tsc --noEmit -p . 2>&1 | grep -c "error TS"` — Expected: 64.
- [ ] **Step 5: Commit** `feat(ui): FullScreenSheet wrapper + 2a guard test (red)`.

### Task 2: StaffDashboard five sheets and the service editor

**Files:** Modify `screens/StaffDashboardScreen.tsx` (~660–1040, styles ~1185), `components/ServiceEditorModal.tsx` (~373–400, styles ~1036).

**Interfaces:** Consumes `FullScreenSheet` (Task 1).

- [ ] **Step 1:** Replace each of the five `Modal` + `modalOverlay` + `modalBackdrop` + `modalContainer` + `modalHandle` + `modalHeader` blocks with `<FullScreenSheet visible={activeModal === "<key>"} onClose={() => setActiveModal(null)} title="<same title>">` and the same body. Titles unchanged: "My Bookings", "My Services", and the existing titles of hours/blocked/weeklyHours. Remove styles that become unused.
- [ ] **Step 2:** Pass `fullScreen` to `<ServiceEditorModal` at ~1022.
- [ ] **Step 3:** In `ServiceEditorModal`, wrap the `ScrollView` in `KeyboardAvoidingView` (iOS "padding", flex 1) for both modes; give the close button `accessibilityRole`/`accessibilityLabel="Close"`.
- [ ] **Step 4: Run** the guard test — Expected: StaffDashboard assertions pass; others still fail. tsc — Expected: 64.
- [ ] **Step 5: Commit** `feat(staff): dashboard sheets and service editor full screen`.

### Task 3: Photographer bookings, appointment details, refund keyboard

**Files:** Modify `screens/PhotographerDashboardScreen.tsx` (`renderBookingsModal` ~1388), `screens/DashboardBookingsScreen.tsx` (details ~736), `components/RefundModal.tsx` (~68).

- [ ] **Step 1:** Bookings modal → `FullScreenSheet title="Bookings"` with DASHBOARD_COLORS background/tint; keep the list body and actions.
- [ ] **Step 2:** Appointment details → `FullScreenSheet title="Appointment details"` with BG / CREAM / CARD_BORDER; body keeps its ScrollView; the sheet renders only when `booking && sc`, `visible={booking !== null}`.
- [ ] **Step 3:** RefundModal: keep `transparent` centered dialog; wrap `styles.overlay` content in `KeyboardAvoidingView` (iOS "padding").
- [ ] **Step 4: Run** guard test (these files pass) and tsc (64).
- [ ] **Step 5: Commit** `feat(bookings): photographer bookings and appointment details full screen; refund keyboard`.

### Task 4: Ship order and block time

**Files:** Modify `screens/DashboardOrdersScreen.tsx` (~579), `screens/StaffCalendarScreen.tsx` (~791).

- [ ] **Step 1:** Ship order → `FullScreenSheet title="Ship Order" closeLabel="cancel"` (GOLD/CREAM palette); body = carrier chips, tracking input, confirm button; the old Cancel button in the card goes (header Cancel replaces it); `animationType` becomes slide.
- [ ] **Step 2:** Block time → `FullScreenSheet title="Block Time" closeLabel="cancel"`; remove the outer `Pressable` overlay, handle bar and the inner KAV (the wrapper provides it); keep rows and the confirm button.
- [ ] **Step 3: Run** guard test and tsc (64).
- [ ] **Step 4: Commit** `feat(dashboard): ship order and block time full screen`.

### Task 5: ProviderCalendar day view and booking hand-off

**Files:** Create `utils/afterSheetClose.ts`, `utils/afterSheetClose.test.ts`; modify `components/ProviderCalendar.tsx` (~160–175, ~326–350, styles ~561).

**Interfaces:** Produces `createAfterClose(platform: "ios" | "android" | string): { queue(fn: () => void): void; onDismiss(): void; runIfImmediate(): void }` — on iOS `queue` stores `fn` and `onDismiss` runs it once; elsewhere `runIfImmediate` (called right after closing) runs it once. Never runs a stored fn twice.

- [ ] **Step 1: Write tests** in `utils/afterSheetClose.test.ts`: iOS: queued fn not run until `onDismiss`, runs once, second `onDismiss` does nothing; android: `runIfImmediate` runs it once; queue replaced by a newer fn runs only the newer one.
- [ ] **Step 2: Run** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `utils/afterSheetClose.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5:** ProviderCalendar: day view → `FullScreenSheet title={<same date label>}` with `onDismiss={after.onDismiss}`; booking tap does `after.queue(() => onBookingPress?.(booking)); setShowDayModal(false); after.runIfImmediate()`. Keep `after` in a `useRef`.
- [ ] **Step 6: Run** guard test and tsc (64).
- [ ] **Step 7: Commit** `fix(calendar): day view full screen; open booking after it closes`.

### Task 6: Invite team member

**Files:** Modify `components/InviteTeamModal.tsx` (~107–130).

- [ ] **Step 1:** Replace the Modal/overlay/container/header with `FullScreenSheet title="Invite Team Member"`; keep the ScrollView body and the send button.
- [ ] **Step 2: Run** guard test — Expected: PASS (all files). tsc — 64.
- [ ] **Step 3: Commit** `feat(team): invite team member full screen`.

### Task 7: Verify and hand off
- [ ] Run every `*.test.ts` with `npx tsx` — Expected: all pass.
- [ ] tsc error list diff vs main — Expected: identical.
- [ ] `npx expo export` iOS and Android — Expected: exit 0.
- [ ] ESLint rule diff on changed files vs main — Expected: no new.
- [ ] Independent whole-branch review against this plan's Review Focus; fix Critical/Important with a failing test first where testable.
- [ ] Push, open draft PR with a phone test list.

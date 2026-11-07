# Full screen pass 2a: business tool pop-ups — design

Date: 2026-11-07 · Base: main a1e94e8 · Owner: Legend

## Intent
Legend's rule: on iPhone nothing in Outsyde opens as a partial-height (70–92%) sheet. Routes were made full screen in PRs #524 and #525. Step 2 covers pop-ups inside screens; 2a is the business tools batch (the staff dashboard alone has five sheets). Decided calls (approved 2026-11-07): forms and long lists become full pages; small pickers and one-box confirms stay small but must not let the keyboard cover their input.

## Goals
- These pop-ups open as a full page that slides up, with a close control top left, a title, and the content below the notch:
  1. StaffDashboard: My bookings, My services, Base hours, Block dates, Weekly hours (`screens/StaffDashboardScreen.tsx` ~660/705/841/962/991)
  2. PhotographerDashboard bookings (`screens/PhotographerDashboardScreen.tsx` ~1389)
  3. DashboardBookings appointment details (`screens/DashboardBookingsScreen.tsx` ~739)
  4. DashboardOrders ship order (`screens/DashboardOrdersScreen.tsx` ~579)
  5. StaffCalendar block time (`screens/StaffCalendarScreen.tsx` ~791)
  6. ProviderCalendar day view, used by Staff, Business and Photographer dashboards (`components/ProviderCalendar.tsx` ~326)
  7. ServiceEditorModal on the staff dashboard (full screen path already exists; PhotographerManageBusiness already passes `fullScreen`)
  8. InviteTeamModal (`components/InviteTeamModal.tsx`; AccountScreen and StaffManagement)
- Keyboard never covers a text field in any of them (ServiceEditorModal has 13 inputs and no keyboard handling today; InviteTeam and Ship order too).
- RefundModal stays a small centered dialog but gets keyboard handling (Call 1).

## Non-goals
- Batches 2b (add-ons), 2c (customer pop-ups), 2d (event hosting); the small pickers (HoursEditor time picker, DateBlocker calendar) inside Weekly hours / Block dates stay small.
- No change to what any pop-up does: same content, same buttons, same save calls, same data.
- No backend, web or vendor-site change.

## Anti-goals
- A screen that becomes full screen with no visible way to close it.
- A navigation that lands hidden under a full screen pop-up.
- Changing tap targets or palette per screen arbitrarily.

## Constraints
- Expo / React Native 0.88, iOS primary, Android must keep working.
- Each screen keeps its own palette (dashboards use DASHBOARD_COLORS / GOLD / CREAM; others use theme).
- Close controls ≥ 44pt hit area with accessibilityLabel.
- tsc error list must equal main's (64); all app tests pass; no new ESLint rule violations on changed files.

## Approaches
- **A. One shared full-page wrapper (picked).** New `components/FullScreenSheet.tsx`: RN `Modal` with `presentationStyle="fullScreen"`, header (close left, centered title, optional right action), safe-area top and bottom, `KeyboardAvoidingView` on iOS. Each pop-up swaps its sheet chrome (backdrop, grab handle, rounded top, max height) for the wrapper and keeps its body. Consistent look, one place to get keyboard and safe area right, small per-site diffs.
- B. Turn each pop-up into a navigation route. Rejected: these pop-ups share live state with their screen (selected booking, form state, callbacks); moving that into route params is a large rewrite and changes behavior.
- C. Edit each sheet's styles in place (flex:1, drop the radius). Rejected: ten slightly different headers and keyboard handling, which is the inconsistency we are removing.

## Decided details
- Close control: ✕ by default; screens that today use "Cancel" keep Cancel (ship order, block time).
- Pop-ups that open another pop-up or a screen keep their existing order. ProviderCalendar's day view must close before `onBookingPress` runs, and runs it after the close finishes (Modal `onDismiss` on iOS, immediately on Android); today BusinessDashboard navigates to DashboardBookings while the day view stays on top, hiding the new screen.
- StaffDashboard's existing close-then-open-after-100 ms pattern (services → service editor) is unchanged.

## Left to the builder
- Exact header spacing within the existing tokens (`Spacing`), as long as hit areas are ≥ 44pt.

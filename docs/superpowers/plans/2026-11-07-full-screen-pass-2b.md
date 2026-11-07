# Full Screen Pass 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The six add-on pop-ups open as full pages on FullScreenSheet, with Legend's button layout, without changing what they save.

**Architecture:** Extend `FullScreenSheet` with `closeDisabled` and `androidKeyboardBehavior`; swap each pop-up's sheet chrome for it in place (nesting kept). A guard test extends `utils/fullScreenSheets.test.ts`.

**Tech Stack:** Expo / React Native 0.88, TypeScript, `npx tsx` tests.

**Spec:** `docs/superpowers/specs/2026-11-07-full-screen-pass-2b-design.md`

## Global Constraints
- tsc error list identical to main's (64).
- All `*.test.ts` pass with `npx tsx`; `npx expo export` iOS and Android exit 0.
- No new ESLint rule violations (prettier excluded) in changed files.
- Editors: header Cancel (left) = old Cancel action; header right = "Done" (Keyboard.dismiss, accessibilityLabel "Hide keyboard"); Save full width at the bottom; no bottom Cancel.
- Busy guards unchanged: whatever blocked closing before (`saving`, `copying`, `copyingAddon`, `sheetBusy`) sets `closeDisabled`.

## Review Focus
1. Storefront: Edit service → Add-on → the editor opens on top of the service editor (nested), saves, and returns to the service editor.
2. Mid-copy / mid-save: header Cancel and Android back do nothing while busy.
3. Keyboard on the price/time fields: the keyboard's Done bar still shows (InputAccessoryView) and Save stays reachable.
4. Add-ons tab Delete checklist: the red Delete action and its count still work.
5. Photographer service form → Add-on editor → Save, then "Use on other services" checklist.

---

### Task 1: FullScreenSheet props and guard tests

**Files:** Modify `components/FullScreenSheet.tsx`; modify `utils/fullScreenSheets.test.ts`.

**Interfaces:** Produces `closeDisabled?: boolean` (header close `disabled`, `onRequestClose` ignored when true) and `androidKeyboardBehavior?: "height"` (KAV `behavior` on Android).

- [ ] **Step 1: Write tests** in `utils/fullScreenSheets.test.ts`:
  - FullScreenSheet source has `closeDisabled` wired to the close button's `disabled` and to `onRequestClose`, and `androidKeyboardBehavior` used in `behavior`.
  - For `screens/StorefrontEditorScreen.tsx`, `components/ServiceAddonsEditor.tsx`, `components/addons/AddonLibraryTab.tsx`: no transparent `<Modal`, and FullScreenSheet imported.
  - Each editor sheet (title expression containing `"New Add-on"`) passes `closeLabel="cancel"` and `androidKeyboardBehavior="height"` and a `right=` with `Keyboard.dismiss`.
- [ ] **Step 2: Run** `npx tsx utils/fullScreenSheets.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the two props.
- [ ] **Step 4: Run** tsc — Expected: 64.
- [ ] **Step 5: Commit** `feat(ui): FullScreenSheet closeDisabled and androidKeyboardBehavior; 2b guards (red)`.

### Task 2: Storefront add-on editor and copy sheet

**Files:** Modify `screens/StorefrontEditorScreen.tsx` (~4706–4950).

- [ ] **Step 1:** Add-on editor → `FullScreenSheet` title `editingAddon ? "Edit Add-on" : "New Add-on"`, `closeLabel="cancel"`, `onClose` = old Cancel (`setAddonModalVisible(false); setAddonError(null)`), `right` = Done (Keyboard.dismiss), brand palette, `androidKeyboardBehavior="height"`. Body: the ScrollView of fields (flex 1), then a full-width Save (same handler, `disabled={addonSaving}`). Keep the InputAccessoryView.
- [ ] **Step 2:** Copy sheet → `FullScreenSheet` title `Add "<name>" to other services`, `closeLabel="cancel"`, `closeDisabled={copyingAddon}`, `onClose={() => setCopyAddonSource(null)}`. Body: summary line, select-all row, list ScrollView (flex 1), full-width "Add to N services". Remove the bottom Cancel.
- [ ] **Step 3: Run** guard test (Storefront assertions pass) and tsc (64).
- [ ] **Step 4: Commit** `feat(storefront): add-on editor and copy sheet full screen`.

### Task 3: Photographer add-on editor and copy sheet

**Files:** Modify `components/ServiceAddonsEditor.tsx` (~340–520, styles ~559–571).

- [ ] **Step 1:** Editor → `FullScreenSheet` (theme palette; Done in `accentColor`), same pattern as Task 2 step 1, `onClose` = `setEditorVisible(false); setFormError(null)`, Save `disabled={saving}`.
- [ ] **Step 2:** Copy sheet → same pattern as Task 2 step 2 with `copying`, `setCopySource(null)`, `handleCopy`.
- [ ] **Step 3:** Remove styles left unused (`sheetOverlay`, `sheet`, `fullSheet`, `sheetHeader` if unreferenced); remove `insets` if unused.
- [ ] **Step 4: Run** guard test and tsc (64).
- [ ] **Step 5: Commit** `feat(photographer): add-on editor and copy sheet on the shared full page`.

### Task 4: Add-ons tab checklist and form

**Files:** Modify `components/addons/AddonLibraryTab.tsx` (~366–760).

- [ ] **Step 1:** Checklist → `FullScreenSheet` title `{title}`, `closeLabel="cancel"`, `closeDisabled={sheetBusy}`, `onClose={() => setSheet(null)}`; body: subtitle, select-all, list (flex 1), full-width confirm (same label, colors and `disabled={!canConfirm}`). Remove the bottom Cancel.
- [ ] **Step 2:** Form → editor pattern, `closeDisabled={saving}`, `onClose={() => setFormVisible(false)}`, Save `disabled={saving}` calling `saveForm`; Done right; `androidKeyboardBehavior="height"`.
- [ ] **Step 3: Run** guard test — Expected: PASS (all). tsc — 64.
- [ ] **Step 4: Commit** `feat(addons): add-ons tab checklist and form full screen`.

### Task 5: Verify and hand off
- [ ] All `*.test.ts` pass; tsc list identical to main; both exports exit 0; ESLint rule diff empty.
- [ ] Mutation: revert one converted file to main → guard fails.
- [ ] Independent whole-branch review against Review Focus; fix Critical/Important with a failing test first.
- [ ] Push, draft PR with the phone test list.

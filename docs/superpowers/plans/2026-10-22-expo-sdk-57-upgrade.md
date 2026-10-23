# Expo SDK 54 → 57 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OutsydeCapture from Expo SDK 54 to SDK 57 one SDK at a time with zero user-facing change, so it runs in App Store Expo Go again.

**Architecture:** Config and dependency upgrade only. One commit per step on `chore/expo-sdk-57`; each step must pass the same gate (TypeScript no-new-errors, iOS + Android bundle export) before the next starts.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2, EAS Build, @stripe/stripe-react-native 0.64.0.

**Spec:** `docs/superpowers/specs/2026-10-22-expo-sdk-57-upgrade-design.md`

## Global Constraints
- Base: `main` @ `ae2b3dd`. Branch: `chore/expo-sdk-57`. Draft PR only; Legend merges in GitHub UI.
- TypeScript gate: the sorted, line-number-stripped `tsc --noEmit` error list must be identical to (or a subset of) the SDK 54 baseline of 67 errors.
- Bundle gate: `npx expo export --platform ios --platform android` succeeds.
- No source changes except what a step requires; every extra fix is named in that step's commit message.
- Never answer "Y" to `expo install --check` on `main`.
- Each step ends with the projectId intact: `extra.eas.projectId = ba1ccd05-f527-4e0b-9a6d-f31184afdd4b`.

## Review Focus
Regression check run 2026-10-22 (results in Task 0). Highest-risk items:
1. Keyboard on the ~18 screens using `components/ScreenKeyboardAwareScrollView.tsx`. keyboard-controller 1.21.x changes the `KeyboardAwareScrollView` default from a spacer view to `mode="insets"`. Pinned back with `mode="layout"` in Task 3; device test in Task 5.
2. Gallery thumbnail in CreatePostScreen. The root `expo-media-library` import becomes the new API in 56.0.x and the legacy calls throw, which a catch hides, so the thumbnail silently goes null. Fixed with the `/legacy` import in Task 3; device test in Task 5.
3. Stripe payment sheet, CardField and 3DS return after 0.50.3 → 0.64.0. The API is unchanged and the native SDKs are new majors. Device test in Task 5.
4. Media uploads (`services/mediaUpload.ts`, XHR) and every JSON API call under the SDK 56 fetch change. RN fetch is kept via `EXPO_PUBLIC_USE_RN_FETCH=1` (Task 3); device test in Task 5.
5. Native config drift: expo-audio adding background playback (Task 2), plus intentFilters, permissions, `withLegacyStoragePermissions`, `GOOGLE_SERVICES_JSON`. Checked by the config diff and an Android prebuild manifest diff against the SDK 54 baseline in Tasks 2–4.

## Shared gate (referenced by every task as "run the gate")
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort > /tmp/tscN.txt
comm -13 $SCRATCH/tsc54.txt /tmp/tscN.txt   # Expected: empty output (no new errors)
npx expo export --platform ios --platform android --output-dir $SCRATCH/exportN   # Expected: both bundles listed, "Exported:"
npx expo config --type public --json > $SCRATCH/configN.json   # diff vs previous step; only intended keys change
```

---

### Task 0: Regression check (read-only, before any build)
DONE 2026-10-22 against main @ ae2b3dd; copy into the PR description. Verified against published package sources (npm tarballs) and changelogs:
- Uploads: SAFE. All live uploads use XHR (`services/mediaUpload.ts:43`). `services/cloudinary.ts` has zero callers (dead code). The only other FormData-like names are `ServiceFormData` types.
- Stripe 0.50.3→0.64.0: SAFE, NEEDS TEST. Every option used (initPaymentSheet ×3, presentPaymentSheet `timeout`, confirmPayment ×2, confirmSetupIntent ×2, CardField, StripeProvider `urlScheme`) is unchanged. The breaking changes in range are Onramp/Giropay only.
- Push: SAFE. `shouldShowAlert` and `getLastNotificationResponseAsync` are deprecated but still exported. projectId resolves from `extra.eas.projectId` (Task 1).
- Reanimated/worklets/gesture-handler: SAFE, NEEDS TEST. `runOnJS` is deprecated, not removed, in 4.5.1. The babel `react-native-reanimated/plugin` re-exports the worklets plugin (left as-is). The gesture APIs used still exist.
- @gorhom/bottom-sheet 5.2.14 (latest): NEEDS TEST. Its peer ranges accept reanimated 4.5 and gesture-handler 2.32.
- keyboard-controller: NEEDS CHANGE in Task 3 (`mode="layout"`).
- expo-media-library: NEEDS CHANGE in Task 3 (`/legacy` import, only available from 56.0.x).
- expo-audio plugin: NEEDS CHANGE in Task 2 (`enableBackgroundPlayback: false`).
- expo-camera 57: NEEDS TEST. The iOS default `pictureSize` changes from `high` to `photo`, so photo files may be larger.
- expo-video 55: NEEDS TEST. Android native controls now hide next/previous.
- Navigation: SAFE. expo-router is not installed, so the SDK 56 router change doesn't apply.
- Config: SAFE. Every other app.json key is still in config-types 57. Baselines are saved: `config54.json` and the SDK 54 Android manifest (targetSdk 36, compileSdk 36, minSdk 24).
- Backend: SAFE. No request-shape change (RN fetch and XHR are kept). No backend or DB change.

### Task 1: projectId + PNG icon

**Files:** Modify `app.json` (`expo.icon`, splash plugin `image`, add `expo.extra.eas.projectId`). Create `assets/images/outsyde-icon.png`.

- [ ] Convert `assets/images/outsyde-icon.jpg` to `assets/images/outsyde-icon.png` at the same 586×586, no alpha, no other edits. Keep the .jpg (nothing else is deleted).
- [ ] Point `expo.icon` and the `expo-splash-screen` `image` at `./assets/images/outsyde-icon.png`; add `"extra": { "eas": { "projectId": "ba1ccd05-f527-4e0b-9a6d-f31184afdd4b" } }`.
- [ ] Run the gate. Expected: no new TS errors; export succeeds; config diff shows only `icon`, splash image, `extra.eas.projectId`.
- [ ] Commit: `chore(app): add EAS projectId, use PNG app icon`

### Task 2: SDK 55

**Files:** `package.json`, `package-lock.json`, `app.json`.

- [ ] `npx expo install expo@^55.0.0 --fix` → expect expo 55.0.x, react-native 0.83.x, react 19.2.0, @stripe/stripe-react-native 0.63.0.
- [ ] Remove `expo.newArchEnabled` and `expo.android.edgeToEdgeEnabled` from app.json.
- [ ] Replace the bare `"expo-audio"` plugin entry with `["expo-audio", { "enableBackgroundPlayback": false }]`. The plugin defaults it to true from 55.x, which would add iOS `UIBackgroundModes: audio` and Android FOREGROUND_SERVICE permissions the app doesn't have today.
- [ ] Android prebuild in a scratch copy and diff `AndroidManifest.xml` permissions against the SDK 54 baseline. Expected: identical permission list.
- [ ] `grep -rn '"notification"' app.json` → Expected: no match (field removed in SDK 55).
- [ ] Run the gate. Fix only new TS errors, minimally.
- [ ] Commit: `chore(deps): upgrade to Expo SDK 55`

### Task 3: SDK 56

**Files:** `package.json`, `package-lock.json`, `eas.json`, possibly source files named by new TS errors.

- [ ] `npx expo install expo@^56.0.0 --fix` → expect expo 56.0.x, RN 0.85.x, react 19.2.3, Stripe 0.64.0, TypeScript 6.x.
- [ ] Add `"EXPO_PUBLIC_USE_RN_FETCH": "1"` to the `env` of the `development`, `preview` and `production` profiles in eas.json.
- [ ] `ls node_modules/expo-router` → Expected: not found (the SDK 56 React Navigation codemod applies only to expo-router apps). If present, stop and report.
- [ ] Confirm `@expo/vector-icons` stays a direct dependency in package.json.
- [ ] `screens/CreatePostScreen.tsx:15`: change the import to `import * as MediaLibrary from "expo-media-library/legacy";`. No other line changes.
- [ ] `components/ScreenKeyboardAwareScrollView.tsx:39`: add `mode="layout"` to `<KeyboardAwareScrollView`. This keeps the 1.18 spacer behavior; 1.21.x defaults to `"insets"`.
- [ ] Android prebuild manifest diff vs the SDK 54 baseline. Expected: identical permission list.
- [ ] Run the gate. Fix only new TS errors (TS 6), minimally, and list each in the commit body.
- [ ] Commit: `chore(deps): upgrade to Expo SDK 56, keep RN fetch, legacy media-library, keyboard layout mode`

### Task 4: SDK 57

- [ ] `npx expo install expo@^57.0.0 --fix` → expect expo ≥ 57.0.9 (memory fix), RN 0.86.x, reanimated 4.5.x, worklets 0.10.x.
- [ ] Run the gate.
- [ ] Commit: `chore(deps): upgrade to Expo SDK 57`
- [ ] Push branch, open **draft** PR to `main` with: per-step gate results, config diffs, regression results, device test checklist.

### Task 5: Legend's PC + iPhone verification (Legend runs; blocks merge)

- [ ] `git fetch origin && git checkout chore/expo-sdk-57 && git pull` then `npm ci`.
- [ ] Nothing to add to `.env`: the committed `.env.development` sets `EXPO_PUBLIC_USE_RN_FETCH=1` for `npx expo start` (final review fix). `npx expo start` should print `env: load .env .env.development`.
- [ ] `npx expo-doctor` → Expected: 18/18 passed.
- [ ] `npx expo login` on PC; log into the same account in Expo Go (avatar, top right).
- [ ] `npx expo start` → scan QR in Expo Go → app loads.
- [ ] Device checklist (spec "Must not break"): login/session restore · feed + video · create post with photo AND video · story upload · profile/cover upload · Stripe payment sheet (product + booking deposit, incl. the hold-timeout path) · CardField screen · 3DS test card returns to the app · push permission + token (check backend received it) · camera photo + video (note the photo file size) · latest-photo thumbnail on the Create Post screen · deep links `/claim`, `/finish` · story viewer bottom sheet · swipe pager, double-tap like · keyboard on signup, booking, checkout and messaging screens (no field hidden, no extra gap) · onboarding status bar.
- [ ] Stripe and push need a development build for a full test (Expo Go can't run every native path). Run `eas build --profile development --platform ios`; install and repeat the Stripe and push items.
- [ ] All pass → mark PR ready → Legend merges in GitHub UI → update the vault (`Hosting, Repos & Deploys`, OutsydeCapture notes).

### Task 6: Laptop (after merge)
- [ ] Same as Task 5's first four steps on the laptop: Node ≥ 22.13, `npm install -g eas-cli`, `git pull` on main, `npm ci`, `npx expo-doctor` 18/18, `npx expo login`, Expo Go loads.

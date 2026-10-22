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
1. Photo/video/story/profile uploads (`services/mediaUpload.ts`, `services/cloudinary.ts`) still succeed after SDK 56 — RN-style `{uri,name,type}` FormData under the fetch change. Guarded by Task 3's `EXPO_PUBLIC_USE_RN_FETCH=1` and the device test in Task 5.
2. Stripe payment sheet + CardField after 0.50.3 → 0.64.0 (6 files use `initPaymentSheet`/`presentPaymentSheet`/`confirmPayment`/`CardField`). Device test in Task 5.
3. Push token registration in Expo Go and in builds (`services/pushNotifications.ts:62` needs projectId). Device test in Task 5.
4. Reanimated/worklets animations (15 `runOnJS`/`runOnUI`/`useFrameCallback` uses), bottom sheets, swipe pager. Device test in Task 5.
5. Android-only config survives: intentFilters, adaptive icon, `./plugins/withLegacyStoragePermissions`, `GOOGLE_SERVICES_JSON` in `app.config.js`. Checked by `npx expo config --type public` diff in Tasks 2–4.

## Shared gate (referenced by every task as "run the gate")
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort > /tmp/tscN.txt
comm -13 $SCRATCH/tsc54.txt /tmp/tscN.txt   # Expected: empty output (no new errors)
npx expo export --platform ios --platform android --output-dir $SCRATCH/exportN   # Expected: both bundles listed, "Exported:"
npx expo config --type public --json > $SCRATCH/configN.json   # diff vs previous step; only intended keys change
```

---

### Task 0: Regression check (read-only, before any build)
Run the regression prompt (sent to Legend in chat) and record results in the PR description. Gate: every consumer listed is proven safe or has a test in Task 5. No commits.

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
- [ ] `grep -rn '"notification"' app.json` → Expected: no match (field removed in SDK 55).
- [ ] Run the gate. Fix only new TS errors, minimally.
- [ ] Commit: `chore(deps): upgrade to Expo SDK 55`

### Task 3: SDK 56

**Files:** `package.json`, `package-lock.json`, `eas.json`, possibly source files named by new TS errors.

- [ ] `npx expo install expo@^56.0.0 --fix` → expect expo 56.0.x, RN 0.85.x, react 19.2.3, Stripe 0.64.0, TypeScript 6.x.
- [ ] Add `"EXPO_PUBLIC_USE_RN_FETCH": "1"` to the `env` of the `development`, `preview` and `production` profiles in eas.json.
- [ ] `ls node_modules/expo-router` → Expected: not found (the SDK 56 React Navigation codemod applies only to expo-router apps). If present, stop and report.
- [ ] Confirm `@expo/vector-icons` stays a direct dependency in package.json.
- [ ] Run the gate. Fix only new TS errors (TS 6), minimally, and list each in the commit body.
- [ ] Commit: `chore(deps): upgrade to Expo SDK 56, keep RN fetch`

### Task 4: SDK 57

- [ ] `npx expo install expo@^57.0.0 --fix` → expect expo ≥ 57.0.9 (memory fix), RN 0.86.x, reanimated 4.5.x, worklets 0.10.x.
- [ ] Run the gate.
- [ ] Commit: `chore(deps): upgrade to Expo SDK 57`
- [ ] Push branch, open **draft** PR to `main` with: per-step gate results, config diffs, regression results, device test checklist.

### Task 5: Legend's PC + iPhone verification (Legend runs; blocks merge)

- [ ] `git fetch origin && git checkout chore/expo-sdk-57 && git pull` then `npm ci`.
- [ ] Add `EXPO_PUBLIC_USE_RN_FETCH=1` to the local `.env`.
- [ ] `npx expo-doctor` → Expected: 18/18 passed.
- [ ] `npx expo login` on PC; log into the same account in Expo Go (avatar, top right).
- [ ] `npx expo start` → scan QR in Expo Go → app loads.
- [ ] Device checklist (spec "Must not break"): login/session restore · feed + video · create post with photo AND video · story upload · profile/cover upload · Stripe payment sheet (product + booking deposit) · CardField screen · push permission + token (check backend received it) · camera + save to library · deep links `/claim`, `/finish` · bottom sheets, swipe pager, keyboard.
- [ ] Stripe and push need a development build for a full test (Expo Go can't run every native path). Run `eas build --profile development --platform ios`; install and repeat the Stripe and push items.
- [ ] All pass → mark PR ready → Legend merges in GitHub UI → update the vault (`Hosting, Repos & Deploys`, OutsydeCapture notes).

### Task 6: Laptop (after merge)
- [ ] Same as Task 5's first four steps on the laptop: Node ≥ 22.13, `npm install -g eas-cli`, `git pull` on main, `npm ci`, `.env` line, `npx expo-doctor` 18/18, `npx expo login`, Expo Go loads.

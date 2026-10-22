# Expo SDK 54 → 57 Upgrade — Design

Approved by Legend, 2026-10-22.

## Intent
OutsydeCapture is on Expo SDK 54 (expo 54.0.25, react-native 0.81.5, react 19.1.0). The App Store Expo Go only runs SDK 57 projects, so Legend can no longer preview the app in Expo Go. Upgrade to SDK 57 so Expo Go works again and the upcoming Android build starts on a current SDK. Users should see no change in behavior.

## Goals
- App on the latest SDK 57 patch (expo 57.0.31 at time of writing, RN 0.86.3, React 19.2.3), opening in Expo Go on iPhone.
- `npx expo-doctor` 18/18 on Legend's PC.
- No new TypeScript errors vs the SDK 54 baseline (67 errors on main @ ae2b3dd).
- iOS and Android JS bundles build (`npx expo export`).

## Non-goals
- SDK 58 (no Expo Go support yet).
- Android store submission (next project).
- Fixing the 67 pre-existing TypeScript errors.
- Feature work, refactors, migrating off deprecated-but-working APIs (expo-media-library legacy API, @expo/vector-icons).

## Anti-goals (failure even if it "works")
- Any change to what users see or how payments, uploads, push, deep links behave.
- Changes landing on `main` without Legend's merge in the GitHub UI.

## Approaches
1. **One SDK at a time on one branch (chosen).** 54→55→56→57, one commit each, checks after each. Any break is pinned to one SDK. ~15–30 min extra.
2. Jump straight to 57. Same end code, but a break could come from three SDKs of changes.
3. SDK 58. Ruled out: Expo Go can't run it yet.

Legend picked 1.

## Decided
- Branch `chore/expo-sdk-57`, one draft PR, Legend merges in GitHub UI.
- First commit: `extra.eas.projectId = ba1ccd05-f527-4e0b-9a6d-f31184afdd4b` in app.json (verified via `eas project:info` = @go.outsyde/outsyde). `services/pushNotifications.ts:62` reads it.
- Convert `assets/images/outsyde-icon.jpg` to PNG (same 586×586 image, no redesign) and point `icon` and the splash `image` at it. Fixes the expo-doctor schema failure.
- Remove `newArchEnabled` and `edgeToEdgeEnabled` from app.json (removed in SDK 55; both behaviors are now permanent, and the app already uses them).

## Builder's calls (Claude's, flagged for Legend)
- **Keep React Native's fetch (`EXPO_PUBLIC_USE_RN_FETCH=1`).** SDK 56 makes `expo/fetch` the global fetch. The app's uploads append React Native-style `{ uri, name, type }` objects to FormData (`services/mediaUpload.ts:84`, `services/cloudinary.ts:41,115,194`), and Expo's docs don't say whether `expo/fetch` supports that. Opting out keeps today's upload path exactly. Set it in every eas.json build profile and in the local `.env`. Revisit as a separate change later.
- Keep Hermes v1 (SDK 56 default). The memory regression is fixed in SDK 57 at RN 0.86.2+.
- Accept TypeScript as pinned by each SDK. If TS 6 adds new errors, fix them minimally in the commit for that SDK.

## Constraints
- Node on Legend's PC: v22.13+ (check). Workspace Node: v22.22.0.
- Minimum iOS rises to 16.4 in SDK 56 (older devices stop receiving updates). Accepted as part of the upgrade.
- Production DB and backend are untouched.

## Must not break (manual test list on device)
Login/session restore · Feed and video playback · Create post with photo and video upload · Story upload · Profile/cover image upload · Stripe payment sheet (product checkout + booking deposit) · CardField screens · Push permission prompt + token registration · Camera + media library save · Deep links `/claim`, `/finish` · Animations, bottom sheets, swipe pager, keyboard handling.

## Left to the builder
Exact patch versions come from `npx expo install --fix` at each step. Any extra code fixes needed for TypeScript or bundling stay minimal and are noted in that step's commit message.

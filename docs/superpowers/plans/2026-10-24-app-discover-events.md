# App Discover EVENTS Tab, Pro Feed Event Card, Event Page with Free RSVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Launch Board row p4-discover. That means EVENTS as the first tab in Discover, event cards in the Pro feed, and an event page with working free RSVP in OutsydeCapture, plus a "Get the app" card on goutsyde.com/e/[slug].

**Architecture:** App only, against backend routes that are already live (no backend change). Pure logic lives in `utils/eventsLogic.ts` (ported from outsyde-web `app/events/eventsLogic.ts` + `app/e/_shared/format.ts`, node-tested). Three new UI units: `screens/EventsTab.tsx` (rendered inside Discover), `components/events/EventFeedCard.tsx` (Pro feed), `screens/EventDetailScreen.tsx` (root stack). Web change is one card in `app/e/[slug]/EventClient.tsx`.

**Tech Stack:** Expo 57 / RN 0.86 (Hermes), TypeScript, expo-location ~57.0.22, node:test via `npx tsx --test`; Next.js (outsyde-web).

**Spec:** Audit & Regression page https://claude.ai/artifact/KLqjJ7Wf82BvnSopBDXFfa · vault `Handoffs/Events App Step 5 (p4-discover) — Audit & Regression (2026-10-24).md` · mockup canvas screens 21 to 24 (https://claude.ai/artifact/PkGMJ3tib9mtbYdsVvorUr) · `Features/Events Phase 3 — Discover Design.md`.

## Global Constraints
- No backend, migration or env change. Old app builds must be unaffected.
- `api.getFeed` stays unchanged. Coordinates go only to `GET /api/events` as `lat`/`lng`, never to `/api/feed`.
- Tab order: EVENTS · FOLLOWING · PRO · PULSE. Discover opens on PRO.
- Near me never shows the permission prompt after a denial. It uses the location already allowed. If permission was never asked, it asks once. If denied, it shows an "Open Settings" action and falls back to the city saved at onboarding (`@outsyde_onboarding_city`).
- Pro feed event cards: upcoming public events starting within 14 days, at most one card per 8 posts, nearest-first (40 km) only when location is already granted.
- Copy uses real punctuation with no dashes. Fees appear only as "with service fee" totals, never as a percentage. No points copy on tickets.
- Colors: gold `#E8B930` (tab row, EVENT tag, Get tickets/RSVP), green `#1A3C34` (Follow, cover placeholders, "You're going" card), soft green text `#9FC2B5`, cream `#F5F0E6`, cards `#1C1C1E`, page `#0B0B0B`/`#000`. Titles in the app's display style.
- Host names come from the backend as given (display name). Never show a real name.
- Errors from events routes are `{ success:false, error:{ code, message } }`. In the app the thrown `ApiError` has `body.error.code`. Its `.message` is NOT a string for these routes, so read `body.error`.
- Paid ticket types show their price and a disabled "Coming soon in the app" button (p4-buy replaces it). The My Tickets chip is hidden in this PR.
- App: tsc error count stays 67. All existing 13 test files keep passing.

## Review Focus
1. **Hermes without `Intl…formatToParts`:** date labels must still be right. `zonedParts` falls back to parsing `toLocaleString` output (tested both ways, Task 1).
2. **Event in another time zone than the phone:** labels use the event's zone, while Tonight and This weekend ranges use the phone's zone (tested, Task 1).
3. **Double tap on RSVP or a retry after a network timeout:** must not create two RSVPs. One idempotency key per attempt is reused on retry and cleared on success or when the type or quantity changes (tested, Task 1 `rsvpKeyNext`).
4. **Location denied, then Near me tapped:** no prompt, Settings action plus city fallback (tested, Task 1 `nearMeDecision`).
5. **Pro feed with fewer than 8 posts, or more events than slots:** no event card before post 4, and spare events are dropped, never stacked (tested, Task 1 `mixEventsIntoFeed`).

---

### Task 1: Pure event logic + API calls

**Files:**
- Create: `utils/eventsLogic.ts`, `utils/eventsLogic.test.ts`
- Modify: `services/api.ts` (add three methods next to `getFeed`, ~:4569)

**Interfaces:**
- Produces (types): `EventCard` (same fields as backend `eventList.ts` EventCard), `EventPage` (`event` + `ticketTypes` from `GET /api/events/slug/:slug`), `PublicTicketType`, `Filters {near, free, when}`, `Coords {lat,lng}`.
- Produces (functions): `zonedParts(date, tz)`, `zonedInstant(...)`, `tonightRange(now, tz)`, `weekendRange(now, tz)`, `buildEventsQuery({filters, now, tz, coords?, cursor?, limit?}): string`, `feedEventsQuery(now, coords|null): string`, `whenLabel(e, now)`, `priceLabel(e)`, `whereLabel(e)`, `dateBlock(e) -> {weekday, day}`, `isEventCard(x)`, `mixEventsIntoFeed<T>(posts: T[], events: EventCard[], every = 8): Array<T | {kind:"event"; event: EventCard}>`, `isFeedEventItem(x)`, `ticketRow(t: PublicTicketType) -> {right: string; sub: string | null; selectable: boolean; paid: boolean}`, `eventErrorCopy(err: unknown): string`, `rsvpKeyNext(prev: string|null, action: "attempt"|"success"|"changed"): string|null`, `nearMeDecision(status: "granted"|"denied"|"undetermined", canAskAgain: boolean): "use"|"ask"|"settings"`, `revealLine(iso, tz)`, `money(cents)`.
- Produces (api.ts): `listEvents(query: string, authToken?): Promise<{events: EventCard[]; nextCursor: string|null}>`, `getEventBySlug(slug, authToken?): Promise<EventPage>`, `rsvpEvent(eventId, body: {ticketTypeId; quantity; idempotencyKey}, authToken): Promise<{order: {id; ticketCount; tickets: {id; code}[]}}>`.

- [ ] **Step 1: Write failing tests** in `utils/eventsLogic.test.ts`. Port every case from outsyde-web `tests/discover-logic.test.ts` and `tests/events-*-logic.test.ts` that covers the functions above, plus:
  - `zonedParts` gives identical results with `formatToParts` present and with it deleted from `Intl.DateTimeFormat.prototype` (stubbed per test), for `America/New_York` at `2026-11-01T05:30:00Z` (DST end) and `America/Los_Angeles`.
  - `whenLabel({startsAt:"2026-10-24T23:30:00Z", timezone:"America/New_York"}, now 2026-10-24T16:00:00Z)` → `"TONIGHT · 7:30 PM"`. The same event viewed with a Los Angeles `now` gives the same label (it uses the event's zone).
  - `weekendRange` from a Wednesday in New York → Friday 17:00 to Sunday 23:59:59 local. From Saturday it starts at `now`.
  - `buildEventsQuery` near with coords → `lat`, `lng`, `radiusKm=40`. Near without coords → none of the three. Never emits `latitude`.
  - `feedEventsQuery(now, null)` has `from=now`, `to=now+14d`, `limit=10`, no `lat`.
  - `mixEventsIntoFeed(posts10, [e1,e2])` puts `e1` after post 4 (index 4) and `e2` nowhere (needs 16 posts). `mixEventsIntoFeed(posts3, [e1])` returns posts3 unchanged. 20 posts with 3 events → events at indexes 4 and 13.
  - `ticketRow`: free on_sale → `{right:"Free", selectable:true, paid:false}`. Paid on_sale with buyerTotalCents 2259 → `{right:"$20.00", sub:"$22.59 with service fee", selectable:false, paid:true}`. `salesStatus` sold_out → `"Sold out"`. not_started with salesStartAt → `"On sale Oct 26"`. ended → `"Sales ended"`. Remaining ≤ 10 on a free type → sub `"10 spots left"`.
  - `eventErrorCopy({status:409, body:{error:{code:"SOLD_OUT", message:"Sold out."}}})` → `"These tickets are sold out."` (same CODE_COPY table as the web). An unknown code uses `body.error.message`. Status ≥500, or no body → `"Something went wrong. Try again."`
  - `rsvpKeyNext(null,"attempt")` returns a new key k. `rsvpKeyNext(k,"attempt")` → k. `"success"` → null. `"changed"` → null.
  - `nearMeDecision("granted",*)`→"use". `("undetermined",true)`→"ask". `("denied",false)`→"settings". `("denied",true)`→"settings" (we never re-prompt after a no).

- [ ] **Step 2:** Run `npx tsx --test utils/eventsLogic.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `utils/eventsLogic.ts`. Copy the web functions verbatim where they exist. `zonedParts` uses `formatToParts` when `typeof Intl.DateTimeFormat.prototype.formatToParts === "function"`, else parses `new Intl.DateTimeFormat("en-US",{timeZone, hourCycle:"h23", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"}).format(date)` with `/(\d+)\/(\d+)\/(\d+),? (\d+):(\d+):(\d+)/` (and treats hour 24 as 0). `fmt(iso, tz, opts)` = `new Date(iso).toLocaleString("en-US", {...opts, timeZone: safeZone(tz)})`. Keys come from `Math.random`/`Date.now` (no crypto on Hermes).
- [ ] **Step 4:** Add the three api.ts methods with `this.request`. Bearer goes in `headers.Authorization` when a token is given (same as `getFeed`). `rsvpEvent` POSTs JSON to `/api/events/${encodeURIComponent(id)}/rsvp`.
- [ ] **Step 5:** Run the new test (PASS), all 13 old test files (PASS), and `npx tsc --noEmit -p .` (67 errors). Commit: `feat(events): event logic and API calls for Discover EVENTS`.

### Task 2: EVENTS in the tab row + EVENTS tab

**Files:**
- Modify: `components/FeedToggle.tsx` (FeedMode adds `"events"`, rendered first; the four Pressables become one map over `[["events","EVENTS"],["following","FOLLOWING"],["pro","PRO"],["pulse","PULSE"]]`, same styles)
- Modify: `screens/DiscoverScreen.tsx`: `swipeToToggle` (:134-142) becomes order `["events","following","pro","pulse"]` (left = next, right = previous, clamped). In the body switch (:684-778), `feedMode === "events"` renders `<EventsTab />`.
- Create: `utils/eventLocation.ts`. `getEventCoords(): Promise<{coords: Coords|null; status; canAskAgain}>` only checks permission and reads the position when granted. `requestOnce(): Promise<Coords|null>` calls `requestForegroundPermissionsAsync` once. `savedCity(): Promise<string|null>` reads `@outsyde_onboarding_city`.
- Create: `screens/EventsTab.tsx`

**Interfaces:**
- Consumes: Task 1 `buildEventsQuery`, `whenLabel`, `priceLabel`, `whereLabel`, `dateBlock`, `nearMeDecision`, `api.listEvents`.
- Produces: `export default function EventsTab(): JSX.Element`. It navigates `navigation.navigate("EventDetail", { slug })` (route added in Task 4. Until then the call site type-checks against Task 4's param type, so do Task 4's `navigation/types.ts` line in this task).

- [ ] **Step 1:** Add `EventDetail: { slug: string }` to `RootStackParamList` in `navigation/types.ts`.
- [ ] **Step 2:** FeedToggle + Discover swipe change. Check: tsc 67, and the three render spots still pass `mode`/`onModeChange` unchanged.
- [ ] **Step 3:** Build EventsTab to match canvas 22 and 24:
  - Chips row: Near me / Tonight / This weekend / Free (cream fill when on). No My Tickets chip.
  - The first event is the featured card (cover 180, "From $X" or "Free RSVP" or "Sold out" badge, date block, title, `time · where · by host`). The rest are 76px-thumb rows.
  - FlatList with pull to refresh and `onEndReached` paging via `nextCursor`. A sequence ref drops stale answers, like the Following tab (:269-304).
  - States: loading skeleton; empty "NO EVENTS YET" / "There are no upcoming events right now. Check back soon." (no Host button in this PR, because hosting arrives with p4-host); no matches "NOTHING MATCHES" + "Clear filters"; location off "TURN ON LOCATION" + "Open Settings" (`Linking.openSettings()`) + "Show events in {city}" when a saved city exists; error "COULD NOT LOAD" + "Try again".
  - Near me: `nearMeDecision`. "use" → coords. "ask" → `requestOnce()`. "settings" → location-off state. If a city is saved, the list loads `city=` instead of coords and a note reads "Showing events in {city}".
  - Time zone for Tonight/Weekend: `Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"`.
- [ ] **Step 4:** tsc 67, all tests green. Commit: `feat(events): EVENTS tab in Discover`.

### Task 3: Event card in the Pro feed

**Files:**
- Create: `components/events/EventFeedCard.tsx` (canvas 21: host row with avatar, "Hosting an event", gold EVENT tag; 220px cover with green placeholder `#1A3C34` + "Event" in `#9FC2B5` and the date block; title, `time · where · price` line, gold "Get tickets" pill). The whole card is one Pressable with an `accessibilityLabel` of `"Event: {title}, {when}"`.
- Modify: `screens/DiscoverScreen.tsx`. Add `feedEventsList` state, filled by `fetchFeedEvents()` (called alongside `fetchProFeed` on mount and refresh) using `getEventCoords()` (never prompts) + `feedEventsQuery`. Add `proFeedItems = useMemo(() => mixEventsIntoFeed(proFeedPosts, feedEventsList))`. The Pro FlatList (:686) takes `data={proFeedItems}`, `keyExtractor` returns `event-${id}` for event items, and `renderProFeedItem` renders `EventFeedCard` for `isFeedEventItem(item)` (before any post logic). A failed events call leaves the feed exactly as today (catch → []).

**Interfaces:**
- Consumes: Task 1 `mixEventsIntoFeed`, `isFeedEventItem`, `feedEventsQuery`, `whenLabel`, `whereLabel`, `priceLabel`, `dateBlock`; Task 2 `getEventCoords`.
- Produces: `EventFeedCard({ event, onPress }: { event: EventCard; onPress: () => void })`.

- [ ] **Step 1:** Check every other reader of the Pro list data uses `feedPosts`/`proFeedPosts`, not `proFeedItems` (like/save/comment lookups :422-469, scroll restore). Only the FlatList and the render/key functions see event items. Visible-index tracking (:363-373) comes from the same FlatList data, so `isVisible` stays aligned.
- [ ] **Step 2:** Implement. tsc 67, tests green. Commit: `feat(events): event cards in the Pro feed`.

### Task 4: Event page with free RSVP

**Files:**
- Create: `screens/EventDetailScreen.tsx` (canvas 23)
- Modify: `navigation/RootNavigator.tsx` (register `EventDetail`, `headerShown:false`, same animation as `PostDetail`)

**Interfaces:**
- Consumes: Task 1 `api.getEventBySlug`, `api.rsvpEvent`, `ticketRow`, `eventErrorCopy`, `rsvpKeyNext`, `revealLine`, `whenLabel`; the existing `api.followUser/unfollowUser/checkFollowStatus` with `event.host.followId`.
- Produces: screen for route `EventDetail: { slug: string }`.

- [ ] **Step 1:** Implement:
  - Load with the token when signed in, and again on focus (so coming back from Auth refreshes `viewerHasTicket`).
  - Header shows the cover, or the green placeholder; the back and share buttons sit on 44px circles. Share uses RN `Share.share({ message: "https://goutsyde.com/e/{slug}" })`.
  - Date line in gold, `{WEEKDAY, MON D} · {start} TO {end}` in the event zone, then the title.
  - Host row with avatar, name and "Host", and a green Follow / outline Following button. Signed out goes to `navigate("Auth", {})`. Hidden when `viewerIsHost` or there's no `followId`. A busy flag allows one request at a time.
  - Location card: hidden shows city plus `revealLine` or "The exact address is shared once you have a ticket.". Shown gives venue, address lines, city.
  - Tickets list from `ticketRow`. Tapping a selectable free row selects it, auto-selected when there's exactly one. A quantity stepper appears within `minPerOrder..maxPerOrder` when max > 1.
  - Then About, and the refund line (`refundPolicy`/`refundCutoffHours`, same wording as web EventClient).
  - Banners for cancelled, started, ended and draft (host preview).
  - Bottom bar: free selected → gold "RSVP". It goes to Auth when signed out. Otherwise `rsvpEvent` with `rsvpKeyNext`. On success it shows a green "You're going" card ("Your RSVP confirmation is in your email.") and reloads. On error it shows `eventErrorCopy`. Paid-only events → price "From $X" plus a disabled "Coming soon in the app". Sold out → disabled "Sold out". A holder whose types are all free sees the "You're going" card and no bar.
  - 404 → "This event isn't available." with Back.
- [ ] **Step 2:** Register the route. tsc 67, tests green. iOS + Android export: `npx expo export --platform ios --output-dir /tmp/exp-ios` and `--platform android` both succeed. Commit: `feat(events): event page with free RSVP`.

### Task 5 [Web]: "Get the app" card on /e/[slug]

**Files:**
- Modify: outsyde-web `app/e/[slug]/EventClient.tsx` (a card after the About/refund section, before the sticky bar. Uses `APP_STORE_URL`, `PLAY_STORE_URL` from `@/lib/app-stores`).
- Test: outsyde-web `tests/event-app-card.browser.py` (Playwright against `next dev` with a stub backend answering `/api/events/slug/:slug` with a fixture).

- [ ] **Step 1:** Copy, exactly: title "Get the Outsyde app", body "Faster checkout and all your tickets in one place.", links "Download on the App Store" and "Get it on Google Play" (open in a new tab, `rel="noopener noreferrer"`). Shown on every event state except a 404. It never covers the buy bar. The page bottom padding already clears the bar, so check at 375px width.
- [ ] **Step 2:** The browser test asserts the card text, both hrefs, and that the card's bottom is above the `.ev-bar` top when scrolled to the end, at 375 and 1280 widths. Then `npx tsc --noEmit` clean, `npx eslint app/e` no new problems, `npm run build` passes. Commit: `feat(events): get the app card on the event page`.

### Task 6: Verification and handoff
- [ ] App: `npx tsc --noEmit -p .` = 67; every `*.test.ts` passes; iOS + Android `expo export` succeed; `git diff --stat main` touches only the files above.
- [ ] Web: tsc, eslint, build, new browser test green.
- [ ] Whole-branch review by a fresh reviewer. Fix Important findings.
- [ ] Push both branches. PR text plus +/- diffs to Legend. Update the board row, the vault note, Next EAS Build (app PR waits for the EAS build with p4-buy and p4-host).

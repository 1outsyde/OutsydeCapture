// Guard for the branded loader rollout: screens moved to OutsydeLoader must
// not go back to the generic ActivityIndicator for those loading states.
// Run: npx tsx utils/outsydeLoaderUsage.test.ts
//
// Each entry: file -> how many OutsydeLoader elements it must contain.
// Step 3a: what Outsyders see (20 loading states in 18 files).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const STEP_3A: Record<string, number> = {
  "screens/DiscoverScreen.tsx": 2, // Pro feed first load, Following tab first load
  "screens/PulseFeedScreenV2.tsx": 1, // first load (loading more footer: step 4)
  "screens/SearchScreen.tsx": 1,
  "screens/MessagesScreen.tsx": 1,
  "screens/ChatScreen.tsx": 1,
  "screens/ProfileFeedScreen.tsx": 1,
  "screens/FollowListScreen.tsx": 1,
  "screens/PhotographerDetailScreen.tsx": 1,
  "screens/BookingScreen.tsx": 1,
  "components/BookingFlow.tsx": 2, // calendar month, services list
  "components/AvailabilityCalendar.tsx": 1,
  "screens/EventDetailScreen.tsx": 1,
  "screens/TicketDetailScreen.tsx": 1,
  "components/events/BuyTicketsModal.tsx": 1, // Confirming your payment
  "screens/RateReviewScreen.tsx": 1,
  "components/quotes/MyQuotesList.tsx": 1,
  "screens/QuoteLinkScreen.tsx": 1,
  "screens/QuoteComposeScreen.tsx": 1,
};

let total = 0;
for (const [file, want] of Object.entries(STEP_3A)) {
  const src = readFileSync(file, "utf8");
  const got = (src.match(/<OutsydeLoader[\s/>]/g) ?? []).length;
  assert.ok(got >= want, `${file}: expected ${want} OutsydeLoader, found ${got}`);
  assert.ok(src.includes('import OutsydeLoader from "@/components/OutsydeLoader"'), `${file}: import`);
  total += want;
}
assert.equal(total, 20, "step 3a covers 20 loading states");

// The loading only screens in 3a must not render a large spinner any more.
for (const file of [
  "screens/ChatScreen.tsx",
  "screens/ProfileFeedScreen.tsx",
  "screens/PhotographerDetailScreen.tsx",
  "screens/BookingScreen.tsx",
  "components/quotes/MyQuotesList.tsx",
  "screens/QuoteLinkScreen.tsx",
  "screens/QuoteComposeScreen.tsx",
]) {
  assert.ok(!readFileSync(file, "utf8").includes("<ActivityIndicator"), `${file}: no ActivityIndicator left`);
}

console.log("outsydeLoaderUsage tests passed");

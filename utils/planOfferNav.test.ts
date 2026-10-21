import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { openPlanOffer } from "./planOfferNav";
import * as store from "./planOfferStore";
import type { PlanOffer } from "./planOffer";

function fakeNav() {
  const calls: unknown[][] = [];
  return { calls, navigate: (...args: unknown[]) => calls.push(args) };
}

beforeEach(() => {
  store.resetForUser(null);
  store.resetForUser("u1");
});

test("business owner: back to the main tabs and the popup opens", () => {
  store.setOffer({ id: "o1", plan: "free" } as PlanOffer);
  store.dismissPopup();
  const nav = fakeNav();
  openPlanOffer(nav, { role: "business", isGuest: false });
  // pop: go back to the existing main tabs, never push a second copy on top (review I1)
  assert.deepEqual(nav.calls, [["Main", undefined, { pop: true }]]);
  assert.equal(store.wantsPopup(), true);
});

test("signed out or guest: sign in first", () => {
  const nav = fakeNav();
  openPlanOffer(nav, null);
  openPlanOffer(nav, { role: "business", isGuest: true });
  assert.deepEqual(nav.calls, [
    ["Auth", {}],
    ["Auth", {}],
  ]);
});

test("another role on this phone: nothing happens", () => {
  store.setOffer({ id: "o1", plan: "free" } as PlanOffer);
  store.dismissPopup();
  const nav = fakeNav();
  openPlanOffer(nav, { role: "consumer", isGuest: false });
  assert.deepEqual(nav.calls, []);
  assert.equal(store.wantsPopup(), false);
});

test("a tap also asks for a fresh check (the offer may not be loaded yet)", () => {
  const before = store.getCheckRequest();
  openPlanOffer(fakeNav(), { role: "business", isGuest: false });
  assert.notEqual(store.getCheckRequest(), before);
});

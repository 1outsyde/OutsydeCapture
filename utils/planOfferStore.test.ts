import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as store from "./planOfferStore";
import type { PlanOffer } from "./planOffer";

const offer = { id: "o1", plan: "grandfathered" } as PlanOffer;
const other = { id: "o2", plan: "free" } as PlanOffer;

beforeEach(() => {
  store.resetForUser(null);
  store.resetForUser("u1");
});

test("a new offer wants the popup once per launch", () => {
  store.setOffer(offer);
  assert.equal(store.wantsPopup(), true);
  store.dismissPopup();
  assert.equal(store.wantsPopup(), false);
  // checking again in the same launch does not bring it back
  store.setOffer(offer);
  assert.equal(store.wantsPopup(), false);
});

test("banner shows while an offer is pending, X hides it for this launch", () => {
  assert.equal(store.showBanner(), false);
  store.setOffer(offer);
  assert.equal(store.showBanner(), true);
  store.hideBanner();
  assert.equal(store.showBanner(), false);
  store.setOffer(offer);
  assert.equal(store.showBanner(), false);
});

test("a different offer starts fresh", () => {
  store.setOffer(offer);
  store.dismissPopup();
  store.hideBanner();
  store.setOffer(other);
  assert.equal(store.wantsPopup(), true);
  assert.equal(store.showBanner(), true);
});

test("a tap (push, Activity, banner) opens the popup again", () => {
  store.setOffer(offer);
  store.dismissPopup();
  store.requestOpen();
  assert.equal(store.wantsPopup(), true);
  store.dismissPopup();
  assert.equal(store.wantsPopup(), false);
});

test("a tap before the offer has loaded opens it once it loads", () => {
  store.requestOpen();
  assert.equal(store.wantsPopup(), false);
  store.setOffer(offer);
  store.dismissPopup();
  store.requestOpen();
  assert.equal(store.wantsPopup(), true);
});

test("clearing (accepted or gone) removes popup and banner", () => {
  store.setOffer(offer);
  store.clearOffer();
  assert.equal(store.getOffer(), null);
  assert.equal(store.wantsPopup(), false);
  assert.equal(store.showBanner(), false);
});

test("checking flag holds other popups back while the check runs", () => {
  assert.equal(store.isChecking(), false);
  store.setChecking(true);
  assert.equal(store.isChecking(), true);
  store.setOffer(null);
  assert.equal(store.isChecking(), false);
});

test("another account on this phone starts fresh", () => {
  store.setOffer(offer);
  store.dismissPopup();
  store.resetForUser("u2");
  assert.equal(store.getOffer(), null);
  store.setOffer(offer);
  assert.equal(store.wantsPopup(), true);
});

test("listeners hear every change and can unsubscribe", () => {
  let calls = 0;
  const off = store.subscribe(() => {
    calls++;
  });
  store.setOffer(offer);
  store.dismissPopup();
  off();
  store.hideBanner();
  assert.equal(calls, 2);
});

test("the same account checking again keeps its Not now", () => {
  store.setOffer(offer);
  store.dismissPopup();
  store.resetForUser("u1");
  store.setOffer(offer);
  assert.equal(store.wantsPopup(), false);
});

test("version changes on every change, so React can cache the snapshot", () => {
  const v0 = store.getVersion();
  store.setOffer(offer);
  const v1 = store.getVersion();
  assert.notEqual(v1, v0);
  store.hideBanner();
  assert.notEqual(store.getVersion(), v1);
});

test("claimed: pending offer cleared at once, done screen kept in the store (review C2)", () => {
  store.setOffer(offer);
  store.markClaimed(offer, "dashboard", false);
  assert.equal(store.getOffer(), null);
  assert.equal(store.showBanner(), false);
  assert.deepEqual(store.getClaimed(), {
    offer,
    where: "dashboard",
    payoutsReady: false,
  });
  store.finishClaimed();
  assert.equal(store.getClaimed(), null);
});

test("a late answer with the offer just claimed never brings it back", () => {
  store.setOffer(offer);
  store.markClaimed(offer, "main", true);
  store.setOffer(offer);
  assert.equal(store.getOffer(), null);
  store.setOffer(other);
  assert.equal(store.getOffer()?.id, "o2");
});

test("requestOpen asks for a check", () => {
  const v = store.getCheckRequest();
  store.requestOpen();
  assert.equal(store.getCheckRequest(), v + 1);
});

test("after goutsyde.com, the next return to the app rechecks once (review I3)", () => {
  assert.equal(store.consumeRecheckOnReturn(), false);
  store.recheckOnReturn();
  assert.equal(store.consumeRecheckOnReturn(), true);
  assert.equal(store.consumeRecheckOnReturn(), false);
});

test("another account forgets a claimed screen", () => {
  store.markClaimed(offer, "main", true);
  store.resetForUser("u2");
  assert.equal(store.getClaimed(), null);
});

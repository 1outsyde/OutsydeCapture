import test from "node:test";
import assert from "node:assert/strict";
import { splitSavedCards, applePayCartItems, chargedCents, applePayOutcome, shownBreakdown, makeOneAtATime } from "./savedCardsLogic";

const card = (id: string, isDefault = false) => ({ id, isDefault });

test("default card goes up front, the rest under other saved cards", () => {
  const r = splitSavedCards([card("a"), card("b", true), card("c")], []);
  assert.equal(r.upFront?.id, "b");
  assert.deepEqual(r.others.map((c) => c.id), ["a", "c"]);
});

test("no default: the first chosen card goes up front", () => {
  const r = splitSavedCards([card("old1"), card("new1"), card("new2")], ["old1"]);
  assert.equal(r.upFront?.id, "new1");
  assert.deepEqual(r.others.map((c) => c.id), ["old1", "new2"]);
});

test("an older default card still goes up front", () => {
  const r = splitSavedCards([card("chosen"), card("old", true)], ["old"]);
  assert.equal(r.upFront?.id, "old");
  assert.deepEqual(r.others.map((c) => c.id), ["chosen"]);
});

test("only older cards: nothing up front, all under other saved cards", () => {
  const r = splitSavedCards([card("o1"), card("o2")], ["o1", "o2"]);
  assert.equal(r.upFront, null);
  assert.deepEqual(r.others.map((c) => c.id), ["o1", "o2"]);
});

test("older backend without the older list: first card up front as before", () => {
  const r = splitSavedCards([card("a"), card("b")], []);
  assert.equal(r.upFront?.id, "a");
  assert.deepEqual(r.others.map((c) => c.id), ["b"]);
});

test("no cards: nothing up front, nothing else", () => {
  const r = splitSavedCards([], []);
  assert.equal(r.upFront, null);
  assert.deepEqual(r.others, []);
});

test("Apple Pay sheet shows one Outsyde line with the charged total", () => {
  assert.deepEqual(applePayCartItems(6480), [{ label: "Outsyde", amount: "64.80" }]);
  assert.deepEqual(applePayCartItems(5), [{ label: "Outsyde", amount: "0.05" }]);
});

test("charged amount prefers the amount after points", () => {
  assert.equal(chargedCents({ amountChargedCents: 4000, totalChargedToConsumerCents: 4500 }), 4000);
  assert.equal(chargedCents({ totalChargedToConsumerCents: 4500 }), 4500);
  assert.equal(chargedCents(null), null);
  assert.equal(chargedCents({}), null);
});

test("Apple Pay result: no error is paid, Canceled is canceled, anything else failed", () => {
  assert.equal(applePayOutcome(undefined), "paid");
  assert.equal(applePayOutcome({ code: "Canceled" }), "canceled");
  assert.equal(applePayOutcome({ code: "Failed" }), "failed");
  assert.equal(applePayOutcome({ code: "Unknown" }), "failed");
});

test("price lines only use a server breakdown that has every line", () => {
  const full = { basePriceCents: 6000, consumerUpchargeCents: 480, totalChargedToConsumerCents: 6480, outsydePointsEarned: 1200 };
  assert.equal(shownBreakdown(full), full);
  assert.equal(shownBreakdown({ totalChargedToConsumerCents: 6480 } as any), null);
  assert.equal(shownBreakdown(null), null);
});

test("one checkout at a time: a second tap while one runs is ignored until it finishes", () => {
  const guard = makeOneAtATime();
  assert.equal(guard.start(), true);
  assert.equal(guard.start(), false);
  guard.done();
  assert.equal(guard.start(), true);
});

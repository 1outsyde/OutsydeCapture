import test from "node:test";
import assert from "node:assert/strict";
import {
  DETAILS_PREVIEW_LINES,
  detailsNeedReadMore,
  hasDetailsCard,
} from "./quoteView";

test("short details show in full", () => {
  assert.equal(detailsNeedReadMore(""), false);
  assert.equal(detailsNeedReadMore(null), false);
  assert.equal(detailsNeedReadMore(undefined), false);
  assert.equal(detailsNeedReadMore("   "), false);
  assert.equal(
    detailsNeedReadMore("Two movers, a truck, blankets and wrap"),
    false,
  );
});

test("long details fold behind Read more", () => {
  assert.equal(DETAILS_PREVIEW_LINES, 6);
  assert.equal(detailsNeedReadMore("x".repeat(281)), true);
  assert.equal(detailsNeedReadMore("x".repeat(280)), false);
  assert.equal(detailsNeedReadMore("a\nb\nc\nd\ne\nf"), false);
  assert.equal(detailsNeedReadMore("a\nb\nc\nd\ne\nf\ng"), true);
  assert.equal(detailsNeedReadMore("x".repeat(2000)), true);
});

test("the details card only shows with something in it", () => {
  assert.equal(hasDetailsCard({}), false);
  assert.equal(hasDetailsCard({ details: "", extrasNote: "" }), false);
  assert.equal(hasDetailsCard({ details: "  ", extrasNote: null }), false);
  assert.equal(hasDetailsCard({ details: "Vanilla" }), true);
  assert.equal(hasDetailsCard({ extrasNote: "Stairs are $40 a flight" }), true);
});

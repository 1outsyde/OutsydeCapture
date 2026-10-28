/**
 * Storefront card logic — run with: npx tsx components/products/productCardLogic.test.ts
 */
import assert from "node:assert/strict";
import {
  mustChoose,
  cardOptionsLine,
  cardPriceCents,
  cardPricePrefix,
  needsChoice,
  type VariantSummary,
} from "./productCardLogic";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const diaLux: VariantSummary = {
  count: 11,
  minPriceCents: 12500,
  maxPriceCents: 23500,
  options: [{ name: "Length", valueCount: 11 }],
};
const tee: VariantSummary = {
  count: 12,
  minPriceCents: 3500,
  maxPriceCents: 3500,
  options: [
    { name: "Color", valueCount: 3 },
    { name: "Size", valueCount: 4 },
  ],
};

console.log("productCardLogic");

test("Dia Lux: From $125, 11 lengths, Add opens the product page", () => {
  assert.equal(cardPriceCents(12500, diaLux), 12500);
  assert.equal(cardPricePrefix(diaLux), "From ");
  assert.equal(cardOptionsLine(diaLux), "11 lengths");
  assert.equal(needsChoice(diaLux), true);
});

test("one price for every variation: no From, both options listed", () => {
  assert.equal(cardPricePrefix(tee), "");
  assert.equal(cardOptionsLine(tee), "3 colors · 4 sizes");
});

test("card shows the lowest variation price even when it's under the product price", () => {
  assert.equal(cardPriceCents(5000, { ...diaLux, minPriceCents: 4000 }), 4000);
});

test("no summary or null: product price, no line, Add works as before", () => {
  for (const s of [undefined, null]) {
    assert.equal(cardPriceCents(1500, s), 1500);
    assert.equal(cardPricePrefix(s), "");
    assert.equal(cardOptionsLine(s), null);
    assert.equal(needsChoice(s), false);
  }
});

test("older variations without option names: '2 options'", () => {
  assert.equal(
    cardOptionsLine({
      count: 2,
      minPriceCents: 800,
      maxPriceCents: 1000,
      options: [],
    }),
    "2 options",
  );
});

test("singular and names already ending in s", () => {
  assert.equal(
    cardOptionsLine({ ...tee, options: [{ name: "Color", valueCount: 1 }] }),
    "1 color",
  );
  assert.equal(
    cardOptionsLine({ ...tee, options: [{ name: "Inches", valueCount: 5 }] }),
    "5 inches",
  );
});

test("at most two options listed", () => {
  const three = {
    ...tee,
    options: [...tee.options, { name: "Fit", valueCount: 2 }],
  };
  assert.equal(cardOptionsLine(three), "3 colors · 4 sizes");
});

test("required add-ons open the product page, optional ones don't", () => {
  assert.equal(mustChoose(null, { groupCount: 2, hasRequired: true }), true);
  assert.equal(mustChoose(null, { groupCount: 2, hasRequired: false }), false);
  assert.equal(mustChoose(null, null), false);
  assert.equal(mustChoose(undefined, undefined), false);
  assert.equal(mustChoose(tee, null), true);
});

console.log(`\n${passed} passed`);

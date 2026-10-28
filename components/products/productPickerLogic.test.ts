/**
 * Customer option picker logic — run with: npx tsx components/products/productPickerLogic.test.ts
 */
import assert from "node:assert/strict";
import {
  findVariant,
  initialPicks,
  isColorOption,
  photoFor,
  pick,
  priceRange,
  sortedOptions,
  swatchFor,
  uniformPriceFor,
  valueState,
  type PickerOption,
  type PickerVariant,
} from "./productPickerLogic";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const v = (
  id: string,
  o1: string,
  o2: string | null,
  price: number,
  inv: number | null,
  extra: Partial<PickerVariant> = {},
): PickerVariant => ({
  id,
  label: o2 ? `${o1} / ${o2}` : o1,
  priceCents: price,
  inventory: inv,
  trackInventory: true,
  isActive: true,
  option1: o1,
  option2: o2,
  option3: null,
  imageUrl: null,
  ...extra,
});

// Tee: Color x Size, Cream/XL doesn't exist, Black/L sold out, one switched off.
const teeOptions: PickerOption[] = [
  {
    position: 2,
    name: "Size",
    values: [{ value: "M" }, { value: "L" }, { value: "XL" }],
  },
  {
    position: 1,
    name: "Color",
    values: [{ value: "Black" }, { value: "Cream" }],
  },
];
const tee: PickerVariant[] = [
  v("bm", "Black", "M", 3500, 4, { imageUrl: "black.jpg" }),
  v("bl", "Black", "L", 3500, 0, { imageUrl: "black.jpg" }),
  v("bx", "Black", "XL", 3800, 2, { imageUrl: "black.jpg" }),
  v("cm", "Cream", "M", 3500, 3),
  v("cl", "Cream", "L", 3500, 1),
  v("cx", "Cream", "XL", 3800, 5, { isActive: false }),
];

// Dia Lux: one Length option, prices climb.
const lengths = ['12"', '14"', '16"'];
const dl: PickerVariant[] = [
  v("12", '12"', null, 12500, 5),
  v("14", '14"', null, 13500, 5),
  v("16", '16"', null, 14500, null),
];

console.log("productPickerLogic");

test("options come back in position order", () => {
  assert.deepEqual(
    sortedOptions(teeOptions).map((o) => o.name),
    ["Color", "Size"],
  );
});

test("no variation until every option is picked; then the exact match", () => {
  assert.equal(findVariant(tee, ["Black", null], 2), null);
  assert.equal(findVariant(tee, ["black", "m"], 2)?.id, "bm"); // case-insensitive
  assert.equal(findVariant(tee, ["Cream", "XL"], 2), null); // switched off
});

test("value states follow the other picks", () => {
  assert.equal(valueState(tee, ["Black", null], 1, "L", 99), "soldout");
  assert.equal(valueState(tee, ["Cream", null], 1, "XL", 99), "unavailable");
  assert.equal(valueState(tee, ["Cream", null], 1, "L", 99), "available");
  assert.equal(valueState(tee, [null, null], 1, "L", 99), "available"); // Cream/L in stock
  assert.equal(valueState(tee, [null, "XL"], 0, "Cream", 99), "unavailable");
});

test("variation without its own stock uses the product's stock (same as checkout)", () => {
  const vs = [v("a", "Red", null, 1000, null)];
  assert.equal(valueState(vs, [null], 0, "Red", 0), "soldout");
  assert.equal(valueState(vs, [null], 0, "Red", 3), "available");
  assert.equal(valueState(vs, [null], 0, "Red", null), "available");
  // A variation that doesn't track its own count falls back to the product, like checkout:
  // product sold out (0) → sold out; product No limit (null) → available.
  assert.equal(
    valueState(
      [v("b", "Red", null, 1000, 0, { trackInventory: false })],
      [null],
      0,
      "Red",
      0,
    ),
    "soldout",
  );
  assert.equal(
    valueState(
      [v("b", "Red", null, 1000, 0, { trackInventory: false })],
      [null],
      0,
      "Red",
      null,
    ),
    "available",
  );
});

test("picking a color clears a size that no longer fits", () => {
  assert.deepEqual(pick(tee, [null, "XL"], 0, "Cream", 99), ["Cream", null]);
  assert.deepEqual(pick(tee, ["Cream", "M"], 0, "Black", 99), ["Black", "M"]);
  assert.deepEqual(pick(tee, ["Cream", "L"], 0, "Black", 99), ["Black", null]); // Black/L sold out
});

test("an option with one value is picked for the customer", () => {
  assert.deepEqual(
    initialPicks([{ position: 1, name: "Length", values: [{ value: '18"' }] }]),
    ['18"'],
  );
  assert.deepEqual(initialPicks(teeOptions), [null, null]);
});

test("photo: picked variation, else first match for the color, else product photo", () => {
  assert.equal(photoFor(tee, ["Black", null], null), "black.jpg");
  assert.equal(
    photoFor(tee, ["Cream", "M"], findVariant(tee, ["Cream", "M"], 2)),
    null,
  );
  assert.equal(photoFor(tee, [null, null], null), null);
});

test("From price and range ignore switched-off variations", () => {
  assert.deepEqual(priceRange(dl), { min: 12500, max: 14500 });
  assert.deepEqual(priceRange(tee), { min: 3500, max: 3800 });
  assert.equal(priceRange([]), null);
});

test("chip price shows only when that value has one price", () => {
  assert.equal(uniformPriceFor(dl, 0, lengths[1]), 13500);
  assert.equal(uniformPriceFor(tee, 0, "Black"), null); // 35 and 38
  assert.equal(uniformPriceFor(tee, 1, "XL"), 3800);
});

test("color swatches: vendor hex, else known name, else text chips", () => {
  assert.equal(swatchFor({ value: "Ocean", swatchHex: "#123456" }), "#123456");
  assert.equal(swatchFor({ value: " Black " }), "#0A0A0A");
  assert.equal(swatchFor({ value: "Ocean" }), null);
  assert.equal(
    isColorOption({
      position: 1,
      name: "Color",
      values: [{ value: "Black" }, { value: "Cream" }],
    }),
    true,
  );
  assert.equal(
    isColorOption({
      position: 1,
      name: "Colour",
      values: [{ value: "Black" }, { value: "Ocean" }],
    }),
    false,
  );
  assert.equal(
    isColorOption({ position: 1, name: "Size", values: [{ value: "Black" }] }),
    false,
  );
});

console.log(`\n${passed} passed`);
